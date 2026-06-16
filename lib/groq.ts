// Optional Groq LLM layer. Everything degrades gracefully: when GROQ_API_KEY is
// unset (or a call fails), deterministic fallbacks keep the app fully functional.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

export function isGroqEnabled(): boolean {
  return !!process.env.GROQ_API_KEY;
}

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

/** Low-level JSON call. Returns parsed object or null on any failure. */
async function callGroqJSON(messages: ChatMessage[]): Promise<unknown | null> {
  if (!isGroqEnabled()) return null;
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/** Plain-text call (for insights). Returns string or null. */
async function callGroqText(messages: ChatMessage[]): Promise<string | null> {
  if (!isGroqEnabled()) return null;
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.5,
        messages,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.trim() : null;
  } catch {
    return null;
  }
}

export interface ParsedTask {
  title: string;
  durationMin: number;
  due: string | null; // ISO
  priority: number; // 1..4
}

export async function parseNaturalInput(text: string): Promise<ParsedTask> {
  const llm = (await callGroqJSON([
    {
      role: "system",
      content:
        `You convert a natural-language to-do into JSON. Today is ${new Date().toISOString()}. ` +
        `Return ONLY: {"title": string, "durationMin": number, "due": string|null (ISO 8601), "priority": 1|2|3|4} ` +
        `where priority 1=urgent,2=high,3=medium,4=low. Strip duration/priority/date phrases out of the title.`,
    },
    { role: "user", content: text },
  ])) as Partial<ParsedTask> | null;

  if (llm && typeof llm.title === "string") {
    return {
      title: llm.title,
      durationMin: clampInt(llm.durationMin, 15, 600, 60),
      due: normalizeDue(llm.due),
      priority: clampInt(llm.priority, 1, 4, 3),
    };
  }
  return fallbackParse(text);
}

export async function suggestPriorityDuration(
  title: string,
): Promise<{ priority: number; durationMin: number }> {
  const llm = (await callGroqJSON([
    {
      role: "system",
      content:
        `Given a task title, estimate effort. Return ONLY ` +
        `{"durationMin": number, "priority": 1|2|3|4} (1=urgent..4=low).`,
    },
    { role: "user", content: title },
  ])) as { priority?: number; durationMin?: number } | null;

  if (llm) {
    return {
      priority: clampInt(llm.priority, 1, 4, 3),
      durationMin: clampInt(llm.durationMin, 15, 600, 60),
    };
  }
  const p = fallbackParse(title);
  return { priority: p.priority, durationMin: p.durationMin };
}

export async function planDayCommand(
  text: string,
): Promise<{ reasoning: string }> {
  const llm = await callGroqText([
    {
      role: "system",
      content:
        "You are a scheduling assistant. The user issued a command about their calendar; " +
        "the calendar has just been re-planned by a rule engine. In ONE short sentence, " +
        "acknowledge the command and what was done.",
    },
    { role: "user", content: text },
  ]);
  return { reasoning: llm ?? "Re-planned your day around your fixed commitments." };
}

export async function scheduleInsights(summary: string): Promise<string | null> {
  return callGroqText([
    {
      role: "system",
      content:
        "You are a friendly productivity coach. Given a summary of a person's weekly " +
        "calendar time distribution, write 2 short sentences of insight/advice about " +
        "their work-life balance and focus. Be concrete and encouraging.",
    },
    { role: "user", content: summary },
  ]);
}

// ---------- helpers / fallbacks ----------

function clampInt(
  v: unknown,
  lo: number,
  hi: number,
  dflt: number,
): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (Number.isNaN(n)) return dflt;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function normalizeDue(due: unknown): string | null {
  if (!due || typeof due !== "string") return null;
  const d = new Date(due);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/** Deterministic regex parser used when no Groq key is present. */
export function fallbackParse(text: string): ParsedTask {
  let working = ` ${text} `;

  // duration: "3h", "1.5h", "90m", "2 hours", "45 min"
  let durationMin = 60;
  const hourMatch = working.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?)\b/i);
  const minMatch = working.match(/(\d+)\s*(m|min|mins|minutes?)\b/i);
  if (hourMatch) {
    durationMin = Math.round(parseFloat(hourMatch[1]) * 60);
    working = working.replace(hourMatch[0], " ");
  } else if (minMatch) {
    durationMin = parseInt(minMatch[1], 10);
    working = working.replace(minMatch[0], " ");
  }
  durationMin = Math.max(15, Math.min(600, durationMin));

  // priority
  let priority = 3;
  if (/\b(p1|urgent|asap|critical)\b/i.test(working)) priority = 1;
  else if (/\b(p2|high|important)\b/i.test(working)) priority = 2;
  else if (/\b(p4|low|whenever|someday)\b/i.test(working)) priority = 4;
  else if (/\b(p3|medium|normal)\b/i.test(working)) priority = 3;
  working = working.replace(
    /\b(p[1-4]|urgent|asap|critical|high|important|low|whenever|someday|medium|normal)\b/gi,
    " ",
  );

  // due date
  let due: string | null = null;
  const now = new Date();
  const lower = working.toLowerCase();
  if (/\btomorrow\b/.test(lower)) {
    due = endOfDayOffset(1);
    working = working.replace(/\btomorrow\b/i, " ");
  } else if (/\btoday\b/.test(lower)) {
    due = endOfDayOffset(0);
    working = working.replace(/\btoday\b/i, " ");
  } else {
    const inDays = lower.match(/\bin\s+(\d+)\s+days?\b/);
    if (inDays) {
      due = endOfDayOffset(parseInt(inDays[1], 10));
      working = working.replace(inDays[0], " ");
    } else {
      for (let i = 0; i < WEEKDAYS.length; i++) {
        const re = new RegExp(`\\b(by\\s+|on\\s+)?${WEEKDAYS[i]}\\b`, "i");
        if (re.test(lower)) {
          const target = nextWeekday(now, i);
          due = target.toISOString();
          working = working.replace(re, " ");
          break;
        }
      }
    }
  }

  // strip leftover connector words
  const title =
    working
      .replace(/\b(by|on|at|for|due|priority|priorities)\b/gi, " ")
      .replace(/[~]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || text.trim();

  return { title, durationMin, due, priority };
}

function endOfDayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(17, 0, 0, 0);
  return d.toISOString();
}

function nextWeekday(from: Date, targetDow: number): Date {
  const d = new Date(from);
  d.setHours(17, 0, 0, 0);
  const diff = (targetDow - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}
