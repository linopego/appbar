import {
  FiscalProvider,
  FiscalProviderError,
  type FiscalEmitResult,
  type SaleDocumentInput,
  type VoidDocumentInput,
} from "./types";

// Provider finto per i test: comportamento programmabile per esercitare la
// macchina a stati (successo, errore ritentabile, errore definitivo).
export type MockBehavior = "succeed" | "fail-retryable" | "fail-permanent";

export class MockFiscalProvider implements FiscalProvider {
  behavior: MockBehavior;
  saleCalls: SaleDocumentInput[] = [];
  voidCalls: VoidDocumentInput[] = [];

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
}
