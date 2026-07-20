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

  // Col fiscale attivo ogni fascia ATTIVA deve avere l'aliquota IVA: riattivare
  // una fascia senza aliquota romperebbe l'emissione dei documenti.
  if (newActive && priceTier.vatRate === null) {
    const venue = await db.venue.findUnique({
      where: { id: session.venueId },
      select: { fiscalEnabled: true },
    });
    if (venue?.fiscalEnabled) {
      return NextResponse.json(
        { ok: false, error: "Il modulo fiscale è attivo: imposta l'aliquota IVA prima di riattivare la fascia" },
        { status: 400 }
      );
    }
  }

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
