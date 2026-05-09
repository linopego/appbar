import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { resend } from "./client";
import { renderOrderConfirmationHtml } from "./templates/order-confirmation";
import { formatEur } from "@/lib/utils/money";

export async function sendOrderConfirmationEmail(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      venue: true,
      items: { include: { priceTier: true } },
      tickets: true,
    },
  });

  if (!order) throw new Error(`Order ${orderId} non trovato`);
  if (!order.customer.email) throw new Error(`Order ${orderId} senza email cliente`);

  const from = process.env["EMAIL_FROM"];
  if (!from) throw new Error("EMAIL_FROM non configurato");

  const appUrl =
    process.env["NEXT_PUBLIC_APP_URL"] ?? process.env["NEXTAUTH_URL"] ?? "http://localhost:3000";
  const orderUrl = `${appUrl}/ordine/${order.id}`;

  const html = renderOrderConfirmationHtml({
    customerName: order.customer.firstName ?? order.customer.email,
    venueName: order.venue.name,
    orderId: order.id,
    items: order.items.map((item) => ({
      name: item.tierName,
      quantity: item.quantity,
      unitPrice: formatEur(item.unitPrice),
      subtotal: formatEur(new Prisma.Decimal(item.unitPrice).times(item.quantity)),
    })),
    total: formatEur(order.totalAmount),
    ticketsCount: order.tickets.length,
    expiresAt: order.tickets[0]?.expiresAt ?? new Date(),
    orderUrl,
  });

  const { error } = await resend.emails.send({
    from,
    to: order.customer.email,
    subject: `I tuoi ticket — ${order.venue.name}`,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
