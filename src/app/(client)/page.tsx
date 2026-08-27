"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useProject } from "@/lib/project-context";
import { FeatureRequest, Invoice, MaintenanceRecord, Meeting, ProjectFeatures, Ticket } from "@/lib/types";
import { Chip, ChipTone, Modal, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/date";
import { useWsEvent } from "@/components/WebSocketProvider";

type Urgency = "critical" | "high" | "medium" | "low";

interface AttentionItem {
  key: string;
  urgency: Urgency;
  label: string;
  meta: string;
  action: string;
  href: string;
}

interface ModalItem {
  tagLabel: string;
  tagTone: ChipTone;
  title: string;
  meta: string;
  badgeStatus?: string;
}

interface ModalConfig {
  title: string;
  subtitle: string;
  footerLabel: string;
  footerHref: string | null;
  items: ModalItem[];
}

const URGENCY_RANK: Record<Urgency, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const URGENCY_TONE: Record<Urgency, ChipTone> = { critical: "danger", high: "orange", medium: "amber", low: "neutral" };

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const hours = Math.max(0, Math.floor(diffMs / 36e5));
  if (hours < 1) return "<1H";
  if (hours < 24) return `${hours}H`;
  return `${Math.floor(hours / 24)}D`;
}

function todayStr(): string {
  const d = new Date();
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const day = String(d.getDate()).padStart(2, "0");
  return `${weekday} · ${month} ${day} ${d.getFullYear()}`;
}

