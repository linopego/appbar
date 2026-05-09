import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireStaffRole } from "@/lib/auth/staff";
import { db } from "@/lib/db";
import { OperatorEditForm } from "./operator-edit-form";

export const dynamic = "force-dynamic";

export default async function ModificaOperatorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) redirect("/");

  const { id } = await params;

  // Self-edit not allowed
  if (id === session.operatorId) redirect("/admin/operatori");

  const op = await db.operator.findUnique({
    where: { id, venueId: session.venueId },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!op) notFound();

  return (
    <div className="max-w-md space-y-6">
      <div className="space-y-1">
        <Link href="/admin/operatori" className="text-sm text-zinc-500 hover:text-zinc-800">← Operatori</Link>
        <h1 className="text-2xl font-bold text-zinc-900">Modifica operatore</h1>
      </div>

      <OperatorEditForm
        operatorId={op.id}
        initialName={op.name}
        initialEmail={op.email ?? ""}
        initialRole={op.role}
      />
    </div>
  );
}
