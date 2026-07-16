import Link from "next/link";
import { renderLegalHtml } from "@/lib/legal/load";

// Contenitore comune di /privacy e /termini: max-width da lettura, card
// bianca, prosa .legal-prose (globals.css).
export async function LegalPage({ slug }: { slug: "privacy" | "termini" }) {
  const html = await renderLegalHtml(slug);

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Torna alla home
        </Link>
        <article
          className="legal-prose mt-4 rounded-2xl border bg-card p-6 sm:p-8"
          // Contenuto nostro e statico (content/legal/*.md), non input utente
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </main>
  );
}
