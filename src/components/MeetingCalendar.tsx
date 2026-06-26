"use client";

import { useEffect, useMemo, useState } from "react";
import { Meeting, MeetingBlock, MeetingStatus, MeetingType } from "@/lib/types";
import { formatApiError } from "@/lib/api";
import { Alert, Button, Field, Input, Label, Modal, StatusBadge, Textarea } from "@/components/ui";

/* ------------------------------------------------------------------ */
/* Date helpers                                                       */
/* ------------------------------------------------------------------ */

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

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

const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
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
}: {
  value: Date | null;
  onChange: (date: Date) => void;
  minDate: Date;
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
          className="px-2 py-1 font-data-mono text-data-mono text-text-main hover:text-coral-red"
        >
          &lt;
        </button>
        <span className="font-label-caps text-label-caps uppercase tracking-[0.1em] text-text-main">{monthName}</span>
        <button
          type="button"
          onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
          className="px-2 py-1 font-data-mono text-data-mono text-text-main hover:text-coral-red"
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
          const disabled = !inMonth || startOfDay(date) < minDay;
          const selected = value && isSameDay(date, value);
          return (
            <button
              type="button"
              key={i}
              disabled={disabled}
              onClick={() => onChange(date)}
              className={`h-8 w-8 border font-data-mono text-xs transition-colors
                ${disabled ? "border-transparent text-text-muted opacity-40" : "border-transparent text-text-main hover:border-coral-red"}
                ${selected ? "bg-coral-red border-coral-red text-white" : ""}`}
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
              ${disabled ? "border-border-subtle text-text-muted opacity-40 cursor-not-allowed" : "border-border-strong text-text-main hover:border-coral-red"}
              ${selected ? "bg-coral-red text-white border-coral-red shadow-[3px_3px_0px_0px_var(--border-strong)]" : "bg-bg-panel-alt"}`}
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
            ${value === opt.key && opt.allowed ? "bg-coral-red text-white" : "bg-bg-panel-alt text-text-main hover:bg-bg-panel-alt/70"}`}
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
          if (isStart) style = "bg-coral-red text-white border-coral-red shadow-[3px_3px_0px_0px_var(--border-strong)]";
          else if (isEnd) style = "bg-[#1E8A4F] text-white border-[#1E8A4F] shadow-[3px_3px_0px_0px_var(--border-strong)]";
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
                ${disabled ? "border-border-subtle text-text-muted opacity-40 cursor-not-allowed" : "border-border-strong text-text-main hover:border-coral-red"}
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
          <span className="text-[#1E8A4F] font-bold">{slotLabel(endSlot)}</span>
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
  onConfirm?: (m: Meeting, meetingLink: string) => Promise<void> | void;
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

export function MeetingCalendarView({
  role,
  meetings,
  actions,
  labelFor,
  bookable,
  fetchBusyRanges,
  blocks = [],
}: {
  role: "client" | "admin";
  meetings: Meeting[];
  actions: MeetingActions;
  labelFor: (m: Meeting) => string;
  bookable?: BookableConfig;
  fetchBusyRanges: FetchBusyRanges;
  blocks?: MeetingBlock[];
}) {
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [active, setActive] = useState<Meeting | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState<Date | null>(null);

  const today = new Date();
  const monthDays = useMemo(() => generateMonthGrid(currentDate), [currentDate]);
  const weekDays = useMemo(() => generateWeekDays(currentDate), [currentDate]);
  const minBookableDay = bookable ? startOfDay(bookable.minInstant) : null;

  function meetingsOn(date: Date): Meeting[] {
    return meetings.filter((m) => isSameDay(meetingDisplayRange(m).start, date));
  }

  function blocksOn(date: Date): MeetingBlock[] {
    return blocks.filter((b) => isSameDay(new Date(b.start_datetime), date));
  }

  function isBookableDay(date: Date): boolean {
    return !!minBookableDay && startOfDay(date) >= minBookableDay;
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
                ${view === v ? "bg-coral-red text-white border-border-strong" : "border-border-subtle text-text-muted hover:text-text-main"}`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("prev")} className="px-2 font-data-mono text-text-main hover:text-coral-red">
            &lt;
          </button>
          <span className="w-56 text-center font-data-mono text-data-mono uppercase text-text-main">{rangeLabel()}</span>
          <button onClick={() => navigate("next")} className="px-2 font-data-mono text-text-main hover:text-coral-red">
            &gt;
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="border-2 border-border-strong px-3 py-1 font-data-mono text-xs uppercase text-text-main hover:border-coral-red"
          >
            Today
          </button>
        </div>
      </div>

      {view === "month" && (
        <div className="border-4 border-border-strong bg-bg-panel shadow-[8px_8px_0px_0px_var(--border-strong)]">
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
                  <div className="mb-1 flex items-center justify-between">
                    <div className={`inline-flex h-6 w-6 items-center justify-center font-data-mono text-xs ${isToday ? "bg-coral-red text-white" : "text-text-main"}`}>
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
                  <div className="space-y-1">
                    {dayBlocks.map((b) => (
                      <div
                        key={`block-${b.id}`}
                        title={b.reason ?? "Blocked"}
                        className="block w-full truncate border border-text-muted bg-text-muted/10 px-1 py-0.5 text-left font-data-mono text-[10px] text-text-muted"
                      >
                        ⛔ {formatTimeRange(new Date(b.start_datetime), new Date(b.end_datetime))}
                      </div>
                    ))}
                    {dayMeetings.slice(0, 3).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => openDetails(m)}
                        className={`block w-full truncate border px-1 py-0.5 text-left font-data-mono text-[10px] ${statusChipClass(m.status)}`}
                      >
                        {labelFor(m)}
                      </button>
                    ))}
                    {dayMeetings.length > 3 && (
                      <div className="font-data-mono text-[10px] text-coral-red">+{dayMeetings.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "week" && (
        <div className="border-4 border-border-strong bg-bg-panel shadow-[8px_8px_0px_0px_var(--border-strong)]">
          <div className="grid grid-cols-7 border-b-4 border-border-strong">
            {weekDays.map((date, i) => (
              <div key={i} className="p-2 text-center">
                <div className="font-label-caps text-[10px] uppercase text-text-inverse opacity-70">
                  {date.toLocaleDateString("en-US", { weekday: "short" })}
                </div>
                <div className={`mx-auto mt-1 flex h-7 w-7 items-center justify-center font-data-mono text-sm ${isSameDay(date, today) ? "bg-coral-red text-white" : "text-text-inverse"}`}>
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
        <div className="border-4 border-border-strong bg-bg-panel-alt shadow-[8px_8px_0px_0px_var(--border-strong)]">
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
            {meetingsOn(currentDate).length === 0 && blocksOn(currentDate).length === 0 ? (
              <p className="p-6 text-center font-data-mono text-text-muted">No meetings this day.</p>
            ) : (
              <>
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
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div
            className={`flex h-16 w-16 items-center justify-center border-4 border-[#1E8A4F] bg-[#1E8A4F]/10 text-3xl text-[#1E8A4F] transition-all duration-500 ${
              sentVisible ? "scale-100 opacity-100" : "scale-50 opacity-0"
            }`}
          >
            ✓
          </div>
          <div className={`transition-all delay-150 duration-500 ${sentVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
            <p className="font-label-caps text-label-caps uppercase tracking-[0.1em] text-text-main">Appointment Request Sent</p>
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
}: {
  role: "client" | "admin";
  meeting: Meeting | null;
  actions: MeetingActions;
  error: string | null;
  setError: (e: string | null) => void;
  onClose: () => void;
  fetchBusyRanges: FetchBusyRanges;
}) {
  const [meetingLink, setMeetingLink] = useState("");
  const [reason, setReason] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState<Date | null>(null);
  const [rescheduleStartSlot, setRescheduleStartSlot] = useState("");
  const [rescheduleEndSlot, setRescheduleEndSlot] = useState("");
  const [rescheduleBusyRanges, setRescheduleBusyRanges] = useState<TimeRange[]>([]);
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);
  const [showDenyInput, setShowDenyInput] = useState(false);

  useEffect(() => {
    setMeetingLink(meeting?.meeting_link ?? "");
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
    <div className="space-y-3">
      <MiniCalendar
        value={rescheduleDate}
        onChange={(d) => {
          setRescheduleDate(d);
          setRescheduleStartSlot("");
          setRescheduleEndSlot("");
        }}
        minDate={minRescheduleDay}
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
      <Button onClick={submitReschedule} disabled={!canSubmitReschedule}>
        Submit Reschedule Proposal
      </Button>
    </div>
  );

  return (
    <Modal open={!!meeting} onClose={onClose} title={`Meeting #${meeting.id}`}>
      {error && <Alert>{error}</Alert>}

      <div className="mb-4 flex items-center justify-between">
        <StatusBadge status={meeting.status} />
        <span className="font-data-mono text-xs uppercase text-text-muted">{meeting.meeting_type}</span>
      </div>

      <div className="mb-4 space-y-2">
        <p className="font-data-mono text-base text-text-main">
          <span className="text-xs uppercase text-text-muted">
            {meeting.status === "reschedule_pending" ? "Proposed" : meeting.confirmed_start_datetime ? "Confirmed" : "Requested"}:{" "}
          </span>
          <span className="font-bold tabular-nums">
            {formatDateTime(displayRange.start)} – {formatTime(displayRange.end)}
          </span>
        </p>
        <p className="text-sm text-text-muted">{meeting.agenda}</p>
        {meeting.meeting_link && meeting.status === "confirmed" && (
          <a href={meeting.meeting_link} target="_blank" className="block font-data-mono text-sm text-coral-red underline">
            Join meeting link
          </a>
        )}
        {meeting.denial_reason && (
          <p className="border-l-4 border-coral-red bg-bg-panel-alt p-3 text-sm text-text-main">
            <span className="block font-label-caps text-[10px] uppercase tracking-[0.1em] text-coral-red">Denial Reason</span>
            {meeting.denial_reason}
          </p>
        )}
      </div>

      {/* --- ADMIN actions --- */}
      {isAdmin && (meeting.status === "requested" || (meeting.status === "reschedule_pending" && pendingByClient)) && (
        <div className="space-y-3 border-t-2 border-border-subtle pt-4">
          <Field>
            <Label>Meeting Link (required to confirm)</Label>
            <Input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://meet.google.com/..." />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => run(() => actions.onConfirm?.(meeting, meetingLink))}>Confirm Slot</Button>
            <Button variant="danger" onClick={() => setShowDenyInput((s) => !s)}>
              Deny
            </Button>
          </div>
          {showDenyInput && (
            <div className="space-y-2">
              <Field>
                <Label>Reason</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <Button variant="danger" onClick={() => run(() => actions.onDeny?.(meeting, reason))} disabled={!reason.trim()}>
                Confirm Denial
              </Button>
            </div>
          )}
        </div>
      )}

      {isAdmin && meeting.status === "confirmed" && (
        <div className="space-y-3 border-t-2 border-border-subtle pt-4">
          <Button variant="secondary" onClick={() => setShowReschedulePicker((s) => !s)}>
            Propose Reschedule
          </Button>
          {reschedulePicker}
        </div>
      )}

      {isAdmin && meeting.status === "reschedule_pending" && pendingByAdmin && (
        <p className="border-t-2 border-border-subtle pt-4 font-data-mono text-sm text-text-muted">Waiting on client to accept or deny.</p>
      )}

      {/* --- CLIENT actions --- */}
      {!isAdmin && meeting.status === "reschedule_pending" && pendingByAdmin && (
        <div className="space-y-3 border-t-2 border-border-subtle pt-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => run(() => actions.onAcceptReschedule?.(meeting))}>Accept Proposal</Button>
            <Button variant="danger" onClick={() => setShowDenyInput((s) => !s)}>
              Deny
            </Button>
          </div>
          {showDenyInput && (
            <div className="space-y-2">
              <Field>
                <Label>Reason</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <Button variant="danger" onClick={() => run(() => actions.onDenyReschedule?.(meeting, reason))} disabled={!reason.trim()}>
                Confirm Denial
              </Button>
            </div>
          )}
        </div>
      )}

      {!isAdmin && meeting.status === "reschedule_pending" && pendingByClient && (
        <p className="border-t-2 border-border-subtle pt-4 font-data-mono text-sm text-text-muted">Waiting on admin to confirm or deny.</p>
      )}

      {!isAdmin && meeting.status === "confirmed" && (
        <div className="space-y-3 border-t-2 border-border-subtle pt-4">
          <Button variant="secondary" onClick={() => setShowReschedulePicker((s) => !s)}>
            Propose Reschedule (Emergency)
          </Button>
          {reschedulePicker}
        </div>
      )}

      {!isAdmin && (meeting.status === "requested" || meeting.status === "confirmed") && (
        <div className="mt-4 border-t-2 border-border-subtle pt-4">
          <Button variant="ghost" onClick={() => run(() => actions.onCancel?.(meeting))}>
            Cancel Meeting
          </Button>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Admin: block off a time range                                      */
/* ------------------------------------------------------------------ */

export function BlockTimeModal({
  open,
  onClose,
  onCreate,
  minDate,
  fetchBusyRanges,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (start: Date, end: Date, reason: string) => Promise<void> | void;
  minDate: Date;
  fetchBusyRanges: FetchBusyRanges;
}) {
  const [date, setDate] = useState<Date | null>(null);
  const [startSlot, setStartSlot] = useState("");
  const [endSlot, setEndSlot] = useState("");
  const [reason, setReason] = useState("");
  const [busyRanges, setBusyRanges] = useState<TimeRange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(null);
    setStartSlot("");
    setEndSlot("");
    setReason("");
    setBusyRanges([]);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!date) return;
    fetchBusyRanges(date).then(setBusyRanges).catch(() => setBusyRanges([]));
  }, [date, fetchBusyRanges]);

  if (!open) return null;

  const canSubmit = !!date && !!startSlot && !!endSlot && slotToDate(date, endSlot) > slotToDate(date, startSlot);

  async function submit() {
    if (!date || !canSubmit) return;
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

  return (
    <Modal open={open} onClose={onClose} title="Block Time Off">
      {error && <Alert>{error}</Alert>}
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
      <Button onClick={submit} disabled={!canSubmit || submitting}>
        {submitting ? "Blocking..." : "Block This Time"}
      </Button>
    </Modal>
  );
}
