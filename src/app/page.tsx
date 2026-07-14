import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const venues = await db.venue.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Sistema Ticket</h1>
          <p className="text-xl text-muted-foreground">Sistema cashless per locali</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
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
      </div>

      <footer className="border-t py-6 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Sistema Ticket &mdash; Tutti i diritti riservati
        </div>
      </footer>
    </main>
  );
}
