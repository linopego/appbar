import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Test degli endpoint /api/superadmin/organizations: autorizzazione
// (ORG_ADMIN → 403 su tutto) e validazione feePercent. DB e audit mockati.

const { mockRequireAdmin, dbMock } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  dbMock: {
    organization: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    venue: { findMany: vi.fn().mockResolvedValue([]) },
    order: {
      groupBy: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _sum: {} }),
    },
    adminAuditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/auth/admin", () => ({
  requireAdmin: mockRequireAdmin,
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}));

import { GET as listOrgs, POST as createOrg } from "@/app/api/superadmin/organizations/route";
import { GET as getOrg, PATCH as patchOrg } from "@/app/api/superadmin/organizations/[id]/route";
import { POST as toggleOrg } from "@/app/api/superadmin/organizations/[id]/toggle-active/route";
import { feePercentSchema } from "@/lib/validators/organization";

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

function jsonRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}
const params = { params: Promise.resolve({ id: "org-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.organization.findMany.mockResolvedValue([]);
  dbMock.venue.findMany.mockResolvedValue([]);
  dbMock.order.groupBy.mockResolvedValue([]);
});

describe("autorizzazione endpoint organizations", () => {
  it("ORG_ADMIN riceve 403 su TUTTI gli endpoint organizations", async () => {
    mockRequireAdmin.mockResolvedValue(ORG_ADMIN_SESSION);

    const responses = await Promise.all([
      listOrgs(),
      createOrg(jsonRequest({ name: "X", feePercent: "5" })),
      getOrg(jsonRequest({}), params),
      patchOrg(jsonRequest({ name: "Y" }), params),
      toggleOrg(jsonRequest({}), params),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(403);
    }
  });

  it("non autenticato → 401", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("UNAUTHORIZED_ADMIN"));
    const res = await listOrgs();
    expect(res.status).toBe(401);
  });

  it("PLATFORM può listare (200)", async () => {
    mockRequireAdmin.mockResolvedValue(PLATFORM_SESSION);
    const res = await listOrgs();
    expect(res.status).toBe(200);
  });

  it("PLATFORM crea con dati validi (201) e l'audit viene scritto", async () => {
    mockRequireAdmin.mockResolvedValue(PLATFORM_SESSION);
    dbMock.organization.create.mockResolvedValue({ id: "org-new" });

    const res = await createOrg(jsonRequest({ name: "Rossi Eventi", feePercent: "5.00" }));
    expect(res.status).toBe(201);

    const createArgs = dbMock.organization.create.mock.calls[0][0];
    expect(createArgs.data).toEqual({ name: "Rossi Eventi", feePercent: "5.00", active: true });
  });

  it("PATCH scrive audit con before/after della fee", async () => {
    mockRequireAdmin.mockResolvedValue(PLATFORM_SESSION);
    dbMock.organization.findUnique.mockResolvedValue({
      id: "org-1",
      name: "Vecchio Nome",
      feePercent: { toFixed: () => "2.00" },
    });
    dbMock.organization.update.mockResolvedValue({});

    const { logAdminAction } = await import("@/lib/audit");
    const res = await patchOrg(jsonRequest({ feePercent: "5.00" }), params);
    expect(res.status).toBe(200);

    const auditArgs = vi.mocked(logAdminAction).mock.calls[0][0];
    expect(auditArgs.payload).toEqual({
      before: { name: "Vecchio Nome", feePercent: "2.00" },
      after: { name: "Vecchio Nome", feePercent: "5.00" },
    });
  });
});

describe("validazione feePercent (Zod)", () => {
  const ok = (v: unknown) => feePercentSchema.safeParse(v).success;

  it("0 → valido", () => expect(ok(0)).toBe(true));
  it("50 → valido", () => expect(ok(50)).toBe(true));
  it("-1 → rifiutato", () => expect(ok(-1)).toBe(false));
  it("51 → rifiutato", () => expect(ok(51)).toBe(false));
  it("due decimali (2.55) → valido", () => expect(ok("2.55")).toBe(true));
  it("tre decimali (2.555) → rifiutato", () => expect(ok("2.555")).toBe(false));
  it("stringa non numerica → rifiutata", () => expect(ok("cinque")).toBe(false));
  it("50.01 → rifiutato", () => expect(ok("50.01")).toBe(false));
  it("numero normalizzato a string", () => {
    const r = feePercentSchema.safeParse(2.5);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("2.5");
  });
});
