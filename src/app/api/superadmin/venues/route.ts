import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(_req: NextRequest) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const venues = await db.venue.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { operators: true, orders: true } },
    },
  });

  return NextResponse.json({ ok: true, data: venues });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  let body: { name?: unknown; slug?: unknown; timezone?: unknown; withDefaults?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const { name, slug, timezone, withDefaults } = body;

  if (typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ ok: false, error: "name è obbligatorio" }, { status: 400 });
  }
  if (typeof slug !== "string" || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ ok: false, error: "slug non valido (solo lettere minuscole, numeri e trattini)" }, { status: 400 });
  }

  const existing = await db.venue.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ ok: false, error: { code: "SLUG_EXISTS" } }, { status: 409 });
  }

  const defaultTiers = [
    { name: "Acqua", price: new Prisma.Decimal("3.00"), sortOrder: 10 },
    { name: "Analcolico", price: new Prisma.Decimal("5.00"), sortOrder: 20 },
    { name: "Birra", price: new Prisma.Decimal("6.00"), sortOrder: 30 },
    { name: "Red Bull", price: new Prisma.Decimal("6.00"), sortOrder: 40 },
    { name: "Drink", price: new Prisma.Decimal("10.00"), sortOrder: 50 },
    { name: "Drink Premium", price: new Prisma.Decimal("12.00"), sortOrder: 60 },
  ];

  const venue = await db.$transaction(async (tx) => {
    const created = await tx.venue.create({
      data: {
        name: name.trim(),
        slug,
        active: true,
        ...(typeof timezone === "string" && timezone.trim() ? { refundBlockedTimezone: timezone.trim() } : {}),
      },
    });

    if (withDefaults === true) {
      await tx.priceTier.createMany({
        data: defaultTiers.map((t) => ({
          venueId: created.id,
          name: t.name,
          price: t.price,
          sortOrder: t.sortOrder,
          active: true,
        })),
      });
    }

    return created;
  });

  await logAdminAction({
    adminUserId: session.adminUserId,
    action: "VENUE_CREATED",
    targetType: "Venue",
    targetId: venue.id,
    payload: { name: venue.name, slug: venue.slug },
  });

  return NextResponse.json({ ok: true, data: { id: venue.id } }, { status: 201 });
}
