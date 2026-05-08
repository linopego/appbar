import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

const ADMIN_COOKIE = "admin-session";
const ADMIN_PENDING_COOKIE = "admin-pending";
const ADMIN_SESSION_DURATION_SECONDS = 60 * 60; // 1h
const ADMIN_PENDING_DURATION_SECONDS = 5 * 60; // 5 min

export type AdminPendingStep = "TOTP_REQUIRED" | "TOTP_SETUP_REQUIRED";

export interface AdminSessionPayload {
  adminUserId: string;
  email: string;
  name: string;
}

export interface AdminPendingPayload {
  adminUserId: string;
  step: AdminPendingStep;
}

function getSecret(): Uint8Array {
  const secret = process.env["ADMIN_JWT_SECRET"];
  if (!secret) throw new Error("ADMIN_JWT_SECRET non configurato");
  return new TextEncoder().encode(secret);
}

// === Sessione completa ===

export async function createAdminSession(payload: AdminSessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload } as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_DURATION_SECONDS}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: ADMIN_SESSION_DURATION_SECONDS,
    path: "/",
  });
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      adminUserId: payload["adminUserId"] as string,
      email: payload["email"] as string,
      name: payload["name"] as string,
    };
  } catch {
    return null;
  }
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
}

export class AdminAuthError extends Error {
  constructor(public code: "UNAUTHORIZED_ADMIN") {
    super(code);
    this.name = "AdminAuthError";
  }
}

export async function requireAdmin(): Promise<AdminSessionPayload> {
  const session = await getAdminSession();
  if (!session) throw new AdminAuthError("UNAUTHORIZED_ADMIN");
  return session;
}

// === Sessione intermedia (post-password, pre-TOTP) ===

export async function createAdminPendingSession(
  adminUserId: string,
  step: AdminPendingStep
): Promise<void> {
  const token = await new SignJWT({ adminUserId, step } as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_PENDING_DURATION_SECONDS}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_PENDING_COOKIE, token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: ADMIN_PENDING_DURATION_SECONDS,
    path: "/",
  });
}

export async function getAdminPendingSession(): Promise<AdminPendingPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_PENDING_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      adminUserId: payload["adminUserId"] as string,
      step: payload["step"] as AdminPendingStep,
    };
  } catch {
    return null;
  }
}

export async function destroyAdminPendingSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_PENDING_COOKIE);
}

export const ADMIN_COOKIE_NAME = ADMIN_COOKIE;
export const ADMIN_PENDING_COOKIE_NAME = ADMIN_PENDING_COOKIE;
export const ADMIN_SESSION_DURATION = ADMIN_SESSION_DURATION_SECONDS;
