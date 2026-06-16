import { prisma, DEMO_USER_ID, getSettings } from "@/lib/db";
import PlannerClient from "@/components/PlannerClient";
import { CalEventDTO, TaskDTO, TimeOffDTO, RecurringEventDTO } from "@/lib/ui";
import { EventType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlannerPage() {
  const settings = await getSettings();
  const [events, tasks, timeOff, series] = await Promise.all([
    prisma.event.findMany({
      where: { userId: DEMO_USER_ID },
      orderBy: { start: "asc" },
    }),
    prisma.task.findMany({
      where: { userId: DEMO_USER_ID },
      orderBy: [{ priority: "asc" }, { due: "asc" }],
      include: { dependsOn: { select: { id: true } } },
    }),
    prisma.timeOff.findMany({
      where: { userId: DEMO_USER_ID },
      orderBy: { start: "asc" },
    }),
    prisma.recurringEvent.findMany({
      where: { userId: DEMO_USER_ID },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const eventDTOs: CalEventDTO[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start.toISOString(),
    end: e.end.toISOString(),
    type: e.type as EventType,
    state: e.state as "FREE" | "BUSY",
    flexible: e.flexible,
    locked: e.locked,
    color: e.color,
    noBuffer: e.noBuffer,
    seriesOverride: e.seriesOverride,
    sourceTaskId: e.sourceTaskId,
    sourceHabitId: e.sourceHabitId,
    sourceSeriesId: e.sourceSeriesId,
  }));

  const taskDTOs: TaskDTO[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    notes: t.notes,
    durationMin: t.durationMin,
    minChunkMin: t.minChunkMin,
    maxChunkMin: t.maxChunkMin,
    due: t.due ? t.due.toISOString() : null,
    priority: t.priority,
    status: t.status,
    dependsOnIds: t.dependsOn.map((d) => d.id),
  }));

  const timeOffDTOs: TimeOffDTO[] = timeOff.map((t) => ({
    id: t.id,
    label: t.label,
    start: t.start.toISOString(),
    end: t.end.toISOString(),
  }));

  const seriesDTOs: RecurringEventDTO[] = series.map((s) => ({
    id: s.id,
    title: s.title,
    startMin: s.startMin,
    endMin: s.endMin,
    days: s.days,
    color: s.color,
    active: s.active,
  }));

  return (
    <PlannerClient
      initialEvents={eventDTOs}
      initialTasks={taskDTOs}
      initialTimeOff={timeOffDTOs}
      initialSeries={seriesDTOs}
      workHours={{
        startMin: settings.workdayStartMin,
        endMin: settings.workdayEndMin,
        workdays: settings.workdays
          .split(",")
          .map((d) => Number(d.trim()))
          .filter((n) => n >= 1 && n <= 7),
      }}
      groqEnabled={!!process.env.GROQ_API_KEY}
    />
  );
}
