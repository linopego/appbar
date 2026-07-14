import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { orgScopeWhere } from "@/lib/auth/org-scope";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export async function GET() {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const venues = await db.venue.findMany({
    where: orgScopeWhere(session).venue,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { operators: true, orders: true } },
    },
  });

  return NextResponse.json({ ok: true, data: venues });
}

const createVenueSchema = z.object({
  name: z.string().trim().min(1, "name è obbligatorio"),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "slug non valido (solo lettere minuscole, numeri e trattini)"),
  timezone: z.string().trim().min(1).optional(),
  withDefaults: z.boolean().optional(),
  organizationId: z.string().trim().min(1).optional(),
});

export async function POST(req: NextRequest) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const parsed = createVenueSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" },
      { status: 400 }
    );
  }
  const { name, slug, timezone, withDefaults, organizationId: bodyOrgId } = parsed.data;

  // Risoluzione dell'organizzazione proprietaria:
  // - ORG_ADMIN: sempre la propria (il body non può dirottare su altre org)
  // - PLATFORM: quella nel body se indicata, altrimenti l'unica esistente
  let organizationId: string;
  if (session.role === "ORG_ADMIN") {
    if (!session.organizationId) {
      return NextResponse.json({ ok: false, error: "Sessione senza organizzazione" }, { status: 403 });
    }
    organizationId = session.organizationId;
  } else if (bodyOrgId) {
    const org = await db.organization.findUnique({ where: { id: bodyOrgId } });
    if (!org) {
      return NextResponse.json({ ok: false, error: { code: "ORG_NOT_FOUND" } }, { status: 422 });
    }
    organizationId = org.id;
  } else {
    const firstOrg = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
    if (!firstOrg) {
      return NextResponse.json({ ok: false, error: { code: "NO_ORGANIZATION" } }, { status: 422 });
    }
    organizationId = firstOrg.id;
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
        name,
        slug,
        organizationId,
        active: true,
        ...(timezone ? { refundBlockedTimezone: timezone } : {}),
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
    organizationId,
    action: "VENUE_CREATED",
    targetType: "Venue",
    targetId: venue.id,
    payload: { name: venue.name, slug: venue.slug },
  });

  return NextResponse.json({ ok: true, data: { id: venue.id } }, { status: 201 });
}
