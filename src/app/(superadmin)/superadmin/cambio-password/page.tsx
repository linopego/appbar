import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/auth/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "./change-password-form";

export const dynamic = "force-dynamic";

export default async function CambioPasswordPage() {
  const session = await getAdminSession();
  if (!session) redirect("/superadmin/login");

  const user = await db.adminUser.findUnique({
    where: { id: session.adminUserId },
    select: { mustChangePassword: true, name: true },
  });
  if (!user) redirect("/superadmin/login");

  return (
    <main className="dark min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 text-zinc-50">
        <CardHeader className="space-y-1">
          <CardTitle>
            {user.mustChangePassword ? "Cambia la password temporanea" : "Cambia password"}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {user.mustChangePassword
              ? "Per sicurezza imposta una nuova password prima di continuare."
              : `Aggiorna la password di ${user.name}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
