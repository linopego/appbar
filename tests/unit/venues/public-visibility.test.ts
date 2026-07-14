import { describe, it, expect } from "vitest";
import { isPubliclyVisible, publicVenuesWhere } from "@/lib/venues/public";

// La select di /accesso-staff mostra solo venue attivi di organizzazioni
// attive. (La homepage non elenca più i locali: è la vetrina prodotto.)

describe("isPubliclyVisible", () => {
  it("venue attivo di org attiva → visibile", () => {
    expect(isPubliclyVisible({ active: true, organization: { active: true } })).toBe(true);
  });

  it("venue disattivato → escluso", () => {
    expect(isPubliclyVisible({ active: false, organization: { active: true } })).toBe(false);
  });

  it("venue di organizzazione disattivata → escluso", () => {
    expect(isPubliclyVisible({ active: true, organization: { active: false } })).toBe(false);
  });

  it("venue disattivato di org disattivata → escluso", () => {
    expect(isPubliclyVisible({ active: false, organization: { active: false } })).toBe(false);
  });
});

describe("publicVenuesWhere (filtro Prisma di /accesso-staff)", () => {
  it("filtra su venue attivo E organizzazione attiva", () => {
    expect(publicVenuesWhere).toEqual({
      active: true,
      organization: { active: true },
    });
  });
});