function formatINR(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function ClientDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { currentProject, loading: projectLoading, projects } = useProject();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [featureRequests, setFeatureRequests] = useState<FeatureRequest[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalKey, setModalKey] = useState<string | null>(null);
  const ticketsVersion = useWsEvent("tickets");
  const meetingsVersion = useWsEvent("meetings");
  const featureRequestsVersion = useWsEvent("feature_requests");
  const invoicesVersion = useWsEvent("invoices");
  const maintenanceVersion = useWsEvent("maintenance");

  const load = useCallback(
    (showSpinner: boolean) => {
      if (!currentProject) return;
      if (showSpinner) setLoading(true);
      Promise.all([
        apiRequest<Ticket[]>(`/api/projects/${currentProject.id}/tickets`),
        apiRequest<Meeting[]>(`/api/projects/${currentProject.id}/meetings`),
        apiRequest<ProjectFeatures>(`/api/projects/${currentProject.id}/project-features`),
        apiRequest<Invoice[]>("/api/billing/invoices"),
        apiRequest<MaintenanceRecord[]>(`/api/projects/${currentProject.id}/maintenance/records`),
      ]).then(([t, m, pf, inv, maint]) => {
        setTickets(t);
        setMeetings(m);
        setFeatureRequests([...pf.base_features, ...pf.extra_features]);
        setInvoices(inv.filter((i) => i.project_id === currentProject.id));
        setMaintenance(maint);
        setLoading(false);
      });
    },
    [currentProject?.id]
  );

  useEffect(() => {
    if (!currentProject) return;
    load(true);

    // Data can change from actions taken on other pages or by the admin, so refresh
    // whenever the dashboard tab/window regains focus instead of only on first mount.
    function handleFocus() {
      load(false);
    }
    function handleVisibility() {
      if (document.visibilityState === "visible") load(false);
    }
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [currentProject?.id, load]);

  // ws-triggered updates refresh silently, without flashing the full loading spinner.
  // Skip the initial mount (all versions start at 0) -- the effect above already
  // handles the first load.
  useEffect(() => {
    if (ticketsVersion + meetingsVersion + featureRequestsVersion + invoicesVersion + maintenanceVersion === 0) return;
    load(false);
  }, [ticketsVersion, meetingsVersion, featureRequestsVersion, invoicesVersion, maintenanceVersion]);

  if (projectLoading || (currentProject && loading)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="h-16 w-16 border-4 border-border-strong border-t-brand-green animate-spin rounded-full"></div>
          <p className="mt-6 font-data-mono text-data-mono font-black tracking-widest text-text-muted uppercase">Loading System</p>
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="relative z-10">
        <div className="border-b-4 border-border-strong pb-6 mb-8">
          <div className="font-data-mono text-data-mono tracking-[0.2em] text-brand-green mb-2 text-xs">CLIENT_PORTAL</div>
          <h1 className="font-display-2xl text-display-2xl font-black uppercase text-text-main leading-none">
            WELCOME{user?.full_name ? `, ${user.full_name.toUpperCase()}` : ""}
          </h1>
        </div>

        <div className="flex flex-col items-center justify-center py-28 text-center bg-bg-base border-4 border-border-strong border-t-[7px] shadow-[8px_8px_0px_0px_var(--shadow-strong)]" style={{ borderTopColor: "var(--brand-green)" }}>
          <span className="w-20 h-20 bg-brand-green text-on-brand-green flex items-center justify-center mb-8">
            <span className="material-symbols-outlined text-[40px]">rocket_launch</span>
          </span>
          <h2 className="font-display-2xl text-4xl font-black uppercase text-text-main mb-4">
            {projects.length === 0 ? "Your project is being set up" : "Pick a project to get started"}
          </h2>
          <p className="font-data-mono text-data-mono text-text-muted uppercase tracking-widest text-xs max-w-lg mb-10">
            {projects.length === 0
              ? "Our team is getting things ready on our end. You'll see it appear here as soon as it's assigned — this won't take long."
              : "Use the project switcher above to jump into your work."}
          </p>
          {projects.length === 0 && (
            <button onClick={() => router.push("/tickets")} className="text-left bg-brand-green text-on-brand-green border-2 border-border-strong shadow-[4px_4px_0px_0px_var(--shadow-strong)] px-6 py-4 flex items-center gap-3 hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_var(--shadow-strong)] transition-all">
              <span className="material-symbols-outlined text-[22px]">confirmation_number</span>
              <span className="font-bold text-[13px] tracking-wide">RAISE A TICKET FOR ANY ENQUIRY</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const openTickets = tickets.filter((t) => t.status !== "resolved" && t.status !== "out_of_scope");
  const inProgressTickets = openTickets.filter((t) => t.status === "in_progress");

  const upcomingMeetings = meetings
    .filter((m) => m.status === "confirmed" || m.status === "requested" || m.status === "reschedule_pending")
    .filter((m) => new Date(m.confirmed_start_datetime ?? m.pending_start_datetime).getTime() >= Date.now())
    .sort((a, b) => new Date(a.confirmed_start_datetime ?? a.pending_start_datetime).getTime() - new Date(b.confirmed_start_datetime ?? b.pending_start_datetime).getTime());

  const meetingsNeedingConfirm = meetings.filter((m) => (m.status === "requested" || m.status === "reschedule_pending") && m.pending_proposed_by === "admin");

  const unpaidInvoices = invoices.filter((i) => i.status === "finalized");
  const unpaidTotal = unpaidInvoices.reduce((s, i) => s + i.total, 0);

  const rejectedMaintenance = maintenance.filter((m) => m.status === "rejected");

  const baseFeatures = featureRequests.filter((f) => f.is_base_feature);
  const extraFeatures = featureRequests.filter((f) => !f.is_base_feature);
  const featuresDone = featureRequests.filter((f) => f.status === "completed").length;
  const featuresTotal = featureRequests.length;
  const progressPct = featuresTotal ? Math.round((featuresDone / featuresTotal) * 100) : 0;
  const baseDone = baseFeatures.filter((f) => f.status === "completed").length;
  const extraDone = extraFeatures.filter((f) => f.status === "completed").length;

  const pendingBaseFeatures = baseFeatures.filter((f) => !f.base_feature_activated && f.status !== "declined");
  const challengedBaseFeatures = pendingBaseFeatures.filter((f) => f.challenge_status === "open");
  const awaitingApprovalFeatures = pendingBaseFeatures.filter((f) => f.challenge_status !== "open");

  // ---- Needs attention ----
  const attention: AttentionItem[] = [
    ...challengedBaseFeatures.map((f) => ({
      key: `FEAT-CH-${f.id}`,
      urgency: "high" as Urgency,
      label: `Challenge submitted — ${f.name}`,
      meta: "AWAITING ADMIN RESPONSE",
      action: "VIEW",
      href: "/project-features",
    })),
    ...awaitingApprovalFeatures.map((f) => ({
      key: `FEAT-${f.id}`,
      urgency: "critical" as Urgency,
      label: `Base feature awaiting approval — ${f.name}`,
      meta: "ACTION REQUIRED: APPROVE SCOPE",
      action: "APPROVE",
      href: "/project-features",
    })),
    ...rejectedMaintenance.map((m) => ({
      key: `MAINT-${m.id}`,
      urgency: "critical" as Urgency,
      label: `Maintenance proof rejected — cycle ${m.cycle_year}`,
      meta: m.penalty_deadline ? `RESUBMIT BY ${formatDate(m.penalty_deadline)}` : "RESUBMIT REQUIRED",
      action: "RESUBMIT",
      href: "/maintenance",
    })),
    ...meetingsNeedingConfirm.map((m) => ({
      key: `MTG-${m.id}`,
      urgency: "high" as Urgency,
      label: m.status === "reschedule_pending" ? `Reschedule proposed — ${m.agenda}` : `Meeting proposed — ${m.agenda}`,
      meta: `NEEDS CONFIRM · ${new Date(m.pending_start_datetime).toLocaleDateString()}`,
      action: "CONFIRM",
      href: "/meetings",
    })),
    ...openTickets.filter((t) => t.status === "open").map((t) => ({
      key: `TK-${t.id}`,
      urgency: "high" as Urgency,
      label: `Ticket awaiting resolution — ${t.name}`,
      meta: `${timeAgo(t.created_at)} OPEN`,
      action: "VIEW",
      href: "/tickets",
    })),
    ...unpaidInvoices.map((i) => ({
      key: `INV-${i.id}`,
      urgency: "low" as Urgency,
      label: `Invoice INV-${i.id} finalized — ${formatINR(i.total)}`,
      meta: "UNPAID",
      action: "VIEW",
      href: "#invoices",
    })),
  ].sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]);

  const topAttention = attention.slice(0, 3);

  const clientStats: { key: string; icon: string; label: string; value: string; sub: string; tone: ChipTone }[] = [
    { key: "tickets", icon: "confirmation_number", label: "OPEN TICKETS", value: String(openTickets.length), sub: inProgressTickets.length ? `${inProgressTickets.length} in progress` : "awaiting triage", tone: "purple" },
    { key: "meetings", icon: "event", label: "UPCOMING MEETINGS", value: String(upcomingMeetings.length), sub: upcomingMeetings[0] ? `next ${new Date(upcomingMeetings[0].confirmed_start_datetime ?? upcomingMeetings[0].pending_start_datetime).toLocaleDateString("en-US", { month: "short", day: "2-digit" })}` : "none scheduled", tone: "teal" },
    { key: "invoices", icon: "receipt_long", label: "INVOICES", value: String(unpaidInvoices.length), sub: unpaidInvoices.length ? `${formatINR(unpaidTotal)} due` : "all settled", tone: "brand" },
  ];

  function buildModal(key: string | null): ModalConfig | null {
    if (!key) return null;
    if (key === "attention") {
      return {
        title: "ALL ACTIVITY", subtitle: "EVERYTHING THAT NEEDS YOU", footerLabel: "CLOSE", footerHref: null,
        items: attention.map((a) => ({ tagLabel: a.urgency.toUpperCase(), tagTone: URGENCY_TONE[a.urgency], title: a.label, meta: a.meta })),
      };
    }
    if (key === "tickets") {
      return {
        title: "OPEN TICKETS", subtitle: "ISSUES AWAITING RESOLUTION", footerLabel: "OPEN TICKET BOARD", footerHref: "/tickets",
        items: openTickets.map((t) => ({ tagLabel: t.status === "open" ? "OPEN" : "IN PROGRESS", tagTone: t.status === "open" ? "danger" : "purple", title: t.name, meta: `TK-${t.id} · ${timeAgo(t.created_at)} open`, badgeStatus: t.status })),
      };
    }
    if (key === "meetings") {
      return {
        title: "UPCOMING MEETINGS", subtitle: "SCHEDULE & PENDING ACTIONS", footerLabel: "OPEN CALENDAR", footerHref: "/meetings",
        items: upcomingMeetings.map((m) => ({ tagLabel: new Date(m.confirmed_start_datetime ?? m.pending_start_datetime).toLocaleDateString("en-US", { month: "short", day: "2-digit" }).toUpperCase(), tagTone: "teal", title: m.agenda, meta: m.meeting_type.toUpperCase(), badgeStatus: m.status })),
      };
    }
    if (key === "invoices") {
      return {
        title: "INVOICES", subtitle: "BILLING HISTORY", footerLabel: "OPEN BILLING", footerHref: "/billing",
        items: [...invoices].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((i) => ({ tagLabel: `INV-${i.id}`, tagTone: "brand", title: formatINR(i.total), meta: i.finalized_at ? formatDate(i.finalized_at) : "Draft", badgeStatus: i.status })),
      };
    }
    return null;
  }

  const modal = buildModal(modalKey);
  const projectCode = currentProject.name.toUpperCase().replace(/\s+/g, "_");

  return (
    <>
      <div className="relative z-10">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b-4 border-border-strong pb-6 mb-8 gap-4">
          <div>
            <div className="font-data-mono text-data-mono tracking-[0.2em] text-brand-green mb-2 text-xs">CLIENT_PORTAL / {projectCode}</div>
            <h1 className="font-display-2xl text-display-2xl font-black uppercase text-text-main leading-none">
              WELCOME{user?.full_name ? `, ${user.full_name.toUpperCase()}` : ""}
            </h1>
          </div>
          <div className="text-left md:text-right font-data-mono text-data-mono text-text-muted text-xs leading-relaxed">
            <div>{todayStr()}</div>
            <div className="text-text-main font-bold">{user?.full_name?.toUpperCase()}</div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <button onClick={() => router.push("/tickets")} className="text-left bg-brand-green text-on-brand-green border-4 border-border-strong shadow-[6px_6px_0px_0px_var(--shadow-strong)] p-5 flex items-center justify-between hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_0px_var(--shadow-strong)] transition-all">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[26px]">confirmation_number</span>
              <span className="font-bold text-[15px] tracking-wide">NEW TICKET</span>
            </div>
            <span className="material-symbols-outlined text-[22px]">arrow_forward</span>
          </button>
          <button onClick={() => router.push("/meetings")} className="text-left bg-bg-base text-text-main border-4 border-border-strong shadow-[6px_6px_0px_0px_#0d9488] p-5 flex items-center justify-between hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_0px_#0d9488] transition-all">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[26px] text-[#0d9488]">calendar_add_on</span>
              <span className="font-bold text-[15px] tracking-wide">BOOK MEETING</span>
            </div>
            <span className="material-symbols-outlined text-[22px]">arrow_forward</span>
          </button>
          <button onClick={() => router.push("/feature-requests")} className="text-left bg-bg-base text-text-main border-4 border-border-strong shadow-[6px_6px_0px_0px_#7c3aed] p-5 flex items-center justify-between hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_0px_#7c3aed] transition-all">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[26px] text-[#7c3aed]">lightbulb</span>
              <span className="font-bold text-[15px] tracking-wide">REQUEST FEATURE</span>
            </div>
            <span className="material-symbols-outlined text-[22px]">arrow_forward</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left column */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            {/* Project progress */}
            <div className="bg-bg-base border-4 border-border-strong border-t-[7px] shadow-[8px_8px_0px_0px_var(--shadow-strong)] p-5" style={{ borderTopColor: "var(--brand-green)" }}>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 bg-brand-green text-on-brand-green flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">deployed_code</span>
                  </span>
                  <div className="font-bold text-base">PROJECT PROGRESS</div>
                </div>
                <span className="font-data-mono text-[11px] font-bold text-text-muted">{featuresDone} / {featuresTotal} FEATURES</span>
              </div>
              <div className="flex items-baseline gap-3 mb-3">
                <span className="font-display-2xl text-[48px] font-black leading-none tracking-tight text-brand-green">{progressPct}%</span>
                <span className="font-data-mono text-[11px] text-text-muted">COMPLETE · {featuresDone} OF {featuresTotal} SHIPPED</span>
              </div>
              <div className="h-4 border-2 border-border-strong bg-bg-panel-alt relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-brand-green" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="border-2 border-border-strong p-3">
                  <div className="font-data-mono text-[9px] tracking-widest text-text-muted mb-1">BASE FEATURES</div>
                  <div className="font-black text-xl text-text-main">{baseDone}/{baseFeatures.length}</div>
                </div>
                <div className="border-2 border-border-strong p-3">
                  <div className="font-data-mono text-[9px] tracking-widest text-text-muted mb-1">EXTRA FEATURES</div>
                  <div className="font-black text-xl text-text-main">{extraDone}/{extraFeatures.length}</div>
                </div>
                <div className="border-2 border-border-strong p-3">
                  <div className="font-data-mono text-[9px] tracking-widest text-text-muted mb-1">OPEN TICKETS</div>
                  <div className="font-black text-xl" style={{ color: openTickets.length ? "var(--accent)" : "var(--positive)" }}>{openTickets.length}</div>
                </div>
              </div>
            </div>

            {/* Mini stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 flex-1">
              {clientStats.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setModalKey(s.key)}
                  className="text-left bg-bg-base border-4 border-border-strong border-t-[6px] p-4 shadow-[8px_8px_0px_0px_var(--shadow-strong)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[10px_10px_0px_0px_var(--shadow-strong)] transition-all flex flex-col"
                  style={{ borderTopColor: s.tone === "brand" ? "var(--brand-green)" : s.tone === "purple" ? "#7c3aed" : "#0d9488" }}
                >
                  <Chip tone={s.tone}><span className="material-symbols-outlined text-[16px] align-middle">{s.icon}</span></Chip>
                  <div className="font-data-mono text-[9.5px] font-bold tracking-widest text-text-muted mt-3">{s.label}</div>
                  <div className="font-display-2xl text-[30px] font-black text-text-main leading-none mt-1">{s.value}</div>
                  <div className="font-data-mono text-[10px] text-text-muted mt-1.5">{s.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: needs attention */}
          <div className="lg:col-span-6 bg-bg-base border-4 border-border-strong border-t-[7px] shadow-[8px_8px_0px_0px_var(--shadow-strong)] flex flex-col" style={{ borderTopColor: "var(--accent)" }}>
            <div className="p-5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 bg-coral-red text-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">notifications_active</span>
                </span>
                <div>
                  <div className="font-bold text-base">NEEDS YOUR ATTENTION</div>
                  <div className="font-data-mono text-[10px] tracking-widest text-text-muted uppercase">Do these before anything else</div>
                </div>
              </div>
              <span className="font-data-mono text-[11px] font-bold text-coral-red">{attention.length} ITEMS</span>
            </div>
            <div className="border-t-2 border-border-strong flex-1">
              {topAttention.length === 0 && (
                <div className="py-14 text-center font-data-mono text-data-mono text-text-muted uppercase tracking-widest">You&apos;re all caught up</div>
              )}
              {topAttention.map((a) => (
                <div key={a.key} className="flex items-center gap-4 py-4 px-5 border-b border-border-subtle last:border-0" style={{ borderLeft: `6px solid ${a.urgency === "critical" ? "var(--accent)" : a.urgency === "high" ? "#FF7A1A" : a.urgency === "medium" ? "#FFC800" : "var(--text-muted)"}` }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Chip tone={URGENCY_TONE[a.urgency]}>{a.urgency}</Chip>
                      <span className="font-bold text-[15px] truncate">{a.label}</span>
                    </div>
                    <div className="font-data-mono text-[11px] text-text-muted">{a.meta}</div>
                  </div>
                  <button
                    onClick={() => (a.href === "#invoices" ? setModalKey("invoices") : router.push(a.href))}
                    className="shrink-0 bg-brand-green text-on-brand-green border-2 border-border-strong shadow-[3px_3px_0px_0px_var(--shadow-strong)] font-data-mono font-bold text-[10px] tracking-widest px-3 py-2 hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                  >
                    {a.action}
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => setModalKey("attention")} className="border-none border-t-2 border-border-strong bg-text-main text-bg-base font-data-mono font-bold text-xs tracking-[0.15em] py-4 flex items-center justify-center gap-2 hover:bg-brand-green hover:text-on-brand-green transition-colors">
              VIEW ALL ACTIVITY <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>

      <Modal open={!!modal} onClose={() => setModalKey(null)} title={modal?.title ?? ""}>
        {modal && (
          <div className="-m-8">
            <p className="font-data-mono text-data-mono text-text-muted uppercase tracking-widest text-xs px-8 pt-2 pb-4">{modal.subtitle}</p>
            <div className="max-h-[50vh] overflow-y-auto">
              {modal.items.length === 0 && (
                <div className="py-10 text-center font-data-mono text-data-mono text-text-muted uppercase tracking-widest">Nothing here</div>
              )}
              {modal.items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-3 px-8 border-t border-border-subtle">
                  <Chip tone={it.tagTone}>{it.tagLabel}</Chip>
                  <div className="min-w-0">
                    <div className="font-bold text-[14px] truncate">{it.title}</div>
                    <div className="font-data-mono text-[11px] text-text-muted truncate">{it.meta}</div>
                  </div>
                  {it.badgeStatus && <StatusBadge status={it.badgeStatus} />}
                </div>
              ))}
            </div>
            <button
              onClick={() => { setModalKey(null); if (modal.footerHref) router.push(modal.footerHref); }}
              className="w-full border-none border-t-2 border-border-strong bg-brand-green text-on-brand-green font-data-mono font-bold text-xs tracking-[0.15em] py-4 flex items-center justify-center gap-2 hover:bg-text-main hover:text-bg-base transition-colors mt-2"
            >
              {modal.footerLabel} {modal.footerHref && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
