import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrderStatusBanner } from "@/components/shared/order-status-banner";
import { computeTicketStatus } from "@/lib/tickets/status";
import { formatEur } from "@/lib/utils/money";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

const formatDateTime = (d: Date) =>
  new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

export default async function ProfiloPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/profilo");
  }

  const [accounts, orders] = await Promise.all([
    db.customerAccount.findMany({
      where: { customerId: session.user.id },
      select: { provider: true },
    }),
    db.order.findMany({
      where: { customerId: session.user.id },
      include: {
        venue: { select: { name: true, slug: true } },
        tickets: { select: { id: true, status: true, expiresAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const providerLabels: Record<string, string> = {
    google: "Google",
    resend: "Email magic link",
  };
  const providers = accounts.map((a) => providerLabels[a.provider] ?? a.provider);
  const primaryProvider = providers[0] ?? "Email magic link";

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Il tuo profilo</h1>
          <LogoutButton />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>I dati del tuo account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Email</div>
              <div className="text-sm">{session.user.email}</div>
            </div>
            {session.user.name ? (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Nome</div>
                <div className="text-sm">{session.user.name}</div>
              </div>
            ) : null}
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Accesso tramite
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {providers.length > 0 ? (
                  providers.map((p) => (
                    <Badge key={p} variant="secondary">
                      {p}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="secondary">{primaryProvider}</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>I tuoi ordini</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Non hai ancora effettuato ordini.</p>
                <Button asChild variant="outline">
                  <Link href="/">Esplora i locali</Link>
                </Button>
              </div>
            ) : (
              <ul className="space-y-3">
                {orders.map((order) => {
                  const counts = {
                    active: order.tickets.filter(
                      (t) => computeTicketStatus(t) === "ACTIVE"
                    ).length,
                    consumed: order.tickets.filter((t) => t.status === "CONSUMED").length,
                    expired: order.tickets.filter((t) => computeTicketStatus(t) === "EXPIRED")
                      .length,
                    refunded: order.tickets.filter((t) => t.status === "REFUNDED").length,
                  };
                  const summaryParts: string[] = [];
                  if (counts.active) summaryParts.push(`${counts.active} attivi`);
                  if (counts.consumed) summaryParts.push(`${counts.consumed} usati`);
                  if (counts.expired) summaryParts.push(`${counts.expired} scaduti`);
                  if (counts.refunded) summaryParts.push(`${counts.refunded} rimborsati`);

                  return (
                    <li key={order.id}>
                      <Link
                        href={`/ordine/${order.id}`}
                        className="block rounded-lg border p-4 hover:bg-accent transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <div className="font-semibold">{order.venue.name}</div>
                          <OrderStatusBanner status={order.status} />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(order.createdAt)}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="text-sm text-muted-foreground">
                            {summaryParts.length > 0
                              ? summaryParts.join(", ")
                              : `${order.tickets.length} ticket`}
                          </div>
                          <div className="font-medium">{formatEur(order.totalAmount)}</div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
