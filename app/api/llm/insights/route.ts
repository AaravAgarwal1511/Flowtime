import { prisma, DEMO_USER_ID } from "@/lib/db";
import { ok } from "@/lib/api";
import { isGroqEnabled, scheduleInsights } from "@/lib/groq";
import { startOfWeek, summarizeForInsight } from "@/lib/stats";
import { EventType } from "@/lib/types";

export async function POST() {
  if (!isGroqEnabled()) return ok({ enabled: false });

  const weekStart = startOfWeek();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const events = await prisma.event.findMany({
    where: { userId: DEMO_USER_ID, start: { gte: weekStart, lt: weekEnd } },
  });

  const summary = summarizeForInsight(
    events.map((e) => ({ start: e.start, end: e.end, type: e.type as EventType })),
    weekStart,
  );
  const text = await scheduleInsights(summary);
  return ok({ enabled: true, text });
}
