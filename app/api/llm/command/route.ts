import { DEMO_USER_ID } from "@/lib/db";
import { ok, bad } from "@/lib/api";
import { runPlan } from "@/lib/plan";
import { isGroqEnabled, planDayCommand } from "@/lib/groq";

export async function POST(req: Request) {
  let text = "";
  try {
    const body = await req.json();
    text = String(body?.text ?? "");
  } catch {
    return bad("Invalid body");
  }
  // The command always triggers a re-plan; the LLM only narrates it.
  await runPlan(DEMO_USER_ID);
  const { reasoning } = await planDayCommand(text || "plan my day");
  return ok({ enabled: isGroqEnabled(), reasoning });
}
