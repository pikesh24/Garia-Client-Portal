"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useProject } from "@/lib/project-context";
import { useAuth } from "@/lib/auth";

interface NavLink {
  href: string;
  label: string;
  icon: string;
}

const clientLinks: NavLink[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/feature-requests", label: "Feature Requests", icon: "folder_open" },
  { href: "/project-features", label: "Base Project", icon: "inventory_2" },
  { href: "/tickets", label: "Support Tickets", icon: "receipt_long" },
  { href: "/billing", label: "Billing", icon: "payments" },
  { href: "/meetings", label: "Meetings Calendar", icon: "settings" },
  { href: "/maintenance", label: "Maintenance", icon: "settings" },
];

const adminLinks: NavLink[] = [
  { href: "/admin", label: "Global Dashboard", icon: "dashboard" },
  { href: "/admin/users", label: "Client Accounts", icon: "folder_open" },
  { href: "/admin/meetings", label: "Unified Calendar", icon: "settings" },
  { href: "/admin/tickets", label: "Support Tickets", icon: "receipt_long" },
  { href: "/admin/feature-requests", label: "Features", icon: "inventory_2" },
  { href: "/admin/billing", label: "Billing", icon: "receipt_long" },
  { href: "/admin/maintenance", label: "Maintenance", icon: "settings" },
];

function ProjectSwitcher() {
  const { projects, currentProject, setCurrentProjectId } = useProject();
  const [open, setOpen] = useState(false);

  if (projects.length === 0) return null;

  return (
    <div className="relative mb-6 z-50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 border-4 border-white/10 bg-white/5 px-4 py-3 font-label-caps text-label-caps uppercase tracking-[0.1em] font-bold text-white transition-all hover:bg-white/10 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
      >
        <span className="truncate">{currentProject?.name ?? "Select Project"}</span>
        <span className="material-symbols-outlined text-[18px]" data-icon="arrow_drop_down">arrow_drop_down</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-full border-4 border-white/10 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)] z-50 bg-[#12171d]">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setCurrentProjectId(p.id);
                setOpen(false);
              }}
              className={
                p.id === currentProject?.id
                  ? "block w-full px-4 py-3 text-left font-label-caps text-[11px] uppercase tracking-[0.1em] font-bold bg-brand-green text-on-brand-green border-b-2 border-white/10 last:border-b-0"
                  : "block w-full px-4 py-3 text-left font-label-caps text-[11px] uppercase tracking-[0.1em] font-bold text-white/50 hover:bg-white/5 hover:text-white transition-colors border-b-2 border-white/10 last:border-b-0"
              }
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ variant }: { variant: "client" | "admin" }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const links = variant === "client" ? clientLinks : adminLinks;
  const contextLabel = variant === "admin" ? "Admin · Garia HQ" : `Client · ${user?.full_name ?? "…"}`;

  return (
    <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 border-r-4 border-white/10 flex-col py-stack-md z-50 bg-[#12171d]">
      <div className="px-gutter mb-6 mt-2">
        <div className="flex items-center gap-4">
          <img src="/brand/garia-logo.png" alt="Garia Solutions" className="w-10 h-10 object-contain shrink-0" />
          <h1 className="font-display-xl font-black uppercase tracking-tight leading-none text-[22px]">
            <span className="block text-white">GARIA</span>
            <span className="block text-brand-green">SOLUTIONS</span>
          </h1>
        </div>
      </div>

      <div className="px-gutter mb-6 pb-4 border-b-4 border-white/10">
        <span className="font-data-mono text-[11px] uppercase tracking-[0.15em] font-bold text-white/40">{contextLabel}</span>
      </div>

      {variant === "client" && (
        <div className="px-gutter">
          <ProjectSwitcher />
        </div>
      )}

      <div className="flex-1 px-gutter space-y-3 overflow-y-auto">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                active
                  ? "w-full text-left font-label-caps text-[12px] tracking-[0.05em] uppercase font-black bg-brand-green text-on-brand-green border-4 border-brand-green rounded-none py-3 px-4 flex items-center gap-3 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] transition-all translate-x-[-2px] translate-y-[-2px]"
                  : "w-full text-left font-label-caps text-[12px] tracking-[0.05em] uppercase font-bold text-white/70 border-4 border-transparent hover:border-white/10 hover:bg-white/5 rounded-none py-3 px-4 flex items-center gap-3 hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
              }
            >
              <span className="material-symbols-outlined text-[20px] shrink-0" data-icon={link.icon}>{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-auto px-gutter pt-6 border-t-4 border-white/10 pb-8">
        {variant === "client" && (
          <button
            onClick={() => router.push("/tickets")}
            className="w-full bg-brand-green text-on-brand-green border-4 border-brand-green font-label-caps text-[14px] font-black py-3 uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,0.4)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.4)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all mb-6"
          >
            NEW TICKET
          </button>
        )}
        <div className="flex justify-between gap-4">
          <button className="flex-1 flex justify-center items-center py-2 border-4 border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 shadow-[3px_3px_0px_0px_rgba(255,255,255,0.1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all" title="DOCUMENTATION">
            <span className="material-symbols-outlined text-[20px]" data-icon="menu_book">menu_book</span>
          </button>
          <button className="flex-1 flex justify-center items-center py-2 border-4 border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 shadow-[3px_3px_0px_0px_rgba(255,255,255,0.1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all" title="SUPPORT">
            <span className="material-symbols-outlined text-[20px]" data-icon="contact_support">contact_support</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
