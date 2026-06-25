"use client";

import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Card({ children, className = "", variant = "default" }: { children: ReactNode; className?: string; variant?: "default" | "alert" | "spotlight" | "table" }) {
  const base = "p-card-padding relative overflow-hidden shadow-[8px_8px_0px_0px_#E8E2D6] border-4 border-bg-panel-dark";
  const variants = {
    default: "bg-bg-base-dark",
    alert: "bg-coral-red border-bg-panel-dark",
    spotlight: "bg-bg-panel-dark border-bg-panel-dark shadow-[8px_8px_0px_0px_#ED4A3F]",
    table: "bg-bg-panel-alt-dark mt-8 shadow-[8px_8px_0px_0px_#E8E2D6] p-0"
  };

  return (
    <div className={`${base} ${variants[variant]} flex flex-col ${className}`}>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: ReactNode, className?: string }) {
  return (
    <div className={`bg-bg-panel-dark border-b-4 border-bg-panel-dark p-4 flex justify-between items-center ${className}`}>
      <h3 className="font-label-caps text-label-caps tracking-[0.1em] uppercase font-bold text-bg-base-dark">{children}</h3>
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
  const base = "font-label-caps text-label-caps tracking-[0.1em] font-bold px-8 py-4 uppercase border-2 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none active:translate-y-1 active:translate-x-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-black text-coral-red border-black active:bg-white active:text-black",
    secondary: "bg-bg-panel-dark text-bg-base-dark border-bg-panel-dark shadow-[4px_4px_0px_0px_#ED4A3F] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#ED4A3F]",
    danger: "bg-coral-red text-white border-bg-panel-dark shadow-[4px_4px_0px_0px_#E8E2D6]",
    ghost: "border-transparent bg-transparent text-secondary-fixed-dim shadow-none hover:text-white hover:bg-white/5 active:translate-y-0 active:translate-x-0 hover:translate-y-0 hover:translate-x-0 font-data-mono normal-case tracking-widest",
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
      className={`w-full border-2 border-bg-panel-dark bg-bg-panel-alt-dark px-4 py-3 font-data-mono text-data-mono text-white placeholder:text-secondary-fixed-dim transition-all focus:border-coral-red focus:outline-none focus:shadow-[4px_4px_0px_0px_#ED4A3F] ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full border-2 border-bg-panel-dark bg-bg-panel-alt-dark px-4 py-3 font-data-mono text-data-mono text-white placeholder:text-secondary-fixed-dim transition-all focus:border-coral-red focus:outline-none focus:shadow-[4px_4px_0px_0px_#ED4A3F] ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full border-2 border-bg-panel-dark bg-bg-panel-alt-dark px-4 py-3 font-data-mono text-data-mono text-white transition-all focus:border-coral-red focus:outline-none focus:shadow-[4px_4px_0px_0px_#ED4A3F] ${props.className ?? ""}`}
    />
  );
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <label className={`mb-2 block font-label-caps text-label-caps tracking-[0.1em] uppercase text-secondary-fixed-dim ${className}`}>{children}</label>;
}

export function Field({ children }: { children: ReactNode }) {
  return <div className="mb-6">{children}</div>;
}

const badgeColors: Record<string, string> = {
  positive: "border-[#00FF00] text-[#00FF00] hover:bg-[#00FF00] hover:text-black",
  warning: "border-[#ffc107] text-[#ffc107] hover:bg-[#ffc107] hover:text-black",
  neutral: "border-secondary-fixed-dim text-secondary-fixed-dim hover:bg-secondary-fixed-dim hover:text-black",
  danger: "border-coral-red text-coral-red hover:bg-coral-red hover:text-white",
};

const statusBadgeMap: Record<string, keyof typeof badgeColors> = {
  open: "warning",
  in_progress: "warning",
  out_of_scope: "neutral",
  resolved: "positive",
  requested: "warning",
  confirmed: "positive",
  rescheduled: "warning",
  cancelled: "neutral",
  completed: "positive",
  initiated: "neutral",
  clarification_requested: "warning",
  quoted: "warning",
  accepted: "positive",
  pending: "neutral",
  proof_submitted: "warning",
  approved: "positive",
  rejected: "danger",
  draft: "neutral",
  finalized: "positive",
  paid: "positive",
}

export function StatusBadge({ status }: { status: string }) {
  const bucket = statusBadgeMap[status] ?? "neutral";
  return (
    <span
      className={`inline-block border px-2 py-1 font-data-mono text-[10px] uppercase tracking-wider transition-colors group-hover:bg-opacity-100 ${badgeColors[bucket]} group-hover:bg-current group-hover:text-black`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "warning"; children: ReactNode }) {
  const isWarning = kind === "warning";
  const bg = isWarning ? "bg-black" : "bg-bg-panel-alt-dark";
  const text = isWarning ? "text-white" : "text-white";
  
  return (
    <div className={`mb-8 border-l-4 border-black p-4 font-data-mono text-data-mono ${bg} ${text}`}>
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-12 border-b-4 border-bg-panel-dark pb-8 flex flex-col md:flex-row md:items-end justify-between">
      <div>
        <h2 className="font-display-2xl text-display-2xl font-black uppercase text-bg-panel-dark mb-4 leading-none">
          {title.split(' ').map((word, i) => <span key={i}>{word}<br/></span>)}
        </h2>
      </div>
      {action && <div className="mt-6 md:mt-0">{action}</div>}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center bg-bg-panel-alt-dark border-4 border-dashed border-bg-panel-dark">
      <div className="mb-6">
        <span className="material-symbols-outlined text-4xl text-secondary-fixed-dim" data-icon="warning">warning</span>
      </div>
      <p className="font-data-mono text-data-mono text-secondary-fixed-dim uppercase tracking-widest">{children}</p>
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
    <th className="pb-2 font-normal tracking-widest text-xs font-data-mono text-data-mono text-secondary-fixed-dim uppercase border-b-2 border-bg-panel-dark">
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`py-2 text-white border-b border-bg-panel-dark/30 font-data-mono text-data-mono ${className}`}>{children}</td>;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-base-dark/90 p-6" onClick={onClose}>
      <div
        className="w-full max-w-2xl border-4 border-bg-panel-dark bg-bg-panel-alt-dark shadow-[16px_16px_0px_0px_#E8E2D6]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-bg-panel-dark border-b-4 border-bg-panel-dark p-4 flex justify-between items-center">
          <h3 className="font-label-caps text-label-caps tracking-[0.1em] uppercase font-bold text-bg-base-dark">{title}</h3>
          <button onClick={onClose} className="text-bg-base-dark hover:text-coral-red transition-colors">
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>
        <div className="p-card-padding">{children}</div>
      </div>
    </div>
  );
}
