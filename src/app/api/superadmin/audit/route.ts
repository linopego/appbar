import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const url = req.nextUrl;
  const actorType = url.searchParams.get("actorType");
  const actorId = url.searchParams.get("actorId");
  const action = url.searchParams.get("action");
  const targetType = url.searchParams.get("targetType");
  const targetId = url.searchParams.get("targetId");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));

  const where: Prisma.AdminAuditLogWhereInput = {};

  if (actorType && actorType !== "all") {
    where.actorType = actorType as Prisma.EnumActorTypeFilter;
  }

  if (actorId) {
    // actorId could be adminUserId or operatorId
    where.OR = [{ adminUserId: actorId }, { operatorId: actorId }];
  }

  if (action) {
    where.action = { contains: action, mode: "insensitive" };
  }

  if (targetType) {
    where.targetType = targetType;
  }

  if (targetId) {
    where.targetId = targetId;
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

  const [logs, total] = await Promise.all([
    db.adminAuditLog.findMany({
      where,
      include: {
        adminUser: { select: { id: true, name: true, email: true } },
        operator: {
          select: {
            id: true,
            name: true,
            venue: { select: { name: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.adminAuditLog.count({ where }),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      logs,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    },
  });
}
