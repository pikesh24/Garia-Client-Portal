"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BlockedDate,
  Meeting,
  MeetingBlock,
  MeetingStatus,
  MeetingType,
  RecurrenceFrequency,
  RecurringMeetingBlockCreatePayload,
} from "@/lib/types";
import { formatApiError } from "@/lib/api";
import { Alert, Button, Field, Input, Label, Modal, Select, StatusBadge, Textarea } from "@/components/ui";

/* ------------------------------------------------------------------ */
/* Date helpers                                                       */
/* ------------------------------------------------------------------ */

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type FetchBlockedDates = (rangeStart: Date, rangeEnd: Date) => Promise<BlockedDate[]>;

export const MEETING_LINK_PATTERN = /^https:\/\/(meet\.google\.com\/|teams\.microsoft\.com\/)/;

function generateMonthGrid(viewDate: Date): Date[] {
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const start = new Date(firstDay);
  start.setDate(start.getDate() - firstDay.getDay());
  const days: Date[] = [];
  const cur = new Date(start);
  for (let i = 0; i < 42; i++) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function generateWeekDays(viewDate: Date): Date[] {
  const start = new Date(viewDate);
  start.setDate(start.getDate() - start.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

// Meetings can only run between 9 AM and 9 PM, so the last selectable slot is 21:00
// itself (as an end time) — no 21:30+ starts, since those could never fit before 9 PM.
const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = 9; h < 21; h++) {
    for (const m of [0, 30]) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  slots.push("21:00");
  return slots;
})();

export interface TimeRange {
  start: Date;
  end: Date;
}

export function meetingDisplayRange(m: Meeting): TimeRange {
  if (m.confirmed_start_datetime && m.confirmed_end_datetime) {
    return { start: new Date(m.confirmed_start_datetime), end: new Date(m.confirmed_end_datetime) };
  }
  return { start: new Date(m.pending_start_datetime), end: new Date(m.pending_end_datetime) };
}

function rangesOverlap(start: Date, end: Date, ranges: TimeRange[]): boolean {
  return ranges.some((r) => start < r.end && end > r.start);
}

export function formatTimeFn(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatTime(d: Date): string {
  return formatTimeFn(d);
}

function formatDateTime(d: Date): string {
  return `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}, ${formatTime(d)}`;
}

function formatTimeRange(start: Date, end: Date): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function slotLabel(slot: string): string {
  const [h, m] = slot.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return formatTime(d);
}

function slotToDate(date: Date, slot: string): Date {
  const [h, m] = slot.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

/* ------------------------------------------------------------------ */
/* Mini date/time picker — enforces a minimum selectable instant      */
/* ------------------------------------------------------------------ */

export function MiniCalendar({
  value,
  onChange,
  minDate,
  disabledDates,
}: {
  value: Date | null;
  onChange: (date: Date) => void;
  minDate: Date;
  disabledDates?: Set<string>;
}) {
  const [viewDate, setViewDate] = useState(value ?? new Date());
  const days = generateMonthGrid(viewDate);
  const monthName = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const minDay = startOfDay(minDate);

  return (
    <div className="border-2 border-border-strong bg-bg-panel-alt p-3">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
          className="px-2 py-1 font-data-mono text-data-mono text-text-main hover:text-brand-green"
        >
          &lt;
        </button>
        <span className="font-label-caps text-label-caps uppercase tracking-[0.1em] text-text-main">{monthName}</span>
        <button
          type="button"
          onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
          className="px-2 py-1 font-data-mono text-data-mono text-text-main hover:text-brand-green"
        >
          &gt;
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 text-center">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="font-data-mono text-[10px] uppercase text-text-muted">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, i) => {
          const inMonth = date.getMonth() === viewDate.getMonth();
          const blocked = disabledDates?.has(toDateKey(date));
          const disabled = !inMonth || startOfDay(date) < minDay || blocked;
          const selected = value && isSameDay(date, value);
          return (
            <button
              type="button"
              key={i}
              disabled={disabled}
              onClick={() => onChange(date)}
              title={blocked ? "Blocked" : undefined}
              className={`h-8 w-8 border font-data-mono text-xs transition-colors
                ${disabled ? "border-transparent text-text-muted opacity-40" : "border-transparent text-text-main hover:border-brand-green"}
                ${selected ? "bg-brand-green border-brand-green text-on-brand-green" : ""}`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TimeSlotPicker({
  date,
  value,
  onChange,
  minDateTime,
  busyRanges = [],
}: {
  date: Date | null;
  value: string;
  onChange: (time: string) => void;
  minDateTime: Date;
  busyRanges?: TimeRange[];
}) {
  if (!date) return null;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {TIME_SLOTS.map((slot) => {
        const candidate = slotToDate(date, slot);
        const candidateEnd = new Date(candidate.getTime() + 30 * 60 * 1000);
        const disabled = candidate < minDateTime || rangesOverlap(candidate, candidateEnd, busyRanges);
        const selected = value === slot;
        return (
          <button
            type="button"
            key={slot}
            disabled={disabled}
            onClick={() => onChange(slot)}
            title={disabled && !(candidate < minDateTime) ? "Unavailable — overlaps another appointment" : undefined}
            className={`border-2 px-2 py-2 font-data-mono text-sm font-bold tabular-nums transition-all
              ${disabled ? "border-border-subtle text-text-muted opacity-40 cursor-not-allowed" : "border-border-strong text-text-main hover:border-brand-green"}
              ${selected ? "bg-brand-green text-on-brand-green border-brand-green shadow-[3px_3px_0px_0px_var(--shadow-strong)]" : "bg-bg-panel-alt"}`}
          >
            {slotLabel(slot)}
          </button>
        );
      })}
    </div>
  );
}

function MeetingTypeToggle({
  value,
  onChange,
  allowOnline,
  allowOffline,
}: {
  value: MeetingType;
  onChange: (v: MeetingType) => void;
  allowOnline: boolean;
  allowOffline: boolean;
}) {
  const options: { key: MeetingType; label: string; allowed: boolean }[] = [
    { key: "online", label: "Online", allowed: allowOnline },
    { key: "offline", label: "Offline", allowed: allowOffline },
  ];
  return (
    <div className="inline-flex border-2 border-border-strong">
      {options.map((opt) => (
        <button
          type="button"
          key={opt.key}
          disabled={!opt.allowed}
          onClick={() => onChange(opt.key)}
          title={!opt.allowed ? "Not currently available" : undefined}
          className={`px-5 py-2 font-label-caps text-[11px] uppercase tracking-[0.1em] transition-all
            ${opt.allowed ? "" : "opacity-40 cursor-not-allowed"}
            ${value === opt.key && opt.allowed ? "bg-brand-green text-on-brand-green" : "bg-bg-panel-alt text-text-main hover:bg-bg-panel-alt/70"}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Start/End range picker — SINGLE unified grid                       */
/* ------------------------------------------------------------------ */

function TimeRangePicker({
  date,
  startSlot,
  endSlot,
  onStartChange,
  onEndChange,
  minDateTime,
  busyRanges,
}: {
  date: Date;
  startSlot: string;
  endSlot: string;
  onStartChange: (slot: string) => void;
  onEndChange: (slot: string) => void;
  minDateTime: Date;
  busyRanges: TimeRange[];
}) {
  function handleClick(slot: string) {
    if (!startSlot || (startSlot && endSlot)) {
      // No start yet, or both set → reset and pick new start
      onStartChange(slot);
      onEndChange("");
    } else {
      // Start is set, picking end
      const startDate = slotToDate(date, startSlot);
      const endDate = slotToDate(date, slot);
      if (endDate > startDate) {
        onEndChange(slot);
      } else {
        // Clicked before or same as start → treat as new start
        onStartChange(slot);
        onEndChange("");
      }
    }
  }

  return (
    <Field>
      <Label>
        {!startSlot ? "Select Start Time" : !endSlot ? "Now Select End Time" : "Time Range Selected"}
      </Label>
      <p className="mb-3 font-data-mono text-xs text-text-muted">
        Tap a slot to set the start time, then tap a later slot to set the end time.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-4 font-data-mono text-[11px] text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 border border-border-strong bg-coral-red" /> Start
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 border border-coral-red/40 bg-coral-red/15" /> In between
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 border border-border-strong bg-[#0d9488]" /> End
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {TIME_SLOTS.map((slot) => {
          const candidate = slotToDate(date, slot);
          const candidateEnd = new Date(candidate.getTime() + 30 * 60 * 1000);
          const disabled = candidate < minDateTime || rangesOverlap(candidate, candidateEnd, busyRanges);
          const isStart = startSlot === slot;
          const isEnd = endSlot === slot;
          const isInRange =
            startSlot &&
            endSlot &&
            slotToDate(date, slot) > slotToDate(date, startSlot) &&
            slotToDate(date, slot) < slotToDate(date, endSlot);

          let style = "bg-bg-panel-alt";
          if (isStart) style = "bg-coral-red text-white border-coral-red shadow-[3px_3px_0px_0px_var(--shadow-strong)]";
          else if (isEnd) style = "bg-[#0d9488] text-white border-[#0d9488] shadow-[3px_3px_0px_0px_var(--shadow-strong)]";
          else if (isInRange) style = "bg-coral-red/15 border-coral-red/40 text-coral-red";

          return (
            <button
              type="button"
              key={slot}
              disabled={disabled}
              onClick={() => handleClick(slot)}
              title={
                disabled && !(candidate < minDateTime)
                  ? "Unavailable — overlaps another appointment"
                  : isStart
                    ? "Start time"
                    : isEnd
                      ? "End time"
                      : undefined
              }
              className={`border-2 px-2 py-2 font-data-mono text-sm font-bold tabular-nums transition-all
                ${disabled ? "border-border-subtle text-text-muted opacity-40 cursor-not-allowed" : "border-border-strong text-text-main hover:border-brand-green"}
                ${style}`}
            >
              {slotLabel(slot)}
            </button>
          );
        })}
      </div>
      {startSlot && endSlot && (
        <p className="mt-3 font-data-mono text-sm text-text-main">
          <span className="text-coral-red font-bold">{slotLabel(startSlot)}</span>
          <span className="text-text-muted mx-2">→</span>
          <span className="text-[#0d9488] font-bold">{slotLabel(endSlot)}</span>
        </p>
      )}
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar grid (month / week / day) + details modal                 */
/* ------------------------------------------------------------------ */

export interface MeetingActions {
  onCancel?: (m: Meeting) => Promise<void> | void;
  onConfirm?: (m: Meeting, meetingLink: string, meetingCode: string) => Promise<void> | void;
  onDeny?: (m: Meeting, reason: string) => Promise<void> | void;
  onProposeReschedule?: (m: Meeting, start: Date, end: Date) => Promise<void> | void;
  onAcceptReschedule?: (m: Meeting) => Promise<void> | void;
  onDenyReschedule?: (m: Meeting, reason: string) => Promise<void> | void;
}

export interface BookableConfig {
  minInstant: Date;
  allowOnline: boolean;
  allowOffline: boolean;
  onBook: (start: Date, end: Date, meetingType: MeetingType, agenda: string) => Promise<void> | void;
}

type FetchBusyRanges = (date: Date, excludeMeetingId?: number) => Promise<TimeRange[]>;

function statusChipClass(status: MeetingStatus): string {
  switch (status) {
    case "confirmed":
    case "completed":
      return "border-[#1E8A4F] text-[#1E8A4F]";
    case "requested":
    case "reschedule_pending":
      return "border-[#ffc107] text-[#ffc107]";
    case "denied":
      return "border-coral-red text-coral-red";
    default:
      return "border-text-muted text-text-muted";
  }
}

function statusBgClass(status: MeetingStatus): string {
  switch (status) {
    case "confirmed":
    case "completed":
      return "bg-[#1E8A4F] text-white";
    case "requested":
    case "reschedule_pending":
      return "bg-[#ffc107] text-[#2A2E33]";
    case "denied":
      return "bg-coral-red text-white";
    default:
      return "bg-text-muted text-white";
  }
}

export function MeetingCalendarView({
  role,
  meetings,
  actions,
  labelFor,
  bookable,
  fetchBusyRanges,
  fetchBlockedDates,
  blocks = [],
}: {
  role: "client" | "admin";
  meetings: Meeting[];
  actions: MeetingActions;
  labelFor: (m: Meeting) => string;
  bookable?: BookableConfig;
  fetchBusyRanges: FetchBusyRanges;
  fetchBlockedDates?: FetchBlockedDates;
  blocks?: MeetingBlock[];
}) {
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [active, setActive] = useState<Meeting | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState<Date | null>(null);
  const [blockedDates, setBlockedDates] = useState<Map<string, string | null>>(new Map());

  const today = new Date();
  const monthDays = useMemo(() => generateMonthGrid(currentDate), [currentDate]);
  const weekDays = useMemo(() => generateWeekDays(currentDate), [currentDate]);
  const minBookableDay = bookable ? startOfDay(bookable.minInstant) : null;

  useEffect(() => {
    if (!fetchBlockedDates) return;
    const rangeStart = view === "month" ? monthDays[0] : view === "week" ? weekDays[0] : currentDate;
    const rangeEnd = view === "month" ? monthDays[monthDays.length - 1] : view === "week" ? weekDays[6] : currentDate;
    fetchBlockedDates(rangeStart, rangeEnd)
      .then((dates) => setBlockedDates(new Map(dates.map((d) => [d.date, d.reason]))))
      .catch(() => setBlockedDates(new Map()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, currentDate, fetchBlockedDates]);

  function meetingsOn(date: Date): Meeting[] {
    return meetings.filter((m) => isSameDay(meetingDisplayRange(m).start, date));
  }

  function blocksOn(date: Date): MeetingBlock[] {
    return blocks.filter((b) => isSameDay(new Date(b.start_datetime), date));
  }

  function recurringBlockReasonOn(date: Date): string | null | undefined {
    const key = toDateKey(date);
    return blockedDates.has(key) ? blockedDates.get(key) : undefined;
  }

  function isBookableDay(date: Date): boolean {
    return !!minBookableDay && startOfDay(date) >= minBookableDay && !blockedDates.has(toDateKey(date));
  }

  function navigate(dir: "prev" | "next") {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + (dir === "next" ? 1 : -1));
    else if (view === "week") d.setDate(d.getDate() + (dir === "next" ? 7 : -7));
    else d.setDate(d.getDate() + (dir === "next" ? 1 : -1));
    setCurrentDate(d);
  }

  function rangeLabel(): string {
    if (view === "month") return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (view === "week") {
      const start = weekDays[0];
      const end = weekDays[6];
      return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  }

  function openDetails(m: Meeting) {
    setActive(m);
    setError(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-2 border-border-strong bg-bg-panel-alt p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1">
          {(["day", "week", "month"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`border-2 px-4 py-2 font-label-caps text-[11px] uppercase tracking-[0.1em] transition-all
                ${view === v ? "bg-brand-green text-on-brand-green border-border-strong" : "border-border-subtle text-text-muted hover:text-text-main"}`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("prev")} className="px-2 font-data-mono text-text-main hover:text-brand-green">
            &lt;
          </button>
          <span className="w-56 text-center font-data-mono text-data-mono uppercase text-text-main">{rangeLabel()}</span>
          <button onClick={() => navigate("next")} className="px-2 font-data-mono text-text-main hover:text-brand-green">
            &gt;
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="border-2 border-border-strong px-3 py-1 font-data-mono text-xs uppercase text-text-main hover:border-brand-green"
          >
            Today
          </button>
        </div>
      </div>

      {view === "month" && (
        <div className="border-4 border-border-strong bg-bg-panel shadow-[8px_8px_0px_0px_var(--shadow-strong)]">
          <div className="grid grid-cols-7 border-b-4 border-border-strong">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="p-2 text-center font-label-caps text-[11px] uppercase tracking-[0.1em] text-text-inverse">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-border-subtle">
            {monthDays.map((date, i) => {
              const dayMeetings = meetingsOn(date);
              const dayBlocks = blocksOn(date);
              const inMonth = date.getMonth() === currentDate.getMonth();
              const isToday = isSameDay(date, today);
              const bookableDay = isBookableDay(date);
              return (
                <div key={i} className={`min-h-[110px] p-2 ${inMonth ? "bg-bg-panel-alt" : "bg-bg-panel-alt opacity-40"}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className={`inline-flex h-7 w-7 items-center justify-center font-data-mono text-sm font-black ${isToday ? "bg-brand-green text-on-brand-green" : "text-text-main"}`}>
                      {date.getDate()}
                    </div>
                    {bookableDay && (
                      <button
                        type="button"
                        title="Book this date"
                        onClick={() => setBookingDate(date)}
                        className="flex h-5 w-5 items-center justify-center border border-[#1E8A4F] bg-[#1E8A4F]/10 font-bold text-[#1E8A4F] transition-colors hover:bg-[#1E8A4F] hover:text-white"
                      >
                        +
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5 mt-1">
                    {recurringBlockReasonOn(date) !== undefined && (
                      <div
                        title={recurringBlockReasonOn(date) ?? "Recurring block"}
                        className="block w-full truncate border-l-2 border-text-muted bg-text-muted/5 px-1.5 py-0.5 text-left font-data-mono text-[9px] text-text-muted"
                      >
                        Blocked
                      </div>
                    )}
                    {dayBlocks.map((b) => (
                      <div
                        key={`block-${b.id}`}
                        title={b.reason ?? "Blocked"}
                        className="block w-full truncate border-l-2 border-text-muted bg-text-muted/5 px-1.5 py-0.5 text-left font-data-mono text-[9px] text-text-muted"
                      >
                        {formatTimeRange(new Date(b.start_datetime), new Date(b.end_datetime))}
                      </div>
                    ))}
                    {dayMeetings.slice(0, 3).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => openDetails(m)}
                        className={`block w-full truncate px-1.5 py-1 text-left font-data-mono text-[10px] uppercase font-bold tracking-wider ${statusBgClass(m.status)} shadow-[2px_2px_0px_0px_var(--shadow-strong)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_var(--shadow-strong)] transition-all`}
                      >
                        {labelFor(m)}
                      </button>
                    ))}
                    {dayMeetings.length > 3 && (
                      <div className="font-data-mono text-[10px] text-brand-green">+{dayMeetings.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "week" && (
        <div className="border-4 border-border-strong bg-bg-panel shadow-[8px_8px_0px_0px_var(--shadow-strong)]">
          <div className="grid grid-cols-7 border-b-4 border-border-strong">
            {weekDays.map((date, i) => (
              <div key={i} className="p-2 text-center">
                <div className="font-label-caps text-[10px] uppercase text-text-inverse opacity-70">
                  {date.toLocaleDateString("en-US", { weekday: "short" })}
                </div>
                <div className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center font-data-mono text-base font-black ${isSameDay(date, today) ? "bg-brand-green text-on-brand-green" : "border-2 border-text-inverse/40 text-text-inverse"}`}>
                  {date.getDate()}
                </div>
              </div>
            ))}
          </div>
          <div className="grid min-h-[400px] grid-cols-7 divide-x divide-border-subtle">
            {weekDays.map((date, i) => {
              const bookableDay = isBookableDay(date);
              return (
                <div key={i} className="space-y-2 bg-bg-panel-alt p-2">
                  {bookableDay && (
                    <button
                      type="button"
                      onClick={() => setBookingDate(date)}
                      className="flex w-full items-center justify-center gap-1 border border-[#1E8A4F] bg-[#1E8A4F]/10 py-1 font-data-mono text-[9px] uppercase text-[#1E8A4F] transition-colors hover:bg-[#1E8A4F] hover:text-white"
                    >
                      + Book
                    </button>
                  )}
                  {recurringBlockReasonOn(date) !== undefined && (
                    <div
                      title={recurringBlockReasonOn(date) ?? "Recurring block"}
                      className="block w-full border-l-4 border-text-muted bg-text-muted/10 px-2 py-1.5 text-left font-data-mono text-[10px] text-text-muted"
                    >
                      ⛔ Recurring block
                    </div>
                  )}
                  {blocksOn(date).map((b) => (
                    <div
                      key={`block-${b.id}`}
                      title={b.reason ?? "Blocked"}
                      className="block w-full border-l-4 border-text-muted bg-text-muted/10 px-2 py-1.5 text-left font-data-mono text-[10px] text-text-muted"
                    >
                      ⛔ {formatTimeRange(new Date(b.start_datetime), new Date(b.end_datetime))}
                    </div>
                  ))}
                  {meetingsOn(date).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => openDetails(m)}
                      className={`block w-full border-l-4 px-2 py-1.5 text-left font-data-mono text-[11px] ${statusChipClass(m.status)} bg-bg-base`}
                    >
                      <div className="font-bold tabular-nums">{formatTime(meetingDisplayRange(m).start)}</div>
                      <div className="truncate">{labelFor(m)}</div>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "day" && (
        <div className="border-4 border-border-strong bg-bg-panel-alt shadow-[8px_8px_0px_0px_var(--shadow-strong)]">
          <div className="flex items-center justify-between border-b-4 border-border-strong bg-bg-panel p-4">
            <h3 className="font-label-caps text-label-caps uppercase tracking-[0.1em] text-text-inverse">
              {currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </h3>
            {isBookableDay(currentDate) && (
              <Button variant="secondary" onClick={() => setBookingDate(currentDate)}>
                Book This Day
              </Button>
            )}
          </div>
          <div className="max-h-[600px] divide-y divide-border-subtle overflow-y-auto">
            {meetingsOn(currentDate).length === 0 &&
            blocksOn(currentDate).length === 0 &&
            recurringBlockReasonOn(currentDate) === undefined ? (
              <p className="p-6 text-center font-data-mono text-text-muted">No meetings this day.</p>
            ) : (
              <>
                {recurringBlockReasonOn(currentDate) !== undefined && (
                  <div className="flex w-full items-center justify-between p-4 text-left text-text-muted">
                    <div>
                      <p className="font-data-mono text-base font-bold">⛔ Recurring block</p>
                      {recurringBlockReasonOn(currentDate) && (
                        <p className="mt-1 truncate text-xs">{recurringBlockReasonOn(currentDate)}</p>
                      )}
                    </div>
                  </div>
                )}
                {blocksOn(currentDate).map((b) => (
                  <div key={`block-${b.id}`} className="flex w-full items-center justify-between p-4 text-left text-text-muted">
                    <div>
                      <p className="font-data-mono text-base font-bold tabular-nums">
                        ⛔ {formatTimeRange(new Date(b.start_datetime), new Date(b.end_datetime))}
                      </p>
                      {b.reason && <p className="mt-1 truncate text-xs">{b.reason}</p>}
                    </div>
                  </div>
                ))}
                {meetingsOn(currentDate).map((m) => {
                  const range = meetingDisplayRange(m);
                  return (
                    <button key={m.id} onClick={() => openDetails(m)} className="flex w-full items-center justify-between p-4 text-left hover:bg-bg-base">
                      <div>
                        <p className="font-data-mono text-base font-bold tabular-nums text-text-main">
                          {formatTimeRange(range.start, range.end)} <span className="font-normal text-text-muted">&middot; {labelFor(m)}</span>
                        </p>
                        <p className="mt-1 truncate text-xs text-text-muted">{m.agenda}</p>
                      </div>
                      <StatusBadge status={m.status} />
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}

      <MeetingDetailsModal
        role={role}
        meeting={active}
        actions={actions}
        error={error}
        setError={setError}
        onClose={() => setActive(null)}
        fetchBusyRanges={fetchBusyRanges}
        fetchBlockedDates={fetchBlockedDates}
      />
      {bookable && (
        <BookingModal date={bookingDate} config={bookable} onClose={() => setBookingDate(null)} fetchBusyRanges={fetchBusyRanges} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Booking modal — triggered by clicking an available date on the     */
/* calendar itself                                                    */
/* ------------------------------------------------------------------ */

function BookingModal({
  date,
  config,
  onClose,
  fetchBusyRanges,
}: {
  date: Date | null;
  config: BookableConfig;
  onClose: () => void;
  fetchBusyRanges: FetchBusyRanges;
}) {
  const [meetingType, setMeetingType] = useState<MeetingType>(config.allowOnline ? "online" : "offline");
  const [startSlot, setStartSlot] = useState("");
  const [endSlot, setEndSlot] = useState("");
  const [agenda, setAgenda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentVisible, setSentVisible] = useState(false);
  const [busyRanges, setBusyRanges] = useState<TimeRange[]>([]);

  useEffect(() => {
    setMeetingType(config.allowOnline ? "online" : "offline");
    setStartSlot("");
    setEndSlot("");
    setAgenda("");
    setError(null);
    setSent(false);
    setSentVisible(false);
    setBusyRanges([]);
    if (date) {
      fetchBusyRanges(date).then(setBusyRanges).catch(() => setBusyRanges([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, config.allowOnline]);

  useEffect(() => {
    if (!sent) return;
    const showTimer = setTimeout(() => setSentVisible(true), 20);
    const closeTimer = setTimeout(onClose, 2200);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(closeTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sent]);

  if (!date) return null;
  const bookingDate = date;

  const minDateTime = isSameDay(bookingDate, config.minInstant) ? config.minInstant : startOfDay(bookingDate);
  const noTypesAvailable = !config.allowOnline && !config.allowOffline;

  async function submit() {
    if (!startSlot || !endSlot) return;
    const start = slotToDate(bookingDate, startSlot);
    const end = slotToDate(bookingDate, endSlot);
    if (end <= start || agenda.trim().length < 15) return;
    try {
      setSubmitting(true);
      setError(null);
      await config.onBook(start, end, meetingType, agenda);
      setSent(true);
    } catch (err) {
      setError(formatApiError(err, "Could not submit request"));
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !!startSlot && !!endSlot && slotToDate(bookingDate, endSlot) > slotToDate(bookingDate, startSlot) && agenda.trim().length >= 15;

  return (
    <Modal open={!!date} onClose={onClose} title={`Book ${date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}>
      {sent ? (
        <div className="flex flex-col items-center gap-6 py-10 text-center">
          <div
            className={`flex h-20 w-20 items-center justify-center border-4 border-border-strong bg-brand-green shadow-[6px_6px_0px_0px_var(--shadow-strong)] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              sentVisible ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-12 opacity-0"
            }`}
          >
            <span
              className="material-symbols-outlined text-5xl text-on-brand-green"
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 700, 'GRAD' 0, 'opsz' 48" }}
            >
              check
            </span>
          </div>
          <div className={`transition-all delay-150 duration-500 ${sentVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
            <p className="font-display-xl text-xl font-black uppercase tracking-[0.1em] text-text-main">Appointment Request Sent</p>
            <p className="mt-2 text-sm text-text-muted">Hang tight — the admin needs to confirm this slot before it's locked in.</p>
          </div>
        </div>
      ) : (
        <>
          {error && <Alert>{error}</Alert>}

          {noTypesAvailable ? (
            <Alert kind="warning">No meeting types are currently being accepted. Please check back later.</Alert>
          ) : (
            <>
              <Field>
                <Label>Meeting Type</Label>
                <MeetingTypeToggle value={meetingType} onChange={setMeetingType} allowOnline={config.allowOnline} allowOffline={config.allowOffline} />
              </Field>

              <TimeRangePicker
                date={bookingDate}
                startSlot={startSlot}
                endSlot={endSlot}
                onStartChange={(slot) => {
                  setStartSlot(slot);
                  setEndSlot("");
                }}
                onEndChange={setEndSlot}
                minDateTime={minDateTime}
                busyRanges={busyRanges}
              />

              <Field>
                <Label>Agenda (min. 15 characters)</Label>
                <Textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} />
              </Field>

              <Button onClick={submit} disabled={!canSubmit || submitting}>
                {submitting ? "Submitting..." : "Submit Appointment Request"}
              </Button>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Details modal — role + status driven actions                       */
/* ------------------------------------------------------------------ */

export function MeetingDetailsModal({
  role,
  meeting,
  actions,
  error,
  setError,
  onClose,
  fetchBusyRanges,
  fetchBlockedDates,
}: {
  role: "client" | "admin";
  meeting: Meeting | null;
  actions: MeetingActions;
  error: string | null;
  setError: (e: string | null) => void;
  onClose: () => void;
  fetchBusyRanges: FetchBusyRanges;
  fetchBlockedDates?: FetchBlockedDates;
}) {
  const [meetingLink, setMeetingLink] = useState("");
  const [meetingCode, setMeetingCode] = useState("");
  const [reason, setReason] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState<Date | null>(null);
  const [rescheduleStartSlot, setRescheduleStartSlot] = useState("");
  const [rescheduleEndSlot, setRescheduleEndSlot] = useState("");
  const [rescheduleBusyRanges, setRescheduleBusyRanges] = useState<TimeRange[]>([]);
  const [rescheduleDisabledDates, setRescheduleDisabledDates] = useState<Set<string>>(new Set());
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);
  const [showDenyInput, setShowDenyInput] = useState(false);

  useEffect(() => {
    setMeetingLink(meeting?.meeting_link ?? "");
    setMeetingCode(meeting?.meeting_code ?? "");
    setReason("");
    setRescheduleDate(null);
    setRescheduleStartSlot("");
    setRescheduleEndSlot("");
    setRescheduleBusyRanges([]);
    setShowReschedulePicker(false);
    setShowDenyInput(false);
  }, [meeting?.id]);

  useEffect(() => {
    if (!rescheduleDate || !meeting) return;
    fetchBusyRanges(rescheduleDate, meeting.id).then(setRescheduleBusyRanges).catch(() => setRescheduleBusyRanges([]));
  }, [rescheduleDate, meeting, fetchBusyRanges]);

  useEffect(() => {
    if (!showReschedulePicker || !fetchBlockedDates) return;
    const horizonStart = new Date();
    const horizonEnd = new Date();
    horizonEnd.setDate(horizonEnd.getDate() + 180);
    fetchBlockedDates(horizonStart, horizonEnd)
      .then((dates) => setRescheduleDisabledDates(new Set(dates.map((d) => d.date))))
      .catch(() => setRescheduleDisabledDates(new Set()));
  }, [showReschedulePicker, fetchBlockedDates]);

  if (!meeting) return null;
  const activeMeeting = meeting;

  async function run(fn: (() => Promise<void> | void) | undefined) {
    if (!fn) return;
    try {
      setError(null);
      await fn();
      onClose();
    } catch (err) {
      setError(formatApiError(err, "Action failed"));
    }
  }

  const minRescheduleAnchor = meeting.confirmed_end_datetime ? new Date(meeting.confirmed_end_datetime) : new Date();
  const minRescheduleDay = new Date(minRescheduleAnchor);
  minRescheduleDay.setHours(0, 0, 0, 0);
  minRescheduleDay.setDate(minRescheduleDay.getDate() + 1);

  function submitReschedule() {
    if (!rescheduleDate || !rescheduleStartSlot || !rescheduleEndSlot) return;
    const start = slotToDate(rescheduleDate, rescheduleStartSlot);
    const end = slotToDate(rescheduleDate, rescheduleEndSlot);
    if (end <= start) return;
    run(() => actions.onProposeReschedule?.(activeMeeting, start, end));
  }

  const canSubmitReschedule =
    !!rescheduleDate &&
    !!rescheduleStartSlot &&
    !!rescheduleEndSlot &&
    rescheduleDate &&
    slotToDate(rescheduleDate, rescheduleEndSlot) > slotToDate(rescheduleDate, rescheduleStartSlot);

  const isAdmin = role === "admin";
  const pendingByAdmin = meeting.pending_proposed_by === "admin";
  const pendingByClient = meeting.pending_proposed_by === "client";
  const displayRange = meetingDisplayRange(meeting);

  const reschedulePicker = showReschedulePicker && (
    <div className="mt-4 p-4 border-2 border-border-strong bg-bg-base space-y-4 shadow-[4px_4px_0px_0px_var(--shadow-strong)]">
      <h4 className="font-label-caps text-xs tracking-widest uppercase text-text-main flex items-center gap-2">
        <span className="material-symbols-outlined text-base">edit_calendar</span>
        Select New Time
      </h4>
      <MiniCalendar
        value={rescheduleDate}
        onChange={(d) => {
          setRescheduleDate(d);
          setRescheduleStartSlot("");
          setRescheduleEndSlot("");
        }}
        minDate={minRescheduleDay}
        disabledDates={rescheduleDisabledDates}
      />
      {rescheduleDate && (
        <TimeRangePicker
          date={rescheduleDate}
          startSlot={rescheduleStartSlot}
          endSlot={rescheduleEndSlot}
          onStartChange={(slot) => {
            setRescheduleStartSlot(slot);
            setRescheduleEndSlot("");
          }}
          onEndChange={setRescheduleEndSlot}
          minDateTime={isSameDay(rescheduleDate, minRescheduleAnchor) ? minRescheduleAnchor : startOfDay(rescheduleDate)}
          busyRanges={rescheduleBusyRanges}
        />
      )}
      <div className="pt-2">
        <Button onClick={submitReschedule} disabled={!canSubmitReschedule} className="w-full">
          Submit Reschedule Proposal
        </Button>
      </div>
    </div>
  );

  const monthStr = displayRange.start.toLocaleDateString("en-US", { month: "short" });
  const dayStr = displayRange.start.getDate();
  const statusLabel = meeting.status === "reschedule_pending" ? "Proposed Time" : meeting.confirmed_start_datetime ? "Confirmed Time" : "Requested Time";

  // Status mapping for visual styles
  const statusStyles: Record<string, { bg: string, border: string, text: string, icon: string }> = {
    confirmed: { bg: "bg-[#1E8A4F]/10", border: "border-[#1E8A4F]", text: "text-[#1E8A4F]", icon: "check_circle" },
    completed: { bg: "bg-[#1E8A4F]/10", border: "border-[#1E8A4F]", text: "text-[#1E8A4F]", icon: "task_alt" },
    requested: { bg: "bg-[#ffc107]/10", border: "border-[#ffc107]", text: "text-[#ffc107]", icon: "pending_actions" },
    reschedule_pending: { bg: "bg-[#ffc107]/10", border: "border-[#ffc107]", text: "text-[#ffc107]", icon: "update" },
    denied: { bg: "bg-coral-red/10", border: "border-coral-red", text: "text-coral-red", icon: "cancel" },
    cancelled: { bg: "bg-text-muted/10", border: "border-text-muted", text: "text-text-muted", icon: "block" },
  };
  const currentStatusStyle = statusStyles[meeting.status] || statusStyles.requested;

  return (
    <Modal open={!!meeting} onClose={onClose} title={`Meeting #${meeting.id}`}>
      {error && <Alert>{error}</Alert>}

      <div className="flex flex-col gap-6">
        {/* Status and Type Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-border-strong pb-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 border-2 ${currentStatusStyle.border} ${currentStatusStyle.bg}`}>
            <span className={`material-symbols-outlined text-xl ${currentStatusStyle.text}`}>{currentStatusStyle.icon}</span>
            <span className={`font-data-mono text-xs font-bold uppercase tracking-wider ${currentStatusStyle.text}`}>
              {meeting.status.replace(/_/g, " ")}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-bg-panel border-2 border-border-strong px-3 py-1.5">
            <span className="material-symbols-outlined text-text-inverse opacity-80 text-xl">
              {meeting.meeting_type === "online" ? "videocam" : "location_on"}
            </span>
            <span className="font-data-mono text-xs font-bold uppercase tracking-wider text-text-inverse">
              {meeting.meeting_type}
            </span>
          </div>
        </div>

        {/* Date & Time Block */}
        <div className="flex gap-4 items-center bg-bg-panel-alt p-4 border-2 border-border-strong shadow-[4px_4px_0px_0px_var(--shadow-strong)]">
          <div className="flex flex-col items-center justify-center border-2 border-border-strong bg-bg-panel w-16 h-16 shrink-0">
            <span className="text-[10px] uppercase font-label-caps text-text-inverse tracking-widest">{monthStr}</span>
            <span className="text-2xl font-black font-data-mono text-brand-green leading-none">{dayStr}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-text-muted uppercase tracking-widest font-label-caps mb-1">{statusLabel}</div>
            <div className="text-base sm:text-lg font-bold font-data-mono text-text-main truncate">
              {formatTime(displayRange.start)} – {formatTime(displayRange.end)}
            </div>
            <div className="text-xs font-data-mono text-text-muted mt-0.5 truncate">
              {displayRange.start.toLocaleDateString("en-US", { weekday: "long", year: "numeric" })}
            </div>
          </div>
        </div>

        {/* Link / Location Area (if online & confirmed) */}
        {meeting.meeting_link && meeting.status === "confirmed" && (
          <a
            href={meeting.meeting_link}
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border-2 border-border-strong bg-brand-green/5 hover:bg-brand-green/10 transition-colors cursor-pointer shadow-[4px_4px_0px_0px_var(--shadow-strong)]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 flex items-center justify-center bg-brand-green text-on-brand-green border-2 border-border-strong shrink-0">
                <span className="material-symbols-outlined">link</span>
              </div>
              <div className="min-w-0">
                <div className="font-label-caps text-[10px] text-brand-green uppercase tracking-widest mb-0.5">Join Meeting</div>
                <div className="font-data-mono text-sm text-text-main font-bold truncate">Click to open video call</div>
              </div>
            </div>
            {meeting.meeting_code && (
              <div className="sm:text-right border-t-2 sm:border-t-0 sm:border-l-2 border-border-strong pt-2 sm:pt-0 sm:pl-4 mt-2 sm:mt-0 w-full sm:w-auto">
                <div className="font-label-caps text-[10px] text-text-muted uppercase tracking-widest mb-0.5">Meeting Code</div>
                <div className="font-data-mono text-sm font-bold text-text-main">{meeting.meeting_code}</div>
              </div>
            )}
          </a>
        )}

        {/* Agenda */}
        <div className="space-y-2">
          <h4 className="font-label-caps text-[10px] text-text-muted uppercase tracking-widest flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">subject</span> Agenda / Notes
          </h4>
          <p className="font-data-mono text-sm text-text-main p-4 bg-border-subtle/10 border-l-4 border-border-strong leading-relaxed whitespace-pre-wrap">
            {meeting.agenda || "No agenda provided."}
          </p>
        </div>

        {/* Denial Reason */}
        {meeting.denial_reason && (
          <div className="space-y-2">
             <h4 className="font-label-caps text-[10px] text-coral-red uppercase tracking-widest flex items-center gap-1.5">
               <span className="material-symbols-outlined text-sm">warning</span> Denial Reason
             </h4>
             <p className="font-data-mono text-sm text-text-main p-4 bg-coral-red/5 border-l-4 border-coral-red leading-relaxed">
               {meeting.denial_reason}
             </p>
          </div>
        )}

        {/* ACTIONS SECTION */}
        <div className="mt-4 border-t-4 border-border-strong pt-6 space-y-6">
          {/* --- ADMIN actions --- */}
          {isAdmin && (meeting.status === "requested" || (meeting.status === "reschedule_pending" && pendingByClient)) && (
            <div className="space-y-4">
              {meeting.meeting_type === "online" && (
                <div className="grid gap-4 sm:grid-cols-2 bg-bg-panel p-4 border-2 border-border-strong">
                  <Field className="mb-0">
                    <Label>Meeting Link</Label>
                    <Input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://meet.google.com/..." className="h-10 text-xs" />
                    {meetingLink.length > 0 && !MEETING_LINK_PATTERN.test(meetingLink.trim()) && (
                      <p className="mt-1 font-data-mono text-[10px] text-coral-red">
                        Must start with valid meet/teams url
                      </p>
                    )}
                  </Field>
                  <Field className="mb-0">
                    <Label>Meeting Code</Label>
                    <Input value={meetingCode} onChange={(e) => setMeetingCode(e.target.value)} placeholder="e.g. abc-defg-hij" className="h-10 text-xs" />
                  </Field>
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => run(() => actions.onConfirm?.(meeting, meetingLink, meetingCode))}
                  disabled={
                    meeting.meeting_type === "online" &&
                    !(MEETING_LINK_PATTERN.test(meetingLink.trim()) && meetingCode.trim().length > 0)
                  }
                  className="flex-1"
                >
                  Confirm Slot
                </Button>
                <Button variant="danger" onClick={() => setShowDenyInput((s) => !s)} className="flex-1">
                  Deny Request
                </Button>
              </div>
              
              {showDenyInput && (
                <div className="p-4 border-2 border-coral-red bg-coral-red/5 space-y-3 mt-2">
                  <Field className="mb-0">
                    <Label className="text-coral-red">Reason for Denial</Label>
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[80px]" />
                  </Field>
                  <Button variant="danger" onClick={() => run(() => actions.onDeny?.(meeting, reason))} disabled={!reason.trim()}>
                    Confirm Denial
                  </Button>
                </div>
              )}
            </div>
          )}

          {isAdmin && meeting.status === "confirmed" && (
            <div>
              <Button variant="secondary" onClick={() => setShowReschedulePicker((s) => !s)} className="w-full sm:w-auto">
                Propose Reschedule
              </Button>
              {reschedulePicker}
            </div>
          )}

          {isAdmin && meeting.status === "reschedule_pending" && pendingByAdmin && (
            <div className="flex items-center gap-2 p-3 bg-bg-panel-alt border-l-4 border-warning">
              <span className="material-symbols-outlined text-warning">hourglass_empty</span>
              <p className="font-data-mono text-xs text-text-main">Waiting on client to accept or deny proposal.</p>
            </div>
          )}

          {/* --- CLIENT actions --- */}
          {!isAdmin && meeting.status === "reschedule_pending" && pendingByAdmin && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={() => run(() => actions.onAcceptReschedule?.(meeting))} className="flex-1">Accept Proposal</Button>
                <Button variant="danger" onClick={() => setShowDenyInput((s) => !s)} className="flex-1">
                  Deny Proposal
                </Button>
              </div>
              {showDenyInput && (
                <div className="p-4 border-2 border-coral-red bg-coral-red/5 space-y-3 mt-2">
                  <Field className="mb-0">
                    <Label className="text-coral-red">Reason for Denial</Label>
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[80px]" />
                  </Field>
                  <Button variant="danger" onClick={() => run(() => actions.onDenyReschedule?.(meeting, reason))} disabled={!reason.trim()}>
                    Confirm Denial
                  </Button>
                </div>
              )}
            </div>
          )}

          {!isAdmin && meeting.status === "reschedule_pending" && pendingByClient && (
            <div className="flex items-center gap-2 p-3 bg-bg-panel-alt border-l-4 border-warning">
              <span className="material-symbols-outlined text-warning">hourglass_empty</span>
              <p className="font-data-mono text-xs text-text-main">Waiting on admin to confirm or deny proposal.</p>
            </div>
          )}

          {!isAdmin && meeting.status === "confirmed" && (
            <div>
              <Button variant="secondary" onClick={() => setShowReschedulePicker((s) => !s)} className="w-full sm:w-auto">
                Propose Reschedule (Emergency)
              </Button>
              {reschedulePicker}
            </div>
          )}

          {!isAdmin && (meeting.status === "requested" || meeting.status === "confirmed") && (
            <div className="flex justify-end pt-4">
              <Button variant="ghost" onClick={() => run(() => actions.onCancel?.(meeting))} className="text-coral-red hover:text-coral-red hover:bg-coral-red/10">
                Cancel Meeting
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Admin: block off a time range                                      */
/* ------------------------------------------------------------------ */

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const BLOCKED_DATES_HORIZON_DAYS = 180;

export function BlockTimeModal({
  open,
  onClose,
  onCreate,
  onCreateRecurring,
  onPreviewConflicts,
  minDate,
  fetchBusyRanges,
  fetchBlockedDates,
  initialMode = "one-time",
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (start: Date, end: Date, reason: string) => Promise<void> | void;
  onCreateRecurring: (payload: RecurringMeetingBlockCreatePayload) => Promise<void> | void;
  onPreviewConflicts: (payload: RecurringMeetingBlockCreatePayload) => Promise<Meeting[]>;
  minDate: Date;
  fetchBusyRanges: FetchBusyRanges;
  fetchBlockedDates?: FetchBlockedDates;
  initialMode?: "one-time" | "recurring";
}) {
  const [mode, setMode] = useState<"one-time" | "recurring">(initialMode);
  const [date, setDate] = useState<Date | null>(null);
  const [startSlot, setStartSlot] = useState("");
  const [endSlot, setEndSlot] = useState("");
  const [reason, setReason] = useState("");
  const [busyRanges, setBusyRanges] = useState<TimeRange[]>([]);
  const [disabledDates, setDisabledDates] = useState<Set<string>>(new Set());

  const [frequency, setFrequency] = useState<RecurrenceFrequency>("weekly");
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [month, setMonth] = useState(1);
  const [untilDate, setUntilDate] = useState("");
  const [recurringReason, setRecurringReason] = useState("");
  const [previewConflicts, setPreviewConflicts] = useState<Meeting[] | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setDate(null);
    setStartSlot("");
    setEndSlot("");
    setReason("");
    setBusyRanges([]);
    setFrequency("weekly");
    setDayOfWeek(0);
    setDayOfMonth(1);
    setMonth(1);
    setUntilDate("");
    setRecurringReason("");
    setPreviewConflicts(null);
    setError(null);
    if (fetchBlockedDates) {
      const horizonStart = new Date();
      const horizonEnd = new Date();
      horizonEnd.setDate(horizonEnd.getDate() + BLOCKED_DATES_HORIZON_DAYS);
      fetchBlockedDates(horizonStart, horizonEnd)
        .then((dates) => setDisabledDates(new Set(dates.map((d) => d.date))))
        .catch(() => setDisabledDates(new Set()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMode]);

  useEffect(() => {
    if (!date) return;
    fetchBusyRanges(date).then(setBusyRanges).catch(() => setBusyRanges([]));
  }, [date, fetchBusyRanges]);

  if (!open) return null;

  const canSubmitOneTime = !!date && !!startSlot && !!endSlot && slotToDate(date, endSlot) > slotToDate(date, startSlot);
  const canSubmitRecurring =
    (frequency === "weekly" && dayOfWeek >= 0 && dayOfWeek <= 6) ||
    (frequency === "monthly" && dayOfMonth >= 1 && dayOfMonth <= 31) ||
    (frequency === "yearly" && dayOfMonth >= 1 && dayOfMonth <= 31 && month >= 1 && month <= 12);

  async function submitOneTime() {
    if (!date || !canSubmitOneTime) return;
    try {
      setSubmitting(true);
      setError(null);
      await onCreate(slotToDate(date, startSlot), slotToDate(date, endSlot), reason);
      onClose();
    } catch (err) {
      setError(formatApiError(err, "Could not create block"));
    } finally {
      setSubmitting(false);
    }
  }

  function buildRecurringPayload(): RecurringMeetingBlockCreatePayload {
    return {
      frequency,
      day_of_week: frequency === "weekly" ? dayOfWeek : null,
      day_of_month: frequency === "monthly" || frequency === "yearly" ? dayOfMonth : null,
      month: frequency === "yearly" ? month : null,
      until: untilDate || null,
      reason: recurringReason || null,
    };
  }

  async function submitRecurring() {
    if (!canSubmitRecurring) return;
    const payload = buildRecurringPayload();
    try {
      setSubmitting(true);
      setError(null);
      if (previewConflicts === null) {
        const conflicts = await onPreviewConflicts(payload);
        if (conflicts.length === 0) {
          await onCreateRecurring(payload);
          onClose();
        } else {
          setPreviewConflicts(conflicts);
        }
      } else {
        await onCreateRecurring(payload);
        onClose();
      }
    } catch (err) {
      setError(formatApiError(err, "Could not create recurring block"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Block Time Off">
      {error && <Alert>{error}</Alert>}

      <Field>
        <div className="inline-flex border-2 border-border-strong">
          {(["one-time", "recurring"] as const).map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => {
                setMode(m);
                setPreviewConflicts(null);
                setError(null);
              }}
              className={`px-5 py-2 font-label-caps text-[11px] uppercase tracking-[0.1em] transition-all
                ${mode === m ? "bg-brand-green text-on-brand-green" : "bg-bg-panel-alt text-text-main hover:bg-bg-panel-alt/70"}`}
            >
              {m === "one-time" ? "One-Time" : "Recurring"}
            </button>
          ))}
        </div>
      </Field>

      {mode === "one-time" ? (
        <>
          <Field>
            <Label>Date</Label>
            <MiniCalendar
              value={date}
              onChange={(d) => {
                setDate(d);
                setStartSlot("");
                setEndSlot("");
              }}
              minDate={minDate}
              disabledDates={disabledDates}
            />
          </Field>
          {date && (
            <TimeRangePicker
              date={date}
              startSlot={startSlot}
              endSlot={endSlot}
              onStartChange={(slot) => {
                setStartSlot(slot);
                setEndSlot("");
              }}
              onEndChange={setEndSlot}
              minDateTime={startOfDay(date)}
              busyRanges={busyRanges}
            />
          )}
          <Field>
            <Label>Reason (optional)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Out of office" />
          </Field>
          <Button onClick={submitOneTime} disabled={!canSubmitOneTime || submitting}>
            {submitting ? "Blocking..." : "Block This Time"}
          </Button>
        </>
      ) : (
        <>
          <Field>
            <Label>Frequency</Label>
            <Select
              value={frequency}
              onChange={(e) => {
                setFrequency(e.target.value as RecurrenceFrequency);
                setPreviewConflicts(null);
              }}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </Field>

          {frequency === "weekly" && (
            <Field>
              <Label>Day of Week</Label>
              <Select value={dayOfWeek} onChange={(e) => { setDayOfWeek(Number(e.target.value)); setPreviewConflicts(null); }}>
                {WEEKDAY_NAMES.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </Select>
            </Field>
          )}

          {frequency === "monthly" && (
            <Field>
              <Label>Day of Month</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(e) => { setDayOfMonth(Number(e.target.value)); setPreviewConflicts(null); }}
              />
              <p className="mt-1 font-data-mono text-xs text-text-muted">
                If a month is shorter than this, the block applies on that month&apos;s last day instead.
              </p>
            </Field>
          )}

          {frequency === "yearly" && (
            <>
              <Field>
                <Label>Month</Label>
                <Select value={month} onChange={(e) => { setMonth(Number(e.target.value)); setPreviewConflicts(null); }}>
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i} value={i + 1}>{name}</option>
                  ))}
                </Select>
              </Field>
              <Field>
                <Label>Day</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) => { setDayOfMonth(Number(e.target.value)); setPreviewConflicts(null); }}
                />
                <p className="mt-1 font-data-mono text-xs text-text-muted">
                  If the target month is shorter than this, the block applies on that month&apos;s last day instead.
                </p>
              </Field>
            </>
          )}

          <Field>
            <Label>Ends On (optional — leave blank to recur indefinitely)</Label>
            <Input type="date" value={untilDate} onChange={(e) => { setUntilDate(e.target.value); setPreviewConflicts(null); }} />
          </Field>

          <Field>
            <Label>Reason (optional)</Label>
            <Textarea value={recurringReason} onChange={(e) => setRecurringReason(e.target.value)} placeholder="e.g. Closed every Sunday" />
          </Field>

          {previewConflicts !== null && previewConflicts.length > 0 && (
            <Alert kind="warning">
              {previewConflicts.length} existing meeting(s) fall on this pattern — creating won&apos;t affect them, but
              future slots on matching dates will be blocked.
            </Alert>
          )}

          <Button onClick={submitRecurring} disabled={!canSubmitRecurring || submitting}>
            {submitting
              ? "Saving..."
              : previewConflicts && previewConflicts.length > 0
                ? "Create Anyway"
                : "Create Recurring Rule"}
          </Button>
        </>
      )}
    </Modal>
  );
}
