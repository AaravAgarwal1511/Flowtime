import { ok, bad } from "@/lib/api";
import { isGroqEnabled, parseNaturalInput } from "@/lib/groq";

export async function POST(req: Request) {
  let text = "";
  try {
    const body = await req.json();
    text = String(body?.text ?? "");
  } catch {
    return bad("Invalid body");
  }
  if (!text.trim()) return bad("Empty input");
  const task = await parseNaturalInput(text);
  return ok({ enabled: isGroqEnabled(), task });
}
