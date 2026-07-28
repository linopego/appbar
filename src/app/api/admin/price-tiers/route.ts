import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/auth/staff";
import { logManagerAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseTierCreateInput } from "@/lib/price-tiers/validation";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const parsed = parseTierCreateInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  try {
    const priceTier = await db.priceTier.create({
      data: { venueId: session.venueId, ...parsed.data },
    });

    await logManagerAction({
      operatorId: session.operatorId,
      action: "PRICE_TIER_CREATED",
      targetType: "PriceTier",
      targetId: priceTier.id,
      payload: {
        name: priceTier.name,
        price: parsed.data.price.toString(),
        sortOrder: priceTier.sortOrder,
        active: priceTier.active,
        vatRate: parsed.data.vatRate?.toString() ?? null,
      },
    });

    return NextResponse.json({ ok: true, data: { id: priceTier.id } }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, error: { code: "NAME_EXISTS" } }, { status: 409 });
    }
    throw err;
  }
}
