import { prisma, getSettings } from "@/lib/db";
import { ok, bad, parseBody } from "@/lib/api";
import { eventPatch } from "@/lib/types";
import { localDateStr } from "@/lib/time";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = await parseBody(req, eventPatch);
  if ("error" in parsed) return bad(parsed.error);
  const data = parsed.data;
  if (data.start && data.end && data.end <= data.start)
    return bad("End must be after start");
  try {
    const event = await prisma.event.update({ where: { id }, data });
    return ok(event);
  } catch {
    return bad("Event not found", 404);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return bad("Event not found", 404);

    // For recurring occurrences, record this date as deleted so expandSeries
    // skips it on the next replan (simply deleting the row would regenerate it).
    if (event.sourceSeriesId) {
      const series = await prisma.recurringEvent.findUnique({
        where: { id: event.sourceSeriesId },
      });
      if (series) {
        const { timezone } = await getSettings();
        const existing = new Set<string>(
          JSON.parse(series.deletedDates || "[]") as string[],
        );
        existing.add(localDateStr(event.start, timezone));
        // For override events, also mark the original slot so it doesn't come back.
        if (event.seriesOriginalDate) existing.add(event.seriesOriginalDate);
        await prisma.recurringEvent.update({
          where: { id: event.sourceSeriesId },
          data: { deletedDates: JSON.stringify([...existing]) },
        });
      }
    }

    await prisma.event.delete({ where: { id } });
    return ok({ ok: true });
  } catch {
    return bad("Event not found", 404);
  }
}
