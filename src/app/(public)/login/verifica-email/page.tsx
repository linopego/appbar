import Link from "next/link";
import { Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function VerificaEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <Mail className="size-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl">Controlla la tua email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Ti abbiamo inviato un link di accesso. Apri l&apos;email e clicca sul pulsante per
            accedere.
          </p>
          <p className="text-xs">Non vedi l&apos;email? Controlla la cartella spam.</p>
          <p className="pt-2">
            <Link href="/login" className="font-medium text-foreground hover:underline">
              Torna al login
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
