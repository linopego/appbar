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

  let body: { name?: unknown; price?: unknown; sortOrder?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const updates: { name?: string; price?: Decimal; sortOrder?: number } = {};
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
