import Link from "next/link";
import { db } from "@/lib/db";
import { publicVenuesWhere } from "@/lib/venues/public";
import { StaffVenuePicker } from "./staff-venue-picker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Area staff — Sistema Ticket" };

// Smistamento del personale: nessuna credenziale, PIN o email qui.
// Il login vero avviene su /staff/[slug] (PIN) o /superadmin/login.
export default async function AccessoStaffPage() {
  const venues = await db.venue.findMany({
    where: publicVenuesWhere,
    orderBy: { name: "asc" },
    select: { name: true, slug: true },
  });

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
          Seleziona il tuo locale per accedere al POS con il tuo PIN.
        </p>

        <StaffVenuePicker venues={venues} />

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
