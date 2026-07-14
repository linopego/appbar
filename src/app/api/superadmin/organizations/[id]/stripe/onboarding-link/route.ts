import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe/client";

// Genera un Account Link per completare (o riprendere) l'onboarding Express
// del connected account dell'organizzazione. Solo admin PLATFORM.
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
      {
        ok: false,
        error: {
          code: "NO_STRIPE_ACCOUNT",
          message: "Crea prima il connected account Stripe per questa organizzazione.",
        },
      },
      { status: 422 }
    );
  }

  const appUrl =
    process.env["NEXT_PUBLIC_APP_URL"] ?? process.env["NEXTAUTH_URL"] ?? "http://localhost:3000";
  const backUrl = `${appUrl}/superadmin/organizations/${organization.id}`;

  const accountLink = await stripe.accountLinks.create({
    account: organization.stripeAccountId,
    refresh_url: backUrl,
    return_url: backUrl,
    type: "account_onboarding",
  });

  await logAdminAction({
    adminUserId: session.adminUserId,
    organizationId: organization.id,
    action: "ORG_STRIPE_ONBOARDING_LINK_CREATED",
    targetType: "Organization",
    targetId: organization.id,
    payload: { stripeAccountId: organization.stripeAccountId },
  });

  return NextResponse.json({ ok: true, data: { url: accountLink.url } });
}
