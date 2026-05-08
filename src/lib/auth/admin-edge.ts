import { jwtVerify } from "jose";

export interface AdminTokenPayload {
  adminUserId: string;
  email: string;
  name: string;
}

export async function verifyAdminToken(token: string): Promise<AdminTokenPayload | null> {
  const secret = process.env["ADMIN_JWT_SECRET"];
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return {
      adminUserId: payload["adminUserId"] as string,
      email: payload["email"] as string,
      name: payload["name"] as string,
    };
  } catch {
    return null;
  }
}

export const ADMIN_COOKIE_NAME = "admin-session";
