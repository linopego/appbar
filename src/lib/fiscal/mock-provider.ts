import {
  FiscalProvider,
  FiscalProviderError,
  type FiscalEmitResult,
  type FiscalRegisterResult,
  type FiscalVenueConfig,
  type SaleDocumentInput,
  type VoidDocumentInput,
} from "./types";

// Provider finto per i test: comportamento programmabile per esercitare la
// macchina a stati (successo, errore ritentabile, errore definitivo) e il
// flusso di censimento ("not-registered": le emissioni falliscono con 424
// finché registerMerchant non viene chiamato; "already-exists": la
// configurazione esiste già presso il provider e registerMerchant la
// recupera in modo idempotente).
// "receipts-disabled": la configurazione esiste ma senza servizio scontrini
// (le emissioni falliscono con 174 finché registerMerchant non la aggiorna).
export type MockBehavior =
  | "succeed"
  | "fail-retryable"
  | "fail-permanent"
  | "not-registered"
  | "already-exists"
  | "receipts-disabled";

export class MockFiscalProvider implements FiscalProvider {
  behavior: MockBehavior;
  registered = false;
  saleCalls: SaleDocumentInput[] = [];
  voidCalls: VoidDocumentInput[] = [];
  registerCalls: FiscalVenueConfig[] = [];

  constructor(behavior: MockBehavior = "succeed") {
    this.behavior = behavior;
  }

  private act(idempotencyKey: string): FiscalEmitResult {
    if (this.behavior === "fail-retryable") {
      throw new FiscalProviderError("mock: errore temporaneo", true);
    }
    if (this.behavior === "fail-permanent") {
      throw new FiscalProviderError("mock: errore definitivo", false);
    }
    if (this.behavior === "not-registered" && !this.registered) {
      throw new FiscalProviderError(
        'mock HTTP 404: {"success":false,"message":"Fiscal ID not found or not registered","error":424}',
        false,
        { notRegistered: true }
      );
    }
    if (this.behavior === "receipts-disabled" && !this.registered) {
      throw new FiscalProviderError(
        'mock HTTP 400: {"message":"receipts service is not enabled for the user, set receipts to true in configuration","error":174}',
        false,
        { receiptsNotEnabled: true }
      );
    }
    return {
      providerDocId: `mock-${idempotencyKey}`,
      protocolNumber: `PROT-${idempotencyKey.slice(0, 6)}`,
      pdfUrl: `https://mock.invalid/receipts/${idempotencyKey}.pdf`,
      raw: { mock: true },
    };
  }

  async emitSaleDocument(input: SaleDocumentInput): Promise<FiscalEmitResult> {
    this.saleCalls.push(input);
    return this.act(input.idempotencyKey);
  }

  async emitVoidDocument(input: VoidDocumentInput): Promise<FiscalEmitResult> {
    this.voidCalls.push(input);
    return this.act(input.idempotencyKey);
  }

  async registerMerchant(config: FiscalVenueConfig): Promise<FiscalRegisterResult> {
    this.registerCalls.push(config);
    if (this.behavior === "fail-retryable") {
      throw new FiscalProviderError("mock: errore temporaneo", true);
    }
    if (this.behavior === "fail-permanent") {
      throw new FiscalProviderError("mock: errore definitivo", false);
    }
    // Come il provider reale: la denominazione è obbligatoria (422/334)
    if (!config.name?.trim()) {
      throw new FiscalProviderError('mock HTTP 422: {"message":"The \'name\' is required","error":334}', false);
    }
    // "already-exists" (422/112): il POST fallirebbe, ma l'adapter recupera
    // la configurazione esistente → esito comunque idempotente con id.
    // "receipts-disabled" (400/174): stessa strada — la config esiste e viene
    // AGGIORNATA (receipts:true), da lì le emissioni riescono.
    if (this.behavior === "already-exists" || this.behavior === "receipts-disabled") {
      this.registered = true;
      return {
        providerConfigurationId: `existing-config-${config.fiscalId ?? "senza-id"}`,
        raw: { mock: true, alreadyExisted: true, receiptsEnabled: true },
      };
    }
    this.registered = true;
    return {
      providerConfigurationId: `mock-config-${config.fiscalId ?? "senza-id"}`,
      raw: { mock: true },
    };
  }
}
