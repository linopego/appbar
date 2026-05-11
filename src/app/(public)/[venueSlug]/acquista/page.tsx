import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PurchaseForm } from "./purchase-form";

interface AcquistaPageProps {
  params: Promise<{ venueSlug: string }>;
}

export async function generateMetadata({ params }: AcquistaPageProps) {
  const { venueSlug } = await params;
  const venue = await db.venue.findUnique({ where: { slug: venueSlug }, select: { name: true } });
  if (!venue) return {};
  return { title: `Acquista ticket — ${venue.name}` };
}

export default async function AcquistaPage({ params }: AcquistaPageProps) {
  const { venueSlug } = await params;

  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/${venueSlug}/acquista`);
  }

  const venue = await db.venue.findUnique({
    where: { slug: venueSlug, active: true },
    select: {
      id: true,
      name: true,
      slug: true,
      priceTiers: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, price: true },
      },
    },
  });

  if (!venue) notFound();

  const tiers = venue.priceTiers.map((t) => ({
    id: t.id,
    name: t.name,
    price: t.price.toString(),
  }));

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <PurchaseForm venueSlug={venue.slug} venueName={venue.name} priceTiers={tiers} />
      </div>
    </main>
  );
}
