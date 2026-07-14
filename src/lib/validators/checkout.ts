import { z } from "zod";

export const checkoutLineItemSchema = z.object({
  priceTierId: z.string().cuid({ message: "ID fascia prezzo non valido" }),
  quantity: z
    .number()
    .int({ message: "Quantità deve essere un intero" })
    .min(1, { message: "Quantità minima è 1" })
    .max(20, { message: "Quantità massima è 20" }),
});

export const checkoutSchema = z.object({
  venueSlug: z.string().min(1, { message: "Venue obbligatorio" }),
  items: z
    .array(checkoutLineItemSchema)
    .min(1, { message: "Almeno un articolo richiesto" })
    .max(10, { message: "Massimo 10 tipi di articolo" }),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CheckoutLineItem = z.infer<typeof checkoutLineItemSchema>;
