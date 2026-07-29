import {
  FiscalProvider,
  FiscalProviderError,
  type FiscalEmitResult,
  type FiscalLine,
  type FiscalRegisterResult,
  type FiscalVenueConfig,
  type SaleDocumentInput,
  type VoidDocumentInput,
} from "./types";
import { isFiscalSandbox } from "./config";
import { decryptFiscalSecrets } from "./crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Adapter Openapi — API "Fatturazione e Scontrini Elettronici" (IT-receipts).
// Documentazione: https://console.openapi.com/apis/invoice/documentation
//
// Contratto usato (dalla documentazione ufficiale):
//   base prod     https://invoice.openapi.com
//   base sandbox  https://test.invoice.openapi.com  (simula l'AdE, nessuna
//                 credenziale reale necessaria in sandbox)
//   auth          Authorization: Bearer <token console Openapi>
//   POST   /IT-receipts        emette il documento commerciale
//     { fiscal_id, items: [{ quantity, description, unit_price,
//       vat_rate_code, discount }], electronic_payment_amount }
//   PATCH  /IT-receipts/{id}   registra un RESO (rimborso parziale)
//   DELETE /IT-receipts/{id}   ANNULLO del documento (rimborso totale)
//   POST   /IT-configurations  censisce l'esercente (fiscal_id + anagrafica
//     + receipts:true per abilitare il servizio scontrini + credenziali
//     Fisconline dai segreti cifrati); OBBLIGATORIO prima della prima
//     emissione, altrimenti HTTP 404 {"error":424, "Fiscal ID not found or
//     not registered, use endpoint /IT_configurations to register it"};
//     senza receipts:true l'emissione fallisce con HTTP 400 {"error":174,
//     "receipts service is not enabled for the user"}.
//     Il messaggio d'errore scrive il path con underscore: proviamo prima la
//     forma documentata col trattino, poi quella del messaggio come fallback.
//
// OGNI dettaglio del provider resta qui dentro: il core vede solo
// FiscalProvider. La risposta viene letta in modo difensivo (più alias di
// campo) e conservata integralmente in `raw` sul FiscalDocument.
// ─────────────────────────────────────────────────────────────────────────────

const PROD_BASE_URL = "https://invoice.openapi.com";
const SANDBOX_BASE_URL = "https://test.invoice.openapi.com";

// "10.00" → "10", "22.00" → "22", "4.00" → "4" (codici aliquota del provider)
function vatRateCode(vatRate: string): string {
  const n = Number(vatRate);
  return Number.isInteger(n) ? String(n) : String(n);
}

function toItems(lines: FiscalLine[]) {
  return lines.map((line) => ({
    quantity: line.quantity,
    description: line.description,
    unit_price: Number(line.unitPrice),
    vat_rate_code: vatRateCode(line.vatRate),
    discount: 0,
  }));
}

// Alias dell'id configurazione nelle risposte del provider
const CONFIG_ID_KEYS = ["configuration_id", "id", "uuid", "fiscal_id"];

// Le risposte Openapi incapsulano spesso in { data: ... }
function unwrapData(raw: unknown): unknown {
  return typeof raw === "object" && raw !== null && "data" in raw
    ? (raw as { data: unknown }).data
    : raw;
}

// 422 {"message":"This fiscal_id already exists","error":112}
function isAlreadyExistsError(message: string): boolean {
  return message.includes('"error":112') || /already exists/i.test(message);
}

