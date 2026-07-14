import Link from "next/link";
import { StaffAccessForms } from "./staff-access-forms";

export const metadata = { title: "Area staff" };

// Smistamento del personale SENZA esporre l'elenco dei locali (i clienti
// della piattaforma non sono pubblici). Due percorsi:
// - banco: codice locale (slug) → login PIN su /staff/[slug]
// - manager: email + password → pannello /admin
export default function AccessoStaffPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-md">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Torna alla home
        </Link>

        <h1 className="text-2xl font-bold tracking-tight mt-4 mb-2">Area staff</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Accesso riservato al personale dei locali.
        </p>

        <StaffAccessForms />

        <div className="mt-10 pt-6 border-t text-center">
          <Link
            href="/superadmin/login"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Accesso amministrazione piattaforma
          </Link>
        </div>
      </div>
    </main>
  );
}
