import { resend } from "./client";
import { renderRefundRequestedHtml } from "./templates/refund-requested";
import { renderRefundApprovedHtml } from "./templates/refund-approved";
import { renderRefundRejectedHtml } from "./templates/refund-rejected";
import { renderRefundNewForManagerHtml } from "./templates/refund-new-for-manager";
import { formatEur } from "@/lib/utils/money";

function getFrom(): string {
  const from = process.env["EMAIL_FROM"];
  if (!from) throw new Error("EMAIL_FROM non configurato");
  return from;
}

function appUrl(): string {
  return process.env["NEXT_PUBLIC_APP_URL"] ?? process.env["NEXTAUTH_URL"] ?? "http://localhost:3000";
}

export async function sendRefundRequestedEmail(opts: {
  customerEmail: string;
  customerName: string;
  venueName: string;
  refundId: string;
  amount: string; // e.g. "10.00"
  ticketCount: number;
  reason: string;
}) {
  const html = renderRefundRequestedHtml({
    ...opts,
    amount: formatEur(opts.amount),
    refundUrl: `${appUrl()}/profilo/rimborsi/${opts.refundId}`,
  });
  await resend.emails.send({
    from: getFrom(),
    to: opts.customerEmail,
    subject: "Richiesta di rimborso ricevuta",
    html,
  });
}

export async function sendRefundApprovedEmail(opts: {
  customerEmail: string;
  customerName: string;
  venueName: string;
  refundId: string;
  amount: string;
  ticketCount: number;
  managerNote?: string | null;
}) {
  const html = renderRefundApprovedHtml({
    ...opts,
    amount: formatEur(opts.amount),
    refundUrl: `${appUrl()}/profilo/rimborsi/${opts.refundId}`,
  });
  await resend.emails.send({
    from: getFrom(),
    to: opts.customerEmail,
    subject: "Rimborso approvato",
    html,
  });
}

export async function sendRefundRejectedEmail(opts: {
  customerEmail: string;
  customerName: string;
  venueName: string;
  refundId: string;
  amount: string;
  ticketCount: number;
  managerNote?: string | null;
}) {
  const html = renderRefundRejectedHtml({
    ...opts,
    amount: formatEur(opts.amount),
    refundUrl: `${appUrl()}/profilo/rimborsi/${opts.refundId}`,
  });
  await resend.emails.send({
    from: getFrom(),
    to: opts.customerEmail,
    subject: "Rimborso non approvato",
    html,
  });
}

export async function sendRefundNewForManagerEmail(opts: {
  managerEmail: string;
  managerName: string;
  customerName: string;
  customerEmail: string;
  venueName: string;
  refundId: string;
  amount: string;
  ticketCount: number;
  reason: string;
}) {
  const html = renderRefundNewForManagerHtml({
    ...opts,
    amount: formatEur(opts.amount),
    adminUrl: `${appUrl()}/admin/rimborsi/${opts.refundId}`,
  });
  await resend.emails.send({
    from: getFrom(),
    to: opts.managerEmail,
    subject: `Nuova richiesta rimborso – ${opts.venueName}`,
    html,
  });
}
