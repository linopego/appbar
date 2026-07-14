// Visibilità pubblica dei venue (homepage, accesso staff):
// un venue è visibile solo se attivo E la sua organizzazione è attiva.
// Le organizzazioni sono un dettaglio interno: mai esporle al pubblico.

export const publicVenuesWhere = {
  active: true,
  organization: { active: true },
} as const;

export interface PublicVisibilityInput {
  active: boolean;
  organization: { active: boolean };
}

export function isPubliclyVisible(venue: PublicVisibilityInput): boolean {
  return venue.active === true && venue.organization.active === true;
}
