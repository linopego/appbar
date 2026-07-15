import { describe, it, expect, vi, beforeEach } from "vitest";

// Routing della "casa": cliente loggato che apre / atterra su /home;
// anonimo vede la vetrina B2B; /home è protetta.

const { mockAuth, dbMock } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  dbMock: {
    ticket: { findMany: vi.fn().mockResolvedValue([]) },
    order: { findMany: vi.fn().mockResolvedValue([]) },
    venue: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
// redirect() di Next lancia un errore con digest NEXT_REDIRECT
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    const err = new Error(`NEXT_REDIRECT:${url}`);
    (err as Error & { digest: string }).digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw err;
  },
}));

import HomePage from "@/app/page";
import CustomerHomePage from "@/app/(public)/home/page";

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.ticket.findMany.mockResolvedValue([]);
  dbMock.order.findMany.mockResolvedValue([]);
  dbMock.venue.findMany.mockResolvedValue([]);
});

describe("/ (vetrina prodotto)", () => {
  it("cliente loggato → redirect a /home", async () => {
    mockAuth.mockResolvedValue({ user: { id: "cust-1", name: "Anna" } });
    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/home");
  });

  it("anonimo → vede la vetrina (nessun redirect, nessuna query ai locali)", async () => {
    mockAuth.mockResolvedValue(null);
    const jsx = await HomePage();
    expect(jsx).toBeTruthy();
    // la vetrina non elenca locali: nessuna query venue
    expect(dbMock.venue.findMany).not.toHaveBeenCalled();
  });
});

describe("/home (dashboard cliente)", () => {
  it("non autenticato → redirect al login con ritorno a /home", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(CustomerHomePage()).rejects.toThrow(
      `NEXT_REDIRECT:/login?callbackUrl=${encodeURIComponent("/home")}`
    );
  });

  it("autenticato → renderizza la dashboard con i ticket attivi", async () => {
    mockAuth.mockResolvedValue({ user: { id: "cust-1", name: "Anna Rossi" } });
    const jsx = await CustomerHomePage();
    expect(jsx).toBeTruthy();

    const ticketQuery = dbMock.ticket.findMany.mock.calls[0][0];
    expect(ticketQuery.where.customerId).toBe("cust-1");
    expect(ticketQuery.where.status).toBe("ACTIVE");
    expect(ticketQuery.where.expiresAt.gt).toBeInstanceOf(Date);
    expect(ticketQuery.orderBy).toEqual({ expiresAt: "asc" });

    // "I tuoi locali": solo ordini PAID del cliente, dal più recente
    const orderQuery = dbMock.order.findMany.mock.calls[0][0];
    expect(orderQuery.where).toEqual({
      customerId: "cust-1",
      status: "PAID",
      venue: { active: true },
    });
    expect(orderQuery.orderBy).toEqual({ createdAt: "desc" });
  });
});
