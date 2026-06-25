"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export function Header({ breadcrumbs }: { breadcrumbs: string[] }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <header className="hidden md:flex fixed top-0 right-0 w-[calc(100%-16rem)] h-16 border-b-4 border-bg-panel-dark bg-bg-base-dark justify-between items-center px-gutter z-40">
      <div className="flex items-center gap-8">
        <span className="font-headline-lg text-headline-lg font-black text-coral-red tracking-tighter uppercase">
          CLIENT PORTAL
        </span>
        <div className="flex items-center gap-4 border-l-2 border-bg-panel-dark pl-8">
          <span className="font-data-mono text-data-mono uppercase tracking-widest text-coral-red font-bold">
            {breadcrumbs.join(" / ")}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="relative">
          <button 
            onClick={() => setOpen((v) => !v)}
            className="font-data-mono text-data-mono uppercase tracking-widest text-secondary-fixed-dim hover:text-white transition-colors flex items-center gap-2"
          >
            {user?.full_name || "ACCOUNT_SYS"}
            <span className="material-symbols-outlined text-[16px]" data-icon="arrow_drop_down">arrow_drop_down</span>
          </button>
          
          {open && (
            <div className="absolute right-0 mt-4 w-64 bg-bg-base-dark border-4 border-bg-panel-dark shadow-[8px_8px_0px_0px_#E8E2D6] z-50">
              <div className="px-5 py-4 border-b-2 border-bg-panel-dark bg-bg-panel-alt-dark">
                <p className="font-body-md font-bold uppercase tracking-wide text-white">{user?.full_name}</p>
                <p className="font-data-mono text-xs mt-1 truncate text-secondary-fixed-dim">{user?.email}</p>
              </div>
              <div className="py-2">
                <button
                  onClick={() => {
                    setOpen(false);
                    router.push(user?.role === "admin" ? "/admin/profile" : "/profile");
                  }}
                  className="block w-full px-5 py-3 text-left font-label-caps text-label-caps uppercase tracking-[0.1em] text-secondary-fixed-dim hover:bg-white/5 hover:text-white transition-colors"
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
        <button className="text-secondary-fixed-dim hover:text-coral-red transition-colors active:scale-95">
          <span className="material-symbols-outlined" data-icon="dark_mode">dark_mode</span>
        </button>
      </div>
    </header>
  );
}
