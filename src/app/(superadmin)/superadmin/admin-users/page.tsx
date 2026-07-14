import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin Users — Super Admin" };

function formatDT(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function SuperAdminAdminUsersPage() {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/superadmin/login");

  const users = await db.adminUser.findMany({
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link
              href="/superadmin"
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              ← Super Admin
            </Link>
            <h1 className="text-2xl font-semibold mt-1">Admin Users</h1>
          </div>
          <Link
            href="/superadmin/admin-users/nuovo"
            className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium transition-colors"
          >
            + Nuovo admin
          </Link>
        </div>

        <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-400 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Email / Nome</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Stato</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">2FA</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">
                  Password
                </th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">
                  Ultimo accesso
                </th>
                <th className="text-right px-4 py-3">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === session.adminUserId;
                return (
                  <tr
                    key={u.id}
                    className={`border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/20 ${
                      isSelf ? "bg-zinc-800/10" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-100">{u.email}</div>
                      <div className="text-xs text-zinc-400">{u.name}</div>
                      {isSelf && (
                        <div className="text-xs text-blue-400 mt-0.5">Tu</div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.active
                            ? "bg-green-900/50 text-green-400"
                            : "bg-zinc-800 text-zinc-500"
                        }`}
                      >
                        {u.active ? "Attivo" : "Inattivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.totpEnabled
                            ? "bg-green-900/50 text-green-400"
                            : "bg-zinc-800 text-zinc-500"
                        }`}
                      >
                        {u.totpEnabled ? "Attivo" : "Non configurato"}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {u.mustChangePassword ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-900/50 text-amber-400">
                          Da cambiare
                        </span>
                      ) : (
                        <span className="text-zinc-500 text-xs">OK</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs hidden lg:table-cell">
                      {formatDT(u.lastLoginAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isSelf && (
                        <Link
                          href={`/superadmin/admin-users/${u.id}/modifica`}
                          className="text-xs px-3 py-1 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 transition-colors"
                        >
                          Modifica
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-zinc-500"
                  >
                    Nessun admin user.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
