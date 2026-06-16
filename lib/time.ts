// Pure time/interval helpers for the scheduling engine. No DB, no I/O.

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

/** Local minutes-of-day for a Date (0..1439). */
export function minuteOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Start of the local day for a Date. */
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Date at a given minutes-of-day on the same local day as `day`. */
export function atMinuteOfDay(day: Date, minutes: number): Date {
  const x = startOfDay(day);
  return addMinutes(x, minutes);
}

/**
 * Convert JS weekday (0=Sun..6=Sat) to our settings convention (1=Mon..7=Sun).
 */
export function isoWeekday(d: Date): number {
  const js = d.getDay();
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
): Interval[] {
  const windows: Interval[] = [];
  const day0 = startOfDay(from);
  for (let i = 0; i < days; i++) {
    const day = addMinutes(day0, i * 24 * 60);
    if (!workdays.has(isoWeekday(day))) continue;
    let start = atMinuteOfDay(day, workdayStartMin);
    const end = atMinuteOfDay(day, workdayEndMin);
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

/** Monday-based week key (local) for grouping focus-time totals. */
export function weekKey(d: Date): string {
  const day = startOfDay(d);
  const offset = isoWeekday(day) - 1;
  const monday = addMinutes(day, -offset * 24 * 60);
  return monday.toISOString().slice(0, 10);
}
