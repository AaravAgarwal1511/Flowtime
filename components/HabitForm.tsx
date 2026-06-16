"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { X } from "lucide-react";
import { HabitDTO } from "@/lib/ui";

interface Props {
  open: boolean;
  initial: HabitDTO | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

function minToTime(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
    min % 60,
  ).padStart(2, "0")}`;
}
function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

const COLORS = ["#10b981", "#f59e0b", "#0ea5e9", "#8b5cf6", "#ef4444", "#14b8a6"];

export default function HabitForm({ open, initial, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [durationMin, setDurationMin] = useState(initial?.durationMin ?? 30);
  const [frequency, setFrequency] = useState(initial?.frequency ?? "DAILY");
  const [perWeek, setPerWeek] = useState(initial?.perWeek ?? 3);
  const [start, setStart] = useState(minToTime(initial?.idealWindowStartMin ?? 540));
  const [end, setEnd] = useState(minToTime(initial?.idealWindowEndMin ?? 1020));
  const [kind, setKind] = useState(initial?.kind ?? "SOLO");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    const payload = {
      title,
      durationMin,
      frequency,
      perWeek,
      idealWindowStartMin: timeToMin(start),
      idealWindowEndMin: timeToMin(end),
      kind,
      color,
      active: initial?.active ?? true,
    };
    try {
      if (initial) {
        await fetch(`/api/habits/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/habits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      await onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[440px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-xl focus:outline-none">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold">
              {initial ? "Edit habit" : "New habit"}
            </Dialog.Title>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={save} className="space-y-3.5">
            <div>
              <Label>Title</Label>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Gym, Lunch, Review Emails"
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Duration (min)</Label>
                <input
                  type="number"
                  min={15}
                  step={15}
                  value={durationMin}
                  onChange={(e) => setDurationMin(Number(e.target.value))}
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
              </div>
              <div>
                <Label>Frequency</Label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] bg-white"
                >
                  <option value="DAILY">Every day</option>
                  <option value="WEEKDAYS">Weekdays</option>
                  <option value="N_PER_WEEK">Times per week</option>
                </select>
              </div>
            </div>

            {frequency === "N_PER_WEEK" && (
              <div>
                <Label>Times per week</Label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={perWeek}
                  onChange={(e) => setPerWeek(Number(e.target.value))}
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
              </div>
            )}

            <div>
              <Label>Ideal time window</Label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
                <span className="text-gray-400 text-sm">to</span>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <div className="flex rounded-lg border border-[var(--border)] p-0.5">
                  {(["SOLO", "TEAM"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={`flex-1 rounded-md py-1.5 text-sm font-medium ${
                        kind === k
                          ? "bg-[var(--primary)] text-white"
                          : "text-gray-600"
                      }`}
                    >
                      {k === "SOLO" ? "Solo" : "Team"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Color</Label>
                <div className="flex items-center gap-1.5 pt-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      style={{ background: c }}
                      className={`h-6 w-6 rounded-full ${
                        color === c ? "ring-2 ring-offset-2 ring-gray-400" : ""
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy || !title.trim()}
              className="w-full rounded-lg bg-[var(--primary)] py-2.5 text-sm font-medium text-white hover:bg-[var(--primary-strong)] disabled:opacity-60"
            >
              {busy ? "Saving…" : initial ? "Save changes" : "Add habit"}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-medium text-gray-500">
      {children}
    </label>
  );
}
