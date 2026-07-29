# Architettura — regole vincolanti

## Gerarchia dei ruoli (regola non negoziabile)

> **PLATFORM ⊇ ORG_ADMIN ⊇ Responsabile di locale.**
> Ogni capacità di gestione di un venue disponibile al responsabile DEVE essere
> disponibile, con lo scoping corretto, anche ai livelli superiori dal pannello
> superadmin. Le funzioni operative di banco (POS: scansione QR, consegna)
> restano dello staff.

In pratica:

- Il **responsabile di locale** gestisce il proprio venue da `/admin` (sessione
  staff, venue implicito dalla sessione).
- **ORG_ADMIN** gestisce dal pannello `/superadmin` tutti i venue della propria
  organizzazione (scoping `orgScopeWhere`).
- **PLATFORM** gestisce tutto; alcune capacità sono sue esclusive (es.
  configurazione fiscale dell'esercente, organizzazioni, Stripe Connect).

## Checklist per OGNI feature futura di gestione venue

Quando aggiungi una capacità al pannello del responsabile, **nella stessa PR**:

1. **Logica condivisa in lib** — validazioni, precondizioni e mutazioni vivono
   in `src/lib/...`, MAI duplicate nelle route. La route del responsabile e
   quella superadmin chiamano la stessa funzione (es.
   `src/lib/price-tiers/validation.ts`, `src/lib/venue-settings/validation.ts`,
   `src/lib/tickets/invalidate.ts`, `src/lib/orders/export-csv.ts`,
   `src/lib/reports/stats.ts`, `canEnableFiscal` in `src/lib/fiscal/emit.ts`).
2. **Endpoint superadmin scopato** — `requireAdmin()` + `orgScopeWhere(session)`
   nella query di caricamento del target: un venue/tier/ticket fuori scope
   risponde 404 (nessun oracolo sull'esistenza), mai un'operazione riuscita.
3. **UI nel pannello superadmin** — di norma nel dettaglio venue
   (`/superadmin/venues/[id]`) o in una pagina con selettore venue scopato
   (come Corrispettivi/Statistiche). Componenti condivisi con prop
   `endpoint`/`theme` dove ha senso (es. `RefundWindowsEditor`,
   `InvalidateTicketsForm`).
4. **Audit** — `logAdminAction` su OGNI scrittura, con `organizationId` del
   venue quando determinabile e **le stesse action string** del percorso
   responsabile (`PRICE_TIER_CREATED`, `VENUE_SETTINGS_UPDATED`,
   `VENUE_FISCAL_ENABLED`, `TICKETS_INVALIDATED`, ...): un solo vocabolario
   nell'audit log.
5. **Test** — per ogni nuovo endpoint superadmin: ORG_ADMIN fuori
   organizzazione → 404/403 senza scritture né audit; parità di validazioni
   coi percorsi responsabile (stessa lib, stessi messaggi a parità di input).

## Altri vincoli architetturali già in vigore

- **La vendita non dipende MAI dal fiscale**: emissione asincrona, ritentabile,
  osservabile (vedi `src/lib/fiscal/`). Ticket ed email si creano sempre.
- **Censimento esercente presso il provider fiscale**: NON è precondizione
  bloccante per l'attivazione del toggle (scelta di robustezza: l'attivazione
  non dipende dalla disponibilità del provider). L'adapter fa
  auto-registrazione + un solo nuovo tentativo al primo 424 "not registered";
  la UI mostra lo stato e offre la registrazione esplicita (solo PLATFORM,
  come ogni modifica di fiscalConfig).
- **Snapshot immutabili**: `OrderItem` congela nome/prezzo (e i
  `FiscalDocument` l'aliquota) al momento dell'acquisto; modificare il listino
  non tocca mai il venduto.
- **Niente eliminazioni fisiche** di entità referenziate dallo storico
  (fasce, ordini, transazioni, audit): solo disattivazione/anonimizzazione.
- **Nessun oracolo**: errori generici su login e risorse fuori scope.
- BRAND.md è vincolante per tutto ciò che è visibile all'utente.
