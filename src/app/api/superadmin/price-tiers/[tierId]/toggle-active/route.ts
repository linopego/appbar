import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { orgScopeWhere } from "@/lib/auth/org-scope";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { VAT_REQUIRED_ON_ACTIVATE_ERROR } from "@/lib/price-tiers/validation";

// Disattiva/riattiva fascia lato superadmin (mai eliminazione fisica: lo
// storico ordini la referenzia), scoping per organizzazione.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tierId: string }> }
) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const { tierId } = await params;

  const priceTier = await db.priceTier.findFirst({
    where: { id: tierId, venue: orgScopeWhere(session).venue },
    include: { venue: { select: { organizationId: true, fiscalEnabled: true } } },
  });
  if (!priceTier) {
    return NextResponse.json({ ok: false, error: "PriceTier non trovato" }, { status: 404 });
  }

  const newActive = !priceTier.active;

  // Guardia fiscale: riattivare una fascia senza aliquota romperebbe
  // l'emissione dei documenti
  if (newActive && priceTier.vatRate === null && priceTier.venue.fiscalEnabled) {
    return NextResponse.json({ ok: false, error: VAT_REQUIRED_ON_ACTIVATE_ERROR }, { status: 400 });
  }

  await db.priceTier.update({ where: { id: tierId }, data: { active: newActive } });

  await logAdminAction({
    adminUserId: session.adminUserId,
    organizationId: priceTier.venue.organizationId,
    action: newActive ? "PRICE_TIER_ACTIVATED" : "PRICE_TIER_DEACTIVATED",
    targetType: "PriceTier",
    targetId: tierId,
    payload: { name: priceTier.name, active: newActive },
  });

  return NextResponse.json({ ok: true, data: { active: newActive } });
}
