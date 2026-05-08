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
