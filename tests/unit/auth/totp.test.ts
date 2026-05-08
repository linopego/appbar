import { describe, expect, it } from "vitest";
import { generateTotpSecret, buildTotp, verifyTotpCode } from "@/lib/auth/totp";

describe("totp", () => {
  it("genera un secret base32 valido", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThanOrEqual(16);
  });

  it("verifica correttamente un codice valido generato dal secret", () => {
    const secret = generateTotpSecret();
    const totp = buildTotp(secret, "test@example.com");
    const code = totp.generate();
    expect(verifyTotpCode(secret, code)).toBe(true);
  });

  it("rifiuta un codice errato", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, "000000")).toBe(false);
    expect(verifyTotpCode(secret, "999999")).toBe(false);
  });

  it("rifiuta un codice non numerico nei limiti del formato", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, "abcdef")).toBe(false);
  });
});
