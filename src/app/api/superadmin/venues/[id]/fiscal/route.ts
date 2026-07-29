import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { orgScopeWhere } from "@/lib/auth/org-scope";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { isFiscalModuleConfigured } from "@/lib/fiscal/config";
import { canEnableFiscal } from "@/lib/fiscal/emit";

// Toggle emissione fiscale lato superadmin: STESSE precondizioni del
// percorso responsabile (modulo configurato + canEnableFiscal), scoping per
// organizzazione, stesse action string per un audit uniforme.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;
  const venue = await db.venue.findFirst({
    where: { id, ...orgScopeWhere(session).venue },
    select: {
      id: true,
      organizationId: true,
      fiscalConfig: true,
      priceTiers: { where: { active: true }, select: { name: true, vatRate: true } },
    },
  });
  if (!venue) {
    return NextResponse.json({ ok: false, error: "Venue non trovata" }, { status: 404 });
  }

  let body: { enabled?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ ok: false, error: "enabled deve essere true o false" }, { status: 400 });
  }

  if (body.enabled) {
    if (!isFiscalModuleConfigured()) {
      return NextResponse.json(
        { ok: false, error: "Modulo fiscale non configurato a livello piattaforma" },
        { status: 400 }
      );
    }
    const gate = canEnableFiscal(venue.priceTiers, venue.fiscalConfig);
    if (!gate.ok) {
      return NextResponse.json({ ok: false, error: gate.reason }, { status: 400 });
    }
  }

  await db.venue.update({ where: { id: venue.id }, data: { fiscalEnabled: body.enabled } });

  await logAdminAction({
    adminUserId: session.adminUserId,
    organizationId: venue.organizationId,
    action: body.enabled ? "VENUE_FISCAL_ENABLED" : "VENUE_FISCAL_DISABLED",
    targetType: "Venue",
    targetId: venue.id,
    payload: { fiscalEnabled: body.enabled },
  });

  return NextResponse.json({ ok: true, data: { fiscalEnabled: body.enabled } });
}
