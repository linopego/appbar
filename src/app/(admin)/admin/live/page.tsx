import { redirect } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/staff";
import { LiveDashboard } from "@/components/reports/live-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Serata live — Admin" };

// La serata mentre accade: giornata OPERATIVA 06:00→06:00 Europe/Rome
// (diversa dalla giornata solare dei Corrispettivi, che serve al fisco).
export default async function LivePage() {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) redirect("/");

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Serata live</h1>
        <p className="text-sm text-zinc-500 mt-1">
          La serata mentre accade, aggiornata ogni 20 secondi. Serata dalle 06:00
          alle 06:00: quello che succede dopo mezzanotte appartiene alla serata
          iniziata il giorno prima.
        </p>
      </div>
      <LiveDashboard endpoint="/api/admin/live" theme="light" />
    </div>
  );
}
