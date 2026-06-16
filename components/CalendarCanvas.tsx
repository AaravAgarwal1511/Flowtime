"use client";

import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  EventClickArg,
  EventContentArg,
  EventDropArg,
} from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { Lock } from "lucide-react";
import { CalEventDTO, TimeOffDTO } from "@/lib/ui";

interface WorkHours {
  startMin: number;
  endMin: number;
  workdays: number[];
}

interface Props {
  events: CalEventDTO[];
  timeOff?: TimeOffDTO[];
  workHours: WorkHours;
  onEventClick: (id: string) => void;
  onEventChange: (id: string, start: Date, end: Date) => void;
  onSelectRange: (start: Date, end: Date) => void;
}

function minToTimeStr(min: number): string {
  const clamped = Math.max(0, Math.min(1440, min));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

export default function CalendarCanvas({
  events,
  timeOff = [],
  workHours,
  onEventClick,
  onEventChange,
  onSelectRange,
}: Props) {
  // Visible range: the work window padded by an hour, but always widened to
  // include any events scheduled outside it (e.g. an evening habit) so nothing
  // gets clipped off the grid.
  let minMin = Math.max(0, workHours.startMin - 60);
  let maxMin = Math.min(1440, workHours.endMin + 60);
  for (const e of events) {
    const s = new Date(e.start);
    const en = new Date(e.end);
    minMin = Math.min(minMin, s.getHours() * 60 + s.getMinutes());
    const endOfDay = en.getHours() * 60 + en.getMinutes();
    maxMin = Math.max(maxMin, endOfDay === 0 ? 1440 : endOfDay);
  }
  // Snap outward to whole hours for clean slot labels.
  const slotMinTime = minToTimeStr(Math.floor(minMin / 60) * 60);
  const slotMaxTime = minToTimeStr(Math.ceil(maxMin / 60) * 60);
  const fcEvents = events.map((e) => {
    const free = e.state === "FREE";
    return {
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      editable: e.type !== "BUFFER",
      backgroundColor: free ? "transparent" : e.color,
      borderColor: free ? "transparent" : e.color,
      textColor: free ? e.color : "#ffffff",
      classNames: [free ? "evt-free" : "evt-busy"],
      extendedProps: { ...e },
    };
  });

  const bgEvents = timeOff.map((r) => ({
    start: r.start,
    end: r.end,
    display: "background" as const,
    backgroundColor: "rgba(100, 116, 139, 0.14)",
    classNames: ["evt-timeoff"],
    title: r.label ?? "Time off",
  }));

  return (
    <FullCalendar
      plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
      initialView="timeGridWeek"
      headerToolbar={{
        left: "prev,next today",
        center: "title",
        right: "timeGridDay,timeGridWeek",
      }}
      nowIndicator
      editable
      selectable
      selectMirror
      droppable={false}
      slotDuration="00:15:00"
      slotLabelInterval="01:00"
      scrollTime={minToTimeStr(workHours.startMin)}
      slotMinTime={slotMinTime}
      slotMaxTime={slotMaxTime}
      expandRows
      height="100%"
      allDaySlot={false}
      firstDay={1}
      businessHours={{
        daysOfWeek: workHours.workdays,
        startTime: minToTimeStr(workHours.startMin).slice(0, 5),
        endTime: minToTimeStr(workHours.endMin).slice(0, 5),
      }}
      dayMaxEvents
      events={[...fcEvents, ...bgEvents]}
      eventClick={(arg: EventClickArg) => {
        if (arg.event.id) onEventClick(arg.event.id);
      }}
      eventDrop={(arg: EventDropArg) => {
        if (arg.event.start && arg.event.end)
          onEventChange(arg.event.id, arg.event.start, arg.event.end);
      }}
      eventResize={(arg: EventResizeDoneArg) => {
        if (arg.event.start && arg.event.end)
          onEventChange(arg.event.id, arg.event.start, arg.event.end);
      }}
      select={(arg) => onSelectRange(arg.start, arg.end)}
      eventContent={renderEvent}
    />
  );
}

function renderEvent(arg: EventContentArg) {
  const locked = arg.event.extendedProps.locked as boolean;
  return (
    <div className="evt-content">
      {locked && <Lock size={11} className="shrink-0 opacity-70" />}
      <span className="evt-title">{arg.event.title}</span>
      {arg.timeText && (
        <span className="opacity-70 text-[10px] hidden sm:inline">
          {arg.timeText}
        </span>
      )}
    </div>
  );
}
