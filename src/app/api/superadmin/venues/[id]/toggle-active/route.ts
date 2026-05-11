import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;

  const venue = await db.venue.findUnique({ where: { id } });
  if (!venue) {
    return NextResponse.json({ ok: false, error: "Venue non trovata" }, { status: 404 });
  }

  const newActive = !venue.active;
  await db.venue.update({ where: { id }, data: { active: newActive } });

  await logAdminAction({
    adminUserId: session.adminUserId,
    action: newActive ? "VENUE_ACTIVATED" : "VENUE_DEACTIVATED",
    targetType: "Venue",
    targetId: id,
    payload: { name: venue.name, slug: venue.slug, active: newActive },
  });

  return NextResponse.json({ ok: true, data: { active: newActive } });
}
