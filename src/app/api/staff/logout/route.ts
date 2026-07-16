import { NextResponse, type NextRequest } from "next/server";
import { destroyStaffSession, getStaffSession } from "@/lib/auth/staff";

// Il logout deve essere POST: un GET che muta stato sarebbe prefetchabile
// dai browser (logout accidentale). Questa route non esporta GET: 405.
export async function POST(req: NextRequest) {
  // Il venue per il redirect si legge PRIMA di distruggere la sessione
  const session = await getStaffSession();
  await destroyStaffSession();

  // Navigazione (form/anchor): mai JSON crudo in faccia all'utente —
  // 303 verso il login PIN dello stesso venue (o l'area staff)
  if (req.headers.get("accept")?.includes("text/html")) {
    const target = session?.venueSlug ? `/staff/${session.venueSlug}` : "/accesso-staff";
    return NextResponse.redirect(new URL(target, req.url), 303);
  }

  return NextResponse.json({ ok: true });
}
