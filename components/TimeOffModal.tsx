"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { X, Plane, Trash2, Plus } from "lucide-react";
import { TimeOffDTO, timeOffRangeLabel, toDateInputValue } from "@/lib/ui";

interface Props {
  open: boolean;
  ranges: TimeOffDTO[];
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}

export default function TimeOffModal({
  open,
  ranges,
  onClose,
  onChanged,
}: Props) {
  const today = toDateInputValue(new Date());
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/timeoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start, end, label: label || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not add time off");
        return;
      }
      setLabel("");
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/timeoff/${id}`, { method: "DELETE" });
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
              <Plane size={17} className="text-[var(--primary)]" /> Time off
            </Dialog.Title>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
              <X size={18} />
            </button>
          </div>
          <p className="mb-4 text-xs text-gray-500">
            While you&apos;re away, the AI won&apos;t schedule focus time, habits,
            or tasks. Fixed events (meetings and recurring commitments) are left
            untouched.
          </p>

          <form onSubmit={add} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>From</Label>
                <input
                  type="date"
                  value={start}
                  max={end}
                  onChange={(e) => {
                    setStart(e.target.value);
                    if (e.target.value > end) setEnd(e.target.value);
                  }}
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
              </div>
              <div>
                <Label>To</Label>
                <input
                  type="date"
                  value={end}
                  min={start}
                  onChange={(e) => setEnd(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>
            <div>
              <Label>Label (optional)</Label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Conference, Vacation"
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] py-2.5 text-sm font-medium text-white hover:bg-[var(--primary-strong)] disabled:opacity-60"
            >
              <Plus size={15} /> Add time off
            </button>
          </form>

          {ranges.length > 0 && (
            <div className="mt-5">
              <Label>Scheduled time off</Label>
              <ul className="mt-1 space-y-1.5">
                {ranges.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {timeOffRangeLabel(r.start, r.end)}
                      </div>
                      {r.label && (
                        <div className="text-xs text-gray-500 truncate">
                          {r.label}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => remove(r.id)}
                      disabled={busy}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
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
