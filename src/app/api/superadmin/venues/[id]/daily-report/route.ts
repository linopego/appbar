import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { orgScopeWhere } from "@/lib/auth/org-scope";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";

// Email giornaliera dei corrispettivi on/off lato superadmin, scopata.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;
  const venue = await db.venue.findFirst({
    where: { id, ...orgScopeWhere(session).venue },
    select: { id: true, organizationId: true },
  });
  if (!venue) {
    return NextResponse.json({ ok: false, error: "Venue non trovata" }, { status: 404 });
  }

  let body: { enabled?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ ok: false, error: "enabled deve essere true o false" }, { status: 400 });
  }

  await db.venue.update({
    where: { id: venue.id },
    data: { dailyReportEnabled: body.enabled },
  });

  await logAdminAction({
    adminUserId: session.adminUserId,
    organizationId: venue.organizationId,
    action: "VENUE_SETTINGS_UPDATED",
    targetType: "Venue",
    targetId: venue.id,
    payload: { dailyReportEnabled: body.enabled },
  });

  return NextResponse.json({ ok: true, data: { dailyReportEnabled: body.enabled } });
}
