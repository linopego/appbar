import { redirect } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/staff";
import { db } from "@/lib/db";
import { RefundWindowsEditor } from "./refund-windows-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Impostazioni — Admin" };

export interface RefundWindow {
  day: number;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
}

const IANA_TIMEZONES = [
  "Europe/Rome",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "UTC",
];

export default async function ImpostazioniPage() {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) redirect("/");

  const venue = await db.venue.findUnique({
    where: { id: session.venueId },
    select: {
      id: true,
      name: true,
      slug: true,
      active: true,
      refundBlockedWindows: true,
      refundBlockedTimezone: true,
    },
  });

  if (!venue) redirect("/");

  const windows = (venue.refundBlockedWindows as RefundWindow[] | null) ?? [];

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold text-zinc-900">Impostazioni venue</h1>

      {/* Read-only venue info */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3 divide-y divide-zinc-100">
        <div className="pb-3">
          <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">Dati venue</p>
          <p className="text-xs text-zinc-400 mt-1">Modificabili solo dal super-admin</p>
        </div>
        <div className="pt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Nome</span>
            <span className="font-medium text-zinc-900">{venue.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Slug</span>
            <span className="font-mono text-xs text-zinc-600">{venue.slug}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Stato</span>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${venue.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
              {venue.active ? "Attivo" : "Disattivato"}
            </span>
          </div>
        </div>
      </div>

      {/* Editable: refund windows + timezone */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Fasce orarie blocco rimborso</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Durante queste finestre i clienti non possono inviare richieste di rimborso (es. durante l&apos;evento aperto).
          </p>
        </div>

        <RefundWindowsEditor
          initialWindows={windows}
          initialTimezone={venue.refundBlockedTimezone}
          timezoneOptions={IANA_TIMEZONES}
        />
      </div>
    </div>
  );
}
