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
  searchable = false,
}: {
  value: string;
  onChange: (val: string) => void;
  options: SelectOption[];
  placeholder: string;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
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

  useEffect(() => {
    if (open) {
      setSearch("");
    }
  }, [open]);

  const selected = options.find((o) => String(o.value) === String(value));
  
  const filteredOptions = searchable && search 
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div className="relative w-full" ref={ref}>
      <div
        onClick={() => setOpen(!open)}
        className={`w-full bg-bg-panel-alt border-4 border-border-strong p-4 font-bold text-lg cursor-pointer shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)] flex justify-between items-center transition-colors hover:border-text-main ${open ? "border-text-main" : ""}`}
      >
        <span className={value ? "text-text-main truncate pr-4" : "text-text-muted truncate pr-4"}>
          {selected ? selected.label : placeholder}
        </span>
        <span className={`material-symbols-outlined font-black transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`}>
          arrow_drop_down
        </span>
      </div>
      {open && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-bg-base border-4 border-border-strong shadow-[8px_8px_0px_0px_var(--shadow-strong)] z-50 max-h-80 overflow-y-auto custom-scrollbar flex flex-col">
          {searchable && (
            <div className="sticky top-0 p-3 border-b-4 border-border-strong bg-bg-base z-10">
              <input
                type="text"
                autoFocus
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-bg-panel-alt border-2 border-border-strong p-2 font-data-mono text-sm focus:outline-none focus:border-text-main placeholder:text-text-muted/60"
              />
            </div>
          )}
          {filteredOptions.length === 0 ? (
            <div className="p-4 font-data-mono text-text-muted text-sm text-center">
              No results found.
            </div>
          ) : (
            filteredOptions.map((opt) => (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`p-4 font-bold cursor-pointer border-b-2 border-border-strong/30 last:border-b-0 hover:bg-text-main hover:text-white transition-colors truncate ${String(value) === String(opt.value) ? "bg-text-main/10 text-text-main" : "text-text-main"}`}
              >
                {opt.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
