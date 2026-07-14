import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { orgScopeWhere } from "@/lib/auth/org-scope";
import { db } from "@/lib/db";
import { renderVenueQrPosterPng } from "@/lib/qr/poster";

export const runtime = "nodejs";

// QR stampabile di un venue: PLATFORM per tutti, ORG_ADMIN solo per i venue
// della propria organizzazione (fuori scope → 404). Sola lettura: niente audit.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin().catch(() => null);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }

  const { id } = await params;
  const venue = await db.venue.findFirst({
    where: { id, ...orgScopeWhere(session).venue },
    select: { slug: true },
  });
  if (!venue) {
    return NextResponse.json({ ok: false, error: "Venue non trovato" }, { status: 404 });
  }

  const png = await renderVenueQrPosterPng(venue.slug);

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="qr-${venue.slug}.png"`,
      "Cache-Control": "no-store",
    },
  });
}
