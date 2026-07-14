import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { AdminUserEditForm } from "./admin-user-edit-form";

export const dynamic = "force-dynamic";

export default async function AdminUserModificaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/superadmin/login");

  const { id } = await params;

  const user = await db.adminUser.findUnique({
    where: { id },
    select: { id: true, email: true, name: true },
  });

  if (!user) notFound();

  const isSelf = user.id === session.adminUserId;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="space-y-1">
          <Link
            href="/superadmin/admin-users"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Admin Users
          </Link>
          <h1 className="text-2xl font-semibold">Modifica admin</h1>
          <p className="text-sm text-zinc-400">{user.email}</p>
        </div>

        <AdminUserEditForm
          userId={id}
          initialEmail={user.email}
          initialName={user.name}
          isSelf={isSelf}
        />
      </div>
    </main>
  );
}
