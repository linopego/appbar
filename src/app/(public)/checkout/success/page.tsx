import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PollingTicketReady } from "./polling-ticket-ready";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export const metadata = { title: "Pagamento completato — Sistema Ticket" };

interface SuccessPageProps {
  searchParams: Promise<{ order_id?: string }>;
}

export default async function CheckoutSuccessPage({ searchParams }: SuccessPageProps) {
  const { order_id: orderId } = await searchParams;

  if (!orderId) notFound();

  const session = await auth();

  // Verify the order belongs to the logged-in customer
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerId: true, status: true },
  });

  if (!order) notFound();
  if (session?.user && order.customerId !== session.user.id) notFound();

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Pagamento in elaborazione</CardTitle>
        </CardHeader>
        <CardContent>
          <PollingTicketReady orderId={order.id} />
        </CardContent>
      </Card>
    </main>
  );
}
