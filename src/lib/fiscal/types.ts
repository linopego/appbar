// ─────────────────────────────────────────────────────────────────────────────
// Modulo fiscale — astrazione del provider.
//
// PRINCIPIO NON NEGOZIABILE: il flusso di vendita non dipende MAI dal fiscale.
// Il core parla SOLO con questa interfaccia: ogni dettaglio del provider
// concreto (Openapi) vive nel suo adapter.
// ─────────────────────────────────────────────────────────────────────────────

export interface FiscalLine {
  description: string;
  quantity: number;
  unitPrice: string; // EUR, 2 decimali (mai float)
  vatRate: string; // es. "10.00", "22.00"
}

// Riferimenti dell'esercente presso il provider (MAI credenziali AdE in
// chiaro: gli eventuali segreti stanno in encryptedSecrets, cifrati AES-GCM)
export interface FiscalVenueConfig {
  fiscalId?: string; // P.IVA / identificativo fiscale dell'esercente
  configurationId?: string; // id della configurazione presso il provider
  encryptedSecrets?: string;
  [key: string]: unknown;
}

export interface SaleDocumentInput {
  // Chiave di idempotenza verso il provider (= FiscalDocument.id)
  idempotencyKey: string;
  total: string; // EUR
  lines: FiscalLine[];
  venueFiscalConfig: FiscalVenueConfig;
}

export interface VoidDocumentInput {
  idempotencyKey: string;
  originalProviderDocId: string; // documento di vendita da stornare
  amount: string; // importo rimborsato (EUR)
  full: boolean; // true = annullo totale; false = reso parziale
  lines: FiscalLine[];
  venueFiscalConfig: FiscalVenueConfig;
}

export interface FiscalEmitResult {
  providerDocId: string;
  protocolNumber?: string;
  pdfUrl?: string;
  raw: unknown;
}

export interface FiscalRegisterResult {
  // Id della configurazione creata presso il provider (censimento esercente)
  providerConfigurationId: string;
  raw: unknown;
}

// Errore tipizzato: retryable decide se la macchina a stati ritenta;
// notRegistered marca il 424 "Fiscal ID not registered" del provider
// (esercente mai censito → l'adapter tenta UNA registrazione automatica).
export class FiscalProviderError extends Error {
  readonly retryable: boolean;
  readonly notRegistered: boolean;

  constructor(message: string, retryable: boolean, options?: { notRegistered?: boolean }) {
    super(message);
    this.name = "FiscalProviderError";
    this.retryable = retryable;
    this.notRegistered = options?.notRegistered ?? false;
  }
}

export interface FiscalProvider {
  emitSaleDocument(input: SaleDocumentInput): Promise<FiscalEmitResult>;
  emitVoidDocument(input: VoidDocumentInput): Promise<FiscalEmitResult>;
  // Censimento dell'esercente presso il provider (necessario prima della
  // prima emissione; vedi auto-riparazione nell'adapter)
  registerMerchant(config: FiscalVenueConfig): Promise<FiscalRegisterResult>;
}
