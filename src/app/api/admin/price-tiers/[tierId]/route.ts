import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/auth/staff";
import { logManagerAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";

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

  let body: { name?: unknown; price?: unknown; sortOrder?: unknown; vatRate?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const updates: { name?: string; price?: Decimal; sortOrder?: number; vatRate?: Decimal | null } = {};
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim() === "") {
      return NextResponse.json({ ok: false, error: "name non valido" }, { status: 400 });
    }
    oldValues.name = priceTier.name;
    newValues.name = body.name.trim();
    updates.name = body.name.trim();
  }

  if (body.price !== undefined) {
    let priceDecimal: Decimal;
    try {
      priceDecimal = new Decimal(String(body.price));
      if (priceDecimal.lte(0)) throw new Error();
    } catch {
      return NextResponse.json({ ok: false, error: "price deve essere un decimale > 0" }, { status: 400 });
    }
    oldValues.price = priceTier.price.toString();
    newValues.price = priceDecimal.toString();
    updates.price = priceDecimal;
  }

  if (body.sortOrder !== undefined) {
    const so = Number(body.sortOrder);
    if (!Number.isInteger(so) || so < 0) {
      return NextResponse.json({ ok: false, error: "sortOrder deve essere un intero >= 0" }, { status: 400 });
    }
    oldValues.sortOrder = priceTier.sortOrder;
    newValues.sortOrder = so;
    updates.sortOrder = so;
  }

  // Aliquota IVA: settabile o azzerabile (null/""). Azzerarla su una fascia
  // attiva di un venue col fiscale acceso è impedito: romperebbe l'emissione.
  if (body.vatRate !== undefined) {
    let vatRateDecimal: Decimal | null = null;
    if (body.vatRate !== null && body.vatRate !== "") {
      try {
        vatRateDecimal = new Decimal(String(body.vatRate));
        if (vatRateDecimal.lt(0) || vatRateDecimal.gt(99.99)) throw new Error();
      } catch {
        return NextResponse.json({ ok: false, error: "vatRate deve essere una percentuale tra 0 e 99.99" }, { status: 400 });
      }
    }
    if (vatRateDecimal === null && priceTier.active) {
      const venue = await db.venue.findUnique({
        where: { id: session.venueId },
        select: { fiscalEnabled: true },
      });
      if (venue?.fiscalEnabled) {
        return NextResponse.json(
          { ok: false, error: "Il modulo fiscale è attivo: ogni fascia attiva deve avere un'aliquota IVA" },
          { status: 400 }
        );
      }
    }
    oldValues.vatRate = priceTier.vatRate?.toString() ?? null;
    newValues.vatRate = vatRateDecimal?.toString() ?? null;
    updates.vatRate = vatRateDecimal;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: "Nessun campo da aggiornare" }, { status: 400 });
  }

  await db.priceTier.update({ where: { id: tierId }, data: updates });

  await logManagerAction({
    operatorId: session.operatorId,
    action: "PRICE_TIER_UPDATED",
    targetType: "PriceTier",
    targetId: tierId,
    payload: { old: oldValues, new: newValues },
  });

  return NextResponse.json({ ok: true });
}
