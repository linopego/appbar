import { cn } from "@/lib/utils";

type RefundStatus = "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED";

const STATUS_CONFIG: Record<RefundStatus, { label: string; className: string }> = {
  PENDING: { label: "In attesa", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  APPROVED: { label: "Approvato", className: "bg-blue-100 text-blue-800 border-blue-200" },
  COMPLETED: { label: "Completato", className: "bg-green-100 text-green-800 border-green-200" },
  REJECTED: { label: "Rifiutato", className: "bg-red-100 text-red-800 border-red-200" },
};

export function RefundStatusBadge({ status }: { status: RefundStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
