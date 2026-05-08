import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "./logout-button";

export default async function ProfiloPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/profilo");
  }

  const accounts = await db.customerAccount.findMany({
    where: { customerId: session.user.id },
    select: { provider: true },
  });

  const providerLabels: Record<string, string> = {
    google: "Google",
    resend: "Email magic link",
  };
  const providers = accounts.map((a) => providerLabels[a.provider] ?? a.provider);
  const primaryProvider = providers[0] ?? "Email magic link";

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Il tuo profilo</h1>
          <LogoutButton />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>I dati del tuo account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Email</div>
              <div className="text-sm">{session.user.email}</div>
            </div>
            {session.user.name ? (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Nome</div>
                <div className="text-sm">{session.user.name}</div>
              </div>
            ) : null}
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Accesso tramite
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {providers.length > 0 ? (
                  providers.map((p) => (
                    <Badge key={p} variant="secondary">
                      {p}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="secondary">{primaryProvider}</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>I tuoi ordini</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Nessun ordine ancora.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
