import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin";
import { SuperAdminHeader } from "./superadmin-layout-header";
import { SuperAdminSidebar } from "./superadmin-layout-sidebar";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  // Login and cambio-password routes handle their own auth checks
  // We skip the layout wrapper for them to avoid redirect loops.
  // The actual auth guarding is done in each page.

  if (!session) {
    // Don't redirect here — login page needs to render
    return (
      <div className="dark min-h-screen bg-zinc-950 text-zinc-50">
        {children}
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-zinc-950 text-zinc-50 flex flex-col">
      <SuperAdminHeader />
      <div className="flex flex-1 overflow-hidden">
        <SuperAdminSidebar />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
