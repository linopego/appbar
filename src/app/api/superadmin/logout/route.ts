import { NextResponse, type NextRequest } from "next/server";
import { destroyAdminSession, getAdminSession } from "@/lib/auth/admin";
import { getClientIp, getUserAgent } from "@/lib/utils/request";
import { logAdminAction } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (session) {
    await logAdminAction({
      adminUserId: session.adminUserId,
      action: "LOGOUT",
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }
  await destroyAdminSession();

  // Navigazione (form/anchor): mai JSON crudo — 303 verso il login admin
  if (req.headers.get("accept")?.includes("text/html")) {
    return NextResponse.redirect(new URL("/superadmin/login", req.url), 303);
  }

  return NextResponse.json({ ok: true });
}
