import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/auth/admin";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED_ADMIN", message: "Non autenticato." } },
      { status: 401 }
    );
  }

  const adminUser = await db.adminUser.findUnique({
    where: { id: session.adminUserId },
    select: {
      id: true,
      email: true,
      name: true,
      mustChangePassword: true,
      totpEnabled: true,
      active: true,
    },
  });
  if (!adminUser || !adminUser.active) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED_ADMIN", message: "Non autenticato." } },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      mustChangePassword: adminUser.mustChangePassword,
      totpEnabled: adminUser.totpEnabled,
    },
  });
}
