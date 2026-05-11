export const dynamic = "force-dynamic";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "Errore di configurazione del sistema. Contatta il supporto.",
  AccessDenied: "Accesso negato.",
  Verification: "Il link di verifica non è valido o è scaduto.",
};

interface ErrorPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginErrorPage({ searchParams }: ErrorPageProps) {
  const params = await searchParams;
  const errorKey = params?.error ?? "";
  const message = ERROR_MESSAGES[errorKey] ?? "Si è verificato un errore. Riprova.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="size-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl">Errore di accesso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{message}</p>
          <Button asChild className="w-full">
            <Link href="/login">Torna al login</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
