import { prisma, DEMO_USER_ID } from "@/lib/db";
import HabitsClient from "@/components/HabitsClient";
import { HabitDTO } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function HabitsPage() {
  const habits = await prisma.habit.findMany({
    where: { userId: DEMO_USER_ID },
    orderBy: { createdAt: "asc" },
  });

  const dtos: HabitDTO[] = habits.map((h) => ({
    id: h.id,
    title: h.title,
    durationMin: h.durationMin,
    frequency: h.frequency,
    perWeek: h.perWeek,
    idealWindowStartMin: h.idealWindowStartMin,
    idealWindowEndMin: h.idealWindowEndMin,
    kind: h.kind,
    color: h.color,
    active: h.active,
  }));

  return <HabitsClient habits={dtos} />;
}
