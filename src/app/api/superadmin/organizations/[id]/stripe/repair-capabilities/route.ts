import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe/client";

// Riparazione una tantum: gli account Express creati prima del fix non hanno
// le capabilities card_payments/transfers richieste, quindi Stripe rifiuta le
// direct charge. Qui le richiediamo sull'account esistente. Solo PLATFORM.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  if (session.role !== "PLATFORM") {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 403 });
  }

  const { id } = await params;
  const organization = await db.organization.findUnique({ where: { id } });
  if (!organization) {
    return NextResponse.json({ ok: false, error: "Organizzazione non trovata" }, { status: 404 });
  }
  if (!organization.stripeAccountId) {
    return NextResponse.json(
      { ok: false, error: "Nessun account Stripe da riparare: crealo prima" },
      { status: 400 }
    );
  }

  const account = await stripe.accounts.update(organization.stripeAccountId, {
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  // Riallinea subito i flag locali allo stato reale (senza aspettare il
  // webhook account.updated, che resta la fonte di verità continuativa)
  await db.organization.update({
    where: { id: organization.id },
    data: {
      stripeChargesEnabled: account.charges_enabled === true,
      stripeDetailsSubmitted: account.details_submitted === true,
    },
  });

  const capabilities = {
    cardPayments: account.capabilities?.card_payments ?? null,
    transfers: account.capabilities?.transfers ?? null,
  };

  await logAdminAction({
    adminUserId: session.adminUserId,
    organizationId: organization.id,
    action: "ORG_STRIPE_CAPABILITIES_REPAIRED",
    targetType: "Organization",
    targetId: organization.id,
    payload: { stripeAccountId: organization.stripeAccountId, capabilities },
  });

  return NextResponse.json({
    ok: true,
    data: {
      capabilities,
      chargesEnabled: account.charges_enabled === true,
    },
  });
}
