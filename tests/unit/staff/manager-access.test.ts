import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Accesso staff ristrutturato: login manager email+password (errori sempre
// generici), verifica "codice locale" senza oracolo, landing per ruolo.

const { dbMock, mockCheckRateLimit, mockCreateStaffSession, mockCompare } = vi.hoisted(() => ({
  dbMock: {
    operator: { findFirst: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    venue: { findUnique: vi.fn() },
  },
  mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true }),
  mockCreateStaffSession: vi.fn().mockResolvedValue(undefined),
  mockCompare: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: mockCheckRateLimit,
  staffManagerLoginLimiter: null,
  venueCodeLimiter: null,
}));
vi.mock("@/lib/auth/staff", () => ({ createStaffSession: mockCreateStaffSession }));
vi.mock("@/lib/utils/request", () => ({ getClientIp: () => "1.2.3.4" }));
vi.mock("bcryptjs", () => ({
  default: { compare: mockCompare },
  compare: mockCompare,
}));

import { POST as loginManager } from "@/app/api/staff/login-manager/route";
import { POST as venueCode } from "@/app/api/staff/venue-code/route";
import { staffLandingPath } from "@/lib/auth/staff-landing";

function jsonRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const MANAGER = {
  id: "op-1",
  name: "Mario Manager",
  role: "MANAGER",
  active: true,
  passwordHash: "hash",
  mustChangePassword: false,
  venue: { id: "v1", slug: "locale-1", active: true },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ success: true });
});

describe("POST /api/staff/login-manager", () => {
  it("email sconosciuta e password errata → STESSO errore generico 401", async () => {
    // email sconosciuta
    dbMock.operator.findFirst.mockResolvedValue(null);
    const res1 = await loginManager(jsonRequest({ email: "ignoto@example.com", password: "x" }));
    const body1 = await res1.json();

    // password errata su manager esistente
    dbMock.operator.findFirst.mockResolvedValue(MANAGER);
    mockCompare.mockResolvedValue(false);
    const res2 = await loginManager(jsonRequest({ email: "mario@example.com", password: "sbagliata" }));
    const body2 = await res2.json();

    expect(res1.status).toBe(401);
    expect(res2.status).toBe(401);
    expect(body1).toEqual(body2); // nessun oracolo
    expect(mockCreateStaffSession).not.toHaveBeenCalled();
  });

  it("la query esclude a monte operatori disattivati e non-MANAGER", async () => {
    dbMock.operator.findFirst.mockResolvedValue(null);
    await loginManager(jsonRequest({ email: "barista@example.com", password: "x" }));

    const where = dbMock.operator.findFirst.mock.calls[0][0].where;
    expect(where.role).toBe("MANAGER");
    expect(where.active).toBe(true);
  });

  it("manager senza password impostata → 401 generico, bcrypt MAI chiamato", async () => {
    dbMock.operator.findFirst.mockResolvedValue({ ...MANAGER, passwordHash: null });
    const res = await loginManager(jsonRequest({ email: "mario@example.com", password: "x" }));
    expect(res.status).toBe(401);
    expect(mockCompare).not.toHaveBeenCalled();
  });

  it("venue disattivato → 401 generico", async () => {
    dbMock.operator.findFirst.mockResolvedValue({
      ...MANAGER,
      venue: { ...MANAGER.venue, active: false },
    });
    const res = await loginManager(jsonRequest({ email: "mario@example.com", password: "x" }));
    expect(res.status).toBe(401);
  });

  it("credenziali valide → sessione staff identica al PIN e redirect /admin", async () => {
    dbMock.operator.findFirst.mockResolvedValue(MANAGER);
    mockCompare.mockResolvedValue(true);

    const res = await loginManager(jsonRequest({ email: "mario@example.com", password: "giusta" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.redirectTo).toBe("/admin");
    expect(mockCreateStaffSession).toHaveBeenCalledWith({
      operatorId: "op-1",
      venueId: "v1",
      venueSlug: "locale-1",
      role: "MANAGER",
      name: "Mario Manager",
    });
  });

  it("mustChangePassword → redirect al cambio password obbligatorio", async () => {
    dbMock.operator.findFirst.mockResolvedValue({ ...MANAGER, mustChangePassword: true });
    mockCompare.mockResolvedValue(true);

    const res = await loginManager(jsonRequest({ email: "mario@example.com", password: "temp" }));
    const body = await res.json();

    expect(body.mustChangePassword).toBe(true);
    expect(body.redirectTo).toBe("/admin/cambio-password");
  });

  it("rate limited → 429, nessuna query", async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false });
    const res = await loginManager(jsonRequest({ email: "mario@example.com", password: "x" }));
    expect(res.status).toBe(429);
    expect(dbMock.operator.findFirst).not.toHaveBeenCalled();
  });
});

describe("POST /api/staff/venue-code", () => {
  it("codice valido → slug per il login PIN", async () => {
    dbMock.venue.findUnique.mockResolvedValue({ slug: "locale-1", active: true });
    const res = await venueCode(jsonRequest({ code: "locale-1" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.slug).toBe("locale-1");
  });

  it("slug inesistente e venue disattivato → risposte IDENTICHE (nessun oracolo)", async () => {
    dbMock.venue.findUnique.mockResolvedValue(null);
    const res1 = await venueCode(jsonRequest({ code: "non-esiste" }));
    const body1 = await res1.json();

    dbMock.venue.findUnique.mockResolvedValue({ slug: "spento", active: false });
    const res2 = await venueCode(jsonRequest({ code: "spento" }));
    const body2 = await res2.json();

    expect(res1.status).toBe(res2.status);
    expect(body1).toEqual(body2);
  });

  it("rate limited → 429", async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false });
    const res = await venueCode(jsonRequest({ code: "locale-1" }));
    expect(res.status).toBe(429);
  });
});

describe("staffLandingPath (landing per ruolo dopo il login PIN)", () => {
  it("MANAGER → pannello /admin", () => {
    expect(staffLandingPath("MANAGER", "locale-1")).toBe("/admin");
  });
  it("BARISTA e CASSIERE → POS del venue", () => {
    expect(staffLandingPath("BARISTA", "locale-1")).toBe("/staff/locale-1/pos");
    expect(staffLandingPath("CASSIERE", "locale-1")).toBe("/staff/locale-1/pos");
  });
});
