import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PollingTicketReady } from "./polling-ticket-ready";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { formatEur } from "@/lib/utils/money";

export const metadata = { title: "Pagamento completato" };

interface SuccessPageProps {
  searchParams: Promise<{ order_id?: string }>;
}

// Ritorno da Stripe: riepilogo dell'ordine coi ticket e CTA verso /home.
// Se il webhook non è ancora arrivato (di norma 1-3 secondi) la pagina fa
// auto-refresh via polling: il cliente resta qui finché i ticket non
// esistono, così su /home non atterra mai nel "buco" dell'ordine PENDING.
export default async function CheckoutSuccessPage({ searchParams }: SuccessPageProps) {
  const { order_id: orderId } = await searchParams;

  if (!orderId) notFound();

  const session = await auth();

  // Verify the order belongs to the logged-in customer
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerId: true,
      status: true,
      totalAmount: true,
      venue: { select: { name: true } },
      items: { select: { tierName: true, quantity: true } },
    },
  });

  if (!order) notFound();
  if (session?.user && order.customerId !== session.user.id) notFound();

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Il tuo ordine</CardTitle>
        </CardHeader>
        <CardContent>
          <PollingTicketReady
            orderId={order.id}
            initialStatus={order.status === "PAID" ? "PAID" : "PENDING"}
            summary={{
              venueName: order.venue.name,
              total: formatEur(order.totalAmount),
              items: order.items.map((i) => ({ tierName: i.tierName, quantity: i.quantity })),
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
