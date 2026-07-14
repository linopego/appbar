import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KlinkLogo } from "@/components/brand/logo";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { publicVenuesWhere } from "@/lib/venues/public";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [venues, session] = await Promise.all([
    db.venue.findMany({
      where: publicVenuesWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    auth(),
  ]);

  const isLoggedIn = Boolean(session?.user);

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <div className="container mx-auto px-4 py-12 sm:py-16 flex-1">
        <header className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <KlinkLogo variant="lockup" size={44} className="text-foreground" />
          </div>
          <h1 className="sr-only">{BRAND_NAME}</h1>
          <p className="text-lg text-muted-foreground">{BRAND_TAGLINE}</p>
          {isLoggedIn && (
            <Button asChild variant="outline" className="mt-5">
              <Link href="/profilo">🎟️ I miei ticket</Link>
            </Button>
          )}
        </header>

        {venues.length === 0 ? (
          <div className="max-w-md mx-auto text-center rounded-xl border bg-card p-10">
            <p className="font-medium">Nessun locale disponibile al momento.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Torna a trovarci presto: i locali aderenti compariranno qui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto">
            {venues.map((venue) => (
              <Card key={venue.id} className="hover:shadow-md transition-shadow flex flex-col">
                <CardHeader>
                  <CardTitle className="text-lg">{venue.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1" />
                <CardFooter>
                  <Button asChild className="w-full">
                    <Link href={`/${venue.slug}`}>Acquista ticket</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <footer className="border-t py-6">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {BRAND_NAME}</p>
          <nav className="flex items-center gap-5">
            <Link href="/accesso-staff" className="hover:text-foreground transition-colors">
              Area staff
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
