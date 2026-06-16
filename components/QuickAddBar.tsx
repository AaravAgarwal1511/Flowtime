"use client";

import { useState } from "react";
import { Sparkles, Plus, Loader2 } from "lucide-react";

interface ParsedTask {
  title: string;
  durationMin: number;
  due: string | null;
  priority: number;
}

interface Props {
  enabled: boolean; // Groq key present → richer NL parsing
  onAdded: () => void | Promise<void>;
}

export default function QuickAddBar({ enabled, onAdded }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/llm/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data: { task: ParsedTask } = await res.json();
      const t = data.task;
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(t),
      });
      setNote(
        `Added “${t.title}” · ${Math.round(t.durationMin / 60 * 10) / 10}h · P${t.priority}`,
      );
      setText("");
      await onAdded();
    } catch {
      setNote("Could not add that — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 focus-within:border-[var(--primary)] transition-colors">
        <Sparkles size={16} className="text-[var(--primary)] shrink-0" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            enabled
              ? "Add a task in plain English — e.g. “Finish report by Friday, ~3h, high priority”"
              : "Add a task — e.g. “Finish report by Friday 3h high”"
          }
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="flex items-center gap-1 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-[var(--primary-strong)]"
        >
          {busy ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Plus size={15} />
          )}
          Add
        </button>
      </div>
      {note && <p className="mt-1.5 px-1 text-xs text-gray-500">{note}</p>}
    </form>
  );
}
