import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TicketCard } from "@/components/shared/ticket-card";
import { OrderStatusBanner } from "@/components/shared/order-status-banner";
import { RefundStatusBadge } from "@/components/shared/refund-status-badge";
import { computeTicketStatus } from "@/lib/tickets/status";
import { formatEur } from "@/lib/utils/money";
import { PollingOrderStatus } from "./polling-order-status";

export const dynamic = "force-dynamic";
export const metadata = { title: "Il tuo ordine — Sistema Ticket" };

interface PageProps {
  params: Promise<{ orderId: string }>;
}

const formatDateTime = (d: Date) =>
  new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

const formatDate = (d: Date) =>
  new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" }).format(d);

export default async function OrderPage({ params }: PageProps) {
  const { orderId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/ordine/${orderId}`);
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      venue: true,
      customer: true,
      items: { include: { priceTier: true } },
      tickets: {
        include: { priceTier: true },
        orderBy: [{ priceTier: { sortOrder: "asc" } }, { createdAt: "asc" }],
      },
      refunds: { orderBy: { requestedAt: "desc" }, take: 1 },
    },
  });

  if (!order || order.customerId !== session.user.id) notFound();

  const orderShortId = order.id.slice(0, 8).toUpperCase();

  // === PENDING layout ===
  if (order.status === "PENDING") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Pagamento in elaborazione</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Stiamo confermando il tuo pagamento. I ticket appariranno qui a momenti.
            </p>
            <PollingOrderStatus orderId={order.id} />
          </CardContent>
        </Card>
      </main>
    );
  }

  // === FAILED layout ===
  if (order.status === "FAILED") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="text-4xl mb-2">✕</div>
            <CardTitle className="text-xl">Pagamento non completato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Il tuo pagamento non è andato a buon fine. Nessun importo è stato addebitato.
            </p>
            <Button asChild className="w-full">
              <Link href={`/${order.venue.slug}/acquista`}>Acquista di nuovo</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  // === PAID / REFUNDED / PARTIALLY_REFUNDED layout ===
  const groupedTickets = new Map<
    string,
    { name: string; price: typeof order.tickets[number]["priceTier"]["price"]; sortOrder: number; tickets: typeof order.tickets }
  >();
  for (const t of order.tickets) {
    const key = t.priceTierId;
    const existing = groupedTickets.get(key);
    if (existing) {
      existing.tickets.push(t);
    } else {
      groupedTickets.set(key, {
        name: t.priceTier.name,
        price: t.priceTier.price,
        sortOrder: t.priceTier.sortOrder,
        tickets: [t],
      });
    }
  }
  const groups = Array.from(groupedTickets.values()).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  const expiresAt = order.tickets[0]?.expiresAt ?? null;
  const hasUsableTickets = order.tickets.some((t) => computeTicketStatus(t) === "ACTIVE");
  const latestRefund = order.refunds[0] ?? null;

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{order.venue.name}</h1>
              <p className="text-muted-foreground mt-1">
                I tuoi ticket — Ordine #{orderShortId}
              </p>
            </div>
            <OrderStatusBanner status={order.status} />
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Acquistato il {formatDateTime(order.createdAt)}</div>
            <div>
              {order.tickets.length} ticket — totale {formatEur(order.totalAmount)}
            </div>
            {expiresAt && <div>Validi fino al {formatDate(expiresAt)}</div>}
          </div>
        </div>

        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.name}>
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">{g.name}</h2>
                <div className="text-sm text-muted-foreground">
                  {formatEur(g.price)} · {g.tickets.length}{" "}
                  {g.tickets.length === 1 ? "ticket" : "ticket"}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {g.tickets.map((t) => (
                  <TicketCard key={t.id} ticket={t} mode="compact" />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Refund banner */}
        {latestRefund && (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-4 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-zinc-800">Hai una richiesta di rimborso in corso</p>
              <p className="text-xs text-zinc-500">
                {(latestRefund.ticketIds as string[]).length} ticket · {formatEur(latestRefund.amount.toString())}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <RefundStatusBadge status={latestRefund.status} />
              <Link
                href={`/profilo/rimborsi/${latestRefund.id}`}
                className="text-xs text-zinc-600 hover:text-zinc-900 underline"
              >
                Vedi →
              </Link>
            </div>
          </div>
        )}

        {hasUsableTickets && !latestRefund && (
          <div className="mt-12 pt-6 border-t">
            <p className="text-sm text-muted-foreground">
              Hai bisogno di un rimborso?{" "}
              <Link
                href={`/profilo/ordini/${order.id}/rimborso`}
                className="underline hover:text-foreground"
              >
                Richiedi un rimborso
              </Link>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
