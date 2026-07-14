import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { createOrganizationSchema } from "@/lib/validators/organization";
import { getAllOrgStats30d } from "@/lib/organizations/stats";

// Gestione organizzazioni: riservata agli admin di piattaforma.
async function requirePlatform() {
  const session = await requireAdmin().catch(() => null);
  if (!session) return { error: NextResponse.json({ ok: false, error: "Non autenticato" }, { status: 401 }) };
  if (session.role !== "PLATFORM") {
    return { error: NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const auth = await requirePlatform();
  if (auth.error) return auth.error;

  const [organizations, stats] = await Promise.all([
    db.organization.findMany({
      include: { _count: { select: { venues: true } } },
      orderBy: { createdAt: "asc" },
    }),
    getAllOrgStats30d(new Date()),
  ]);

  return NextResponse.json({
    ok: true,
    data: organizations.map((org) => ({
      id: org.id,
      name: org.name,
      feePercent: org.feePercent.toFixed(2),
      stripeAccountId: org.stripeAccountId,
      stripeChargesEnabled: org.stripeChargesEnabled,
      stripeDetailsSubmitted: org.stripeDetailsSubmitted,
      active: org.active,
      venueCount: org._count.venues,
      gmv30d: (stats.get(org.id)?.gmv ?? 0).toString(),
      fees30d: (stats.get(org.id)?.fees ?? 0).toString(),
      createdAt: org.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requirePlatform();
  if (auth.error) return auth.error;
  const session = auth.session;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const parsed = createOrganizationSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" },
      { status: 400 }
    );
  }
  const { name, feePercent } = parsed.data;

  const organization = await db.organization.create({
    data: { name, feePercent, active: true },
  });

  await logAdminAction({
    adminUserId: session.adminUserId,
    organizationId: organization.id,
    action: "ORG_CREATED",
    targetType: "Organization",
    targetId: organization.id,
    payload: { name, feePercent },
  });

  return NextResponse.json(
    { ok: true, data: { id: organization.id } },
    { status: 201 }
  );
}
