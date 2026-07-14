"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KlinkLogo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/superadmin", label: "Dashboard", exact: true },
  // "Organizzazioni" e "Sistema" sono riservate agli admin PLATFORM
  { href: "/superadmin/organizations", label: "Organizzazioni", platformOnly: true },
  { href: "/superadmin/venues", label: "Venue" },
  { href: "/superadmin/ordini", label: "Ordini" },
  { href: "/superadmin/tickets", label: "Ticket" },
  { href: "/superadmin/rimborsi", label: "Rimborsi" },
  { href: "/superadmin/operatori", label: "Operatori" },
  { href: "/superadmin/admin-users", label: "Admin Users" },
  { href: "/superadmin/audit", label: "Audit Log" },
  { href: "/superadmin/sistema", label: "Sistema", platformOnly: true },
];

export function SuperAdminSidebar({ isPlatform = false }: { isPlatform?: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="w-48 shrink-0 border-r border-zinc-800 bg-zinc-900 py-4 hidden md:block">
      <div className="px-4 pb-4 text-white">
        <KlinkLogo variant="mono" size={26} />
      </div>
      <nav className="space-y-0.5 px-2">
        {NAV.filter((item) => !item.platformOnly || isPlatform).map(({ href, label, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "block rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-klink-lime text-klink-ink font-medium"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
