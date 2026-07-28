import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/auth/staff";
import { logManagerAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  let body: { name?: unknown; price?: unknown; sortOrder?: unknown; active?: unknown; vatRate?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const { name, price, sortOrder, active } = body;

  if (typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ ok: false, error: "name è obbligatorio" }, { status: 400 });
  }
  if (typeof price !== "string" && typeof price !== "number") {
    return NextResponse.json({ ok: false, error: "price non valido" }, { status: 400 });
  }

  let priceDecimal: Decimal;
  try {
    priceDecimal = new Decimal(String(price));
    if (priceDecimal.lte(0)) throw new Error();
  } catch {
    return NextResponse.json({ ok: false, error: "price deve essere un decimale > 0" }, { status: 400 });
  }

  if (sortOrder !== undefined) {
    const so = Number(sortOrder);
    if (!Number.isInteger(so) || so < 0) {
      return NextResponse.json({ ok: false, error: "sortOrder deve essere un intero >= 0" }, { status: 400 });
    }
  }

  // Aliquota IVA opzionale (richiesta solo per attivare il modulo fiscale)
  let vatRateDecimal: Decimal | null = null;
  if (body.vatRate !== undefined && body.vatRate !== null && body.vatRate !== "") {
    try {
      vatRateDecimal = new Decimal(String(body.vatRate));
      if (vatRateDecimal.lt(0) || vatRateDecimal.gt(99.99)) throw new Error();
    } catch {
      return NextResponse.json({ ok: false, error: "vatRate deve essere una percentuale tra 0 e 99.99" }, { status: 400 });
    }
  }

  try {
    const priceTier = await db.priceTier.create({
      data: {
        venueId: session.venueId,
        name: name.trim(),
        price: priceDecimal,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : 100,
        active: active !== undefined ? Boolean(active) : true,
        vatRate: vatRateDecimal,
      },
    });

    await logManagerAction({
      operatorId: session.operatorId,
      action: "PRICE_TIER_CREATED",
      targetType: "PriceTier",
      targetId: priceTier.id,
      payload: { name: priceTier.name, price: priceDecimal.toString(), sortOrder: priceTier.sortOrder, active: priceTier.active, vatRate: vatRateDecimal?.toString() ?? null },
    });

    return NextResponse.json({ ok: true, data: { id: priceTier.id } }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, error: { code: "NAME_EXISTS" } }, { status: 409 });
    }
    throw err;
  }
}
