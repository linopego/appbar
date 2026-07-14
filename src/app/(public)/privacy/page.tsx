import Link from "next/link";

export const metadata = { title: "Privacy — Sistema Ticket" };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-md">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Torna alla home
        </Link>

        <h1 className="text-2xl font-bold tracking-tight mt-4 mb-4">Informativa privacy</h1>

        <div className="rounded-xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            L&apos;informativa completa sul trattamento dei dati personali è in preparazione e
            sarà pubblicata qui prima dell&apos;apertura al pubblico del servizio.
          </p>
        </div>
      </div>
    </main>
  );
}
