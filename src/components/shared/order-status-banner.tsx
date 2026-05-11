import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@prisma/client";

const LABELS: Record<OrderStatus, { text: string; variant: "default" | "secondary" | "destructive" }> = {
  PENDING: { text: "In elaborazione", variant: "secondary" },
  PAID: { text: "Pagato", variant: "default" },
  FAILED: { text: "Fallito", variant: "destructive" },
  REFUNDED: { text: "Rimborsato", variant: "destructive" },
  PARTIALLY_REFUNDED: { text: "Rimborso parziale", variant: "secondary" },
};

export function OrderStatusBanner({ status }: { status: OrderStatus }) {
  const cfg = LABELS[status];
  return <Badge variant={cfg.variant}>{cfg.text}</Badge>;
}
