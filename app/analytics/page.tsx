import { prisma, DEMO_USER_ID } from "@/lib/db";
import AnalyticsClient from "@/components/AnalyticsClient";
import { startOfWeek, totalsByType, weeklyByDay } from "@/lib/stats";
import { EventType, TYPE_COLORS } from "@/lib/types";
import { TYPE_LABELS } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const weekStart = startOfWeek();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const events = await prisma.event.findMany({
    where: { userId: DEMO_USER_ID, start: { gte: weekStart, lt: weekEnd } },
  });

  const eventLikes = events.map((e) => ({
    start: e.start,
    end: e.end,
    type: e.type as EventType,
  }));

  const totals = totalsByType(eventLikes, weekStart, weekEnd);
  const toH = (m: number) => Math.round((m / 60) * 10) / 10;

  const donutTypes: EventType[] = [
    "MEETING",
    "COMMITMENT",
    "TASK_BLOCK",
    "HABIT_BLOCK",
  ];
  const donut = donutTypes
    .map((t) => ({
      name: TYPE_LABELS[t],
      value: toH(totals[t]),
      color: TYPE_COLORS[t],
    }))
    .filter((d) => d.value > 0);

  const weekly = weeklyByDay(eventLikes, weekStart);

  return (
    <AnalyticsClient
      donut={donut}
      weekly={weekly}
      taskHours={toH(totals.TASK_BLOCK)}
      meetingHours={toH(totals.MEETING)}
      commitmentHours={toH(totals.COMMITMENT)}
      totalHours={toH(
        totals.MEETING +
          totals.TASK_BLOCK +
          totals.HABIT_BLOCK +
          totals.COMMITMENT,
      )}
    />
  );
}
