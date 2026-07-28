import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { orgScopeWhere } from "@/lib/auth/org-scope";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  parseTierUpdateInput,
  tierAuditDiff,
  VAT_REQUIRED_ON_UPDATE_ERROR,
} from "@/lib/price-tiers/validation";
import { Prisma } from "@prisma/client";

// Modifica fascia lato superadmin: stessa validazione del percorso manager,
// scoping per organizzazione. Gli snapshot su OrderItem/FiscalDocument non
// vengono MAI toccati: la modifica vale solo per gli acquisti futuri.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tierId: string }> }
) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const { tierId } = await params;

  const priceTier = await db.priceTier.findFirst({
    where: { id: tierId, venue: orgScopeWhere(session).venue },
    include: { venue: { select: { organizationId: true, fiscalEnabled: true } } },
  });
  if (!priceTier) {
    // Fuori scope = inesistente: nessun oracolo sull'esistenza di tier altrui
    return NextResponse.json({ ok: false, error: "PriceTier non trovato" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const parsed = parseTierUpdateInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const updates = parsed.data;

  // Guardia fiscale: niente rimozione aliquota su fascia attiva con
  // emissione attiva
  if (updates.vatRate === null && priceTier.active && priceTier.venue.fiscalEnabled) {
    return NextResponse.json({ ok: false, error: VAT_REQUIRED_ON_UPDATE_ERROR }, { status: 400 });
  }

  try {
    await db.priceTier.update({ where: { id: tierId }, data: updates });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, error: { code: "NAME_EXISTS" } }, { status: 409 });
    }
    throw err;
  }

  await logAdminAction({
    adminUserId: session.adminUserId,
    organizationId: priceTier.venue.organizationId,
    action: "PRICE_TIER_UPDATED",
    targetType: "PriceTier",
    targetId: tierId,
    payload: tierAuditDiff(priceTier, updates),
  });

  return NextResponse.json({ ok: true });
}
