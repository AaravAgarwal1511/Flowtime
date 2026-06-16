import { prisma, DEMO_USER_ID, getSettings } from "@/lib/db";
import { ok, bad, parseBody } from "@/lib/api";
import { settingsInput } from "@/lib/types";

export async function GET() {
  const settings = await getSettings();
  return ok(settings);
}

export async function PATCH(req: Request) {
  const parsed = await parseBody(req, settingsInput);
  if ("error" in parsed) return bad(parsed.error);
  const settings = await prisma.userSettings.update({
    where: { userId: DEMO_USER_ID },
    data: parsed.data,
  });
  return ok(settings);
}
