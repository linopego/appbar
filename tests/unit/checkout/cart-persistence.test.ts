import { describe, it, expect } from "vitest";
import {
  CART_MAX_PER_TIER,
  cartStorageKey,
  parseCart,
  serializeCart,
} from "@/lib/checkout/cart-persistence";

// Persistenza della selezione attraverso il giro di login su /[venueSlug]:
// il cliente non loggato deve ritrovare le quantità dopo il login.

const VALID = ["tier-a", "tier-b", "tier-c"];

describe("serializeCart / parseCart (round-trip)", () => {
  it("le quantità sopravvivono al giro di login", () => {
    const cart = { "tier-a": 2, "tier-b": 0, "tier-c": 5 };
    const restored = parseCart(serializeCart(cart), VALID);
    expect(restored).toEqual({ "tier-a": 2, "tier-c": 5 });
  });

  it("chiave di storage per venue distinta", () => {
    expect(cartStorageKey("bar-x")).not.toBe(cartStorageKey("bar-y"));
  });
});

describe("parseCart (difensivo: lo storage è manipolabile)", () => {
  it("null / JSON corrotto / non-oggetto → carrello vuoto", () => {
    expect(parseCart(null, VALID)).toEqual({});
    expect(parseCart("{non json", VALID)).toEqual({});
    expect(parseCart('"stringa"', VALID)).toEqual({});
    expect(parseCart("[1,2]", VALID)).toEqual({});
  });

  it("tier sconosciuti scartati", () => {
    expect(parseCart('{"tier-x": 3, "tier-a": 1}', VALID)).toEqual({ "tier-a": 1 });
  });

  it("valori non numerici, negativi o assurdi normalizzati", () => {
    expect(
      parseCart('{"tier-a": "molti", "tier-b": -4, "tier-c": 999}', VALID)
    ).toEqual({ "tier-c": CART_MAX_PER_TIER });
  });

  it("decimali troncati all'intero", () => {
    expect(parseCart('{"tier-a": 2.9}', VALID)).toEqual({ "tier-a": 2 });
  });
});
