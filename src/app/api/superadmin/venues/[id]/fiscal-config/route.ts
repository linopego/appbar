import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  // Anagrafica esercente per il censimento presso il provider: campi NON
  // segreti, in chiaro nel Json; i segreti restano cifrati a parte.
  const optionalTrimmed = z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v ? v : undefined));
  const bodySchema = z.object({
    fiscalId: z.string("fiscalId è obbligatorio").trim().min(1, "fiscalId è obbligatorio").max(50),
    name: z
      .string("La denominazione esercente è obbligatoria")
      .trim()
      .min(1, "La denominazione esercente è obbligatoria")
      .max(200),
    email: optionalTrimmed,
    address: optionalTrimmed,
    city: optionalTrimmed,
    province: optionalTrimmed,
    zip: optionalTrimmed,
    configurationId: optionalTrimmed,
    secrets: z.record(z.string(), z.unknown()).optional().nullable(),
  });

  const parsedBody = bodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { ok: false, error: parsedBody.error.issues[0]?.message ?? "Dati non validi" },
      { status: 400 }
    );
  }
  const body = parsedBody.data;

  const existing = (venue.fiscalConfig ?? {}) as FiscalVenueConfig;

  // secrets assente → conserva i segreti cifrati esistenti;
  // secrets = {}   → li rimuove; secrets = {...} → li sostituisce (cifrati).
  let encryptedSecrets = existing.encryptedSecrets;
  if (body.secrets !== undefined && body.secrets !== null) {
    if (Object.keys(body.secrets).length === 0) {
      encryptedSecrets = undefined;
    } else {
      try {
        encryptedSecrets = encryptFiscalSecrets(body.secrets);
      } catch {
        return NextResponse.json(
          { ok: false, error: "FISCAL_CONFIG_ENCRYPTION_KEY non configurata: impossibile cifrare i segreti" },
          { status: 400 }
        );
      }
    }
  }

  const configurationId = body.configurationId;

  const fiscalConfig: FiscalVenueConfig = {
    fiscalId: body.fiscalId,
    name: body.name,
    ...(body.email ? { email: body.email } : {}),
    ...(body.address ? { address: body.address } : {}),
    ...(body.city ? { city: body.city } : {}),
    ...(body.province ? { province: body.province } : {}),
    ...(body.zip ? { zip: body.zip } : {}),
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
      name: fiscalConfig.name,
      configurationId: configurationId ?? null,
      hasSecrets: Boolean(encryptedSecrets),
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      fiscalId: fiscalConfig.fiscalId,
      name: fiscalConfig.name,
      configurationId: configurationId ?? null,
      hasSecrets: Boolean(encryptedSecrets),
    },
  });
}
