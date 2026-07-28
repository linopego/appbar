// Feature flag del modulo fiscale: senza le env il modulo è globalmente
// SPENTO (non è un errore) — la vendita funziona identica, nessun documento
// viene accodato. Env opzionali, documentate in .env.example.

export function isFiscalModuleConfigured(): boolean {
  return Boolean(process.env["OPENAPI_FISCAL_API_KEY"]);
}

export function isFiscalSandbox(): boolean {
  return process.env["OPENAPI_FISCAL_SANDBOX"] === "true";
}
