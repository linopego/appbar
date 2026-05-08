import { jwtVerify } from "jose";

export interface StaffTokenPayload {
  operatorId: string;
  venueId: string;
  venueSlug: string;
  role: string;
  name: string;
}

export async function verifyStaffToken(token: string): Promise<StaffTokenPayload | null> {
  const secret = process.env["STAFF_JWT_SECRET"];
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return {
      operatorId: payload["operatorId"] as string,
      venueId: payload["venueId"] as string,
      venueSlug: payload["venueSlug"] as string,
      role: payload["role"] as string,
      name: payload["name"] as string,
    };
  } catch {
    return null;
  }
}

export const STAFF_COOKIE_NAME = "staff-session";
