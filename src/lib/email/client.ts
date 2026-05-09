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
