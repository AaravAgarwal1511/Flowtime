import { prisma, DEMO_USER_ID } from "@/lib/db";
import { ok, bad, parseBody } from "@/lib/api";
import { taskInput } from "@/lib/types";

const taskPatch = taskInput.partial();

/**
 * True if making `prereqIds` prerequisites of `taskId` would create a cycle —
 * i.e. `taskId` is itself reachable by following dependsOn edges from any of
 * them. Walks the existing graph for the single demo user.
 */
async function wouldCreateCycle(
  taskId: string,
  prereqIds: string[],
): Promise<boolean> {
  if (prereqIds.includes(taskId)) return true; // self-dependency
  const all = await prisma.task.findMany({
    where: { userId: DEMO_USER_ID },
    select: { id: true, dependsOn: { select: { id: true } } },
  });
  const graph = new Map(all.map((t) => [t.id, t.dependsOn.map((d) => d.id)]));
  // BFS from each new prerequisite; if we reach taskId, a cycle would form.
  const stack = [...prereqIds];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === taskId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...(graph.get(cur) ?? []));
  }
  return false;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = await parseBody(req, taskPatch);
  if ("error" in parsed) return bad(parsed.error);
  const { dependsOnIds, ...data } = parsed.data;

  if (dependsOnIds && (await wouldCreateCycle(id, dependsOnIds))) {
    return bad("That dependency would create a cycle.");
  }

  try {
    const task = await prisma.task.update({
      where: { id },
      data: {
        ...data,
        ...(dependsOnIds
          ? { dependsOn: { set: dependsOnIds.map((depId) => ({ id: depId })) } }
          : {}),
      },
    });
    return ok(task);
  } catch {
    return bad("Task not found", 404);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await prisma.task.delete({ where: { id } });
    return ok({ ok: true });
  } catch {
    return bad("Task not found", 404);
  }
}
