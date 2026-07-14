"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface Props {
  venueSlug: string;
}

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/ordini", label: "Ordini" },
  { href: "/admin/rimborsi", label: "Rimborsi" },
  { href: "/admin/listino", label: "Listino" },
  { href: "/admin/operatori", label: "Operatori" },
  { href: "/admin/statistiche", label: "Statistiche" },
  { href: "/admin/impostazioni", label: "Impostazioni" },
];

export function AdminSidebar({ venueSlug }: Props) {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-52 shrink-0 border-r border-zinc-200 bg-white flex flex-col py-4 hidden md:flex">
      <nav className="flex-1 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isActive(item.href, item.exact)
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="px-2 mt-4 pt-4 border-t border-zinc-100 space-y-0.5">
        <Link
          href={`/staff/${venueSlug}/pos`}
          className="block px-3 py-2 rounded-lg text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
        >
          ← POS
        </Link>
      </div>
    </aside>
  );
}
