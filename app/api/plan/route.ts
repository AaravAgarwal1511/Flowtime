import { DEMO_USER_ID } from "@/lib/db";
import { ok, bad } from "@/lib/api";
import { runPlan } from "@/lib/plan";

export async function POST() {
  try {
    const result = await runPlan(DEMO_USER_ID);
    return ok(result);
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Planning failed", 500);
  }
}
