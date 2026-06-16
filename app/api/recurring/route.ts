import { prisma, DEMO_USER_ID } from "@/lib/db";
import { ok, bad, parseBody } from "@/lib/api";
import { recurringEventInput, TYPE_COLORS } from "@/lib/types";

export async function GET() {
  const series = await prisma.recurringEvent.findMany({
    where: { userId: DEMO_USER_ID },
    orderBy: { createdAt: "asc" },
  });
  return ok(series);
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, recurringEventInput);
  if ("error" in parsed) return bad(parsed.error);
  const d = parsed.data;
  if (d.endMin <= d.startMin) return bad("End time must be after start time");
  const series = await prisma.recurringEvent.create({
    data: {
      userId: DEMO_USER_ID,
      title: d.title,
      startMin: d.startMin,
      endMin: d.endMin,
      days: d.days,
      color: d.color ?? TYPE_COLORS.COMMITMENT,
      active: d.active,
    },
  });
  return ok(series, 201);
}
