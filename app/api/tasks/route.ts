import { prisma, DEMO_USER_ID } from "@/lib/db";
import { ok, bad, parseBody } from "@/lib/api";
import { taskInput } from "@/lib/types";

export async function GET() {
  const tasks = await prisma.task.findMany({
    where: { userId: DEMO_USER_ID },
    orderBy: [{ priority: "asc" }, { due: "asc" }, { createdAt: "desc" }],
    include: { dependsOn: { select: { id: true } } },
  });
  return ok(
    tasks.map(({ dependsOn, ...t }) => ({
      ...t,
      dependsOnIds: dependsOn.map((d) => d.id),
    })),
  );
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, taskInput);
  if ("error" in parsed) return bad(parsed.error);
  const { dependsOnIds, ...data } = parsed.data;
  const task = await prisma.task.create({
    data: {
      ...data,
      userId: DEMO_USER_ID,
      ...(dependsOnIds && dependsOnIds.length > 0
        ? { dependsOn: { connect: dependsOnIds.map((id) => ({ id })) } }
        : {}),
    },
  });
  return ok(task, 201);
}
