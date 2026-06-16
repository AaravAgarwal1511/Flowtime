import { prisma, DEMO_USER_ID } from "@/lib/db";
import { ok, bad, parseBody } from "@/lib/api";
import { eventInput, TYPE_COLORS, EventType } from "@/lib/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const where: {
    userId: string;
    start?: { gte?: Date };
    end?: { lte?: Date };
  } = { userId: DEMO_USER_ID };
  if (from) where.start = { gte: new Date(from) };
  if (to) where.end = { lte: new Date(to) };

  const events = await prisma.event.findMany({
    where,
    orderBy: { start: "asc" },
  });
  return ok(events);
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, eventInput);
  if ("error" in parsed) return bad(parsed.error);
  const data = parsed.data;
  if (data.end <= data.start) return bad("End must be after start");
  const event = await prisma.event.create({
    data: {
      userId: DEMO_USER_ID,
      title: data.title,
      start: data.start,
      end: data.end,
      type: data.type,
      flexible: data.flexible,
      state: data.state,
      locked: data.locked,
      color: data.color ?? TYPE_COLORS[data.type as EventType],
      noBuffer: data.noBuffer ?? false,
    },
  });
  return ok(event, 201);
}
