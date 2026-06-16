"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { Sparkles, Loader2, X } from "lucide-react";
import { TaskDTO } from "@/lib/ui";

interface Props {
  open: boolean;
  initial: TaskDTO | null;
  allTasks: TaskDTO[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default function TaskForm({
  open,
  initial,
  allTasks,
  onClose,
  onSaved,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [durationMin, setDurationMin] = useState(initial?.durationMin ?? 60);
  const [priority, setPriority] = useState(initial?.priority ?? 3);
  const [due, setDue] = useState(isoToDateInput(initial?.due ?? null));
  const [minChunkMin, setMinChunkMin] = useState(initial?.minChunkMin ?? 30);
  const [maxChunkMin, setMaxChunkMin] = useState(initial?.maxChunkMin ?? 120);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [dependsOnIds, setDependsOnIds] = useState<string[]>(
    initial?.dependsOnIds ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Candidate prerequisites: any other task that isn't done (and not self).
  const candidates = allTasks.filter(
    (t) => t.id !== initial?.id && t.status !== "done",
  );

  function toggleDep(id: string) {
    setDependsOnIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function suggest() {
    if (!title.trim()) return;
    setSuggesting(true);
    try {
      const res = await fetch("/api/llm/prioritize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (data.priority) setPriority(data.priority);
      if (data.durationMin) setDurationMin(data.durationMin);
    } finally {
      setSuggesting(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    const payload = {
      title,
      durationMin,
      priority,
      minChunkMin,
      maxChunkMin: Math.max(maxChunkMin, minChunkMin),
      notes: notes || null,
      due: due ? new Date(`${due}T17:00:00`).toISOString() : null,
      dependsOnIds,
    };
    try {
      const res = initial
        ? await fetch(`/api/tasks/${initial.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Could not save");
        return;
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
              {initial ? "Edit task" : "New task"}
            </Dialog.Title>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={save} className="space-y-3.5">
            <div>
              <Label>Title</Label>
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What needs doing?"
                  className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
                <button
                  type="button"
                  onClick={suggest}
                  disabled={!title.trim() || suggesting}
                  title="Suggest priority & duration"
                  className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 text-xs font-medium text-[var(--primary-strong)] hover:bg-[var(--primary)]/5 disabled:opacity-50"
                >
                  {suggesting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  Suggest
                </button>
              </div>
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
                <Label>Priority</Label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] bg-white"
                >
                  <option value={1}>P1 — Urgent</option>
                  <option value={2}>P2 — High</option>
                  <option value={3}>P3 — Medium</option>
                  <option value={4}>P4 — Low</option>
                </select>
              </div>
            </div>

            <div>
              <Label>Deadline</Label>
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Min chunk (min)</Label>
                <input
                  type="number"
                  min={15}
                  step={15}
                  value={minChunkMin}
                  onChange={(e) => setMinChunkMin(Number(e.target.value))}
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
              </div>
              <div>
                <Label>Max chunk (min)</Label>
                <input
                  type="number"
                  min={15}
                  step={15}
                  value={maxChunkMin}
                  onChange={(e) => setMaxChunkMin(Number(e.target.value))}
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <textarea
                value={notes ?? ""}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] resize-none"
              />
            </div>

            {candidates.length > 0 && (
              <div>
                <Label>Depends on (scheduled after these finish)</Label>
                <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
                  {candidates.map((t) => (
                    <label
                      key={t.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={dependsOnIds.includes(t.id)}
                        onChange={() => toggleDep(t.id)}
                        className="accent-[var(--primary)]"
                      />
                      <span className="truncate">{t.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={busy || !title.trim()}
              className="w-full rounded-lg bg-[var(--primary)] py-2.5 text-sm font-medium text-white hover:bg-[var(--primary-strong)] disabled:opacity-60"
            >
              {busy ? "Saving…" : initial ? "Save changes" : "Add task"}
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