function pickString(obj: unknown, keys: string[]): string | undefined {
  if (typeof obj !== "object" || obj === null) return undefined;
  const record = obj as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function parseResult(raw: unknown): FiscalEmitResult {
  const data = unwrapData(raw);

  const providerDocId = pickString(data, ["id", "receipt_id", "uuid"]);
  if (!providerDocId) {
    throw new FiscalProviderError(
      "Risposta del provider senza id documento",
      false
    );
  }

  const result: FiscalEmitResult = { providerDocId, raw };
  const protocol = pickString(data, ["document_number", "protocol_number", "number", "progressive"]);
  if (protocol) result.protocolNumber = protocol;
  const pdf = pickString(data, ["pdf_url", "pdf", "receipt_pdf"]);
  if (pdf) result.pdfUrl = pdf;
  return result;
}

export class OpenapiFiscalProvider implements FiscalProvider {
  private baseUrl(): string {
    return isFiscalSandbox() ? SANDBOX_BASE_URL : PROD_BASE_URL;
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const apiKey = process.env["OPENAPI_FISCAL_API_KEY"];
    if (!apiKey) {
      // Modulo spento: chi arriva qui ha saltato il feature flag
      throw new FiscalProviderError("Modulo fiscale non configurato", false);
    }

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl()}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch (error) {
      // Errore di rete: sempre ritentabile
      throw new FiscalProviderError(
        `Rete verso il provider fiscale: ${error instanceof Error ? error.message : "errore"}`,
        true
      );
    }

    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }

    if (!res.ok) {
      // 5xx / 408 / 429 → ritentabile; altri 4xx → definitivo.
      // 424 "Fiscal ID not registered" (dentro un HTTP 404): l'esercente non
      // è mai stato censito → marcato per l'auto-registrazione.
      const retryable = res.status >= 500 || res.status === 408 || res.status === 429;
      const notRegistered =
        res.status === 404 &&
        (text.includes('"error":424') || /not (found or )?(not )?registered/i.test(text));
      // 174: configurazione esistente ma senza servizio scontrini abilitato
      const receiptsNotEnabled =
        text.includes('"error":174') || /receipts service is not enabled/i.test(text);
      throw new FiscalProviderError(
        `Provider fiscale HTTP ${res.status}: ${text.slice(0, 300)}`,
        retryable,
        { notRegistered, receiptsNotEnabled }
      );
    }

    return json;
  }

  // Censimento dell'esercente: anagrafica completa (fiscal_id + name
  // obbligatori per il provider — senza denominazione risponde 422
  // {"error":334, "The 'name' is required"} — più email/indirizzo se
  // presenti) + eventuali credenziali Fisconline dai segreti cifrati
  // (in sandbox bastano credenziali fittizie).
  async registerMerchant(config: FiscalVenueConfig): Promise<FiscalRegisterResult> {
    if (!config.fiscalId) {
      throw new FiscalProviderError(
        "Configurazione esercente senza identificativo fiscale",
        false
      );
    }
    if (!config.name?.trim()) {
      throw new FiscalProviderError(
        "Configurazione esercente senza denominazione: salvala nella configurazione fiscale",
        false
      );
    }

    let secrets: Record<string, unknown> = {};
    if (config.encryptedSecrets) {
      try {
        secrets = decryptFiscalSecrets(config.encryptedSecrets);
      } catch {
        throw new FiscalProviderError(
          "Impossibile decifrare i segreti esercente (FISCAL_CONFIG_ENCRYPTION_KEY errata o assente)",
          false
        );
      }
    }

    // Anagrafica completa (solo i campi valorizzati) + abilitazione del
    // servizio scontrini (senza receipts:true il provider rifiuta le
    // emissioni con 400 {"error":174}) + segreti in passthrough
    // (es. username/password/pin Fisconline, così come attesi dal provider)
    const payload = {
      fiscal_id: config.fiscalId,
      name: config.name.trim(),
      receipts: true,
      ...(config.email?.trim() ? { email: config.email.trim() } : {}),
      ...(config.address?.trim() ? { address: config.address.trim() } : {}),
      ...(config.city?.trim() ? { city: config.city.trim() } : {}),
      ...(config.province?.trim() ? { province: config.province.trim() } : {}),
      ...(config.zip?.trim() ? { zip: config.zip.trim() } : {}),
      ...secrets,
    };

    let raw: unknown;
    try {
      raw = await this.configurationsRequest("POST", "", payload);
    } catch (error) {
      // "This fiscal_id already exists" (error 112): la configurazione esiste
      // già presso il provider (tentativo precedente) → NON è un errore.
      // Allinea l'anagrafica e recupera l'id esistente: registerMerchant è
      // pienamente idempotente.
      if (error instanceof FiscalProviderError && isAlreadyExistsError(error.message)) {
        return this.recoverExistingConfiguration(config.fiscalId, payload);
      }
      throw error;
    }

    const providerConfigurationId =
      pickString(unwrapData(raw), CONFIG_ID_KEYS) ?? config.fiscalId;

    return { providerConfigurationId, raw };
  }

  // Richieste all'anagrafica configurazioni, con fallback sul path con
  // underscore (è la grafia usata dai messaggi d'errore del provider) quando
  // quello documentato col trattino risponde un 404 "endpoint inesistente"
  // (mai per il 404 "not registered", che è un esito applicativo).
  private async configurationsRequest(
    method: string,
    pathSuffix: string,
    body?: unknown
  ): Promise<unknown> {
    try {
      return await this.request(method, `/IT-configurations${pathSuffix}`, body);
    } catch (error) {
      if (
        error instanceof FiscalProviderError &&
        !error.notRegistered &&
        error.message.includes("HTTP 404")
      ) {
        return this.request(method, `/IT_configurations${pathSuffix}`, body);
      }
      throw error;
    }
  }

  // Configurazione già esistente: PATCH per allineare l'anagrafica attuale
  // (best-effort: il recupero dell'id resta prioritario), poi GET per l'id.
  // Ultimo fallback: il fiscal_id stesso — è la chiave con cui il provider
  // indirizza la configurazione (GET/PATCH/DELETE /IT-configurations/{fiscal_id}).
  private async recoverExistingConfiguration(
    fiscalId: string,
    payload: Record<string, unknown>
  ): Promise<FiscalRegisterResult> {
    console.warn(
      `[Fiscale] configurazione già esistente presso il provider per ${fiscalId}: allineo l'anagrafica e recupero l'id`
    );
    const suffix = `/${encodeURIComponent(fiscalId)}`;
    const { fiscal_id: _inPath, ...updatePayload } = payload;
    void _inPath;

    let raw: unknown = null;
    try {
      raw = await this.configurationsRequest("PATCH", suffix, updatePayload);
    } catch (error) {
      console.warn(
        `[Fiscale] allineamento anagrafica fallito per ${fiscalId} (proseguo col recupero dell'id):`,
        error instanceof Error ? error.message : error
      );
    }

    let providerConfigurationId = pickString(unwrapData(raw), CONFIG_ID_KEYS);
    if (!providerConfigurationId) {
      try {
        raw = await this.configurationsRequest("GET", suffix);
        providerConfigurationId = pickString(unwrapData(raw), CONFIG_ID_KEYS);
      } catch (error) {
        console.warn(
          `[Fiscale] lettura configurazione esistente fallita per ${fiscalId}:`,
          error instanceof Error ? error.message : error
        );
      }
    }

    return {
      providerConfigurationId: providerConfigurationId ?? fiscalId,
      raw: raw ?? { recovered: true, fiscal_id: fiscalId },
    };
  }

  // Auto-riparazione della configurazione: UNA riparazione automatica e UN
  // solo nuovo tentativo di emissione, sia per il 424 (esercente mai censito)
  // sia per il 174 (configurazione esistente senza servizio scontrini —
  // registerMerchant passa dal percorso "già esistente" e fa l'UPDATE con
  // receipts:true). Se anche la riparazione fallisce, il suo errore resta
  // visibile sul documento (lastError) come qualunque altro esito.
  private async withAutoRegistration<T>(
    config: FiscalVenueConfig,
    emit: () => Promise<T>
  ): Promise<T> {
    try {
      return await emit();
    } catch (error) {
      if (
        error instanceof FiscalProviderError &&
        (error.notRegistered || error.receiptsNotEnabled) &&
        config.fiscalId
      ) {
        console.warn(
          error.notRegistered
            ? `[Fiscale] esercente ${config.fiscalId} non censito presso il provider: registrazione automatica e nuovo tentativo di emissione`
            : `[Fiscale] servizio scontrini non abilitato per ${config.fiscalId}: aggiorno la configurazione (receipts) e ritento l'emissione`
        );
        await this.registerMerchant(config);
        return await emit();
      }
      throw error;
    }
  }

  async emitSaleDocument(input: SaleDocumentInput): Promise<FiscalEmitResult> {
    const config = input.venueFiscalConfig;
    return this.withAutoRegistration(config, async () => {
      const raw = await this.request("POST", "/IT-receipts", {
        fiscal_id: config.fiscalId,
        ...(config.configurationId ? { configuration_id: config.configurationId } : {}),
        // Riferimento nostro per riconciliazione/idempotenza lato provider
        external_id: input.idempotencyKey,
        items: toItems(input.lines),
        // Vendita Klink: pagamento sempre elettronico (Stripe)
        electronic_payment_amount: Number(input.total),
        cash_payment_amount: 0,
        invoice_issuing: false,
      });
      return parseResult(raw);
    });
  }

  async emitVoidDocument(input: VoidDocumentInput): Promise<FiscalEmitResult> {
    return this.withAutoRegistration(input.venueFiscalConfig, async () => {
      if (input.full) {
        // Rimborso totale → ANNULLO del documento originale
        const raw = await this.request(
          "DELETE",
          `/IT-receipts/${encodeURIComponent(input.originalProviderDocId)}`
        );
        return parseResult(raw ?? { id: `${input.originalProviderDocId}-void` });
      }
      // Rimborso parziale → RESO delle righe rimborsate
      const raw = await this.request(
        "PATCH",
        `/IT-receipts/${encodeURIComponent(input.originalProviderDocId)}`,
        {
          external_id: input.idempotencyKey,
          items: toItems(input.lines),
        }
      );
      return parseResult(raw);
    });
  }
}
