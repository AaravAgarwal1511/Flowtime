import { prisma } from "@/lib/db";
import { ok, bad, parseBody } from "@/lib/api";
import { habitInput } from "@/lib/types";

const habitPatch = habitInput.partial();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = await parseBody(req, habitPatch);
  if ("error" in parsed) return bad(parsed.error);
  try {
    const habit = await prisma.habit.update({ where: { id }, data: parsed.data });
    return ok(habit);
  } catch {
    return bad("Habit not found", 404);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await prisma.habit.delete({ where: { id } });
    return ok({ ok: true });
  } catch {
    return bad("Habit not found", 404);
  }
}
