import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireStaffRole } from "@/lib/auth/staff";
import { db } from "@/lib/db";
import { TierEditForm } from "./tier-edit-form";

export const dynamic = "force-dynamic";

export default async function ModificaFasciaPage({
  params,
}: {
  params: Promise<{ tierId: string }>;
}) {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) redirect("/");

  const { tierId } = await params;

  const tier = await db.priceTier.findUnique({
    where: { id: tierId, venueId: session.venueId },
  });

  if (!tier) notFound();

  return (
    <div className="max-w-md space-y-6">
      <div className="space-y-1">
        <Link href="/admin/listino" className="text-sm text-zinc-500 hover:text-zinc-800">← Listino</Link>
        <h1 className="text-2xl font-bold text-zinc-900">Modifica fascia</h1>
      </div>

      <TierEditForm
        tierId={tier.id}
        initialName={tier.name}
        initialPrice={tier.price.toString()}
        initialSortOrder={tier.sortOrder}
      />
    </div>
  );
}
