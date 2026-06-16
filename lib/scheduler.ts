// The rule-based placement engine. Pure, deterministic, synchronous: no DB,
// no LLM. Given the fixed/locked blocks plus the user's tasks & habits, it
// returns the set of flexible blocks to persist.

import {
  Interval,
  addMinutes,
  atMinuteOfDay,
  findGaps,
  isoWeekday,
  minutesBetween,
  parseWorkdays,
  startOfDay,
  subtractBusy,
  weekKey,
  workingWindows,
} from "./time";
import { EventType, EventState, TYPE_COLORS, priorityColor } from "./types";

export interface SchedulerSettings {
  workdayStartMin: number;
  workdayEndMin: number;
  workdays: string; // CSV
  defaultBufferMin: number;
  weeklyFocusTargetHours: number;
  lockHorizonHours: number;
  planHorizonDays: number;
  minTaskDurationForBuffer: number; // task blocks ≥ this get a trailing buffer
  minGapBetweenTaskChunks: number; // min gap between two chunks of the same task
}

export interface FixedEvent extends Interval {
  type: EventType;
  noBuffer?: boolean; // meeting opted out of surrounding buffers
}

export interface SchedTask {
  id: string;
  title: string;
  durationMin: number;
  minChunkMin: number;
  maxChunkMin: number;
  due: Date | null;
  priority: number;
  dependsOnIds?: string[]; // prerequisite task ids (only those still pending matter)
}

export interface SchedHabit {
  id: string;
  title: string;
  durationMin: number;
  frequency: string; // DAILY | WEEKDAYS | N_PER_WEEK
  perWeek: number;
  idealWindowStartMin: number;
  idealWindowEndMin: number;
  color: string;
}

export interface GeneratedBlock {
  title: string;
  start: Date;
  end: Date;
  type: EventType;
  state: EventState;
  locked: boolean;
  color: string;
  sourceTaskId?: string;
  sourceHabitId?: string;
}

export interface PlanResult {
  blocks: GeneratedBlock[];
  unscheduledTaskIds: string[]; // nothing could be placed
  partialTaskIds: string[]; // some but not all duration placed
}

