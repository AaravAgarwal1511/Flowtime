"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, Save, RotateCcw, Check } from "lucide-react";

interface SettingsShape {
  workdayStartMin: number;
  workdayEndMin: number;
  workdays: string;
  defaultBufferMin: number;
  lockHorizonHours: number;
  planHorizonDays: number;
  minTaskDurationForBuffer: number;
  minGapBetweenTaskChunks: number;
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

function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function parseDays(csv: string): Set<number> {
  return new Set(
    csv
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => n >= 1 && n <= 7),
  );
}

export default function SettingsClient({
  settings,
}: {
  settings: SettingsShape;
}) {
  const router = useRouter();
  const [start, setStart] = useState(minToTime(settings.workdayStartMin));
  const [end, setEnd] = useState(minToTime(settings.workdayEndMin));
  const [days, setDays] = useState<Set<number>>(parseDays(settings.workdays));
  const [buffer, setBuffer] = useState(settings.defaultBufferMin);
  const [lockHorizon, setLockHorizon] = useState(settings.lockHorizonHours);
  const [planHorizon, setPlanHorizon] = useState(settings.planHorizonDays);
  const [taskBufferThreshold, setTaskBufferThreshold] = useState(
    settings.minTaskDurationForBuffer,
  );
  const [chunkGap, setChunkGap] = useState(settings.minGapBetweenTaskChunks);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const current = useMemo(
    () => ({
      workdayStartMin: timeToMin(start),
      workdayEndMin: timeToMin(end),
      workdays: [...days].sort((a, b) => a - b).join(","),
      defaultBufferMin: buffer,
      lockHorizonHours: lockHorizon,
      planHorizonDays: planHorizon,
      minTaskDurationForBuffer: taskBufferThreshold,
      minGapBetweenTaskChunks: chunkGap,
    }),
    [start, end, days, buffer, lockHorizon, planHorizon, taskBufferThreshold, chunkGap],
  );

  const dirty = useMemo(
    () =>
      current.workdayStartMin !== settings.workdayStartMin ||
      current.workdayEndMin !== settings.workdayEndMin ||
      current.workdays !== settings.workdays ||
      current.defaultBufferMin !== settings.defaultBufferMin ||
      current.lockHorizonHours !== settings.lockHorizonHours ||
      current.planHorizonDays !== settings.planHorizonDays ||
      current.minTaskDurationForBuffer !== settings.minTaskDurationForBuffer ||
      current.minGapBetweenTaskChunks !== settings.minGapBetweenTaskChunks,
    [current, settings],
  );

  function toggleDay(iso: number) {
    setSaved(false);
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }

  function reset() {
    setStart(minToTime(settings.workdayStartMin));
    setEnd(minToTime(settings.workdayEndMin));
    setDays(parseDays(settings.workdays));
    setBuffer(settings.defaultBufferMin);
    setLockHorizon(settings.lockHorizonHours);
    setPlanHorizon(settings.planHorizonDays);
    setTaskBufferThreshold(settings.minTaskDurationForBuffer);
    setChunkGap(settings.minGapBetweenTaskChunks);
    setError(null);
    setSaved(false);
  }

  async function save() {
    if (busy) return;
    setError(null);
    setSaved(false);
    if (days.size === 0) return setError("Pick at least one working day.");
    if (current.workdayEndMin <= current.workdayStartMin)
      return setError("Workday end must be after the start.");

    setBusy(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(current),
      });
      if (!res.ok) {
        setError(
          (await res.json().catch(() => ({}))).error ?? "Could not save settings",
        );
        return;
      }
      // Settings change scheduling windows — re-plan so the calendar reflects them.
      await fetch("/api/plan", { method: "POST" });
      setSaved(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b border-[var(--border)] bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-[var(--primary)]" />
            Settings
          </h1>
          <p className="text-xs text-gray-500">
            Tune the working hours and rules the scheduler plans around.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              onClick={reset}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
            >
              <RotateCcw size={15} /> Discard
            </button>
          )}
          <button
            onClick={save}
            disabled={busy || !dirty}
            className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-strong)] disabled:opacity-50"
          >
            {saved && !dirty ? <Check size={16} /> : <Save size={16} />}
            {saved && !dirty ? "Saved" : "Save changes"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl p-6 space-y-6">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Working hours */}
        <Section
          title="Working hours"
          desc="The daily window the AI is allowed to schedule tasks and habits inside."
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Day starts">
              <input
                type="time"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  setSaved(false);
                }}
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              />
            </Field>
            <Field label="Day ends">
              <input
                type="time"
                value={end}
                onChange={(e) => {
                  setEnd(e.target.value);
                  setSaved(false);
                }}
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              />
            </Field>
          </div>
        </Section>

        {/* Working days */}
        <Section
          title="Working days"
          desc="Days the scheduler treats as workdays. Other days stay free."
        >
          <div className="flex gap-1">
            {WEEKDAYS.map((d) => (
              <button
                key={d.iso}
                type="button"
                onClick={() => toggleDay(d.iso)}
                className={`flex-1 rounded-md py-2 text-xs font-medium ${
                  days.has(d.iso)
                    ? "bg-[var(--primary)] text-white"
                    : "border border-[var(--border)] text-gray-600 hover:bg-gray-50"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Buffer */}
        <Section
          title="Default buffer"
          desc="Padding added around meetings so you're never scheduled back-to-back."
        >
          <NumberField
            value={buffer}
            onChange={(v) => {
              setBuffer(v);
              setSaved(false);
            }}
            min={0}
            max={120}
            step={5}
            suffix="minutes"
          />
        </Section>

        {/* Long-task buffer threshold */}
        <Section
          title="Buffer after long tasks"
          desc="Any task block at least this long gets a buffer (above) added after it, so back-to-back deep work always has breathing room."
        >
          <NumberField
            value={taskBufferThreshold}
            onChange={(v) => {
              setTaskBufferThreshold(v);
              setSaved(false);
            }}
            min={15}
            max={480}
            step={15}
            suffix="minutes or longer"
          />
        </Section>

        {/* Gap between chunks of the same task */}
        <Section
          title="Gap between task chunks"
          desc="When one task is split across several blocks, keep at least this much time between them instead of scheduling them back-to-back. Set to 0 to allow consecutive chunks."
        >
          <NumberField
            value={chunkGap}
            onChange={(v) => {
              setChunkGap(v);
              setSaved(false);
            }}
            min={0}
            max={240}
            step={5}
            suffix="minutes"
          />
        </Section>

        {/* Lock horizon */}
        <Section
          title="Lock horizon"
          desc="Flexible blocks starting within this window are locked (Free → Busy) so they stop moving as the day approaches."
        >
          <NumberField
            value={lockHorizon}
            onChange={(v) => {
              setLockHorizon(v);
              setSaved(false);
            }}
            min={0}
            max={168}
            step={1}
            suffix="hours ahead"
          />
        </Section>

        {/* Plan horizon */}
        <Section
          title="Planning horizon"
          desc="How many days into the future the AI plans your schedule each run."
        >
          <NumberField
            value={planHorizon}
            onChange={(v) => {
              setPlanHorizon(v);
              setSaved(false);
            }}
            min={1}
            max={30}
            step={1}
            suffix="days"
          />
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mb-3 mt-0.5 text-xs text-gray-500">{desc}</p>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function NumberField({
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isNaN(n)) return;
          onChange(Math.min(max, Math.max(min, n)));
        }}
        className="w-28 rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
      />
      <span className="text-sm text-gray-500">{suffix}</span>
    </div>
  );
}
