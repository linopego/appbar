import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { encryptFiscalSecrets } from "@/lib/fiscal/crypto";
import type { FiscalVenueConfig } from "@/lib/fiscal/types";

// Configurazione fiscale dell'esercente (riferimenti presso il provider).
// SOLO PLATFORM admin: gli ORG_ADMIN e i manager vedono solo lo stato.
// Gli eventuali segreti arrivano in chiaro nel body ma vengono salvati SOLO
// cifrati (AES-256-GCM) dentro fiscalConfig.encryptedSecrets: mai plaintext
// nel DB, mai riletti in chiaro da questa API.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  if (session.role !== "PLATFORM") {
    return NextResponse.json({ ok: false, error: "Riservato all'amministratore di piattaforma" }, { status: 403 });
  }

  const { id } = await params;
  const venue = await db.venue.findUnique({
    where: { id },
    select: { id: true, organizationId: true, fiscalConfig: true, fiscalEnabled: true },
  });
  if (!venue) {
    return NextResponse.json({ ok: false, error: "Venue non trovata" }, { status: 404 });
  }

  let body: { fiscalId?: unknown; configurationId?: unknown; secrets?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  if (typeof body.fiscalId !== "string" || body.fiscalId.trim() === "") {
    return NextResponse.json({ ok: false, error: "fiscalId è obbligatorio" }, { status: 400 });
  }
  if (
    body.configurationId !== undefined &&
    body.configurationId !== null &&
    typeof body.configurationId !== "string"
  ) {
    return NextResponse.json({ ok: false, error: "configurationId non valido" }, { status: 400 });
  }
  if (body.secrets !== undefined && body.secrets !== null) {
    if (typeof body.secrets !== "object" || Array.isArray(body.secrets)) {
      return NextResponse.json({ ok: false, error: "secrets deve essere un oggetto JSON" }, { status: 400 });
    }
  }

  const existing = (venue.fiscalConfig ?? {}) as FiscalVenueConfig;

  // secrets assente → conserva i segreti cifrati esistenti;
  // secrets = {}   → li rimuove; secrets = {...} → li sostituisce (cifrati).
  let encryptedSecrets = existing.encryptedSecrets;
  if (body.secrets !== undefined && body.secrets !== null) {
    const secrets = body.secrets as Record<string, unknown>;
    if (Object.keys(secrets).length === 0) {
      encryptedSecrets = undefined;
    } else {
      try {
        encryptedSecrets = encryptFiscalSecrets(secrets);
      } catch {
        return NextResponse.json(
          { ok: false, error: "FISCAL_CONFIG_ENCRYPTION_KEY non configurata: impossibile cifrare i segreti" },
          { status: 400 }
        );
      }
    }
  }

  const configurationId =
    typeof body.configurationId === "string" && body.configurationId.trim() !== ""
      ? body.configurationId.trim()
      : undefined;

  const fiscalConfig: FiscalVenueConfig = {
    fiscalId: body.fiscalId.trim(),
    ...(configurationId ? { configurationId } : {}),
    ...(encryptedSecrets ? { encryptedSecrets } : {}),
  };

  await db.venue.update({
    where: { id },
    data: { fiscalConfig: fiscalConfig as object },
  });

  // MAI segreti nel payload dell'audit, nemmeno cifrati
  await logAdminAction({
    adminUserId: session.adminUserId,
    organizationId: venue.organizationId,
    action: "VENUE_FISCAL_CONFIG_UPDATED",
    targetType: "Venue",
    targetId: id,
    payload: {
      fiscalId: fiscalConfig.fiscalId,
      configurationId: configurationId ?? null,
      hasSecrets: Boolean(encryptedSecrets),
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      fiscalId: fiscalConfig.fiscalId,
      configurationId: configurationId ?? null,
      hasSecrets: Boolean(encryptedSecrets),
    },
  });
}