const FOCUS_CHUNK_MIN = 90;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function planHorizon(
  now: Date,
  settings: SchedulerSettings,
  fixed: FixedEvent[],
  tasks: SchedTask[],
  habits: SchedHabit[],
  timeOff: Interval[] = [],
): PlanResult {
  const workdays = parseWorkdays(settings.workdays);
  const horizonEnd = addMinutes(
    startOfDay(now),
    settings.planHorizonDays * 24 * 60,
  );
  const windows = workingWindows(
    now,
    settings.planHorizonDays,
    settings.workdayStartMin,
    settings.workdayEndMin,
    workdays,
  );

  // Busy timeline seeded with all immovable blocks. We mutate this as we place.
  const busy: Interval[] = fixed.map((f) => ({ start: f.start, end: f.end }));
  const out: GeneratedBlock[] = [];

  const reserve = (iv: Interval) => busy.push(iv);

  // Focus & habits are suppressed during time-off (travel) ranges.
  const intersectsTimeOff = (s: Date, e: Date) =>
    timeOff.some((t) => s < t.end && t.start < e);

  // --- Buffers seeded around meetings (so nothing ends up back-to-back) ---
  if (settings.defaultBufferMin > 0) {
    const meetings = fixed.filter((f) => f.type === "MEETING" && !f.noBuffer);
    for (const m of meetings) {
      // before
      const beforeStart = freeBefore(m.start, settings.defaultBufferMin, busy);
      if (beforeStart && minutesBetween(beforeStart, m.start) > 0) {
        const iv = { start: beforeStart, end: m.start };
        reserve(iv);
        out.push(makeBlock("Buffer", iv, "BUFFER"));
      }
      // after
      const afterEnd = freeAfter(m.end, settings.defaultBufferMin, busy);
      if (afterEnd && minutesBetween(m.end, afterEnd) > 0) {
        const iv = { start: m.end, end: afterEnd };
        reserve(iv);
        out.push(makeBlock("Buffer", iv, "BUFFER"));
      }
    }
  }

  // --- Habits ---
  for (const habit of habits) {
    const days = habitDays(now, settings.planHorizonDays, habit, workdays);
    for (const day of days) {
      const winStart = atMinuteOfDay(day, habit.idealWindowStartMin);
      const winEnd = atMinuteOfDay(day, habit.idealWindowEndMin);
      const clippedStart = winStart < now ? now : winStart;
      if (clippedStart >= winEnd) continue;
      const gaps = subtractBusy({ start: clippedStart, end: winEnd }, busy).filter(
        (g) => minutesBetween(g.start, g.end) >= habit.durationMin,
      );
      if (gaps.length === 0) continue;
      const g = gaps[0];
      const iv = { start: g.start, end: addMinutes(g.start, habit.durationMin) };
      if (intersectsTimeOff(iv.start, iv.end)) continue; // away — skip habit
      reserve(iv);
      out.push(makeBlock(habit.title, iv, "HABIT_BLOCK", habit));
    }
  }

  // --- Focus time (per week toward target) ---
  const targetMin = settings.weeklyFocusTargetHours * 60;
  if (targetMin > 0) {
    const placedByWeek = new Map<string, number>();
    // seed weeks that already have focus? none yet (fresh plan), start at 0.
    let guard = 0;
    while (guard++ < 200) {
      const gaps = findGaps(windows, busy, 30).filter(
        (g) =>
          g.start >= now &&
          g.end <= horizonEnd &&
          !intersectsTimeOff(g.start, g.end),
      );
      // pick the largest gap whose week still needs focus
      let best: Interval | null = null;
      for (const g of gaps) {
        const wk = weekKey(g.start);
        if ((placedByWeek.get(wk) ?? 0) >= targetMin) continue;
        if (!best || minutesBetween(g.start, g.end) > minutesBetween(best.start, best.end))
          best = g;
      }
      if (!best) break;
      const wk = weekKey(best.start);
      const remaining = targetMin - (placedByWeek.get(wk) ?? 0);
      const len = clamp(
        Math.min(FOCUS_CHUNK_MIN, minutesBetween(best.start, best.end)),
        30,
        remaining,
      );
      if (len < 30) break;
      const iv = { start: best.start, end: addMinutes(best.start, len) };
      reserve(iv);
      out.push(makeBlock("Focus Time", iv, "FOCUS"));
      placedByWeek.set(wk, (placedByWeek.get(wk) ?? 0) + len);
    }
  }

  // --- Tasks (dependency-ordered, then priority/due) ---
  const unscheduledTaskIds: string[] = [];
  const partialTaskIds: string[] = [];

  // Only prerequisites still in the planning set can block a task. A prereq
  // that's already "done" is filtered out upstream, so its absence == satisfied.
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const presentIds = new Set(tasks.map((t) => t.id));
  const prereqs = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const t of tasks) {
    const ps = (t.dependsOnIds ?? []).filter((id) => presentIds.has(id));
    prereqs.set(t.id, ps);
    indeg.set(t.id, ps.length);
    for (const p of ps) {
      if (!dependents.has(p)) dependents.set(p, []);
      dependents.get(p)!.push(t.id);
    }
  }

  const taskEnd = new Map<string, Date>(); // last block end of a fully-scheduled task
  const blocked = new Set<string>(); // unscheduled/partial → its dependents can't run
  const processed = new Set<string>();

  const byPriorityDue = (a: string, b: string) => {
    const ta = taskById.get(a)!;
    const tb = taskById.get(b)!;
    if (ta.priority !== tb.priority) return ta.priority - tb.priority;
    const ad = ta.due ? ta.due.getTime() : Infinity;
    const bd = tb.due ? tb.due.getTime() : Infinity;
    return ad - bd;
  };

  // Kahn-style: schedule a task only once all its present prerequisites are done.
  const ready: string[] = tasks
    .filter((t) => indeg.get(t.id) === 0)
    .map((t) => t.id);

  while (ready.length > 0) {
    ready.sort(byPriorityDue);
    const id = ready.shift()!;
    const task = taskById.get(id)!;
    processed.add(id);

    // Earliest start imposed by prerequisites (their latest scheduled block end).
    let earliest = now;
    let prereqFailed = false;
    for (const p of prereqs.get(id)!) {
      if (blocked.has(p)) {
        prereqFailed = true;
        break;
      }
      const pe = taskEnd.get(p);
      if (pe && pe > earliest) earliest = pe;
    }

    if (prereqFailed) {
      // A prerequisite couldn't be fully scheduled — this task can't run either.
      unscheduledTaskIds.push(id);
      blocked.add(id);
    } else {
      let remaining = task.durationMin;
      const deadline = task.due ?? horizonEnd;
      let placedAny = false;
      let lastEnd: Date | null = null;
      let guard = 0;
      while (remaining > 0 && guard++ < 100) {
        const minNeeded = Math.min(task.minChunkMin, remaining);
        // Chunks of the same task keep a gap between them (no back-to-back).
        const minStart: Date = lastEnd
          ? addMinutes(lastEnd, settings.minGapBetweenTaskChunks)
          : earliest;
        const gaps = findGaps(windows, busy, minNeeded).filter(
          (g) =>
            g.start >= minStart &&
            g.start < deadline &&
            !intersectsTimeOff(g.start, g.end),
        );
        let placed = false;
        for (const g of gaps) {
          const effEnd = g.end < deadline ? g.end : deadline;
          const usable = minutesBetween(g.start, effEnd);
          if (usable < minNeeded) continue; // deadline clipped it too short
          const chunk = Math.min(remaining, task.maxChunkMin, usable);
          const iv = { start: g.start, end: addMinutes(g.start, chunk) };
          reserve(iv);
          out.push(
            makeBlock(task.title, iv, "TASK_BLOCK", undefined, task.id, priorityColor(task.priority)),
          );
          remaining -= chunk;
          placedAny = true;
          placed = true;
          lastEnd = iv.end;

          // A long task block earns a trailing buffer so the next thing isn't
          // scheduled back-to-back against it.
          if (
            chunk >= settings.minTaskDurationForBuffer &&
            settings.defaultBufferMin > 0
          ) {
            const bEnd = freeAfter(iv.end, settings.defaultBufferMin, busy);
            if (bEnd && minutesBetween(iv.end, bEnd) > 0) {
              const bIv = { start: iv.end, end: bEnd };
              reserve(bIv);
              out.push(makeBlock("Buffer", bIv, "BUFFER"));
            }
          }
          break;
        }
        if (!placed) break;
      }

      if (!placedAny) {
        unscheduledTaskIds.push(id);
        blocked.add(id);
      } else if (remaining > 0) {
        partialTaskIds.push(id);
        blocked.add(id); // not fully scheduled → dependents must wait
      } else {
        taskEnd.set(id, lastEnd!);
      }
    }

    // Release dependents whose prerequisites are now all processed.
    for (const d of dependents.get(id) ?? []) {
      const n = (indeg.get(d) ?? 0) - 1;
      indeg.set(d, n);
      if (n === 0) ready.push(d);
    }
  }

  // Anything never processed is part of a dependency cycle — surface it.
  for (const t of tasks) {
    if (!processed.has(t.id)) unscheduledTaskIds.push(t.id);
  }

  // --- Free → Busy locking ---
  // Near-term flexible blocks "commit" (BUSY + locked) so they stop drifting as
  // the day approaches. Task blocks are the exception: they must stay mutable so
  // a replan can shift them to accommodate a newly added meeting/commitment.
  // (A user can still pin a specific task by dragging it, which locks it
  // explicitly via the API — that manual lock is honored on the next replan.)
  const lockBefore = addMinutes(now, settings.lockHorizonHours * 60);
  for (const b of out) {
    if (b.type === "TASK_BLOCK") {
      b.state = "FREE";
      b.locked = false;
      continue;
    }
    if (b.start <= lockBefore) {
      b.state = "BUSY";
      b.locked = true;
    } else {
      b.state = "FREE";
      b.locked = false;
    }
  }

  return { blocks: out, unscheduledTaskIds, partialTaskIds };
}

