"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useProject } from "@/lib/project-context";

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
    <div className="relative mb-8">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 border-2 border-border-strong bg-bg-base px-4 py-3 font-label-caps text-label-caps uppercase tracking-[0.1em] font-bold text-text-main shadow-[3px_3px_0px_0px_var(--border-strong)] transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0px_0px_var(--border-strong)]"
      >
        <span className="truncate">{currentProject?.name ?? "Select Project"}</span>
        <span className="material-symbols-outlined text-[16px]" data-icon="arrow_drop_down">arrow_drop_down</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-full bg-bg-base border-4 border-border-strong shadow-[8px_8px_0px_0px_var(--border-strong)] z-50">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setCurrentProjectId(p.id);
                setOpen(false);
              }}
              className={
                p.id === currentProject?.id
                  ? "block w-full px-5 py-3 text-left font-label-caps text-label-caps uppercase tracking-[0.1em] bg-coral-red text-white"
                  : "block w-full px-5 py-3 text-left font-label-caps text-label-caps uppercase tracking-[0.1em] text-text-muted hover:bg-border-subtle hover:text-text-main transition-colors"
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
  const links = variant === "client" ? clientLinks : adminLinks;

  return (
    <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 border-r-4 border-border-strong bg-bg-panel-alt flex-col py-stack-lg z-50">
      <div className="px-gutter mb-12">
        <h1 className="font-display-xl text-headline-lg font-black text-coral-red tracking-tighter uppercase break-words leading-none mb-2">GARIA<br/>SOLUTIONS</h1>
      </div>

      {variant === "client" && (
        <div className="px-gutter">
          <ProjectSwitcher />
        </div>
      )}

      <div className="flex-1 px-gutter space-y-4 overflow-y-auto">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                active
                  ? "w-full text-left font-label-caps text-label-caps tracking-[0.1em] uppercase font-bold bg-coral-red text-white translate-x-1 shadow-[4px_4px_0px_0px_var(--border-strong)] py-3 px-4 flex items-center gap-3 transition-all active:translate-x-2 active:translate-y-1 active:shadow-[0px_0px_0px_0px_var(--border-strong)]"
                  : "w-full text-left font-label-caps text-label-caps tracking-[0.1em] uppercase font-bold text-text-muted hover:text-text-main hover:bg-border-subtle py-3 px-4 flex items-center gap-3 transition-all duration-150 border-l-2 border-transparent hover:border-border-strong"
              }
            >
              <span className="material-symbols-outlined" data-icon={link.icon}>{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </div>

      <div className="px-gutter mt-auto pt-8 border-t-2 border-border-strong mx-4">
        {variant === "client" && (
          <button
            onClick={() => router.push("/tickets")}
            className="w-full bg-bg-panel text-text-inverse border-2 border-border-strong font-label-caps text-label-caps font-bold py-3 uppercase shadow-[4px_4px_0px_0px_#ED4A3F] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#ED4A3F] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
          >
            NEW TICKET
          </button>
        )}
        <div className="flex justify-between mt-8 text-text-muted">
          <button className="hover:text-coral-red transition-colors" title="DOCUMENTATION">
            <span className="material-symbols-outlined" data-icon="menu_book">menu_book</span>
          </button>
          <button className="hover:text-coral-red transition-colors" title="SUPPORT">
            <span className="material-symbols-outlined" data-icon="contact_support">contact_support</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
