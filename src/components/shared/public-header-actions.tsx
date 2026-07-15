"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

interface HeaderUser {
  name: string | null;
  email: string | null;
}

const MENU_ITEMS = [
  { href: "/home", label: "I miei ticket" },
  { href: "/profilo", label: "I miei ordini" },
  { href: "/profilo/rimborsi", label: "I miei rimborsi" },
] as const;

export function PublicHeaderActions({ user }: { user: HeaderUser | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Chiudi il menu su click fuori e al cambio pagina
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (!user) {
    return (
      <div className="flex items-center gap-4">
        <Link
          href="/accesso-staff"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Area staff
        </Link>
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(pathname || "/")}`}
          className="h-10 px-5 inline-flex items-center rounded-full bg-klink-lime text-klink-ink text-sm font-semibold hover:bg-klink-lime-hover transition-colors"
        >
          Accedi
        </Link>
      </div>
    );
  }

  const displayName = user.name || user.email || "Il tuo account";
  const initial = (user.name?.[0] || user.email?.[0] || "?").toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 h-10 pl-1.5 pr-3 rounded-full border bg-card hover:border-klink-ink/30 transition-colors"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-klink-lime text-klink-ink text-sm font-semibold">
          {initial}
        </span>
        <span className="text-sm font-medium max-w-28 truncate hidden sm:block">
          {displayName}
        </span>
        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden className="text-muted-foreground">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 w-56 rounded-2xl border bg-card shadow-card overflow-hidden py-1"
        >
          <p className="px-4 py-2 text-xs text-muted-foreground truncate border-b">
            {user.email ?? displayName}
          </p>
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm hover:bg-muted transition-colors"
            >
              {item.label}
            </Link>
          ))}
          <button
            role="menuitem"
            onClick={() => signOut({ redirectTo: "/" })}
            className="w-full text-left px-4 py-3 text-sm text-klink-error hover:bg-muted transition-colors border-t"
          >
            Esci
          </button>
        </div>
      )}
    </div>
  );
}
