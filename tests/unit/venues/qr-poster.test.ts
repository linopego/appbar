import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Scoping degli endpoint qr-poster: il manager riceve solo il QR del PROPRIO
// venue; l'ORG_ADMIN solo dei venue della propria organizzazione. Il PNG è
// mockato: qui contano autorizzazione e filtri.

const { mockRequireStaffRole, mockRequireAdmin, dbMock, mockRenderPng } = vi.hoisted(() => ({
  mockRequireStaffRole: vi.fn(),
  mockRequireAdmin: vi.fn(),
  dbMock: {
    venue: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  mockRenderPng: vi.fn().mockResolvedValue(Buffer.from("png-finto")),
}));

vi.mock("@/lib/auth/staff", () => ({ requireStaffRole: mockRequireStaffRole }));
vi.mock("@/lib/auth/admin", () => ({ requireAdmin: mockRequireAdmin }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/qr/poster", () => ({
  renderVenueQrPosterPng: mockRenderPng,
  venuePublicUrl: (slug: string) => `https://example.com/${slug}`,
}));

import { GET as managerQr } from "@/app/api/admin/venue/qr-poster/route";
import { GET as superadminQr } from "@/app/api/superadmin/venues/[id]/qr-poster/route";

const req = {} as NextRequest;
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  mockRenderPng.mockResolvedValue(Buffer.from("png-finto"));
});

describe("GET /api/admin/venue/qr-poster (manager)", () => {
  it("usa SEMPRE il venue della sessione: nessun modo di chiedere altri venue", async () => {
    mockRequireStaffRole.mockResolvedValue({ venueId: "venue-mio", role: "MANAGER" });
    dbMock.venue.findUnique.mockResolvedValue({ slug: "il-mio-locale" });

    const res = await managerQr();

    expect(res.status).toBe(200);
    expect(dbMock.venue.findUnique.mock.calls[0][0].where).toEqual({ id: "venue-mio" });
    expect(mockRenderPng).toHaveBeenCalledWith("il-mio-locale");
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="qr-il-mio-locale.png"'
    );
  });

  it("non-manager (PIN barista o nessuna sessione) → 401", async () => {
    mockRequireStaffRole.mockRejectedValue(new Error("FORBIDDEN"));
    const res = await managerQr();
    expect(res.status).toBe(401);
    expect(mockRenderPng).not.toHaveBeenCalled();
  });
});

describe("GET /api/superadmin/venues/[id]/qr-poster", () => {
  it("ORG_ADMIN: la query è scopata sulla propria organizzazione", async () => {
    mockRequireAdmin.mockResolvedValue({
      adminUserId: "a1",
      role: "ORG_ADMIN",
      organizationId: "org-1",
    });
    dbMock.venue.findFirst.mockResolvedValue({ slug: "locale-org1" });

    const res = await superadminQr(req, params("v1"));

    expect(res.status).toBe(200);
    const where = dbMock.venue.findFirst.mock.calls[0][0].where;
    expect(where.id).toBe("v1");
    expect(where.organizationId).toBe("org-1");
  });

  it("ORG_ADMIN su venue di un'altra org → 404 (fuori scope)", async () => {
    mockRequireAdmin.mockResolvedValue({
      adminUserId: "a1",
      role: "ORG_ADMIN",
      organizationId: "org-1",
    });
    dbMock.venue.findFirst.mockResolvedValue(null);

    const res = await superadminQr(req, params("venue-altrui"));

    expect(res.status).toBe(404);
    expect(mockRenderPng).not.toHaveBeenCalled();
  });

  it("PLATFORM: nessun filtro organizzazione", async () => {
    mockRequireAdmin.mockResolvedValue({
      adminUserId: "a2",
      role: "PLATFORM",
      organizationId: null,
    });
    dbMock.venue.findFirst.mockResolvedValue({ slug: "qualsiasi" });

    const res = await superadminQr(req, params("v9"));

    expect(res.status).toBe(200);
    const where = dbMock.venue.findFirst.mock.calls[0][0].where;
    expect(where).toEqual({ id: "v9" });
  });

  it("non autenticato → 401", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("UNAUTHORIZED_ADMIN"));
    const res = await superadminQr(req, params("v1"));
    expect(res.status).toBe(401);
  });
});
