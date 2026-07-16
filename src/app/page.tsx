import Link from "next/link";
import { Banknote, Smartphone, Zap } from "lucide-react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/shared/public-header";
import { Reveal } from "@/components/shared/reveal";
import { BRAND_NAME, CONTACT_EMAIL } from "@/lib/brand";
import { auth } from "@/lib/auth";
import { renderUrlQrSvg } from "@/lib/qr/render";

export const dynamic = "force-dynamic";

// Vetrina PRODOTTO per i gestori (anonimi). I clienti loggati vengono
// rediretti alla loro dashboard /home: la vetrina B2B non li riguarda.
// Regola invariata: nessun nome di locale su questa pagina.

const MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Informazioni su ${BRAND_NAME}`)}`;

// Scintilla del brand come motivo grafico ricorrente (non è il logo:
// niente tessera, solo la forma, riusabile in decorazioni e icone)
function Sparkle({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className={className}>
      <path
        d="M32 6 Q35 27 58 32 Q35 37 32 58 Q29 37 6 32 Q29 27 32 6 Z"
        fill="currentColor"
      />
    </svg>
  );
}

const BENEFITS = [
  {
    title: "Incassi anticipati e certi",
    text: "I clienti pagano online prima di arrivare al banco. Tu incassi subito, anche se la consumazione arriva un altro giorno.",
    Icon: Banknote,
  },
  {
    title: "Code più veloci al banco",
    text: "Niente pagamenti alla cassa: il barista scansiona il QR e serve. Ogni scansione vale una consumazione, senza discussioni.",
    Icon: Zap,
  },
  {
    title: "Niente contanti né resti",
    text: "Zero cassa da quadrare, zero errori di resto, zero carte al banco. Tutto tracciato, rimborsi gestiti dal pannello.",
    Icon: Smartphone,
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
  // Cliente loggato → la sua dashboard, non la vetrina B2B
  const session = await auth();
  if (session?.user) {
    redirect("/home");
  }

  // QR VERO nel mockup (codifica l'URL del sito): moduli neri su pannello
  // bianco, quiet zone rispettata — niente griglie finte
  const appUrl =
    process.env["NEXT_PUBLIC_APP_URL"] ?? process.env["NEXTAUTH_URL"] ?? "http://localhost:3000";
  const mockupQrSvg = await renderUrlQrSvg(appUrl);

  return (
    <>
      <PublicHeader />
      <main className="min-h-screen bg-background flex flex-col overflow-x-hidden">
        <div className="flex-1">
          {/* ── Hero ── */}
          <section className="relative">
            {/* Composizione decorativa di scintille (solo forme di brand) */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <Sparkle size={220} className="absolute -right-16 -top-10 text-klink-lime opacity-70" />
              <Sparkle size={56} className="absolute right-40 top-40 text-klink-ink opacity-10" />
              <Sparkle size={90} className="absolute -left-8 top-64 text-klink-lime opacity-40" />
              <Sparkle size={32} className="absolute left-1/4 top-24 text-klink-ink opacity-10" />
            </div>

            <div className="container mx-auto px-4 pt-16 sm:pt-24 pb-16 max-w-3xl text-center relative">
              <Reveal>
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
                  Il sistema cashless
                  <br />
                  per il tuo locale
                </h1>
              </Reveal>
              <Reveal delay={120}>
                <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto mt-5">
                  I tuoi clienti comprano i ticket online, il barista scansiona il QR e
                  serve. Zero contanti, zero code alla cassa.
                </p>
              </Reveal>
              <Reveal delay={240}>
                <Button asChild size="lg" className="mt-9 px-10 text-base">
                  <a href={MAILTO}>Contattaci</a>
                </Button>
              </Reveal>
            </div>
          </section>

          {/* ── Benefici ── */}
          <section className="container mx-auto px-4 py-14 sm:py-20 max-w-4xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              {BENEFITS.map((benefit, i) => (
                <Reveal key={benefit.title} delay={i * 100}>
                  <div className="h-full rounded-2xl border bg-card p-6 shadow-card">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-klink-lime-soft">
                      <benefit.Icon aria-hidden className="h-6 w-6 text-klink-ink" strokeWidth={1.8} />
                    </span>
                    <h2 className="text-lg font-semibold mt-4">{benefit.title}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                      {benefit.text}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* ── Mockup prodotto: telefono con ticket + esito POS ── */}
          <section className="container mx-auto px-4 py-10 sm:py-14 max-w-4xl">
            <Reveal>
              <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-3">
                Un QR per ogni consumazione
              </h2>
              <p className="text-muted-foreground text-center max-w-lg mx-auto mb-12">
                Il cliente mostra il telefono, il barista scansiona: verde, consegnato.
                Tutto qui.
              </p>
            </Reveal>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-10 sm:gap-16">
              {/* Telefono stilizzato con card ticket */}
              <Reveal delay={100}>
                <div className="w-56 rounded-[2.2rem] border-[6px] border-klink-ink bg-klink-bg p-3 shadow-card">
                  <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-klink-ink/20" />
                  <div className="rounded-2xl bg-white border p-4">
                    <div
                      className="w-full"
                      aria-hidden
                      dangerouslySetInnerHTML={{
                        __html: mockupQrSvg.replace("<svg ", '<svg width="100%" height="100%" '),
                      }}
                    />
                    <p className="font-display font-semibold text-center mt-3">Drink</p>
                    <p className="text-xs text-muted-foreground text-center tabular-nums">
                      10,00&nbsp;€ · valido 30 giorni
                    </p>
                  </div>
                  <div className="mt-3 mx-auto h-9 w-28 rounded-full bg-klink-lime flex items-center justify-center">
                    <span className="text-xs font-semibold text-klink-ink">Mostra al banco</span>
                  </div>
                </div>
              </Reveal>

              {/* Feedback POS */}
              <Reveal delay={220}>
                <div className="w-56 rounded-2xl bg-klink-lime p-8 text-center shadow-card">
                  <div className="text-5xl text-klink-ink" aria-hidden>✓</div>
                  <p className="font-display text-2xl font-bold text-klink-ink mt-2">
                    Consegnato
                  </p>
                  <p className="text-sm text-klink-ink/70 mt-1">Drink · 10,00&nbsp;€</p>
                  <p className="text-xs text-klink-ink/60 mt-4">
                    Il POS conferma in un colpo d&apos;occhio
                  </p>
                </div>
              </Reveal>
            </div>
          </section>

          {/* ── Come funziona ── */}
          <section className="container mx-auto px-4 py-14 sm:py-20 max-w-2xl">
            <Reveal>
              <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-10">
                Come funziona
              </h2>
            </Reveal>
            <ol className="space-y-8">
              {HOW_IT_WORKS.map((item, i) => (
                <Reveal key={item.step} delay={i * 100}>
                  <li className="flex gap-5 items-start">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                      {item.step}
                    </span>
                    <div>
                      <p className="font-display font-semibold text-lg">{item.title}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                        {item.text}
                      </p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>

            <Reveal>
              <div className="mt-14 rounded-2xl border bg-card p-8 text-center shadow-card relative overflow-hidden">
                <Sparkle size={72} className="absolute -right-4 -bottom-4 text-klink-lime opacity-50" aria-hidden />
                <h2 className="text-xl font-semibold">Porta {BRAND_NAME} nel tuo locale</h2>
                <p className="text-sm text-muted-foreground mt-2 mb-6">
                  Scrivici due righe: ti rispondiamo con una demo e i costi, senza impegno.
                </p>
                <Button asChild>
                  <a href={MAILTO}>Scrivici: {CONTACT_EMAIL}</a>
                </Button>
              </div>
            </Reveal>
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
              <Link href="/termini" className="hover:text-foreground transition-colors">
                Termini
              </Link>
            </nav>
          </div>
        </footer>
      </main>
    </>
  );
}
