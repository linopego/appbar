import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KlinkLogo } from "@/components/brand/logo";
import { BRAND_NAME, CONTACT_EMAIL } from "@/lib/brand";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Homepage = vetrina PRODOTTO per i gestori di locali. Regola di prodotto:
// il nome di un locale compare SOLO su /[venueSlug] e nelle pagine/email di
// un acquisto — mai qui. I clienti finali arrivano ai locali via QR sul
// bancone o link diretto.

const BENEFITS = [
  {
    title: "Incassi anticipati e certi",
    text: "I clienti pagano online prima di arrivare al banco. Tu incassi subito, anche se poi la consumazione arriva un altro giorno.",
  },
  {
    title: "Code più veloci al banco",
    text: "Niente pagamenti alla cassa: il barista scansiona il QR e serve. Ogni scansione vale una consumazione, senza discussioni.",
  },
  {
    title: "Niente contanti né resti",
    text: "Zero cassa da quadrare, zero errori di resto, zero carte al banco. Tutto tracciato, rimborsi gestiti dal pannello.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Esponi il QR del locale",
    text: "Stampi il QR dal tuo pannello e lo metti sul bancone. I clienti lo inquadrano e comprano i ticket dal telefono.",
  },
  {
    step: "2",
    title: "I clienti comprano online",
    text: "Pagano con carta e ricevono un QR per ogni consumazione, via email e nel loro profilo.",
  },
  {
    step: "3",
    title: "Il barista scansiona e serve",
    text: "Dal POS sul telefono o tablet: scansione, conferma, servito. Statistiche e rimborsi nel pannello del locale.",
  },
];

export default async function HomePage() {
  // Unico elemento consumer della pagina: banner discreto per chi ha già ticket
  const session = await auth();
  let hasTickets = false;
  if (session?.user?.id) {
    hasTickets =
      (await db.ticket.count({ where: { customerId: session.user.id } })) > 0;
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <div className="container mx-auto px-4 py-12 sm:py-20 flex-1 max-w-4xl">
        {hasTickets && (
          <div className="mb-10 rounded-2xl border bg-card px-5 py-4 flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Hai dei ticket? Li trovi nel tuo profilo.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/profilo">I tuoi ticket</Link>
            </Button>
          </div>
        )}

        {/* Hero */}
        <header className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <KlinkLogo variant="lockup" size={48} className="text-foreground" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Il sistema cashless per il tuo locale
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            I tuoi clienti comprano i ticket online, il barista scansiona il QR e
            serve. Zero contanti, zero code alla cassa.
          </p>
          <Button asChild size="lg" className="mt-8">
            <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Informazioni su ${BRAND_NAME}`)}`}>
              Contattaci
            </a>
          </Button>
        </header>

        {/* Benefici per il gestore */}
        <section className="mb-16">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {BENEFITS.map((benefit) => (
              <Card key={benefit.title}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {benefit.text}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Come funziona (punto di vista del locale) */}
        <section className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-8">Come funziona</h2>
          <ol className="space-y-6">
            {HOW_IT_WORKS.map((item) => (
              <li key={item.step} className="flex gap-4 items-start">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                  {item.step}
                </span>
                <div>
                  <p className="font-medium text-lg">{item.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <div className="text-center mt-10">
            <Button asChild variant="outline">
              <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Informazioni su ${BRAND_NAME}`)}`}>
                Scrivici: {CONTACT_EMAIL}
              </a>
            </Button>
          </div>
        </section>
      </div>

      <footer className="border-t py-6">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {BRAND_NAME}</p>
          <nav className="flex items-center gap-5">
            <Link href="/accesso-staff" className="hover:text-foreground transition-colors">
              Area staff
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
