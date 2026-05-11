"use client";

import { Badge } from "@/components/ui/badge";
import type { EffectiveTicketStatus } from "@/lib/tickets/status";

interface Props {
  status: EffectiveTicketStatus;
  consumedAt?: Date | string | null;
}

export function TicketStatusBadge({ status, consumedAt }: Props) {
  if (status === "ACTIVE") {
    return (
      <Badge className="bg-green-600 hover:bg-green-600 text-white">Attivo</Badge>
    );
  }
  if (status === "EXPIRED") {
    return <Badge variant="secondary">Scaduto</Badge>;
  }
  if (status === "REFUNDED") {
    return <Badge variant="destructive">Rimborsato</Badge>;
  }

  // CONSUMED
  let consumedLabel = "Consegnato";
  if (consumedAt) {
    const date = consumedAt instanceof Date ? consumedAt : new Date(consumedAt);
    consumedLabel = `Consegnato il ${new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date)}`;
  }
  return <Badge className="bg-zinc-700 hover:bg-zinc-700 text-white">{consumedLabel}</Badge>;
}
