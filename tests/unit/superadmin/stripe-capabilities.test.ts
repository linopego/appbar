import { describe, it, expect, vi, beforeEach } from "vitest";

// Bug incasso: senza card_payments/transfers richieste, Stripe rifiuta le
// direct charge sull'account Express. La creazione DEVE richiederle e
// repair-capabilities le richiede sugli account creati prima del fix.

const { mockRequireAdmin, dbMock, stripeMock, mockLogAdminAction } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  dbMock: {
    organization: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
  stripeMock: {
    accounts: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  mockLogAdminAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth/admin", () => ({ requireAdmin: mockRequireAdmin }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({ logAdminAction: mockLogAdminAction }));
vi.mock("@/lib/stripe/client", () => ({ stripe: stripeMock }));

import { POST as createAccount } from "@/app/api/superadmin/organizations/[id]/stripe/account/route";
import { POST as repairCapabilities } from "@/app/api/superadmin/organizations/[id]/stripe/repair-capabilities/route";

const PLATFORM_SESSION = {
  adminUserId: "a1",
  email: "platform@example.com",
  name: "Platform",
  role: "PLATFORM" as const,
  organizationId: null,
};
const ORG_ADMIN_SESSION = {
  adminUserId: "a2",
  email: "org@example.com",
  name: "Org Admin",
  role: "ORG_ADMIN" as const,
  organizationId: "org-1",
};

const req = new Request("http://localhost/api/test", { method: "POST" });
const params = { params: Promise.resolve({ id: "org-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.organization.update.mockResolvedValue({});
});

describe("creazione account Express", () => {
  it("richiede le capabilities card_payments e transfers", async () => {
    mockRequireAdmin.mockResolvedValue(PLATFORM_SESSION);
    dbMock.organization.findUnique.mockResolvedValue({
      id: "org-1",
      name: "Org Uno",
      stripeAccountId: null,
    });
    stripeMock.accounts.create.mockResolvedValue({ id: "acct_new" });

    const res = await createAccount(req, params);
    expect(res.status).toBe(201);

    const createArgs = stripeMock.accounts.create.mock.calls[0][0];
    expect(createArgs.capabilities).toEqual({
      card_payments: { requested: true },
      transfers: { requested: true },
    });
  });
});

describe("repair-capabilities", () => {
  it("negato a ORG_ADMIN (403), Stripe mai chiamato", async () => {
    mockRequireAdmin.mockResolvedValue(ORG_ADMIN_SESSION);

    const res = await repairCapabilities(req, params);
    expect(res.status).toBe(403);
    expect(stripeMock.accounts.update).not.toHaveBeenCalled();
  });

  it("PLATFORM: richiede le capabilities e risponde con lo stato risultante", async () => {
    mockRequireAdmin.mockResolvedValue(PLATFORM_SESSION);
    dbMock.organization.findUnique.mockResolvedValue({
      id: "org-1",
      name: "Org Uno",
      stripeAccountId: "acct_old",
      stripeChargesEnabled: false,
      stripeDetailsSubmitted: true,
    });
    stripeMock.accounts.update.mockResolvedValue({
      id: "acct_old",
      capabilities: { card_payments: "pending", transfers: "pending" },
      charges_enabled: false,
      details_submitted: true,
    });

    const res = await repairCapabilities(req, params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.capabilities).toEqual({ cardPayments: "pending", transfers: "pending" });
    expect(body.data.chargesEnabled).toBe(false);

    expect(stripeMock.accounts.update).toHaveBeenCalledWith("acct_old", {
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    // flag locali riallineati allo stato reale + audit
    expect(dbMock.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { stripeChargesEnabled: false, stripeDetailsSubmitted: true },
    });
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ORG_STRIPE_CAPABILITIES_REPAIRED" })
    );
  });

  it("organizzazione senza account Stripe → 400", async () => {
    mockRequireAdmin.mockResolvedValue(PLATFORM_SESSION);
    dbMock.organization.findUnique.mockResolvedValue({
      id: "org-1",
      name: "Org Uno",
      stripeAccountId: null,
    });

    const res = await repairCapabilities(req, params);
    expect(res.status).toBe(400);
    expect(stripeMock.accounts.update).not.toHaveBeenCalled();
  });
});
