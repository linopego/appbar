import { describe, expect, it } from "vitest";
import { messageForCode } from "@/lib/pos/messages";

describe("messageForCode", () => {
  it("TICKET_NOT_FOUND", () => {
    expect(messageForCode("TICKET_NOT_FOUND")).toBe("Ticket non trovato");
  });

  it("WRONG_VENUE con nome venue", () => {
    expect(messageForCode("WRONG_VENUE", { ticketVenue: "La Casa dei Gelsi" })).toBe(
      "Ticket di un altro locale: La Casa dei Gelsi"
    );
  });

  it("WRONG_VENUE senza dati", () => {
    expect(messageForCode("WRONG_VENUE")).toBe("Ticket non valido per questo locale");
  });

  it("EXPIRED", () => {
    expect(messageForCode("EXPIRED")).toBe("Ticket scaduto");
  });

  it("ALREADY_CONSUMED con ora e operatore", () => {
    const consumedAt = new Date("2026-05-09T20:35:00Z").toISOString();
    const msg = messageForCode("ALREADY_CONSUMED", {
      consumedAt,
      consumedByName: "Barista Demo",
    });
    expect(msg).toContain("Già consegnato alle");
    expect(msg).toContain("Barista Demo");
  });

  it("ALREADY_CONSUMED senza dati → fallback generico", () => {
    expect(messageForCode("ALREADY_CONSUMED")).toBe("Già consegnato da altro operatore");
  });

  it("REFUNDED", () => {
    expect(messageForCode("REFUNDED")).toBe("Ticket rimborsato");
  });

  it("RATE_LIMITED", () => {
    expect(messageForCode("RATE_LIMITED")).toBe("Troppi tentativi, riprova tra qualche secondo");
  });

  it("UNAUTHORIZED_STAFF", () => {
    expect(messageForCode("UNAUTHORIZED_STAFF")).toBe("Sessione scaduta, accedi di nuovo");
  });

  it("codice sconosciuto → fallback generico", () => {
    expect(messageForCode("RANDOM_CODE")).toBe("Errore. Riprova.");
    expect(messageForCode(undefined)).toBe("Errore. Riprova.");
  });
});
