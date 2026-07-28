import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { orgScopeWhere } from "@/lib/auth/org-scope";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseTierCreateInput } from "@/lib/price-tiers/validation";
import { Prisma } from "@prisma/client";

// Listino del venue lato superadmin: stesse regole del percorso manager
// (validazione condivisa in @/lib/price-tiers/validation), scoping per
// organizzazione (ORG_ADMIN solo sui propri venue, PLATFORM su tutti).
// Le fasce non si eliminano mai fisicamente: solo disattivazione.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;
  const venue = await db.venue.findFirst({
    where: { id, ...orgScopeWhere(session).venue },
    select: {
      id: true,
      priceTiers: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
    },
  });
  if (!venue) {
    return NextResponse.json({ ok: false, error: "Venue non trovata" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    data: venue.priceTiers.map((tier) => ({
      id: tier.id,
      name: tier.name,
      price: tier.price.toString(),
      sortOrder: tier.sortOrder,
      active: tier.active,
      vatRate: tier.vatRate?.toString() ?? null,
    })),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;
  const venue = await db.venue.findFirst({
    where: { id, ...orgScopeWhere(session).venue },
    select: { id: true, organizationId: true },
  });
  if (!venue) {
    return NextResponse.json({ ok: false, error: "Venue non trovata" }, { status: 404 });
  }

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
      data: { venueId: venue.id, ...parsed.data },
    });

    await logAdminAction({
      adminUserId: session.adminUserId,
      organizationId: venue.organizationId,
      action: "PRICE_TIER_CREATED",
      targetType: "PriceTier",
      targetId: priceTier.id,
      payload: {
        venueId: venue.id,
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
