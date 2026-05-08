import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth/staff";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StaffLogoutButton } from "./staff-logout-button";

interface PageProps {
  params: Promise<{ venueSlug: string }>;
}

const ROLE_LABELS: Record<string, string> = {
  BARISTA: "Barista",
  CASSIERE: "Cassiere",
  MANAGER: "Manager",
};

export default async function StaffPosPage({ params }: PageProps) {
  const { venueSlug } = await params;
  const session = await getStaffSession();
  if (!session || session.venueSlug !== venueSlug) {
    redirect(`/staff/${venueSlug}`);
  }

  return (
    <main className="dark min-h-screen bg-zinc-950 text-zinc-50 px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-400">POS staff</p>
            <h1 className="text-2xl font-semibold">Ciao {session.name}</h1>
          </div>
          <StaffLogoutButton venueSlug={venueSlug} />
        </div>

        <Card className="bg-zinc-900 border-zinc-800 text-zinc-50">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Sessione attiva</CardTitle>
            <Badge variant="secondary">{ROLE_LABELS[session.role] ?? session.role}</Badge>
          </CardHeader>
          <CardContent className="text-sm text-zinc-300">
            <p>POS in arrivo. Qui scansionerai i QR dei ticket clienti.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
