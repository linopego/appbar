import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { registerVenueMerchant } from "@/lib/fiscal/emit";

// Censimento dell'esercente presso il provider fiscale (POST
// /IT-configurations). SOLO PLATFORM, come ogni modifica di fiscalConfig:
// la registrazione scrive l'id configurazione dentro fiscalConfig.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  if (session.role !== "PLATFORM") {
    return NextResponse.json(
      { ok: false, error: "Riservato all'amministratore di piattaforma" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const venue = await db.venue.findUnique({
    where: { id },
    select: { id: true, organizationId: true },
  });
  if (!venue) {
    return NextResponse.json({ ok: false, error: "Venue non trovata" }, { status: 404 });
  }

  const result = await registerVenueMerchant(venue.id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  await logAdminAction({
    adminUserId: session.adminUserId,
    organizationId: venue.organizationId,
    action: "VENUE_FISCAL_MERCHANT_REGISTERED",
    targetType: "Venue",
    targetId: venue.id,
    payload: { providerConfigurationId: result.providerConfigurationId },
  });

  return NextResponse.json({
    ok: true,
    data: { providerConfigurationId: result.providerConfigurationId },
  });
}
