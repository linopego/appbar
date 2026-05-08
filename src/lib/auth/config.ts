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
        const { error } = await resend.emails.send({
          from,
          to: email,
          subject: "Accedi al sistema ticket",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 40px auto; padding: 32px; background: #fafafa; border-radius: 12px;">
              <h2 style="margin: 0 0 16px;">Accedi al tuo account</h2>
              <p style="color: #555; line-height: 1.5;">
                Clicca il pulsante qui sotto per accedere. Il link è valido per 24 ore.
              </p>
              <a href="${url}"
                 style="display: inline-block; margin: 24px 0; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 8px;">
                Accedi
              </a>
              <p style="color: #999; font-size: 13px;">
                Se non hai richiesto questo accesso, ignora questa email.
              </p>
            </div>
          `,
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
