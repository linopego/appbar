import Link from "next/link";
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
            Per amministratori di organizzazione e piattaforma
          </CardDescription>
          <CardTitle className="text-2xl">Accesso amministratori</CardTitle>
        </CardHeader>
        <CardContent>
          <SuperAdminLoginForm />
          {/* Link inverso discreto: chi ha sbagliato porta torna all'area staff */}
          <p className="mt-5 text-center text-xs text-zinc-500">
            Sei un responsabile di locale?{" "}
            <Link href="/accesso-staff" className="text-zinc-300 underline underline-offset-4 hover:text-zinc-100">
              → Area staff
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
