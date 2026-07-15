/**
 * Script una tantum: individua (ed eventualmente rimuove) i collegamenti
 * Google agganciati al cliente sbagliato.
 *
 * Contesto del bug: un cliente loggato via magic link con email A che premeva
 * "Continua con Google" con email B si ritrovava l'account Google B collegato
 * al cliente A (comportamento di linking di Auth.js con sessione attiva).
 * Il bug è chiuso dalla guardia nel callback signIn; questo script ripulisce
 * i collegamenti creati prima del fix.
 *
 * Come funziona: per ogni CustomerAccount con provider "google" estrae
 * l'email Google dal payload dell'id_token salvato (JWT, non serve verifica
 * di firma: è solo diagnostica) e la confronta, case-insensitive, con
 * l'email del Customer collegato.
 * - email diverse            → collegamento errato (rimovibile con --delete)
 * - id_token assente/illeggibile → collegamento non verificabile: viene solo
 *   segnalato, MAI rimosso automaticamente
 *
 * La rimozione cancella SOLO il collegamento (riga in `accounts`), non il
 * cliente, né sessioni, ordini o ticket. Il titolare dell'email Google potrà
 * poi accedere con Google creando/ritrovando il proprio account.
 *
 * Uso:
 *   DATABASE_URL=... pnpm tsx scripts/fix-mislinked-google.ts            # solo report
 *   DATABASE_URL=... pnpm tsx scripts/fix-mislinked-google.ts --delete   # rimuove i collegamenti errati
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Estrae l'email dal payload di un id_token JWT (base64url), senza verifica
// di firma: il token è stato salvato da noi al momento del login.
function emailFromIdToken(idToken: string | null): string | null {
  if (!idToken) return null;
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const data: unknown = JSON.parse(json);
    if (typeof data !== "object" || data === null) return null;
    const email = (data as Record<string, unknown>)["email"];
    return typeof email === "string" && email.length > 0 ? email : null;
  } catch {
    return null;
  }
}

async function main() {
  const doDelete = process.argv.includes("--delete");

  const accounts = await db.customerAccount.findMany({
    where: { provider: "google" },
    select: {
      id: true,
      providerAccountId: true,
      id_token: true,
      customer: { select: { id: true, email: true } },
    },
  });

  const mismatched: { accountId: string; googleEmail: string; customerEmail: string }[] = [];
  const unverifiable: { accountId: string; customerEmail: string }[] = [];

  for (const account of accounts) {
    const googleEmail = emailFromIdToken(account.id_token);
    if (!googleEmail) {
      unverifiable.push({ accountId: account.id, customerEmail: account.customer.email });
      continue;
    }
    if (googleEmail.toLowerCase() !== account.customer.email.toLowerCase()) {
      mismatched.push({
        accountId: account.id,
        googleEmail,
        customerEmail: account.customer.email,
      });
    }
  }

  console.log(`Account Google collegati: ${accounts.length}`);
  console.log(`Collegamenti errati (email diverse): ${mismatched.length}`);
  for (const m of mismatched) {
    console.log(`  - account ${m.accountId}: Google "${m.googleEmail}" ≠ customer "${m.customerEmail}"`);
  }
  if (unverifiable.length > 0) {
    console.log(
      `Collegamenti non verificabili (id_token assente/illeggibile): ${unverifiable.length}`
    );
    for (const u of unverifiable) {
      console.log(`  - account ${u.accountId} → customer "${u.customerEmail}" (verifica a mano)`);
    }
  }

  if (!doDelete) {
    if (mismatched.length > 0) {
      console.log('\nNessuna modifica applicata. Rilancia con "--delete" per rimuovere i collegamenti errati.');
    }
    return;
  }

  if (mismatched.length === 0) {
    console.log("\nNiente da rimuovere.");
    return;
  }

  const { count } = await db.customerAccount.deleteMany({
    where: { id: { in: mismatched.map((m) => m.accountId) } },
  });
  console.log(`\nRimossi ${count} collegamenti errati (solo il collegamento: clienti, sessioni e ticket intatti).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
