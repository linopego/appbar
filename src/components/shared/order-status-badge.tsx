// Badge di stato dell'ORDINE (da non confondere con RefundStatusBadge, che
// mappa gli stati del rimborso). Lookup sempre safe: uno stato sconosciuto
// rende un badge neutro, mai un crash del render server.

export type OrderBadgeStatus =
  | "PENDING"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "FAILED";

const LABELS: Record<OrderBadgeStatus, string> = {
  PAID: "Pagato",
  REFUNDED: "Rimborsato",
  PARTIALLY_REFUNDED: "Parz. rimborsato",
  FAILED: "Fallito",
  PENDING: "Pendente",
};

const COLORS: Record<OrderBadgeStatus, string> = {
  PAID: "bg-green-100 text-green-800",
  REFUNDED: "bg-zinc-100 text-zinc-600",
  PARTIALLY_REFUNDED: "bg-blue-100 text-blue-800",
  FAILED: "bg-red-100 text-red-700",
  PENDING: "bg-yellow-100 text-yellow-800",
};

export function OrderStatusBadge({ status }: { status: OrderBadgeStatus | (string & {}) }) {
  const label = LABELS[status as OrderBadgeStatus] ?? status;
  const colors = COLORS[status as OrderBadgeStatus] ?? "bg-zinc-100 text-zinc-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>
      {label}
    </span>
  );
}
