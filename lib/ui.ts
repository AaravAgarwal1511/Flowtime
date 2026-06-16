// Client-safe shared types & formatting helpers (no server/prisma imports).
import { EventType } from "./types";

export interface CalEventDTO {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  type: EventType;
  state: "FREE" | "BUSY";
  flexible: boolean;
  locked: boolean;
  color: string;
  noBuffer: boolean;
  seriesOverride: boolean;
  sourceTaskId: string | null;
  sourceHabitId: string | null;
  sourceSeriesId: string | null;
}

export interface TaskDTO {
  id: string;
  title: string;
  notes: string | null;
  durationMin: number;
  minChunkMin: number;
  maxChunkMin: number;
  due: string | null;
  priority: number;
  status: string;
  dependsOnIds: string[];
}

export interface HabitDTO {
  id: string;
  title: string;
  durationMin: number;
  frequency: string;
  perWeek: number;
  idealWindowStartMin: number;
  idealWindowEndMin: number;
  kind: string;
  color: string;
  active: boolean;
}

export interface RecurringEventDTO {
  id: string;
  title: string;
  startMin: number;
  endMin: number;
  days: string; // CSV ISO weekdays
  color: string;
  active: boolean;
}

export interface TimeOffDTO {
  id: string;
  label: string | null;
  start: string; // ISO (inclusive start-of-day)
  end: string; // ISO (exclusive)
}

export const TYPE_LABELS: Record<EventType, string> = {
  MEETING: "Meeting",
  TASK_BLOCK: "Task",
  HABIT_BLOCK: "Habit",
  FOCUS: "Focus",
  BUFFER: "Buffer",
  COMMITMENT: "Commitment",
};

export const FREQUENCY_LABELS: Record<string, string> = {
  DAILY: "Every day",
  WEEKDAYS: "Weekdays",
  N_PER_WEEK: "Times per week",
};

/** minutes-of-day (0..1440) → "9:00 AM" */
export function minutesToLabel(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function prettyDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Deterministic date formatting (no Intl) so server & client render identically.
const WD_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WD_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MON_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MON_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function dueLabel(iso: string | null): string {
  if (!iso) return "No deadline";
  const d = new Date(iso);
  return `${WD_SHORT[d.getDay()]}, ${MON_SHORT[d.getMonth()]} ${d.getDate()}`;
}

export function longDate(d: Date): string {
  return `${WD_LONG[d.getDay()]}, ${MON_LONG[d.getMonth()]} ${d.getDate()}`;
}

/** YYYY-MM-DD in local time, for <input type="date"> values. */
export function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

const WD_MIN = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "Weekdays" / "Every day" / "Mon, Wed, Fri" from a CSV of ISO weekdays. */
export function daysLabel(csv: string): string {
  const days = csv
    .split(",")
    .map((d) => parseInt(d.trim(), 10))
    .filter((n) => n >= 1 && n <= 7)
    .sort((a, b) => a - b);
  const key = days.join(",");
  if (key === "1,2,3,4,5") return "Weekdays";
  if (key === "1,2,3,4,5,6,7") return "Every day";
  if (key === "6,7") return "Weekends";
  return days.map((d) => WD_MIN[d]).join(", ");
}

/** "Jun 5 – Jun 12" from an inclusive start + exclusive end (as stored). */
export function timeOffRangeLabel(startISO: string, endISO: string): string {
  const s = new Date(startISO);
  const last = new Date(new Date(endISO).getTime() - 86400000); // exclusive → last day
  const f = (d: Date) => `${MON_SHORT[d.getMonth()]} ${d.getDate()}`;
  return f(s) === f(last) ? f(s) : `${f(s)} – ${f(last)}`;
}
