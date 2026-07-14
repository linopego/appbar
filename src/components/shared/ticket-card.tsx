import Link from "next/link";
import type { Ticket, PriceTier } from "@prisma/client";
import { renderQrSvg } from "@/lib/qr/render";
import { computeTicketStatus } from "@/lib/tickets/status";
import { formatEur } from "@/lib/utils/money";
import { TicketStatusBadge } from "./ticket-status-badge";
import { cn } from "@/lib/utils";

interface Props {
  ticket: Ticket & { priceTier: Pick<PriceTier, "name" | "price"> };
  mode: "compact" | "fullscreen";
}

export async function TicketCard({ ticket, mode }: Props) {
  const status = computeTicketStatus(ticket);
  const usable = status === "ACTIVE";
  const svg = await renderQrSvg(ticket.qrToken);

  if (mode === "fullscreen") {
    return (
      <div className="flex flex-col items-center gap-6">
        <div
          className={cn(
            "relative bg-white p-4 rounded-2xl shadow-lg",
            !usable && "opacity-40 grayscale"
          )}
          style={{ width: "min(70vw, 400px)", height: "min(70vw, 400px)" }}
          dangerouslySetInnerHTML={{ __html: svg.replace("<svg ", '<svg width="100%" height="100%" ') }}
        />
        <div className="text-center">
          <div className="text-3xl font-bold uppercase tracking-tight">{ticket.priceTier.name}</div>
          <div className="text-2xl text-muted-foreground mt-1">
            {formatEur(ticket.priceTier.price)}
          </div>
        </div>
      </div>
    );
  }

  // compact (inside /ordine/[id])
  return (
    <Link
      href={`/ticket/${ticket.qrToken}`}
      data-testid="ticket-card"
      className={cn(
        "block rounded-xl border bg-card p-4 hover:shadow-md transition-shadow relative",
        !usable && "opacity-50 grayscale"
      )}
    >
      <div className="absolute top-2 right-2">
        <TicketStatusBadge status={status} consumedAt={ticket.consumedAt} />
      </div>
      <div
        className="bg-white p-2 rounded-lg mx-auto"
        style={{ width: 200, height: 200 }}
        dangerouslySetInnerHTML={{ __html: svg.replace("<svg ", '<svg width="100%" height="100%" ') }}
      />
      <div className="mt-3 text-center">
        <div className="font-semibold">{ticket.priceTier.name}</div>
        <div className="text-sm text-muted-foreground">{formatEur(ticket.priceTier.price)}</div>
      </div>
    </Link>
  );
}
