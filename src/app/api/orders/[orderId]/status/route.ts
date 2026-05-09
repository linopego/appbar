import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Devi essere autenticato." } },
      { status: 401 }
    );
  }

  const { orderId } = await params;

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerId: true, status: true },
  });

  if (!order || order.customerId !== session.user.id) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Ordine non trovato." } },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, status: order.status });
}
