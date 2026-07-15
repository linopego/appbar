import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatEur } from "@/lib/utils/money";
import { expiryLabel, isExpiringSoon } from "@/lib/tickets/expiry";
import { Button } from "@/components/ui/button";
import { KlinkLogo } from "@/components/brand/logo";

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

  const [activeTickets, purchasedVenues] = await Promise.all([
    db.ticket.findMany({
      where: { customerId, status: "ACTIVE", expiresAt: { gt: now } },
      include: {
        venue: { select: { name: true, slug: true } },
        priceTier: { select: { name: true, price: true } },
      },
      orderBy: { expiresAt: "asc" },
    }),
    db.venue.findMany({
      where: {
        active: true,
        orders: { some: { customerId, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } } },
      },
      select: { name: true, slug: true },
      orderBy: { name: "asc" },
    }),
  ]);

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
                      <li key={ticket.id}>
                        <Link
                          href={`/ticket/${ticket.qrToken}`}
                          className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 hover:shadow-card transition-shadow"
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
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        {/* Compra ancora */}
        {purchasedVenues.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Compra ancora
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {purchasedVenues.map((venue) => (
                <Link
                  key={venue.slug}
                  href={`/${venue.slug}`}
                  className="flex items-center justify-between rounded-2xl border bg-card p-4 hover:shadow-card transition-shadow"
                >
                  <span className="font-medium truncate">{venue.name}</span>
                  <span className="text-klink-ink-muted" aria-hidden>→</span>
                </Link>
              ))}
            </div>
          </section>
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
