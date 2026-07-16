import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { isPaymentsConfigured } from "@/lib/checkout/connect";
import { VenuePurchase } from "./venue-purchase";

interface VenuePageProps {
  params: Promise<{ venueSlug: string }>;
}

export async function generateMetadata({ params }: VenuePageProps) {
  const { venueSlug } = await params;
  const venue = await db.venue.findUnique({ where: { slug: venueSlug }, select: { name: true } });
  if (!venue) return {};
  return { title: venue.name };
}

const HOW_IT_WORKS = [
  { step: "1", text: "Scegli i ticket e paga con carta, in modo sicuro." },
  { step: "2", text: "Ricevi un QR per ogni consumazione, via email e nel tuo profilo." },
  { step: "3", text: "Mostra il QR al banco: il barista scansiona e ti serve. Validi 30 giorni." },
];

// /[venueSlug] È la pagina d'acquisto: chi scansiona il QR al bancone è già
// al bar e vuole comprare subito. Loggato: 2 tap (+ e Paga) fino a Stripe.
export default async function VenuePage({ params }: VenuePageProps) {
  const { venueSlug } = await params;

  const [venue, session] = await Promise.all([
    db.venue.findUnique({
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
    }),
    auth(),
  ]);

  if (!venue) notFound();

  // Stati cortesi invariati: venue/org disattivati o pagamenti non configurati
  const purchasable = venue.active && isPaymentsConfigured(venue.organization);

  if (!purchasable) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 max-w-md text-center">
          <h1 className="text-3xl font-bold tracking-tight mb-4">{venue.name}</h1>
          <div className="rounded-2xl border bg-card p-8">
            <p className="text-lg font-medium mb-2">Acquisti non disponibili al momento</p>
            <p className="text-sm text-muted-foreground">
              Questo locale non accetta ordini online in questo momento. Riprova più tardi,
              oppure chiedi direttamente al banco.
            </p>
          </div>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/">Torna alla home</Link>
          </Button>
        </div>
      </main>
    );
  }

  const tiers = venue.priceTiers.map((t) => ({
    id: t.id,
    name: t.name,
    price: t.price.toString(),
  }));

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header compatto: solo il nome del locale (il logo sta già
            nell'header globale, il mark non è decorazione riempitiva) */}
        <h1 className="text-lg font-semibold truncate mb-5">{venue.name}</h1>

        <VenuePurchase
          venueSlug={venue.slug}
          priceTiers={tiers}
          isLoggedIn={Boolean(session?.user)}
        />

        {/* Come funziona: accordion discreto, non ruba spazio all'acquisto */}
        <details className="group mt-6">
          <summary className="cursor-pointer list-none text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
            Come funziona?
            <span aria-hidden className="transition-transform group-open:rotate-180">▾</span>
          </summary>
          <ol className="mt-3 space-y-2.5">
            {HOW_IT_WORKS.map((item) => (
              <li key={item.step} className="flex gap-3 items-start text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-klink-lime-soft text-klink-ink text-xs font-semibold">
                  {item.step}
                </span>
                <p className="text-muted-foreground">{item.text}</p>
              </li>
            ))}
          </ol>
        </details>

        {/* Spazio per la barra totale sticky (totale + checkbox Termini) */}
        <div className="h-36" aria-hidden />
      </div>
    </main>
  );
}
