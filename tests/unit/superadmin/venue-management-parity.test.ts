import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

// Parità di gestione venue tra pannello responsabile e superadmin
// (docs/ARCHITECTURE.md): scoping ORG_ADMIN su OGNI nuovo endpoint, audit su
// ogni scrittura con le stesse action string, validazioni identiche perché
// condivise in lib.

const {
  mockRequireAdmin,
  mockRequireStaffRole,
  mockLogAdminAction,
  mockLogManagerAction,
  mockSendEmail,
  dbMock,
} = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockRequireStaffRole: vi.fn(),
  mockLogAdminAction: vi.fn().mockResolvedValue(undefined),
  mockLogManagerAction: vi.fn().mockResolvedValue(undefined),
  mockSendEmail: vi.fn().mockResolvedValue(undefined),
  dbMock: {
    venue: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    ticket: { findMany: vi.fn() },
    order: { findMany: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({ ticket: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } })
    ),
  },
}));

vi.mock("@/lib/auth/admin", () => ({ requireAdmin: mockRequireAdmin }));
vi.mock("@/lib/auth/staff", () => ({ requireStaffRole: mockRequireStaffRole }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({
  logAdminAction: mockLogAdminAction,
  logManagerAction: mockLogManagerAction,
}));
vi.mock("@/lib/email/client", () => ({ sendEmail: mockSendEmail }));

import { PATCH as saFiscalToggle } from "@/app/api/superadmin/venues/[id]/fiscal/route";
import { PATCH as saRefundWindows } from "@/app/api/superadmin/venues/[id]/refund-windows/route";
import { PATCH as saDailyReport } from "@/app/api/superadmin/venues/[id]/daily-report/route";
import { GET as saOrdersExport } from "@/app/api/superadmin/orders/export/route";
import { POST as saInvalidate } from "@/app/api/superadmin/tickets/invalidate/route";
import { PATCH as adminRefundWindows } from "@/app/api/admin/venue/refund-windows/route";

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

function jsonRequest(body: unknown, method = "PATCH"): NextRequest {
  return new Request("http://localhost/api/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}
function getRequest(query = ""): NextRequest {
  return new Request(`http://localhost/api/test${query}`) as unknown as NextRequest;
}
const venueParams = { params: Promise.resolve({ id: "ven-1" }) };

const VALID_WINDOW = { day: 5, startHour: 22, startMin: 0, endHour: 6, endMin: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAPI_FISCAL_API_KEY", "test-key");
  mockRequireAdmin.mockResolvedValue(PLATFORM_SESSION);
  mockRequireStaffRole.mockResolvedValue(MANAGER_SESSION);
  dbMock.venue.findFirst.mockResolvedValue({
    id: "ven-1",
    organizationId: "org-1",
    fiscalConfig: { fiscalId: "12345678901", name: "Bar Luna Srl" },
    priceTiers: [{ name: "Birra", vatRate: D("10.00") }],
  });
  dbMock.venue.update.mockResolvedValue({});
  dbMock.order.findMany.mockResolvedValue([]);
});

afterEach(() => vi.unstubAllEnvs());

describe("scoping ORG_ADMIN su ogni nuovo endpoint", () => {
  it("fiscal / refund-windows / daily-report: venue fuori org → 404 senza scritture né audit", async () => {
    mockRequireAdmin.mockResolvedValue(ORG_ADMIN_SESSION);
    dbMock.venue.findFirst.mockResolvedValue(null); // filtro org non matcha

    const responses = await Promise.all([
      saFiscalToggle(jsonRequest({ enabled: true }), venueParams),
      saRefundWindows(jsonRequest({ windows: [VALID_WINDOW], timezone: "Europe/Rome" }), venueParams),
      saDailyReport(jsonRequest({ enabled: true }), venueParams),
    ]);

    for (const res of responses) expect(res.status).toBe(404);
    // Ogni query era scopata sull'organizzazione della sessione
    for (const call of dbMock.venue.findFirst.mock.calls) {
      expect(call[0]?.where?.organizationId).toBe("org-1");
    }
    expect(dbMock.venue.update).not.toHaveBeenCalled();
    expect(mockLogAdminAction).not.toHaveBeenCalled();
  });

  it("tickets/invalidate: un ticket di un'altra organizzazione invalida TUTTA la richiesta (422)", async () => {
    mockRequireAdmin.mockResolvedValue(ORG_ADMIN_SESSION);
    dbMock.ticket.findMany.mockResolvedValue([
      {
        id: "t1",
        status: "ACTIVE",
        venue: { id: "ven-x", organizationId: "org-2" }, // fuori org
        order: { customer: { email: "a@b.it" } },
      },
    ]);

    const res = await saInvalidate(
      jsonRequest({ ticketIds: ["t1"], reason: "motivazione valida lunga" }, "POST")
    );

    expect(res.status).toBe(422);
    expect(dbMock.$transaction).not.toHaveBeenCalled();
    expect(mockLogAdminAction).not.toHaveBeenCalled();
  });

  it("orders/export: la query è scopata per organizzazione e il CSV ha la colonna Venue", async () => {
    mockRequireAdmin.mockResolvedValue(ORG_ADMIN_SESSION);

    const res = await saOrdersExport(getRequest("?status=PAID"));
    const csv = await res.text();

    expect(res.status).toBe(200);
    const where = dbMock.order.findMany.mock.calls[0]?.[0]?.where;
    expect(where?.venue?.organizationId).toBe("org-1");
    expect(where?.status).toBe("PAID");
    expect(csv.startsWith("Data,Venue,Cliente,Ticket,Totale,Status")).toBe(true);
  });
});

describe("toggle fiscale superadmin: stesse precondizioni del responsabile", () => {
  it("attivazione bloccata se una fascia attiva non ha l'aliquota (motivo col nome)", async () => {
    dbMock.venue.findFirst.mockResolvedValue({
      id: "ven-1",
      organizationId: "org-1",
      fiscalConfig: { fiscalId: "12345678901", name: "Bar Luna Srl" },
      priceTiers: [{ name: "Drink", vatRate: null }],
    });

    const res = await saFiscalToggle(jsonRequest({ enabled: true }), venueParams);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("Drink");
    expect(dbMock.venue.update).not.toHaveBeenCalled();
  });

  it("attivazione bloccata senza modulo configurato a livello piattaforma", async () => {
    vi.stubEnv("OPENAPI_FISCAL_API_KEY", "");

    const res = await saFiscalToggle(jsonRequest({ enabled: true }), venueParams);
    expect(res.status).toBe(400);
    expect(dbMock.venue.update).not.toHaveBeenCalled();
  });

  it("attivazione ok con precondizioni soddisfatte → audit VENUE_FISCAL_ENABLED", async () => {
    const res = await saFiscalToggle(jsonRequest({ enabled: true }), venueParams);

    expect(res.status).toBe(200);
    expect(dbMock.venue.update).toHaveBeenCalledWith({
      where: { id: "ven-1" },
      data: { fiscalEnabled: true },
    });
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "VENUE_FISCAL_ENABLED", organizationId: "org-1" })
    );
  });

  it("disattivazione sempre consentita, anche a precondizioni mancanti", async () => {
    vi.stubEnv("OPENAPI_FISCAL_API_KEY", "");
    dbMock.venue.findFirst.mockResolvedValue({
      id: "ven-1",
      organizationId: "org-1",
      fiscalConfig: null,
      priceTiers: [{ name: "Drink", vatRate: null }],
    });

    const res = await saFiscalToggle(jsonRequest({ enabled: false }), venueParams);

    expect(res.status).toBe(200);
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "VENUE_FISCAL_DISABLED" })
    );
  });
});

