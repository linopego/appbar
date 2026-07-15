# Klink — Brand Identity v1.1

Fonte di verità per l'identità visiva di Klink. Ogni implementazione UI deve rispettare questo documento. Versione 1.1 (pre-revisione grafico professionista): i valori sono centralizzati proprio per rendere facile una futura revisione.

Changelog v1.1: sfondo pagina da panna a grigio freddo (#F5F6F8) con rinomina del token in `--klink-bg`; bordo freddo (#E4E7EC); nuovo token `--klink-error-soft`; nuova sezione "Feedback di pressione".

---

## 1. Nome e voce

- **Nome prodotto**: Klink (maiuscola iniziale nel testo; il wordmark è sempre minuscolo: `klink`)
- **Cos'è in una frase**: "Compri i drink prima, li ritiri con un QR."
- **Tono di voce (area clienti)**: fresco, diretto, amichevole ma non caricaturale. Dare del "tu". Frasi corte. Niente gergo tecnico ("ticket" sì, "token QR" mai verso il cliente)
- **Tono di voce (staff/admin)**: asciutto, funzionale, italiano formale-chiaro ("Conferma", "Saldo giornata", "Già consegnato")
- **Mai**: punti esclamativi multipli, CAPS LOCK, anglicismi inutili ("purchase" no, "acquista" sì)

Il nome del prodotto vive in `src/lib/brand.ts` (`BRAND_NAME = "Klink"`): mai hardcodarlo altrove.

## 2. Logo

Il marchio è la **scintilla Klink** (sparkle a 4 punte con fianchi concavi + scintilla satellite) su tessera lime con angoli arrotondati.

### Mark ufficiale (SVG canonico)

```svg
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Klink">
  <rect width="64" height="64" rx="16" fill="#C8FF2E"/>
  <path d="M30 12 Q33 32 54 36 Q33 40 30 60 Q27 40 6 36 Q27 32 30 12 Z" fill="#0F1230" transform="translate(2 -4)"/>
  <path d="M52 10 Q53 16 59 17 Q53 18 52 24 Q51 18 45 17 Q51 16 52 10 Z" fill="#0F1230"/>
</svg>
```

### Varianti

- **Mark**: la tessera sopra, da sola (favicon, app icon, avatar social, timbro sui poster QR)
- **Lockup orizzontale**: mark + wordmark `klink` in Sora Bold minuscolo, colore Ink, distanza = 1/2 della larghezza del mark, allineamento verticale centrato
- **Su fondo scuro (Ink)**: il mark resta identico (la tessera lime si staglia); il wordmark diventa bianco
- **Monocromia**: tutta Ink su fondi chiari, tutta bianca su fondi scuri (scintilla ritagliata nella tessera)

### Regole d'uso

- Area di rispetto: minimo 1/2 dell'altezza del mark su ogni lato
- Dimensione minima: 20px (mark), 90px (lockup)
- MAI: ruotare, ombreggiare, applicare gradienti, cambiare i colori fuori dalle varianti previste, deformare le proporzioni

## 3. Palette

### Colori di marca

| Token | Hex | Uso |
|---|---|---|
| `--klink-lime` | `#C8FF2E` | Accento di marca: CTA primarie, highlight, tessera del logo, feedback positivo POS |
| `--klink-lime-hover` | `#ADE61A` | Stato hover/pressed degli elementi lime |
| `--klink-lime-soft` | `#F2FFD1` | Sfondi tinta lime (badge, righe evidenziate) |
| `--klink-ink` | `#0F1230` | Testo primario, superfici scure, scintilla del logo |
| `--klink-ink-soft` | `#4A4E6B` | Testo secondario |
| `--klink-ink-muted` | `#8A8FA8` | Testo terziario, placeholder |
| `--klink-bg` | `#F5F6F8` | Sfondo pagina area pubblica (grigio freddo) |
| `--klink-white` | `#FFFFFF` | Card e superfici |
| `--klink-border` | `#E4E7EC` | Bordi hairline |

### Colori funzionali

| Token | Hex | Uso |
|---|---|---|
| `--klink-success` | `#C8FF2E` | Esito positivo (ticket valido = lime: il colore di marca È il colore del "sì") |
| `--klink-error` | `#E2472B` | Errori, ticket non valido/già consumato |
| `--klink-error-soft` | `#FCE8E3` | Tinta chiara dell'error: flash di pressione delle azioni negative, sfondi d'errore leggeri |
| `--klink-warning` | `#F0A500` | Avvisi (ticket in scadenza, onboarding incompleto) |
| `--klink-info` | `#2563EB` | Informazioni neutre |

### Regole di contrasto (vincolanti)

- Il lime NON è mai un colore di testo. Su lime si scrive SOLO in Ink (contrasto 14:1)
- MAI testo bianco su lime (contrasto insufficiente)
- Testo su bg/bianco: Ink o Ink-soft; Ink-muted solo per placeholder e didascalie
- Su Ink: testo bianco o lime (il lime su Ink è consentito perché usato a taglie grandi/bold)

## 4. Tipografia

- **Display/headings/wordmark**: **Sora** (Google Fonts), pesi 600 e 700. Titoli in sentence case, mai tutto maiuscolo
- **Body/UI**: **Inter** (Google Fonts), pesi 400, 500, 600
- Caricamento via `next/font/google` con `display: swap`, variabili CSS `--font-display` e `--font-body`
- Scala: h1 32/40px (mobile/desktop), h2 24/28, h3 18/20, body 16, small 14, caption 12. POS: minimo 18px come da requisiti esistenti
- Numeri e importi: Inter con `font-variant-numeric: tabular-nums` nelle tabelle e nel POS

## 5. Forma e spazio

- Radius: card 16px, controlli (input, select) 10px, bottoni primari pill (9999px), tessera logo 25% del lato
- Bordi: 1px `--klink-border`; niente ombre pesanti — ammessa solo un'ombra soft sulle card interattive (`0 1px 3px rgb(15 18 48 / 0.06)`)
- Spaziatura: scala 4px (4, 8, 12, 16, 24, 32, 48)
- NIENTE gradienti, glassmorphism, glow, neon — sugli elementi STATICI (per il tocco vedi §6-bis)

## 6. Componenti chiave

- **Bottone primario**: sfondo lime, testo Ink 600, pill, altezza ≥44px (touch)
- **Bottone secondario**: bordo Ink 1px, testo Ink, sfondo trasparente
- **Badge stato ticket**: Attivo = lime-soft con testo Ink; Consumato = grigio neutro; Scaduto = warning-soft; Rimborsato = neutro con bordo
- **Card ticket (cliente)**: bianca, radius 16, QR grande centrato, nome fascia in Sora 600, scintilla mark come watermark discreto nell'angolo
- **Feedback POS**: overlay esito a schermo pieno — VALIDO = fondo lime, icona/testo Ink, "Consegnato ✓"; NON VALIDO = fondo error, testo bianco. Durata 2s come da flusso esistente

## 6-bis. Feedback di pressione

Regola: al momento del tocco, le azioni AFFERMATIVE si illuminano di lime, quelle NEGATIVE di rosso. È l'unica eccezione codificata alla regola "niente glow": vale SOLO per lo stato pressed, mai per elementi statici.

- **Azioni affermative** (bottone +, aggiungi al carrello, conferma, approva, CTA primarie): allo stato active/pressed lo sfondo si accende di lime (`--klink-lime` pieno; se l'elemento è già lime, vira su `--klink-lime-hover`), con leggera scala 0.97 e transizione ~150ms
- **Azioni negative** (bottone −, rimuovi, annulla, rifiuta): allo stato pressed flash di `--klink-error-soft` con testo/icona che vira su `--klink-error`, stessa scala e durata
- **Implementazione**: classi/varianti condivise nel design system (variante del Button, utility comuni) — MAI stili copiati caso per caso
- **Accessibilità**: con `prefers-reduced-motion` niente scala, solo il cambio colore

## 7. Applicazione per area

| Area | Trattamento |
|---|---|
| Pubblico (home, venue, acquisto, ticket, email) | Brand pieno: fondo bg grigio freddo, card bianche, CTA lime, headings Sora |
| POS staff | Neutro chiaro, brand solo nel logo in header e nei colori di feedback. La leggibilità vince sempre sull'estetica |
| Admin manager | Neutro chiaro, accenti lime piccoli (tab attiva, bottone primario) |
| Super-admin piattaforma | Mantiene il tema scuro esistente, base Ink, accento lime per elementi attivi. Distinguibile dal resto |
| Email transazionali | Header Ink con lockup bianco, corpo bianco, CTA lime, QR grande su bianco |

## 8. Asset nel repo

- `src/components/brand/logo.tsx` — componente `<KlinkLogo variant="mark" | "lockup" | "mono" />`
- `src/app/icon.svg` + `favicon.ico` + `apple-icon.png` — dal mark canonico
- `src/lib/brand.ts` — `BRAND_NAME`, tagline, eventuali costanti di marca
- Tutti i colori SOLO come variabili CSS/temi Tailwind definiti in `globals.css`: mai hex sparsi nei componenti (eccezioni: modulo costanti email `src/lib/email/brand.ts`, SVG del logo)
