import { z } from "zod";

// Regola di integrità AdminUser (non esprimibile in Prisma):
//   role PLATFORM  ⇒ organizationId null
//   role ORG_ADMIN ⇒ organizationId obbligatorio
// Default: ORG_ADMIN (che quindi richiede organizationId).
export const adminUserRoleOrgSchema = z
  .object({
    role: z.enum(["PLATFORM", "ORG_ADMIN"]).default("ORG_ADMIN"),
    organizationId: z.string().trim().min(1).nullish(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "PLATFORM" && data.organizationId != null) {
      ctx.addIssue({
        code: "custom",
        path: ["organizationId"],
        message: "Un admin PLATFORM non può appartenere a un'organizzazione",
      });
    }
    if (data.role === "ORG_ADMIN" && data.organizationId == null) {
      ctx.addIssue({
        code: "custom",
        path: ["organizationId"],
        message: "Un admin ORG_ADMIN deve appartenere a un'organizzazione",
      });
    }
  })
  .transform((data) => ({
    role: data.role,
    organizationId: data.organizationId ?? null,
  }));

export type AdminUserRoleOrg = z.infer<typeof adminUserRoleOrgSchema>;
