import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatEur } from "@/lib/utils/money";

interface VenuePageProps {
  params: Promise<{ venueSlug: string }>;
}

export async function generateMetadata({ params }: VenuePageProps) {
  const { venueSlug } = await params;
  const venue = await db.venue.findUnique({ where: { slug: venueSlug }, select: { name: true } });
  if (!venue) return {};
  return { title: `${venue.name} — Sistema Ticket` };
}

export default async function VenuePage({ params }: VenuePageProps) {
  const { venueSlug } = await params;

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

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Tutti i locali
          </Link>
          <h1 className="text-3xl font-bold tracking-tight mt-4 mb-2">{venue.name}</h1>
          <p className="text-muted-foreground">Seleziona i ticket che vuoi acquistare</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {venue.priceTiers.map((tier) => (
            <Card key={tier.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">{tier.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold">{formatEur(tier.price)}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        <Button asChild size="lg" className="w-full">
          <Link href={`/${venue.slug}/acquista`}>Procedi all&apos;acquisto</Link>
        </Button>
      </div>
    </main>
  );
}
