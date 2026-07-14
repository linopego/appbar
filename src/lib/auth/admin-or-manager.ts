import { getAdminSession, type AdminSessionPayload } from "./admin";
import { getStaffSession, type StaffSessionPayload } from "./staff";

export type AdminOrManagerSession =
  | { kind: "admin"; session: AdminSessionPayload }
  | { kind: "manager"; session: StaffSessionPayload };

// Returns the first valid admin or manager session, or null if neither is authenticated.
export async function getAdminOrManagerSession(): Promise<AdminOrManagerSession | null> {
  const [admin, staff] = await Promise.all([getAdminSession(), getStaffSession()]);

  if (admin) return { kind: "admin", session: admin };
  if (staff && staff.role === "MANAGER") return { kind: "manager", session: staff };
  return null;
}
