import { describe, it, expect } from "vitest";
import { rippleGeometry, RIPPLE_DURATION_MS, FLASH_DURATION_MS } from "@/lib/ui/press-impulse";

// Feedback di pressione v2: l'onda parte dal punto di tocco e deve coprire
// tutto l'elemento da qualunque angolo parta.

describe("rippleGeometry", () => {
  it("cerchio centrato sul punto di tocco", () => {
    const rect = { left: 100, top: 50, width: 200, height: 40 };
    const { size, left, top } = rippleGeometry(rect, 150, 70);
    expect(size).toBe(Math.hypot(200, 40) * 2); // 2 × la diagonale
    // centro dell'onda = punto di tocco relativo all'elemento
    expect(left + size / 2).toBe(50);
    expect(top + size / 2).toBe(20);
  });

  it("copre l'elemento anche toccando un angolo", () => {
    const rect = { left: 0, top: 0, width: 300, height: 48 };
    const { size } = rippleGeometry(rect, 0, 0);
    // dal vertice, il raggio deve raggiungere l'angolo opposto
    expect(size / 2).toBeGreaterThanOrEqual(Math.hypot(rect.width, rect.height));
  });

  it("durate da BRAND.md: feedback, non spettacolo (≤450ms)", () => {
    expect(RIPPLE_DURATION_MS).toBeLessThanOrEqual(450);
    expect(FLASH_DURATION_MS).toBeLessThanOrEqual(250);
  });
});
