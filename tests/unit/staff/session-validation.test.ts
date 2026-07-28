// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SignJWT } from "jose";

// Hardening sessione staff: un token firmato ma con payload INCOMPLETO
// (es. emesso da una versione precedente del codice) non deve mai arrivare
// alle pagine: getStaffSession → null → redirect al login, mai un crash a
// valle su campi undefined.

const cookieJar = vi.hoisted(() => ({ token: null as string | null }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "staff-session" && cookieJar.token ? { value: cookieJar.token } : undefined,
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

import { getStaffSession } from "@/lib/auth/staff";

const SECRET = "test-staff-secret";

async function signToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(SECRET));
}

const FULL_PAYLOAD = {
  operatorId: "op-1",
  venueId: "ven-1",
  venueSlug: "bar-luna",
  role: "MANAGER",
  name: "Mario",
};

beforeEach(() => {
  vi.stubEnv("STAFF_JWT_SECRET", SECRET);
  cookieJar.token = null;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getStaffSession — validazione del payload", () => {
  it("token completo → sessione con tutti i campi", async () => {
    cookieJar.token = await signToken(FULL_PAYLOAD);
    expect(await getStaffSession()).toEqual(FULL_PAYLOAD);
  });

  it.each(["operatorId", "venueId", "venueSlug", "role", "name"])(
    "token firmato ma senza %s → null (redirect al login, non crash)",
    async (missingField) => {
      const partial: Record<string, unknown> = { ...FULL_PAYLOAD };
      delete partial[missingField];
      cookieJar.token = await signToken(partial);

      expect(await getStaffSession()).toBeNull();
    }
  );

  it("ruolo fuori dall'enum → null", async () => {
    cookieJar.token = await signToken({ ...FULL_PAYLOAD, role: "SUPERADMIN" });
    expect(await getStaffSession()).toBeNull();
  });

  it("campi vuoti → null", async () => {
    cookieJar.token = await signToken({ ...FULL_PAYLOAD, venueId: "" });
    expect(await getStaffSession()).toBeNull();
  });

  it("nessun cookie → null", async () => {
    expect(await getStaffSession()).toBeNull();
  });
});
