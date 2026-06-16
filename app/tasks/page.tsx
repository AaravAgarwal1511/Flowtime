import { prisma, DEMO_USER_ID } from "@/lib/db";
import TasksClient from "@/components/TasksClient";
import { TaskDTO } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const tasks = await prisma.task.findMany({
    where: { userId: DEMO_USER_ID },
    orderBy: [{ status: "asc" }, { priority: "asc" }, { due: "asc" }],
    include: { dependsOn: { select: { id: true } } },
  });

  const dtos: TaskDTO[] = tasks.map((t) => ({
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

  return <TasksClient tasks={dtos} />;
}
