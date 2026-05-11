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
  const emailParam = url.searchParams.get("email");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));

  const where: Prisma.OrderWhereInput = {};

  if (statusParam) {
    where.status = statusParam as Prisma.EnumOrderStatusFilter;
  }
  if (venueId) {
    where.venueId = venueId;
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

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      include: {
        customer: { select: { email: true, firstName: true, lastName: true } },
        venue: { select: { name: true } },
        _count: { select: { tickets: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.order.count({ where }),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      orders,
      total,
      page,
      totalPages: Math.ceil(total / PAGE_SIZE),
    },
  });
}
