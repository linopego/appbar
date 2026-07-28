import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

// Test del CRUD listino lato superadmin: scoping per organizzazione
// (ORG_ADMIN non tocca tier fuori dalla propria org), audit su ogni
// scrittura, validazioni IDENTICHE al percorso manager (stessa lib
// condivisa @/lib/price-tiers/validation, verificato a parità di input).

const { mockRequireAdmin, mockRequireStaffRole, mockLogAdminAction, mockLogManagerAction, dbMock } =
  vi.hoisted(() => ({
    mockRequireAdmin: vi.fn(),
    mockRequireStaffRole: vi.fn(),
    mockLogAdminAction: vi.fn().mockResolvedValue(undefined),
    mockLogManagerAction: vi.fn().mockResolvedValue(undefined),
    dbMock: {
      venue: { findFirst: vi.fn(), findUnique: vi.fn() },
      priceTier: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    },
  }));

vi.mock("@/lib/auth/admin", () => ({ requireAdmin: mockRequireAdmin }));
vi.mock("@/lib/auth/staff", () => ({ requireStaffRole: mockRequireStaffRole }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({
  logAdminAction: mockLogAdminAction,
  logManagerAction: mockLogManagerAction,
}));

import { POST as saCreateTier } from "@/app/api/superadmin/venues/[id]/price-tiers/route";
import { PATCH as saPatchTier } from "@/app/api/superadmin/price-tiers/[tierId]/route";
import { POST as saToggleTier } from "@/app/api/superadmin/price-tiers/[tierId]/toggle-active/route";
import { POST as adminCreateTier } from "@/app/api/admin/price-tiers/route";
import { PATCH as adminPatchTier } from "@/app/api/admin/price-tiers/[tierId]/route";
import {
  VAT_REQUIRED_ON_ACTIVATE_ERROR,
  VAT_REQUIRED_ON_UPDATE_ERROR,
} from "@/lib/price-tiers/validation";

const D = (v: string) => new Prisma.Decimal(v);

const ORG_ADMIN_SESSION = {
  adminUserId: "a1",
  email: "org@example.com",
  name: "Org Admin",
  role: "ORG_ADMIN" as const,
  organizationId: "org-1",
};
const PLATFORM_SESSION = {
  adminUserId: "a2",
  email: "platform@example.com",
  name: "Platform Admin",
  role: "PLATFORM" as const,
  organizationId: null,
};
const MANAGER_SESSION = { operatorId: "op-1", venueId: "ven-1", role: "MANAGER" };

function jsonRequest(body: unknown, method = "POST"): NextRequest {
  return new Request("http://localhost/api/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}
const venueParams = { params: Promise.resolve({ id: "ven-1" }) };
const tierParams = { params: Promise.resolve({ tierId: "tier-1" }) };

function tierRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "tier-1",
    venueId: "ven-1",
    name: "Birra",
    price: D("5.00"),
    sortOrder: 100,
    active: true,
    vatRate: D("10.00"),
    venue: { organizationId: "org-1", fiscalEnabled: false },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(PLATFORM_SESSION);
  mockRequireStaffRole.mockResolvedValue(MANAGER_SESSION);
  dbMock.venue.findFirst.mockResolvedValue({ id: "ven-1", organizationId: "org-1" });
  dbMock.priceTier.findFirst.mockResolvedValue(tierRow());
  dbMock.priceTier.create.mockResolvedValue({
    id: "tier-1",
    name: "Birra",
    sortOrder: 100,
    active: true,
  });
  dbMock.priceTier.update.mockResolvedValue({});
});

describe("scoping ORG_ADMIN", () => {
  it("il venue di un'altra organizzazione è irraggiungibile: filtro org nella query e 404 senza scritture", async () => {
    mockRequireAdmin.mockResolvedValue(ORG_ADMIN_SESSION);
    // Il filtro orgScopeWhere non matcha: il venue esiste ma è fuori org
    dbMock.venue.findFirst.mockResolvedValue(null);

    const res = await saCreateTier(jsonRequest({ name: "Birra", price: "5.00" }), venueParams);

    expect(res.status).toBe(404);
    // La query è scopata sull'organizzazione della sessione
    const where = dbMock.venue.findFirst.mock.calls[0]?.[0]?.where;
    expect(where?.organizationId).toBe("org-1");
    expect(dbMock.priceTier.create).not.toHaveBeenCalled();
    expect(mockLogAdminAction).not.toHaveBeenCalled();
  });

  it("tier di un venue fuori org: PATCH e toggle rispondono 404 senza scritture", async () => {
    mockRequireAdmin.mockResolvedValue(ORG_ADMIN_SESSION);
    dbMock.priceTier.findFirst.mockResolvedValue(null);

    const patchRes = await saPatchTier(jsonRequest({ price: "6.00" }, "PATCH"), tierParams);
    const toggleRes = await saToggleTier(jsonRequest({}), tierParams);

    expect(patchRes.status).toBe(404);
    expect(toggleRes.status).toBe(404);
    const where = dbMock.priceTier.findFirst.mock.calls[0]?.[0]?.where;
    expect(where?.venue?.organizationId).toBe("org-1");
    expect(dbMock.priceTier.update).not.toHaveBeenCalled();
    expect(mockLogAdminAction).not.toHaveBeenCalled();
  });

  it("PLATFORM non ha filtro org nella query", async () => {
    await saCreateTier(jsonRequest({ name: "Birra", price: "5.00" }), venueParams);
    const where = dbMock.venue.findFirst.mock.calls[0]?.[0]?.where;
    expect(where?.organizationId).toBeUndefined();
  });
});

describe("audit su ogni scrittura", () => {
  it("crea → PRICE_TIER_CREATED con organizationId del venue", async () => {
    const res = await saCreateTier(
      jsonRequest({ name: "Birra", price: "5.00", vatRate: "10" }),
      venueParams
    );

    expect(res.status).toBe(201);
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PRICE_TIER_CREATED",
        organizationId: "org-1",
        targetType: "PriceTier",
        targetId: "tier-1",
      })
    );
  });

  it("modifica → PRICE_TIER_UPDATED con diff old/new", async () => {
    const res = await saPatchTier(jsonRequest({ price: "6.00" }, "PATCH"), tierParams);

    expect(res.status).toBe(200);
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PRICE_TIER_UPDATED",
        organizationId: "org-1",
        // Decimal.toString() normalizza gli zeri finali ("5.00" → "5")
        payload: { old: { price: "5" }, new: { price: "6" } },
      })
    );
  });

  it("disattiva/riattiva → PRICE_TIER_DEACTIVATED/ACTIVATED", async () => {
    await saToggleTier(jsonRequest({}), tierParams);
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PRICE_TIER_DEACTIVATED", organizationId: "org-1" })
    );

    dbMock.priceTier.findFirst.mockResolvedValue(tierRow({ active: false }));
    await saToggleTier(jsonRequest({}), tierParams);
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PRICE_TIER_ACTIVATED" })
    );
  });
});

