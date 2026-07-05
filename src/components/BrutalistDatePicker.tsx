"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface BrutalistDatePickerProps {
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
}

export function BrutalistDatePicker({
  value,
  onChange,
  required,
  className = "",
  id,
  placeholder = "YYYY-MM-DD",
}: BrutalistDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });

  // Initialize view date to the selected value or today
  const initialDate = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewDate, setViewDate] = useState(initialDate);

  // The popup is portaled to document.body (see below) so it can't be clipped by an
  // ancestor's overflow-hidden (e.g. the shared Card component) — so its position has
  // to be computed from the trigger's viewport rect instead of relying on CSS `absolute`.
  useEffect(() => {
    if (!isOpen) return;

    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPopupPos({ top: rect.bottom + 8, left: rect.left });
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  // Close when clicking outside (either the trigger or the portaled popup)
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
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        ref={triggerRef}
        className="relative group cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="absolute inset-0 bg-border-strong translate-x-[6px] translate-y-[6px] transition-transform group-hover:translate-x-[4px] group-hover:translate-y-[4px]"></div>
        <div className={`relative flex items-center justify-between w-full p-card-padding border-4 border-border-strong font-data-mono text-text-main bg-bg-base outline-none focus:ring-4 focus:ring-brand-green/30 focus:border-brand-green transition-colors`}>
          <span>{value ? value : <span className="text-text-muted">{placeholder}</span>}</span>
          <span className="material-symbols-outlined text-text-muted">calendar_today</span>
        </div>
      </div>
      {/* Hidden input for form submission if required */}
      <input type="text" id={id} required={required} value={value} readOnly className="sr-only" />

      {isOpen && typeof document !== "undefined" && createPortal(
        <div
          ref={popupRef}
          className="fixed z-50 p-4 w-72 bg-bg-base border-4 border-border-strong shadow-[8px_8px_0px_0px_var(--border-strong)]"
          style={{ top: popupPos.top, left: popupPos.left }}
        >
          <div className="flex justify-between items-center mb-4">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 hover:bg-bg-panel-alt border-2 border-transparent hover:border-border-strong transition-colors"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <span className="font-headline-lg font-black uppercase tracking-widest text-sm">
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

          <div className="grid grid-cols-7 gap-1 text-center mb-2">
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
        </div>,
        document.body
      )}
    </div>
  );
}
