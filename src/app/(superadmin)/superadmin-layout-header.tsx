import Link from "next/link";
import { getAdminSession } from "@/lib/auth/admin";
import { SuperAdminLogoutButton } from "./superadmin/superadmin-logout-button";

export async function SuperAdminHeader() {
  const session = await getAdminSession();
  return (
    <header className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900">
      <Link href="/superadmin" className="text-sm font-semibold text-zinc-100 hover:text-white">
        Super Admin
      </Link>
      <div className="flex items-center gap-3 text-xs text-zinc-400">
        {session && <span className="hidden sm:inline">{session.name}</span>}
        <SuperAdminLogoutButton />
      </div>
    </header>
  );
}
