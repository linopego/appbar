import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/staff";
import { db } from "@/lib/db";
import { AdminSidebar } from "./admin-sidebar";
import { AdminHeader } from "./admin-header";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) redirect("/");

  const venue = await db.venue.findUnique({
    where: { id: session.venueId },
    select: { name: true, slug: true },
  });

  if (!venue) redirect("/");

  return (
    <div className="min-h-dvh bg-zinc-50 flex flex-col">
      <AdminHeader venueName={venue.name} operatorName={session.name} venueSlug={venue.slug} />
      <div className="flex flex-1">
        <AdminSidebar venueSlug={venue.slug} />
        <main className="flex-1 p-6 max-w-6xl">{children}</main>
      </div>
    </div>
  );
}
