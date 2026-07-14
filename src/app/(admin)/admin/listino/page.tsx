import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/staff";
import { db } from "@/lib/db";
import { formatEur } from "@/lib/utils/money";
import { ToggleActiveButton } from "./toggle-active-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Listino — Admin" };

export default async function AdminListinoPage() {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) redirect("/");

  const tiers = await db.priceTier.findMany({
    where: { venueId: session.venueId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-zinc-900">Listino prezzi</h1>
        <Link
          href="/admin/listino/nuovo"
          className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 transition-colors"
        >
          + Nuova fascia
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-xs text-zinc-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-right px-4 py-3">Prezzo</th>
              <th className="text-right px-4 py-3 hidden sm:table-cell">Ordine</th>
              <th className="text-left px-4 py-3">Stato</th>
              <th className="text-right px-4 py-3">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier) => (
              <tr key={tier.id} className={`border-b border-zinc-50 transition-colors ${tier.active ? "" : "opacity-50"}`}>
                <td className="px-4 py-3 font-medium text-zinc-900">{tier.name}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatEur(tier.price.toString())}</td>
                <td className="px-4 py-3 text-right text-zinc-500 hidden sm:table-cell">{tier.sortOrder}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${tier.active ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-500"}`}>
                    {tier.active ? "Attivo" : "Disattivato"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/listino/${tier.id}/modifica`}
                      className="text-xs px-3 py-1 rounded-lg border border-zinc-200 hover:border-zinc-400 text-zinc-700 transition-colors"
                    >
                      Modifica
                    </Link>
                    <ToggleActiveButton tierId={tier.id} active={tier.active} name={tier.name} />
                  </div>
                </td>
              </tr>
            ))}
            {tiers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-400">Nessuna fascia ancora. Creane una!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-400">
        Non è possibile eliminare una fascia per preservare lo storico ordini. Usa &ldquo;Disattiva&rdquo; per nasconderla dal checkout.
      </p>
    </div>
  );
}
