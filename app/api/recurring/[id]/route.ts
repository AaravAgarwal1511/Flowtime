import { prisma } from "@/lib/db";
import { ok, bad, parseBody } from "@/lib/api";
import { recurringEventInput } from "@/lib/types";

const patchSchema = recurringEventInput.partial();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = await parseBody(req, patchSchema);
  if ("error" in parsed) return bad(parsed.error);
  try {
    const series = await prisma.recurringEvent.update({
      where: { id },
      data: parsed.data,
    });
    return ok(series);
  } catch {
    return bad("Recurring event not found", 404);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    // Cascade removes generated occurrences via Event.sourceSeries onDelete.
    await prisma.recurringEvent.delete({ where: { id } });
    return ok({ ok: true });
  } catch {
    return bad("Recurring event not found", 404);
  }
}
