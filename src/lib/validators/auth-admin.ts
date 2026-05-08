import { z } from "zod";

export const adminCredentialsSchema = z.object({
  email: z.string().email("Inserisci un indirizzo email valido"),
  password: z.string().min(8, "Password deve essere almeno 8 caratteri"),
});

export const adminTotpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Codice deve essere 6 cifre"),
});

export const adminPasswordChangeSchema = z.object({
  currentPassword: z.string().min(8, "Password attuale obbligatoria"),
  newPassword: z
    .string()
    .min(12, "Password deve essere almeno 12 caratteri")
    .regex(/[a-z]/, "Deve contenere almeno una lettera minuscola")
    .regex(/[A-Z]/, "Deve contenere almeno una lettera maiuscola")
    .regex(/[0-9]/, "Deve contenere almeno un numero"),
});

export type AdminCredentialsInput = z.infer<typeof adminCredentialsSchema>;
export type AdminTotpInput = z.infer<typeof adminTotpSchema>;
export type AdminPasswordChangeInput = z.infer<typeof adminPasswordChangeSchema>;
