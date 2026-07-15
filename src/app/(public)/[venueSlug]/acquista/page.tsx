import { permanentRedirect } from "next/navigation";

// La pagina d'acquisto separata è stata assorbita da /[venueSlug]:
// redirect permanente (308) per link e segnalibri esistenti.
export default async function AcquistaRedirect({
  params,
}: {
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = await params;
  permanentRedirect(`/${venueSlug}`);
}
