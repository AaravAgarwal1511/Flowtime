// Expand recurring-event series into concrete immovable occurrences over the
// planning horizon. Pure; reuses time helpers.
import {
  addLocalDays,
  atMinuteOfDay,
  isoWeekday,
  localDateStr,
  parseWorkdays,
} from "./time";

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

export function expandSeries(
  series: SeriesLike[],
  now: Date,
  horizonDays: number,
  tz: string,
  /** Per-series set of local YYYY-MM-DD strings to skip (deleted / overridden dates). */
  skipDates: Map<string, Set<string>> = new Map(),
): Occurrence[] {
  const out: Occurrence[] = [];
  for (const s of series) {
    const days = parseWorkdays(s.days);
    const skip = skipDates.get(s.id) ?? new Set<string>();
    if (s.endMin <= s.startMin) continue;
    for (let i = 0; i < horizonDays; i++) {
      const day = addLocalDays(now, i, tz); // local midnight of calendar day i
      if (!days.has(isoWeekday(day, tz))) continue;
      const start = atMinuteOfDay(day, s.startMin, tz);
      const end = atMinuteOfDay(day, s.endMin, tz);
      if (end <= now) continue; // skip occurrences already finished (e.g. earlier today)
      if (skip.has(localDateStr(start, tz))) continue; // deleted or overridden occurrence
      out.push({ start, end, seriesId: s.id, title: s.title, color: s.color });
    }
  }
  return out;
}
