import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { Prisma } from "@prisma/client";

// Bug del 500 su /admin dopo il cambio password del manager:
// la dashboard passava order.status (PAID, ...) a RefundStatusBadge, che
// mappa SOLO stati di rimborso → config undefined → TypeError nel render
// server alla prima visita con almeno un ordine. Qui: il flusso cambio
// password rigenera la sessione COMPLETA e la dashboard renderizza con
// ordini presenti; i badge non crashano mai su stati fuori mappa.

const { mockRequireStaffRole, mockCreateStaffSession, dbMock } = vi.hoisted(() => ({
  mockRequireStaffRole: vi.fn(),
  mockCreateStaffSession: vi.fn().mockResolvedValue(undefined),
  dbMock: {
    operator: { update: vi.fn(), findUnique: vi.fn() },
    order: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
    ticket: { count: vi.fn() },
    refund: { count: vi.fn() },
    adminAuditLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock("@/lib/auth/staff", () => ({
  requireStaffRole: mockRequireStaffRole,
  createStaffSession: mockCreateStaffSession,
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("$2a$12$hashed") },
}));

import { POST as changePassword } from "@/app/api/staff/change-password/route";
import AdminDashboardPage from "@/app/(admin)/admin/page";
import { RefundStatusBadge } from "@/components/shared/refund-status-badge";
import { OrderStatusBadge } from "@/components/shared/order-status-badge";

const D = (v: string) => new Prisma.Decimal(v);

const MANAGER_SESSION = {
  operatorId: "op-1",
  venueId: "ven-1",
  venueSlug: "bar-luna",
  role: "MANAGER" as const,
  name: "Mario",
};

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/staff/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireStaffRole.mockResolvedValue(MANAGER_SESSION);
  mockCreateStaffSession.mockResolvedValue(undefined);
  // logManagerAction risolve l'organizzazione dall'operatore
  dbMock.operator.findUnique.mockResolvedValue({
    venue: { organizationId: "org-1" },
  });
  dbMock.operator.update.mockResolvedValue({
    id: "op-1",
    name: "Mario",
    role: "MANAGER",
    venue: { id: "ven-1", slug: "bar-luna" },
  });
});

describe("cambio password → sessione rigenerata completa", () => {
  it("dopo il cambio la sessione viene ricreata con TUTTI i campi da dati freschi del DB", async () => {
    const res = await changePassword(jsonRequest({ password: "nuova-password-123" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.redirectTo).toBe("/admin");
    expect(mockCreateStaffSession).toHaveBeenCalledWith({
      operatorId: "op-1",
      venueId: "ven-1",
      venueSlug: "bar-luna",
      role: "MANAGER",
      name: "Mario",
    });
    // mustChangePassword azzerato nella stessa update
    expect(dbMock.operator.update.mock.calls[0]?.[0]?.data.mustChangePassword).toBe(false);
  });

  it("password troppo corta → 400 senza toccare sessione né DB", async () => {
    const res = await changePassword(jsonRequest({ password: "corta" }));
    expect(res.status).toBe(400);
    expect(dbMock.operator.update).not.toHaveBeenCalled();
    expect(mockCreateStaffSession).not.toHaveBeenCalled();
  });
});

describe("accesso dashboard dopo il cambio password (regressione 500)", () => {
  it("la dashboard renderizza con ordini PAID e PARTIALLY_REFUNDED senza crashare", async () => {
    dbMock.order.count.mockResolvedValue(2);
    dbMock.order.aggregate.mockResolvedValue({
      _count: { id: 2 },
      _sum: { totalAmount: D("30.00") },
    });
    dbMock.ticket.count.mockResolvedValue(0);
    dbMock.refund.count.mockResolvedValue(0);
    dbMock.order.findMany.mockResolvedValue([
      {
        id: "ord-1",
        status: "PAID",
        paidAt: new Date("2026-07-20T21:00:00Z"),
        totalAmount: D("20.00"),
        customer: { email: "a@b.it", firstName: "Anna", lastName: "Bi" },
        _count: { tickets: 4 },
      },
      {
        id: "ord-2",
        status: "PARTIALLY_REFUNDED",
        paidAt: new Date("2026-07-20T22:00:00Z"),
        totalAmount: D("10.00"),
        customer: { email: "c@d.it", firstName: null, lastName: null },
        _count: { tickets: 2 },
      },
    ]);

    // Prima del fix: TypeError ("config is undefined") già in fase di render
    render(await AdminDashboardPage());

    expect(screen.getByText("Pagato")).toBeDefined();
    expect(screen.getByText("Parz. rimborsato")).toBeDefined();
  });
});

describe("badge sempre safe su stati fuori mappa", () => {
  it("RefundStatusBadge con uno stato ORDINE non crasha: badge neutro col nome grezzo", () => {
    render(createElement(RefundStatusBadge, { status: "PAID" }));
    expect(screen.getByText("PAID")).toBeDefined();
  });

  it("OrderStatusBadge con uno stato sconosciuto non crasha", () => {
    render(createElement(OrderStatusBadge, { status: "STATO_NUOVO" }));
    expect(screen.getByText("STATO_NUOVO")).toBeDefined();
  });
});