describe("parità di validazioni (stessa lib condivisa)", () => {
  it.each([
    [{ windows: "no", timezone: "Europe/Rome" }],
    [{ windows: [{ ...VALID_WINDOW, day: 7 }], timezone: "Europe/Rome" }],
    [{ windows: [VALID_WINDOW], timezone: "" }],
  ])("finestre rimborsi: stesso errore 400 sui due percorsi per %o", async (body) => {
    const [saRes, adminRes] = await Promise.all([
      saRefundWindows(jsonRequest(body), venueParams),
      adminRefundWindows(jsonRequest(body)),
    ]);
    expect(saRes.status).toBe(400);
    expect(adminRes.status).toBe(400);
    const [saJson, adminJson] = await Promise.all([saRes.json(), adminRes.json()]);
    expect(saJson.error).toBe(adminJson.error);
  });

  it("salvataggio valido: stessa action VENUE_SETTINGS_UPDATED sui due percorsi", async () => {
    const body = { windows: [VALID_WINDOW], timezone: "Europe/Rome" };

    await saRefundWindows(jsonRequest(body), venueParams);
    await adminRefundWindows(jsonRequest(body));

    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "VENUE_SETTINGS_UPDATED", organizationId: "org-1" })
    );
    expect(mockLogManagerAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "VENUE_SETTINGS_UPDATED" })
    );
  });

  it("email corrispettivi: toggle superadmin scrive e audita come il responsabile", async () => {
    const res = await saDailyReport(jsonRequest({ enabled: true }), venueParams);

    expect(res.status).toBe(200);
    expect(dbMock.venue.update).toHaveBeenCalledWith({
      where: { id: "ven-1" },
      data: { dailyReportEnabled: true },
    });
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "VENUE_SETTINGS_UPDATED",
        payload: { dailyReportEnabled: true },
      })
    );
  });
});

describe("invalidazione ticket superadmin (lib condivisa)", () => {
  it("ticket ACTIVE nello scope → invalidati, audit TICKETS_INVALIDATED, email al cliente", async () => {
    mockRequireAdmin.mockResolvedValue(ORG_ADMIN_SESSION);
    dbMock.ticket.findMany.mockResolvedValue([
      {
        id: "t1",
        status: "ACTIVE",
        venue: { id: "ven-1", organizationId: "org-1" },
        order: { customer: { email: "a@b.it" } },
      },
    ]);

    const res = await saInvalidate(
      jsonRequest({ ticketIds: ["t1"], reason: "motivazione valida lunga" }, "POST")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.invalidated).toBe(1);
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "TICKETS_INVALIDATED", organizationId: "org-1" })
    );
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it("ticket non ACTIVE → 422 senza scritture", async () => {
    dbMock.ticket.findMany.mockResolvedValue([
      {
        id: "t1",
        status: "CONSUMED",
        venue: { id: "ven-1", organizationId: "org-1" },
        order: { customer: { email: "a@b.it" } },
      },
    ]);

    const res = await saInvalidate(
      jsonRequest({ ticketIds: ["t1"], reason: "motivazione valida lunga" }, "POST")
    );
    expect(res.status).toBe(422);
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });
});