describe("validazioni identiche tra percorso admin e superadmin (lib condivisa)", () => {
  const INVALID_BODIES = [
    { name: "", price: "5.00" },
    { name: "Birra", price: "0" },
    { name: "Birra", price: "5.00", sortOrder: -1 },
    { name: "Birra", price: "5.00", vatRate: "150" },
  ];

  it.each(INVALID_BODIES)("stesso errore 400 sui due percorsi per %o", async (body) => {
    const [saRes, adminRes] = await Promise.all([
      saCreateTier(jsonRequest(body), venueParams),
      adminCreateTier(jsonRequest(body)),
    ]);
    expect(saRes.status).toBe(400);
    expect(adminRes.status).toBe(400);
    const [saJson, adminJson] = await Promise.all([saRes.json(), adminRes.json()]);
    expect(saJson.error).toBe(adminJson.error);
  });

  it("stesso errore anche in PATCH (admin usa findUnique, superadmin findFirst)", async () => {
    dbMock.priceTier.findUnique.mockResolvedValue(tierRow());
    const body = { vatRate: "-3" };
    const [saRes, adminRes] = await Promise.all([
      saPatchTier(jsonRequest(body, "PATCH"), tierParams),
      adminPatchTier(jsonRequest(body, "PATCH"), tierParams),
    ]);
    expect(saRes.status).toBe(400);
    expect(adminRes.status).toBe(400);
    const [saJson, adminJson] = await Promise.all([saRes.json(), adminRes.json()]);
    expect(saJson.error).toBe(adminJson.error);
  });
});

describe("guardie fiscali lato superadmin", () => {
  it("azzerare l'aliquota su fascia attiva con fiscale acceso → 400", async () => {
    dbMock.priceTier.findFirst.mockResolvedValue(
      tierRow({ venue: { organizationId: "org-1", fiscalEnabled: true } })
    );

    const res = await saPatchTier(jsonRequest({ vatRate: null }, "PATCH"), tierParams);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe(VAT_REQUIRED_ON_UPDATE_ERROR);
    expect(dbMock.priceTier.update).not.toHaveBeenCalled();
  });

  it("riattivare una fascia senza aliquota con fiscale acceso → 400", async () => {
    dbMock.priceTier.findFirst.mockResolvedValue(
      tierRow({
        active: false,
        vatRate: null,
        venue: { organizationId: "org-1", fiscalEnabled: true },
      })
    );

    const res = await saToggleTier(jsonRequest({}), tierParams);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe(VAT_REQUIRED_ON_ACTIVATE_ERROR);
    expect(dbMock.priceTier.update).not.toHaveBeenCalled();
  });
});
