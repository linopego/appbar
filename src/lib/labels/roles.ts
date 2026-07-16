// Nomenclatura UNIFICATA delle tre figure (UI, email, testi — ovunque):
//   Operator MANAGER    → "Responsabile di locale"
//   AdminUser ORG_ADMIN → "Amministratore organizzazione"
//   AdminUser PLATFORM  → "Amministratore piattaforma"
// Gli enum e le colonne DB NON cambiano: qui vivono solo le etichette.

export const OPERATOR_ROLE_LABELS: Record<string, string> = {
  BARISTA: "Barista",
  CASSIERE: "Cassiere",
  MANAGER: "Responsabile di locale",
};

export const ADMIN_ROLE_LABELS: Record<string, string> = {
  ORG_ADMIN: "Amministratore organizzazione",
  PLATFORM: "Amministratore piattaforma",
};
