import { NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/auth/staff";
import { db } from "@/lib/db";
import { renderVenueQrPosterPng } from "@/lib/qr/poster";

export const runtime = "nodejs";

// QR stampabile del PROPRIO venue (manager). Sola lettura: niente audit.
export async function GET() {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }

  const venue = await db.venue.findUnique({
    where: { id: session.venueId },
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
