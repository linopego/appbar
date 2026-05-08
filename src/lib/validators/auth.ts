import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Inserisci un indirizzo email valido"),
});

export type LoginInput = z.infer<typeof loginSchema>;
