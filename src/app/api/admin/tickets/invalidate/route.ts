import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/auth/staff";
import { logManagerAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/client";

export async function POST(req: NextRequest) {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  let body: { ticketIds?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const { ticketIds, reason } = body;

  if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
    return NextResponse.json({ ok: false, error: "ticketIds deve essere un array non vuoto" }, { status: 400 });
  }
  if (typeof reason !== "string" || reason.trim().length < 10) {
    return NextResponse.json({ ok: false, error: "reason deve essere almeno 10 caratteri" }, { status: 400 });
  }

  const ids = ticketIds as string[];

  const tickets = await db.ticket.findMany({
    where: { id: { in: ids } },
    include: {
      order: {
        include: { customer: { select: { email: true } } },
      },
    },
  });

  for (const ticket of tickets) {
    if (ticket.venueId !== session.venueId || ticket.status !== "ACTIVE") {
      return NextResponse.json({ ok: false, error: { code: "INVALID_TICKETS" } }, { status: 422 });
    }
  }

  if (tickets.length !== ids.length) {
    return NextResponse.json({ ok: false, error: { code: "INVALID_TICKETS" } }, { status: 422 });
  }

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.ticket.updateMany({
      where: { id: { in: ids } },
      data: { status: "REFUNDED", refundedAt: now },
    });
  });

  await logManagerAction({
    operatorId: session.operatorId,
    action: "TICKETS_INVALIDATED",
    targetType: "Ticket",
    payload: { ticketIds: ids, reason: reason.trim(), count: ids.length },
  });

  const customerEmail = tickets[0]?.order?.customer?.email;
  if (customerEmail) {
    const count = ids.length;
    const html = `<p>Abbiamo invalidato ${count} dei tuoi ticket.</p><p>Motivazione: ${reason.trim()}</p><p>Per chiarimenti, contattaci.</p>`;
    void sendEmail({
      to: customerEmail,
      subject: "Alcuni tuoi ticket sono stati invalidati",
      html,
    }).catch(console.error);
  }

  return NextResponse.json({ ok: true, data: { invalidated: ids.length } });
}
