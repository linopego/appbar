// "I tuoi locali" in /home: i locali dove il cliente ha già ordini PAID,
// dal più recente, senza doppioni, massimo 4. Il chiamante passa gli ordini
// già ordinati per createdAt desc (una sola query, niente N+1).

export interface OrderWithVenue {
  createdAt: Date;
  venue: { name: string; slug: string };
}

export const RECENT_VENUES_MAX = 4;

export function pickRecentVenues(
  orders: OrderWithVenue[],
  max: number = RECENT_VENUES_MAX
): { name: string; slug: string }[] {
  const seen = new Set<string>();
  const venues: { name: string; slug: string }[] = [];
  for (const order of orders) {
    if (seen.has(order.venue.slug)) continue;
    seen.add(order.venue.slug);
    venues.push({ name: order.venue.name, slug: order.venue.slug });
    if (venues.length >= max) break;
  }
  return venues;
}
