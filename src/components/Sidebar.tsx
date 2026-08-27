"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useProject } from "@/lib/project-context";
import { useAuth } from "@/lib/auth";
import { useIsDark } from "@/lib/theme";

interface NavLink {
  href: string;
  label: string;
  icon: string;
  // Overrides the default href-prefix match, for links whose "active" page lives
  // somewhere the URL structure alone wouldn't imply (see base-features below).
  isActive?: (pathname: string) => boolean;
}

// The client-project-scoped feature page lives under /admin/users/[id]/projects/[id]/
// base-features — URL-wise that's nested under Client Accounts, but the page itself is
// a Features page, so it should light up "Features" in the sidebar, not "Client Accounts".
const BASE_FEATURES_PATTERN = /^\/admin\/users\/[^/]+\/projects\/[^/]+\/base-features/;

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
  {
    href: "/admin/users",
    label: "Client Accounts",
    icon: "folder_open",
    isActive: (p) => (p === "/admin/users" || p.startsWith("/admin/users/")) && !BASE_FEATURES_PATTERN.test(p),
  },
  { href: "/admin/developers", label: "Developers", icon: "engineering" },
  { href: "/admin/meetings", label: "Unified Calendar", icon: "settings" },
  { href: "/admin/tickets", label: "Support Tickets", icon: "receipt_long" },
  {
    href: "/admin/feature-requests",
    label: "Features",
    icon: "inventory_2",
    isActive: (p) => p === "/admin/feature-requests" || p.startsWith("/admin/feature-requests/") || BASE_FEATURES_PATTERN.test(p),
  },
  { href: "/admin/billing", label: "Billing", icon: "receipt_long" },
  { href: "/admin/maintenance", label: "Maintenance", icon: "settings" },
];

// Developers share the admin shell, but manage their own tickets via "My Queue" instead
// of the admin ticket board, and can't manage other developer accounts.
const adminLinksForDeveloper: NavLink[] = [
  { href: "/admin", label: "Global Dashboard", icon: "dashboard" },
  {
    href: "/admin/users",
    label: "Client Accounts",
    icon: "folder_open",
    isActive: (p) => (p === "/admin/users" || p.startsWith("/admin/users/")) && !BASE_FEATURES_PATTERN.test(p),
  },
  { href: "/admin/meetings", label: "Unified Calendar", icon: "settings" },
  { href: "/developer", label: "My Queue", icon: "assignment" },
  {
    href: "/admin/feature-requests",
    label: "Features",
    icon: "inventory_2",
    isActive: (p) => p === "/admin/feature-requests" || p.startsWith("/admin/feature-requests/") || BASE_FEATURES_PATTERN.test(p),
  },
  { href: "/admin/billing", label: "Billing", icon: "receipt_long" },
  { href: "/admin/maintenance", label: "Maintenance", icon: "settings" },
];

