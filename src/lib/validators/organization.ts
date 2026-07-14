import { z } from "zod";

// feePercent: 0–50, massimo due decimali. Accetta number o string decimale;
// normalizza a string per non passare mai da float (coerente col principio
// "importi come string decimale").
export const feePercentSchema = z
  .union([z.number(), z.string().trim().min(1, "feePercent è obbligatoria")])
  .transform((v) => String(v))
  .superRefine((v, ctx) => {
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(v)) {
      ctx.addIssue({
        code: "custom",
        message: "feePercent non valida: numero tra 0 e 50, max 2 decimali",
      });
      return;
    }
    if (Number(v) > 50) {
      ctx.addIssue({
        code: "custom",
        message: "feePercent massima consentita: 50",
      });
    }
  });

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1, "name è obbligatorio").max(100),
  feePercent: feePercentSchema.optional().default("0"),
});

export const updateOrganizationSchema = z
  .object({
    name: z.string().trim().min(1, "name non può essere vuoto").max(100).optional(),
    feePercent: feePercentSchema.optional(),
  })
  .refine((d) => d.name !== undefined || d.feePercent !== undefined, {
    message: "Nessun campo da aggiornare",
  });
