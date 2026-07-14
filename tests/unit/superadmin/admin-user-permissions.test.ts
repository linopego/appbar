import { describe, it, expect } from "vitest";

// Unit tests for admin user permission guards (no DB, pure logic).

interface AdminUser {
  id: string;
  email: string;
  name: string;
  active: boolean;
  totpEnabled: boolean;
  mustChangePassword: boolean;
}

function canDeactivate(currentUserId: string, targetUserId: string, activeAdminCount: number): { ok: boolean; code?: string } {
  if (currentUserId === targetUserId) return { ok: false, code: "CANNOT_DEACTIVATE_SELF" };
  if (activeAdminCount <= 1) return { ok: false, code: "CANNOT_DEACTIVATE_LAST_ADMIN" };
  return { ok: true };
}

function canResetTotp(currentUserId: string, targetUserId: string): { ok: boolean; code?: string } {
  if (currentUserId === targetUserId) return { ok: false, code: "CANNOT_RESET_OWN_TOTP" };
  return { ok: true };
}

function canResetPassword(currentUserId: string, targetUserId: string): { ok: boolean; code?: string } {
  if (currentUserId === targetUserId) return { ok: false, code: "CANNOT_RESET_OWN_PASSWORD" };
  return { ok: true };
}

function validateAdminUserCreate(email: string, name: string): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!email || email.trim() === "") errors.push("email è obbligatoria");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.push("email non valida");
  if (!name || name.trim() === "") errors.push("name è obbligatorio");
  return { ok: errors.length === 0, errors };
}

describe("canDeactivate", () => {
  const SELF = "admin-self";
  const OTHER = "admin-other";

  it("blocks self-deactivation", () => {
    const result = canDeactivate(SELF, SELF, 3);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("CANNOT_DEACTIVATE_SELF");
  });

  it("blocks deactivation when only 1 admin left", () => {
    const result = canDeactivate(SELF, OTHER, 1);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("CANNOT_DEACTIVATE_LAST_ADMIN");
  });

  it("allows deactivation with 2+ admins and different user", () => {
    const result = canDeactivate(SELF, OTHER, 2);
    expect(result.ok).toBe(true);
    expect(result.code).toBeUndefined();
  });

  it("self + only 1 admin → CANNOT_DEACTIVATE_SELF (self check first)", () => {
    const result = canDeactivate(SELF, SELF, 1);
    expect(result.code).toBe("CANNOT_DEACTIVATE_SELF");
  });
});

describe("canResetTotp", () => {
  it("blocks resetting own TOTP", () => {
    const result = canResetTotp("admin-1", "admin-1");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("CANNOT_RESET_OWN_TOTP");
  });

  it("allows resetting another admin's TOTP", () => {
    const result = canResetTotp("admin-1", "admin-2");
    expect(result.ok).toBe(true);
  });
});

describe("canResetPassword", () => {
  it("blocks resetting own password", () => {
    const result = canResetPassword("admin-1", "admin-1");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("CANNOT_RESET_OWN_PASSWORD");
  });

  it("allows resetting another admin's password", () => {
    const result = canResetPassword("admin-1", "admin-2");
    expect(result.ok).toBe(true);
  });
});

describe("validateAdminUserCreate", () => {
  it("accepts valid email and name", () => {
    const result = validateAdminUserCreate("admin@example.com", "Admin User");
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects empty email", () => {
    const result = validateAdminUserCreate("", "Admin User");
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("email è obbligatoria");
  });

  it("rejects invalid email format", () => {
    const result = validateAdminUserCreate("not-an-email", "Admin User");
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("email non valida"))).toBe(true);
  });

  it("rejects empty name", () => {
    const result = validateAdminUserCreate("admin@example.com", "");
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("name è obbligatorio");
  });

  it("collects multiple errors", () => {
    const result = validateAdminUserCreate("", "");
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe("AdminUser mustChangePassword flow", () => {
  function shouldForcePasswordChange(user: AdminUser): boolean {
    return user.active && user.mustChangePassword;
  }

  it("forces password change for new user with mustChangePassword=true", () => {
    const user: AdminUser = {
      id: "u1", email: "new@example.com", name: "New Admin",
      active: true, totpEnabled: false, mustChangePassword: true,
    };
    expect(shouldForcePasswordChange(user)).toBe(true);
  });

  it("does not force change for established user", () => {
    const user: AdminUser = {
      id: "u2", email: "existing@example.com", name: "Existing Admin",
      active: true, totpEnabled: true, mustChangePassword: false,
    };
    expect(shouldForcePasswordChange(user)).toBe(false);
  });

  it("does not force change for inactive user (they can't log in anyway)", () => {
    const user: AdminUser = {
      id: "u3", email: "inactive@example.com", name: "Inactive Admin",
      active: false, totpEnabled: false, mustChangePassword: true,
    };
    expect(shouldForcePasswordChange(user)).toBe(false);
  });
});
