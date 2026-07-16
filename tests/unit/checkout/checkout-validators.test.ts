import { describe, expect, it } from "vitest";
import { checkoutSchema, checkoutLineItemSchema } from "@/lib/validators/checkout";

const VALID_CUID = "ckkpw7t2x000001jw3qpnh1g8";

describe("checkoutLineItemSchema", () => {
  it("accetta item valido", () => {
    expect(
      checkoutLineItemSchema.safeParse({ priceTierId: VALID_CUID, quantity: 2 }).success
    ).toBe(true);
  });

  it("rifiuta quantità zero", () => {
    const r = checkoutLineItemSchema.safeParse({ priceTierId: VALID_CUID, quantity: 0 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe("Quantità minima è 1");
    }
  });

  it("rifiuta quantità > 20", () => {
    const r = checkoutLineItemSchema.safeParse({ priceTierId: VALID_CUID, quantity: 21 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe("Quantità massima è 20");
    }
  });

  it("rifiuta priceTierId non cuid", () => {
    expect(
      checkoutLineItemSchema.safeParse({ priceTierId: "not-a-cuid", quantity: 1 }).success
    ).toBe(false);
  });
});

describe("checkoutSchema", () => {
  it("accetta payload valido", () => {
    const r = checkoutSchema.safeParse({
      venueSlug: "casa-dei-gelsi",
      items: [{ priceTierId: VALID_CUID, quantity: 2 }],
      tosAccepted: true,
    });
    expect(r.success).toBe(true);
  });

  it("rifiuta lista items vuota", () => {
    const r = checkoutSchema.safeParse({
      venueSlug: "casa-dei-gelsi",
      items: [],
      tosAccepted: true,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe("Almeno un articolo richiesto");
    }
  });

  it("rifiuta più di 10 tipi di articolo", () => {
    const items = Array.from({ length: 11 }, () => ({ priceTierId: VALID_CUID, quantity: 1 }));
    const r = checkoutSchema.safeParse({ venueSlug: "casa-dei-gelsi", items, tosAccepted: true });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe("Massimo 10 tipi di articolo");
    }
  });

  it("rifiuta senza consenso ai Termini (assente o false)", () => {
    const base = { venueSlug: "casa-dei-gelsi", items: [{ priceTierId: VALID_CUID, quantity: 1 }] };
    expect(checkoutSchema.safeParse(base).success).toBe(false);
    const r = checkoutSchema.safeParse({ ...base, tosAccepted: false });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe(
        "Devi accettare i Termini di servizio e l'informativa privacy"
      );
    }
  });

  it("rifiuta venueSlug vuoto", () => {
    const r = checkoutSchema.safeParse({
      venueSlug: "",
      items: [{ priceTierId: VALID_CUID, quantity: 1 }],
      tosAccepted: true,
    });
    expect(r.success).toBe(false);
  });
});