function ProjectSwitcher() {
  const { projects, currentProject, setCurrentProjectId } = useProject();
  const [open, setOpen] = useState(false);
  const dark = useIsDark();

  if (projects.length === 0) return null;

  const activeAccent = dark ? "bg-brand-green text-on-brand-green" : "bg-coral-red text-white";

  return (
    <div className="relative mb-6 z-50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 border-4 border-border-subtle bg-bg-panel-alt px-4 py-3 font-label-caps text-label-caps uppercase tracking-[0.1em] font-bold text-text-main transition-all hover:bg-border-subtle shadow-[4px_4px_0px_0px_var(--shadow-strong)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_var(--shadow-strong)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
      >
        <span className="truncate">{currentProject?.name ?? "Select Project"}</span>
        <span className="material-symbols-outlined text-[18px]" data-icon="arrow_drop_down">arrow_drop_down</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-full border-4 border-border-subtle shadow-[8px_8px_0px_0px_var(--shadow-strong)] z-50 bg-bg-base">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setCurrentProjectId(p.id);
                setOpen(false);
              }}
              className={
                p.id === currentProject?.id
                  ? `block w-full px-4 py-3 text-left font-label-caps text-[11px] uppercase tracking-[0.1em] font-bold ${activeAccent} border-b-2 border-border-subtle last:border-b-0`
                  : "block w-full px-4 py-3 text-left font-label-caps text-[11px] uppercase tracking-[0.1em] font-bold text-text-muted hover:bg-border-subtle hover:text-text-main transition-colors border-b-2 border-border-subtle last:border-b-0"
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

const CONTEXT_LABEL: Record<"client" | "admin" | "developer", (fullName: string) => string> = {
  admin: () => "Admin · Garia HQ",
  client: (fullName) => `Client · ${fullName}`,
  developer: (fullName) => `Developer · ${fullName}`,
};

export function Sidebar({ variant }: { variant: "client" | "admin" }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const dark = useIsDark();
  const role = user?.role ?? "client";
  const links = variant === "client" ? clientLinks : role === "developer" ? adminLinksForDeveloper : adminLinks;
  const contextLabel = CONTEXT_LABEL[variant === "client" ? "client" : role === "developer" ? "developer" : "admin"](user?.full_name ?? "…");

  const activeAccent = dark
    ? "bg-brand-green text-on-brand-green border-brand-green"
    : "bg-coral-red text-white border-coral-red";

  return (
    <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 border-r-4 border-border-subtle flex-col py-stack-md z-50 bg-bg-base">
      <div className="px-gutter mb-6 mt-2">
        <div className="flex items-center gap-4">
          <img src="/brand/garia-logo.png" alt="Garia Solutions" className="w-10 h-10 object-contain shrink-0" />
          <h1 className="font-display-xl font-black uppercase tracking-tight leading-none text-[22px]">
            <span className="block text-text-main">GARIA</span>
            <span className={`block ${dark ? "text-brand-green" : "text-coral-red"}`}>SOLUTIONS</span>
          </h1>
        </div>
      </div>

      <div className="px-gutter mb-6 pb-4 border-b-4 border-border-subtle">
        <span className="font-data-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-muted">{contextLabel}</span>
      </div>

      {variant === "client" && (
        <div className="px-gutter">
          <ProjectSwitcher />
        </div>
      )}

      <div className="flex-1 px-gutter space-y-3 overflow-y-auto">
        {links.map((link) => {
          // Root-level links ("/" and "/admin") should only light up on an exact match —
          // otherwise they'd stay highlighted on every nested route. Everything else should
          // also highlight for its own sub-routes (e.g. "/admin/users/17/projects"), unless
          // the link supplies its own isActive (e.g. Features owns the base-features page
          // even though it's nested under a Client Accounts URL).
          const isRoot = link.href === "/" || link.href === "/admin";
          const active = link.isActive
            ? link.isActive(pathname)
            : isRoot
              ? pathname === link.href
              : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                active
                  ? `w-full text-left font-label-caps text-[12px] tracking-[0.05em] uppercase font-black ${activeAccent} border-4 rounded-none py-3 px-4 flex items-center gap-3 shadow-[4px_4px_0px_0px_var(--shadow-strong)] transition-all translate-x-[-2px] translate-y-[-2px]`
                  : "w-full text-left font-label-caps text-[12px] tracking-[0.05em] uppercase font-bold text-text-muted border-4 border-transparent hover:border-border-subtle hover:bg-bg-panel-alt rounded-none py-3 px-4 flex items-center gap-3 hover:shadow-[4px_4px_0px_0px_var(--shadow-strong)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
              }
            >
              <span className="material-symbols-outlined text-[20px] shrink-0" data-icon={link.icon}>{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-auto px-gutter pt-6 border-t-4 border-border-subtle pb-8">
        {variant === "client" && (
          <button
            onClick={() => router.push("/tickets")}
            className={`w-full ${activeAccent} border-4 font-label-caps text-[14px] font-black py-3 uppercase shadow-[4px_4px_0px_0px_var(--shadow-strong)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_var(--shadow-strong)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all mb-6`}
          >
            NEW TICKET
          </button>
        )}
        <div className="flex justify-between gap-4">
          <button className="flex-1 flex justify-center items-center py-2 border-4 border-border-subtle bg-bg-panel-alt text-text-muted hover:text-text-main hover:bg-border-subtle shadow-[3px_3px_0px_0px_var(--shadow-strong)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_var(--shadow-strong)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all" title="DOCUMENTATION">
            <span className="material-symbols-outlined text-[20px]" data-icon="menu_book">menu_book</span>
          </button>
          <button className="flex-1 flex justify-center items-center py-2 border-4 border-border-subtle bg-bg-panel-alt text-text-muted hover:text-text-main hover:bg-border-subtle shadow-[3px_3px_0px_0px_var(--shadow-strong)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_var(--shadow-strong)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all" title="SUPPORT">
            <span className="material-symbols-outlined text-[20px]" data-icon="contact_support">contact_support</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
