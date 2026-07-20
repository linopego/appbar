import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/auth/staff";
import { logManagerAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { isFiscalModuleConfigured } from "@/lib/fiscal/config";
import { processFiscalDocument } from "@/lib/fiscal/emit";

// "Riprova" manuale su un documento fiscale del proprio venue: rimette in
// PENDING (azzerando i tentativi, così un FAILED per tentativi esauriti torna
// lavorabile) e prova subito l'emissione. L'esito resta nel documento.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  if (!isFiscalModuleConfigured()) {
    return NextResponse.json({ ok: false, error: "Modulo fiscale non configurato" }, { status: 400 });
  }

  const { documentId } = await params;

  const doc = await db.fiscalDocument.findUnique({
    where: { id: documentId },
    select: { id: true, venueId: true, status: true },
  });
  if (!doc || doc.venueId !== session.venueId) {
    return NextResponse.json({ ok: false, error: "Documento non trovato" }, { status: 404 });
  }
  if (doc.status === "CONFIRMED") {
    return NextResponse.json({ ok: false, error: "Documento già emesso" }, { status: 400 });
  }

  await db.fiscalDocument.update({
    where: { id: doc.id },
    data: { status: "PENDING", attempts: 0 },
  });

  await logManagerAction({
    operatorId: session.operatorId,
    action: "FISCAL_DOCUMENT_RETRY",
    targetType: "FiscalDocument",
    targetId: doc.id,
    payload: { previousStatus: doc.status },
  });

  const outcome = await processFiscalDocument(doc.id);
  return NextResponse.json({ ok: true, data: { outcome } });
}
