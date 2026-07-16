// ─────────────────────────────────────────────────────────────────────────────
// Wallet (Apple + Google): feature flag via env. Il modulo è OPZIONALE:
// senza env i bottoni non compaiono e il sito funziona identico. Per questo
// le env NON stanno nei check bloccanti di instrumentation.ts.
// ─────────────────────────────────────────────────────────────────────────────

export function isAppleWalletConfigured(): boolean {
  return Boolean(
    process.env["APPLE_PASS_CERT_BASE64"] &&
      process.env["APPLE_PASS_CERT_PASSWORD"] &&
      process.env["APPLE_TEAM_ID"] &&
      process.env["APPLE_PASS_TYPE_ID"]
  );
}

export function isGoogleWalletConfigured(): boolean {
  return Boolean(
    process.env["GOOGLE_WALLET_ISSUER_ID"] && process.env["GOOGLE_WALLET_SA_KEY_BASE64"]
  );
}
