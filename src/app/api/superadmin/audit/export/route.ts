import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

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

  const where: Prisma.AdminAuditLogWhereInput = {};

  if (actorType && actorType !== "all") {
    where.actorType = actorType as Prisma.EnumActorTypeFilter;
  }

  if (actorId) {
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

  const logs = await db.adminAuditLog.findMany({
    where,
    include: {
      adminUser: { select: { name: true, email: true } },
      operator: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const lines: string[] = ["Data,Tipo,Attore,Azione,Target Type,Target ID,IP"];

  for (const log of logs) {
    const date = formatDate(log.createdAt);
    const tipo = log.actorType;
    let attore = "";
    if (log.adminUser) {
      attore = `${log.adminUser.name} <${log.adminUser.email}>`;
    } else if (log.operator) {
      attore = log.operator.name;
    }
    const azione = log.action;
    const targetTypeVal = log.targetType ?? "";
    const targetIdVal = log.targetId ?? "";
    const ip = log.ipAddress ?? "";

    lines.push(
      [
        csvEscape(date),
        csvEscape(tipo),
        csvEscape(attore),
        csvEscape(azione),
        csvEscape(targetTypeVal),
        csvEscape(targetIdVal),
        csvEscape(ip),
      ].join(",")
    );
  }

  const csv = lines.join("\r\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-export.csv"`,
    },
  });
}
