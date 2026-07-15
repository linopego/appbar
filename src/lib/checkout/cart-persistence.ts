// Persistenza della selezione ticket attraverso il giro di login:
// il cliente non loggato preme "Paga" → salviamo le quantità → login →
// al ritorno su /[venueSlug] le ripristiniamo. Funzioni pure e difensive:
// il payload può arrivare corrotto (storage manipolabile).

export const CART_MAX_PER_TIER = 20;

export function cartStorageKey(venueSlug: string): string {
  return `klink-cart-${venueSlug}`;
}

// Serializza solo le quantità > 0
export function serializeCart(quantities: Record<string, number>): string {
  const nonZero: Record<string, number> = {};
  for (const [id, qty] of Object.entries(quantities)) {
    if (qty > 0) nonZero[id] = qty;
  }
  return JSON.stringify(nonZero);
}

// Parse difensivo: solo tier validi, interi clampati a [0, CART_MAX_PER_TIER]
export function parseCart(
  raw: string | null,
  validTierIds: string[]
): Record<string, number> {
  if (!raw) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return {};

  const valid = new Set(validTierIds);
  const result: Record<string, number> = {};
  for (const [id, value] of Object.entries(data as Record<string, unknown>)) {
    if (!valid.has(id)) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const qty = Math.min(Math.max(Math.floor(value), 0), CART_MAX_PER_TIER);
    if (qty > 0) result[id] = qty;
  }
  return result;
}
