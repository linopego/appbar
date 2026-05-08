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

L'auth staff (PIN operatori) e l'auth super-admin (email + 2FA) sono sistemi separati,
non gestiti da NextAuth.

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
