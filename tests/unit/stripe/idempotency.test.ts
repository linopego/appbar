import { describe, expect, it, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

const findUniqueMock = vi.fn();
const createMock = vi.fn();
const handleCheckoutCompletedMock = vi.fn();
const handleCheckoutExpiredMock = vi.fn();
const handleChargeRefundedMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    stripeEvent: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

vi.mock("@/lib/stripe/handlers/checkout-completed", () => ({
  handleCheckoutCompleted: (...args: unknown[]) => handleCheckoutCompletedMock(...args),
}));
vi.mock("@/lib/stripe/handlers/checkout-expired", () => ({
  handleCheckoutExpired: (...args: unknown[]) => handleCheckoutExpiredMock(...args),
}));
vi.mock("@/lib/stripe/handlers/charge-refunded", () => ({
  handleChargeRefunded: (...args: unknown[]) => handleChargeRefundedMock(...args),
}));

import { processStripeEvent } from "@/lib/stripe/process-event";

const baseEvent = {
  id: "evt_test_1",
  type: "checkout.session.completed",
  data: { object: { id: "cs_test", metadata: { orderId: "order_x" } } },
} as unknown as Stripe.Event;

describe("processStripeEvent idempotency", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    createMock.mockReset();
    handleCheckoutCompletedMock.mockReset();
    handleCheckoutExpiredMock.mockReset();
    handleChargeRefundedMock.mockReset();
  });

  it("skip se l'evento è già stato processato", async () => {
    findUniqueMock.mockResolvedValue({ id: "evt_test_1" });
    await processStripeEvent(baseEvent);
    expect(handleCheckoutCompletedMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("invoca l'handler corretto e registra l'evento se nuovo", async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ id: "evt_test_1" });
    await processStripeEvent(baseEvent);
    expect(handleCheckoutCompletedMock).toHaveBeenCalledOnce();
    expect(createMock).toHaveBeenCalledOnce();
  });

  it("dispatch su checkout.session.expired", async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ id: "evt_test_2" });
    const event = { ...baseEvent, id: "evt_test_2", type: "checkout.session.expired" } as Stripe.Event;
    await processStripeEvent(event);
    expect(handleCheckoutExpiredMock).toHaveBeenCalledOnce();
    expect(handleCheckoutCompletedMock).not.toHaveBeenCalled();
  });

  it("dispatch su charge.refunded", async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ id: "evt_test_3" });
    const event = { ...baseEvent, id: "evt_test_3", type: "charge.refunded" } as Stripe.Event;
    await processStripeEvent(event);
    expect(handleChargeRefundedMock).toHaveBeenCalledOnce();
  });

  it("non chiama handler per event type non gestito ma marca comunque processato", async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ id: "evt_test_4" });
    const event = { ...baseEvent, id: "evt_test_4", type: "customer.created" } as Stripe.Event;
    await processStripeEvent(event);
    expect(handleCheckoutCompletedMock).not.toHaveBeenCalled();
    expect(handleCheckoutExpiredMock).not.toHaveBeenCalled();
    expect(handleChargeRefundedMock).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledOnce();
  });
});
