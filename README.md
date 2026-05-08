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
