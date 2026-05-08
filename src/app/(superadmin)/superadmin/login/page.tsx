import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SuperAdminLoginForm } from "./superadmin-login-form";

export const dynamic = "force-dynamic";

export default async function SuperAdminLoginPage() {
  const existing = await getAdminSession();
  if (existing) {
    redirect("/superadmin");
  }

  return (
    <main className="dark min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 text-zinc-50">
        <CardHeader className="text-center space-y-2">
          <CardDescription className="uppercase tracking-wider text-xs text-zinc-400">
            Pannello amministrazione
          </CardDescription>
          <CardTitle className="text-2xl">Accesso Super-admin</CardTitle>
        </CardHeader>
        <CardContent>
          <SuperAdminLoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
