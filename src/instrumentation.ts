// Hook register() di Next.js: gira una volta all'avvio del server.
// In produzione verifica le env var critiche e BLOCCA l'avvio se mancano:
// meglio un deploy fallito subito che un'app senza rate limiting o senza
// segreti (es. limiter Upstash null = fail-open silenzioso).

const REQUIRED_PRODUCTION_ENV = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "STAFF_JWT_SECRET",
  "ADMIN_JWT_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_CONNECT_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "NEXT_PUBLIC_APP_URL",
] as const;

export async function register() {
  // Solo runtime Node.js: nel runtime Edge (middleware) le env non sono
  // necessariamente tutte visibili e il check darebbe falsi positivi.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;

  const missing = REQUIRED_PRODUCTION_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Avvio bloccato: variabili d'ambiente critiche mancanti in produzione: ${missing.join(", ")}. ` +
        "Configurale nell'ambiente di deploy (es. Vercel → Settings → Environment Variables) e rifai il deploy."
    );
  }
}
