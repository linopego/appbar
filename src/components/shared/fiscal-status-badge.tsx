// Badge di stato del documento fiscale (liste ordini e dettaglio).
// theme "light" per l'area manager, "dark" per il superadmin.

export type FiscalBadgeStatus = "PENDING" | "SUBMITTED" | "CONFIRMED" | "FAILED";

const LABELS: Record<FiscalBadgeStatus, string> = {
  CONFIRMED: "Emesso",
  PENDING: "In attesa",
  SUBMITTED: "In attesa",
  FAILED: "Errore",
};

const LIGHT: Record<FiscalBadgeStatus, string> = {
  CONFIRMED: "bg-green-100 text-green-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  SUBMITTED: "bg-yellow-100 text-yellow-800",
  FAILED: "bg-red-100 text-red-700",
};

const DARK: Record<FiscalBadgeStatus, string> = {
  CONFIRMED: "bg-green-900/50 text-green-400",
  PENDING: "bg-yellow-900/50 text-yellow-400",
  SUBMITTED: "bg-yellow-900/50 text-yellow-400",
  FAILED: "bg-red-900/50 text-red-400",
};

export function FiscalStatusBadge({
  status,
  theme = "light",
}: {
  status: FiscalBadgeStatus;
  theme?: "light" | "dark";
}) {
  const colors = theme === "dark" ? DARK : LIGHT;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
