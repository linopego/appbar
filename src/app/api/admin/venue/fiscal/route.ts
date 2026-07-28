import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/auth/staff";
import { logManagerAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { isFiscalModuleConfigured } from "@/lib/fiscal/config";
import { canEnableFiscal } from "@/lib/fiscal/emit";

// Attiva/disattiva l'emissione automatica del documento commerciale per il
// venue. L'attivazione è consentita SOLO se: modulo configurato a livello
// piattaforma, aliquota IVA su tutte le fasce attive, fiscalConfig presente
// (a cura della piattaforma). La disattivazione è sempre consentita.
export async function PATCH(req: NextRequest) {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

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

    const venue = await db.venue.findUnique({
      where: { id: session.venueId },
      select: {
        fiscalConfig: true,
        priceTiers: { where: { active: true }, select: { name: true, vatRate: true } },
      },
    });
    if (!venue) {
      return NextResponse.json({ ok: false, error: "Venue non trovata" }, { status: 404 });
    }

    const gate = canEnableFiscal(venue.priceTiers, venue.fiscalConfig);
    if (!gate.ok) {
      return NextResponse.json({ ok: false, error: gate.reason }, { status: 400 });
    }
  }

  await db.venue.update({
    where: { id: session.venueId },
    data: { fiscalEnabled: body.enabled },
  });

  await logManagerAction({
    operatorId: session.operatorId,
    action: body.enabled ? "VENUE_FISCAL_ENABLED" : "VENUE_FISCAL_DISABLED",
    targetType: "Venue",
    targetId: session.venueId,
    payload: { fiscalEnabled: body.enabled },
  });

  return NextResponse.json({ ok: true, data: { fiscalEnabled: body.enabled } });
}
