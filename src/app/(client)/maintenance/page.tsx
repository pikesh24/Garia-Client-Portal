"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL, apiRequest, ApiError, getAccessToken, formatApiError } from "@/lib/api";
import { FeatureRequest, InfrastructureCostEntry, MaintenanceRecord } from "@/lib/types";
import { StatusBadge } from "@/components/ui";
import { useProject } from "@/lib/project-context";
import { formatDate } from "@/lib/date";
import { useWsEvent } from "@/components/WebSocketProvider";

type Tab = "costs" | "compliance";

const PAYABLE_STATUSES = new Set(["pending", "rejected"]);

export default function MaintenancePage() {
  const { projects } = useProject();
  const [tab, setTab] = useState<Tab>("compliance");
  const maintenanceVersion = useWsEvent("maintenance");
  const featureRequestsVersion = useWsEvent("feature_requests");
  const [infraCosts, setInfraCosts] = useState<InfrastructureCostEntry[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [features, setFeatures] = useState<FeatureRequest[]>([]);
  const [loadedAt, setLoadedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Bulk payment console state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    if (projects.length === 0) return;
    const [costsByProject, recs, featuresByProject] = await Promise.all([
      Promise.all(
        projects.map((p) => apiRequest<InfrastructureCostEntry[]>(`/api/projects/${p.id}/maintenance/infrastructure-costs`))
      ),
      apiRequest<MaintenanceRecord[]>(`/api/maintenance/records`),
      Promise.all(projects.map((p) => apiRequest<FeatureRequest[]>(`/api/projects/${p.id}/feature-requests`))),
    ]);
    setInfraCosts(costsByProject.flat());
    setRecords(recs);
    setFeatures(featuresByProject.flat());
    setLoadedAt(Date.now());
    // Everything owed starts pre-selected so the pay console is ready to go
    // immediately -- most clients just want to pay what's due, not hand-pick it.
    setSelectedIds(new Set(recs.filter((r) => PAYABLE_STATUSES.has(r.status)).map((r) => r.id)));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.length, maintenanceVersion, featureRequestsVersion]);

  function projectName(id: number): string {
    return projects.find((p) => p.id === id)?.name ?? `Project #${id}`;
  }

  function daysRemaining(deadline: string | null): number | null {
    if (!deadline || !loadedAt) return null;
    const ms = new Date(deadline).getTime() - loadedAt;
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  const recordsByProject = useMemo(() => {
    const byProject = new Map<number, MaintenanceRecord[]>();
    for (const r of records) {
      const list = byProject.get(r.project_id) ?? [];
      list.push(r);
      byProject.set(r.project_id, list);
    }
    return Array.from(byProject.entries())
      .map(([projectId, recs]) => ({
        projectId,
        name: projectName(projectId),
        records: [...recs].sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [records, projects]);

  const costsByProject = useMemo(() => {
    const byProject = new Map<number, InfrastructureCostEntry[]>();
    for (const c of infraCosts) {
      const list = byProject.get(c.project_id) ?? [];
      list.push(c);
      byProject.set(c.project_id, list);
    }
    return Array.from(byProject.entries())
      .map(([projectId, costs]) => ({ projectId, name: projectName(projectId), costs }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [infraCosts, projects]);

  const payableRecords = useMemo(() => records.filter((r) => PAYABLE_STATUSES.has(r.status)), [records]);
  const selectedRecords = useMemo(() => records.filter((r) => selectedIds.has(r.id)), [records, selectedIds]);
  const selectedTotal = useMemo(() => selectedRecords.reduce((sum, r) => sum + r.amount, 0), [selectedRecords]);
  const outstandingTotal = useMemo(() => payableRecords.reduce((sum, r) => sum + r.amount, 0), [payableRecords]);

  // Per-project breakdown of what's owed -- so "pay it all" doesn't hide which
  // project(s) and which cycle(s) make up the number being charged.
  const outstandingByProject = useMemo(() => {
    const byProject = new Map<number, MaintenanceRecord[]>();
    for (const r of payableRecords) {
      const list = byProject.get(r.project_id) ?? [];
      list.push(r);
      byProject.set(r.project_id, list);
    }
    return Array.from(byProject.entries())
      .map(([projectId, recs]) => ({
        projectId,
        name: projectName(projectId),
        cycles: [...recs].sort((a, b) => a.cycle_year - b.cycle_year),
        total: recs.reduce((sum, r) => sum + r.amount, 0),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [payableRecords, projects]);

  // Explains where a cycle's fixed amount comes from: it's a snapshot of the project's
  // annual maintenance rate at billing time, optionally adjusted by admins (e.g. to roll
  // in infrastructure overhead). Comparing to the project's *current* rate makes any such
  // adjustment visible instead of leaving the number unexplained.
  function amountBreakdown(r: MaintenanceRecord): string {
    const project = projects.find((p) => p.id === r.project_id);
    if (!project || project.maintenance_price == null) {
      return "Fixed annual maintenance fee, locked in when this cycle was billed.";
    }
    const diff = r.amount - project.maintenance_price;
    if (Math.abs(diff) < 0.01) {
      return `Matches ${project.name}'s standard annual maintenance rate (₹${project.maintenance_price.toFixed(2)}/yr).`;
    }
    if (diff > 0) {
      return `${project.name}'s base rate (₹${project.maintenance_price.toFixed(2)}/yr) + ₹${diff.toFixed(2)} added by admin (see Cost Breakdown tab).`;
    }
    return `Adjusted from ${project.name}'s current base rate (₹${project.maintenance_price.toFixed(2)}/yr) by admin.`;
  }

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllOutstanding() {
    setSelectedIds(new Set(payableRecords.map((r) => r.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setVoucherFile(null);
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVoucherFile(e.target.files?.[0] || null);
  };

  async function submitProof(ids: number[], file: File | null) {
    if (ids.length === 0) return;
    if (!file) {
      setError("Please attach a payment receipt before submitting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const form = new FormData();
    form.append("voucher", file);
    form.append("record_ids", ids.join(","));
    try {
      const res = await fetch(`${API_BASE_URL}/api/maintenance/records/bulk-submit-proof`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        body: form,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new ApiError(res.status, data.detail);
      }
      clearSelection();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err, "Could not submit proof") : "Could not submit proof");
    } finally {
      setSubmitting(false);
    }
  }

  function submitSelected() {
    submitProof(Array.from(selectedIds), voucherFile);
  }

  return (
    <div className="space-y-12 pb-24">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 mb-8 border-b-4 border-border-strong pb-8">
        <div>
          <h1 className="font-display-xl text-5xl md:text-6xl font-black uppercase text-text-main leading-none tracking-tight">
            Maintenance <br/>&<br/> Fees
          </h1>
          <p className="font-data-mono text-xs text-text-muted normal-case tracking-normal leading-relaxed mt-4 max-w-lg">
            You pay one maintenance fee per project each year. <span className="font-bold text-text-main">Payments</span>{" "}shows what&apos;s due and lets you pay it. <span className="font-bold text-text-main">Cost Breakdown</span>{" "}is just a reference explaining what that fee covers — you&apos;re never charged separately for it.
          </p>
        </div>
        <div className="font-data-mono text-sm text-text-muted">
          {records.length} payment{records.length === 1 ? "" : "s"} across {recordsByProject.length} project{recordsByProject.length === 1 ? "" : "s"}
        </div>
      </div>

      {payableRecords.length > 0 && (
        <div className="bg-text-main border-4 border-border-strong shadow-[8px_8px_0px_0px_var(--shadow-strong)] p-6 md:p-8 mb-12 space-y-6">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-coral-red text-3xl animate-pulse">warning</span>
                <h2 className="font-data-mono text-coral-red font-black uppercase tracking-widest text-sm">PAYMENTS DUE</h2>
              </div>
              <div className="font-black text-white text-4xl md:text-5xl mt-2">
                ₹{outstandingTotal.toFixed(2)}
              </div>
              <div className="font-data-mono text-white/70 font-bold uppercase tracking-widest text-xs mt-2">
                {payableRecords.length} PAYMENT{payableRecords.length === 1 ? "" : "S"} DUE ACROSS {outstandingByProject.length} PROJECT{outstandingByProject.length === 1 ? "" : "S"}
              </div>
            </div>

            {tab !== "compliance" && (
              <div className="flex items-center">
                <button
                  onClick={() => setTab("compliance")}
                  className="bg-brand-green text-on-brand-green font-black text-sm uppercase px-8 py-4 border-4 border-brand-green shadow-[6px_6px_0px_0px_var(--forest-green)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  GO TO PAYMENTS
                </button>
              </div>
            )}
          </div>

          {/* Itemized breakdown: exactly which projects/cycles make up the total above */}
          <div className="border-t-2 border-white/20 pt-5">
            <div className="font-data-mono text-[10px] uppercase tracking-widest text-white/50 mb-3">
              How this total is made up
            </div>
            <div className="space-y-2">
              {outstandingByProject.map((p) => (
                <div key={p.projectId} className="flex items-center justify-between gap-4 font-data-mono text-sm">
                  <div className="text-white/90">
                    <span className="font-black text-lg uppercase text-white">{p.name}</span>
                    <span className="text-white/50 ml-2">
                      · for {p.cycles.map((c) => c.cycle_year).join(", ")}
                    </span>
                  </div>
                  {outstandingByProject.length > 1 && (
                    <span className="font-bold text-white whitespace-nowrap">₹{p.total.toFixed(2)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 border-b-4 border-border-strong pb-6 mb-8">
        <button
          onClick={() => setTab("compliance")}
          className={`border-4 border-border-strong px-8 py-4 font-bold uppercase transition-all flex-1 md:flex-none text-center
            ${tab === "compliance"
              ? "bg-[var(--footer-strip)] text-white shadow-[6px_6px_0px_0px_var(--shadow-strong)] translate-x-[-2px] translate-y-[-2px]"
              : "bg-bg-panel-alt text-text-main hover:bg-border-strong/10"
            }`}
        >
          Payments
        </button>
        <button
          onClick={() => setTab("costs")}
          className={`border-4 border-border-strong px-8 py-4 font-bold uppercase transition-all flex-1 md:flex-none text-center
            ${tab === "costs"
              ? "bg-[var(--footer-strip)] text-white shadow-[6px_6px_0px_0px_var(--shadow-strong)] translate-x-[-2px] translate-y-[-2px]"
              : "bg-bg-panel-alt text-text-main hover:bg-border-strong/10"
            }`}
        >
          Cost Breakdown
        </button>
      </div>

      {error && (
        <div className="border-4 border-coral-red bg-coral-red/10 p-6 flex items-start gap-4">
          <span className="material-symbols-outlined text-coral-red text-3xl">warning</span>
          <div>
            <h4 className="font-data-mono font-bold text-coral-red uppercase tracking-widest text-sm mb-1">SOMETHING WENT WRONG</h4>
            <p className="font-mono text-coral-red">{error}</p>
          </div>
        </div>
      )}

      {tab === "costs" && (
        <div className="space-y-6">
          <div className="bg-bg-panel-alt border-4 border-forest-green shadow-[8px_8px_0px_0px_var(--forest-green)] p-6 flex items-start gap-4">
            <span className="material-symbols-outlined text-forest-green text-3xl shrink-0">info</span>
            <div>
              <h3 className="font-data-mono font-black text-forest-green uppercase tracking-widest text-xs mb-2">Reference only — not a separate bill</h3>
              <p className="text-text-main text-sm leading-relaxed">
                This is just a breakdown of what typically goes into your annual maintenance fee — things like hosting and upkeep for each feature. You are not billed for these individually. If an admin ever needs to adjust your fee because of these costs, you&apos;ll see it clearly explained on the <span className="font-bold">Payments</span>{" "}tab as part of that year&apos;s total.
              </p>
            </div>
          </div>
          {costsByProject.length === 0 ? (
            <div className="bg-bg-base border-4 border-border-strong shadow-[8px_8px_0px_0px_var(--shadow-strong)] p-12 text-center">
              <span className="material-symbols-outlined text-text-muted/30 text-5xl mb-4">warning</span>
              <p className="font-data-mono uppercase tracking-widest font-bold text-text-muted">No cost breakdown available yet.</p>
            </div>
          ) : (
            costsByProject.map((group) => {
              const rate = projects.find((p) => p.id === group.projectId)?.maintenance_price ?? null;
              const breakdownSubtotal = group.costs.reduce((sum, c) => sum + c.monthly_overhead_price, 0) * 12;
              const combinedTotal = (rate ?? 0) + breakdownSubtotal;
              return (
                <div key={group.projectId} className="bg-bg-base border-4 border-border-strong shadow-[8px_8px_0px_0px_var(--shadow-strong)]">
                  <div className="bg-text-main p-4 flex flex-wrap justify-between items-center gap-3">
                    <div className="flex items-center gap-3">
                      <span className="bg-brand-green text-on-brand-green font-data-mono font-bold text-[10px] tracking-widest px-2 py-1">PROJECT</span>
                      <h3 className="font-data-mono text-white text-xs font-black uppercase tracking-widest">{group.name}</h3>
                    </div>
                    {rate != null && (
                      <span className="font-data-mono text-[10px] text-white/60 uppercase tracking-widest">
                        Base annual maintenance rate: ₹{rate.toFixed(2)}/yr
                      </span>
                    )}
                  </div>

                  {/* Each cost item as its own line, yearly cost as the one headline number -- monthly is just a small reference underneath */}
                  <div>
                    {group.costs.map((c) => (
                      <div key={c.id} className="flex items-start justify-between gap-4 p-6 border-b-2 border-border-strong/30 hover:bg-bg-panel-alt transition-colors">
                        <div>
                          <div className="font-bold text-lg text-text-main">{c.module}</div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <span className="border-2 border-border-strong/50 px-2 py-1 font-data-mono text-[10px] uppercase font-bold text-text-muted">
                              {features.find((f) => f.id === c.feature_request_id)?.name ?? "General / Core"}
                            </span>
                            <span className="border-2 border-border-strong/50 px-2 py-1 font-data-mono text-[10px] uppercase font-bold text-text-muted">
                              {c.billing_type}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-black text-xl text-text-main">
                            ₹{(c.monthly_overhead_price * 12).toFixed(2)}<span className="text-sm text-text-muted ml-1">/yr</span>
                          </div>
                          <div className="font-data-mono text-[10px] text-text-muted mt-1">₹{c.monthly_overhead_price.toFixed(2)} per month</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary: base price and breakdown shown as full-width rows matching the line items above, then a combined total bar closing out the card */}
                  {(rate != null || group.costs.length > 1) && (
                  <div className="bg-bg-panel-alt">
                    {rate != null && (
                      <div className="flex items-center justify-between gap-4 p-6 border-b-2 border-border-strong/30">
                        <div className="font-bold text-lg text-text-main">Base Maintenance Price</div>
                        <div className="font-mono font-black text-xl text-text-main">
                          ₹{rate.toFixed(2)}<span className="text-sm text-text-muted ml-1">/yr</span>
                        </div>
                      </div>
                    )}
                    {group.costs.length > 1 && (
                      <div className="flex items-center justify-between gap-4 p-6 border-b-2 border-border-strong/30">
                        <div className="font-bold text-lg text-text-main">Cost Breakdown Subtotal</div>
                        <div className="font-mono font-black text-xl text-text-main">
                          ₹{breakdownSubtotal.toFixed(2)}<span className="text-sm text-text-muted ml-1">/yr</span>
                        </div>
                      </div>
                    )}
                    {rate != null && (
                      <div className="flex items-center justify-between gap-4 p-6 bg-text-main text-white">
                        <div>
                          <div className="font-black text-lg uppercase tracking-wide">Combined Total (Reference)</div>
                          <div className="font-data-mono text-[10px] text-white/50 normal-case mt-1">Base + Cost Breakdown — see Payments tab for what you actually owe</div>
                        </div>
                        <div className="font-black text-3xl text-forest-green whitespace-nowrap">
                          ₹{combinedTotal.toFixed(2)}<span className="text-sm text-white/50 ml-1">/yr</span>
                        </div>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "compliance" && (
        <div className="space-y-6">
          {/* Outstanding summary + bulk-select control */}
          {payableRecords.length > 0 && (
            <div className="bg-text-main text-white border-4 border-border-strong shadow-[8px_8px_0px_0px_var(--shadow-strong)] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="font-data-mono text-[11px] uppercase tracking-widest opacity-70 mb-1">Outstanding Across All Projects</div>
                <div className="font-black text-3xl">
                  ₹{outstandingTotal.toFixed(2)}
                  <span className="font-data-mono text-sm font-bold opacity-70 ml-3">
                    {payableRecords.length} PAYMENT{payableRecords.length === 1 ? "" : "S"}
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                {selectedIds.size > 0 ? (
                  <button
                    onClick={clearSelection}
                    className="border-2 border-white/40 px-6 py-3 font-data-mono font-bold text-xs tracking-widest uppercase hover:bg-white/10 transition-colors"
                  >
                    Clear Selection
                  </button>
                ) : null}
                <button
                  onClick={selectAllOutstanding}
                  className="bg-brand-green text-on-brand-green border-2 border-white px-6 py-3 font-data-mono font-bold text-xs tracking-widest uppercase hover:opacity-90 transition-opacity"
                >
                  Select All Outstanding
                </button>
              </div>
            </div>
          )}

          {/* Bulk payment console */}
          {selectedIds.size > 0 && (
            <div className="bg-bg-panel-alt border-4 border-forest-green shadow-[8px_8px_0px_0px_var(--forest-green)] p-6">
              <div className="flex flex-col md:flex-row gap-6 items-center">
                <div className="flex-shrink-0">
                  <div className="font-data-mono text-[10px] uppercase tracking-widest text-text-muted mb-1">Pay Selected</div>
                  <div className="font-black text-2xl">
                    {selectedIds.size} <span className="text-sm font-bold text-text-muted">SELECTED</span> · ₹{selectedTotal.toFixed(2)}
                  </div>
                </div>

                <div className="flex-1 w-full">
                  <label className="font-data-mono text-xs font-black uppercase tracking-widest block mb-3 text-text-muted">
                    Upload one receipt — it covers all payments selected above
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      id="bulk-voucher-file"
                      className="hidden"
                      onChange={handleFileChange}
                      ref={fileInputRef}
                    />
                    <label
                      htmlFor="bulk-voucher-file"
                      className={`w-full flex items-center justify-between p-4 border-4 cursor-pointer transition-colors ${
                        voucherFile
                          ? "border-forest-green bg-forest-green/10"
                          : "border-border-strong bg-white hover:border-text-main"
                      }`}
                    >
                      <span className={`font-mono font-bold truncate pr-4 ${voucherFile ? "text-forest-green" : "text-text-muted"}`}>
                        {voucherFile ? voucherFile.name : "CHOOSE RECEIPT FILE..."}
                      </span>
                      <span className="material-symbols-outlined font-black">
                        {voucherFile ? "check_circle" : "upload_file"}
                      </span>
                    </label>
                  </div>
                </div>

                <div className="w-full md:w-auto">
                  <button
                    onClick={submitSelected}
                    disabled={submitting || !voucherFile}
                    className={`w-full font-black text-sm uppercase px-8 py-4 border-4 transition-all flex items-center justify-center gap-2
                      ${voucherFile
                        ? "bg-[var(--footer-strip)] text-white border-text-main shadow-[6px_6px_0px_0px_var(--forest-green)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none cursor-pointer"
                        : "bg-bg-panel-alt text-text-muted border-border-strong cursor-not-allowed opacity-50"
                      }
                    `}
                  >
                    {submitting ? (
                      <>UPLOADING...</>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">send</span>
                        PAY {selectedIds.size} SELECTED
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {recordsByProject.length === 0 ? (
            <div className="bg-bg-base border-4 border-border-strong shadow-[8px_8px_0px_0px_var(--shadow-strong)] p-12 text-center">
              <span className="material-symbols-outlined text-text-muted/30 text-5xl mb-4">task</span>
              <p className="font-data-mono uppercase tracking-widest font-bold text-text-muted">No maintenance payments yet.</p>
            </div>
          ) : (
            recordsByProject.map((group) => (
              <div key={group.projectId} className="bg-bg-base border-4 border-border-strong shadow-[8px_8px_0px_0px_var(--shadow-strong)] p-1">
                <div className="bg-text-main p-4 flex items-center gap-3">
                  <span className="bg-brand-green text-on-brand-green font-data-mono font-bold text-[10px] tracking-widest px-2 py-1">PROJECT</span>
                  <h3 className="font-data-mono text-white text-xs font-black uppercase tracking-widest">{group.name}</h3>
                </div>

                <div className="p-4 space-y-6">
                  {group.records.map((r) => {
                    const remaining = daysRemaining(r.penalty_deadline);
                    const isRejected = r.status === "rejected";
                    const payable = PAYABLE_STATUSES.has(r.status);
                    const isSelected = selectedIds.has(r.id);

                    return (
                      <div
                        key={r.id}
                        className={`border-4 ${isRejected ? "border-coral-red shadow-[8px_8px_0px_0px_var(--coral-red)]" : isSelected ? "border-forest-green shadow-[8px_8px_0px_0px_var(--forest-green)]" : "border-border-strong shadow-[8px_8px_0px_0px_var(--shadow-strong)]"} relative overflow-hidden transition-all`}
                      >
                        {isRejected && (
                          <div className="bg-coral-red text-white p-4 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <span className="material-symbols-outlined text-3xl">error</span>
                              <div>
                                <div className="font-data-mono text-xs font-black uppercase tracking-widest opacity-80">PAYMENT REJECTED</div>
                                <div className="font-bold text-lg mt-1">{r.rejection_reason}</div>
                              </div>
                            </div>

                            {remaining !== null && (
                              <div className="bg-white/10 border-2 border-white p-3 text-center min-w-[120px]">
                                <div className="font-data-mono text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">DAYS LEFT TO FIX</div>
                                <div className="font-mono font-black text-3xl tabular-nums tracking-tighter">
                                  {remaining}<span className="text-base opacity-70 ml-1">d</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="p-6 bg-bg-base flex gap-4">
                          {payable && (
                            <div className="pt-1">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelected(r.id)}
                                className="w-7 h-7 border-4 border-border-strong rounded-none cursor-pointer accent-forest-green hover:scale-110 transition-transform shadow-[3px_3px_0px_0px_var(--shadow-strong)]"
                                aria-label={`Select ${r.cycle_year} payment`}
                              />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h4 className="font-headline-lg font-black text-3xl uppercase">
                                  {r.cycle_year} Maintenance Fee
                                </h4>
                                <div className="font-data-mono text-sm text-text-muted mt-2 uppercase font-bold flex items-center gap-2">
                                  <span className="material-symbols-outlined text-sm">calendar_today</span>
                                  DUE: {formatDate(r.due_date)}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-3 max-w-[320px]">
                                <StatusBadge status={r.status} />
                                <span className="font-black text-4xl">₹{r.amount.toFixed(2)}</span>
                                <p className="font-data-mono text-sm font-semibold text-text-main text-right leading-snug normal-case tracking-normal">
                                  {amountBreakdown(r)}
                                </p>
                              </div>
                            </div>

                            {r.status === "proof_submitted" && (
                              <div className="mt-4 p-6 border-4 border-border-strong border-dashed bg-bg-panel-alt flex items-center gap-4 justify-center">
                                <div className="w-6 h-6 border-4 border-t-text-main border-border-strong rounded-full animate-spin"></div>
                                <span className="font-data-mono font-bold uppercase tracking-widest text-sm">RECEIPT SUBMITTED. WAITING FOR APPROVAL.</span>
                              </div>
                            )}

                            {payable && (
                              <div className="mt-2 font-data-mono text-xs text-text-muted uppercase tracking-widest">
                                {isSelected ? "✓ Selected for payment below" : "Select the checkbox to include in a payment"}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
