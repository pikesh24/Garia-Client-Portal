"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";

interface BrutalistDatePickerProps {
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
}

const MARGIN = 8;

export function BrutalistDatePicker({
  value,
  onChange,
  required,
  className = "",
  id,
  placeholder = "YYYY-MM-DD",
}: BrutalistDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Computed against the trigger's and popup's *actual* rendered rects on open, so the
  // calendar always lands fully inside the viewport — no guessed dimensions, no overflow.
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({ visibility: "hidden" });
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Initialize view date to the selected value or today
  const initialDate = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewDate, setViewDate] = useState(initialDate);

  // Close when clicking outside (either the trigger or the popup)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Runs synchronously after the (still-hidden) popup mounts but before paint, so we can
  // measure its real size and reposition it with zero visible flicker.
  useLayoutEffect(() => {
    if (!isOpen || !containerRef.current || !popupRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const popupRect = popupRef.current.getBoundingClientRect();
    const popupW = popupRect.width;
    const popupH = popupRect.height;

    // Prefer opening to the right of the field, top-aligned with it.
    let left = containerRect.right + MARGIN;
    let top = containerRect.top;

    if (left + popupW > window.innerWidth - MARGIN) {
      // No room on the right — try the left side of the field instead.
      const leftSide = containerRect.left - MARGIN - popupW;
      if (leftSide >= MARGIN) {
        left = leftSide;
      } else {
        // No room on either side — fall back to a normal dropdown below the field.
        left = containerRect.left;
        top = containerRect.bottom + MARGIN;
      }
    }

    // Clamp vertically so it's always fully on-screen, regardless of which branch above ran.
    top = Math.min(top, window.innerHeight - MARGIN - popupH);
    top = Math.max(top, MARGIN);
    left = Math.min(left, window.innerWidth - MARGIN - popupW);
    left = Math.max(left, MARGIN);

    // This app renders at `zoom: 0.8` (see globals.css). getBoundingClientRect() already
    // reads back real, post-zoom viewport coordinates, but inline pixel styles we write get
    // scaled by that same zoom on render — so left/top need to be un-scaled here, or the
    // popup lands at 0.8x its intended position (confirmed via direct measurement).
    const zoom = parseFloat(getComputedStyle(document.documentElement).zoom || "1") || 1;

    setPopupStyle({ position: "fixed", top: top / zoom, left: left / zoom, visibility: "visible" });
  }, [isOpen]);

  const handleDayClick = (day: number) => {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    // Format to YYYY-MM-DD correctly, padding single digits
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const date = String(d.getDate()).padStart(2, "0");
    onChange(`${year}-${month}-${date}`);
    setIsOpen(false);
  };

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  // Calendar logic
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null); // Empty slots for padding
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <div
        className={`flex items-center justify-between w-full h-[48px] border-2 border-border-strong bg-bg-panel-alt px-4 font-data-mono text-data-mono text-text-main transition-all cursor-pointer outline-none ${
          isOpen
            ? "border-text-main shadow-[4px_4px_0px_0px_var(--border-strong)]"
            : "hover:border-text-main"
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{value ? value : <span className="text-text-muted">{placeholder}</span>}</span>
        <span className="material-symbols-outlined text-text-muted select-none">calendar_today</span>
      </div>
      {/* Hidden input for form submission if required */}
      <input type="text" id={id} required={required} value={value} readOnly className="sr-only" />

      {isOpen && (
        <div
          ref={popupRef}
          style={popupStyle}
          className="z-50 p-4 w-72 bg-bg-base border-4 border-border-strong shadow-[8px_8px_0px_0px_var(--border-strong)]"
        >
          <div className="flex justify-between items-center mb-4">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 hover:bg-bg-panel-alt border-2 border-transparent hover:border-border-strong transition-colors"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <span className="font-headline-lg font-black uppercase tracking-widest text-sm select-none">
              {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 hover:bg-bg-panel-alt border-2 border-transparent hover:border-border-strong transition-colors"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-2 select-none">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <div key={day} className="font-data-mono text-[10px] text-text-muted uppercase font-bold">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {days.map((day, index) => {
              if (day === null) return <div key={`empty-${index}`} />;

              const currentDateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isSelected = value === currentDateStr;
              const isToday = new Date().toISOString().split('T')[0] === currentDateStr;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={(e) => { e.preventDefault(); handleDayClick(day); }}
                  className={`
                    w-8 h-8 flex items-center justify-center font-data-mono text-sm border-2 transition-colors
                    ${isSelected
                      ? "bg-brand-green border-border-strong text-on-brand-green font-bold shadow-[2px_2px_0px_0px_var(--border-strong)]"
                      : isToday
                        ? "border-text-muted text-text-main font-bold"
                        : "border-transparent text-text-main hover:border-border-strong hover:bg-bg-panel-alt"
                    }
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
