import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Diritto all'oblio (GDPR): ANONIMIZZAZIONE, non delete fisico. Ordini,
// transazioni, rimborsi e audit restano intatti (obblighi contabili), ma
// senza più PII collegata. I ticket ancora attivi vengono annullati (VOIDED)
// senza rimborso, come dichiarato nella doppia conferma e nei Termini (§9).
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }
  const customerId = session.user.id;

  // Richieste di rimborso in corso: la cancellazione va rimandata
  const pendingRefunds = await db.refund.count({
    where: { status: { in: ["PENDING", "PROCESSING"] }, order: { customerId } },
  });
  if (pendingRefunds > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "PENDING_REFUNDS",
          message:
            "Hai richieste di rimborso in corso: attendi che vengano gestite (o ritirale) prima di eliminare l'account.",
        },
      },
      { status: 409 }
    );
  }

  const result = await db.$transaction(async (tx) => {
    const voided = await tx.ticket.updateMany({
      where: { customerId, status: "ACTIVE" },
      data: { status: "VOIDED" },
    });

    await tx.customer.update({
      where: { id: customerId },
      data: {
        email: `deleted-${customerId}@klink.invalid`,
        emailVerified: null,
        firstName: null,
        lastName: null,
        image: null,
        phone: null,
      },
    });

    // Via credenziali e sessioni: l'account non è più accessibile
    await tx.customerAccount.deleteMany({ where: { customerId } });
    await tx.customerSession.deleteMany({ where: { customerId } });

    await tx.adminAuditLog.create({
      data: {
        actorType: "SYSTEM",
        action: "CUSTOMER_ACCOUNT_DELETED",
        targetType: "Customer",
        targetId: customerId,
        payload: { selfService: true, voidedTickets: voided.count },
      },
    });

    return { voidedTickets: voided.count };
  });

  return NextResponse.json({ ok: true, data: result });
}
