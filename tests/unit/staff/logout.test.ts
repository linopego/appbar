import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Logout staff/superadmin: mai JSON crudo in faccia all'utente. Una
// navigazione (Accept: text/html) riceve un 303 verso la pagina di login
// giusta; una fetch riceve { ok: true }. Il logout è solo POST.

const { mockGetStaffSession, mockDestroyStaffSession, mockGetAdminSession, mockDestroyAdminSession } =
  vi.hoisted(() => ({
    mockGetStaffSession: vi.fn(),
    mockDestroyStaffSession: vi.fn().mockResolvedValue(undefined),
    mockGetAdminSession: vi.fn(),
    mockDestroyAdminSession: vi.fn().mockResolvedValue(undefined),
  }));

vi.mock("@/lib/auth/staff", () => ({
  getStaffSession: mockGetStaffSession,
  destroyStaffSession: mockDestroyStaffSession,
}));
vi.mock("@/lib/auth/admin", () => ({
  getAdminSession: mockGetAdminSession,
  destroyAdminSession: mockDestroyAdminSession,
}));
vi.mock("@/lib/audit", () => ({ logAdminAction: vi.fn().mockResolvedValue(undefined) }));

import { POST as staffLogout } from "@/app/api/staff/logout/route";
import { POST as superadminLogout } from "@/app/api/superadmin/logout/route";

function request(accept: string): NextRequest {
  return new Request("http://localhost/api/logout", {
    method: "POST",
    headers: { accept },
  }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetStaffSession.mockResolvedValue({ venueSlug: "casa-dei-gelsi", operatorId: "op-1" });
  mockGetAdminSession.mockResolvedValue(null);
});

describe("logout staff", () => {
  it("navigazione (Accept: text/html) → 303 verso il login PIN del venue", async () => {
    const res = await staffLogout(request("text/html,application/xhtml+xml"));
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/staff/casa-dei-gelsi");
    // il venue si legge PRIMA di distruggere la sessione
    expect(mockDestroyStaffSession).toHaveBeenCalled();
  });

  it("senza sessione (slug non disponibile) → fallback /accesso-staff", async () => {
    mockGetStaffSession.mockResolvedValue(null);
    const res = await staffLogout(request("text/html"));
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/accesso-staff");
  });

  it("fetch JSON → { ok: true }, nessun redirect", async () => {
    const res = await staffLogout(request("application/json"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("logout superadmin", () => {
  it("navigazione → 303 verso /superadmin/login", async () => {
    const res = await superadminLogout(request("text/html"));
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/superadmin/login");
    expect(mockDestroyAdminSession).toHaveBeenCalled();
  });

  it("fetch JSON → { ok: true }", async () => {
    const res = await superadminLogout(request("application/json"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
