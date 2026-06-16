"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarDays,
  ListTodo,
  Repeat,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from "lucide-react";

const NAV = [
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/habits", label: "Habits", icon: Repeat },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-60"
      } shrink-0 border-r border-[var(--border)] bg-white flex flex-col transition-all duration-200`}
    >
      <div className="h-16 flex items-center gap-2 px-4 border-b border-[var(--border)]">
        <div className="h-8 w-8 rounded-lg bg-[var(--primary)] flex items-center justify-center text-white shrink-0">
          <Sparkles size={18} />
        </div>
        {!collapsed && (
          <span className="font-semibold text-[15px] tracking-tight">
            Flow<span className="text-[var(--primary)]">time</span>
          </span>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-[var(--primary)]/10 text-[var(--primary-strong)]"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Icon size={19} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed((c) => !c)}
        className="m-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
        title={collapsed ? "Expand" : "Collapse"}
      >
        {collapsed ? (
          <PanelLeftOpen size={19} />
        ) : (
          <>
            <PanelLeftClose size={19} />
            <span>Collapse</span>
          </>
        )}
      </button>
    </aside>
  );
}
