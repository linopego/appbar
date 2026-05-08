import { describe, expect, it } from "vitest";
import { loginSchema } from "@/lib/validators/auth";

describe("loginSchema", () => {
  it("accetta una email valida", () => {
    const result = loginSchema.safeParse({ email: "test@example.com" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("test@example.com");
    }
  });

  it("rifiuta una email senza @", () => {
    const result = loginSchema.safeParse({ email: "non-valida" });
    expect(result.success).toBe(false);
  });

  it("rifiuta una stringa vuota", () => {
    const result = loginSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });

  it("rifiuta un valore non stringa", () => {
    const result = loginSchema.safeParse({ email: 42 });
    expect(result.success).toBe(false);
  });

  it("usa un messaggio di errore in italiano", () => {
    const result = loginSchema.safeParse({ email: "non-valida" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue?.message).toBe("Inserisci un indirizzo email valido");
    }
  });
});
