import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRateLimit, dataExportLimiter } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Portabilità dei dati (GDPR): JSON con profilo, ordini, ticket e richieste
// di rimborso del SOLO utente autenticato. Rate limit 1/ora.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }
  const customerId = session.user.id;

  const rl = await checkRateLimit(dataExportLimiter, customerId);
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: "Puoi richiedere un export all'ora. Riprova più tardi." },
      { status: 429 }
    );
  }

  const [customer, orders, tickets, refunds] = await Promise.all([
    db.customer.findUnique({
      where: { id: customerId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        image: true,
        createdAt: true,
      },
    }),
    db.order.findMany({
      where: { customerId },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        platformFeeAmount: true,
        createdAt: true,
        paidAt: true,
        tosAcceptedAt: true,
        venue: { select: { name: true } },
        items: { select: { tierName: true, quantity: true, unitPrice: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.ticket.findMany({
      where: { customerId },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        consumedAt: true,
        refundedAt: true,
        createdAt: true,
        venue: { select: { name: true } },
        priceTier: { select: { name: true, price: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.refund.findMany({
      where: { order: { customerId } },
      select: {
        id: true,
        orderId: true,
        amount: true,
        status: true,
        reason: true,
        customerNote: true,
        requestedAt: true,
        processedAt: true,
      },
      orderBy: { requestedAt: "desc" },
    }),
  ]);

  const payload = {
    generatedAt: new Date().toISOString(),
    profile: customer,
    orders,
    tickets,
    refunds,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="klink-dati.json"',
      "Cache-Control": "no-store",
    },
  });
}
