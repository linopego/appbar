import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/auth/staff";
import { logManagerAction } from "@/lib/audit";
import { db } from "@/lib/db";

// Attiva/disattiva l'email giornaliera dei corrispettivi per il venue.
export async function PATCH(req: NextRequest) {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

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
    where: { id: session.venueId },
    data: { dailyReportEnabled: body.enabled },
  });

  await logManagerAction({
    operatorId: session.operatorId,
    action: "VENUE_SETTINGS_UPDATED",
    targetType: "Venue",
    targetId: session.venueId,
    payload: { dailyReportEnabled: body.enabled },
  });

  return NextResponse.json({ ok: true, data: { dailyReportEnabled: body.enabled } });
}
