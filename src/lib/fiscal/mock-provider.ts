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
// finché registerMerchant non viene chiamato).
export type MockBehavior = "succeed" | "fail-retryable" | "fail-permanent" | "not-registered";

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
    this.registered = true;
    return {
      providerConfigurationId: `mock-config-${config.fiscalId ?? "senza-id"}`,
      raw: { mock: true },
    };
  }
}
