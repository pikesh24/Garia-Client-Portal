"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      gap={12}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "w-full flex items-start gap-3 border-4 p-4 font-data-mono text-data-mono shadow-[6px_6px_0px_0px_var(--shadow-strong)] bg-bg-panel-alt border-border-strong text-text-main",
          title: "font-bold uppercase tracking-widest text-[12px]",
          description: "text-text-muted text-[11px] mt-1",
          success: "border-l-8 border-l-[var(--positive)]",
          error: "border-l-8 border-l-coral-red",
          warning: "border-l-8 border-l-[var(--warning)]",
          info: "border-l-8 border-l-brand-green",
          closeButton:
            "bg-bg-panel-alt border-2 border-border-strong text-text-main hover:bg-coral-red hover:text-white hover:border-coral-red",
        },
      }}
      closeButton
    />
  );
}
