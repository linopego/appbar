import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatEur } from "@/lib/utils/money";
import { expiryLabel, isExpiringSoon } from "@/lib/tickets/expiry";
import {
  lastPurchaseLabel,
  pickRecentVenues,
  RECENT_VENUE_ORDER_STATUSES,
} from "@/lib/venues/recent";
import { pressAttrs, pressBase } from "@/lib/ui/press";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { KlinkLogo } from "@/components/brand/logo";
import { WalletButtons } from "@/components/wallet/wallet-buttons";
import { isAppleWalletConfigured, isGoogleWalletConfigured } from "@/lib/wallet/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "I tuoi ticket" };

// La "casa" del cliente: ticket attivi raggruppati per locale, ordinati per
// scadenza. I nomi dei locali qui sono quelli dove il cliente ha già
// acquistato: pagine personali, non elenchi pubblici.
export default async function CustomerHomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/home")}`);
  }
  const customerId = session.user.id;
  const now = new Date();

  const [activeTickets, recentPaidOrders] = await Promise.all([
    db.ticket.findMany({
      where: { customerId, status: "ACTIVE", expiresAt: { gt: now } },
      include: {
        venue: { select: { name: true, slug: true } },
        priceTier: { select: { name: true, price: true } },
      },
      orderBy: { expiresAt: "asc" },
    }),
    // "I tuoi locali": una sola query sugli ordini pagati più recenti
    // (PAID + PARTIALLY_REFUNDED: un rimborso parziale non fa sparire il
    // locale), dedup applicativo con pickRecentVenues (niente N+1), max 4
    db.order.findMany({
      where: {
        customerId,
        status: { in: RECENT_VENUE_ORDER_STATUSES },
        venue: { active: true },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        createdAt: true,
        venue: { select: { name: true, slug: true } },
      },
    }),
  ]);

  const recentVenues = pickRecentVenues(recentPaidOrders);

  // Raggruppa per locale mantenendo l'ordine per scadenza più vicina
  const byVenue = new Map<
    string,
    { name: string; slug: string; tickets: typeof activeTickets }
  >();
  for (const ticket of activeTickets) {
    const key = ticket.venue.slug;
    if (!byVenue.has(key)) {
      byVenue.set(key, { name: ticket.venue.name, slug: key, tickets: [] });
    }
    byVenue.get(key)!.tickets.push(ticket);
  }
  const groups = [...byVenue.values()];

  const firstName = session.user.name?.split(" ")[0];

  // Wallet: feature flag via env, senza configurazione i badge non compaiono
  const appleWallet = isAppleWalletConfigured();
  const googleWallet = isGoogleWalletConfigured();
  const walletEnabled = appleWallet || googleWallet;

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 sm:py-10 max-w-2xl space-y-10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {firstName ? `Ciao ${firstName} 👋` : "I tuoi ticket"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mostra il QR al banco: una scansione, una consumazione.
          </p>
        </div>

        {/* I tuoi locali IN CIMA: il locale abituale a un tap, senza
            riscansionare il QR del bancone. Card grandi touch-first, tutta
            la card è tappabile verso la pagina d'acquisto. Max 4 */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            I tuoi locali
          </h2>
          {recentVenues.length === 0 ? (
            <div className="rounded-2xl border bg-card p-6 text-center space-y-2">
              <div className="flex justify-center opacity-60">
                <KlinkLogo variant="mark" size={32} />
              </div>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Qui troverai i locali dove hai acquistato. Per iniziare, inquadra
                il QR Klink al bancone del locale.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
                {recentVenues.map((venue) => (
                  <Link
                    key={venue.slug}
                    href={`/${venue.slug}`}
                    {...pressAttrs("affirmative")}
                    className={cn(
                      "block rounded-2xl border bg-card p-5 min-h-28 hover:shadow-card",
                      pressBase
                    )}
                  >
                    {/* Mark come decorazione discreta */}
                    <span
                      aria-hidden
                      className="absolute top-4 right-4 opacity-15 pointer-events-none"
                    >
                      <KlinkLogo variant="mark" size={28} />
                    </span>
                    <span className="block pr-10 font-display text-lg font-semibold leading-snug">
                      {venue.name}
                    </span>
                    <span className="block mt-1 text-xs text-muted-foreground">
                      Ultimo acquisto: {lastPurchaseLabel(venue.lastOrderAt)}
                    </span>
                  </Link>
                ))}
              </div>
              <div className="mt-3 text-right">
                <Link
                  href="/profilo"
                  className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Tutti i tuoi ordini
                </Link>
              </div>
            </>
          )}
        </section>

        {/* Ticket attivi */}
        {groups.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center space-y-3">
            <div className="flex justify-center opacity-60">
              <KlinkLogo variant="mark" size={40} />
            </div>
            <p className="font-medium">Non hai ticket attivi</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Per comprarli, inquadra il QR esposto al banco del locale: si apre la
              pagina d&apos;acquisto e paghi dal telefono.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.slug}>
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-lg font-semibold">{group.name}</h2>
                  <span className="text-xs text-muted-foreground">
                    {group.tickets.length}{" "}
                    {group.tickets.length === 1 ? "ticket" : "ticket"}
                  </span>
                </div>
                <ul className="space-y-2">
                  {group.tickets.map((ticket) => {
                    const soon = isExpiringSoon(ticket.expiresAt, now);
                    return (
                      <li key={ticket.id} className="rounded-2xl border bg-card">
                        <Link
                          href={`/ticket/${ticket.qrToken}`}
                          className="flex items-center justify-between gap-3 p-4 hover:shadow-card transition-shadow rounded-2xl"
                        >
                          <div className="min-w-0">
                            <p className="font-display font-semibold truncate">
                              {ticket.priceTier.name}
                            </p>
                            <p
                              className={`text-xs mt-0.5 ${
                                soon
                                  ? "font-semibold text-klink-warning"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {soon && "⚠ "}
                              {expiryLabel(ticket.expiresAt, now)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-sm text-muted-foreground tabular-nums">
                              {formatEur(ticket.priceTier.price)}
                            </span>
                            <span className="inline-flex h-9 px-3 items-center rounded-full bg-klink-lime text-klink-ink text-xs font-semibold">
                              Apri QR
                            </span>
                          </div>
                        </Link>
                        {/* Wallet: il QR anche offline, senza aprire il sito */}
                        {walletEnabled && (
                          <div className="px-4 pb-3 flex justify-start [&>div]:justify-start">
                            <WalletButtons
                              qrToken={ticket.qrToken}
                              appleEnabled={appleWallet}
                              googleEnabled={googleWallet}
                              badgeHeight={36}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        {/* Storico */}
        <section className="pt-2 border-t">
          <Button asChild variant="outline" className="w-full">
            <Link href="/profilo">Storico completo: ordini e ticket passati</Link>
          </Button>
        </section>
      </div>
    </main>
  );
}
