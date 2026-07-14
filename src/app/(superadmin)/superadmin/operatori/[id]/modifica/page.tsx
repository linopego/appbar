import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { orgScopeWhere } from "@/lib/auth/org-scope";
import { db } from "@/lib/db";
import { SuperAdminOperatorEditForm } from "./operator-edit-form";
import { OperatorResetPasswordButton } from "@/components/shared/operator-reset-password-button";

export const dynamic = "force-dynamic";

export default async function SuperAdminOperatoreModificaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/superadmin/login");

  const { id } = await params;

  const operator = await db.operator.findFirst({
    where: { id, ...orgScopeWhere(session).byVenue },
    include: { venue: { select: { name: true } } },
  });

  if (!operator) notFound();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="space-y-1">
          <Link
            href="/superadmin/operatori"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Operatori
          </Link>
          <h1 className="text-2xl font-semibold">Modifica operatore</h1>
          <p className="text-sm text-zinc-400">{operator.venue.name}</p>
        </div>

        <SuperAdminOperatorEditForm
          operatorId={id}
          initialName={operator.name}
          initialEmail={operator.email ?? ""}
          initialRole={operator.role}
        />

        {operator.role === "MANAGER" && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
                Password pannello
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                I manager accedono al pannello del locale con email e password
                (oltre al PIN per il banco).
              </p>
            </div>
            <OperatorResetPasswordButton
              endpoint={`/api/superadmin/operators/${id}/reset-password`}
              operatorName={operator.name}
              dark
            />
          </div>
        )}
      </div>
    </main>
  );
}
