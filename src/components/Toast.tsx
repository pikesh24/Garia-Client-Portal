"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <>
      {/* Sonner pins each toast's height to a value it measures once at mount
          (for its stack-collapse animation), before our custom fonts/classes
          have settled -- that stale measurement then gets reapplied on hover
          (data-expanded flips true), making the toast visibly snap/shrink.
          Since toasts aren't stacked here, forcing auto height is safe. */}
      <style>{`[data-sonner-toast] { height: auto !important; }`}</style>
      <SonnerToaster
        position="top-right"
        gap={12}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast:
              "w-full flex items-start gap-3 border-4 p-4 font-data-mono text-data-mono shadow-[6px_6px_0px_0px_var(--shadow-strong)] bg-bg-panel-alt border-border-strong text-text-main",
            icon: "shrink-0",
            content: "flex-1 min-w-0",
            title: "font-bold uppercase tracking-widest text-[12px]",
            description: "text-text-muted text-[11px] mt-1",
            success: "border-l-8 border-l-[var(--positive)]",
            error: "border-l-8 border-l-coral-red",
            warning: "border-l-8 border-l-[var(--warning)]",
            info: "border-l-8 border-l-brand-green",
            actionButton:
              "shrink-0 whitespace-nowrap bg-brand-green text-on-brand-green border-2 border-border-strong px-3 py-2 font-black text-[10px] uppercase tracking-widest hover:bg-text-main hover:text-bg-base transition-colors",
            closeButton:
              "bg-bg-panel-alt border-2 border-border-strong text-text-main hover:bg-coral-red hover:text-white hover:border-coral-red",
          },
        }}
        closeButton
      />
    </>
  );
}
