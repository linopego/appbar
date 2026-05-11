import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/staff";
import { db } from "@/lib/db";
import { OperatorToggleButton } from "./operator-toggle-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operatori — Admin" };

const ROLE_LABELS: Record<string, string> = {
  BARISTA: "Barista",
  CASSIERE: "Cassiere",
  MANAGER: "Manager",
};

function formatDT(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

export default async function AdminOperatoriPage() {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) redirect("/");

  const operators = await db.operator.findMany({
    where: { venueId: session.venueId },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-zinc-900">Operatori</h1>
        <Link
          href="/admin/operatori/nuovo"
          className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 transition-colors"
        >
          + Nuovo operatore
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-xs text-zinc-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-left px-4 py-3 hidden sm:table-cell">Ruolo</th>
              <th className="text-left px-4 py-3">Stato</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Ultimo accesso</th>
              <th className="text-right px-4 py-3">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {operators.map((op) => {
              const isSelf = op.id === session.operatorId;
              return (
                <tr key={op.id} className={`border-b border-zinc-50 transition-colors ${!op.active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900">{op.name}</div>
                    {op.email && <div className="text-xs text-zinc-400">{op.email}</div>}
                    {isSelf && <div className="text-xs text-blue-500">Tu</div>}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">{ROLE_LABELS[op.role] ?? op.role}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${op.active ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-500"}`}>
                      {op.active ? "Attivo" : "Disattivato"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs hidden md:table-cell">{formatDT(op.lastLoginAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!isSelf && (
                        <>
                          <Link
                            href={`/admin/operatori/${op.id}/modifica`}
                            className="text-xs px-3 py-1 rounded-lg border border-zinc-200 hover:border-zinc-400 text-zinc-700 transition-colors"
                          >
                            Modifica
                          </Link>
                          <OperatorToggleButton operatorId={op.id} active={op.active} name={op.name} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {operators.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-400">Nessun operatore ancora.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-400">
        Non è possibile eliminare gli operatori per preservare lo storico ticket consegnati. Usa &ldquo;Disattiva&rdquo; per revocare l&apos;accesso.
      </p>
    </div>
  );
}
