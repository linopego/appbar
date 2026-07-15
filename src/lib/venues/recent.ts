// "I tuoi locali" in /home: i locali dove il cliente ha già acquistato,
// dal più recente, senza doppioni, massimo 4. Il chiamante passa gli ordini
// già ordinati per createdAt desc (una sola query, niente N+1).

import type { OrderStatus } from "@prisma/client";

export interface OrderWithVenue {
  createdAt: Date;
  venue: { name: string; slug: string };
}

export interface RecentVenue {
  name: string;
  slug: string;
  lastOrderAt: Date;
}

export const RECENT_VENUES_MAX = 4;

// Contano gli ordini pagati: anche PARTIALLY_REFUNDED — un rimborso parziale
// non deve far sparire il locale dalla lista.
export const RECENT_VENUE_ORDER_STATUSES: OrderStatus[] = ["PAID", "PARTIALLY_REFUNDED"];

export function pickRecentVenues(
  orders: OrderWithVenue[],
  max: number = RECENT_VENUES_MAX
): RecentVenue[] {
  const seen = new Set<string>();
  const venues: RecentVenue[] = [];
  for (const order of orders) {
    if (seen.has(order.venue.slug)) continue;
    seen.add(order.venue.slug);
    // Ordini in ingresso dal più recente: la prima occorrenza è l'ultimo acquisto
    venues.push({
      name: order.venue.name,
      slug: order.venue.slug,
      lastOrderAt: order.createdAt,
    });
    if (venues.length >= max) break;
  }
  return venues;
}

// Sottotitolo card: "Ultimo acquisto: 12 luglio"
export function lastPurchaseLabel(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" }).format(date);
}
