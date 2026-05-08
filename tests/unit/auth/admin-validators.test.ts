import { describe, expect, it } from "vitest";
import {
  adminCredentialsSchema,
  adminTotpSchema,
  adminPasswordChangeSchema,
} from "@/lib/validators/auth-admin";

describe("adminCredentialsSchema", () => {
  it("accetta credenziali valide", () => {
    const r = adminCredentialsSchema.safeParse({
      email: "admin@example.com",
      password: "validPassword1",
    });
    expect(r.success).toBe(true);
  });

  it("rifiuta email non valida", () => {
    const r = adminCredentialsSchema.safeParse({ email: "no-at", password: "validPassword1" });
    expect(r.success).toBe(false);
  });

  it("rifiuta password troppo corta", () => {
    const r = adminCredentialsSchema.safeParse({ email: "a@b.com", password: "short" });
    expect(r.success).toBe(false);
  });
});

describe("adminTotpSchema", () => {
  it("accetta codice 6 cifre", () => {
    expect(adminTotpSchema.safeParse({ code: "123456" }).success).toBe(true);
  });

  it("rifiuta 5 cifre", () => {
    const r = adminTotpSchema.safeParse({ code: "12345" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe("Codice deve essere 6 cifre");
    }
  });

  it("rifiuta caratteri non numerici", () => {
    expect(adminTotpSchema.safeParse({ code: "abcdef" }).success).toBe(false);
    expect(adminTotpSchema.safeParse({ code: "12345a" }).success).toBe(false);
  });
});

describe("adminPasswordChangeSchema", () => {
  const validCurrent = "currentPassword1";

  it("accetta password forte", () => {
    const r = adminPasswordChangeSchema.safeParse({
      currentPassword: validCurrent,
      newPassword: "ValidPassword123!",
    });
    expect(r.success).toBe(true);
  });

  it("rifiuta password troppo corta (<12)", () => {
    const r = adminPasswordChangeSchema.safeParse({
      currentPassword: validCurrent,
      newPassword: "Short1abc",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe("Password deve essere almeno 12 caratteri");
    }
  });

  it("rifiuta password senza maiuscole", () => {
    const r = adminPasswordChangeSchema.safeParse({
      currentPassword: validCurrent,
      newPassword: "alllowercase123",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) => i.message === "Deve contenere almeno una lettera maiuscola")
      ).toBe(true);
    }
  });

  it("rifiuta password senza minuscole", () => {
    const r = adminPasswordChangeSchema.safeParse({
      currentPassword: validCurrent,
      newPassword: "ALLUPPERCASE123",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) => i.message === "Deve contenere almeno una lettera minuscola")
      ).toBe(true);
    }
  });

  it("rifiuta password senza numeri", () => {
    const r = adminPasswordChangeSchema.safeParse({
      currentPassword: validCurrent,
      newPassword: "NoNumbersHere!",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message === "Deve contenere almeno un numero")).toBe(
        true
      );
    }
  });
});
