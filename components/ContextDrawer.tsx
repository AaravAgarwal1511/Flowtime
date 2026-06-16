"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Lock, Unlock, Trash2, RefreshCw, X, PauseCircle } from "lucide-react";
import { CalEventDTO, TYPE_LABELS, prettyDuration } from "@/lib/ui";

interface Props {
  event: CalEventDTO | null;
  onClose: () => void;
  onLockToggle: (e: CalEventDTO) => void;
  onToggleBuffer: (e: CalEventDTO) => void; // toggle buffer around this meeting
  onDeleteEvent: (e: CalEventDTO) => void; // delete this calendar record
  onDeleteTask: (taskId: string) => void; // delete the source task (+ its blocks)
  onDeleteHabit: (habitId: string) => void; // delete the source habit
  onPauseHabit: (habitId: string) => void; // stop scheduling the habit, keep it
  onDeleteSeries: (seriesId: string) => void; // delete the recurring series
  onPauseSeries: (seriesId: string) => void; // pause the recurring series
  onDeleteOccurrence: (e: CalEventDTO) => void; // delete just this one occurrence
  onReschedule: () => void;
}

export default function ContextDrawer({
  event,
  onClose,
  onLockToggle,
  onToggleBuffer,
  onDeleteEvent,
  onDeleteTask,
  onDeleteHabit,
  onPauseHabit,
  onDeleteSeries,
  onPauseSeries,
  onDeleteOccurrence,
  onReschedule,
}: Props) {
  const open = !!event;
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/20" />
        <Dialog.Content
          className="fixed right-0 top-0 z-50 h-full w-[360px] max-w-[90vw] bg-white border-l border-[var(--border)] shadow-xl p-5 flex flex-col gap-4 focus:outline-none"
          aria-describedby={undefined}
        >
          {event && (
            <>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: event.color }}
                  />
                  <Dialog.Title className="font-semibold text-[15px]">
                    {event.title}
                  </Dialog.Title>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <Badge>{TYPE_LABELS[event.type]}</Badge>
                <Badge>
                  {event.state === "FREE" ? "Free · flexible" : "Busy · defended"}
                </Badge>
                {event.locked && <Badge>Locked</Badge>}
              </div>

              <dl className="text-sm text-gray-600 space-y-2">
                <Row label="Start">
                  {new Date(event.start).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Row>
                <Row label="Duration">
                  {prettyDuration(
                    Math.round(
                      (new Date(event.end).getTime() -
                        new Date(event.start).getTime()) /
                        60000,
                    ),
                  )}
                </Row>
                <Row label="Type">
                  {event.flexible ? "AI-scheduled (flexible)" : "Fixed event"}
                </Row>
              </dl>

              <p className="text-xs text-gray-500 leading-relaxed bg-gray-50 rounded-lg p-3">
                {explainBlock(event)}
              </p>

              {/* Buffer checkbox — only for fixed meetings (buffers only apply to MEETINGs) */}
              {event.type === "MEETING" && !event.flexible && (
                <label className="flex items-start gap-2.5 rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={!event.noBuffer}
                    onChange={() => onToggleBuffer(event)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)] cursor-pointer"
                  />
                  <span>
                    <span className="font-medium block">Add buffer around this meeting</span>
                    <span className="text-xs text-gray-400">
                      Pads the meeting so nothing is scheduled back-to-back against it.
                    </span>
                  </span>
                </label>
              )}

              <div className="mt-auto space-y-2">
                {event.flexible && event.type !== "BUFFER" && (
                  <button
                    onClick={() => onLockToggle(event)}
                    className="w-full flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] py-2 text-sm font-medium hover:bg-gray-50"
                  >
                    {event.locked ? (
                      <>
                        <Unlock size={15} /> Unlock block
                      </>
                    ) : (
                      <>
                        <Lock size={15} /> Lock block
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={onReschedule}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] text-white py-2 text-sm font-medium hover:bg-[var(--primary-strong)]"
                >
                  <RefreshCw size={15} /> Reschedule day
                </button>

                {/* Source-aware removal so generated blocks don't just reappear */}
                {event.type === "TASK_BLOCK" && event.sourceTaskId ? (
                  <DangerButton
                    icon={<Trash2 size={15} />}
                    label="Delete task"
                    onClick={() => onDeleteTask(event.sourceTaskId!)}
                  />
                ) : event.type === "HABIT_BLOCK" && event.sourceHabitId ? (
                  <>
                    <button
                      onClick={() => onPauseHabit(event.sourceHabitId!)}
                      className="w-full flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      <PauseCircle size={15} /> Pause habit
                    </button>
                    <DangerButton
                      icon={<Trash2 size={15} />}
                      label="Delete habit"
                      onClick={() => onDeleteHabit(event.sourceHabitId!)}
                    />
                  </>
                ) : event.type === "COMMITMENT" && event.sourceSeriesId ? (
                  <>
                    <DangerButton
                      icon={<Trash2 size={15} />}
                      label="Delete this occurrence"
                      onClick={() => onDeleteOccurrence(event)}
                    />
                    <button
                      onClick={() => onPauseSeries(event.sourceSeriesId!)}
                      className="w-full flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      <PauseCircle size={15} /> Pause series
                    </button>
                    <DangerButton
                      icon={<Trash2 size={15} />}
                      label="Delete series"
                      onClick={() => onDeleteSeries(event.sourceSeriesId!)}
                    />
                  </>
                ) : !event.flexible ? (
                  <DangerButton
                    icon={<Trash2 size={15} />}
                    label="Delete event"
                    onClick={() => onDeleteEvent(event)}
                  />
                ) : (
                  <DangerButton
                    icon={<Trash2 size={15} />}
                    label="Remove block"
                    onClick={() => onDeleteEvent(event)}
                  />
                )}
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function explainBlock(e: CalEventDTO): string {
  switch (e.type) {
    case "TASK_BLOCK":
      return "A scheduled work block for this task. Removing just the block won't help — the AI re-adds it on the next plan. Delete the task to remove it for good.";
    case "HABIT_BLOCK":
      return "A scheduled occurrence of this habit. It will be re-added on the next plan. Pause the habit to stop scheduling it (keeps the habit), or delete it entirely.";
    case "FOCUS":
      return "Auto-generated focus time. It will be re-added on the next plan unless you lock it, lower your weekly focus goal, or add time off.";
    case "BUFFER":
      return "An automatic buffer around a meeting. It's recreated whenever the day is re-planned.";
    case "COMMITMENT":
      return "One occurrence of a recurring commitment. Drag it to move just this occurrence, or use the buttons below to delete just today's occurrence or manage the whole series.";
    default:
      return "A fixed event. It won't be moved by the AI; deleting it removes it permanently.";
  }
}

function DangerButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 rounded-lg border border-red-200 text-red-600 py-2 text-sm font-medium hover:bg-red-50"
    >
      {icon} {label}
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 font-medium">
      {children}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-400">{label}</dt>
      <dd className="text-right font-medium text-gray-700">{children}</dd>
    </div>
  );
}
