"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import {
  Discount,
  InfrastructureCostEntry,
  Invoice,
  MaintenanceRecord,
  ProjectFeatures,
} from "@/lib/types";
import { Alert, EmptyState } from "@/components/ui";
import { useProject } from "@/lib/project-context";
import { useAuth } from "@/lib/auth";
import {
  formatDate,
  formatINR,
  InvoiceDetailView,
  InvoiceStatusTag,
  ProjectDetailData,
} from "@/components/invoice/InvoiceDetailView";
import { useWsEvent } from "@/components/WebSocketProvider";

export default function BillingPage() {
  const { user } = useAuth();
  const { projects } = useProject();

  const invoicesVersion = useWsEvent("invoices");
  const maintenanceVersion = useWsEvent("maintenance");
  const discountsVersion = useWsEvent("discounts");
  const featureRequestsVersion = useWsEvent("feature_requests");

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filterProjectId, setFilterProjectId] = useState<number | "all">("all");

  const [detailCache, setDetailCache] = useState<Record<number, ProjectDetailData>>({});
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    apiRequest<Invoice[]>("/api/billing/invoices")
      .then(setInvoices)
      .catch((err) => setError(err instanceof ApiError ? String(err.detail) : "Could not load invoices"))
      .finally(() => setLoading(false));
  }, [invoicesVersion]);

  const current = selectedId != null ? invoices.find((i) => i.id === selectedId) ?? null : null;

  // ws-triggered invalidation: drop the cached detail data for the currently viewed
  // project so the fetch effect below (guarded by the cache) naturally refetches it.
  useEffect(() => {
    if (!current) return;
    setDetailCache((prev) => {
      if (!(current.project_id in prev)) return prev;
      const next = { ...prev };
      delete next[current.project_id];
      return next;
    });
  }, [maintenanceVersion, discountsVersion, featureRequestsVersion]);

  useEffect(() => {
    if (!current || detailCache[current.project_id]) return;
    setDetailLoading(true);
    Promise.all([
      apiRequest<ProjectFeatures>(`/api/projects/${current.project_id}/project-features`),
      apiRequest<InfrastructureCostEntry[]>(`/api/projects/${current.project_id}/maintenance/infrastructure-costs`),
      apiRequest<MaintenanceRecord[]>(`/api/projects/${current.project_id}/maintenance/records`),
      apiRequest<Discount | null>(`/api/projects/${current.project_id}/discounts/active`),
    ])
      .then(([projectFeatures, infraCosts, maintenance, discount]) => {
        const features = [...projectFeatures.base_features, ...projectFeatures.extra_features];
        setDetailCache((prev) => ({ ...prev, [current.project_id]: { features, infraCosts, maintenance, discount } }));
      })
      .catch(() => {
        // detail sections degrade gracefully without this supplementary data
      })
      .finally(() => setDetailLoading(false));
  }, [current?.project_id, detailCache]);

  function projectName(id: number): string {
    return projects.find((p) => p.id === id)?.name ?? `Project #${id}`;
  }

  function openInvoice(id: number) {
    setSelectedId(id);
    setView("detail");
  }

  function backToList() {
    setView("list");
    setSelectedId(null);
  }

  const projectIdsWithInvoices = useMemo(
    () => Array.from(new Set(invoices.map((i) => i.project_id))),
    [invoices]
  );

  const groups = useMemo(() => {
    const filtered = filterProjectId === "all" ? invoices : invoices.filter((i) => i.project_id === filterProjectId);
    const byProject = new Map<number, Invoice[]>();
    for (const inv of filtered) {
      const list = byProject.get(inv.project_id) ?? [];
      list.push(inv);
      byProject.set(inv.project_id, list);
    }
    return Array.from(byProject.entries())
      .map(([projectId, invs]) => ({
        projectId,
        name: projectName(projectId),
        total: invs.reduce((sum, i) => sum + i.total, 0),
        invoices: [...invs].sort(
          (a, b) => new Date(b.finalized_at ?? b.created_at).getTime() - new Date(a.finalized_at ?? a.created_at).getTime()
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [invoices, filterProjectId, projects]);

  if (loading) {
    return (
      <div className="flex justify-start py-12">
        <div className="font-data-mono font-bold text-2xl animate-pulse">LOADING_RECORDS...</div>
      </div>
    );
  }

  // ======================= DETAIL VIEW =======================
  if (view === "detail" && current) {
    const detail = detailCache[current.project_id];
    return (
      <InvoiceDetailView
        invoice={current}
        detail={detail ?? null}
        detailLoading={detailLoading}
        billedToName={user?.full_name ?? "—"}
        billedToEmail={user?.email ?? ""}
        projectName={projectName(current.project_id)}
        canExport={current.status !== "draft"}
        onBack={backToList}
        backLabel="ALL INVOICES"
      />
    );
  }

  // ======================= LIST VIEW =======================
  return (
    <div className="space-y-8 pb-24 no-print">
      <div>
        <p className="font-data-mono text-xs tracking-[0.2em] uppercase text-text-muted mb-2">Financial Records // All Invoices</p>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <h1 className="font-display-2xl text-5xl md:text-7xl font-black uppercase text-text-main leading-none tracking-tighter">INVOICES</h1>
          <div className="font-data-mono text-sm text-text-muted">
            {invoices.length} invoice{invoices.length === 1 ? "" : "s"} across {projectIdsWithInvoices.length} project{projectIdsWithInvoices.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {invoices.length === 0 ? (
        <EmptyState>No invoices yet.</EmptyState>
      ) : (
        <>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setFilterProjectId("all")}
              className={`border-2 border-border-strong px-4 py-2 font-data-mono font-bold text-xs tracking-widest uppercase transition-colors ${
                filterProjectId === "all" ? "bg-brand-green text-on-brand-green" : "bg-bg-panel-alt text-text-main hover:bg-border-subtle"
              }`}
            >
              All Projects
            </button>
            {projectIdsWithInvoices.map((pid) => (
              <button
                key={pid}
                onClick={() => setFilterProjectId(pid)}
                className={`border-2 border-border-strong px-4 py-2 font-data-mono font-bold text-xs tracking-widest uppercase transition-colors ${
                  filterProjectId === pid ? "bg-brand-green text-on-brand-green" : "bg-bg-panel-alt text-text-main hover:bg-border-subtle"
                }`}
              >
                {projectName(pid)}
              </button>
            ))}
          </div>

          <div className="border-4 border-border-strong bg-bg-base shadow-[8px_8px_0px_0px_var(--shadow-strong)] overflow-x-auto">
            <div className="min-w-[640px]">
              {groups.map((group) => (
                <div key={group.projectId}>
                  <div className="bg-bg-panel-alt text-text-main px-6 py-3 flex items-center justify-between border-b-4 border-border-strong">
                    <div className="flex items-center gap-3">
                      <span className="bg-brand-green text-on-brand-green font-data-mono font-bold text-[10px] tracking-widest px-2 py-1">PROJECT</span>
                      <div className="font-black text-base tracking-wide">{group.name}</div>
                    </div>
                    <div className="font-data-mono text-[11px] text-text-muted">
                      {group.invoices.length} {group.invoices.length === 1 ? "INVOICE" : "INVOICES"} · {formatINR(group.total)} BILLED
                    </div>
                  </div>
                  <div className="grid grid-cols-[64px_1fr_100px_120px_120px_28px] bg-bg-panel-alt border-b-2 border-border-strong font-data-mono text-[10px] tracking-widest text-text-muted font-bold">
                    <div className="p-3">INVOICE</div>
                    <div className="p-3">DESCRIPTION</div>
                    <div className="p-3">DATE</div>
                    <div className="p-3">STATUS</div>
                    <div className="p-3 text-right">AMOUNT</div>
                    <div />
                  </div>
                  {group.invoices.map((inv) => (
                    <button
                      key={inv.id}
                      onClick={() => openInvoice(inv.id)}
                      className="w-full text-left grid grid-cols-[64px_1fr_100px_120px_120px_28px] items-center border-b-2 border-border-subtle hover:bg-bg-panel-alt transition-colors"
                    >
                      <div className="p-4 font-data-mono font-bold text-sm">#{String(inv.id).padStart(5, "0")}</div>
                      <div className="p-4 font-bold text-sm truncate">
                        {inv.notes || `${inv.line_items.length} line item${inv.line_items.length === 1 ? "" : "s"}`}
                      </div>
                      <div className="p-4 font-data-mono text-xs text-text-muted">{formatDate(inv.finalized_at ?? inv.created_at)}</div>
                      <div className="p-4"><InvoiceStatusTag status={inv.status} /></div>
                      <div className="p-4 text-right font-data-mono font-bold text-base">{formatINR(inv.total)}</div>
                      <div className="p-4 flex justify-center">
                        <span className="material-symbols-outlined text-lg text-text-muted">chevron_right</span>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
