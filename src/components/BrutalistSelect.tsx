"use client";

import { useEffect, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export function BrutalistSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  options: SelectOption[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = options.find((o) => String(o.value) === String(value));

  return (
    <div className="relative w-full" ref={ref}>
      <div
        onClick={() => setOpen(!open)}
        className={`w-full bg-bg-panel-alt border-4 border-border-strong p-4 font-bold text-lg cursor-pointer shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)] flex justify-between items-center transition-colors hover:border-text-main ${open ? "border-text-main" : ""}`}
      >
        <span className={value ? "text-text-main" : "text-text-muted"}>
          {selected ? selected.label : placeholder}
        </span>
        <span className={`material-symbols-outlined font-black transition-transform ${open ? "rotate-180" : ""}`}>
          arrow_drop_down
        </span>
      </div>
      {open && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-bg-base border-4 border-border-strong shadow-[8px_8px_0px_0px_var(--border-strong)] z-50 max-h-64 overflow-y-auto custom-scrollbar flex flex-col">
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`p-4 font-bold cursor-pointer border-b-2 border-border-strong/30 last:border-b-0 hover:bg-text-main hover:text-white transition-colors ${String(value) === String(opt.value) ? "bg-text-main/10 text-text-main" : "text-text-main"}`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
