import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 25;

export async function GET(req: NextRequest) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const url = req.nextUrl;
  const statusParam = url.searchParams.get("status");
  const venueId = url.searchParams.get("venueId");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const consumedFromParam = url.searchParams.get("consumedFrom");
  const consumedToParam = url.searchParams.get("consumedTo");
  const emailParam = url.searchParams.get("email");
  const qrToken = url.searchParams.get("qrToken");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));

  const where: Prisma.TicketWhereInput = {};

  if (statusParam) {
    const statuses = statusParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      where.status = statuses[0] as Prisma.EnumTicketStatusFilter;
    } else if (statuses.length > 1) {
      where.status = { in: statuses as never[] };
    }
  }

  if (venueId) {
    where.venueId = venueId;
  }

  if (qrToken) {
    where.qrToken = qrToken;
  }

  if (emailParam) {
    where.customer = { email: { contains: emailParam, mode: "insensitive" } };
  }

  if (fromParam || toParam) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (fromParam) {
      const d = new Date(fromParam);
      if (!isNaN(d.getTime())) createdAt.gte = d;
    }
    if (toParam) {
      const d = new Date(toParam);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        createdAt.lte = d;
      }
    }
    if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;
  }

  if (consumedFromParam || consumedToParam) {
    const consumedAt: Prisma.DateTimeNullableFilter = {};
    if (consumedFromParam) {
      const d = new Date(consumedFromParam);
      if (!isNaN(d.getTime())) consumedAt.gte = d;
    }
    if (consumedToParam) {
      const d = new Date(consumedToParam);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        consumedAt.lte = d;
      }
    }
    if (Object.keys(consumedAt).length > 0) where.consumedAt = consumedAt;
  }

  const [tickets, total] = await Promise.all([
    db.ticket.findMany({
      where,
      include: {
        priceTier: { select: { name: true, price: true } },
        venue: { select: { name: true } },
        customer: { select: { email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.ticket.count({ where }),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      tickets,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    },
  });
}
