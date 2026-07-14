import { describe, expect, it } from "vitest";
import { isRefundCurrentlyBlocked, nextUnblockedTime, type RefundWindow } from "@/lib/refunds/blocked-windows";

const TZ = "Europe/Rome";

// Helper: build a Date from day-of-week and local time in Rome
// We use a known reference week: Mon 2026-01-05 to Sun 2026-01-11
const MONDAY_JAN5_UTC = new Date("2026-01-05T00:00:00Z"); // Monday at midnight UTC = Mon 01:00 Rome (CET = UTC+1)

function romeDateForDayAndTime(dayOfWeek: number, hour: number, minute: number): Date {
  // dayOfWeek: 0=Sun, 1=Mon, ..., 6=Sat
  // Reference: 2026-01-05 (Mon) = dayOfWeek 1
  const mondayOffset = 1;
  const dayOffset = (dayOfWeek - mondayOffset + 7) % 7;
  // In CET (UTC+1), hour X = UTC X-1
  const utcHour = hour - 1;
  const d = new Date(MONDAY_JAN5_UTC);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(utcHour < 0 ? 23 : utcHour, utcHour < 0 ? 60 + minute : minute, 0, 0);
  if (utcHour < 0) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

// Simple same-midnight windows (split approach matching the spec)
function makeWindows(...specs: Array<{ day: number; startHour: number; startMin: number; endHour: number; endMin: number }>): RefundWindow[] {
  return specs;
}

// Studios DECÒ: Thu–Sun 22:00–06:00 (cross-midnight)
const DECO_WINDOWS: RefundWindow[] = [
  { day: 4, startHour: 22, startMin: 0, endHour: 6, endMin: 0 }, // Thu
  { day: 5, startHour: 22, startMin: 0, endHour: 6, endMin: 0 }, // Fri
  { day: 6, startHour: 22, startMin: 0, endHour: 6, endMin: 0 }, // Sat
  { day: 0, startHour: 22, startMin: 0, endHour: 6, endMin: 0 }, // Sun
];

describe("isRefundCurrentlyBlocked", () => {
  it("returns false for empty windows", () => {
    expect(isRefundCurrentlyBlocked([], TZ)).toBe(false);
    expect(isRefundCurrentlyBlocked(null as unknown as [], TZ)).toBe(false);
  });

  it("blocks on Saturday at 23:00 with Fri-Sun 22-06 windows", () => {
    const sat23 = romeDateForDayAndTime(6, 23, 0); // Sat 23:00 Rome
    expect(isRefundCurrentlyBlocked(DECO_WINDOWS, TZ, sat23)).toBe(true);
  });

  it("blocks on Sunday at 04:00 (cross-midnight from Saturday's window)", () => {
    const sun4 = romeDateForDayAndTime(0, 4, 0); // Sun 04:00 Rome
    // The Saturday window (day=6) spans midnight into Sunday
    expect(isRefundCurrentlyBlocked(DECO_WINDOWS, TZ, sun4)).toBe(true);
  });

  it("does NOT block on Monday at 14:00", () => {
    const mon14 = romeDateForDayAndTime(1, 14, 0); // Mon 14:00 Rome
    expect(isRefundCurrentlyBlocked(DECO_WINDOWS, TZ, mon14)).toBe(false);
  });

  it("does NOT block on Saturday at 07:00 (after window ends at 06:00)", () => {
    // The Fri window ends at 06:00 on Sat; Sat 07:00 should be open
    const sat7 = romeDateForDayAndTime(6, 7, 0); // Sat 07:00 Rome
    expect(isRefundCurrentlyBlocked(DECO_WINDOWS, TZ, sat7)).toBe(false);
  });

  it("blocks on Thursday at 22:30", () => {
    const thu22h30 = romeDateForDayAndTime(4, 22, 30); // Thu 22:30 Rome
    expect(isRefundCurrentlyBlocked(DECO_WINDOWS, TZ, thu22h30)).toBe(true);
  });

  it("does NOT block with same-day non-overlapping window", () => {
    const windows = makeWindows({ day: 1, startHour: 10, startMin: 0, endHour: 12, endMin: 0 });
    const mon14 = romeDateForDayAndTime(1, 14, 0);
    expect(isRefundCurrentlyBlocked(windows, TZ, mon14)).toBe(false);
  });

  it("blocks with same-day window when inside the range", () => {
    const windows = makeWindows({ day: 1, startHour: 10, startMin: 0, endHour: 18, endMin: 0 });
    const mon14 = romeDateForDayAndTime(1, 14, 0);
    expect(isRefundCurrentlyBlocked(windows, TZ, mon14)).toBe(true);
  });
});

describe("nextUnblockedTime", () => {
  it("returns null when not blocked", () => {
    const mon14 = romeDateForDayAndTime(1, 14, 0);
    expect(nextUnblockedTime(DECO_WINDOWS, TZ, mon14)).toBeNull();
  });

  it("returns a future time when currently blocked", () => {
    const sat23 = romeDateForDayAndTime(6, 23, 0);
    const next = nextUnblockedTime(DECO_WINDOWS, TZ, sat23);
    expect(next).not.toBeNull();
    expect(next!.getTime()).toBeGreaterThan(sat23.getTime());
    // Should be unblocked (Sunday 06:00 Rome)
    expect(isRefundCurrentlyBlocked(DECO_WINDOWS, TZ, next!)).toBe(false);
  });

  it("returns null for empty windows", () => {
    const sat23 = romeDateForDayAndTime(6, 23, 0);
    expect(nextUnblockedTime([], TZ, sat23)).toBeNull();
  });
});
