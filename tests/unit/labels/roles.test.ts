import { describe, it, expect } from "vitest";
import { ADMIN_ROLE_LABELS, OPERATOR_ROLE_LABELS } from "@/lib/labels/roles";

// Nomenclatura unificata delle tre figure: gli utenti confondono le tre
// porte, quindi le etichette sono fissate qui e usate ovunque (gli enum DB
// non cambiano). Questo test blocca regressioni tipo "Manager" nudo.

describe("nomenclatura ruoli", () => {
  it("Operator MANAGER → Responsabile di locale", () => {
    expect(OPERATOR_ROLE_LABELS["MANAGER"]).toBe("Responsabile di locale");
    expect(OPERATOR_ROLE_LABELS["BARISTA"]).toBe("Barista");
    expect(OPERATOR_ROLE_LABELS["CASSIERE"]).toBe("Cassiere");
  });

  it("AdminUser ORG_ADMIN/PLATFORM → Amministratore organizzazione/piattaforma", () => {
    expect(ADMIN_ROLE_LABELS["ORG_ADMIN"]).toBe("Amministratore organizzazione");
    expect(ADMIN_ROLE_LABELS["PLATFORM"]).toBe("Amministratore piattaforma");
  });
});
