import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const venues = [
  {
    id: 1,
    nome: "La Casa dei Gelsi",
    descrizione: "Locale storico con ampi spazi interni ed esterni.",
  },
  {
    id: 2,
    nome: "Studios Club – DECÒ",
    descrizione: "Club esclusivo per eventi privati e serate a tema.",
  },
  {
    id: 3,
    nome: "Tenuta Villa Peggy's",
    descrizione: "Splendida tenuta immersa nella natura per feste ed eventi.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Sistema Ticket</h1>
          <p className="text-xl text-muted-foreground">Sistema cashless per locali</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {venues.map((venue) => (
            <Card key={venue.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{venue.nome}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{venue.descrizione}</p>
              </CardContent>
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
