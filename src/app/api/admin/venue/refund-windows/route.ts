import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/auth/staff";
import { logManagerAction } from "@/lib/audit";
import { db } from "@/lib/db";

interface RefundWindow {
  day: number;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
}

function isValidWindow(w: unknown): w is RefundWindow {
  if (typeof w !== "object" || w === null) return false;
  const obj = w as Record<string, unknown>;
  const inRange = (val: unknown, min: number, max: number) =>
    typeof val === "number" && Number.isInteger(val) && val >= min && val <= max;
  return (
    inRange(obj.day, 0, 6) &&
    inRange(obj.startHour, 0, 23) &&
    inRange(obj.startMin, 0, 59) &&
    inRange(obj.endHour, 0, 23) &&
    inRange(obj.endMin, 0, 59)
  );
}

export async function PATCH(req: NextRequest) {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  let body: { windows?: unknown; timezone?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const { windows, timezone } = body;

  if (!Array.isArray(windows)) {
    return NextResponse.json({ ok: false, error: "windows deve essere un array" }, { status: 400 });
  }
  for (const w of windows) {
    if (!isValidWindow(w)) {
      return NextResponse.json({ ok: false, error: "Finestra non valida" }, { status: 400 });
    }
  }
  if (typeof timezone !== "string" || timezone.trim() === "") {
    return NextResponse.json({ ok: false, error: "timezone è obbligatorio" }, { status: 400 });
  }

  await db.venue.update({
    where: { id: session.venueId },
    data: {
      refundBlockedWindows: windows,
      refundBlockedTimezone: timezone.trim(),
    },
  });

  await logManagerAction({
    operatorId: session.operatorId,
    action: "VENUE_SETTINGS_UPDATED",
    targetType: "Venue",
    targetId: session.venueId,
    payload: { windows, timezone: timezone.trim() },
  });

  return NextResponse.json({ ok: true });
}
