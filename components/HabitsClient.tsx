"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Users, User } from "lucide-react";
import HabitForm from "./HabitForm";
import {
  HabitDTO,
  FREQUENCY_LABELS,
  minutesToLabel,
  prettyDuration,
} from "@/lib/ui";

export default function HabitsClient({ habits }: { habits: HabitDTO[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HabitDTO | null>(null);

  async function afterChange() {
    await fetch("/api/plan", { method: "POST" });
    router.refresh();
  }

  async function toggleActive(h: HabitDTO) {
    await fetch(`/api/habits/${h.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !h.active }),
    });
    await afterChange();
  }

  async function remove(h: HabitDTO) {
    if (!confirm(`Delete habit “${h.title}”?`)) return;
    await fetch(`/api/habits/${h.id}`, { method: "DELETE" });
    await afterChange();
  }

  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b border-[var(--border)] bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Habits</h1>
          <p className="text-xs text-gray-500">
            Recurring routines the AI fits into your ideal window every day.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-strong)]"
        >
          <Plus size={16} /> New habit
        </button>
      </header>

      <div className="mx-auto max-w-3xl p-6 grid gap-3 sm:grid-cols-2">
        {habits.length === 0 && (
          <p className="text-sm text-gray-400 py-8 text-center col-span-full">
            No habits yet. Add routines like Lunch, Gym, or Standup.
          </p>
        )}
        {habits.map((h) => (
          <div
            key={h.id}
            className={`group rounded-xl border border-[var(--border)] bg-white p-4 ${
              h.active ? "" : "opacity-55"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ background: h.color }}
                />
                <span className="font-medium text-sm truncate">{h.title}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setEditing(h);
                    setFormOpen(true);
                  }}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => remove(h)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="mt-2 space-y-1 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                {h.kind === "TEAM" ? <Users size={13} /> : <User size={13} />}
                <span>{h.kind === "TEAM" ? "Team" : "Solo"}</span>
                <span>·</span>
                <span>{prettyDuration(h.durationMin)}</span>
              </div>
              <div>
                {FREQUENCY_LABELS[h.frequency]}
                {h.frequency === "N_PER_WEEK" ? ` (${h.perWeek}×)` : ""}
              </div>
              <div>
                {minutesToLabel(h.idealWindowStartMin)} –{" "}
                {minutesToLabel(h.idealWindowEndMin)}
              </div>
            </div>

            <button
              onClick={() => toggleActive(h)}
              className="mt-3 text-xs font-medium text-[var(--primary-strong)] hover:underline"
            >
              {h.active ? "Pause" : "Resume"}
            </button>
          </div>
        ))}
      </div>

      {formOpen && (
        <HabitForm
          key={editing?.id ?? "new"}
          open={formOpen}
          initial={editing}
          onClose={() => setFormOpen(false)}
          onSaved={afterChange}
        />
      )}
    </div>
  );
}
