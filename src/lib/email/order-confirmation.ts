import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { resend } from "./client";
import { renderOrderConfirmationHtml } from "./templates/order-confirmation";
import { formatEur } from "@/lib/utils/money";
import { isAppleWalletConfigured, isGoogleWalletConfigured } from "@/lib/wallet/config";

export async function sendOrderConfirmationEmail(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      venue: true,
      items: { include: { priceTier: true } },
      tickets: { include: { priceTier: { select: { name: true } } } },
      // Documento commerciale: il link compare solo se già emesso all'invio
      // (di norma l'emissione è successiva; la pagina ordine lo mostra sempre)
      fiscalDocuments: {
        where: { type: "SALE", status: "CONFIRMED" },
        select: { pdfUrl: true },
        take: 1,
      },
    },
  });

  if (!order) throw new Error(`Order ${orderId} non trovato`);
  if (!order.customer.email) throw new Error(`Order ${orderId} senza email cliente`);

  const from = process.env["EMAIL_FROM"];
  if (!from) throw new Error("EMAIL_FROM non configurato");

  const appUrl =
    process.env["NEXT_PUBLIC_APP_URL"] ?? process.env["NEXTAUTH_URL"] ?? "http://localhost:3000";
  const orderUrl = `${appUrl}/ordine/${order.id}`;

  // Link "Aggiungi al Wallet" per ticket, solo se il modulo è configurato
  const appleOn = isAppleWalletConfigured();
  const googleOn = isGoogleWalletConfigured();
  const walletLinks =
    appleOn || googleOn
      ? order.tickets.map((ticket, i) => ({
          label: `Ticket ${i + 1} — ${ticket.priceTier.name}`,
          ...(appleOn ? { appleUrl: `${appUrl}/api/tickets/${ticket.qrToken}/wallet/apple` } : {}),
          ...(googleOn
            ? { googleUrl: `${appUrl}/api/tickets/${ticket.qrToken}/wallet/google` }
            : {}),
        }))
      : undefined;

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
    ...(walletLinks ? { walletLinks } : {}),
    ...(order.fiscalDocuments[0]?.pdfUrl
      ? { receiptPdfUrl: order.fiscalDocuments[0].pdfUrl }
      : {}),
  });

  const subject = `I tuoi ticket — ${order.venue.name}`;
  const { data, error } = await resend.emails.send({
    from,
    to: order.customer.email,
    subject,
    html,
  });

  await db.emailLog.create({
    data: {
      to: order.customer.email,
      subject,
      template: "order-confirmation",
      resendId: data?.id ?? null,
      status: error ? "FAILED" : "SENT",
      errorMessage: error?.message ?? null,
      metadata: { orderId: order.id, venueId: order.venueId },
    },
  }).catch(() => {});

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
