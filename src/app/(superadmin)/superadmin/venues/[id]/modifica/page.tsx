import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { VenueEditForm } from "./venue-edit-form";

export const dynamic = "force-dynamic";

export default async function VenueModificaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/superadmin/login");

  const { id } = await params;

  const venue = await db.venue.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, refundBlockedTimezone: true },
  });

  if (!venue) notFound();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="space-y-1">
          <Link
            href={`/superadmin/venues/${id}`}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← {venue.name}
          </Link>
          <h1 className="text-2xl font-semibold">Modifica venue</h1>
        </div>

        <VenueEditForm
          venueId={id}
          initialName={venue.name}
          initialSlug={venue.slug}
          initialTimezone={venue.refundBlockedTimezone}
        />
      </div>
    </main>
  );
}
