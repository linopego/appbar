import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe/client";

// Crea (una sola volta) il connected account Stripe Express per l'organizzazione.
// Solo admin PLATFORM: è un'operazione di onboarding della piattaforma.
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

  // Idempotente: se l'account esiste già non ne creiamo un altro
  if (organization.stripeAccountId) {
    return NextResponse.json({
      ok: true,
      data: { stripeAccountId: organization.stripeAccountId, created: false },
    });
  }

  const account = await stripe.accounts.create({
    type: "express",
    country: "IT",
    metadata: { organizationId: organization.id },
    business_profile: { name: organization.name },
  });

  await db.organization.update({
    where: { id: organization.id },
    data: { stripeAccountId: account.id },
  });

  await logAdminAction({
    adminUserId: session.adminUserId,
    organizationId: organization.id,
    action: "ORG_STRIPE_ACCOUNT_CREATED",
    targetType: "Organization",
    targetId: organization.id,
    payload: { stripeAccountId: account.id },
  });

  return NextResponse.json(
    { ok: true, data: { stripeAccountId: account.id, created: true } },
    { status: 201 }
  );
}
