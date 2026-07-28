import { Decimal } from "@prisma/client/runtime/library";

// ─────────────────────────────────────────────────────────────────────────────
// Validazione condivisa delle fasce di prezzo (PriceTier), usata sia dalle
// route del responsabile di locale (/api/admin/price-tiers) sia da quelle
// superadmin (/api/superadmin/.../price-tiers): stesse regole, un solo posto.
//
// SNAPSHOT INVARIATI: modificare una fascia NON tocca mai ciò che è già stato
// venduto — OrderItem congela tierName/unitPrice al momento dell'acquisto e i
// FiscalDocument congelano le righe con l'aliquota. Qui si valida solo il
// listino corrente. Le fasce non si eliminano mai fisicamente (lo storico
// ordini le referenzia): solo disattivazione.
// ─────────────────────────────────────────────────────────────────────────────

export interface TierCreateData {
  name: string;
  price: Decimal;
  sortOrder: number;
  active: boolean;
  vatRate: Decimal | null;
}

export interface TierUpdateData {
  name?: string;
  price?: Decimal;
  sortOrder?: number;
  vatRate?: Decimal | null; // null = aliquota rimossa
}

export type TierParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

// Guardie del modulo fiscale: con l'emissione attiva ogni fascia ATTIVA deve
// avere l'aliquota (togliergliela o riattivarla senza romperebbe l'emissione)
export const VAT_REQUIRED_ON_UPDATE_ERROR =
  "Il modulo fiscale è attivo: ogni fascia attiva deve avere un'aliquota IVA";
export const VAT_REQUIRED_ON_ACTIVATE_ERROR =
  "Il modulo fiscale è attivo: imposta l'aliquota IVA prima di riattivare la fascia";

// Aliquota IVA opzionale: assente/""/null → null (non impostata)
export function parseTierVatRate(value: unknown): TierParseResult<Decimal | null> {
  if (value === undefined || value === null || value === "") {
    return { ok: true, data: null };
  }
  try {
    const vat = new Decimal(String(value));
    if (vat.lt(0) || vat.gt(99.99)) throw new Error();
    return { ok: true, data: vat };
  } catch {
    return { ok: false, error: "vatRate deve essere una percentuale tra 0 e 99.99" };
  }
}

export function parseTierCreateInput(body: {
  name?: unknown;
  price?: unknown;
  sortOrder?: unknown;
  active?: unknown;
  vatRate?: unknown;
}): TierParseResult<TierCreateData> {
  if (typeof body.name !== "string" || body.name.trim() === "") {
    return { ok: false, error: "name è obbligatorio" };
  }
  if (typeof body.price !== "string" && typeof body.price !== "number") {
    return { ok: false, error: "price non valido" };
  }

  let price: Decimal;
  try {
    price = new Decimal(String(body.price));
    if (price.lte(0)) throw new Error();
  } catch {
    return { ok: false, error: "price deve essere un decimale > 0" };
  }

  let sortOrder = 100;
  if (body.sortOrder !== undefined) {
    const so = Number(body.sortOrder);
    if (!Number.isInteger(so) || so < 0) {
      return { ok: false, error: "sortOrder deve essere un intero >= 0" };
    }
    sortOrder = so;
  }

  const vat = parseTierVatRate(body.vatRate);
  if (!vat.ok) return vat;

  return {
    ok: true,
    data: {
      name: body.name.trim(),
      price,
      sortOrder,
      active: body.active !== undefined ? Boolean(body.active) : true,
      vatRate: vat.data,
    },
  };
}

export function parseTierUpdateInput(body: {
  name?: unknown;
  price?: unknown;
  sortOrder?: unknown;
  vatRate?: unknown;
}): TierParseResult<TierUpdateData> {
  const updates: TierUpdateData = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim() === "") {
      return { ok: false, error: "name non valido" };
    }
    updates.name = body.name.trim();
  }

  if (body.price !== undefined) {
    try {
      const price = new Decimal(String(body.price));
      if (price.lte(0)) throw new Error();
      updates.price = price;
    } catch {
      return { ok: false, error: "price deve essere un decimale > 0" };
    }
  }

  if (body.sortOrder !== undefined) {
    const so = Number(body.sortOrder);
    if (!Number.isInteger(so) || so < 0) {
      return { ok: false, error: "sortOrder deve essere un intero >= 0" };
    }
    updates.sortOrder = so;
  }

  if (body.vatRate !== undefined) {
    const vat = parseTierVatRate(body.vatRate);
    if (!vat.ok) return vat;
    updates.vatRate = vat.data;
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: "Nessun campo da aggiornare" };
  }
  return { ok: true, data: updates };
}

// Diff old/new per l'audit log, solo sui campi effettivamente aggiornati
export function tierAuditDiff(
  tier: { name: string; price: Decimal; sortOrder: number; vatRate: Decimal | null },
  updates: TierUpdateData
): { old: Record<string, unknown>; new: Record<string, unknown> } {
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  if (updates.name !== undefined) {
    oldValues.name = tier.name;
    newValues.name = updates.name;
  }
  if (updates.price !== undefined) {
    oldValues.price = tier.price.toString();
    newValues.price = updates.price.toString();
  }
  if (updates.sortOrder !== undefined) {
    oldValues.sortOrder = tier.sortOrder;
    newValues.sortOrder = updates.sortOrder;
  }
  if (updates.vatRate !== undefined) {
    oldValues.vatRate = tier.vatRate?.toString() ?? null;
    newValues.vatRate = updates.vatRate?.toString() ?? null;
  }
  return { old: oldValues, new: newValues };
}
