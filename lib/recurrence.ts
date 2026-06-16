// Expand recurring-event series into concrete immovable occurrences over the
// planning horizon. Pure; reuses time helpers.
import { addMinutes, atMinuteOfDay, isoWeekday, parseWorkdays, startOfDay } from "./time";

export interface SeriesLike {
  id: string;
  title: string;
  startMin: number;
  endMin: number;
  days: string; // CSV of ISO weekdays (1=Mon..7=Sun)
  color: string;
}

export interface Occurrence {
  start: Date;
  end: Date;
  seriesId: string;
  title: string;
  color: string;
}

/** YYYY-MM-DD in local time (matches how we store deletedDates / seriesOriginalDate). */
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function expandSeries(
  series: SeriesLike[],
  now: Date,
  horizonDays: number,
  /** Per-series set of local YYYY-MM-DD strings to skip (deleted / overridden dates). */
  skipDates: Map<string, Set<string>> = new Map(),
): Occurrence[] {
  const day0 = startOfDay(now);
  const out: Occurrence[] = [];
  for (const s of series) {
    const days = parseWorkdays(s.days);
    const skip = skipDates.get(s.id) ?? new Set<string>();
    if (s.endMin <= s.startMin) continue;
    for (let i = 0; i < horizonDays; i++) {
      const day = addMinutes(day0, i * 24 * 60);
      if (!days.has(isoWeekday(day))) continue;
      const start = atMinuteOfDay(day, s.startMin);
      const end = atMinuteOfDay(day, s.endMin);
      if (end <= now) continue; // skip occurrences already finished (e.g. earlier today)
      if (skip.has(localDateStr(start))) continue; // deleted or overridden occurrence
      out.push({ start, end, seriesId: s.id, title: s.title, color: s.color });
    }
  }
  return out;
}
