import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { updateOrganizationSchema } from "@/lib/validators/organization";
import { getOrgStats } from "@/lib/organizations/stats";

async function requirePlatform() {
  const session = await requireAdmin().catch(() => null);
  if (!session) return { error: NextResponse.json({ ok: false, error: "Non autenticato" }, { status: 401 }) };
  if (session.role !== "PLATFORM") {
    return { error: NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatform();
  if (auth.error) return auth.error;

  const { id } = await params;
  const organization = await db.organization.findUnique({
    where: { id },
    include: {
      venues: {
        select: { id: true, name: true, slug: true, active: true },
        orderBy: { name: "asc" },
      },
      adminUsers: {
        select: { id: true, email: true, name: true, role: true, active: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!organization) {
    return NextResponse.json({ ok: false, error: "Organizzazione non trovata" }, { status: 404 });
  }

  const now = new Date();
  const [stats7, stats30, stats90] = await Promise.all([
    getOrgStats(id, 7, now),
    getOrgStats(id, 30, now),
    getOrgStats(id, 90, now),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      id: organization.id,
      name: organization.name,
      feePercent: organization.feePercent.toFixed(2),
      stripeAccountId: organization.stripeAccountId,
      stripeChargesEnabled: organization.stripeChargesEnabled,
      stripeDetailsSubmitted: organization.stripeDetailsSubmitted,
      active: organization.active,
      createdAt: organization.createdAt.toISOString(),
      venues: organization.venues,
      adminUsers: organization.adminUsers,
      kpi: {
        d7: { gmv: stats7.gmv.toString(), fees: stats7.fees.toString() },
        d30: { gmv: stats30.gmv.toString(), fees: stats30.fees.toString() },
        d90: { gmv: stats90.gmv.toString(), fees: stats90.fees.toString() },
      },
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatform();
  if (auth.error) return auth.error;
  const session = auth.session;

  const { id } = await params;
  const organization = await db.organization.findUnique({ where: { id } });
  if (!organization) {
    return NextResponse.json({ ok: false, error: "Organizzazione non trovata" }, { status: 404 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const parsed = updateOrganizationSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" },
      { status: 400 }
    );
  }
  const { name, feePercent } = parsed.data;

  await db.organization.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(feePercent !== undefined ? { feePercent } : {}),
    },
  });

  // La fee vale SOLO per gli ordini futuri (snapshot platformFeeAmount su
  // Order): l'audit registra prima/dopo per la tracciabilità delle condizioni.
  await logAdminAction({
    adminUserId: session.adminUserId,
    organizationId: id,
    action: "ORG_UPDATED",
    targetType: "Organization",
    targetId: id,
    payload: {
      before: { name: organization.name, feePercent: organization.feePercent.toFixed(2) },
      after: {
        name: name ?? organization.name,
        feePercent: feePercent ?? organization.feePercent.toFixed(2),
      },
    },
  });

  return NextResponse.json({ ok: true });
}
