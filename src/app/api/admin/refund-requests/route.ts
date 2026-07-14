import { NextRequest, NextResponse } from "next/server";
import { getAdminOrManagerSession } from "@/lib/auth/admin-or-manager";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getAdminOrManagerSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Non autenticato" }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "PENDING";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const pageSize = 20;

  // Managers can only see their venue's refunds
  const venueFilter =
    session.kind === "manager" ? { venueId: session.session.venueId } : {};

  const [refunds, total] = await Promise.all([
    db.refund.findMany({
      where: {
        status: status as "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED",
        order: venueFilter,
      },
      include: {
        order: {
          include: {
            customer: { select: { id: true, email: true, firstName: true, lastName: true } },
            venue: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: { requestedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.refund.count({
      where: {
        status: status as "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED",
        order: venueFilter,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    data: { refunds, total, page, pageSize },
  });
}
