import { prisma, DEMO_USER_ID } from "@/lib/db";
import { ok, bad, parseBody } from "@/lib/api";
import { habitInput } from "@/lib/types";

export async function GET() {
  const habits = await prisma.habit.findMany({
    where: { userId: DEMO_USER_ID },
    orderBy: { createdAt: "asc" },
  });
  return ok(habits);
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, habitInput);
  if ("error" in parsed) return bad(parsed.error);
  const habit = await prisma.habit.create({
    data: { ...parsed.data, userId: DEMO_USER_ID },
  });
  return ok(habit, 201);
}
