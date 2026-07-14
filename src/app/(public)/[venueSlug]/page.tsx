import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatEur } from "@/lib/utils/money";
import { isPaymentsConfigured } from "@/lib/checkout/connect";

interface VenuePageProps {
  params: Promise<{ venueSlug: string }>;
}

export async function generateMetadata({ params }: VenuePageProps) {
  const { venueSlug } = await params;
  const venue = await db.venue.findUnique({ where: { slug: venueSlug }, select: { name: true } });
  if (!venue) return {};
  return { title: `${venue.name} — Sistema Ticket` };
}

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Compra online",
    text: "Scegli i ticket e paga in modo sicuro con carta.",
  },
  {
    step: "2",
    title: "Ricevi i QR via email",
    text: "Un QR code per ogni consumazione, sempre disponibili anche nel tuo profilo.",
  },
  {
    step: "3",
    title: "Mostrali al banco",
    text: "Il barista li scansiona e ti serve. Validi 30 giorni dall'acquisto.",
  },
];

export default async function VenuePage({ params }: VenuePageProps) {
  const { venueSlug } = await params;

  const venue = await db.venue.findUnique({
    where: { slug: venueSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      active: true,
      organization: {
        select: { active: true, stripeAccountId: true, stripeChargesEnabled: true },
      },
      priceTiers: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, price: true },
      },
    },
  });

  if (!venue) notFound();

  // Acquisti disponibili solo se: venue attivo, organizzazione attiva e
  // pagamenti Stripe configurati. Altrimenti pagina cortese, niente errori.
  const purchasable = venue.active && isPaymentsConfigured(venue.organization);

  if (!purchasable) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 max-w-md text-center">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Tutti i locali
          </Link>
          <h1 className="text-3xl font-bold tracking-tight mt-6 mb-4">{venue.name}</h1>
          <div className="rounded-xl border bg-card p-8">
            <p className="text-lg font-medium mb-2">Acquisti non disponibili al momento</p>
            <p className="text-sm text-muted-foreground">
              Questo locale non accetta ordini online in questo momento. Riprova più tardi,
              oppure chiedi direttamente al banco.
            </p>
          </div>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/">Vedi gli altri locali</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 sm:py-12 max-w-2xl">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Tutti i locali
          </Link>
          <h1 className="text-3xl font-bold tracking-tight mt-4 mb-2">{venue.name}</h1>
          <p className="text-muted-foreground">
            Ticket prepagati: paghi ora, consumi quando vuoi entro 30 giorni.
          </p>
        </div>

        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Listino
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-8">
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
          <Link href={`/${venue.slug}/acquista`}>Acquista i tuoi ticket</Link>
        </Button>

        <section className="mt-12">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            Come funziona
          </h2>
          <ol className="space-y-4">
            {HOW_IT_WORKS.map((item) => (
              <li key={item.step} className="flex gap-4 items-start">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  {item.step}
                </span>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
