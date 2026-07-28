import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

const STAFF_COOKIE = "staff-session";
const STAFF_SESSION_DURATION_SECONDS = 12 * 60 * 60; // 12h

export type OperatorRole = "BARISTA" | "CASSIERE" | "MANAGER";

export interface StaffSessionPayload {
  operatorId: string;
  venueId: string;
  venueSlug: string;
  role: OperatorRole;
  name: string;
}

function getSecret(): Uint8Array {
  const secret = process.env["STAFF_JWT_SECRET"];
  if (!secret) throw new Error("STAFF_JWT_SECRET non configurato");
  return new TextEncoder().encode(secret);
}

export async function createStaffSession(payload: StaffSessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload } as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STAFF_SESSION_DURATION_SECONDS}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(STAFF_COOKIE, token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: STAFF_SESSION_DURATION_SECONDS,
    path: "/",
  });
}

const OPERATOR_ROLES: readonly OperatorRole[] = ["BARISTA", "CASSIERE", "MANAGER"];

export async function getStaffSession(): Promise<StaffSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const operatorId = payload["operatorId"];
    const venueId = payload["venueId"];
    const venueSlug = payload["venueSlug"];
    const role = payload["role"];
    const name = payload["name"];

    // Payload incompleto (token di una versione precedente o malformato) →
    // sessione NON valida: chi chiama fa redirect al login invece di
    // crashare a valle (es. findUnique({ where: { id: undefined } }) lancia).
    if (
      typeof operatorId !== "string" ||
      operatorId === "" ||
      typeof venueId !== "string" ||
      venueId === "" ||
      typeof venueSlug !== "string" ||
      venueSlug === "" ||
      typeof name !== "string" ||
      !OPERATOR_ROLES.includes(role as OperatorRole)
    ) {
      return null;
    }

    return { operatorId, venueId, venueSlug, role: role as OperatorRole, name };
  } catch {
    return null;
  }
}

export async function destroyStaffSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(STAFF_COOKIE);
}

export class StaffAuthError extends Error {
  constructor(public code: "UNAUTHORIZED_STAFF" | "FORBIDDEN") {
    super(code);
    this.name = "StaffAuthError";
  }
}

export async function requireStaff(): Promise<StaffSessionPayload> {
  const session = await getStaffSession();
  if (!session) throw new StaffAuthError("UNAUTHORIZED_STAFF");
  return session;
}

export async function requireStaffRole(roles: OperatorRole[]): Promise<StaffSessionPayload> {
  const session = await requireStaff();
  if (!roles.includes(session.role)) throw new StaffAuthError("FORBIDDEN");
  return session;
}

export const STAFF_COOKIE_NAME = STAFF_COOKIE;
export const STAFF_SESSION_DURATION = STAFF_SESSION_DURATION_SECONDS;
