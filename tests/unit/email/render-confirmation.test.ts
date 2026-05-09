import { describe, expect, it } from "vitest";
import { renderOrderConfirmationHtml } from "@/lib/email/templates/order-confirmation";

describe("renderOrderConfirmationHtml", () => {
  const data = {
    customerName: "Mario Rossi",
    venueName: "La Casa dei Gelsi",
    orderId: "clxabc123def456",
    items: [
      { name: "Drink", quantity: 3, unitPrice: "8,00 €", subtotal: "24,00 €" },
      { name: "Birra", quantity: 2, unitPrice: "5,00 €", subtotal: "10,00 €" },
    ],
    total: "34,00 €",
    ticketsCount: 5,
    expiresAt: new Date("2026-06-08T00:00:00Z"),
    orderUrl: "https://example.com/ordine/clxabc123def456",
  };

  it("contiene il nome cliente", () => {
    expect(renderOrderConfirmationHtml(data)).toContain("Mario Rossi");
  });

  it("contiene il nome del venue", () => {
    expect(renderOrderConfirmationHtml(data)).toContain("La Casa dei Gelsi");
  });

  it("contiene tutti gli item", () => {
    const html = renderOrderConfirmationHtml(data);
    expect(html).toContain("3× Drink");
    expect(html).toContain("2× Birra");
    expect(html).toContain("24,00 €");
    expect(html).toContain("10,00 €");
  });

  it("contiene il totale", () => {
    expect(renderOrderConfirmationHtml(data)).toContain("34,00 €");
  });

  it("contiene l'URL ordine", () => {
    expect(renderOrderConfirmationHtml(data)).toContain(
      "https://example.com/ordine/clxabc123def456"
    );
  });

  it("contiene la data di scadenza in formato italiano", () => {
    const html = renderOrderConfirmationHtml(data);
    expect(html).toMatch(/giugno 2026/);
  });

  it("contiene il numero di ticket", () => {
    expect(renderOrderConfirmationHtml(data)).toContain("5 ticket");
  });

  it("escape HTML in input utente", () => {
    const html = renderOrderConfirmationHtml({
      ...data,
      customerName: "<script>alert(1)</script>",
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
