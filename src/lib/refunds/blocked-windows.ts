export interface RefundWindow {
  day: number;       // 0=Sunday, 1=Monday, ..., 6=Saturday
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
}

// Returns true if refunds are currently blocked based on the configured windows.
// Windows can span midnight (e.g. 22:00–06:00 the next day).
export function isRefundCurrentlyBlocked(
  windows: RefundWindow[],
  timezone: string,
  now = new Date()
): boolean {
  if (!windows || windows.length === 0) return false;

  const localStr = now.toLocaleString("en-US", { timeZone: timezone, hour12: false });
  const local = new Date(localStr);
  const currentDay = local.getDay();
  const currentHour = local.getHours();
  const currentMin = local.getMinutes();
  const currentMinutes = currentHour * 60 + currentMin;

  for (const w of windows) {
    const startMinutes = w.startHour * 60 + w.startMin;
    const endMinutes = w.endHour * 60 + w.endMin;

    if (startMinutes < endMinutes) {
      // Same-day window (e.g. 10:00–22:00)
      if (currentDay === w.day && currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        return true;
      }
    } else {
      // Cross-midnight window (e.g. 22:00–06:00)
      // Check if we're in the "before midnight" part (same day as window start)
      if (currentDay === w.day && currentMinutes >= startMinutes) {
        return true;
      }
      // Check if we're in the "after midnight" part (next day after window start)
      const nextDay = (w.day + 1) % 7;
      if (currentDay === nextDay && currentMinutes < endMinutes) {
        return true;
      }
    }
  }

  return false;
}

// Returns the next Date when refunds become unblocked (in UTC).
// Returns null if currently not blocked or no windows are configured.
export function nextUnblockedTime(
  windows: RefundWindow[],
  timezone: string,
  now = new Date()
): Date | null {
  if (!windows || windows.length === 0) return null;
  if (!isRefundCurrentlyBlocked(windows, timezone, now)) return null;

  // Try each minute in the next 7 days to find when we first exit a blocked period
  const candidate = new Date(now);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  const limit = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  while (candidate < limit) {
    if (!isRefundCurrentlyBlocked(windows, timezone, candidate)) {
      return candidate;
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  return null;
}
