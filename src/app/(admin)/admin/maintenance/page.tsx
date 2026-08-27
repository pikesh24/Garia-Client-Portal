"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiRequest, ApiError, fileUrl } from "@/lib/api";
import { FeatureRequest, InfrastructureCostEntry, MaintenanceRecord, Project, User } from "@/lib/types";
import { Alert, StatusBadge } from "@/components/ui";
import { useConfirm } from "@/lib/confirm";
import { BrutalistSelect } from "@/components/BrutalistSelect";
import { AdminProjectFilter, ProjectFilterValue, useAdminProjectFilter } from "@/components/AdminProjectFilter";
import { BrutalistDatePicker } from "@/components/BrutalistDatePicker";
import { formatDate } from "@/lib/date";
import { useWsEvent } from "@/components/WebSocketProvider";

type Tab = "costs" | "compliance";

export default function AdminMaintenancePage() {
  const [tab, setTab] = useState<Tab>("compliance");
  const [filter, setFilter] = useAdminProjectFilter();
  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 mb-8 border-b-4 border-border-strong pb-8">
        <div>
          <h1 className="font-display-xl text-5xl font-black uppercase text-text-main leading-none tracking-tight">
            Maintenance & Fees
          </h1>
          <p className="font-data-mono text-sm uppercase tracking-widest text-text-muted mt-4">
            Manage what clients pay for maintenance and review their payment proofs
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 border-b-4 border-border-strong pb-6">
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

      <AdminProjectFilter value={filter} onChange={setFilter} />

      <div className="min-h-[500px]">
        {tab === "costs" ? <CostsTab filter={filter} /> : <ComplianceTab filter={filter} />}
      </div>
    </div>
  );
}

