"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

const THEME_KEY = "garia_theme";

export function Header({ breadcrumbs }: { breadcrumbs: string[] }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(THEME_KEY, next ? "dark" : "light");
  }

  return (
    <header className="hidden md:flex fixed top-0 right-0 w-[calc(100%-16rem)] h-16 border-b-4 border-border-strong bg-bg-base justify-between items-center px-gutter z-40">
      <div className="flex items-center gap-8">
        <span className="font-headline-lg text-headline-lg font-black text-coral-red tracking-tighter uppercase">
          CLIENT PORTAL
        </span>
        <div className="flex items-center gap-4 border-l-2 border-border-strong pl-8">
          <span className="font-data-mono text-data-mono uppercase tracking-widest text-coral-red font-bold">
            {breadcrumbs.join(" / ")}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="font-data-mono text-data-mono uppercase tracking-widest text-text-muted hover:text-text-main transition-colors flex items-center gap-2"
          >
            {user?.full_name || "ACCOUNT_SYS"}
            <span className="material-symbols-outlined text-[16px]" data-icon="arrow_drop_down">arrow_drop_down</span>
          </button>

          {open && (
            <div className="absolute right-0 mt-4 w-64 bg-bg-base border-4 border-border-strong shadow-[8px_8px_0px_0px_var(--border-strong)] z-50">
              <div className="px-5 py-4 border-b-2 border-border-strong bg-bg-panel-alt">
                <p className="font-body-md font-bold uppercase tracking-wide text-text-main">{user?.full_name}</p>
                <p className="font-data-mono text-xs mt-1 truncate text-text-muted">{user?.email}</p>
              </div>
              <div className="py-2">
                <button
                  onClick={() => {
                    setOpen(false);
                    router.push(user?.role === "admin" ? "/admin/profile" : "/profile");
                  }}
                  className="block w-full px-5 py-3 text-left font-label-caps text-label-caps uppercase tracking-[0.1em] text-text-muted hover:bg-border-subtle hover:text-text-main transition-colors"
                >
                  PROFILE SETTINGS
                </button>
                <button
                  onClick={async () => {
                    setOpen(false);
                    await logout();
                    router.push("/login");
                  }}
                  className="block w-full px-5 py-3 text-left font-label-caps text-label-caps uppercase tracking-[0.1em] text-coral-red hover:bg-coral-red hover:text-white transition-colors"
                >
                  LOGOUT
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="w-10 h-10 rounded-full border-2 border-border-strong bg-bg-panel-alt flex items-center justify-center text-text-main shadow-[3px_3px_0px_0px_var(--border-strong)] transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0px_0px_var(--border-strong)] active:translate-x-px active:translate-y-px active:shadow-none"
        >
          <span className="material-symbols-outlined text-[18px]" data-icon={dark ? "light_mode" : "dark_mode"}>
            {dark ? "light_mode" : "dark_mode"}
          </span>
        </button>
      </div>
    </header>
  );
}
