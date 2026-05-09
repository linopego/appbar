import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { resend } from "./client";
import { renderRefundRequestedHtml } from "./templates/refund-requested";
import { renderRefundApprovedHtml } from "./templates/refund-approved";
import { renderRefundRejectedHtml } from "./templates/refund-rejected";
import { renderRefundNewForManagerHtml } from "./templates/refund-new-for-manager";
import { formatEur } from "@/lib/utils/money";

async function logEmail(opts: {
  to: string;
  subject: string;
  template: string;
  resendId?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await db.emailLog.create({
    data: {
      to: opts.to,
      subject: opts.subject,
      template: opts.template,
      resendId: opts.resendId ?? null,
      status: opts.error ? "FAILED" : "SENT",
      errorMessage: opts.error ?? null,
      metadata: opts.metadata as Prisma.InputJsonValue | undefined,
    },
  }).catch(() => {});
}

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
  const subject = "Richiesta di rimborso ricevuta";
  const { data, error } = await resend.emails.send({ from: getFrom(), to: opts.customerEmail, subject, html });
  await logEmail({ to: opts.customerEmail, subject, template: "refund-requested", resendId: data?.id, error: error?.message, metadata: { refundId: opts.refundId } });
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
  const subject = "Rimborso approvato";
  const { data, error } = await resend.emails.send({ from: getFrom(), to: opts.customerEmail, subject, html });
  await logEmail({ to: opts.customerEmail, subject, template: "refund-approved", resendId: data?.id, error: error?.message, metadata: { refundId: opts.refundId } });
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
  const subject = "Rimborso non approvato";
  const { data, error } = await resend.emails.send({ from: getFrom(), to: opts.customerEmail, subject, html });
  await logEmail({ to: opts.customerEmail, subject, template: "refund-rejected", resendId: data?.id, error: error?.message, metadata: { refundId: opts.refundId } });
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
  const subject = `Nuova richiesta rimborso – ${opts.venueName}`;
  const { data, error } = await resend.emails.send({ from: getFrom(), to: opts.managerEmail, subject, html });
  await logEmail({ to: opts.managerEmail, subject, template: "refund-new-for-manager", resendId: data?.id, error: error?.message, metadata: { refundId: opts.refundId } });
}
