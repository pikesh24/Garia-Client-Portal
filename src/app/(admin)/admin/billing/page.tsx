"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest, ApiError, fileUrl } from "@/lib/api";
import { FeatureRequest, Discount, DiscountType, Invoice, User } from "@/lib/types";
import { Alert, StatusBadge } from "@/components/ui";
import { BrutalistSelect } from "@/components/BrutalistSelect";
import { AdminProjectFilter, ProjectFilterValue, useAdminProjectFilter } from "@/components/AdminProjectFilter";

type Tab = "invoices" | "discounts";

function clientName(clients: User[], id: number): string {
  return clients.find((c) => c.id === id)?.full_name ?? `#${id}`;
}

function computeDiscountAmount(subtotal: number, discount: Discount | undefined): number {
  if (!discount || !discount.is_active) return 0;
  if (discount.discount_type === "percentage") {
    return Math.round(subtotal * (discount.value / 100) * 100) / 100;
  }
  return Math.min(Math.round(discount.value * 100) / 100, subtotal);
}

export default function AdminBillingPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(searchParams.get("tab") === "discounts" ? "discounts" : "invoices");
  const [filter, setFilter] = useAdminProjectFilter();
  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 mb-8 border-b-4 border-border-strong pb-8">
        <div>
          <h1 className="font-display-xl text-5xl font-black uppercase text-text-main leading-none tracking-tight">
            Billing & Operations
          </h1>
          <p className="font-data-mono text-sm uppercase tracking-widest text-text-muted mt-4">
            Unified invoice production & discount profile matrices
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 border-b-4 border-border-strong pb-6">
        <button
          onClick={() => setTab("invoices")}
          className={`border-4 border-border-strong px-8 py-4 font-bold uppercase transition-all flex-1 md:flex-none text-center
            ${tab === "invoices" 
              ? "bg-text-main text-white shadow-[6px_6px_0px_0px_var(--border-strong)] translate-x-[-2px] translate-y-[-2px]" 
              : "bg-bg-panel-alt text-text-main hover:bg-border-strong/10"
            }`}
        >
          Invoice Compilation Worksheet
        </button>
        <button
          onClick={() => setTab("discounts")}
          className={`border-4 border-border-strong px-8 py-4 font-bold uppercase transition-all flex-1 md:flex-none text-center
            ${tab === "discounts" 
              ? "bg-text-main text-white shadow-[6px_6px_0px_0px_var(--border-strong)] translate-x-[-2px] translate-y-[-2px]" 
              : "bg-bg-panel-alt text-text-main hover:bg-border-strong/10"
            }`}
        >
          Discount Profiles Center
        </button>
      </div>

      <AdminProjectFilter value={filter} onChange={setFilter} />

      <div className="min-h-[500px]">
        {tab === "invoices" ? <InvoicesTab filter={filter} /> : <DiscountsTab filter={filter} />}
      </div>
    </div>
  );
}

