import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/staff";
import { db } from "@/lib/db";
import { PosScanner } from "./pos-scanner";

export const dynamic = "force-dynamic";
export const metadata = { title: "POS — Sistema Ticket" };

interface PageProps {
  params: Promise<{ venueSlug: string }>;
}

export default async function PosPage({ params }: PageProps) {
  const { venueSlug } = await params;

  const session = await requireStaff().catch(() => null);
  if (!session) {
    redirect(`/staff/${venueSlug}`);
  }

  if (session.venueSlug !== venueSlug) {
    redirect(`/staff/${session.venueSlug}/pos`);
  }

  const venue = await db.venue.findUnique({
    where: { slug: venueSlug },
    select: { name: true },
  });
  if (!venue) redirect("/");

  return (
    <PosScanner
      venueName={venue.name}
      operatorName={session.name}
      operatorRole={session.role}
      venueSlug={venueSlug}
    />
  );
}
