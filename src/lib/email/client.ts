import { Resend } from "resend";

let _resend: Resend | null = null;

export function getResend(): Resend {
  if (_resend) return _resend;
  const key = process.env["RESEND_API_KEY"];
  if (!key) throw new Error("RESEND_API_KEY non configurato");
  _resend = new Resend(key);
  return _resend;
}

export const resend = new Proxy({} as Resend, {
  get(_target, prop) {
    return getResend()[prop as keyof Resend];
  },
});

function getFrom(): string {
  const from = process.env["EMAIL_FROM"];
  if (!from) throw new Error("EMAIL_FROM non configurato");
  return from;
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  await getResend().emails.send({ from: getFrom(), to, subject, html });
}