function InvoicesTab({ filter }: { filter: ProjectFilterValue }) {
  const [clients, setClients] = useState<User[]>([]);
  const [features, setFeatures] = useState<FeatureRequest[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<number[]>([]);
  const [taxAmount, setTaxAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTax, setEditTax] = useState("0");
  const [editNotes, setEditNotes] = useState("");

  async function loadAll() {
    const invoicesEndpoint = filter.projectId
      ? `/api/admin/projects/${filter.projectId}/billing/invoices`
      : "/api/admin/billing/invoices";
    const featuresEndpoint = filter.projectId
      ? `/api/admin/projects/${filter.projectId}/feature-requests?include_base_features=true`
      : "/api/admin/feature-requests?include_base_features=true";
    const [c, f, d, i] = await Promise.all([
      apiRequest<User[]>("/api/admin/users"),
      apiRequest<FeatureRequest[]>(featuresEndpoint),
      apiRequest<Discount[]>("/api/admin/discounts"),
      apiRequest<Invoice[]>(invoicesEndpoint),
    ]);
    setClients(c);
    setFeatures(f);
    setDiscounts(d);
    setInvoices(i);
  }

  useEffect(() => {
    setLoading(true);
    loadAll().finally(() => setLoading(false));
  }, [filter.projectId]);

  useEffect(() => {
    if (filter.clientId) setClientId(filter.clientId);
  }, [filter.clientId]);

  const selectedClient = clients.find((c) => String(c.id) === clientId);
  const activeDiscount = discounts.find((d) => String(d.client_id) === clientId && d.is_active);

  const eligibleFeatures = filter.projectId
    ? features.filter(
        (f) =>
          String(f.client_id) === clientId &&
          String(f.project_id) === filter.projectId &&
          f.added_by_client &&
          f.status === "approved"
      )
    : [];

  const allSelected = eligibleFeatures.length > 0 && eligibleFeatures.every((f) => selectedFeatures.includes(f.id));

  const previewSubtotal = useMemo(
    () =>
      Math.round(
        eligibleFeatures
          .filter((f) => selectedFeatures.includes(f.id))
          .reduce((sum, f) => sum + (f.price ?? 0), 0) * 100
      ) / 100,
    [eligibleFeatures, selectedFeatures]
  );
  const previewDiscount = computeDiscountAmount(previewSubtotal, activeDiscount);
  const previewTax = Number(taxAmount) || 0;
  const previewTotal = Math.round((previewSubtotal - previewDiscount + previewTax) * 100) / 100;

  function toggleFeature(id: number) {
    setSelectedFeatures((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    setSelectedFeatures(allSelected ? [] : eligibleFeatures.map((f) => f.id));
  }

  async function generateInvoice(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!filter.projectId) {
      setError("Select a project to bill.");
      return;
    }
    if (selectedFeatures.length === 0) {
      setError("Select at least one feature request to bill.");
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest(`/api/admin/projects/${filter.projectId}/billing/invoices`, {
        method: "POST",
        body: { feature_ids: selectedFeatures, tax_amount: Number(taxAmount) || 0, notes },
      });
      setSelectedFeatures([]);
      setNotes("");
      setTaxAmount("0");
      setMessage("Draft invoice generated successfully.");
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not generate invoice");
    } finally {
      setSubmitting(false);
    }
  }

  async function finalize(id: number) {
    if (!confirm("Finalize this invoice? This issues the signed document to the client and cannot be undone.")) return;
    setError(null);
    setMessage(null);
    try {
      await apiRequest(`/api/admin/billing/invoices/${id}/finalize`, { method: "POST" });
      setMessage(`Invoice INV-${id} finalized and sent to client.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not finalize invoice");
    }
  }

  async function deleteDraft(id: number) {
    if (!confirm("Delete this draft invoice? This cannot be undone.")) return;
    await apiRequest(`/api/admin/billing/invoices/${id}`, { method: "DELETE" });
    setMessage(`Draft invoice INV-${id} deleted.`);
    await loadAll();
  }

  function startEdit(inv: Invoice) {
    setEditingId(inv.id);
    setEditTax(String(inv.tax_amount));
    setEditNotes(inv.notes ?? "");
  }

  async function overwriteInvoice(id: number) {
    setError(null);
    try {
      await apiRequest(`/api/admin/billing/invoices/${id}`, {
        method: "PUT",
        body: { tax_amount: Number(editTax) || 0, notes: editNotes },
      });
      setEditingId(null);
      setMessage(`Invoice INV-${id} updated.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not overwrite invoice");
    }
  }

  const visibleInvoices = invoices.filter((inv) => statusFilter === "all" || inv.status === statusFilter);

  return (
    <div className="space-y-12">
      {/* CREATION FORM */}
      <div className="border-4 border-border-strong bg-bg-base p-6 md:p-10 shadow-[12px_12px_0px_0px_var(--border-strong)] relative overflow-hidden">
        <div className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 opacity-10 pointer-events-none">
          <span className="material-symbols-outlined text-[300px]">receipt_long</span>
        </div>
        
        <h3 className="font-display-xl text-3xl font-black uppercase text-text-main mb-8 border-b-4 border-border-strong pb-4 relative z-10">
          Invoice Compilation Worksheet
        </h3>

        <form onSubmit={generateInvoice} className="space-y-8 relative z-10">
          {error && <Alert>{error}</Alert>}
          {message && <Alert kind="warning">{message}</Alert>}
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div className="relative z-50">
                <label className="block font-label-caps text-xs font-black uppercase tracking-widest text-text-muted mb-2">
                  Target Client
                </label>
                {filter.clientId ? (
                  <div className="bg-bg-base border-4 border-border-strong p-4 font-bold text-lg text-text-main">
                    {clients.find((c) => String(c.id) === filter.clientId)?.full_name ?? `#${filter.clientId}`}
                    <span className="ml-2 font-data-mono text-[10px] uppercase text-text-muted">(from project filter above)</span>
                  </div>
                ) : (
                  <BrutalistSelect
                    value={clientId}
                    onChange={(val) => {
                      setClientId(val);
                      setSelectedFeatures([]);
                      setError(null);
                    }}
                    placeholder="-- SELECT ACTIVE CLIENT --"
                    options={clients.map(c => ({ value: String(c.id), label: `${c.full_name} (${c.email})` }))}
                  />
                )}

                {clientId && activeDiscount && (
                  <div className="mt-3 inline-block bg-accent/10 border-2 border-accent p-3">
                    <span className="font-data-mono text-[10px] uppercase font-bold text-accent tracking-widest block mb-1">
                      Discount Applied
                    </span>
                    <span className="font-bold text-accent">
                      {activeDiscount.name} ({activeDiscount.discount_type === "percentage" ? `${activeDiscount.value}% off` : `₹${activeDiscount.value.toFixed(2)} off`})
                    </span>
                  </div>
                )}
              </div>

              {clientId && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="font-label-caps text-xs font-black uppercase tracking-widest text-text-muted">
                      Eligible Feature Requests
                    </label>
                    {eligibleFeatures.length > 0 && (
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="font-data-mono text-[10px] uppercase tracking-widest bg-border-strong text-white px-3 py-1 hover:bg-text-main transition-colors font-bold"
                      >
                        {allSelected ? "DESELECT ALL" : "SELECT ALL"}
                      </button>
                    )}
                  </div>
                  
                  {!filter.projectId ? (
                    <div className="border-4 border-border-strong border-dashed p-6 text-center">
                      <p className="font-data-mono text-sm text-text-muted uppercase tracking-widest">
                        Select a project above to see its billable items.
                      </p>
                    </div>
                  ) : eligibleFeatures.length === 0 ? (
                    <div className="border-4 border-border-strong border-dashed p-6 text-center">
                      <p className="font-data-mono text-sm text-text-muted uppercase tracking-widest">
                        No billable features available for this project.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {eligibleFeatures.map((f) => (
                        <label
                          key={f.id}
                          className={`flex items-center justify-between p-4 border-4 cursor-pointer transition-colors ${
                            selectedFeatures.includes(f.id)
                              ? "border-text-main bg-text-main/5"
                              : "border-border-strong bg-bg-panel-alt hover:border-text-main/50"
                          }`}
                        >
                          <div className="flex items-center gap-4 overflow-hidden">
                            <input
                              type="checkbox"
                              checked={selectedFeatures.includes(f.id)}
                              onChange={() => toggleFeature(f.id)}
                              className="w-6 h-6 border-2 border-text-main rounded-none cursor-pointer accent-text-main shrink-0"
                            />
                            <div className="truncate">
                              <span className="font-bold block truncate">{f.name}</span>
                              <span className="font-data-mono text-[10px] text-text-muted uppercase">
                                STATUS: {f.status.replace("_", " ")}
                              </span>
                            </div>
                          </div>
                          <span className="font-data-mono font-bold text-lg shrink-0 pl-4">₹{(f.price ?? 0).toFixed(2)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block font-label-caps text-xs font-black uppercase tracking-widest text-text-muted mb-2">
                    Tax Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                    className="w-full bg-bg-base border-4 border-border-strong p-4 font-data-mono text-lg font-bold focus:outline-none focus:border-text-main"
                  />
                </div>
                <div>
                  <label className="block font-label-caps text-xs font-black uppercase tracking-widest text-text-muted mb-2">
                    Administrative Memo
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes"
                    className="w-full bg-bg-base border-4 border-border-strong p-4 font-bold focus:outline-none focus:border-text-main"
                  />
                </div>
              </div>

              {/* LIVE ESTIMATE TERMINAL */}
              <div className="bg-text-main text-white border-4 border-text-main p-6 shadow-[8px_8px_0px_0px_var(--coral-red)] mt-8">
                <h4 className="font-data-mono text-xs uppercase tracking-widest font-black mb-6 pb-2 border-b-2 border-white/20 text-coral-red">
                  &gt;&gt; EVALUATION_MATRIX_LIVE
                </h4>
                
                <div className="space-y-3 font-data-mono text-sm">
                  <div className="flex justify-between items-end">
                    <span className="text-white/60">SUBTOTAL ({selectedFeatures.length} ITEMS)</span>
                    <span className="text-xl">₹{previewSubtotal.toFixed(2)}</span>
                  </div>
                  {previewDiscount > 0 && (
                    <div className="flex justify-between items-end text-forest-green">
                      <span>DISCOUNT APPLIED</span>
                      <span className="text-xl">-₹{previewDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-end">
                    <span className="text-white/60">TAX ALLOCATION</span>
                    <span className="text-xl">₹{previewTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-end pt-4 border-t-2 border-white/20 mt-4">
                    <span className="text-coral-red font-black text-lg">TOTAL_COMPUTED</span>
                    <span className="text-3xl font-black">₹{previewTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !clientId || !filter.projectId || selectedFeatures.length === 0}
                className="w-full block bg-coral-red text-white font-black text-xl uppercase py-5 border-4 border-text-main shadow-[6px_6px_0px_0px_var(--text-main)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[6px_6px_0px_0px_var(--text-main)] disabled:hover:translate-x-0 disabled:hover:translate-y-0"
              >
                {submitting ? "PROCESSING..." : "GENERATE DRAFT INVOICE RECORD"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* INVOICES LIST */}
      <div>
        <div className="flex flex-col md:flex-row justify-between items-end mb-6 border-b-4 border-border-strong pb-4">
          <h3 className="font-display-xl text-3xl font-black uppercase text-text-main">
            Invoice Registry
          </h3>
          <div className="flex gap-2">
            {["all", "draft", "finalized", "paid"].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`font-data-mono text-[10px] uppercase font-bold tracking-widest px-4 py-2 border-2 ${
                  statusFilter === status 
                    ? "bg-text-main border-text-main text-white" 
                    : "bg-bg-panel-alt border-border-strong text-text-main hover:bg-border-strong/10"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="font-data-mono text-text-muted">Fetching records...</p>
        ) : visibleInvoices.length === 0 ? (
          <div className="border-4 border-border-strong border-dashed p-12 text-center bg-bg-panel-alt">
            <p className="font-data-mono uppercase tracking-widest font-bold">No records found matching criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {visibleInvoices.map((inv) => (
              <div key={inv.id} className="border-4 border-border-strong bg-bg-panel-alt p-6 shadow-[6px_6px_0px_0px_var(--border-strong)] transition-all hover:border-text-main">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
                  {/* Left block */}
                  <div className="flex flex-col md:flex-row gap-6 md:items-center flex-1">
                    <div className="bg-text-main text-white p-4 text-center shrink-0 w-32 border-2 border-text-main shadow-[4px_4px_0px_0px_var(--coral-red)]">
                      <span className="block font-data-mono text-[10px] uppercase tracking-widest mb-1 text-coral-red">RECORD</span>
                      <span className="font-black text-xl">INV-{inv.id}</span>
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="font-headline-lg font-black text-2xl uppercase mb-2">
                        {clientName(clients, inv.client_id)}
                      </h4>
                      <div className="flex gap-4 items-center">
                        <StatusBadge status={inv.status} />
                        <span className="font-data-mono text-xs text-text-muted border-l-2 border-border-strong pl-4">
                          {new Date(inv.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right block: Financials */}
                  <div className="flex gap-8 items-center bg-bg-base border-4 border-border-strong p-4 shrink-0">
                    <div className="text-right font-data-mono text-xs space-y-1">
                      <div className="text-text-muted">SUB: ₹{inv.subtotal.toFixed(2)}</div>
                      {inv.discount_amount > 0 && <div className="text-forest-green">DISC: -₹{inv.discount_amount.toFixed(2)}</div>}
                      <div className="text-text-muted">TAX: ₹{inv.tax_amount.toFixed(2)}</div>
                    </div>
                    <div className="text-right border-l-4 border-border-strong pl-6">
                      <div className="font-data-mono text-[10px] uppercase font-bold text-coral-red mb-1">FINAL AMT</div>
                      <div className="font-black text-3xl">₹{inv.total.toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                {/* Actions & Details Toggle */}
                <div className="mt-6 pt-6 border-t-4 border-border-strong border-dashed flex flex-wrap justify-between items-center gap-4">
                  <div className="flex gap-3 flex-wrap">
                    {inv.status === "draft" && (
                      <>
                        <button onClick={() => finalize(inv.id)} className="bg-forest-green text-white font-bold uppercase text-xs tracking-widest px-4 py-2 border-2 border-forest-green hover:bg-white hover:text-forest-green transition-colors">
                          Finalize Issue
                        </button>
                        <button onClick={() => startEdit(inv)} className="bg-accent text-white font-bold uppercase text-xs tracking-widest px-4 py-2 border-2 border-accent hover:bg-white hover:text-accent transition-colors">
                          Overwrite Overhaul
                        </button>
                        <button onClick={() => deleteDraft(inv.id)} className="bg-coral-red text-white font-bold uppercase text-xs tracking-widest px-4 py-2 border-2 border-coral-red hover:bg-white hover:text-coral-red transition-colors">
                          Erase Draft (DELETE)
                        </button>
                      </>
                    )}
                  </div>
                  
                  <button onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)} className="font-data-mono text-xs uppercase font-bold flex items-center gap-2 hover:text-coral-red transition-colors">
                    {expandedId === inv.id ? "CLOSE DIAGNOSTICS" : "EXPAND DIAGNOSTICS"}
                    <span className="material-symbols-outlined">{expandedId === inv.id ? "expand_less" : "expand_more"}</span>
                  </button>
                </div>

                {/* Overwrite Edit Panel */}
                {editingId === inv.id && (
                  <div className="mt-6 bg-accent/10 border-4 border-accent p-6 relative">
                    <h5 className="font-label-caps font-black uppercase tracking-widest text-accent mb-4">
                      Overwrite Matrix Active (PUT)
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                       <div>
                        <label className="block font-data-mono text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">
                          Override Tax Amount
                        </label>
                        <input type="number" step="0.01" value={editTax} onChange={(e) => setEditTax(e.target.value)} className="w-full border-2 border-text-main p-3 font-data-mono font-bold" />
                      </div>
                      <div>
                        <label className="block font-data-mono text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">
                          Override Memo Notes
                        </label>
                        <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="w-full border-2 border-text-main p-3 font-bold" />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <button onClick={() => overwriteInvoice(inv.id)} className="bg-text-main text-white font-bold uppercase text-xs px-6 py-3 hover:bg-accent transition-colors">
                        COMMIT OVERWRITE
                      </button>
                      <button onClick={() => setEditingId(null)} className="border-2 border-text-main text-text-main font-bold uppercase text-xs px-6 py-3 hover:bg-border-strong/10 transition-colors">
                        ABORT
                      </button>
                    </div>
                  </div>
                )}

                {/* Expanded Details Panel */}
                {expandedId === inv.id && (
                  <div className="mt-6 bg-bg-base border-4 border-border-strong p-6">
                    <h5 className="font-data-mono font-black text-sm uppercase tracking-widest text-coral-red mb-4">
                      Line Item Diagnostics
                    </h5>
                    {inv.line_items.length === 0 ? (
                      <p className="font-data-mono text-sm text-text-muted">No line items mapped.</p>
                    ) : (
                      <div className="space-y-3">
                        {inv.line_items.map((li) => (
                          <div key={li.id} className="flex justify-between items-center border-b-2 border-border-strong/30 pb-3">
                            <span className="font-bold text-sm">{li.description}</span>
                            <span className="font-data-mono font-bold text-lg">₹{li.amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {inv.notes && (
                      <div className="mt-6 p-4 border-l-4 border-accent bg-accent/5">
                        <span className="font-data-mono text-[10px] uppercase font-bold text-accent block mb-1">Administrative Memo</span>
                        <p className="font-bold text-sm">{inv.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DiscountsTab({ filter }: { filter: ProjectFilterValue }) {
  const [clients, setClients] = useState<User[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);

  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("percentage");
  const [value, setValue] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<DiscountType>("percentage");
  const [editValue, setEditValue] = useState("");
  const [editActive, setEditActive] = useState(true);

  async function loadAll() {
    const discountsEndpoint = filter.projectId
      ? `/api/admin/projects/${filter.projectId}/discounts`
      : "/api/admin/discounts";
    const [c, d] = await Promise.all([
      apiRequest<User[]>("/api/admin/users"),
      apiRequest<Discount[]>(discountsEndpoint),
    ]);
    setClients(c);
    setDiscounts(d);
  }

  useEffect(() => {
    setLoading(true);
    loadAll().finally(() => setLoading(false));
  }, [filter.projectId]);

  useEffect(() => {
    if (filter.clientId) setClientId(filter.clientId);
  }, [filter.clientId]);

  const existingActiveForClient = discounts.find((d) => String(d.client_id) === clientId && d.is_active);

  async function deploy(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      if (filter.projectId) {
        await apiRequest(`/api/admin/projects/${filter.projectId}/discounts`, {
          method: "POST",
          body: { name, discount_type: discountType, value: Number(value), is_active: isActive },
        });
      } else {
        await apiRequest("/api/admin/discounts", {
          method: "POST",
          body: { client_id: Number(clientId), name, discount_type: discountType, value: Number(value), is_active: isActive },
        });
      }
      setName("");
      setValue("");
      setMessage("Discount rule deployed successfully.");
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not deploy discount");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteDiscount(id: number) {
    if (!confirm("Permanently remove this discount reduction profile? This cannot be undone.")) return;
    await apiRequest(`/api/admin/discounts/${id}`, { method: "DELETE" });
    setMessage("Discount reduction profile deleted.");
    await loadAll();
  }

  function startEditDiscount(d: Discount) {
    setEditingId(d.id);
    setEditName(d.name);
    setEditType(d.discount_type);
    setEditValue(String(d.value));
    setEditActive(d.is_active);
  }

  async function overwriteDiscount(id: number) {
    setError(null);
    try {
      await apiRequest(`/api/admin/discounts/${id}`, {
        method: "PUT",
        body: { name: editName, discount_type: editType, value: Number(editValue), is_active: editActive },
      });
      setEditingId(null);
      setMessage("Discount rules overwritten successfully.");
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not overwrite discount");
    }
  }

  return (
    <div className="space-y-12">
      {/* CREATION FORM - BASED ON MOCKUP */}
      <div className="border-4 border-border-strong bg-bg-panel-alt p-6 md:p-10 shadow-[12px_12px_0px_0px_var(--border-strong)] relative">
        <h3 className="font-data-mono text-lg font-black uppercase tracking-widest text-coral-red mb-8 border-b-4 border-border-strong pb-4">
          DESIGN WORKSPACE: CONFIGURE CLIENT DISCOUNT CONFIGURATION
        </h3>

        <form onSubmit={deploy} className="space-y-8">
          {error && <Alert>{error}</Alert>}
          {message && <Alert kind="warning">{message}</Alert>}
          
          <div className="flex flex-col gap-6 relative">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none z-0">
              <span className="material-symbols-outlined text-[300px]">loyalty</span>
            </div>
            
            {/* Target Customer Mapping */}
            <div className="flex flex-col xl:flex-row xl:items-center gap-4 bg-bg-base border-4 border-border-strong p-6 shadow-[6px_6px_0px_0px_var(--border-strong)] relative z-50">
              <label className="font-label-caps font-black uppercase tracking-widest text-text-muted xl:w-1/3">
                Target Customer Mapping
              </label>
              <div className="flex-1 relative">
                {filter.clientId ? (
                  <div className="bg-bg-base border-4 border-border-strong p-4 font-bold text-lg text-text-main">
                    {clients.find((c) => String(c.id) === filter.clientId)?.full_name ?? `#${filter.clientId}`}
                    <span className="ml-2 font-data-mono text-[10px] uppercase text-text-muted">(from project filter above)</span>
                  </div>
                ) : (
                  <BrutalistSelect
                    value={clientId}
                    onChange={setClientId}
                    placeholder="SELECT ACTIVE CLIENT PROFILE"
                    options={clients.map(c => ({ value: String(c.id), label: c.full_name }))}
                  />
                )}
              </div>
            </div>

            {/* Promotional Rule Tag */}
            <div className="flex flex-col xl:flex-row xl:items-center gap-4 bg-bg-base border-4 border-border-strong p-6 shadow-[6px_6px_0px_0px_var(--border-strong)] relative z-10">
              <label className="font-label-caps font-black uppercase tracking-widest text-text-muted xl:w-1/3">
                Promotional Rule Tag
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Strategic Retainer Alleviation"
                className="flex-1 bg-white border-4 border-border-strong p-4 font-bold text-lg focus:outline-none focus:border-text-main placeholder:text-text-muted/40 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)]"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
              {/* Math Evaluation Logic */}
              <div className="flex flex-col gap-4 bg-bg-base border-4 border-border-strong p-6 shadow-[6px_6px_0px_0px_var(--border-strong)]">
                <label className="font-label-caps font-black uppercase tracking-widest text-text-muted">
                  Math Evaluation Logic
                </label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setDiscountType("percentage")}
                    className={`flex-1 p-4 border-4 font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3 ${
                      discountType === "percentage" 
                        ? "bg-text-main border-text-main text-white shadow-[4px_4px_0px_0px_var(--coral-red)] translate-x-[-2px] translate-y-[-2px]" 
                        : "bg-white border-border-strong text-text-muted hover:border-text-main"
                    }`}
                  >
                    <div className={`w-5 h-5 border-4 flex items-center justify-center ${discountType === "percentage" ? "border-coral-red bg-white" : "border-text-muted"}`}>
                      {discountType === "percentage" && <div className="w-2 h-2 bg-coral-red" />}
                    </div>
                    PERCENTAGE RULE
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType("fixed_amount")}
                    className={`flex-1 p-4 border-4 font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3 ${
                      discountType === "fixed_amount" 
                        ? "bg-text-main border-text-main text-white shadow-[4px_4px_0px_0px_var(--coral-red)] translate-x-[-2px] translate-y-[-2px]" 
                        : "bg-white border-border-strong text-text-muted hover:border-text-main"
                    }`}
                  >
                    <div className={`w-5 h-5 border-4 flex items-center justify-center ${discountType === "fixed_amount" ? "border-coral-red bg-white" : "border-text-muted"}`}>
                      {discountType === "fixed_amount" && <div className="w-2 h-2 bg-coral-red" />}
                    </div>
                    FLAT INR VALUE
                  </button>
                </div>
              </div>

              {/* Operational Reduction */}
              <div className="flex flex-col gap-4 bg-bg-base border-4 border-border-strong p-6 shadow-[6px_6px_0px_0px_var(--border-strong)]">
                <label className="font-label-caps font-black uppercase tracking-widest text-text-muted">
                  Operational Reduction
                </label>
                <div className="flex-1 flex items-center relative">
                  {discountType === "fixed_amount" && <span className="absolute left-5 font-black text-3xl text-text-muted">₹</span>}
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="15.00"
                    className={`w-full bg-white border-4 border-border-strong p-5 font-data-mono font-black text-3xl focus:outline-none focus:border-text-main placeholder:text-text-muted/30 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)] ${discountType === "fixed_amount" ? "pl-12" : ""}`}
                  />
                  {discountType === "percentage" && <span className="absolute right-5 font-black text-3xl text-text-muted">%</span>}
                </div>
              </div>
            </div>
            
            {/* Toggle Engine */}
            <div className="flex flex-col xl:flex-row xl:items-center gap-4 bg-bg-base border-4 border-border-strong p-6 shadow-[6px_6px_0px_0px_var(--border-strong)] relative z-10">
              <label className="font-label-caps font-black uppercase tracking-widest text-text-muted xl:w-1/3">
                Engine Status
              </label>
              <label className="flex-1 flex items-center gap-6 cursor-pointer group">
                <div className={`w-24 h-12 border-4 border-text-main p-1.5 flex items-center transition-colors relative shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.2)] ${isActive ? "bg-forest-green" : "bg-bg-panel-alt"}`}>
                  <div className={`w-8 h-8 bg-white border-4 border-text-main transition-transform shadow-sm ${isActive ? "translate-x-11" : "translate-x-0"}`} />
                </div>
                <div className="flex flex-col">
                  <span className={`font-data-mono text-xl font-black uppercase tracking-widest ${isActive ? "text-forest-green" : "text-text-muted"}`}>
                    {isActive ? "ACTIVE (ENGAGED)" : "INACTIVE (STANDBY)"}
                  </span>
                  <span className="font-data-mono text-[10px] uppercase text-text-muted">
                    {isActive ? "Discount rule will be applied automatically" : "Rule is dormant and will not be applied"}
                  </span>
                </div>
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="hidden" />
              </label>
            </div>
          </div>

          {clientId && isActive && existingActiveForClient && (
            <div className="bg-amber/10 border-4 border-amber p-4 font-data-mono text-sm text-text-main font-bold">
              <span className="text-amber font-black mr-2">! OVERRIDE WARNING !</span>
              Client already has an active discount [{existingActiveForClient.name}]. Deploying this rule will replace it.
            </div>
          )}

          <div className="flex flex-wrap gap-4 pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="bg-text-main text-white font-black text-sm uppercase px-8 py-4 border-4 border-text-main shadow-[6px_6px_0px_0px_var(--coral-red)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex-1 md:flex-none"
            >
              {submitting ? "Deploying..." : "[ Deploy New Discount Rule ]"}
            </button>
            <button
              type="button"
              disabled
              className="bg-bg-base text-text-muted font-black text-sm uppercase px-8 py-4 border-4 border-border-strong cursor-not-allowed opacity-50 flex-1 md:flex-none"
            >
              [ Overwrite Active Rules (PUT) ]
            </button>
          </div>
        </form>
      </div>

      {/* RULES LIST */}
      <div>
        <h3 className="font-display-xl text-3xl font-black uppercase text-text-main mb-6 border-b-4 border-border-strong pb-4">
          Active Discount Engines Matrix
        </h3>
        
        {loading ? (
          <p className="font-data-mono text-text-muted">Loading discount profiles...</p>
        ) : discounts.length === 0 ? (
          <div className="border-4 border-border-strong border-dashed p-12 text-center bg-bg-panel-alt">
             <p className="font-data-mono uppercase tracking-widest font-bold">No discount configurations established.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {discounts.map((d) => (
              <div key={d.id} className="border-4 border-border-strong bg-bg-base flex flex-col shadow-[8px_8px_0px_0px_var(--border-strong)] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <span className="material-symbols-outlined text-[100px]">loyalty</span>
                </div>

                <div className="p-6 relative z-10 flex-1">
                  <div className="flex justify-between items-start mb-6">
                    <h4 className="font-headline-lg font-black text-2xl uppercase w-2/3 truncate">
                      {d.name}
                    </h4>
                    <div className={`px-3 py-1 font-data-mono text-[10px] font-bold uppercase tracking-widest border-2 ${
                      d.is_active ? "bg-forest-green text-white border-forest-green" : "bg-bg-panel-alt text-text-muted border-border-strong"
                    }`}>
                      {d.is_active ? "Active Rule" : "Inactive"}
                    </div>
                  </div>

                  <div className="space-y-4 font-data-mono text-sm">
                    <div className="flex justify-between border-b-2 border-border-strong/30 pb-2">
                      <span className="text-text-muted uppercase font-bold">Target Mapping</span>
                      <span className="font-bold">{clientName(clients, d.client_id)}</span>
                    </div>
                    <div className="flex justify-between border-b-2 border-border-strong/30 pb-2">
                      <span className="text-text-muted uppercase font-bold">Math Logic</span>
                      <span className="font-bold">{d.discount_type === "percentage" ? "PERCENTAGE" : "FLAT INR"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted uppercase font-bold">Reduction Value</span>
                      <span className="font-black text-xl text-coral-red">
                        {d.discount_type === "percentage" ? `${d.value}%` : `₹${d.value.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Edit Form */}
                {editingId === d.id && (
                  <div className="p-6 bg-accent/10 border-t-4 border-accent relative z-10">
                    <h5 className="font-label-caps font-black uppercase tracking-widest text-accent mb-4">
                      Overwrite Matrix Active (PUT)
                    </h5>
                    <div className="space-y-4 mb-6">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full border-2 border-text-main p-3 font-bold" placeholder="Rule Tag" />
                      <div className="flex gap-4">
                        <select value={editType} onChange={(e) => setEditType(e.target.value as DiscountType)} className="w-1/2 border-2 border-text-main p-3 font-bold">
                          <option value="percentage">Percentage</option>
                          <option value="fixed_amount">Flat INR</option>
                        </select>
                        <input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-1/2 border-2 border-text-main p-3 font-data-mono font-bold" />
                      </div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} className="w-5 h-5 border-2 border-text-main rounded-none" />
                        <span className="font-data-mono font-bold uppercase tracking-widest text-xs">Engine Active</span>
                      </label>
                    </div>
                    <div className="flex gap-4">
                      <button onClick={() => overwriteDiscount(d.id)} className="bg-text-main text-white font-bold uppercase text-xs px-6 py-3 hover:bg-accent transition-colors flex-1">
                        COMMIT OVERWRITE
                      </button>
                      <button onClick={() => setEditingId(null)} className="border-2 border-text-main text-text-main font-bold uppercase text-xs px-6 py-3 hover:bg-border-strong/10 transition-colors">
                        ABORT
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Footer */}
                <div className="p-4 bg-bg-panel-alt border-t-4 border-border-strong flex justify-between relative z-10">
                  <button onClick={() => startEditDiscount(d)} className="font-data-mono text-[10px] font-bold uppercase tracking-widest text-accent hover:underline flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">edit</span> OVERWRITE
                  </button>
                  <button onClick={() => deleteDiscount(d.id)} className="font-data-mono text-[10px] font-bold uppercase tracking-widest text-coral-red hover:underline flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">delete</span> ERASE PROFILE (DELETE)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
