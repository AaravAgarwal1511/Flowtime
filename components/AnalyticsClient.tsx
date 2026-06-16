"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Clock, CalendarClock, Users, ListChecks } from "lucide-react";
import { TYPE_COLORS } from "@/lib/types";
import { TYPE_LABELS } from "@/lib/ui";

interface DonutSlice {
  name: string;
  value: number;
  color: string;
}
interface WeeklyRow {
  day: string;
  [k: string]: number | string;
}

interface Props {
  donut: DonutSlice[];
  weekly: WeeklyRow[];
  taskHours: number;
  meetingHours: number;
  commitmentHours: number;
  totalHours: number;
}

const STACK = ["MEETING", "COMMITMENT", "TASK_BLOCK", "HABIT_BLOCK"] as const;

export default function AnalyticsClient({
  donut,
  weekly,
  taskHours,
  meetingHours,
  commitmentHours,
  totalHours,
}: Props) {
  const hasData = donut.some((d) => d.value > 0);

  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b border-[var(--border)] bg-white px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Analytics</h1>
        <p className="text-xs text-gray-500">
          How your time is distributed this week.
        </p>
      </header>

      <div className="mx-auto max-w-5xl p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat
            icon={<Clock size={16} />}
            label="Scheduled"
            value={`${totalHours}h`}
            hint="this week"
          />
          <Stat
            icon={<ListChecks size={16} />}
            label="On tasks"
            value={`${taskHours}h`}
            hint="this week"
            accent="#3b82f6"
          />
          <Stat
            icon={<Users size={16} />}
            label="In meetings"
            value={`${meetingHours}h`}
            hint="this week"
          />
          <Stat
            icon={<CalendarClock size={16} />}
            label="Commitments"
            value={`${commitmentHours}h`}
            hint="this week"
          />
        </div>

        {!hasData ? (
          <div className="rounded-xl border border-[var(--border)] bg-white p-12 text-center text-sm text-gray-400">
            No scheduled time this week yet. Hit “Plan my day” on the Planner.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Donut */}
            <div className="rounded-xl border border-[var(--border)] bg-white p-5">
              <h2 className="mb-2 text-sm font-semibold">Time distribution</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donut}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={65}
                      outerRadius={100}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {donut.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => [`${v}h`, ""]}
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend
                      iconType="circle"
                      formatter={(v) => (
                        <span className="text-xs text-gray-600">{v}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Weekly stacked bars */}
            <div className="rounded-xl border border-[var(--border)] bg-white p-5">
              <h2 className="mb-2 text-sm font-semibold">Hours by day</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekly} barCategoryGap="25%">
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#eef0f5"
                    />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                      axisLine={false}
                      tickLine={false}
                      unit="h"
                    />
                    <Tooltip
                      formatter={(v, n) => [
                        `${v}h`,
                        TYPE_LABELS[n as keyof typeof TYPE_LABELS] ?? String(n),
                      ]}
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    />
                    {STACK.map((t) => (
                      <Bar
                        key={t}
                        dataKey={t}
                        stackId="a"
                        fill={TYPE_COLORS[t]}
                        isAnimationActive={false}
                        radius={t === "HABIT_BLOCK" ? [3, 3, 0, 0] : undefined}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  accent = "#1e2230",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold" style={{ color: accent }}>
        {value}
      </div>
      <div className="text-xs text-gray-400">{hint}</div>
    </div>
  );
}
