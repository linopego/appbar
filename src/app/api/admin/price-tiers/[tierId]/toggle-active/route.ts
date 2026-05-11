import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/auth/staff";
import { logManagerAction } from "@/lib/audit";
import { db } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tierId: string }> }
) {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const { tierId } = await params;

  const priceTier = await db.priceTier.findUnique({ where: { id: tierId } });
  if (!priceTier) {
    return NextResponse.json({ ok: false, error: "PriceTier non trovato" }, { status: 404 });
  }
  if (priceTier.venueId !== session.venueId) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 403 });
  }

  const newActive = !priceTier.active;
  await db.priceTier.update({ where: { id: tierId }, data: { active: newActive } });

  await logManagerAction({
    operatorId: session.operatorId,
    action: newActive ? "PRICE_TIER_ACTIVATED" : "PRICE_TIER_DEACTIVATED",
    targetType: "PriceTier",
    targetId: tierId,
    payload: { name: priceTier.name, active: newActive },
  });

  return NextResponse.json({ ok: true, data: { active: newActive } });
}
