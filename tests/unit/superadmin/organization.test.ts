import { describe, it, expect } from "vitest";
import { adminUserRoleOrgSchema } from "@/lib/validators/admin-user";
import { orgScopeWhere } from "@/lib/auth/org-scope";

// ── Regola di integrità AdminUser ────────────────────────────────────────────
// role PLATFORM ⇒ organizationId null; role ORG_ADMIN ⇒ organizationId obbligatorio

describe("adminUserRoleOrgSchema (regola di integrità)", () => {
  it("PLATFORM senza organizationId → valido, organizationId null", () => {
    const r = adminUserRoleOrgSchema.safeParse({ role: "PLATFORM" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({ role: "PLATFORM", organizationId: null });
    }
  });

  it("PLATFORM con organizationId → NON valido", () => {
    const r = adminUserRoleOrgSchema.safeParse({ role: "PLATFORM", organizationId: "org-1" });
    expect(r.success).toBe(false);
  });

  it("ORG_ADMIN con organizationId → valido", () => {
    const r = adminUserRoleOrgSchema.safeParse({ role: "ORG_ADMIN", organizationId: "org-1" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({ role: "ORG_ADMIN", organizationId: "org-1" });
    }
  });

  it("ORG_ADMIN senza organizationId → NON valido", () => {
    expect(adminUserRoleOrgSchema.safeParse({ role: "ORG_ADMIN" }).success).toBe(false);
    expect(
      adminUserRoleOrgSchema.safeParse({ role: "ORG_ADMIN", organizationId: null }).success
    ).toBe(false);
  });

  it("default: role assente → ORG_ADMIN, quindi richiede organizationId", () => {
    expect(adminUserRoleOrgSchema.safeParse({}).success).toBe(false);
    const r = adminUserRoleOrgSchema.safeParse({ organizationId: "org-1" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.role).toBe("ORG_ADMIN");
  });

  it("organizationId vuoto/spazi → NON valido per ORG_ADMIN", () => {
    expect(
      adminUserRoleOrgSchema.safeParse({ role: "ORG_ADMIN", organizationId: "  " }).success
    ).toBe(false);
  });
});

// ── orgScopeWhere ────────────────────────────────────────────────────────────

describe("orgScopeWhere", () => {
  it("PLATFORM → nessun filtro (vede tutto)", () => {
    const scope = orgScopeWhere({ role: "PLATFORM", organizationId: null });
    expect(scope.isPlatform).toBe(true);
    expect(scope.venue).toEqual({});
    expect(scope.byVenue).toEqual({});
    expect(scope.byOrder).toEqual({});
    expect(scope.audit).toEqual({});
    expect(scope.adminUser).toEqual({});
    expect(scope.organization).toEqual({});
  });

  it("ORG_ADMIN → filtri sulla propria organizzazione per ogni modello", () => {
    const scope = orgScopeWhere({ role: "ORG_ADMIN", organizationId: "org-1" });
    expect(scope.isPlatform).toBe(false);
    expect(scope.venue).toEqual({ organizationId: "org-1" });
    expect(scope.byVenue).toEqual({ venue: { organizationId: "org-1" } });
    expect(scope.byOrder).toEqual({ order: { venue: { organizationId: "org-1" } } });
    expect(scope.audit).toEqual({ organizationId: "org-1" });
    expect(scope.adminUser).toEqual({ organizationId: "org-1" });
    expect(scope.organization).toEqual({ id: "org-1" });
  });

  it("ORG_ADMIN malformato (senza org) → non vede nulla, non tutto", () => {
    // Difesa in profondità: una sessione che viola la regola di integrità
    // deve produrre un filtro che non matcha niente.
    const scope = orgScopeWhere({ role: "ORG_ADMIN", organizationId: null });
    expect(scope.isPlatform).toBe(false);
    expect(scope.venue).not.toEqual({});
    expect((scope.venue as { organizationId: string }).organizationId).toBeTruthy();
  });
});
