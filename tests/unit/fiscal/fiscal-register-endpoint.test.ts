import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Endpoint di censimento esercente: SOLO PLATFORM (come ogni modifica di
// fiscalConfig), audit su successo.

const { mockRequireAdmin, mockLogAdminAction, mockRegisterVenueMerchant, dbMock } = vi.hoisted(
  () => ({
    mockRequireAdmin: vi.fn(),
    mockLogAdminAction: vi.fn().mockResolvedValue(undefined),
    mockRegisterVenueMerchant: vi.fn(),
    dbMock: { venue: { findUnique: vi.fn() } },
  })
);

vi.mock("@/lib/auth/admin", () => ({ requireAdmin: mockRequireAdmin }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({ logAdminAction: mockLogAdminAction }));
vi.mock("@/lib/fiscal/emit", () => ({ registerVenueMerchant: mockRegisterVenueMerchant }));

import { POST as fiscalRegister } from "@/app/api/superadmin/venues/[id]/fiscal-register/route";

const PLATFORM_SESSION = {
  adminUserId: "a2",
  email: "platform@example.com",
  name: "Platform Admin",
  role: "PLATFORM" as const,
  organizationId: null,
};
const ORG_ADMIN_SESSION = { ...PLATFORM_SESSION, role: "ORG_ADMIN" as const, organizationId: "org-1" };

const req = new Request("http://localhost/api/test", { method: "POST" }) as unknown as NextRequest;
const params = { params: Promise.resolve({ id: "ven-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(PLATFORM_SESSION);
  dbMock.venue.findUnique.mockResolvedValue({ id: "ven-1", organizationId: "org-1" });
  mockRegisterVenueMerchant.mockResolvedValue({ ok: true, providerConfigurationId: "cfg-9" });
});

describe("POST /api/superadmin/venues/[id]/fiscal-register", () => {
  it("ORG_ADMIN → 403 senza registrazione né audit", async () => {
    mockRequireAdmin.mockResolvedValue(ORG_ADMIN_SESSION);

    const res = await fiscalRegister(req, params);

    expect(res.status).toBe(403);
    expect(mockRegisterVenueMerchant).not.toHaveBeenCalled();
    expect(mockLogAdminAction).not.toHaveBeenCalled();
  });

  it("PLATFORM: registra, restituisce l'id e scrive l'audit", async () => {
    const res = await fiscalRegister(req, params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.providerConfigurationId).toBe("cfg-9");
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "VENUE_FISCAL_MERCHANT_REGISTERED",
        organizationId: "org-1",
        payload: { providerConfigurationId: "cfg-9" },
      })
    );
  });

  it("registrazione fallita → status e messaggio del provider, nessun audit", async () => {
    mockRegisterVenueMerchant.mockResolvedValue({ ok: false, status: 502, error: "Provider giù" });

    const res = await fiscalRegister(req, params);
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.error).toBe("Provider giù");
    expect(mockLogAdminAction).not.toHaveBeenCalled();
  });
});
