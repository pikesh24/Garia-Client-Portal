"use client";

import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Card({ children, className = "", variant = "default" }: { children: ReactNode; className?: string; variant?: "default" | "alert" | "spotlight" | "table" }) {
  const base = "p-card-padding relative shadow-[8px_8px_0px_0px_var(--shadow-strong)] border-4 border-border-strong";
  const variants = {
    default: "bg-bg-base",
    alert: "bg-coral-red border-border-strong",
    spotlight: "bg-bg-panel border-border-strong shadow-[8px_8px_0px_0px_var(--brand-green)]",
    table: "bg-bg-panel-alt mt-8 shadow-[8px_8px_0px_0px_var(--shadow-strong)] p-0"
  };

  return (
    <div className={`${base} ${variants[variant]} flex flex-col ${className}`}>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: ReactNode, className?: string }) {
  return (
    <div className={`bg-bg-panel border-b-4 border-border-strong p-4 flex justify-between items-center ${className}`}>
      <h3 className="font-label-caps text-label-caps tracking-[0.1em] uppercase font-bold text-text-inverse">{children}</h3>
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`p-card-padding ${className}`}>{children}</div>;
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const base = "font-label-caps text-label-caps tracking-[0.1em] font-bold px-8 py-4 uppercase border-2 transition-all shadow-[4px_4px_0px_0px_var(--shadow-strong)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none active:translate-y-1 active:translate-x-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed";

  const variants: Record<ButtonVariant, string> = {
    primary: "bg-brand-green text-on-brand-green border-border-strong shadow-[4px_4px_0px_0px_var(--shadow-strong)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_var(--shadow-strong)]",
    secondary: "bg-bg-base text-text-main border-border-strong shadow-[4px_4px_0px_0px_var(--shadow-strong)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_var(--shadow-strong)] hover:bg-border-strong hover:text-bg-base",
    danger: "bg-bg-base text-coral-red border-coral-red shadow-[4px_4px_0px_0px_var(--coral-red)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_var(--coral-red)] hover:bg-coral-red hover:text-white",
    ghost: "border-transparent bg-transparent text-text-muted shadow-none hover:text-text-main hover:bg-border-subtle active:translate-y-0 active:translate-x-0 hover:translate-y-0 hover:translate-x-0 font-data-mono normal-case tracking-widest",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full h-[48px] border-2 border-border-strong bg-bg-panel-alt px-4 font-data-mono text-data-mono text-text-main placeholder:text-text-muted transition-all focus:border-text-main focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--border-strong)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full border-2 border-border-strong bg-bg-panel-alt px-4 py-3 font-data-mono text-data-mono text-text-main placeholder:text-text-muted transition-all focus:border-text-main focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--border-strong)] ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full h-[48px] border-2 border-border-strong bg-bg-panel-alt px-4 font-data-mono text-data-mono text-text-main transition-all focus:border-text-main focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--border-strong)] ${props.className ?? ""}`}
    />
  );
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <label className={`mb-2 block font-label-caps text-label-caps tracking-[0.1em] uppercase text-text-muted ${className}`}>{children}</label>;
}

export function Field({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mb-6 ${className}`}>{children}</div>;
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span
        className={`relative h-6 w-11 shrink-0 border-2 border-border-strong transition-colors ${checked ? "bg-brand-green" : "bg-bg-panel-alt"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 border border-border-strong bg-bg-base transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
      <span className="font-label-caps text-label-caps uppercase tracking-[0.1em] text-text-main">{label}</span>
    </button>
  );
}

const badgeColors: Record<string, string> = {
  positive: "bg-[#059669] border-border-strong text-white shadow-[3px_3px_0px_0px_var(--shadow-strong)]",
  warning: "bg-[#D97706] border-border-strong text-white shadow-[3px_3px_0px_0px_var(--shadow-strong)]",
  neutral: "bg-bg-panel border-border-strong text-text-inverse shadow-[3px_3px_0px_0px_var(--shadow-strong)]",
  danger: "bg-coral-red border-border-strong text-white shadow-[3px_3px_0px_0px_var(--shadow-strong)]",
};

const statusBadgeMap: Record<string, keyof typeof badgeColors> = {
  open: "warning",
  in_progress: "warning",
  out_of_scope: "neutral",
  resolved: "positive",
  requested: "warning",
  confirmed: "positive",
  reschedule_pending: "warning",
  denied: "danger",
  cancelled: "neutral",
  completed: "positive",
  under_review: "warning",
  declined: "danger",
  pending: "neutral",
  proof_submitted: "warning",
  approved: "positive",
  rejected: "danger",
  draft: "neutral",
  finalized: "positive",
  paid: "positive",
  active: "positive",
  inactive: "neutral",
}

export function StatusBadge({ status }: { status: string }) {
  const bucket = statusBadgeMap[status] ?? "neutral";
  return (
    <span
      className={`inline-block border-2 px-3 py-1 font-label-caps text-[10px] font-black uppercase tracking-widest transition-transform hover:-translate-y-0.5 ${badgeColors[bucket]}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export type ChipTone = "positive" | "warning" | "danger" | "neutral" | "brand" | "purple" | "blue" | "teal" | "orange" | "amber";

const chipTones: Record<ChipTone, string> = {
  positive: "bg-positive border-positive text-text-inverse",
  warning: "bg-warning border-warning text-text-inverse",
  danger: "bg-coral-red border-coral-red text-text-inverse",
  neutral: "bg-text-muted border-text-muted text-text-inverse",
  brand: "bg-brand-green border-brand-green text-on-brand-green",
  purple: "bg-[#7c3aed] border-[#7c3aed] text-white",
  blue: "bg-[#2563d6] border-[#2563d6] text-white",
  teal: "bg-[#0d9488] border-[#0d9488] text-white",
  orange: "bg-[#FF7A1A] border-[#FF7A1A] text-[#2A2E33]",
  amber: "bg-[#FFC800] border-[#FFC800] text-[#2A2E33]",
};

export function Chip({ tone = "neutral", children }: { tone?: ChipTone; children: ReactNode }) {
  return (
    <span className={`inline-block border px-2 py-1 font-data-mono text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${chipTones[tone]}`}>
      {children}
    </span>
  );
}

export function BrandWatermark() {
  return (
    <div className="fixed inset-0 md:left-64 pointer-events-none z-0 overflow-hidden flex items-center justify-center">
      <div className="brand-watermark w-[26vw] h-[26vw] max-w-[380px] max-h-[380px] opacity-[0.05]" />
    </div>
  );
}

export function Alert({ kind = "error", children, className = "" }: { kind?: "error" | "warning"; children: ReactNode; className?: string }) {
  const isWarning = kind === "warning";
  const bg = isWarning ? "bg-bg-panel" : "bg-bg-panel-alt";
  const text = isWarning ? "text-text-inverse" : "text-text-main";

  return (
    <div className={`mb-8 border-l-4 border-coral-red p-4 font-data-mono text-data-mono ${bg} ${text} ${className}`}>
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-12 border-b-4 border-border-strong pb-8 flex flex-col md:flex-row md:items-end justify-between">
      <div>
        <h2 className="font-display-2xl text-display-2xl font-black uppercase text-text-main mb-4 leading-none">
          {title.split(' ').map((word, i) => <span key={i}>{word}<br/></span>)}
        </h2>
      </div>
      {action && <div className="mt-6 md:mt-0">{action}</div>}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center bg-bg-panel-alt border-4 border-dashed border-border-strong">
      <div className="mb-6">
        <span className="material-symbols-outlined text-4xl text-text-muted" data-icon="warning">warning</span>
      </div>
      <p className="font-data-mono text-data-mono text-text-muted uppercase tracking-widest">{children}</p>
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full text-left border-collapse">{children}</table>
    </div>
  );
}

export function Th({ children }: { children?: ReactNode }) {
  return (
    <th className="pb-2 font-normal tracking-widest text-xs font-data-mono text-data-mono text-text-muted uppercase border-b-2 border-border-strong">
      {children}
    </th>
  );
}

export function Td({ children, className = "", colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={`py-2 text-text-main border-b border-border-subtle font-data-mono text-data-mono ${className}`}>{children}</td>;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div
        className="w-full max-w-2xl border-4 border-border-strong bg-bg-panel-alt shadow-[16px_16px_0px_0px_var(--shadow-strong)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-bg-panel border-b-4 border-border-strong p-4 flex justify-between items-center">
          <h3 className="font-label-caps text-label-caps tracking-[0.1em] uppercase font-bold text-text-inverse">{title}</h3>
          <button onClick={onClose} className="text-text-inverse hover:text-coral-red transition-colors">
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>
        <div className="p-card-padding">{children}</div>
      </div>
    </div>
  );
}
