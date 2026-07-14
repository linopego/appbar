import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { orgScopeWhere } from "@/lib/auth/org-scope";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;

  if (id === session.adminUserId) {
    return NextResponse.json(
      { ok: false, error: { code: "CANNOT_RESET_OWN_TOTP" } },
      { status: 422 }
    );
  }

  // ORG_ADMIN: può gestire solo admin della propria organizzazione
  // (gli admin PLATFORM hanno organizationId null e restano quindi fuori scope)
  const user = await db.adminUser.findFirst({ where: { id, ...orgScopeWhere(session).adminUser } });
  if (!user) {
    return NextResponse.json({ ok: false, error: "Utente non trovato" }, { status: 404 });
  }

  await db.adminUser.update({
    where: { id },
    data: { totpEnabled: false, totpSecret: null },
  });

  await logAdminAction({
    adminUserId: session.adminUserId,
    organizationId: user.organizationId ?? undefined,
    action: "ADMIN_USER_TOTP_RESET",
    targetType: "AdminUser",
    targetId: id,
    payload: { email: user.email },
  });

  return NextResponse.json({ ok: true });
}
