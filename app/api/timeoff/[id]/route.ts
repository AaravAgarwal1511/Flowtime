import { prisma } from "@/lib/db";
import { ok, bad } from "@/lib/api";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await prisma.timeOff.delete({ where: { id } });
    return ok({ ok: true });
  } catch {
    return bad("Time-off range not found", 404);
  }
}
