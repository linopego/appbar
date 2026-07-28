import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { orgScopeWhere } from "@/lib/auth/org-scope";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { isFiscalModuleConfigured } from "@/lib/fiscal/config";
import { processFiscalDocument } from "@/lib/fiscal/emit";

// "Riprova" manuale lato superadmin, scopato per organizzazione.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  if (!isFiscalModuleConfigured()) {
    return NextResponse.json({ ok: false, error: "Modulo fiscale non configurato" }, { status: 400 });
  }

  const { documentId } = await params;

  const doc = await db.fiscalDocument.findFirst({
    where: { id: documentId, venue: orgScopeWhere(session).venue },
    select: { id: true, status: true, venue: { select: { organizationId: true } } },
  });
  if (!doc) {
    return NextResponse.json({ ok: false, error: "Documento non trovato" }, { status: 404 });
  }
  if (doc.status === "CONFIRMED") {
    return NextResponse.json({ ok: false, error: "Documento già emesso" }, { status: 400 });
  }

  await db.fiscalDocument.update({
    where: { id: doc.id },
    data: { status: "PENDING", attempts: 0 },
  });

  await logAdminAction({
    adminUserId: session.adminUserId,
    organizationId: doc.venue.organizationId,
    action: "FISCAL_DOCUMENT_RETRY",
    targetType: "FiscalDocument",
    targetId: doc.id,
    payload: { previousStatus: doc.status },
  });

  const outcome = await processFiscalDocument(doc.id);
  return NextResponse.json({ ok: true, data: { outcome } });
}
