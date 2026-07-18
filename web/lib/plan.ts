// Orchestration around the pure scheduler: reads DB → plans → persists.
// Used by both POST /api/plan and the seed script.

import { prisma } from "./db";
import {
  FixedEvent,
  SchedHabit,
  SchedTask,
  SchedulerSettings,
  planHorizon,
} from "./scheduler";
import { EventType } from "./types";
import { expandSeries } from "./recurrence";
import { localDateStr } from "./time";

export interface RunPlanResult {
  created: number;
  unscheduledTaskIds: string[];
  partialTaskIds: string[];
  rescheduledOverdueTaskIds: string[]; // overdue + unfinished → replanned ASAP
}

export async function runPlan(
  userId: string,
  now: Date = new Date(),
): Promise<RunPlanResult> {
  const settingsRow = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settingsRow) throw new Error("Settings not found for user");
  const tz = settingsRow.timezone;

  const [events, tasks, habits, timeOff, series] = await Promise.all([
    prisma.event.findMany({ where: { userId } }),
    prisma.task.findMany({
      where: { userId, status: { not: "done" } },
      include: { dependsOn: { select: { id: true } } },
    }),
    prisma.habit.findMany({ where: { userId, active: true } }),
    prisma.timeOff.findMany({ where: { userId } }),
    prisma.recurringEvent.findMany({ where: { userId, active: true } }),
  ]);

  const timeOffIntervals = timeOff.map((t) => ({ start: t.start, end: t.end }));
  const isAway = (s: Date, e: Date) =>
    timeOffIntervals.some((t) => s < t.end && t.start < e);

  // --- Auto-unlock a task's stranded final block ---
  // A locked task block is user-pinned and normally survives replans. But when a
  // task's *last* locked block has already ended and the task still isn't done,
  // that pinned slot is stuck in the past. Unlock it so this run reschedules the
  // unfinished work into the future instead of leaving it behind.
  const lastLockedBlockByTask = new Map<string, (typeof events)[number]>();
  for (const e of events) {
    if (e.type !== "TASK_BLOCK" || !e.locked || !e.sourceTaskId) continue;
    const cur = lastLockedBlockByTask.get(e.sourceTaskId);
    if (!cur || e.end > cur.end) lastLockedBlockByTask.set(e.sourceTaskId, e);
  }
  const notDoneTaskIds = new Set(tasks.map((t) => t.id)); // `tasks` excludes done
  const unlockBlockIds: string[] = [];
  for (const [taskId, block] of lastLockedBlockByTask) {
    if (notDoneTaskIds.has(taskId) && block.end <= now) {
      unlockBlockIds.push(block.id);
      block.locked = false; // reflect in memory so it's treated as regenerable below
    }
  }
  if (unlockBlockIds.length > 0) {
    await prisma.event.updateMany({
      where: { id: { in: unlockBlockIds } },
      data: { locked: false, state: "FREE" },
    });
  }

  // Locked task blocks are user-pinned: keep them in place, reserve their time,
  // and count their minutes against the task so the engine doesn't re-place them.
  const lockedMinByTask = new Map<string, number>();
  for (const e of events) {
    if (
      e.type === "TASK_BLOCK" &&
      e.locked &&
      e.sourceTaskId &&
      !isAway(e.start, e.end) // blocks inside time-off are cleared & replanned
    ) {
      const mins = Math.round((e.end.getTime() - e.start.getTime()) / 60000);
      lockedMinByTask.set(
        e.sourceTaskId,
        (lockedMinByTask.get(e.sourceTaskId) ?? 0) + mins,
      );
    }
  }

  // Build per-series skip-date sets: deleted occurrences + manually-moved overrides.
  // Both the override's new position and its original position are skipped so
  // expandSeries doesn't regenerate a conflicting occurrence on either date.
  const skipDates = new Map<string, Set<string>>();
  for (const s of series) {
    const set = new Set<string>(JSON.parse(s.deletedDates || "[]") as string[]);
    skipDates.set(s.id, set);
  }
  for (const e of events) {
    if (!e.sourceSeriesId || !e.seriesOverride) continue;
    const set = skipDates.get(e.sourceSeriesId);
    if (!set) continue;
    set.add(localDateStr(e.start, tz)); // skip the override's new position
    if (e.seriesOriginalDate) set.add(e.seriesOriginalDate); // skip the original slot
  }

  // Recurring commitments are regenerated each plan, so exclude the previous
  // non-override occurrences from `fixed` and re-expand the active series fresh.
  const occurrences = expandSeries(series, now, settingsRow.planHorizonDays, tz, skipDates);

  // Immovable = fixed (meetings/manual) OR any locked flexible block — except
  // focus/habit/task blocks (always regenerated) and the old series occurrences
  // (regenerated below). Override occurrences (seriesOverride=true) ARE kept as
  // immovable since they represent manually-positioned recurring occurrences.
  const fixed: FixedEvent[] = [
    ...events
      .filter(
        (e) =>
          (!e.flexible || e.locked) &&
          (!e.sourceSeriesId || e.seriesOverride) &&
          // Auto-generated blocks are re-derived each plan — except locked task
          // blocks, which the user pinned; those stay put as immovable.
          (!["TASK_BLOCK", "HABIT_BLOCK", "FOCUS", "BUFFER"].includes(e.type) ||
            (e.type === "TASK_BLOCK" && e.locked)),
      )
      .filter(
        (e) =>
          !(
            (e.type === "FOCUS" ||
              e.type === "HABIT_BLOCK" ||
              e.type === "TASK_BLOCK") &&
            isAway(e.start, e.end)
          ),
      )
      .map((e) => ({ start: e.start, end: e.end, type: e.type as EventType, noBuffer: e.noBuffer })),
    ...occurrences.map((o) => ({
      start: o.start,
      end: o.end,
      type: "COMMITMENT" as EventType,
    })),
  ];

  const settings: SchedulerSettings = {
    workdayStartMin: settingsRow.workdayStartMin,
    workdayEndMin: settingsRow.workdayEndMin,
    workdays: settingsRow.workdays,
    defaultBufferMin: settingsRow.defaultBufferMin,
    weeklyFocusTargetHours: settingsRow.weeklyFocusTargetHours,
    lockHorizonHours: settingsRow.lockHorizonHours,
    planHorizonDays: settingsRow.planHorizonDays,
    minTaskDurationForBuffer: settingsRow.minTaskDurationForBuffer,
    minGapBetweenTaskChunks: settingsRow.minGapBetweenTaskChunks,
    timezone: tz,
  };

  // Overdue + unfinished tasks: drop the past deadline for this run so they
  // reschedule ASAP instead of being rejected (every future gap is past `due`).
  const rescheduledOverdueTaskIds: string[] = [];
  const schedTasks: SchedTask[] = [];
  for (const t of tasks) {
    // Subtract minutes already pinned in locked blocks. A task fully covered by
    // pinned blocks needs nothing more placed — skip it (it's still "scheduled").
    const remainingDuration = t.durationMin - (lockedMinByTask.get(t.id) ?? 0);
    if (remainingDuration <= 0) continue;
    const overdue = t.due !== null && t.due < now;
    if (overdue) rescheduledOverdueTaskIds.push(t.id);
    schedTasks.push({
      id: t.id,
      title: t.title,
      durationMin: remainingDuration,
      minChunkMin: t.minChunkMin,
      maxChunkMin: t.maxChunkMin,
      due: overdue ? null : t.due,
      priority: t.priority,
      dependsOnIds: t.dependsOn.map((d) => d.id),
    });
  }

  const schedHabits: SchedHabit[] = habits.map((h) => ({
    id: h.id,
    title: h.title,
    durationMin: h.durationMin,
    frequency: h.frequency,
    perWeek: h.perWeek,
    idealWindowStartMin: h.idealWindowStartMin,
    idealWindowEndMin: h.idealWindowEndMin,
    color: h.color,
  }));

  const result = planHorizon(
    now,
    settings,
    fixed,
    schedTasks,
    schedHabits,
    timeOffIntervals,
  );

  // Wipe previously generated (flexible & unlocked) blocks, then write fresh.
  await prisma.$transaction(async (tx) => {
    // Wipe regenerable blocks so each replan starts fresh. Habit/focus/buffer are
    // always re-derived from their sources. Task blocks are too — EXCEPT locked
    // ones, which the user pinned: those are kept, reserved in `fixed`, and their
    // minutes subtracted from the task above so we never double-schedule them.
    await tx.event.deleteMany({
      where: {
        userId,
        OR: [
          { type: { in: ["HABIT_BLOCK", "FOCUS", "BUFFER"] } },
          { type: "TASK_BLOCK", locked: false },
        ],
      },
    });
    // Clear focus/habit/task blocks (even locked) that fall in a time-off range.
    for (const t of timeOffIntervals) {
      await tx.event.deleteMany({
        where: {
          userId,
          type: { in: ["FOCUS", "HABIT_BLOCK", "TASK_BLOCK"] },
          start: { gte: t.start, lt: t.end },
        },
      });
    }

    // Regenerate recurring commitment occurrences from the active series.
    // Override occurrences (seriesOverride=true) are kept — they've been manually
    // repositioned and survive the replan at their custom times.
    await tx.event.deleteMany({
      where: { userId, sourceSeriesId: { not: null }, seriesOverride: false },
    });
    if (occurrences.length > 0) {
      await tx.event.createMany({
        data: occurrences.map((o) => ({
          userId,
          title: o.title,
          start: o.start,
          end: o.end,
          type: "COMMITMENT",
          flexible: false,
          state: "BUSY",
          locked: false,
          color: o.color,
          sourceSeriesId: o.seriesId,
        })),
      });
    }
    if (result.blocks.length > 0) {
      await tx.event.createMany({
        data: result.blocks.map((b) => ({
          userId,
          title: b.title,
          start: b.start,
          end: b.end,
          type: b.type,
          flexible: true,
          state: b.state,
          locked: b.locked,
          color: b.color,
          sourceTaskId: b.sourceTaskId ?? null,
          sourceHabitId: b.sourceHabitId ?? null,
        })),
      });
    }

    // Reflect scheduling status on tasks. A task counts as scheduled if it got a
    // freshly placed block OR carries a pinned (locked) block from before.
    const scheduledTaskIds = new Set<string>([
      ...(result.blocks.map((b) => b.sourceTaskId).filter(Boolean) as string[]),
      ...lockedMinByTask.keys(),
    ]);
    const allTaskIds = tasks.map((t) => t.id);
    await Promise.all(
      allTaskIds.map((id) =>
        tx.task.update({
          where: { id },
          data: { status: scheduledTaskIds.has(id) ? "scheduled" : "todo" },
        }),
      ),
    );
  });

  return {
    created: result.blocks.length,
    unscheduledTaskIds: result.unscheduledTaskIds,
    partialTaskIds: result.partialTaskIds,
    rescheduledOverdueTaskIds,
  };
}
