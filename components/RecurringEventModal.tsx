"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { X, Plus, CalendarClock, Trash2, PauseCircle, PlayCircle } from "lucide-react";
import {
  RecurringEventDTO,
  daysLabel,
  minutesToLabel,
} from "@/lib/ui";

interface Props {
  open: boolean;
  series: RecurringEventDTO[];
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}

const WEEKDAYS = [
  { iso: 1, label: "Mon" },
  { iso: 2, label: "Tue" },
  { iso: 3, label: "Wed" },
  { iso: 4, label: "Thu" },
  { iso: 5, label: "Fri" },
  { iso: 6, label: "Sat" },
  { iso: 7, label: "Sun" },
];
const COLORS = ["#0e7490", "#475569", "#b45309", "#7c3aed", "#be123c", "#15803d"];

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default function RecurringEventModal({
  open,
  series,
  onClose,
  onChanged,
}: Props) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("15:00");
  const [days, setDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDay(iso: number) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!title.trim()) return setError("Add a title");
    if (days.size === 0) return setError("Pick at least one day");
    if (timeToMin(end) <= timeToMin(start))
      return setError("End time must be after start time");

    setBusy(true);
    try {
      const res = await fetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          startMin: timeToMin(start),
          endMin: timeToMin(end),
          days: [...days].sort((a, b) => a - b).join(","),
          color,
        }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Could not add");
        return;
      }
      setTitle("");
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/recurring/${id}`, { method: "DELETE" });
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(s: RecurringEventDTO) {
    setBusy(true);
    try {
      await fetch(`/api/recurring/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !s.active }),
      });
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[460px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-xl focus:outline-none">
          <div className="mb-1 flex items-center justify-between">
            <Dialog.Title className="flex items-center gap-2 text-base font-semibold">
              <CalendarClock size={17} className="text-[var(--primary)]" /> Recurring
              event
            </Dialog.Title>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
              <X size={18} />
            </button>
          </div>
          <p className="mb-4 text-xs text-gray-500">
            A fixed commitment (e.g. School) the AI never moves and schedules
            everything else around.
          </p>

          <form onSubmit={add} className="space-y-3">
            <div>
              <Label>Title</Label>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. School"
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>From</Label>
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
              </div>
              <div>
                <Label>To</Label>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>

            <div>
              <Label>Repeats on</Label>
              <div className="flex gap-1">
                {WEEKDAYS.map((d) => (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => toggleDay(d.iso)}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium ${
                      days.has(d.iso)
                        ? "bg-[var(--primary)] text-white"
                        : "border border-[var(--border)] text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Color</Label>
              <div className="flex items-center gap-1.5 pt-0.5">
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

            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] py-2.5 text-sm font-medium text-white hover:bg-[var(--primary-strong)] disabled:opacity-60"
            >
              <Plus size={15} /> Add recurring event
            </button>
          </form>

          {series.length > 0 && (
            <div className="mt-5">
              <Label>Your commitments</Label>
              <ul className="mt-1 space-y-1.5">
                {series.map((s) => (
                  <li
                    key={s.id}
                    className={`flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 ${
                      s.active ? "" : "opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ background: s.color }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">
                            {s.title}
                          </span>
                          {!s.active && (
                            <span className="rounded-full bg-gray-100 px-1.5 text-[10px] font-semibold text-gray-500">
                              Paused
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {daysLabel(s.days)} · {minutesToLabel(s.startMin)}–
                          {minutesToLabel(s.endMin)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleActive(s)}
                        disabled={busy}
                        title={s.active ? "Pause" : "Resume"}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        {s.active ? <PauseCircle size={15} /> : <PlayCircle size={15} />}
                      </button>
                      <button
                        onClick={() => remove(s.id)}
                        disabled={busy}
                        title="Delete"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
