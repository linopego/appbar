import crypto from "node:crypto";

// Cifratura AES-256-GCM per gli eventuali segreti dentro fiscalConfig
// (es. credenziali dell'esercente presso il provider): MAI in chiaro nel DB.
// Chiave da env FISCAL_CONFIG_ENCRYPTION_KEY (qualunque stringa robusta:
// viene derivata a 32 byte con SHA-256).

function key(): Buffer {
  const secret = process.env["FISCAL_CONFIG_ENCRYPTION_KEY"];
  if (!secret) {
    throw new Error("FISCAL_CONFIG_ENCRYPTION_KEY non configurata");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

// → base64(iv | authTag | ciphertext)
export function encryptFiscalSecrets(data: Record<string, unknown>): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

export function decryptFiscalSecrets(payload: string): Record<string, unknown> {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as Record<string, unknown>;
}
