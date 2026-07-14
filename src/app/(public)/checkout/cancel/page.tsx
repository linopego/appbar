import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Pagamento annullato — Sistema Ticket" };

export default function CheckoutCancelPage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="text-4xl mb-2">✕</div>
          <CardTitle className="text-xl">Pagamento annullato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Il pagamento è stato annullato. Nessun addebito è stato effettuato.
          </p>
          <Button asChild className="w-full">
            <Link href="/">Torna ai locali</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
