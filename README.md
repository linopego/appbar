# Sistema Ticket

Sistema cashless basato su ticket prepagati con QR code per una catena di locali (La Casa dei Gelsi, Studios Club – DECÒ, Tenuta Villa Peggy's). Supporta acquisto online, scansione POS, gestione per venue e super-admin cross-venue.

## Prerequisiti

- Node.js 20+
- pnpm
- Account [Neon](https://neon.tech) (PostgreSQL)
- Account [Stripe](https://stripe.com)
- Account [Resend](https://resend.com)
- Account [Upstash](https://upstash.com) (Redis)
- Account [Google Cloud](https://console.cloud.google.com) (OAuth)

## Setup

```bash
# 1. Installa le dipendenze
pnpm install

# 2. Copia le variabili d'ambiente
cp .env.example .env.local
# Modifica .env.local con i tuoi valori

# 3. Genera il client Prisma
pnpm prisma generate
```

## Avvio in sviluppo

```bash
pnpm dev
```

Apri [http://localhost:3000](http://localhost:3000).

## Build di produzione

```bash
pnpm build
pnpm start
```

## Configurazione auth cliente

Per abilitare il login cliente in dev:

1. Crea un progetto su [Google Cloud Console](https://console.cloud.google.com), abilita Google OAuth, aggiungi `http://localhost:3000/api/auth/callback/google` come redirect URI autorizzato.
2. Copia client ID e secret in `.env.local` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
3. Crea un account [Resend](https://resend.com), verifica un dominio (o usa il dominio di test), copia l'API key in `RESEND_API_KEY` e imposta `EMAIL_FROM`.
4. Genera `NEXTAUTH_SECRET` e mettilo in `.env.local`:
   ```bash
   openssl rand -base64 32
   ```
5. Avvia: `pnpm dev`
6. Vai su `/login` e prova il flow magic link / Google.

## Auth staff e super-admin

Tre sistemi auth coesistono nell'app, ciascuno con un proprio cookie indipendente:

| Sistema | Cookie | Scopo | Durata |
|---|---|---|---|
| Cliente | `authjs.session-token` (NextAuth) | Acquisto ticket | 30 giorni |
| Staff | `staff-session` (JWT custom) | POS operatori al banco | 12 ore |
| Super-admin | `admin-session` (JWT custom) | Pannello amministrazione | 1 ora |

I tre cookie sono separati per dominio applicativo: un utente può tecnicamente
avere tutti e tre simultaneamente (es. il super-admin che è anche cliente).

### Variabili d'ambiente aggiuntive

```bash
# Genera con: openssl rand -base64 32
STAFF_JWT_SECRET=
ADMIN_JWT_SECRET=
```

### Testare il login operatore

1. Esegui il seed: `pnpm db:seed`
2. Vai su `/staff/casa-dei-gelsi` (o `studios-deco`, `villa-peggy`)
3. Seleziona "Manager Demo" (PIN `1234`) o "Barista Demo" (PIN `5678`)
4. Sessione 12h, redirect a `/staff/[slug]/pos`

### Test del POS in locale

1. Esegui il seed: `pnpm db:seed`
2. Avvia: `pnpm dev`
3. Apri `http://localhost:3000/staff/studios-deco` **dal computer dove gira il server**
   (la camera richiede HTTPS o `localhost`)
4. Seleziona "Barista Demo" (PIN `5678`), accedi
5. Concedi i permessi camera quando richiesto dal browser
6. Su un altro browser/tab: acquista ticket come cliente, poi apri `/ordine/[id]`
7. Mostra uno dei QR alla webcam del computer
8. L'overlay verde appare con il nome fascia e prezzo
9. Clicca "✓ Consegnato"
10. L'overlay mostra la conferma e torna automaticamente allo scan dopo 2 secondi
11. Verifica in `pnpm prisma studio` che il ticket sia `CONSUMED`
12. Riscaniona lo stesso QR → overlay grigio "Già consegnato alle HH:MM da Barista Demo"
13. Le statistiche del giorno sono su `/staff/studios-deco/stats`

> **File audio**: aggiungi `beep.mp3`, `success.mp3`, `warn.mp3`, `error.mp3`
> in `public/sounds/` per abilitare il feedback audio. Senza file, il POS
> funziona silenzioso senza errori.

### Test da tablet sulla rete locale

La camera richiede **HTTPS** (o `localhost`). Da un tablet sulla rete LAN
(es. `http://192.168.1.10:3000`) non funziona senza HTTPS. Soluzioni:

- **ngrok**: `ngrok http 3000` → URL HTTPS pubblico raggiungibile da tutti i device
- **Cloudflare Tunnel**: `cloudflared tunnel --url http://localhost:3000`
- **mkcert**: certificati self-signed locali per sviluppo

In production (Vercel) HTTPS è incluso, il problema non si pone.

### Testare il login super-admin

1. Email: `linopegoraro.dir@gmail.com`
2. Password: quella temporanea stampata dal seed (cambialo nel DB se l'hai persa)
3. Al primo login viene mostrato un QR code per il setup TOTP — scansiona con
   Google Authenticator / 1Password / Authy
4. Inserisci il codice 6 cifre per completare il setup
5. Force-redirect su `/superadmin/cambio-password` (mustChangePassword)
6. Imposta una password nuova (≥12 char, maiuscole/minuscole/numeri)
7. Login successivi: email + password + codice TOTP

### Logout

- Cliente: bottone "Esci" su `/profilo` (chiama NextAuth `signOut`)
- Staff: bottone "Esci" su `/staff/[slug]/pos` (`POST /api/staff/logout`)
- Super-admin: bottone "Esci" su `/superadmin` (`POST /api/superadmin/logout`)

I cookie sono `httpOnly`, `sameSite: lax`, `secure` in produzione.

## Test webhook in dev

Stripe non può raggiungere il tuo localhost. Usa la Stripe CLI:

1. Installa Stripe CLI: `brew install stripe/stripe-cli/stripe` (macOS) o vedi
   [stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli)
2. Login: `stripe login`
3. Inoltra eventi al webhook locale:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
4. La CLI stampa un `whsec_…`: copialo in `.env.local` come `STRIPE_WEBHOOK_SECRET`
5. Riavvia `pnpm dev` per ricaricare le env
6. Fai un acquisto test con carta `4242 4242 4242 4242`
7. Vedrai negli stdout di `stripe listen` l'evento `checkout.session.completed` inoltrato
8. Nei log di Next.js vedrai il processamento + creazione ticket
9. Apri Prisma Studio (`pnpm prisma studio`): l'`Order` è ora `PAID` e ci sono N
   `Ticket` `ACTIVE`
10. La pagina `/checkout/success` ferma il polling e mostra il bottone verso il
    profilo (la pagina `/ordine/[id]` arriverà nel Prompt 7 — per ora 404, atteso)
11. L'email di conferma arriva all'indirizzo del cliente (controlla anche spam,
    e nei log della dashboard Resend)

## Test del flusso rimborso

1. Da cliente: fai un acquisto di 2-3 ticket (carta test `4242 4242 4242 4242`)
2. Aspetta che il webhook completi (verifica Order PAID in `pnpm prisma studio`)
3. Vai su `/profilo` → click sull'ordine → "Richiedi un rimborso"
4. Se sei in fascia bloccata (es. sabato sera tardi), vedrai messaggio con orario riapertura
5. Altrimenti: seleziona i ticket, scrivi motivazione (min. 10 caratteri), invia
6. Verifica email "Richiesta ricevuta" (dashboard Resend) + email al manager di test `manager-{slug}@example.com`
7. Da manager: login a `/staff/[venueSlug]` con PIN `1234` (Manager Demo)
8. Vai su `/admin/rimborsi`
9. Click sulla richiesta pending → pagina dettaglio
10. (Facoltativo) Scrivi una nota, poi click "Approva e rimborsa" → conferma
11. Verifica:
    - In DB: `Refund.status = COMPLETED` (o APPROVED), ticket `REFUNDED`, order `PARTIALLY_REFUNDED` o `REFUNDED`
    - Stripe Dashboard test mode: refund visibile
    - Email "Rimborso approvato" arriva al cliente
12. Test rifiuto: fai un'altra richiesta, da manager scrivi motivazione e click "Rifiuta"
13. Verifica: ticket restano `ACTIVE`, email rifiuto al cliente con motivazione

> **Nota:** Le email manager sono demo (`manager-{slug}@example.com`). Prima del go-live,
> imposta email reali nel DB per gli operatori con ruolo MANAGER.

## Test

```bash
# Test unitari (Vitest)
pnpm test

# Test in watch mode
pnpm test:watch

# Test E2E (Playwright)
pnpm test:e2e
```

## Struttura

```
src/
├── app/
│   ├── (public)/       # Rotte pubbliche e cliente
│   ├── (staff)/        # Rotte staff POS
│   ├── (admin)/        # Rotte admin manager venue
│   ├── (superadmin)/   # Rotte super-admin cross-venue
│   └── api/            # API routes
├── components/
│   ├── ui/             # Componenti shadcn/ui
│   └── shared/         # Componenti custom condivisi
├── lib/                # Utility e client (db, auth, stripe, email…)
└── types/              # Tipi TypeScript condivisi
```
