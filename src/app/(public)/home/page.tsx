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
import { ChevronRight, QrCode, Ticket } from "lucide-react";
import { pressAttrs, pressBase } from "@/lib/ui/press";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
            {firstName ? `Ciao ${firstName}` : "I tuoi ticket"}
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
            <div className="rounded-2xl border bg-card p-6 text-center space-y-3">
              <div className="flex justify-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-klink-lime-soft">
                  <QrCode aria-hidden className="h-7 w-7 text-klink-ink" strokeWidth={1.5} />
                </span>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Qui troverai i locali dove hai acquistato. Per iniziare, inquadra
                il QR Klink al bancone del locale.
              </p>
            </div>
          ) : (
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
                  <span className="block font-display text-lg font-semibold leading-snug">
                    {venue.name}
                  </span>
                  <span className="block mt-1 text-xs text-muted-foreground">
                    Ultimo acquisto: {lastPurchaseLabel(venue.lastOrderAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Ticket attivi */}
        {groups.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center space-y-3">
            <div className="flex justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-klink-lime-soft">
                <Ticket aria-hidden className="h-12 w-12 text-klink-ink" strokeWidth={1.5} />
              </span>
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
                      <li key={ticket.id}>
                        {/* Gettone lime: il lime significa "valido/attivo".
                            TUTTA la card è un link vero; testi in Ink pieno */}
                        <Link
                          href={`/ticket/${ticket.qrToken}`}
                          aria-label={`Apri il QR del ticket ${ticket.priceTier.name}`}
                          {...pressAttrs("ink-on-lime")}
                          className={cn(
                            "flex min-h-[60px] items-center justify-between gap-3 rounded-2xl bg-klink-lime p-4",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-klink-ink focus-visible:ring-offset-2",
                            "active:bg-klink-lime-hover",
                            pressBase
                          )}
                        >
                          <div className="min-w-0">
                            <p className="font-display font-semibold text-klink-ink truncate">
                              {ticket.priceTier.name}
                            </p>
                            {soon ? (
                              <span className="mt-1 inline-flex items-center rounded-full bg-klink-ink px-2.5 py-0.5 text-xs font-semibold text-white">
                                {expiryLabel(ticket.expiresAt, now)}
                              </span>
                            ) : (
                              <p className="text-xs mt-0.5 text-klink-ink">
                                {expiryLabel(ticket.expiresAt, now)}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm text-klink-ink tabular-nums font-medium">
                              {formatEur(ticket.priceTier.price)}
                            </span>
                            <ChevronRight aria-hidden className="h-5 w-5 text-klink-ink" />
                          </div>
                        </Link>
                        {/* Wallet: il QR anche offline, senza aprire il sito */}
                        {walletEnabled && (
                          <div className="mt-2 flex justify-start [&>div]:justify-start">
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

        {/* Storico: UNICO punto d'accesso a ordini e ticket passati */}
        <section className="pt-2 border-t">
          <Button asChild variant="outline" className="w-full">
            <Link href="/profilo">Storico ordini e ticket</Link>
          </Button>
        </section>
      </div>
    </main>
  );
}
