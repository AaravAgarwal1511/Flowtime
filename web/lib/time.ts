// Pure time/interval helpers for the scheduling engine. No DB, no I/O.
//
// Wall-clock helpers (`startOfDay`, `atMinuteOfDay`, `minuteOfDay`, `isoWeekday`,
// `weekKey`, `workingWindows`, `addLocalDays`, `localDateStr`) interpret instants
// in an explicit IANA time zone `tz` — never the server's own zone. This keeps
// "9:00" or "start of day" anchored to the user's wall clock even though the
// server runs in UTC (Vercel). Instant-math helpers below are zone-independent.

import { wallParts, zonedWallToUtc } from "./tz";

export interface Interval {
  start: Date;
  end: Date;
}

export const MS_PER_MIN = 60_000;

export function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * MS_PER_MIN);
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_MIN);
}

/** Minutes-of-day (0..1439) for a Date, as seen in `tz`. */
export function minuteOfDay(d: Date, tz: string): number {
  const w = wallParts(d, tz);
  return w.hour * 60 + w.minute;
}

/** The instant of local midnight for the `tz` calendar day containing `d`. */
export function startOfDay(d: Date, tz: string): Date {
  const w = wallParts(d, tz);
  return zonedWallToUtc(w.year, w.month, w.day, 0, 0, tz);
}

/**
 * Instant at a given minutes-of-day on the same `tz` calendar day as `day`.
 * `minutes` may be 1440 (end of day) — it rolls to the next local midnight.
 */
export function atMinuteOfDay(day: Date, minutes: number, tz: string): Date {
  const w = wallParts(day, tz);
  return zonedWallToUtc(
    w.year,
    w.month,
    w.day,
    Math.floor(minutes / 60),
    minutes % 60,
    tz,
  );
}

/** Instant of local midnight `n` calendar days after the `tz` day of `d`. */
export function addLocalDays(d: Date, n: number, tz: string): Date {
  const w = wallParts(d, tz);
  const cal = new Date(Date.UTC(w.year, w.month - 1, w.day));
  cal.setUTCDate(cal.getUTCDate() + n);
  return zonedWallToUtc(
    cal.getUTCFullYear(),
    cal.getUTCMonth() + 1,
    cal.getUTCDate(),
    0,
    0,
    tz,
  );
}

/** YYYY-MM-DD for the `tz` calendar day containing `d`. */
export function localDateStr(d: Date, tz: string): string {
  const w = wallParts(d, tz);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

/**
 * ISO weekday (1=Mon..7=Sun) of the `tz` calendar day containing `d`.
 */
export function isoWeekday(d: Date, tz: string): number {
  const w = wallParts(d, tz);
  const js = new Date(Date.UTC(w.year, w.month - 1, w.day)).getUTCDay();
  return js === 0 ? 7 : js;
}

export function parseWorkdays(csv: string): Set<number> {
  return new Set(
    csv
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n)),
  );
}

/**
 * Build the daily working-hour windows across [from, from + days), restricted to
 * configured workdays and clipped so the first window never starts before `from`.
 */
export function workingWindows(
  from: Date,
  days: number,
  workdayStartMin: number,
  workdayEndMin: number,
  workdays: Set<number>,
  tz: string,
): Interval[] {
  const windows: Interval[] = [];
  for (let i = 0; i < days; i++) {
    const day = addLocalDays(from, i, tz); // local midnight of calendar day i
    if (!workdays.has(isoWeekday(day, tz))) continue;
    let start = atMinuteOfDay(day, workdayStartMin, tz);
    const end = atMinuteOfDay(day, workdayEndMin, tz);
    if (start < from) start = from;
    if (start < end) windows.push({ start, end });
  }
  return windows;
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Subtract a set of busy intervals from a single free window, returning the
 * remaining free sub-intervals (sorted, non-overlapping).
 */
export function subtractBusy(window: Interval, busy: Interval[]): Interval[] {
  const relevant = busy
    .filter((b) => overlaps(window, b))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const gaps: Interval[] = [];
  let cursor = window.start;
  for (const b of relevant) {
    if (b.start > cursor) gaps.push({ start: cursor, end: b.start });
    if (b.end > cursor) cursor = b.end;
  }
  if (cursor < window.end) gaps.push({ start: cursor, end: window.end });
  return gaps;
}

/**
 * All free gaps across the working windows given the busy intervals, keeping
 * only gaps at least `minLen` minutes long. Sorted earliest-first.
 */
export function findGaps(
  windows: Interval[],
  busy: Interval[],
  minLen: number,
): Interval[] {
  const gaps: Interval[] = [];
  for (const w of windows) {
    for (const g of subtractBusy(w, busy)) {
      if (minutesBetween(g.start, g.end) >= minLen) gaps.push(g);
    }
  }
  return gaps.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Monday-based week key (the Monday's YYYY-MM-DD in `tz`) for grouping totals. */
export function weekKey(d: Date, tz: string): string {
  const offset = isoWeekday(d, tz) - 1;
  return localDateStr(addLocalDays(d, -offset, tz), tz);
}
