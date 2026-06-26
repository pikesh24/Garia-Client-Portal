"use client";

import { useEffect, useState, useRef } from "react";
import { apiRequest, ApiError, fileUrl } from "@/lib/api";
import { AdminFeatureRequest, InfrastructureCostEntry, MaintenanceRecord, User } from "@/lib/types";
import { Alert, StatusBadge } from "@/components/ui";

type Tab = "costs" | "compliance";

function BrutalistSelect({ value, onChange, options, placeholder }: { value: string, onChange: (val: string) => void, options: {value: string, label: string}[], placeholder: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = options.find(o => String(o.value) === String(value));

  return (
    <div className="relative w-full" ref={ref}>
      <div 
        onClick={() => setOpen(!open)}
        className={`w-full bg-bg-panel-alt border-4 border-border-strong p-4 font-bold text-lg cursor-pointer shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)] flex justify-between items-center transition-colors hover:border-text-main ${open ? "border-text-main" : ""}`}
      >
        <span className={value ? "text-text-main" : "text-text-muted"}>
          {selected ? selected.label : placeholder}
        </span>
        <span className={`material-symbols-outlined font-black transition-transform ${open ? "rotate-180" : ""}`}>
          arrow_drop_down
        </span>
      </div>
      {open && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-bg-base border-4 border-border-strong shadow-[8px_8px_0px_0px_var(--border-strong)] z-50 max-h-64 overflow-y-auto custom-scrollbar flex flex-col">
          {options.map(opt => (
            <div 
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`p-4 font-bold cursor-pointer border-b-2 border-border-strong/30 last:border-b-0 hover:bg-text-main hover:text-white transition-colors ${String(value) === String(opt.value) ? "bg-text-main/10 text-text-main" : "text-text-main"}`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminMaintenancePage() {
  const [tab, setTab] = useState<Tab>("costs");
  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 mb-8 border-b-4 border-border-strong pb-8">
        <div>
          <h1 className="font-display-xl text-5xl font-black uppercase text-text-main leading-none tracking-tight">
            Infrastructure & Maintenance Control
          </h1>
          <p className="font-data-mono text-sm uppercase tracking-widest text-text-muted mt-4">
            System Overhead Allocation & Annual Compliance Verification
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 border-b-4 border-border-strong pb-6">
        <button
          onClick={() => setTab("costs")}
          className={`border-4 border-border-strong px-8 py-4 font-bold uppercase transition-all flex-1 md:flex-none text-center
            ${tab === "costs" 
              ? "bg-text-main text-white shadow-[6px_6px_0px_0px_var(--border-strong)] translate-x-[-2px] translate-y-[-2px]" 
              : "bg-bg-panel-alt text-text-main hover:bg-border-strong/10"
            }`}
        >
          Infrastructure Overhead Register
        </button>
        <button
          onClick={() => setTab("compliance")}
          className={`border-4 border-border-strong px-8 py-4 font-bold uppercase transition-all flex-1 md:flex-none text-center
            ${tab === "compliance" 
              ? "bg-text-main text-white shadow-[6px_6px_0px_0px_var(--border-strong)] translate-x-[-2px] translate-y-[-2px]" 
              : "bg-bg-panel-alt text-text-main hover:bg-border-strong/10"
            }`}
        >
          Annual Maintenance Compliance Center
        </button>
      </div>

      <div className="min-h-[500px]">
        {tab === "costs" ? <CostsTab /> : <ComplianceTab />}
      </div>
    </div>
  );
}

function CostsTab() {
  const [clients, setClients] = useState<User[]>([]);
  const [features, setFeatures] = useState<AdminFeatureRequest[]>([]);
  const [costs, setCosts] = useState<InfrastructureCostEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [clientId, setClientId] = useState("");
  const [featureId, setFeatureId] = useState("");
  const [module, setModule] = useState("");
  const [billingType, setBillingType] = useState("");
  const [overhead, setOverhead] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadAll() {
    const [c, f, costData] = await Promise.all([
      apiRequest<User[]>("/api/admin/users"),
      apiRequest<AdminFeatureRequest[]>("/api/admin/feature-requests"),
      apiRequest<InfrastructureCostEntry[]>("/api/admin/maintenance/infrastructure-costs"),
    ]);
    setClients(c);
    setFeatures(f);
    setCosts(costData);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function deployCost(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !module || !billingType || !overhead) {
      setError("Please fill all required fields");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest("/api/admin/maintenance/infrastructure-costs", {
        method: "POST",
        body: {
          client_id: Number(clientId),
          feature_request_id: featureId ? Number(featureId) : null,
          module,
          billing_type: billingType,
          monthly_overhead_price: Number(overhead),
          description: null
        }
      });
      setModule("");
      setBillingType("");
      setOverhead("");
      setFeatureId("");
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not add overhead cost");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeCost(id: number) {
    if (!confirm("Permanently erase this infrastructure overhead allocation?")) return;
    try {
      await apiRequest(`/api/admin/maintenance/infrastructure-costs/${id}`, { method: "DELETE" });
      await loadAll();
    } catch (err) {
      alert("Failed to delete cost");
    }
  }

  const clientOptions = clients.map(c => ({ value: String(c.id), label: `${c.full_name} (${c.email})` }));
  const featureOptions = [{ value: "", label: "-- NO SPECIFIC FEATURE --" }, ...features.filter(f => f.client_id === Number(clientId)).map(f => ({ value: String(f.id), label: f.name }))];

  return (
    <div className="space-y-12">
      {/* Creation Form */}
      <div className="border-4 border-border-strong bg-bg-panel-alt p-6 md:p-10 shadow-[12px_12px_0px_0px_var(--border-strong)] relative">
        <h3 className="font-data-mono text-lg font-black uppercase tracking-widest text-text-main mb-8 border-b-4 border-border-strong pb-4">
          SYSTEM TERMINAL: ALLOCATE NEW OVERHEAD COST
        </h3>

        <form onSubmit={deployCost} className="space-y-8">
          {error && <Alert kind="error">{error}</Alert>}
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-50">
            <div className="flex flex-col gap-4 bg-bg-base border-4 border-border-strong p-6 shadow-[6px_6px_0px_0px_var(--border-strong)]">
              <label className="font-label-caps font-black uppercase tracking-widest text-text-muted">
                Target Environment Mapping
              </label>
              <BrutalistSelect
                value={clientId}
                onChange={setClientId}
                placeholder="-- SELECT ACTIVE CLIENT --"
                options={clientOptions}
              />
            </div>
            
            <div className="flex flex-col gap-4 bg-bg-base border-4 border-border-strong p-6 shadow-[6px_6px_0px_0px_var(--border-strong)]">
              <label className="font-label-caps font-black uppercase tracking-widest text-text-muted">
                Linked Feature Mapping (Optional)
              </label>
              <BrutalistSelect
                value={featureId}
                onChange={setFeatureId}
                placeholder="-- SELECT LINKED FEATURE --"
                options={featureOptions}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
            <div className="flex flex-col gap-4 bg-bg-base border-4 border-border-strong p-6 shadow-[6px_6px_0px_0px_var(--border-strong)]">
              <label className="font-label-caps font-black uppercase tracking-widest text-text-muted">
                Module Descriptor
              </label>
              <input
                required
                value={module}
                onChange={(e) => setModule(e.target.value)}
                placeholder="e.g. AWS EC2 t3.micro"
                className="w-full bg-white border-4 border-border-strong p-4 font-bold text-lg focus:outline-none focus:border-text-main placeholder:text-text-muted/40 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)]"
              />
            </div>

            <div className="flex flex-col gap-4 bg-bg-base border-4 border-border-strong p-6 shadow-[6px_6px_0px_0px_var(--border-strong)]">
              <label className="font-label-caps font-black uppercase tracking-widest text-text-muted">
                Billing Category
              </label>
              <input
                required
                value={billingType}
                onChange={(e) => setBillingType(e.target.value)}
                placeholder="e.g. Cloud Server / API Usage"
                className="w-full bg-white border-4 border-border-strong p-4 font-bold text-lg focus:outline-none focus:border-text-main placeholder:text-text-muted/40 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)]"
              />
            </div>

            <div className="flex flex-col gap-4 bg-bg-base border-4 border-border-strong p-6 shadow-[6px_6px_0px_0px_var(--border-strong)]">
              <label className="font-label-caps font-black uppercase tracking-widest text-text-muted">
                Evaluated Overheard Price (₹/Month)
              </label>
              <div className="flex-1 flex items-center relative">
                <span className="absolute left-5 font-black text-2xl text-text-muted">₹</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={overhead}
                  onChange={(e) => setOverhead(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-white border-4 border-border-strong p-4 pl-12 font-data-mono font-black text-2xl focus:outline-none focus:border-text-main placeholder:text-text-muted/30 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)]"
                />
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting || !clientId}
              className={`font-black text-sm uppercase px-8 py-4 border-4 transition-all flex items-center justify-center gap-3 w-full md:w-auto
                ${clientId 
                  ? "bg-text-main text-white border-text-main shadow-[6px_6px_0px_0px_var(--coral-red)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none" 
                  : "bg-bg-base text-text-muted border-border-strong cursor-not-allowed opacity-50"
                }`}
            >
              {submitting ? "Allocating Overhead..." : "[ Commit Infrastructure Cost ]"}
            </button>
          </div>
        </form>
      </div>

      {/* Registry */}
      <div>
        <h3 className="font-display-xl text-3xl font-black uppercase text-text-main mb-6 border-b-4 border-border-strong pb-4">
          Deployed Infrastructure Matrix
        </h3>

        {loading ? (
          <p className="font-data-mono text-text-muted">Loading cost registry...</p>
        ) : costs.length === 0 ? (
          <div className="border-4 border-border-strong border-dashed p-12 text-center bg-bg-panel-alt">
             <p className="font-data-mono uppercase tracking-widest font-bold">No active infrastructure costs documented.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {costs.map((c) => {
              const client = clients.find(u => u.id === c.client_id);
              const feature = features.find(f => f.id === c.feature_request_id);
              return (
                <div key={c.id} className="border-4 border-border-strong bg-bg-base flex flex-col shadow-[8px_8px_0px_0px_var(--border-strong)] relative overflow-hidden">
                  <div className="p-6 relative z-10 flex-1">
                    <div className="flex justify-between items-start mb-6">
                      <h4 className="font-headline-lg font-black text-2xl uppercase w-2/3 truncate">
                        {c.module}
                      </h4>
                      <div className="px-3 py-1 font-data-mono text-[10px] font-bold uppercase tracking-widest border-2 bg-text-main text-white border-text-main">
                        ACTIVE RECORD
                      </div>
                    </div>

                    <div className="space-y-4 font-data-mono text-sm">
                      <div className="flex justify-between border-b-2 border-border-strong/30 pb-2">
                        <span className="text-text-muted uppercase font-bold">Environment Owner</span>
                        <span className="font-bold">{client?.full_name ?? `#${c.client_id}`}</span>
                      </div>
                      <div className="flex justify-between border-b-2 border-border-strong/30 pb-2">
                        <span className="text-text-muted uppercase font-bold">Linked Feature</span>
                        <span className="font-bold">{feature ? feature.name : "N/A"}</span>
                      </div>
                      <div className="flex justify-between border-b-2 border-border-strong/30 pb-2">
                        <span className="text-text-muted uppercase font-bold">Billing Architecture</span>
                        <span className="font-bold">{c.billing_type}</span>
                      </div>
                      <div className="flex justify-between pt-2">
                        <span className="text-text-muted uppercase font-black">Monthly Overhead Evaluated</span>
                        <span className="font-black text-2xl text-coral-red">
                          ₹{c.monthly_overhead_price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-bg-panel-alt border-t-4 border-border-strong flex justify-end relative z-10">
                    <button onClick={() => removeCost(c.id)} className="font-data-mono text-[10px] font-bold uppercase tracking-widest text-coral-red hover:underline flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">delete</span> ERASE ENTRY (DELETE)
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

function ComplianceTab() {
  const [clients, setClients] = useState<User[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [infraCosts, setInfraCosts] = useState<InfrastructureCostEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [clientId, setClientId] = useState("");
  const [cycleYear, setCycleYear] = useState(new Date().getFullYear().toString());
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  async function loadAll() {
    const [c, r, ic] = await Promise.all([
      apiRequest<User[]>("/api/admin/users"),
      apiRequest<MaintenanceRecord[]>("/api/admin/maintenance/records"),
      apiRequest<InfrastructureCostEntry[]>("/api/admin/maintenance/infrastructure-costs"),
    ]);
    setClients(c);
    setRecords(r);
    setInfraCosts(ic);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const selectedClient = clients.find((c) => c.id === Number(clientId));
  const clientInfraCosts = infraCosts.filter((c) => c.client_id === Number(clientId));
  const monthlyInfraTotal = clientInfraCosts.reduce((sum, c) => sum + c.monthly_overhead_price, 0);
  const annualInfraTotal = monthlyInfraTotal * 12;
  const basePrice = selectedClient?.maintenance_price ?? 0;
  const suggestedAmount = Math.round((basePrice + annualInfraTotal) * 100) / 100;

  useEffect(() => {
    if (!amountTouched) {
      setAmount(selectedClient && selectedClient.maintenance_price !== null ? String(suggestedAmount) : "");
    }
  }, [clientId, suggestedAmount, amountTouched, selectedClient]);

  async function generateCycle(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clientId || !cycleYear || !dueDate || !amount) {
      setError("Please fill all fields");
      return;
    }
    if (!selectedClient || selectedClient.maintenance_price === null) {
      setError("This client does not have a maintenance_price set in their profile. Update their user profile first.");
      return;
    }
    try {
      await apiRequest("/api/admin/maintenance/records", {
        method: "POST",
        body: {
          client_id: Number(clientId),
          cycle_year: Number(cycleYear),
          due_date: dueDate,
          amount: Number(amount),
        }
      });
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
    if (!confirm("Approve this maintenance compliance proof? This cannot be undone.")) return;
    try {
      await apiRequest(`/api/admin/maintenance/records/${id}/approve`, { method: "POST" });
      await loadAll();
    } catch (err) {
      alert("Failed to approve");
    }
  }

  async function rejectProof(id: number) {
    if (!rejectionReason.trim()) {
      alert("Please provide a rejection reason.");
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
      alert("Failed to reject");
    }
  }

  const clientOptions = clients.map(c => ({ value: String(c.id), label: `${c.full_name} (${c.email})` }));

  return (
    <div className="space-y-12">
      {/* Creation Form */}
      <div className="border-4 border-border-strong bg-bg-panel-alt p-6 md:p-10 shadow-[12px_12px_0px_0px_var(--border-strong)] relative">
        <h3 className="font-data-mono text-lg font-black uppercase tracking-widest text-text-main mb-8 border-b-4 border-border-strong pb-4">
          SYSTEM TERMINAL: GENERATE MAINTENANCE CYCLE
        </h3>
        
        <form onSubmit={generateCycle} className="space-y-8">
          {error && <Alert kind="error">{error}</Alert>}
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-50">
            <div className="flex flex-col gap-4 bg-bg-base border-4 border-border-strong p-6 shadow-[6px_6px_0px_0px_var(--border-strong)] lg:col-span-1">
              <label className="font-label-caps font-black uppercase tracking-widest text-text-muted">
                Target Environment Mapping
              </label>
              <BrutalistSelect
                value={clientId}
                onChange={setClientId}
                placeholder="-- SELECT ACTIVE CLIENT --"
                options={clientOptions}
              />
            </div>
            
            <div className="flex flex-col gap-4 bg-bg-base border-4 border-border-strong p-6 shadow-[6px_6px_0px_0px_var(--border-strong)]">
              <label className="font-label-caps font-black uppercase tracking-widest text-text-muted">
                Cycle Year Designator
              </label>
              <input
                type="number"
                required
                value={cycleYear}
                onChange={(e) => setCycleYear(e.target.value)}
                className="w-full bg-white border-4 border-border-strong p-4 font-bold text-lg focus:outline-none focus:border-text-main shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)]"
              />
            </div>

            <div className="flex flex-col gap-4 bg-bg-base border-4 border-border-strong p-6 shadow-[6px_6px_0px_0px_var(--border-strong)]">
              <label className="font-label-caps font-black uppercase tracking-widest text-text-muted">
                Enforcement Deadline (Due Date)
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-white border-4 border-border-strong p-4 font-bold text-lg focus:outline-none focus:border-text-main shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)] uppercase"
              />
            </div>
          </div>

          {clientId && (
            <div className="bg-bg-base border-4 border-border-strong p-6 shadow-[6px_6px_0px_0px_var(--border-strong)] relative z-0">
              <div className="font-data-mono text-sm space-y-2 mb-6">
                <div className="flex justify-between">
                  <span className="text-text-muted uppercase font-bold">Base Maintenance Price</span>
                  <span className="font-bold">₹{basePrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted uppercase font-bold">
                    Infrastructure Overhead ({clientInfraCosts.length} active, ₹{monthlyInfraTotal.toFixed(2)}/mo)
                  </span>
                  <span className="font-bold">₹{annualInfraTotal.toFixed(2)} / yr</span>
                </div>
                <div className="flex justify-between border-t-2 border-border-strong/30 pt-2">
                  <span className="text-text-muted uppercase font-black">Suggested Cycle Total</span>
                  <span className="font-black">₹{suggestedAmount.toFixed(2)}</span>
                </div>
              </div>

              <label className="font-label-caps font-black uppercase tracking-widest text-text-muted block mb-4">
                Final Cycle Amount (editable)
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
                  className="w-full bg-white border-4 border-border-strong p-4 pl-12 font-data-mono font-black text-2xl focus:outline-none focus:border-text-main shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)]"
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
              className="bg-text-main text-white font-black text-sm uppercase px-8 py-4 border-4 border-text-main shadow-[6px_6px_0px_0px_var(--coral-red)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-3 w-full md:w-auto"
            >
              [ Broadcast Compliance Requirement ]
            </button>
          </div>
        </form>
      </div>

      {/* Compliance Log Matrix */}
      <div>
        <h3 className="font-display-xl text-3xl font-black uppercase text-text-main mb-6 border-b-4 border-border-strong pb-4">
          Compliance Surveillance Matrix
        </h3>
        
        {loading ? (
          <p className="font-data-mono text-text-muted">Loading compliance states...</p>
        ) : records.length === 0 ? (
          <div className="border-4 border-border-strong border-dashed p-12 text-center bg-bg-panel-alt">
             <p className="font-data-mono uppercase tracking-widest font-bold">No maintenance cycles found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {records.map((r) => {
              const client = clients.find(u => u.id === r.client_id);
              return (
                <div key={r.id} className="border-4 border-border-strong bg-bg-base flex flex-col shadow-[8px_8px_0px_0px_var(--border-strong)] relative">
                  <div className="p-6 relative z-10 flex-1">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h4 className="font-headline-lg font-black text-2xl uppercase">
                          CYCLE {r.cycle_year}
                        </h4>
                        <div className="font-data-mono text-sm text-text-muted mt-1 uppercase font-bold">
                          Owner: {client?.full_name ?? `#${r.client_id}`}
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
                        <span className="text-text-muted uppercase font-bold">Enforcement Deadline</span>
                        <span className="font-bold">{new Date(r.due_date).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {r.proof_file_path && (
                      <div className="mt-4 p-4 bg-bg-panel-alt border-4 border-border-strong flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <span className="font-label-caps font-black text-xs uppercase tracking-widest">TRANSACTION VOUCHER</span>
                          <a href={fileUrl(r.proof_file_path)} target="_blank" rel="noreferrer" className="text-accent underline font-data-mono text-sm font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">open_in_new</span> REVIEW PROOF
                          </a>
                        </div>

                        {r.status === "proof_submitted" && (
                          <div className="mt-4">
                            {rejectingId === r.id ? (
                              <div className="space-y-4">
                                <label className="block font-data-mono text-xs font-bold uppercase tracking-widest text-coral-red">
                                  Define Rejection Reason
                                </label>
                                <textarea
                                  value={rejectionReason}
                                  onChange={(e) => setRejectionReason(e.target.value)}
                                  className="w-full border-4 border-coral-red p-3 font-mono text-sm bg-white"
                                  rows={3}
                                />
                                <div className="flex gap-4">
                                  <button onClick={() => rejectProof(r.id)} className="bg-coral-red text-white font-black uppercase px-4 py-2 border-4 border-coral-red flex-1">
                                    EXECUTE REJECTION
                                  </button>
                                  <button onClick={() => setRejectingId(null)} className="bg-bg-panel-alt font-black uppercase px-4 py-2 border-4 border-border-strong text-text-muted flex-1">
                                    ABORT
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-4">
                                <button onClick={() => approveProof(r.id)} className="bg-forest-green text-white font-black text-sm uppercase px-4 py-3 flex-1 flex items-center justify-center gap-2 border-4 border-forest-green shadow-[4px_4px_0px_0px_var(--forest-green)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                                  <span className="material-symbols-outlined">check_circle</span>
                                  VERIFY & APPROVE
                                </button>
                                <button onClick={() => setRejectingId(r.id)} className="bg-coral-red text-white font-black text-sm uppercase px-4 py-3 flex-1 flex items-center justify-center gap-2 border-4 border-coral-red shadow-[4px_4px_0px_0px_var(--coral-red)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                                  <span className="material-symbols-outlined">cancel</span>
                                  REJECT PROOF
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {r.status === "rejected" && r.rejection_reason && (
                          <div className="mt-2 bg-coral-red/10 border-l-4 border-coral-red p-3">
                            <span className="font-data-mono text-[10px] font-bold text-coral-red uppercase block mb-1">REJECTION DIAGNOSTIC:</span>
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
