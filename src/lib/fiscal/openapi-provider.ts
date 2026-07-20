import {
  FiscalProvider,
  FiscalProviderError,
  type FiscalEmitResult,
  type FiscalLine,
  type SaleDocumentInput,
  type VoidDocumentInput,
} from "./types";
import { isFiscalSandbox } from "./config";

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
  // Le risposte Openapi incapsulano spesso in { data: ... }
  const data =
    typeof raw === "object" && raw !== null && "data" in raw
      ? (raw as { data: unknown }).data
      : raw;

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
      // 5xx / 408 / 429 → ritentabile; altri 4xx → definitivo
      const retryable = res.status >= 500 || res.status === 408 || res.status === 429;
      throw new FiscalProviderError(
        `Provider fiscale HTTP ${res.status}: ${text.slice(0, 300)}`,
        retryable
      );
    }

    return json;
  }

  async emitSaleDocument(input: SaleDocumentInput): Promise<FiscalEmitResult> {
    const config = input.venueFiscalConfig;
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
  }

  async emitVoidDocument(input: VoidDocumentInput): Promise<FiscalEmitResult> {
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
  }
}
