// Giorni interi mancanti alla scadenza (arrotondati per eccesso: "scade tra
// 1 giorno" fino all'ultimo istante). Soglia di evidenza: 7 giorni.

export const EXPIRY_WARNING_DAYS = 7;

export function daysUntil(expiresAt: Date, now: Date): number {
  return Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000);
}

export function isExpiringSoon(expiresAt: Date, now: Date): boolean {
  const days = daysUntil(expiresAt, now);
  return days > 0 && days <= EXPIRY_WARNING_DAYS;
}

export function expiryLabel(expiresAt: Date, now: Date): string {
  const days = daysUntil(expiresAt, now);
  if (days <= 0) return "Scaduto";
  if (days === 1) return "Scade tra 1 giorno";
  return `Scade tra ${days} giorni`;
}
