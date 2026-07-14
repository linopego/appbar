import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import {
  calculateApplicationFeeCents,
  feeCentsToEur,
  isPaymentsConfigured,
} from "@/lib/checkout/connect";

// ── Application fee ──────────────────────────────────────────────────────────

describe("calculateApplicationFeeCents", () => {
  it("fee 0% → 0 centesimi (verrà omessa dalla sessione)", () => {
    expect(calculateApplicationFeeCents(2600, new Prisma.Decimal(0))).toBe(0);
  });

  it("5% di 26.00 € → 130 centesimi", () => {
    expect(calculateApplicationFeeCents(2600, new Prisma.Decimal("5.00"))).toBe(130);
  });

  it("2.5% di 3 × 6.00 € (18.00 €) → 45 centesimi esatti", () => {
    expect(calculateApplicationFeeCents(1800, new Prisma.Decimal("2.50"))).toBe(45);
  });

  it("arrotondamento half-up: 2.5% di 12.34 € = 30.85 → 31 centesimi", () => {
    expect(calculateApplicationFeeCents(1234, new Prisma.Decimal("2.50"))).toBe(31);
  });

  it("arrotondamento verso il basso: 1.1% di 3.00 € = 3.3 → 3 centesimi", () => {
    expect(calculateApplicationFeeCents(300, new Prisma.Decimal("1.10"))).toBe(3);
  });

  it("niente float drift: 5.55% di 10.00 € = 55.5 → 56 (Decimal, half-up)", () => {
    expect(calculateApplicationFeeCents(1000, new Prisma.Decimal("5.55"))).toBe(56);
  });

  it("100% → intero importo", () => {
    expect(calculateApplicationFeeCents(1800, new Prisma.Decimal("100.00"))).toBe(1800);
  });
});

describe("feeCentsToEur", () => {
  it("130 centesimi → Decimal 1.30", () => {
    expect(feeCentsToEur(130).toFixed(2)).toBe("1.30");
  });
  it("0 centesimi → Decimal 0.00", () => {
    expect(feeCentsToEur(0).toFixed(2)).toBe("0.00");
  });
});

// ── Gate del checkout ────────────────────────────────────────────────────────

describe("isPaymentsConfigured (gate PAYMENTS_NOT_CONFIGURED)", () => {
  it("org senza stripeAccountId → checkout rifiutato", () => {
    expect(
      isPaymentsConfigured({ stripeAccountId: null, stripeChargesEnabled: false, active: true })
    ).toBe(false);
    expect(
      isPaymentsConfigured({ stripeAccountId: null, stripeChargesEnabled: true, active: true })
    ).toBe(false);
  });

  it("org con account ma charges non abilitati → checkout rifiutato", () => {
    expect(
      isPaymentsConfigured({ stripeAccountId: "acct_1", stripeChargesEnabled: false, active: true })
    ).toBe(false);
  });

  it("account presente + charges abilitati → checkout consentito", () => {
    expect(
      isPaymentsConfigured({ stripeAccountId: "acct_1", stripeChargesEnabled: true, active: true })
    ).toBe(true);
  });

  it("organizzazione disattivata → checkout rifiutato anche con Stripe configurato", () => {
    expect(
      isPaymentsConfigured({ stripeAccountId: "acct_1", stripeChargesEnabled: true, active: false })
    ).toBe(false);
  });
});

// ── Handler account.updated ──────────────────────────────────────────────────

const { mockUpdateMany } = vi.hoisted(() => ({
  mockUpdateMany: vi.fn().mockResolvedValue({ count: 1 }),
}));
vi.mock("@/lib/db", () => ({
  db: { organization: { updateMany: mockUpdateMany } },
}));

import { handleAccountUpdated } from "@/lib/stripe/handlers/account-updated";
import type Stripe from "stripe";

function accountEvent(overrides: Partial<Stripe.Account>): Stripe.Event {
  return {
    id: "evt_1",
    type: "account.updated",
    account: "acct_123",
    data: {
      object: {
        id: "acct_123",
        object: "account",
        charges_enabled: false,
        details_submitted: false,
        ...overrides,
      },
    },
  } as unknown as Stripe.Event;
}

describe("handleAccountUpdated", () => {
  beforeEach(() => mockUpdateMany.mockClear());

  it("onboarding completato → entrambi i flag true sull'org giusta", async () => {
    await handleAccountUpdated(
      accountEvent({ charges_enabled: true, details_submitted: true })
    );

    expect(mockUpdateMany).toHaveBeenCalledOnce();
    const args = mockUpdateMany.mock.calls[0][0];
    expect(args.where).toEqual({ stripeAccountId: "acct_123" });
    expect(args.data).toEqual({
      stripeChargesEnabled: true,
      stripeDetailsSubmitted: true,
    });
  });

  it("dettagli inviati ma charges non ancora abilitati → flag coerenti", async () => {
    await handleAccountUpdated(
      accountEvent({ charges_enabled: false, details_submitted: true })
    );

    const args = mockUpdateMany.mock.calls[0][0];
    expect(args.data).toEqual({
      stripeChargesEnabled: false,
      stripeDetailsSubmitted: true,
    });
  });

  it("charges revocati da Stripe → il checkout si richiude (flag false)", async () => {
    await handleAccountUpdated(
      accountEvent({ charges_enabled: false, details_submitted: false })
    );

    const args = mockUpdateMany.mock.calls[0][0];
    expect(args.data.stripeChargesEnabled).toBe(false);
  });
});
