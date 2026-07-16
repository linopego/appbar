import { NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/auth/staff";
import { getLiveSnapshot } from "@/lib/reports/live-data";

export const dynamic = "force-dynamic";

// Snapshot "Serata live" del venue del manager: il client fa polling ogni 20s.
export async function GET() {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const snapshot = await getLiveSnapshot(session.venueId, new Date());
  return NextResponse.json({ ok: true, data: snapshot });
}
