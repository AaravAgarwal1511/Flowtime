import { ok, bad } from "@/lib/api";
import { isGroqEnabled, suggestPriorityDuration } from "@/lib/groq";

export async function POST(req: Request) {
  let title = "";
  try {
    const body = await req.json();
    title = String(body?.title ?? "");
  } catch {
    return bad("Invalid body");
  }
  if (!title.trim()) return bad("Empty title");
  const suggestion = await suggestPriorityDuration(title);
  return ok({ enabled: isGroqEnabled(), ...suggestion });
}
