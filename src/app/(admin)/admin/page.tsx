"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, fileUrl } from "@/lib/api";
import { Discount, FeatureRequest, Invoice, MaintenanceRecord, Meeting, Ticket, User } from "@/lib/types";
import { Chip, ChipTone, Modal, StatusBadge } from "@/components/ui";

type Priority = "critical" | "high" | "medium" | "low";
type ItemType = "TICKET" | "MEETING" | "FEATURE";

interface TriageItem {
  key: string;
  type: ItemType;
  title: string;
  client: string;
  priority: Priority;
  createdAt: string;
  href: string;
}

interface ModalItem {
  tagLabel: string;
  tagTone: ChipTone;
  title: string;
  meta: string;
  badgeStatus?: string;
  href?: string;
}

interface ModalConfig {
  title: string;
  subtitle: string;
  footerLabel: string;
  footerHref: string;
  items: ModalItem[];
}

const PRIORITY_RANK: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_TONE: Record<Priority, ChipTone> = { critical: "danger", high: "orange", medium: "amber", low: "neutral" };
const TYPE_TONE: Record<ItemType, ChipTone> = { TICKET: "purple", MEETING: "teal", FEATURE: "blue" };

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

export default function AdminDashboardPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [featureRequests, setFeatureRequests] = useState<FeatureRequest[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalKey, setModalKey] = useState<string | null>(null);
  const [invIdx, setInvIdx] = useState(0);
  const [maintIdx, setMaintIdx] = useState(0);
  const [discIdx, setDiscIdx] = useState(0);

  useEffect(() => {
    Promise.all([
      apiRequest<User[]>("/api/admin/users"),
      apiRequest<Meeting[]>("/api/admin/meetings"),
      apiRequest<Ticket[]>("/api/admin/tickets"),
      apiRequest<FeatureRequest[]>("/api/admin/feature-requests"),
      apiRequest<Invoice[]>("/api/admin/billing/invoices"),
      apiRequest<Discount[]>("/api/admin/discounts"),
      apiRequest<MaintenanceRecord[]>("/api/admin/maintenance/records"),
    ]).then(([u, m, t, f, i, d, mr]) => {
      setUsers(u);
      setMeetings(m);
      setTickets(t);
      setFeatureRequests(f);
      setInvoices(i);
      setDiscounts(d);
      setMaintenanceRecords(mr);
      setLoading(false);
    });
  }, []);

  const clientLookup = new Map(users.map((u) => [u.id, u]));
  const clients = users.filter((u) => u.role === "client");
  const activeClients = clients.filter((u) => u.is_active);

  const openTickets = tickets.filter((t) => t.status !== "resolved" && t.status !== "out_of_scope");
  const criticalOpenTickets = openTickets.filter((t) => t.priority === "critical");
  const pendingMeetings = meetings.filter((m) => m.status === "requested" || m.status === "reschedule_pending");
  const underReviewFeatures = featureRequests.filter((f) => f.status === "under_review");
  const draftInvoices = invoices.filter((i) => i.status === "draft");
  const draftTotal = draftInvoices.reduce((s, i) => s + i.total, 0);
  const billedInvoices = invoices.filter((i) => i.status === "finalized" || i.status === "paid");

  const now = new Date();
  const meetingsToday = meetings
    .filter((m) => m.status === "confirmed" || m.status === "requested" || m.status === "reschedule_pending")
    .filter((m) => {
      const dt = m.confirmed_start_datetime ?? m.pending_start_datetime;
      return !!dt && new Date(dt).toDateString() === now.toDateString();
    })
    .sort((a, b) => new Date(a.confirmed_start_datetime ?? a.pending_start_datetime).getTime() - new Date(b.confirmed_start_datetime ?? b.pending_start_datetime).getTime());

  const meetingsThisMonth = meetings
    .filter((m) => m.status === "confirmed" || m.status === "requested" || m.status === "reschedule_pending")
    .filter((m) => {
      const dt = m.confirmed_start_datetime ?? m.pending_start_datetime;
      if (!dt) return false;
      const d = new Date(dt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .sort((a, b) => new Date(a.confirmed_start_datetime ?? a.pending_start_datetime).getTime() - new Date(b.confirmed_start_datetime ?? b.pending_start_datetime).getTime());

  const newFeaturesThisWeek = underReviewFeatures.filter((f) => Date.now() - new Date(f.created_at).getTime() < 7 * 864e5).length;

  // ---- Account operations: outstanding invoices, maintenance alerts, active discounts ----
  const outstandingInvoices = invoices
    .filter((i) => i.status === "finalized")
    .sort((a, b) => new Date(a.finalized_at ?? a.created_at).getTime() - new Date(b.finalized_at ?? b.created_at).getTime());
  const outstandingTotal = outstandingInvoices.reduce((s, i) => s + i.total, 0);

  const maintenanceAlerts = maintenanceRecords
    .filter((r) => r.status === "proof_submitted" || (r.status === "pending" && new Date(r.due_date) < now) || r.status === "rejected")
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  const overdueMaintenanceCount = maintenanceAlerts.filter((r) => r.status !== "proof_submitted").length;

  const activeDiscounts = discounts.filter((d) => d.is_active);

  // ---- Revenue (last 6 months, billed invoices) ----
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return d;
  });
  const revenueBars = months.map((d) => {
    const total = billedInvoices
      .filter((inv) => {
        const dt = new Date(inv.finalized_at ?? inv.created_at);
        return dt.getFullYear() === d.getFullYear() && dt.getMonth() === d.getMonth();
      })
      .reduce((s, inv) => s + inv.total, 0);
    return { label: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(), total };
  });
  const maxRevenue = Math.max(1, ...revenueBars.map((r) => r.total));
  const mrr = revenueBars[revenueBars.length - 1]?.total ?? 0;

  // ---- Triage queue ----
  const triage: TriageItem[] = [
    ...openTickets.map((t) => ({
      key: `TK-${t.id}`,
      type: "TICKET" as const,
      title: t.name,
      client: clientLookup.get(t.client_id)?.full_name ?? "Unknown client",
      priority: t.priority,
      createdAt: t.created_at,
      href: `/admin/tickets?clientId=${t.client_id}&projectId=${t.project_id}&ticketId=${t.id}`,
    })),
    ...pendingMeetings.map((m) => ({
      key: `MTG-${m.id}`,
      type: "MEETING" as const,
      title: m.status === "reschedule_pending" ? `Reschedule requested — ${m.agenda}` : `New meeting request — ${m.agenda}`,
      client: clientLookup.get(m.client_id)?.full_name ?? "Unknown client",
      priority: (m.status === "reschedule_pending" ? "high" : "medium") as Priority,
      createdAt: m.created_at,
      href: `/admin/meetings?clientId=${m.client_id}&projectId=${m.project_id}&meetingId=${m.id}`,
    })),
    ...underReviewFeatures.map((f) => ({
      key: `FR-${f.id}`,
      type: "FEATURE" as const,
      title: f.name,
      client: clientLookup.get(f.client_id)?.full_name ?? "Unknown client",
      priority: "medium" as Priority,
      createdAt: f.created_at,
      href: `/admin/feature-requests/requests?clientId=${f.client_id}&projectId=${f.project_id}&featureId=${f.id}`,
    })),
  ].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const topPriority = triage.slice(0, 4);

  const adminStats: { key: string; icon: string; label: string; value: string; sub: string; tone: ChipTone }[] = [
    { key: "revenue", icon: "payments", label: "REVENUE THIS MONTH", value: formatINR(mrr), sub: `${formatINR(billedInvoices.reduce((s, i) => s + i.total, 0))} billed all-time`, tone: "brand" },
    { key: "tickets", icon: "confirmation_number", label: "OPEN TICKETS", value: String(openTickets.length), sub: `${criticalOpenTickets.length} critical`, tone: "purple" },
    { key: "clients", icon: "groups", label: "ACTIVE CLIENTS", value: String(activeClients.length), sub: `${overdueMaintenanceCount} maintenance overdue`, tone: "amber" },
    { key: "meetings", icon: "event", label: "MEETINGS TODAY", value: String(meetingsToday.length), sub: meetingsToday.length ? "see unified calendar" : "none scheduled", tone: "teal" },
    { key: "features", icon: "category", label: "FEATURES IN REVIEW", value: String(underReviewFeatures.length), sub: `${newFeaturesThisWeek} new this week`, tone: "blue" },
    { key: "invoices", icon: "receipt_long", label: "DRAFT INVOICES", value: String(draftInvoices.length), sub: `${formatINR(draftTotal)} to finalize`, tone: "brand" },
  ];

  function buildModal(key: string | null): ModalConfig | null {
    if (!key) return null;
    if (key === "priority") {
      return {
        title: "FULL PRIORITY QUEUE", subtitle: "ALL OPEN ITEMS · SORTED BY URGENCY", footerLabel: "VIEW ALL TICKETS", footerHref: "/admin/tickets",
        items: triage.map((t) =>
          t.type === "FEATURE" || t.type === "MEETING"
            ? { tagLabel: t.type, tagTone: TYPE_TONE[t.type], title: t.title, meta: `${t.key} · ${t.client} · ${timeAgo(t.createdAt)} open`, href: t.href }
            : { tagLabel: t.priority.toUpperCase(), tagTone: PRIORITY_TONE[t.priority], title: t.title, meta: `${t.key} · ${t.client} · ${timeAgo(t.createdAt)} open`, href: t.href }
        ),
      };
    }
    if (key === "tickets") {
      return {
        title: "OPEN TICKETS", subtitle: "ISSUES AWAITING RESOLUTION", footerLabel: "OPEN TICKET BOARD", footerHref: "/admin/tickets",
        items: openTickets.map((t) => ({ tagLabel: t.priority.toUpperCase(), tagTone: PRIORITY_TONE[t.priority], title: t.name, meta: `TK-${t.id} · ${clientLookup.get(t.client_id)?.full_name ?? "Unknown"}`, badgeStatus: t.status })),
      };
    }
    if (key === "clients") {
      return {
        title: "ACTIVE CLIENTS", subtitle: "ALL ACTIVE ACCOUNTS", footerLabel: "OPEN CLIENT ACCOUNTS", footerHref: "/admin/users",
        items: activeClients.map((c) => ({ tagLabel: "CLIENT", tagTone: "amber", title: c.full_name, meta: c.email, badgeStatus: undefined })),
      };
    }
    if (key === "meetings") {
      const src = [...meetings].filter((m) => m.status !== "cancelled" && m.status !== "denied").sort((a, b) => new Date(a.confirmed_start_datetime ?? a.pending_start_datetime).getTime() - new Date(b.confirmed_start_datetime ?? b.pending_start_datetime).getTime());
      return {
        title: "UPCOMING MEETINGS", subtitle: "SCHEDULE & PENDING ACTIONS", footerLabel: "OPEN CALENDAR", footerHref: "/admin/meetings",
        items: src.slice(0, 12).map((m) => ({ tagLabel: new Date(m.confirmed_start_datetime ?? m.pending_start_datetime).toLocaleDateString("en-US", { month: "short", day: "2-digit" }).toUpperCase(), tagTone: "teal", title: m.agenda, meta: clientLookup.get(m.client_id)?.full_name ?? "Unknown client", badgeStatus: m.status })),
      };
    }
    if (key === "features") {
      return {
        title: "FEATURE REQUESTS", subtitle: "AWAITING REVIEW", footerLabel: "OPEN FEATURE BOARD", footerHref: "/admin/feature-requests",
        items: underReviewFeatures.map((f) => ({ tagLabel: `FR-${f.id}`, tagTone: "purple", title: f.name, meta: clientLookup.get(f.client_id)?.full_name ?? "Unknown client", badgeStatus: f.status })),
      };
    }
    if (key === "revenue" || key === "invoices") {
      const src = key === "revenue" ? billedInvoices : draftInvoices;
      return {
        title: key === "revenue" ? "REVENUE // LAST 6 MONTHS" : "DRAFT INVOICES", subtitle: key === "revenue" ? `${formatINR(mrr)} billed this month` : "PENDING FINALIZATION", footerLabel: "OPEN BILLING", footerHref: "/admin/billing",
        items: src.map((inv) => ({ tagLabel: `INV-${inv.id}`, tagTone: "brand", title: formatINR(inv.total), meta: clientLookup.get(inv.client_id)?.full_name ?? "Unknown client", badgeStatus: inv.status })),
      };
    }
    return null;
  }

  const modal = buildModal(modalKey);

  const invLen = outstandingInvoices.length;
  const curInvIdx = invLen ? Math.min(invIdx, invLen - 1) : 0;
  const curInv = invLen ? outstandingInvoices[curInvIdx] : null;

  const maintLen = maintenanceAlerts.length;
  const curMaintIdx = maintLen ? Math.min(maintIdx, maintLen - 1) : 0;
  const curMaint = maintLen ? maintenanceAlerts[curMaintIdx] : null;

  const discLen = activeDiscounts.length;
  const curDiscIdx = discLen ? Math.min(discIdx, discLen - 1) : 0;
  const curDisc = discLen ? activeDiscounts[curDiscIdx] : null;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="h-16 w-16 border-4 border-border-strong border-t-brand-green animate-spin rounded-full"></div>
          <p className="mt-6 font-data-mono text-data-mono font-black tracking-widest text-text-muted uppercase">Loading System</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative z-10">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b-4 border-border-strong pb-6 mb-8 gap-4">
          <div>
            <div className="font-data-mono text-data-mono tracking-[0.2em] text-brand-green mb-2 text-xs">ADMIN_PORTAL</div>
            <h1 className="font-display-2xl text-display-2xl font-black uppercase text-text-main leading-none">GLOBAL DASHBOARD</h1>
          </div>
          <div className="text-left md:text-right font-data-mono text-data-mono text-text-muted text-xs leading-relaxed">
            <div>{todayStr()}</div>
            <div className="text-text-main font-bold">GARIA ADMIN</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch mb-6">
          {/* Priority hero card */}
          <div className="lg:col-span-7 bg-bg-base border-4 border-border-strong border-t-[7px] shadow-[8px_8px_0px_0px_var(--shadow-strong)] flex flex-col" style={{ borderTopColor: "var(--accent)" }}>
            <div className="p-5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 bg-coral-red text-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">priority_high</span>
                </span>
                <div>
                  <div className="font-bold text-base tracking-tight">TACKLE FIRST</div>
                  <div className="font-data-mono text-[10px] tracking-widest text-text-muted uppercase">Highest-urgency items across all clients</div>
                </div>
              </div>
              <span className="font-data-mono text-[11px] font-bold text-coral-red">{triage.length} OPEN</span>
            </div>
            <div className="border-t-2 border-border-strong flex-1">
              {topPriority.length === 0 && (
                <div className="py-14 text-center font-data-mono text-data-mono text-text-muted uppercase tracking-widest">Queue is clear</div>
              )}
              {topPriority.map((t) => (
                <button
                  key={t.key}
                  onClick={() => router.push(t.href)}
                  className="w-full text-left flex flex-col gap-2 py-4 px-5 border-b border-border-subtle last:border-0 hover:bg-bg-panel-alt transition-colors"
                  style={{
                    borderLeft: `6px solid ${t.type === "FEATURE"
                        ? "#2563d6"
                        : t.type === "MEETING"
                          ? "#0d9488"
                          : t.priority === "critical"
                            ? "var(--accent)"
                            : t.priority === "high"
                              ? "#FF7A1A"
                              : t.priority === "medium"
                                ? "#FFC800"
                                : "var(--text-muted)"
                      }`,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex gap-2">
                      {t.type !== "FEATURE" && t.type !== "MEETING" && <Chip tone={PRIORITY_TONE[t.priority]}>{t.priority}</Chip>}
                      <Chip tone={TYPE_TONE[t.type]}>{t.type}</Chip>
                    </div>
                    <span className="font-data-mono text-[11px] text-text-muted">{timeAgo(t.createdAt)} open</span>
                  </div>
                  <div className="font-bold text-[15px] leading-tight">{t.title}</div>
                  <div className="font-data-mono text-[11px] text-text-muted">{t.key} · {t.client}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setModalKey("priority")} className="border-none border-t-2 border-border-strong bg-text-main text-bg-base font-data-mono font-bold text-xs tracking-[0.15em] py-4 flex items-center justify-center gap-2 hover:bg-brand-green hover:text-on-brand-green transition-colors">
              VIEW FULL PRIORITY QUEUE <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>

          {/* Stat grid */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-6">
            {adminStats.map((s) => (
              <button
                key={s.key}
                onClick={() => setModalKey(s.key)}
                className="text-left bg-bg-base border-4 border-border-strong border-t-[6px] p-5 shadow-[8px_8px_0px_0px_var(--shadow-strong)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[10px_10px_0px_0px_var(--shadow-strong)] transition-all flex flex-col"
                style={{ borderTopColor: s.tone === "brand" ? "var(--brand-green)" : s.tone === "purple" ? "#7c3aed" : s.tone === "blue" ? "#2563d6" : "#0d9488" }}
              >
                <div className="flex justify-between items-start">
                  <Chip tone={s.tone}><span className="material-symbols-outlined text-[16px] align-middle">{s.icon}</span></Chip>
                  <span className="material-symbols-outlined text-text-muted text-[18px] opacity-40">open_in_full</span>
                </div>
                <div className="font-data-mono text-[10px] font-bold tracking-widest text-text-muted mt-3">{s.label}</div>
                <div className="font-display-2xl text-[32px] font-black text-text-main leading-none mt-1 truncate">{s.value}</div>
                <div className="font-data-mono text-[11px] text-text-muted mt-2">{s.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-6 items-stretch">
          {/* Revenue chart */}
          <div className="lg:col-span-2 bg-bg-base border-4 border-border-strong border-t-[6px] shadow-[8px_8px_0px_0px_var(--shadow-strong)] p-5 flex flex-col" style={{ borderTopColor: "var(--brand-green)" }}>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-brand-green text-on-brand-green flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]">payments</span>
                </span>
                <span className="font-bold text-sm">REVENUE // 6 MONTHS</span>
              </div>
              <button onClick={() => setModalKey("revenue")} className="font-data-mono text-[13px] font-bold text-brand-green hover:underline">{formatINR(mrr)} MRR</button>
            </div>
            <div className="flex items-end gap-3 flex-1 min-h-[120px] border-b-2 border-border-strong">
              {revenueBars.map((b, i) => (
                <div key={b.label} className="flex-1 flex flex-col justify-end items-center h-full gap-1">
                  <span className="font-data-mono text-[9px] font-bold text-brand-green">{formatINR(b.total)}</span>
                  <div className="w-full border-2 border-border-strong border-b-0 bg-brand-green" style={{ height: `${Math.max(4, Math.round((b.total / maxRevenue) * 100))}%`, opacity: 0.5 + (i / 5) * 0.5 }} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-2">
              {revenueBars.map((b) => (
                <div key={b.label} className="flex-1 text-center font-data-mono text-[9px] text-text-muted">{b.label}</div>
              ))}
            </div>
          </div>

          {/* Meetings this month */}
          <div className="bg-bg-panel-alt border-4 border-border-strong border-t-[6px] shadow-[10px_10px_0px_0px_var(--shadow-strong)] flex flex-col" style={{ borderTopColor: "#0d9488" }}>
            <div className="p-5 flex items-center gap-3 border-b-4 border-border-strong">
              <span className="w-10 h-10 bg-[#0d9488] text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">event</span>
              </span>
              <div>
                <div className="font-bold text-sm">MEETINGS THIS MONTH</div>
                <div className="font-data-mono text-[10px] text-text-muted uppercase tracking-widest">{now.toLocaleDateString("en-US", { month: "long" })}</div>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <div className="font-headline-lg font-black text-6xl leading-none">{meetingsThisMonth.length}</div>
              <div className="font-data-mono text-[10px] uppercase tracking-widest text-text-muted mt-2">allocated</div>
            </div>

            <button onClick={() => router.push("/admin/meetings")} className="border-none border-t-4 border-border-strong bg-[var(--footer-strip)] text-white font-data-mono font-bold text-[11px] tracking-[0.15em] py-4 flex items-center justify-center gap-2 hover:bg-brand-green hover:text-on-brand-green transition-colors">
              OPEN CALENDAR <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>

          {/* Active discounts */}
          <div className="group relative bg-[#2d3136] border-4 border-border-strong overflow-hidden flex flex-col shadow-[10px_10px_0px_0px_var(--shadow-strong)]">
            <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-56 h-56 bg-[#f05041] rounded-full z-0 group-hover:scale-110 transition-transform duration-500"></div>
              {!curDisc ? (
                <div className="text-center font-data-mono text-data-mono text-white/50 uppercase tracking-widest relative z-10">No active discounts</div>
              ) : (
                <div className="w-full h-full relative flex flex-col justify-between text-left z-10">
                  <div className="relative z-10">
                    <div className="font-data-mono text-[10px] tracking-[0.2em] text-white/50 uppercase mb-2"></div>
                    <h4 className="font-headline-lg font-black text-4xl uppercase leading-[0.9] text-[#e8e4d9]">
                      ACTIVE<br />DISCOUNT
                    </h4>
                  </div>

                  <div className="relative z-10 flex-1 flex items-center justify-center py-8">
                    <div className="font-headline-lg font-black text-7xl md:text-8xl tracking-tighter text-[#e8e4d9] drop-shadow-[5px_5px_0px_#f05041]">
                      {curDisc.discount_type === "percentage" ? `${curDisc.value}%` : formatINR(curDisc.value)}
                    </div>
                  </div>

                  <div className="relative z-10 border-t-2 border-white/10 pt-6 mt-auto space-y-3">
                    <div className="flex justify-between text-[#e8e4d9]">
                      <span className="font-data-mono text-[10px] tracking-widest uppercase text-white/50">Target Client</span>
                      <span className="font-bold text-sm truncate max-w-[120px] text-right">{clientLookup.get(curDisc.client_id)?.full_name ?? "Unknown"}</span>
                    </div>
                    <div className="flex justify-between text-[#e8e4d9]">
                      <span className="font-data-mono text-[10px] tracking-widest uppercase text-white/50">Math Logic</span>
                      <span className="font-bold text-sm">{curDisc.discount_type === "percentage" ? "PERCENTAGE" : "FLAT INR"}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {discLen > 0 && (
              <div className="absolute top-6 right-6 z-20 bg-text-main text-bg-base font-data-mono text-[10px] font-bold px-3 py-1 uppercase tracking-widest border-2 border-border-strong">
                {curDiscIdx + 1}/{discLen}
              </div>
            )}

            {discLen > 1 && (
              <div className="flex items-center justify-center gap-4 pb-5 relative z-10">
                <button onClick={() => setDiscIdx((i) => (i - 1 + discLen) % discLen)} className="w-9 h-9 border-2 border-white/30 text-[#e8e4d9] flex items-center justify-center hover:bg-white/10 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <div className="flex flex-wrap justify-center gap-1.5 max-w-[120px]">
                  {activeDiscounts.map((_, i) => (
                    <span key={i} className={`w-2 h-2 rounded-full ${i === curDiscIdx ? "bg-[#f05041]" : "bg-white/20"}`} />
                  ))}
                </div>
                <button onClick={() => setDiscIdx((i) => (i + 1) % discLen)} className="w-9 h-9 border-2 border-white/30 text-[#e8e4d9] flex items-center justify-center hover:bg-white/10 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            )}

            <button onClick={() => router.push("/admin/billing?tab=discounts")} className="border-none border-t-4 border-border-strong bg-[var(--footer-strip)] text-white font-data-mono font-bold text-[11px] tracking-[0.15em] py-4 flex items-center justify-center gap-2 hover:bg-[#f05041] hover:text-white transition-colors relative z-10">
              OPEN DISCOUNTS <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>

          {/* Outstanding invoices */}
          <div className="lg:col-span-2 lg:col-start-1 lg:row-start-2 bg-bg-panel-alt border-4 border-border-strong border-t-[6px] shadow-[10px_10px_0px_0px_var(--shadow-strong)] flex flex-col min-h-[480px]" style={{ borderTopColor: "var(--brand-green)" }}>
            <div className="p-5 flex items-center justify-between gap-3 border-b-4 border-border-strong">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 bg-brand-green text-on-brand-green flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                </span>
                <div>
                  <div className="font-bold text-sm">OUTSTANDING INVOICES</div>
                  <div className="font-data-mono text-[10px] text-text-muted uppercase tracking-widest">{formatINR(outstandingTotal)} total unpaid</div>
                </div>
              </div>
              {invLen > 0 && <span className="font-data-mono text-[11px] font-bold text-text-muted shrink-0">{curInvIdx + 1}/{invLen}</span>}
            </div>

            <div className="flex-1 flex items-center justify-center p-6">
              {!curInv ? (
                <div className="text-center font-data-mono text-data-mono text-text-muted uppercase tracking-widest">Nothing outstanding</div>
              ) : (
                <div className="w-full bg-bg-base border-4 border-border-strong p-6 shadow-[6px_6px_0px_0px_var(--shadow-strong)] relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none"><span className="material-symbols-outlined text-[120px]">receipt_long</span></div>
                  <div className="flex justify-between items-start mb-6 relative z-10 gap-3">
                    <h4 className="font-headline-lg font-black text-2xl uppercase truncate">{clientLookup.get(curInv.client_id)?.full_name ?? "Unknown"}</h4>
                    <StatusBadge status={curInv.status} />
                  </div>
                  <div className="space-y-3 font-data-mono text-sm relative z-10">
                    <div className="flex justify-between border-b-2 border-border-strong/30 pb-2"><span className="text-text-muted uppercase font-bold">Record</span><span className="font-bold">INV-{curInv.id}</span></div>
                    <div className="flex justify-between border-b-2 border-border-strong/30 pb-2"><span className="text-text-muted uppercase font-bold">Subtotal</span><span className="font-bold">{formatINR(curInv.subtotal)}</span></div>
                    {curInv.discount_amount > 0 && (
                      <div className="flex justify-between border-b-2 border-border-strong/30 pb-2 text-forest-green"><span className="uppercase font-bold">Discount</span><span className="font-bold">-{formatINR(curInv.discount_amount)}</span></div>
                    )}
                    <div className="flex justify-between border-b-2 border-border-strong/30 pb-2"><span className="text-text-muted uppercase font-bold">Tax</span><span className="font-bold">{formatINR(curInv.tax_amount)}</span></div>
                    <div className="flex justify-between pt-1"><span className="text-text-muted uppercase font-bold">Unpaid Since</span><span className="font-bold">{timeAgo(curInv.finalized_at ?? curInv.created_at)}</span></div>
                  </div>
                  <div className="mt-6 pt-4 border-t-4 border-border-strong flex justify-between items-center relative z-10">
                    <span className="font-data-mono text-[10px] uppercase font-bold text-brand-green tracking-widest">Total Due</span>
                    <span className="font-black text-3xl">{formatINR(curInv.total)}</span>
                  </div>
                </div>
              )}
            </div>

            {invLen > 1 && (
              <div className="flex items-center justify-center gap-4 pb-5">
                <button onClick={() => setInvIdx((i) => (i - 1 + invLen) % invLen)} className="w-9 h-9 border-2 border-border-strong flex items-center justify-center hover:bg-border-subtle transition-colors">
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <div className="flex flex-wrap justify-center gap-1.5 max-w-[120px]">
                  {outstandingInvoices.map((_, i) => (
                    <span key={i} className={`w-2 h-2 rounded-full ${i === curInvIdx ? "bg-brand-green" : "bg-border-strong/30"}`} />
                  ))}
                </div>
                <button onClick={() => setInvIdx((i) => (i + 1) % invLen)} className="w-9 h-9 border-2 border-border-strong flex items-center justify-center hover:bg-border-subtle transition-colors">
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            )}

            <button onClick={() => router.push("/admin/billing")} className="border-none border-t-4 border-border-strong bg-[var(--footer-strip)] text-white font-data-mono font-bold text-[11px] tracking-[0.15em] py-4 flex items-center justify-center gap-2 hover:bg-brand-green hover:text-on-brand-green transition-colors">
              OPEN BILLING <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>

          {/* Maintenance alerts */}
          <div className="lg:col-span-2 lg:col-start-3 lg:row-start-2 bg-bg-panel-alt border-4 border-border-strong border-t-[6px] shadow-[10px_10px_0px_0px_var(--shadow-strong)] flex flex-col min-h-[480px]" style={{ borderTopColor: "var(--accent)" }}>
            <div className="p-5 flex items-center justify-between gap-3 border-b-4 border-border-strong">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 bg-coral-red text-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">build</span>
                </span>
                <div>
                  <div className="font-bold text-sm">MAINTENANCE ALERTS</div>
                  <div className="font-data-mono text-[10px] text-coral-red uppercase tracking-widest">{overdueMaintenanceCount} overdue</div>
                </div>
              </div>
              {maintLen > 0 && <span className="font-data-mono text-[11px] font-bold text-text-muted shrink-0">{curMaintIdx + 1}/{maintLen}</span>}
            </div>

            <div className="flex-1 flex items-center justify-center p-6">
              {!curMaint ? (
                <div className="text-center font-data-mono text-data-mono text-text-muted uppercase tracking-widest">All cycles compliant</div>
              ) : (
                <div className="w-full bg-bg-base border-4 border-border-strong p-6 shadow-[6px_6px_0px_0px_var(--shadow-strong)] relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none"><span className="material-symbols-outlined text-[120px]">build</span></div>
                  <div className="flex justify-between items-start mb-6 relative z-10 gap-3">
                    <h4 className="font-headline-lg font-black text-2xl uppercase truncate">{clientLookup.get(curMaint.client_id)?.full_name ?? "Unknown"}</h4>
                    <StatusBadge status={curMaint.status} />
                  </div>
                  <div className="space-y-3 font-data-mono text-sm relative z-10">
                    <div className="flex justify-between border-b-2 border-border-strong/30 pb-2"><span className="text-text-muted uppercase font-bold">Cycle</span><span className="font-bold">{curMaint.cycle_year}</span></div>
                    <div className="flex justify-between border-b-2 border-border-strong/30 pb-2"><span className="text-text-muted uppercase font-bold">Due Date</span><span className="font-bold">{new Date(curMaint.due_date).toLocaleDateString()}</span></div>
                    <div className="flex justify-between pt-1"><span className="text-text-muted uppercase font-bold">Amount</span><span className="font-bold">{formatINR(curMaint.amount)}</span></div>
                  </div>
                  {curMaint.proof_file_path && (
                    <a href={fileUrl(curMaint.proof_file_path)} target="_blank" rel="noreferrer" className="mt-6 pt-4 border-t-4 border-border-strong flex justify-between items-center relative z-10 text-accent hover:underline">
                      <span className="font-data-mono text-[10px] uppercase font-bold tracking-widest">Review Proof</span>
                      <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                    </a>
                  )}
                </div>
              )}
            </div>

            {maintLen > 1 && (
              <div className="flex items-center justify-center gap-4 pb-5">
                <button onClick={() => setMaintIdx((i) => (i - 1 + maintLen) % maintLen)} className="w-9 h-9 border-2 border-border-strong flex items-center justify-center hover:bg-border-subtle transition-colors">
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <div className="flex flex-wrap justify-center gap-1.5 max-w-[120px]">
                  {maintenanceAlerts.map((_, i) => (
                    <span key={i} className={`w-2 h-2 rounded-full ${i === curMaintIdx ? "bg-coral-red" : "bg-border-strong/30"}`} />
                  ))}
                </div>
                <button onClick={() => setMaintIdx((i) => (i + 1) % maintLen)} className="w-9 h-9 border-2 border-border-strong flex items-center justify-center hover:bg-border-subtle transition-colors">
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            )}

            <button onClick={() => router.push("/admin/maintenance")} className="border-none border-t-4 border-border-strong bg-[var(--footer-strip)] text-white font-data-mono font-bold text-[11px] tracking-[0.15em] py-4 flex items-center justify-center gap-2 hover:bg-brand-green hover:text-on-brand-green transition-colors">
              OPEN MAINTENANCE <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
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
              {modal.items.map((it, idx) => {
                const Wrapper = it.href ? "button" : "div";
                return (
                  <Wrapper
                    key={idx}
                    {...(it.href ? { onClick: () => { setModalKey(null); router.push(it.href!); } } : {})}
                    className={`w-full grid grid-cols-[auto_1fr_auto] items-center gap-4 py-3 px-8 border-t border-border-subtle text-left ${it.href ? "hover:bg-bg-panel-alt transition-colors cursor-pointer" : ""}`}
                  >
                    <Chip tone={it.tagTone}>{it.tagLabel}</Chip>
                    <div className="min-w-0">
                      <div className="font-bold text-[14px] truncate">{it.title}</div>
                      <div className="font-data-mono text-[11px] text-text-muted truncate">{it.meta}</div>
                    </div>
                    {it.badgeStatus && <StatusBadge status={it.badgeStatus} />}
                  </Wrapper>
                );
              })}
            </div>
            <button onClick={() => { setModalKey(null); router.push(modal.footerHref); }} className="w-full border-none border-t-2 border-border-strong bg-brand-green text-on-brand-green font-data-mono font-bold text-xs tracking-[0.15em] py-4 flex items-center justify-center gap-2 hover:bg-text-main hover:text-bg-base transition-colors mt-2">
              {modal.footerLabel} <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
