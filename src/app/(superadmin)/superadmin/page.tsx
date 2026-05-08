import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/auth/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SuperAdminLogoutButton } from "./superadmin-logout-button";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { title: "Venue", description: "Gestione locali (3)", badge: "soon" },
  { title: "Operatori", description: "Staff banco e PIN", badge: "soon" },
  { title: "Ordini", description: "Storico vendite e ticket", badge: "soon" },
  { title: "Rimborsi", description: "Approvazioni e processing", badge: "soon" },
  { title: "Audit log", description: "Tutte le azioni admin", badge: "soon" },
];

export default async function SuperAdminDashboardPage() {
  const session = await getAdminSession();
  if (!session) redirect("/superadmin/login");

  const user = await db.adminUser.findUnique({
    where: { id: session.adminUserId },
    select: { mustChangePassword: true, active: true },
  });
  if (!user || !user.active) redirect("/superadmin/login");
  if (user.mustChangePassword) redirect("/superadmin/cambio-password");

  return (
    <main className="dark min-h-screen bg-zinc-950 text-zinc-50 px-4 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-400">
              Pannello super-admin
            </p>
            <h1 className="text-3xl font-semibold">Ciao {session.name}</h1>
            <p className="text-sm text-zinc-500 mt-1">{session.email}</p>
          </div>
          <SuperAdminLogoutButton />
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SECTIONS.map((s) => (
            <Card key={s.title} className="bg-zinc-900 border-zinc-800 text-zinc-50">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{s.title}</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {s.badge}
                  </Badge>
                </div>
                <CardDescription className="text-zinc-400">{s.description}</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-zinc-500">In arrivo.</CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
