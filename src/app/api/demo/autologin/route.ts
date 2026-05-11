import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

// Disponibile SOLO se DEMO_MODE=true — rimuovi la variabile per disabilitarlo.
export async function GET(req: NextRequest) {
  if (process.env.DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Non disponibile" }, { status: 404 });
  }

  const DEMO_EMAIL = "demo@sistema-ticket.test";

  const customer = await db.customer.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      firstName: "Demo",
      lastName: "Cliente",
      emailVerified: new Date(),
    },
  });

  // Elimina sessioni demo precedenti
  await db.customerSession.deleteMany({ where: { customerId: customer.id } });

  const sessionToken = crypto.randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.customerSession.create({
    data: { sessionToken, customerId: customer.id, expires },
  });

  const appUrl = process.env.NEXTAUTH_URL ?? `https://${req.headers.get("host")}`;
  const res = NextResponse.redirect(new URL("/profilo", appUrl));

  // NextAuth v5 usa __Secure- prefix in produzione
  const isSecure = appUrl.startsWith("https");
  const cookieName = isSecure ? "__Secure-authjs.session-token" : "authjs.session-token";

  res.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    expires,
    path: "/",
  });

  return res;
}
