import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/auth/staff";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StaffLoginForm } from "./staff-login-form";

interface PageProps {
  params: Promise<{ venueSlug: string }>;
}

export default async function StaffLoginPage({ params }: PageProps) {
  const { venueSlug } = await params;

  const venue = await db.venue.findUnique({
    where: { slug: venueSlug },
    select: { id: true, name: true, slug: true, active: true },
  });
  if (!venue || !venue.active) notFound();

  const existing = await getStaffSession();
  if (existing && existing.venueSlug === venue.slug) {
    redirect(`/staff/${venue.slug}/pos`);
  }

  const operators = await db.operator.findMany({
    where: { venueId: venue.id, active: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="dark min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 text-zinc-50">
        <CardHeader className="text-center space-y-2">
          <CardDescription className="uppercase tracking-wider text-xs text-zinc-400">
            Accesso staff
          </CardDescription>
          <CardTitle className="text-3xl">{venue.name}</CardTitle>
        </CardHeader>
        <CardContent>
          {operators.length > 0 ? (
            <StaffLoginForm
              venueSlug={venue.slug}
              venueName={venue.name}
              operators={operators}
            />
          ) : (
            <p className="text-center text-sm text-zinc-400">
              Nessun operatore configurato per questo venue. Contatta il manager.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
