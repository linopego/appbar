// Validazione condivisa delle impostazioni venue, usata sia dalle route del
// responsabile di locale sia da quelle superadmin: la regola vive in UN posto
// (vedi docs/ARCHITECTURE.md, gerarchia dei ruoli).

export interface RefundWindow {
  day: number; // 0 = domenica … 6 = sabato
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  // Json-friendly per Prisma (InputJsonObject richiede l'index signature)
  [key: string]: number;
}

export function isValidRefundWindow(w: unknown): w is RefundWindow {
  if (typeof w !== "object" || w === null) return false;
  const obj = w as Record<string, unknown>;
  const inRange = (val: unknown, min: number, max: number) =>
    typeof val === "number" && Number.isInteger(val) && val >= min && val <= max;
  return (
    inRange(obj.day, 0, 6) &&
    inRange(obj.startHour, 0, 23) &&
    inRange(obj.startMin, 0, 59) &&
    inRange(obj.endHour, 0, 23) &&
    inRange(obj.endMin, 0, 59)
  );
}

export type RefundWindowsParseResult =
  | { ok: true; windows: RefundWindow[]; timezone: string }
  | { ok: false; error: string };

export function parseRefundWindowsInput(body: {
  windows?: unknown;
  timezone?: unknown;
}): RefundWindowsParseResult {
  if (!Array.isArray(body.windows)) {
    return { ok: false, error: "windows deve essere un array" };
  }
  for (const w of body.windows) {
    if (!isValidRefundWindow(w)) {
      return { ok: false, error: "Finestra non valida" };
    }
  }
  if (typeof body.timezone !== "string" || body.timezone.trim() === "") {
    return { ok: false, error: "timezone è obbligatorio" };
  }
  return { ok: true, windows: body.windows as RefundWindow[], timezone: body.timezone.trim() };
}

// Fusi proposti nei selettori di entrambi i pannelli
export const REFUND_TIMEZONE_OPTIONS = [
  "Europe/Rome",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "UTC",
];
