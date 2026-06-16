"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Check, RotateCcw, Link2 } from "lucide-react";
import TaskForm from "./TaskForm";
import { TaskDTO, dueLabel, prettyDuration } from "@/lib/ui";
import { PRIORITY_COLORS } from "@/lib/types";

const PRIORITY_TEXT: Record<number, string> = {
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

export default function TasksClient({ tasks }: { tasks: TaskDTO[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TaskDTO | null>(null);

  async function afterChange() {
    await fetch("/api/plan", { method: "POST" });
    router.refresh();
  }

  async function toggleDone(t: TaskDTO) {
    await fetch(`/api/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: t.status === "done" ? "todo" : "done" }),
    });
    await afterChange();
  }

  async function remove(t: TaskDTO) {
    if (!confirm(`Delete “${t.title}”?`)) return;
    await fetch(`/api/tasks/${t.id}`, { method: "DELETE" });
    await afterChange();
  }

  const active = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b border-[var(--border)] bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Tasks</h1>
          <p className="text-xs text-gray-500">
            Give tasks a duration & deadline — the AI finds the time.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-strong)]"
        >
          <Plus size={16} /> New task
        </button>
      </header>

      <div className="mx-auto max-w-3xl p-6 space-y-2">
        {active.length === 0 && (
          <p className="text-sm text-gray-400 py-8 text-center">
            No active tasks. Add one to get it auto-scheduled.
          </p>
        )}
        {active.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            onEdit={() => {
              setEditing(t);
              setFormOpen(true);
            }}
            onDelete={() => remove(t)}
            onToggle={() => toggleDone(t)}
          />
        ))}

        {done.length > 0 && (
          <>
            <h2 className="pt-6 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Completed
            </h2>
            {done.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onEdit={() => {
                  setEditing(t);
                  setFormOpen(true);
                }}
                onDelete={() => remove(t)}
                onToggle={() => toggleDone(t)}
              />
            ))}
          </>
        )}
      </div>

      {formOpen && (
        <TaskForm
          key={editing?.id ?? "new"}
          open={formOpen}
          initial={editing}
          allTasks={tasks}
          onClose={() => setFormOpen(false)}
          onSaved={afterChange}
        />
      )}
    </div>
  );
}

function TaskRow({
  task,
  onEdit,
  onDelete,
  onToggle,
}: {
  task: TaskDTO;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const done = task.status === "done";
  return (
    <div
      className={`group flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3 ${
        done ? "opacity-60" : ""
      }`}
    >
      <button
        onClick={onToggle}
        title={done ? "Mark as not done" : "Mark done"}
        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
          done
            ? "bg-emerald-500 border-emerald-500 text-white"
            : "border-gray-300 hover:border-[var(--primary)]"
        }`}
      >
        {done ? <Check size={13} /> : <RotateCcw size={11} className="opacity-0" />}
      </button>

      <span
        className="h-8 w-1 rounded-full shrink-0"
        style={{ background: PRIORITY_COLORS[task.priority] }}
      />

      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium truncate ${done ? "line-through" : ""}`}>
          {task.title}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
          <span
            className="font-medium"
            style={{ color: PRIORITY_COLORS[task.priority] }}
          >
            {PRIORITY_TEXT[task.priority]}
          </span>
          <span>·</span>
          <span>{prettyDuration(task.durationMin)}</span>
          <span>·</span>
          <span>{dueLabel(task.due)}</span>
          {task.dependsOnIds.length > 0 && (
            <span className="flex items-center gap-0.5 text-gray-400">
              · <Link2 size={11} /> after {task.dependsOnIds.length}
            </span>
          )}
          {task.status === "scheduled" && (
            <span className="text-emerald-600">· scheduled</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
