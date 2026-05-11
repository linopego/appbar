import { cn } from "@/lib/utils";

interface TimelineStep {
  label: string;
  date: Date | string | null;
  by?: string | null;
  active: boolean;
  terminal?: boolean;
  variant?: "default" | "success" | "error";
}

function formatDate(d: Date | string | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

interface RefundTimelineProps {
  requestedAt: Date | string;
  status: "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED";
  processedAt?: Date | string | null;
  processedByName?: string | null;
  managerNote?: string | null;
}

export function RefundTimeline({
  requestedAt,
  status,
  processedAt,
  processedByName,
  managerNote,
}: RefundTimelineProps) {
  const steps: TimelineStep[] = [
    {
      label: "Richiesta inviata",
      date: requestedAt,
      active: true,
      variant: "default",
    },
  ];

  if (status === "PENDING") {
    steps.push({ label: "In attesa di revisione", date: null, active: false });
  } else if (status === "APPROVED" || status === "COMPLETED") {
    steps.push({
      label: "Approvato",
      date: processedAt ?? null,
      by: processedByName,
      active: true,
      variant: "success",
    });
    steps.push({
      label: status === "COMPLETED" ? "Rimborso completato" : "Rimborso in elaborazione",
      date: status === "COMPLETED" ? processedAt ?? null : null,
      active: status === "COMPLETED",
      variant: "success",
      terminal: true,
    });
  } else if (status === "REJECTED") {
    steps.push({
      label: "Rifiutato",
      date: processedAt ?? null,
      by: processedByName,
      active: true,
      variant: "error",
      terminal: true,
    });
  }

  return (
    <ol className="relative border-l border-zinc-200 space-y-6 ml-3">
      {steps.map((step, i) => (
        <li key={i} className="ml-6">
          <span
            className={cn(
              "absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white",
              step.active
                ? step.variant === "success"
                  ? "bg-green-500"
                  : step.variant === "error"
                    ? "bg-red-500"
                    : "bg-zinc-700"
                : "bg-zinc-200"
            )}
          >
            {step.active && (
              <span className="text-white text-xs font-bold">
                {step.variant === "error" ? "✕" : "✓"}
              </span>
            )}
          </span>
          <div>
            <p
              className={cn(
                "text-sm font-medium",
                step.active ? "text-zinc-900" : "text-zinc-400"
              )}
            >
              {step.label}
            </p>
            {step.date && (
              <time className="text-xs text-zinc-500">{formatDate(step.date)}</time>
            )}
            {step.by && (
              <p className="text-xs text-zinc-500">da {step.by}</p>
            )}
          </div>
        </li>
      ))}

      {managerNote && status === "REJECTED" && (
        <li className="ml-6">
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 mt-2">
            <p className="text-sm font-medium text-red-800">Motivazione del rifiuto:</p>
            <p className="text-sm text-red-700 mt-1">{managerNote}</p>
          </div>
        </li>
      )}
    </ol>
  );
}
