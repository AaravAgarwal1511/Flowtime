// Pure analytics helpers over events. Client-safe.
import { EventType } from "./types";

export interface EventLike {
  start: string | Date;
  end: string | Date;
  type: EventType;
}

const COUNTED: EventType[] = [
  "MEETING",
  "TASK_BLOCK",
  "HABIT_BLOCK",
  "FOCUS",
  "COMMITMENT",
];

function minutes(e: EventLike): number {
  const s = new Date(e.start).getTime();
  const en = new Date(e.end).getTime();
  return Math.max(0, Math.round((en - s) / 60000));
}

export function startOfWeek(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay() === 0 ? 7 : x.getDay(); // 1=Mon..7=Sun
  x.setDate(x.getDate() - (dow - 1));
  return x;
}

/** Total minutes per type within [from, to). */
export function totalsByType(
  events: EventLike[],
  from: Date,
  to: Date,
): Record<EventType, number> {
  const totals: Record<EventType, number> = {
    MEETING: 0,
    TASK_BLOCK: 0,
    HABIT_BLOCK: 0,
    FOCUS: 0,
    BUFFER: 0,
    COMMITMENT: 0,
  };
  for (const e of events) {
    const s = new Date(e.start);
    if (s >= from && s < to) totals[e.type] += minutes(e);
  }
  return totals;
}

/** Per-day (Mon..Sun) minutes per counted type for the week starting `weekStart`. */
export function weeklyByDay(
  events: EventLike[],
  weekStart: Date,
): { day: string; [k: string]: number | string }[] {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const rows = labels.map((day) => {
    const row: { day: string; [k: string]: number | string } = { day };
    for (const t of COUNTED) row[t] = 0;
    return row;
  });
  for (const e of events) {
    const s = new Date(e.start);
    const idx = Math.floor((s.getTime() - weekStart.getTime()) / 86400000);
    if (idx < 0 || idx > 6) continue;
    if (!COUNTED.includes(e.type)) continue;
    rows[idx][e.type] = (rows[idx][e.type] as number) + minutes(e) / 60;
  }
  // round
  for (const row of rows)
    for (const t of COUNTED) row[t] = Math.round((row[t] as number) * 10) / 10;
  return rows;
}

export function summarizeForInsight(
  events: EventLike[],
  weekStart: Date,
): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const t = totalsByType(events, weekStart, weekEnd);
  const h = (m: number) => Math.round((m / 60) * 10) / 10;
  return (
    `This week so far: Focus time ${h(t.FOCUS)}h, Meetings ${h(t.MEETING)}h, ` +
    `Tasks ${h(t.TASK_BLOCK)}h, Habits ${h(t.HABIT_BLOCK)}h.`
  );
}