function CostsTab({ filter }: { filter: ProjectFilterValue }) {
  const [clients, setClients] = useState<User[]>([]);
  const [features, setFeatures] = useState<FeatureRequest[]>([]);
  const [costs, setCosts] = useState<InfrastructureCostEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const maintenanceVersion = useWsEvent("maintenance");
  const featureRequestsVersion = useWsEvent("feature_requests");

  const confirm = useConfirm();

  async function loadAll() {
    const costsEndpoint = filter.projectId
      ? `/api/admin/projects/${filter.projectId}/maintenance/infrastructure-costs`
      : "/api/admin/maintenance/infrastructure-costs";
    const [c, f, costData] = await Promise.all([
      apiRequest<User[]>("/api/admin/users"),
      apiRequest<FeatureRequest[]>("/api/admin/feature-requests"),
      apiRequest<InfrastructureCostEntry[]>(costsEndpoint),
    ]);
    setClients(c);
    setFeatures(f);
    setCosts(costData);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, [filter.projectId, maintenanceVersion, featureRequestsVersion]);

  async function removeCost(id: number) {
    const ok = await confirm({
      message: "Delete this cost item? This can't be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiRequest(`/api/admin/maintenance/infrastructure-costs/${id}`, { method: "DELETE" });
      await loadAll();
    } catch (err) {
      toast.error("Failed to delete cost");
    }
  }

  return (
    <div className="space-y-12">
      {/* Registry */}
      <div>
        <h3 className="font-display-xl text-3xl font-black uppercase text-text-main mb-6 border-b-4 border-border-strong pb-4">
          Cost Items
        </h3>

        {loading ? (
          <p className="font-data-mono text-text-muted">Loading...</p>
        ) : costs.length === 0 ? (
          <div className="border-4 border-border-strong border-dashed p-12 text-center bg-bg-panel-alt">
             <p className="font-data-mono uppercase tracking-widest font-bold">No cost items yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {costs.map((c) => {
              const client = clients.find(u => u.id === c.client_id);
              const feature = features.find(f => f.id === c.feature_request_id);
              return (
                <div key={c.id} className="border-4 border-border-strong bg-bg-base flex flex-col shadow-[8px_8px_0px_0px_var(--shadow-strong)] relative overflow-hidden">
                  <div className="p-6 relative z-10 flex-1">
                    <div className="flex justify-between items-start mb-6">
                      <h4 className="font-headline-lg font-black text-2xl uppercase w-2/3 truncate">
                        {c.module}
                      </h4>
                    </div>

                    <div className="space-y-4 font-data-mono text-sm">
                      <div className="flex justify-between border-b-2 border-border-strong/30 pb-2">
                        <span className="text-text-muted uppercase font-bold">Client</span>
                        <span className="font-bold">{client?.full_name ?? `#${c.client_id}`}</span>
                      </div>
                      <div className="flex justify-between border-b-2 border-border-strong/30 pb-2">
                        <span className="text-text-muted uppercase font-bold">Feature</span>
                        <span className="font-bold">{feature ? feature.name : "N/A"}</span>
                      </div>
                      <div className="flex justify-between border-b-2 border-border-strong/30 pb-2">
                        <span className="text-text-muted uppercase font-bold">Billing Type</span>
                        <span className="font-bold">{c.billing_type}</span>
                      </div>
                      <div className="pt-2 space-y-1">
                        <div className="flex justify-between items-baseline">
                          <span className="text-text-muted uppercase font-black">Monthly Cost</span>
                          <span className="font-black text-2xl text-brand-green">
                            ₹{c.monthly_overhead_price.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-text-muted uppercase font-bold text-xs">Yearly Cost (× 12)</span>
                          <span className="font-bold text-text-muted">
                            ₹{(c.monthly_overhead_price * 12).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-bg-panel-alt border-t-4 border-border-strong flex justify-end relative z-10">
                    <button onClick={() => removeCost(c.id)} className="font-data-mono text-[10px] font-bold uppercase tracking-widest text-coral-red hover:underline flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">delete</span> DELETE
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ComplianceTab({ filter }: { filter: ProjectFilterValue }) {
  const [clients, setClients] = useState<User[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [infraCosts, setInfraCosts] = useState<InfrastructureCostEntry[]>([]);
  const [clientProjects, setClientProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [clientId, setClientId] = useState("");
  const [cycleYear, setCycleYear] = useState(new Date().getFullYear().toString());
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const confirm = useConfirm();
  const maintenanceVersion = useWsEvent("maintenance");

  async function loadAll() {
    const recordsEndpoint = filter.projectId
      ? `/api/admin/projects/${filter.projectId}/maintenance/records`
      : "/api/admin/maintenance/records";
    const [c, r, ic] = await Promise.all([
      apiRequest<User[]>("/api/admin/users"),
      apiRequest<MaintenanceRecord[]>(recordsEndpoint),
      apiRequest<InfrastructureCostEntry[]>("/api/admin/maintenance/infrastructure-costs"),
    ]);
    setClients(c);
    setRecords(r);
    setInfraCosts(ic);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, [filter.projectId, maintenanceVersion]);

  useEffect(() => {
    if (filter.clientId) setClientId(filter.clientId);
  }, [filter.clientId]);

  useEffect(() => {
    if (!clientId) {
      setClientProjects([]);
      return;
    }
    apiRequest<Project[]>(`/api/admin/users/${clientId}/projects`).then(setClientProjects);
  }, [clientId]);

  // Maintenance price is per-project now: use the filter's project if one is selected,
  // otherwise fall back to the client's most recently created project (matching the
  // server-side resolution used when POSTing to the client-scoped /records endpoint).
  const selectedProject = filter.projectId
    ? clientProjects.find((p) => String(p.id) === filter.projectId)
    : clientProjects[0];
  const clientInfraCosts = infraCosts.filter((c) => c.client_id === Number(clientId));
  const monthlyInfraTotal = clientInfraCosts.reduce((sum, c) => sum + c.monthly_overhead_price, 0);
  const annualInfraTotal = monthlyInfraTotal * 12;
  const basePrice = selectedProject?.maintenance_price ?? 0;
  const suggestedAmount = Math.round((basePrice + annualInfraTotal) * 100) / 100;

  useEffect(() => {
    if (!amountTouched) {
      setAmount(selectedProject && selectedProject.maintenance_price !== null ? String(suggestedAmount) : "");
    }
  }, [clientId, suggestedAmount, amountTouched, selectedProject]);

  async function generateCycle(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clientId || !cycleYear || !dueDate || !amount) {
      setError("Please fill all fields");
      return;
    }
    if (!selectedProject || selectedProject.maintenance_price === null) {
      setError("This client's project does not have a maintenance_price set. Update the project's billing configuration first.");
      return;
    }
    try {
      if (filter.projectId) {
        await apiRequest(`/api/admin/projects/${filter.projectId}/maintenance/records`, {
          method: "POST",
          body: {
            cycle_year: Number(cycleYear),
            due_date: dueDate,
            amount: Number(amount),
          }
        });
      } else {
        await apiRequest("/api/admin/maintenance/records", {
          method: "POST",
          body: {
            client_id: Number(clientId),
            cycle_year: Number(cycleYear),
            due_date: dueDate,
            amount: Number(amount),
          }
        });
      }
      setClientId("");
      setDueDate("");
      setAmount("");
      setAmountTouched(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not create cycle");
    }
  }

  async function approveProof(id: number) {
    const ok = await confirm("Approve this payment? This can't be undone.");
    if (!ok) return;
    try {
      await apiRequest(`/api/admin/maintenance/records/${id}/approve`, { method: "POST" });
      await loadAll();
    } catch (err) {
      toast.error("Failed to approve");
    }
  }

  async function rejectProof(id: number) {
    if (!rejectionReason.trim()) {
      toast.warning("Please provide a rejection reason.");
      return;
    }
    try {
      await apiRequest(`/api/admin/maintenance/records/${id}/reject`, {
        method: "POST",
        body: { rejection_reason: rejectionReason }
      });
      setRejectingId(null);
      setRejectionReason("");
      await loadAll();
    } catch (err) {
      toast.error("Failed to reject");
    }
  }

  const clientOptions = clients.map(c => ({ value: String(c.id), label: `${c.full_name} (${c.email})` }));

  return (
    <div className="space-y-12">
      {/* Creation Form */}
      <div className="border-4 border-border-strong bg-bg-panel-alt p-6 md:p-10 shadow-[12px_12px_0px_0px_var(--shadow-strong)] relative">
        <h3 className="font-data-mono text-lg font-black uppercase tracking-widest text-text-main mb-8 border-b-4 border-border-strong pb-4">
          Create a Payment
        </h3>
        
        <form onSubmit={generateCycle} className="space-y-8">
          {error && <Alert kind="error">{error}</Alert>}
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-50">
            <div className="flex flex-col gap-4 bg-bg-base border-4 border-border-strong p-6 shadow-[6px_6px_0px_0px_var(--shadow-strong)] lg:col-span-1">
              <label className="font-label-caps font-black uppercase tracking-widest text-text-muted">
                Client
              </label>
              {filter.clientId ? (
                <div className="bg-bg-base border-4 border-border-strong p-4 font-bold text-lg text-text-main">
                  {clients.find((c) => String(c.id) === filter.clientId)?.full_name ?? `#${filter.clientId}`}
                  <span className="ml-2 font-data-mono text-[10px] uppercase text-text-muted">(from project filter above)</span>
                </div>
              ) : (
                <BrutalistSelect
                  value={clientId}
                  onChange={setClientId}
                  placeholder="Select a client"
                  options={clientOptions}
                />
              )}
            </div>

            <div className="flex flex-col gap-4 bg-bg-base border-4 border-border-strong p-6 shadow-[6px_6px_0px_0px_var(--shadow-strong)]">
              <label className="font-label-caps font-black uppercase tracking-widest text-text-muted">
                Year
              </label>
              <input
                type="number"
                required
                value={cycleYear}
                onChange={(e) => setCycleYear(e.target.value)}
                className="w-full bg-white border-4 border-border-strong p-4 font-bold text-lg focus:outline-none focus:border-text-main shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <div className="flex flex-col gap-4 bg-bg-base border-4 border-border-strong p-6 shadow-[6px_6px_0px_0px_var(--shadow-strong)]">
              <label className="font-label-caps font-black uppercase tracking-widest text-text-muted">
                Due Date
              </label>
              <BrutalistDatePicker
                required
                value={dueDate}
                onChange={(val) => setDueDate(val)}
                className="w-full font-bold text-lg uppercase"
              />
            </div>
          </div>

          {clientId && (
            <div className="bg-bg-base border-4 border-border-strong p-6 shadow-[6px_6px_0px_0px_var(--shadow-strong)] relative z-0">
              <div className="font-data-mono text-[10px] uppercase tracking-widest text-text-muted mb-4">
                How the suggested amount is calculated (all figures per year)
              </div>
              <div className="font-data-mono text-sm space-y-3 mb-6">
                <div className="flex justify-between items-baseline">
                  <span className="text-text-muted uppercase font-bold">Base Maintenance Price</span>
                  <span className="font-black text-lg">₹{basePrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-text-muted uppercase font-bold">
                    + Cost Breakdown ({clientInfraCosts.length} item{clientInfraCosts.length === 1 ? "" : "s"} × ₹{monthlyInfraTotal.toFixed(2)}/mo × 12)
                  </span>
                  <span className="font-black text-lg">₹{annualInfraTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-baseline border-t-2 border-border-strong/30 pt-3">
                  <span className="text-text-muted uppercase font-black">= Suggested Amount</span>
                  <span className="font-black text-2xl text-brand-green">₹{suggestedAmount.toFixed(2)}</span>
                </div>
              </div>

              <label className="font-label-caps font-black uppercase tracking-widest text-text-muted block mb-4">
                Amount to Charge (editable)
              </label>
              <div className="flex items-center relative">
                <span className="absolute left-5 font-black text-2xl text-text-muted">₹</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setAmountTouched(true);
                  }}
                  className="w-full bg-white border-4 border-border-strong p-4 pl-12 font-data-mono font-black text-2xl focus:outline-none focus:border-text-main shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                {amountTouched && (
                  <button
                    type="button"
                    onClick={() => setAmountTouched(false)}
                    className="absolute right-4 font-data-mono text-[10px] font-bold uppercase tracking-widest text-accent hover:underline"
                  >
                    Reset to Suggested
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              className="bg-[var(--footer-strip)] text-white font-black text-sm uppercase px-8 py-4 border-4 border-text-main shadow-[6px_6px_0px_0px_var(--brand-green)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-3 w-full md:w-auto"
            >
              Create Payment
            </button>
          </div>
        </form>
      </div>

      {/* Compliance Log Matrix */}
      <div>
        <h3 className="font-display-xl text-3xl font-black uppercase text-text-main mb-6 border-b-4 border-border-strong pb-4">
          All Payments
        </h3>

        {loading ? (
          <p className="font-data-mono text-text-muted">Loading...</p>
        ) : records.length === 0 ? (
          <div className="border-4 border-border-strong border-dashed p-12 text-center bg-bg-panel-alt">
             <p className="font-data-mono uppercase tracking-widest font-bold">No payments yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {records.map((r) => {
              const client = clients.find(u => u.id === r.client_id);
              return (
                <div key={r.id} className="border-4 border-border-strong bg-bg-base flex flex-col shadow-[8px_8px_0px_0px_var(--shadow-strong)] relative">
                  <div className="p-6 relative z-10 flex-1">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h4 className="font-headline-lg font-black text-2xl uppercase">
                          {r.cycle_year} Maintenance Fee
                        </h4>
                        <div className="font-data-mono text-sm text-text-muted mt-1 uppercase font-bold">
                          Client: {client?.full_name ?? `#${r.client_id}`}
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <StatusBadge status={r.status} />
                        <span className="font-black text-2xl text-text-main mt-2">
                          ₹{r.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="font-data-mono text-sm border-t-2 border-border-strong/30 pt-4 mb-4">
                      <div className="flex justify-between">
                        <span className="text-text-muted uppercase font-bold">Due Date</span>
                        <span className="font-bold">{formatDate(r.due_date)}</span>
                      </div>
                    </div>

                    {r.proof_file_path && (
                      <div className="mt-4 p-4 bg-bg-panel-alt border-4 border-border-strong flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <span className="font-label-caps font-black text-xs uppercase tracking-widest">PAYMENT RECEIPT</span>
                          <a href={fileUrl(r.proof_file_path)} target="_blank" rel="noreferrer" className="text-accent underline font-data-mono text-sm font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">open_in_new</span> VIEW RECEIPT
                          </a>
                        </div>

                        {r.status === "proof_submitted" && (
                          <div className="mt-4">
                            {rejectingId === r.id ? (
                              <div className="space-y-4">
                                <label className="block font-data-mono text-xs font-bold uppercase tracking-widest text-coral-red">
                                  Reason for Rejection
                                </label>
                                <textarea
                                  value={rejectionReason}
                                  onChange={(e) => setRejectionReason(e.target.value)}
                                  className="w-full border-4 border-coral-red p-3 font-mono text-sm bg-white"
                                  rows={3}
                                />
                                <div className="flex gap-4">
                                  <button onClick={() => rejectProof(r.id)} className="bg-coral-red text-white font-black uppercase px-4 py-2 border-4 border-coral-red flex-1">
                                    Reject
                                  </button>
                                  <button onClick={() => setRejectingId(null)} className="bg-bg-panel-alt font-black uppercase px-4 py-2 border-4 border-border-strong text-text-muted flex-1">
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-4">
                                <button onClick={() => approveProof(r.id)} className="bg-forest-green text-white font-black text-sm uppercase px-4 py-3 flex-1 flex items-center justify-center gap-2 border-4 border-forest-green shadow-[4px_4px_0px_0px_var(--forest-green)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                                  <span className="material-symbols-outlined">check_circle</span>
                                  Approve
                                </button>
                                <button onClick={() => setRejectingId(r.id)} className="bg-coral-red text-white font-black text-sm uppercase px-4 py-3 flex-1 flex items-center justify-center gap-2 border-4 border-coral-red shadow-[4px_4px_0px_0px_var(--coral-red)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                                  <span className="material-symbols-outlined">cancel</span>
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {r.status === "rejected" && r.rejection_reason && (
                          <div className="mt-2 bg-coral-red/10 border-l-4 border-coral-red p-3">
                            <span className="font-data-mono text-[10px] font-bold text-coral-red uppercase block mb-1">Rejection Reason:</span>
                            <span className="font-mono text-sm text-coral-red">{r.rejection_reason}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
