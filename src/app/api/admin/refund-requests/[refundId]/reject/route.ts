import { NextRequest, NextResponse } from "next/server";
import { getAdminOrManagerSession } from "@/lib/auth/admin-or-manager";
import { db } from "@/lib/db";
import { sendRefundRejectedEmail } from "@/lib/email/refund-emails";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ refundId: string }> }
) {
  const session = await getAdminOrManagerSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Non autenticato" }, { status: 401 });
  }

  const { refundId } = await params;
  let body: { managerNote?: string } = {};
  try { body = await req.json(); } catch { /* no body is fine */ }

  const managerNote = (body.managerNote ?? "").trim();
  if (!managerNote || managerNote.length < 5) {
    return NextResponse.json(
      { ok: false, error: { code: "NOTE_REQUIRED", message: "La motivazione del rifiuto è obbligatoria (min 5 caratteri)" } },
      { status: 400 }
    );
  }

  const refund = await db.refund.findUnique({
    where: { id: refundId },
    include: {
      order: {
        include: {
          customer: true,
          venue: true,
        },
      },
    },
  });

  if (!refund) {
    return NextResponse.json({ ok: false, error: "Rimborso non trovato" }, { status: 404 });
  }

  if (session.kind === "manager" && refund.order.venueId !== session.session.venueId) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 403 });
  }

  const processedBy =
    session.kind === "admin" ? session.session.adminUserId : session.session.operatorId;
  const processedByType =
    session.kind === "admin" ? "ADMIN_USER" : "OPERATOR";
  const now = new Date();

  // Claim atomico: rifiutabile da PENDING o FAILED (un refund con Stripe in
  // errore può essere chiuso con un rifiuto). Due rifiuti concorrenti: solo il
  // primo passa, il secondo riceve 422.
  const rejected = await db.$transaction(async (tx) => {
    const claimed = await tx.refund.updateMany({
      where: { id: refund.id, status: { in: ["PENDING", "FAILED"] } },
      data: {
        status: "REJECTED",
        managerNote,
        processedAt: now,
        processedBy,
        processedByType,
      },
    });
    if (claimed.count !== 1) return false;

    // Audit SEMPRE, qualunque sia l'attore (super-admin o manager).
    await tx.adminAuditLog.create({
      data: {
        actorType: processedByType,
        ...(session.kind === "admin"
          ? { adminUserId: session.session.adminUserId }
          : { operatorId: session.session.operatorId }),
        action: "REFUND_REJECTED",
        targetType: "Refund",
        targetId: refund.id,
        payload: {
          amount: refund.amount.toString(),
          ticketIds: refund.ticketIds,
          orderId: refund.order.id,
          managerNote,
        },
      },
    });
    return true;
  });

  if (!rejected) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_STATE", message: "Il rimborso non è più rifiutabile (già processato o in lavorazione)" } },
      { status: 422 }
    );
  }

  const customerEmail = refund.order.customer.email;
  if (customerEmail) {
    void sendRefundRejectedEmail({
      customerEmail,
      customerName: refund.order.customer.firstName ?? customerEmail,
      venueName: refund.order.venue.name,
      refundId: refund.id,
      amount: refund.amount.toString(),
      ticketCount: (refund.ticketIds as string[]).length,
      managerNote,
    }).catch(console.error);
  }

  return NextResponse.json({ ok: true });
}
