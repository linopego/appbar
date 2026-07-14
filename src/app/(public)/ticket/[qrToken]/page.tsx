import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TicketCard } from "@/components/shared/ticket-card";
import { computeTicketStatus } from "@/lib/tickets/status";
import { TicketLiveStatus } from "./ticket-live-status";

export const dynamic = "force-dynamic";
export const metadata = { title: "Il tuo ticket — Sistema Ticket" };

interface PageProps {
  params: Promise<{ qrToken: string }>;
}

const formatDate = (d: Date) =>
  new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" }).format(d);

export default async function TicketPage({ params }: PageProps) {
  const { qrToken } = await params;

  const ticket = await db.ticket.findUnique({
    where: { qrToken },
    include: { priceTier: true, venue: true },
  });

  if (!ticket) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-100 p-6">
        <div className="max-w-md w-full text-center space-y-3">
          <div className="text-5xl">⚠</div>
          <h1 className="text-2xl font-bold">Ticket non valido</h1>
          <p className="text-muted-foreground text-sm">
            Questo ticket non esiste o è stato annullato. Controlla il link e riprova.
          </p>
          <Link href="/" className="inline-block underline text-sm mt-4">
            Torna alla home
          </Link>
        </div>
      </main>
    );
  }

  const session = await auth();
  const isOwner = session?.user?.id === ticket.customerId;
  const backHref = isOwner ? `/ordine/${ticket.orderId}` : "/";

  const status = computeTicketStatus(ticket);
  const orderShortId = ticket.orderId.slice(0, 8).toUpperCase();

  return (
    <main className="min-h-screen relative overflow-hidden">
      <TicketLiveStatus qrToken={ticket.qrToken} initialStatus={status} />

      <div className="relative z-10 min-h-screen flex flex-col p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{ticket.venue.name}</div>
          <Link
            href={backHref}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Indietro
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center py-8">
          <TicketCard ticket={ticket} mode="fullscreen" />
        </div>

        <div className="text-center text-xs text-muted-foreground space-y-1">
          <div>Valido fino al {formatDate(ticket.expiresAt)}</div>
          <div>Ordine #{orderShortId}</div>
        </div>
      </div>
    </main>
  );
}