// ---- helpers ----

function makeBlock(
  title: string,
  iv: Interval,
  type: EventType,
  habit?: SchedHabit,
  sourceTaskId?: string,
  colorOverride?: string,
): GeneratedBlock {
  return {
    title,
    start: iv.start,
    end: iv.end,
    type,
    state: "FREE",
    locked: false,
    color: colorOverride ?? (habit ? habit.color : TYPE_COLORS[type]),
    sourceTaskId,
    sourceHabitId: habit?.id,
  };
}

/** Start of the contiguous free span immediately before `point` (up to maxLen). */
function freeBefore(point: Date, maxLen: number, busy: Interval[]): Date | null {
  const window = { start: addMinutes(point, -maxLen), end: point };
  const gaps = subtractBusy(window, busy);
  const last = gaps[gaps.length - 1];
  return last && last.end.getTime() === point.getTime() ? last.start : null;
}

/** End of the contiguous free span immediately after `point` (up to maxLen). */
function freeAfter(point: Date, maxLen: number, busy: Interval[]): Date | null {
  const window = { start: point, end: addMinutes(point, maxLen) };
  const gaps = subtractBusy(window, busy);
  const first = gaps[0];
  return first && first.start.getTime() === point.getTime() ? first.end : null;
}

/** Which calendar days a habit should be scheduled on within the horizon. */
function habitDays(
  now: Date,
  horizonDays: number,
  habit: SchedHabit,
  workdays: Set<number>,
): Date[] {
  const day0 = startOfDay(now);
  const all: Date[] = [];
  for (let i = 0; i < horizonDays; i++) {
    all.push(addMinutes(day0, i * 24 * 60));
  }
  if (habit.frequency === "DAILY") {
    return all;
  }
  if (habit.frequency === "WEEKDAYS") {
    return all.filter((d) => workdays.has(isoWeekday(d)));
  }
  // N_PER_WEEK: pick the first `perWeek` workdays of each week.
  const byWeek = new Map<string, Date[]>();
  for (const d of all.filter((d) => workdays.has(isoWeekday(d)))) {
    const wk = weekKey(d);
    if (!byWeek.has(wk)) byWeek.set(wk, []);
    byWeek.get(wk)!.push(d);
  }
  const picked: Date[] = [];
  for (const days of byWeek.values()) {
    picked.push(...days.slice(0, habit.perWeek));
  }
  return picked;
}
