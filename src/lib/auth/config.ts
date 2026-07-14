import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { CustomerPrismaAdapter } from "@/lib/auth/adapter";
import { db } from "@/lib/db";

export const authConfig = {
  adapter: CustomerPrismaAdapter(db),
  providers: [
    Google({
      clientId: process.env["GOOGLE_CLIENT_ID"],
      clientSecret: process.env["GOOGLE_CLIENT_SECRET"],
    }),
    Resend({
      apiKey: process.env["RESEND_API_KEY"],
      from: process.env["EMAIL_FROM"],
      async sendVerificationRequest({ identifier: email, url }) {
        const { Resend: ResendClient } = await import("resend");
        const apiKey = process.env["RESEND_API_KEY"];
        const from = process.env["EMAIL_FROM"];
        if (!apiKey || !from) {
          throw new Error("RESEND_API_KEY o EMAIL_FROM mancanti nelle variabili d'ambiente");
        }
        const resend = new ResendClient(apiKey);
        const { EMAIL_COLORS, emailCta, emailLayout } = await import("@/lib/email/brand");
        const { BRAND_NAME } = await import("@/lib/brand");
        const { error } = await resend.emails.send({
          from,
          to: email,
          subject: `Accedi a ${BRAND_NAME}`,
          html: emailLayout({
            title: `Accedi a ${BRAND_NAME}`,
            bodyHtml: `
              <h1 style="margin: 0 0 8px; font-size: 24px; color: ${EMAIL_COLORS.ink};">Accedi al tuo account</h1>
              <p style="margin: 0 0 24px; color: ${EMAIL_COLORS.inkSoft}; line-height: 1.5;">
                Tocca il pulsante qui sotto per entrare. Il link è valido per 24 ore.
              </p>
              ${emailCta(url, "Accedi")}
              <p style="margin: 0; color: ${EMAIL_COLORS.inkMuted}; font-size: 13px; text-align: center;">
                Se non hai richiesto questo accesso, ignora questa email.
              </p>`,
          }),
          text: `Accedi al tuo account: ${url}\n\nIl link è valido per 24 ore.`,
        });
        if (error) {
          throw new Error(`Errore invio email: ${error.message}`);
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verifica-email",
    error: "/login/errore",
  },
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 giorni
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
