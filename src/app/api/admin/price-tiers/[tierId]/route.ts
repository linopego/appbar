import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/auth/staff";
import { logManagerAction } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  parseTierUpdateInput,
  tierAuditDiff,
  VAT_REQUIRED_ON_UPDATE_ERROR,
} from "@/lib/price-tiers/validation";

export async function PATCH(
  req: NextRequest,
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const parsed = parseTierUpdateInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const updates = parsed.data;

  // Guardia fiscale: azzerare l'aliquota su una fascia attiva è impedito
  // quando il venue ha l'emissione attiva
  if (updates.vatRate === null && priceTier.active) {
    const venue = await db.venue.findUnique({
      where: { id: session.venueId },
      select: { fiscalEnabled: true },
    });
    if (venue?.fiscalEnabled) {
      return NextResponse.json({ ok: false, error: VAT_REQUIRED_ON_UPDATE_ERROR }, { status: 400 });
    }
  }

  await db.priceTier.update({ where: { id: tierId }, data: updates });

  await logManagerAction({
    operatorId: session.operatorId,
    action: "PRICE_TIER_UPDATED",
    targetType: "PriceTier",
    targetId: tierId,
    payload: tierAuditDiff(priceTier, updates),
  });

  return NextResponse.json({ ok: true });
}
