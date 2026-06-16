"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarRange, Loader2, Wand2, Sparkles } from "lucide-react";
import CalendarCanvas from "./CalendarCanvas";
import ContextDrawer from "./ContextDrawer";
import QuickAddBar from "./QuickAddBar";
import {
  CalEventDTO,
  TaskDTO,
  TYPE_LABELS,
  dueLabel,
  longDate,
  prettyDuration,
} from "@/lib/ui";
import { TYPE_COLORS } from "@/lib/types";

interface Props {
  initialEvents: CalEventDTO[];
  initialTasks: TaskDTO[];
  groqEnabled: boolean;
}

export default function PlannerClient({
  initialEvents,
  initialTasks,
  groqEnabled,
}: Props) {
  const [events, setEvents] = useState<CalEventDTO[]>(initialEvents);
  const [tasks, setTasks] = useState<TaskDTO[]>(initialTasks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [command, setCommand] = useState("");

  const selected = events.find((e) => e.id === selectedId) ?? null;

  const refetch = useCallback(async () => {
    const [evRes, tkRes] = await Promise.all([
      fetch("/api/events"),
      fetch("/api/tasks"),
    ]);
    setEvents(await evRes.json());
    setTasks(await tkRes.json());
  }, []);

  const fetchInsights = useCallback(async () => {
    if (!groqEnabled) return;
    try {
      const res = await fetch("/api/llm/insights", { method: "POST" });
      const data = await res.json();
      if (data.enabled && data.text) setInsights(data.text);
    } catch {
      /* ignore */
    }
  }, [groqEnabled]);

  useEffect(() => {
    if (!groqEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/llm/insights", { method: "POST" });
        const data = await res.json();
        if (!cancelled && data.enabled && data.text) setInsights(data.text);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groqEnabled]);

  const plan = useCallback(async () => {
    setPlanning(true);
    try {
      await fetch("/api/plan", { method: "POST" });
      await refetch();
      await fetchInsights();
    } finally {
      setPlanning(false);
    }
  }, [refetch, fetchInsights]);

  async function onEventChange(id: string, start: Date, end: Date) {
    // Optimistic update so the drag feels instant.
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              start: start.toISOString(),
              end: end.toISOString(),
              locked: true,
              state: "BUSY",
            }
          : e,
      ),
    );
    await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start: start.toISOString(),
        end: end.toISOString(),
        locked: true,
        state: "BUSY",
      }),
    });
    await plan();
  }

  async function onLockToggle(e: CalEventDTO) {
    const nextLocked = !e.locked;
    await fetch(`/api/events/${e.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locked: nextLocked,
        state: nextLocked ? "BUSY" : "FREE",
      }),
    });
    setSelectedId(null);
    await plan();
  }

  async function onDelete(e: CalEventDTO) {
    await fetch(`/api/events/${e.id}`, { method: "DELETE" });
    setSelectedId(null);
    await plan();
  }

  async function onSelectRange(start: Date, end: Date) {
    const title = window.prompt("New meeting title:");
    if (!title) return;
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        start: start.toISOString(),
        end: end.toISOString(),
        type: "MEETING",
        flexible: false,
        state: "BUSY",
      }),
    });
    await plan();
  }

  async function runCommand(e: React.FormEvent) {
    e.preventDefault();
    if (!command.trim()) return;
    setPlanning(true);
    try {
      const res = await fetch("/api/llm/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: command }),
      });
      const data = await res.json();
      if (data.reasoning) setInsights(data.reasoning);
      setCommand("");
      await refetch();
    } finally {
      setPlanning(false);
    }
  }

  const upcoming = tasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 6);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-white px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Planner</h1>
            <p className="text-xs text-gray-500">{longDate(new Date())}</p>
          </div>
          <button
            onClick={plan}
            disabled={planning}
            className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-strong)] disabled:opacity-60"
          >
            {planning ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Wand2 size={16} />
            )}
            Plan my day
          </button>
        </div>
        <div className="mt-3">
          <QuickAddBar enabled={groqEnabled} onAdded={plan} />
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden p-4">
          <div className="h-full rounded-xl border border-[var(--border)] bg-white p-3">
            <CalendarCanvas
              events={events}
              onEventClick={setSelectedId}
              onEventChange={onEventChange}
              onSelectRange={onSelectRange}
            />
          </div>
        </div>

        {/* Right rail */}
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-[var(--border)] bg-white p-4 space-y-5">
          {groqEnabled && (
            <form onSubmit={runCommand}>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Ask the AI
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--border)] px-2.5 py-1.5 focus-within:border-[var(--primary)]">
                <Sparkles size={14} className="text-[var(--primary)]" />
                <input
                  value={command}
                  onChange={(ev) => setCommand(ev.target.value)}
                  placeholder="e.g. plan my day"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                />
              </div>
            </form>
          )}

          {insights && (
            <div className="rounded-xl bg-[var(--primary)]/5 border border-[var(--primary)]/15 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--primary-strong)]">
                <Sparkles size={13} /> AI insight
              </div>
              <p className="mt-1.5 text-sm text-gray-700 leading-relaxed">
                {insights}
              </p>
            </div>
          )}

          <section>
            <h2 className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <CalendarRange size={14} /> Upcoming tasks
            </h2>
            <ul className="mt-2 space-y-2">
              {upcoming.length === 0 && (
                <li className="text-sm text-gray-400">No tasks yet.</li>
              )}
              {upcoming.map((t) => (
                <li
                  key={t.id}
                  className="rounded-lg border border-[var(--border)] p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">
                      {t.title}
                    </span>
                    <span
                      className="text-[10px] font-semibold rounded px-1.5 py-0.5 shrink-0"
                      style={{
                        background: PRIORITY_COLORS[t.priority],
                        color: "#fff",
                      }}
                    >
                      P{t.priority}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                    <span>{prettyDuration(t.durationMin)}</span>
                    <span>·</span>
                    <span>{dueLabel(t.due)}</span>
                    {t.status === "scheduled" && (
                      <span className="text-emerald-600">· scheduled</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Legend
            </h2>
            <ul className="mt-2 space-y-1.5 text-xs text-gray-600">
              {(Object.keys(TYPE_LABELS) as (keyof typeof TYPE_LABELS)[]).map(
                (k) => (
                  <li key={k} className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded"
                      style={{ background: TYPE_COLORS[k] }}
                    />
                    {TYPE_LABELS[k]}
                  </li>
                ),
              )}
              <li className="flex items-center gap-2 pt-1">
                <span className="h-3 w-3 rounded border-[1.5px] border-dashed border-gray-400" />
                Flexible (Free)
              </li>
            </ul>
          </section>
        </aside>
      </div>

      <ContextDrawer
        event={selected}
        onClose={() => setSelectedId(null)}
        onLockToggle={onLockToggle}
        onDelete={onDelete}
        onReschedule={plan}
      />
    </div>
  );
}

const PRIORITY_COLORS: Record<number, string> = {
  1: "#dc2626",
  2: "#ea580c",
  3: "#0891b2",
  4: "#64748b",
};
