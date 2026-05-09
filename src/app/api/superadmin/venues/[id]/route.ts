import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;

  const [venue, orderCount, totalRevenue, ticketCount] = await Promise.all([
    db.venue.findUnique({
      where: { id },
      include: {
        operators: { select: { id: true, name: true, role: true, active: true } },
        priceTiers: { orderBy: { sortOrder: "asc" } },
      },
    }),
    db.order.count({ where: { venueId: id, status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } } }),
    db.order.aggregate({
      where: { venueId: id, status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } },
      _sum: { totalAmount: true },
    }),
    db.ticket.count({ where: { venueId: id } }),
  ]);

  if (!venue) {
    return NextResponse.json({ ok: false, error: "Venue non trovata" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      ...venue,
      stats: {
        orderCount,
        totalRevenue: totalRevenue._sum.totalAmount ?? 0,
        ticketCount,
      },
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;

  const venue = await db.venue.findUnique({ where: { id } });
  if (!venue) {
    return NextResponse.json({ ok: false, error: "Venue non trovata" }, { status: 404 });
  }

  let body: { name?: unknown; slug?: unknown; timezone?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const updates: { name?: string; slug?: string; refundBlockedTimezone?: string } = {};
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim() === "") {
      return NextResponse.json({ ok: false, error: "name non valido" }, { status: 400 });
    }
    oldValues.name = venue.name;
    newValues.name = body.name.trim();
    updates.name = body.name.trim();
  }

  if (body.slug !== undefined) {
    if (typeof body.slug !== "string" || !/^[a-z0-9-]+$/.test(body.slug)) {
      return NextResponse.json({ ok: false, error: "slug non valido" }, { status: 400 });
    }
    if (body.slug !== venue.slug) {
      const existing = await db.venue.findUnique({ where: { slug: body.slug } });
      if (existing) {
        return NextResponse.json({ ok: false, error: { code: "SLUG_EXISTS" } }, { status: 409 });
      }
    }
    oldValues.slug = venue.slug;
    newValues.slug = body.slug;
    updates.slug = body.slug;
  }

  if (body.timezone !== undefined) {
    if (typeof body.timezone !== "string") {
      return NextResponse.json({ ok: false, error: "timezone non valido" }, { status: 400 });
    }
    oldValues.timezone = venue.refundBlockedTimezone;
    newValues.timezone = body.timezone.trim() || null;
    updates.refundBlockedTimezone = body.timezone.trim() || undefined;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: "Nessun campo da aggiornare" }, { status: 400 });
  }

  try {
    const updated = await db.venue.update({ where: { id }, data: updates });

    await logAdminAction({
      adminUserId: session.adminUserId,
      action: "VENUE_UPDATED",
      targetType: "Venue",
      targetId: id,
      payload: { old: oldValues, new: newValues },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, error: { code: "SLUG_EXISTS" } }, { status: 409 });
    }
    throw err;
  }
}
