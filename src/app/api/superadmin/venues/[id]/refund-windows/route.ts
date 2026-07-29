import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { orgScopeWhere } from "@/lib/auth/org-scope";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseRefundWindowsInput } from "@/lib/venue-settings/validation";

// Finestre di blocco rimborsi lato superadmin: stessa validazione condivisa
// del percorso responsabile, scoping per organizzazione.
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

  let body: { windows?: unknown; timezone?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const parsed = parseRefundWindowsInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  await db.venue.update({
    where: { id: venue.id },
    data: {
      refundBlockedWindows: parsed.windows,
      refundBlockedTimezone: parsed.timezone,
    },
  });

  await logAdminAction({
    adminUserId: session.adminUserId,
    organizationId: venue.organizationId,
    action: "VENUE_SETTINGS_UPDATED",
    targetType: "Venue",
    targetId: venue.id,
    payload: { windows: parsed.windows, timezone: parsed.timezone },
  });

  return NextResponse.json({ ok: true });
}
