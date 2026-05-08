import { z } from "zod";

export const staffLoginSchema = z.object({
  venueSlug: z.string().min(1),
  operatorId: z.string().cuid(),
  pin: z.string().regex(/^\d{4,6}$/, "PIN deve essere 4-6 cifre"),
});

export type StaffLoginInput = z.infer<typeof staffLoginSchema>;
