import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TicketCard } from "@/components/shared/ticket-card";
import { computeTicketStatus } from "@/lib/tickets/status";
import { WalletButtons } from "@/components/wallet/wallet-buttons";
import { isAppleWalletConfigured, isGoogleWalletConfigured } from "@/lib/wallet/config";
import { TicketLiveStatus } from "./ticket-live-status";

export const dynamic = "force-dynamic";
export const metadata = { title: "Il tuo ticket" };

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
          <AlertTriangle aria-hidden className="mx-auto h-12 w-12 text-klink-warning" />
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
  // Ritorno esplicito e prevedibile (niente history.back): loggato →
  // "I tuoi ticket" (/home). Anonimo (arrivato col solo link del token,
  // es. email su un altro dispositivo): /home lo manderebbe al login,
  // quindi il link punta alla pagina dell'ordine, sempre utile.
  const backLink = session?.user
    ? { href: "/home", label: "← I tuoi ticket" }
    : { href: `/ordine/${ticket.orderId}`, label: "← Vedi l'ordine" };

  const status = computeTicketStatus(ticket);
  const orderShortId = ticket.orderId.slice(0, 8).toUpperCase();

  return (
    <main className="min-h-screen relative overflow-hidden">
      <TicketLiveStatus qrToken={ticket.qrToken} initialStatus={status} />

      {/* Su cornice lime (ticket attivo) i testi sono Ink pieno: contrasto */}
      <div className="relative z-10 min-h-screen flex flex-col p-4">
        <div className="flex items-center justify-between">
          <div className={status === "ACTIVE" ? "text-sm text-klink-ink font-medium" : "text-sm text-muted-foreground"}>
            {ticket.venue.name}
          </div>
          <Link
            href={backLink.href}
            className={
              status === "ACTIVE"
                ? "text-sm text-klink-ink underline underline-offset-4 hover:no-underline"
                : "text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {backLink.label}
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center py-8">
          <TicketCard ticket={ticket} mode="fullscreen" />
        </div>

        {/* Wallet: QR disponibile anche offline, senza aprire il sito.
            Feature flag: senza env i bottoni non vengono proprio renderizzati */}
        {status === "ACTIVE" && (isAppleWalletConfigured() || isGoogleWalletConfigured()) && (
          <div className="pb-4">
            <WalletButtons
              qrToken={ticket.qrToken}
              appleEnabled={isAppleWalletConfigured()}
              googleEnabled={isGoogleWalletConfigured()}
            />
          </div>
        )}

        <div
          className={`text-center text-xs space-y-1 ${
            status === "ACTIVE" ? "text-klink-ink" : "text-muted-foreground"
          }`}
        >
          <div>Valido fino al {formatDate(ticket.expiresAt)}</div>
          <div>Ordine #{orderShortId}</div>
        </div>
      </div>
    </main>
  );
}
