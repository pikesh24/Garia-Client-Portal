"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const normalized = typeof options === "string" ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      setState({ ...normalized, resolve });
    });
  }, []);

  const close = (result: boolean) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-6"
          onClick={() => close(false)}
        >
          <div
            className="w-full max-w-md border-4 border-border-strong bg-bg-panel-alt shadow-[16px_16px_0px_0px_var(--shadow-strong)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`border-b-4 border-border-strong p-4 flex items-center gap-3 ${
                state.danger ? "bg-coral-red" : "bg-bg-panel"
              }`}
            >
              <span className="material-symbols-outlined text-2xl text-white">
                {state.danger ? "warning" : "help"}
              </span>
              <h3 className="font-label-caps text-label-caps tracking-[0.1em] uppercase font-bold text-white">
                {state.title ?? (state.danger ? "Confirm Deletion" : "Confirm Action")}
              </h3>
            </div>
            <div className="p-card-padding">
              <p className="font-data-mono text-data-mono text-text-main leading-relaxed mb-8">
                {state.message}
              </p>
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => close(false)}
                  className="font-label-caps text-label-caps tracking-[0.1em] font-bold px-6 py-3 uppercase border-2 border-border-strong bg-bg-panel text-text-inverse shadow-[4px_4px_0px_0px_var(--brand-green)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_var(--brand-green)] transition-all"
                >
                  {state.cancelLabel ?? "Cancel"}
                </button>
                <button
                  onClick={() => close(true)}
                  className={`font-label-caps text-label-caps tracking-[0.1em] font-bold px-6 py-3 uppercase border-2 transition-all shadow-[4px_4px_0px_0px_var(--shadow-strong)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none ${
                    state.danger
                      ? "bg-coral-red text-white border-coral-red"
                      : "bg-brand-green text-on-brand-green border-border-strong"
                  }`}
                >
                  {state.confirmLabel ?? (state.danger ? "Delete" : "Confirm")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): (options: ConfirmOptions | string) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx.confirm;
}
