import { z } from "zod";

// ---- Enum-like unions (stored as String in SQLite, validated here) ----

export const EVENT_TYPES = [
  "MEETING",
  "TASK_BLOCK",
  "HABIT_BLOCK",
  "FOCUS",
  "BUFFER",
  "COMMITMENT",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_STATES = ["FREE", "BUSY"] as const;
export type EventState = (typeof EVENT_STATES)[number];

export const TASK_STATUSES = ["todo", "scheduled", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const HABIT_FREQUENCIES = ["DAILY", "WEEKDAYS", "N_PER_WEEK"] as const;
export type HabitFrequency = (typeof HABIT_FREQUENCIES)[number];

export const HABIT_KINDS = ["SOLO", "TEAM"] as const;
export type HabitKind = (typeof HABIT_KINDS)[number];

// ---- Block colors per type (canvas styling) ----

export const TYPE_COLORS: Record<EventType, string> = {
  MEETING: "#475569", // slate-600
  TASK_BLOCK: "#3b82f6", // blue-500
  HABIT_BLOCK: "#10b981", // emerald-500
  FOCUS: "#6366f1", // indigo-500
  BUFFER: "#cbd5e1", // slate-300
  COMMITMENT: "#0e7490", // cyan-700
};

export const PRIORITY_LABELS: Record<number, string> = {
  1: "P1 — Urgent",
  2: "P2 — High",
  3: "P3 — Medium",
  4: "P4 — Low",
};

// Task blocks are colored by urgency on the calendar (matches the Tasks screen badges).
export const PRIORITY_COLORS: Record<number, string> = {
  1: "#dc2626", // red-600 — Urgent
  2: "#ea580c", // orange-600 — High
  3: "#0891b2", // cyan-600 — Medium
  4: "#64748b", // slate-500 — Low
};

export function priorityColor(priority: number): string {
  return PRIORITY_COLORS[priority] ?? TYPE_COLORS.TASK_BLOCK;
}

// ---- Zod schemas for the API boundary ----

export const taskInput = z.object({
  title: z.string().min(1, "Title is required"),
  notes: z.string().optional().nullable(),
  durationMin: z.number().int().positive().default(60),
  minChunkMin: z.number().int().positive().default(30),
  maxChunkMin: z.number().int().positive().default(120),
  due: z.coerce.date().optional().nullable(),
  priority: z.number().int().min(1).max(4).default(3),
  status: z.enum(TASK_STATUSES).default("todo"),
  // Prerequisite task ids — this task is scheduled only after they complete.
  dependsOnIds: z.array(z.string()).optional(),
});
export type TaskInput = z.infer<typeof taskInput>;

export const habitInput = z.object({
  title: z.string().min(1, "Title is required"),
  durationMin: z.number().int().positive().default(30),
  frequency: z.enum(HABIT_FREQUENCIES).default("DAILY"),
  perWeek: z.number().int().min(1).max(7).default(3),
  idealWindowStartMin: z.number().int().min(0).max(1440).default(540),
  idealWindowEndMin: z.number().int().min(0).max(1440).default(1020),
  kind: z.enum(HABIT_KINDS).default("SOLO"),
  color: z.string().default("#10b981"),
  active: z.boolean().default(true),
});
export type HabitInput = z.infer<typeof habitInput>;

// Manual events (fixed meetings) the user creates directly on the calendar.
export const eventInput = z.object({
  title: z.string().min(1, "Title is required"),
  start: z.coerce.date(),
  end: z.coerce.date(),
  type: z.enum(EVENT_TYPES).default("MEETING"),
  flexible: z.boolean().default(false),
  state: z.enum(EVENT_STATES).default("BUSY"),
  locked: z.boolean().default(false),
  color: z.string().optional(),
  noBuffer: z.boolean().optional(),
});
export type EventInput = z.infer<typeof eventInput>;

// Patch used by drag/resize and drawer edits.
export const eventPatch = z.object({
  title: z.string().min(1).optional(),
  start: z.coerce.date().optional(),
  end: z.coerce.date().optional(),
  locked: z.boolean().optional(),
  state: z.enum(EVENT_STATES).optional(),
  noBuffer: z.boolean().optional(),
  seriesOverride: z.boolean().optional(),
  seriesOriginalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type EventPatch = z.infer<typeof eventPatch>;

// Time off / travel: a range of away days. `start` is the first away day and
// `end` is the last away day (both inclusive, as plain dates); the API
// normalizes them to a start-of-day / exclusive-end interval.
export const timeOffInput = z.object({
  label: z.string().optional().nullable(),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
});
export type TimeOffInput = z.infer<typeof timeOffInput>;

// A recurring immovable commitment (e.g. School). `days` is a CSV of ISO
// weekdays (1=Mon..7=Sun); times are minutes-of-day.
export const recurringEventInput = z.object({
  title: z.string().min(1, "Title is required"),
  startMin: z.number().int().min(0).max(1440),
  endMin: z.number().int().min(0).max(1440),
  days: z.string().regex(/^[1-7](,[1-7])*$/, "Expected CSV of weekdays 1-7"),
  color: z.string().optional(),
  active: z.boolean().default(true),
});
export type RecurringEventInput = z.infer<typeof recurringEventInput>;

export const settingsInput = z.object({
  workdayStartMin: z.number().int().min(0).max(1440).optional(),
  workdayEndMin: z.number().int().min(0).max(1440).optional(),
  workdays: z.string().optional(),
  defaultBufferMin: z.number().int().min(0).max(120).optional(),
  weeklyFocusTargetHours: z.number().int().min(0).max(60).optional(),
  lockHorizonHours: z.number().int().min(0).max(168).optional(),
  planHorizonDays: z.number().int().min(1).max(30).optional(),
  minTaskDurationForBuffer: z.number().int().min(15).max(480).optional(),
  minGapBetweenTaskChunks: z.number().int().min(0).max(240).optional(),
});
export type SettingsInput = z.infer<typeof settingsInput>;
