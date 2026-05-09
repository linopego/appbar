import { describe, expect, it } from "vitest";
import { extractTicketToken } from "@/lib/pos/extract-token";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("extractTicketToken", () => {
  it("estrae token da URL completo /ticket/[uuid]", () => {
    expect(extractTicketToken(`https://example.com/ticket/${VALID_UUID}`)).toBe(VALID_UUID);
  });

  it("estrae token da URL localhost", () => {
    expect(extractTicketToken(`http://localhost:3000/ticket/${VALID_UUID}`)).toBe(VALID_UUID);
  });

  it("ritorna null per URL senza /ticket/ nel path", () => {
    expect(extractTicketToken(`https://example.com/orders/${VALID_UUID}`)).toBeNull();
  });

  it("accetta UUID raw direttamente", () => {
    expect(extractTicketToken(VALID_UUID)).toBe(VALID_UUID);
  });

  it("ritorna null per stringa random", () => {
    expect(extractTicketToken("not-a-valid-token")).toBeNull();
  });

  it("ritorna null per stringa vuota", () => {
    expect(extractTicketToken("")).toBeNull();
  });

  it("ritorna null per UUID con formato non valido nel path", () => {
    expect(extractTicketToken("https://example.com/ticket/not-an-uuid")).toBeNull();
  });

  it("è case-insensitive per l'UUID", () => {
    const upper = VALID_UUID.toUpperCase();
    expect(extractTicketToken(upper)).toBe(upper);
    expect(extractTicketToken(`https://example.com/ticket/${upper}`)).toBe(upper);
  });
});
