import { prisma, DEMO_USER_ID } from "@/lib/db";
import { ok, bad, parseBody } from "@/lib/api";
import { timeOffInput } from "@/lib/types";

/** Parse a YYYY-MM-DD as a local start-of-day Date (no timezone drift). */
function localDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export async function GET() {
  const ranges = await prisma.timeOff.findMany({
    where: { userId: DEMO_USER_ID },
    orderBy: { start: "asc" },
  });
  return ok(ranges);
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, timeOffInput);
  if ("error" in parsed) return bad(parsed.error);

  const start = localDay(parsed.data.start);
  // `end` is the last away day → store exclusive end = start-of-next-day.
  const lastDay = localDay(parsed.data.end);
  const end = new Date(lastDay.getTime() + 24 * 60 * 60 * 1000);
  if (end <= start) return bad("End date must be on or after the start date");

  const range = await prisma.timeOff.create({
    data: {
      userId: DEMO_USER_ID,
      label: parsed.data.label ?? null,
      start,
      end,
    },
  });
  return ok(range, 201);
}
