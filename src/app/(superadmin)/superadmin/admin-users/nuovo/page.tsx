import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { AdminUserCreateForm } from "./admin-user-create-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nuovo admin — Super Admin" };

export default async function NuovoAdminUserPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/superadmin/login");

  const { organizationId: presetOrganizationId } = await searchParams;

  // PLATFORM sceglie ruolo e organizzazione; ORG_ADMIN crea solo nella propria
  const organizations =
    session.role === "PLATFORM"
      ? await db.organization.findMany({
          where: { active: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

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
          <h1 className="text-2xl font-semibold">Nuovo admin</h1>
        </div>

        <AdminUserCreateForm
          sessionRole={session.role}
          sessionOrganizationId={session.organizationId}
          presetOrganizationId={presetOrganizationId ?? null}
          organizations={organizations}
        />
      </div>
    </main>
  );
}
