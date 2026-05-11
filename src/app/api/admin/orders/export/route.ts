import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/auth/staff";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const STATUS_LABELS: Record<string, string> = {
  PAID: "Pagato",
  REFUNDED: "Rimborsato",
  PARTIALLY_REFUNDED: "Parz. rimborsato",
  FAILED: "Fallito",
  PENDING: "Pendente",
};

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
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const emailParam = url.searchParams.get("email");

  const where: Prisma.OrderWhereInput = { venueId: session.venueId };

  if (statusParam) {
    where.status = statusParam as Prisma.EnumOrderStatusFilter;
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

  const orders = await db.order.findMany({
    where,
    include: {
      customer: { select: { email: true } },
      _count: { select: { tickets: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const lines: string[] = ["Data,Cliente,Ticket,Totale,Status"];

  for (const order of orders) {
    const date = formatDate(order.paidAt ?? order.createdAt);
    const customerEmail = order.customer.email ?? "";
    const ticketCount = String(order._count.tickets);
    const total = order.totalAmount.toString();
    const statusLabel = STATUS_LABELS[order.status] ?? order.status;

    lines.push(
      [date, csvEscape(customerEmail), ticketCount, total, csvEscape(statusLabel)].join(",")
    );
  }

  const csv = lines.join("\r\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-export.csv"`,
    },
  });
}
