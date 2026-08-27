"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiRequest, ApiError, fileUrl } from "@/lib/api";
import { FeatureRequest, Discount, DiscountType, Invoice, User } from "@/lib/types";
import { Alert, StatusBadge, Modal, Button } from "@/components/ui";
import React from "react";
import { useConfirm } from "@/lib/confirm";
import { BrutalistSelect } from "@/components/BrutalistSelect";
import { AdminProjectFilter, ProjectFilterValue, useAdminProjectFilter } from "@/components/AdminProjectFilter";
import { formatDate } from "@/lib/date";
import { useWsEvent } from "@/components/WebSocketProvider";

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
            Create invoices and manage client discounts
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 border-b-4 border-border-strong pb-6">
        <button
          onClick={() => setTab("invoices")}
          className={`border-4 border-border-strong px-8 py-4 font-bold uppercase transition-all flex-1 md:flex-none text-center
            ${tab === "invoices" 
              ? "bg-[var(--footer-strip)] text-white shadow-[6px_6px_0px_0px_var(--shadow-strong)] translate-x-[-2px] translate-y-[-2px]" 
              : "bg-bg-panel-alt text-text-main hover:bg-border-strong/10"
            }`}
        >
          Invoices
        </button>
        <button
          onClick={() => setTab("discounts")}
          className={`border-4 border-border-strong px-8 py-4 font-bold uppercase transition-all flex-1 md:flex-none text-center
            ${tab === "discounts" 
              ? "bg-[var(--footer-strip)] text-white shadow-[6px_6px_0px_0px_var(--shadow-strong)] translate-x-[-2px] translate-y-[-2px]" 
              : "bg-bg-panel-alt text-text-main hover:bg-border-strong/10"
            }`}
        >
          Discounts
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
  const [selectedFeatures, setSelectedFeatures] = useState<number[]>([]);
  const [featureSearch, setFeatureSearch] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const invoicesVersion = useWsEvent("invoices");
  const featureRequestsVersion = useWsEvent("feature_requests");
  const discountsVersion = useWsEvent("discounts");

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 6;
  const confirm = useConfirm();

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
    return i;
  }

  useEffect(() => {
    setLoading(true);
    loadAll().finally(() => setLoading(false));
  }, [filter.projectId]);

  // A ws-triggered refetch shouldn't reset the in-progress invoice creation form.
  useEffect(() => {
    if (invoicesVersion || featureRequestsVersion || discountsVersion) loadAll();
  }, [invoicesVersion, featureRequestsVersion, discountsVersion]);

  useEffect(() => {
    setSelectedFeatures([]);
    setFeatureSearch("");
  }, [filter.clientId, filter.projectId]);

  const activeDiscount = discounts.find((d) => String(d.client_id) === filter.clientId && d.is_active);

  // Keep in sync with BILLABLE_STATUSES in backend/app/services/invoicing.py: a feature stays
  // billable through its whole post-approval lifecycle, not just while status is exactly
  // "approved" -- otherwise it becomes permanently unbillable the moment work starts/finishes.
  const BILLABLE_STATUSES = new Set(["approved", "in_progress", "completed"]);
  const eligibleFeatures = filter.projectId
    ? features.filter(
        (f) =>
          String(f.client_id) === filter.clientId &&
          String(f.project_id) === filter.projectId &&
          f.added_by_client &&
          BILLABLE_STATUSES.has(f.status)
      )
    : [];

  const searchedFeatures = featureSearch
    ? eligibleFeatures.filter((f) => f.name.toLowerCase().includes(featureSearch.toLowerCase()))
    : eligibleFeatures;

  const allSelected = eligibleFeatures.length > 0 && eligibleFeatures.every((f) => selectedFeatures.includes(f.id));

  // The exact set of feature objects backing the invoice preview -- shared by the itemized
  // line-item list and the subtotal math below, so the two can never drift apart.
  const selectedFeatureObjects = useMemo(
    () => eligibleFeatures.filter((f) => selectedFeatures.includes(f.id)),
    [eligibleFeatures, selectedFeatures]
  );
  const previewSubtotal = useMemo(
    () => Math.round(selectedFeatureObjects.reduce((sum, f) => sum + (f.price ?? 0), 0) * 100) / 100,
    [selectedFeatureObjects]
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
      setTaxAmount("");
      setMessage("Draft invoice generated successfully.");
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not generate invoice");
    } finally {
      setSubmitting(false);
    }
  }

  const visibleInvoices = invoices.filter((inv) => statusFilter === "all" || inv.status === statusFilter);

  // If selected invoice is filtered out, clear selection
  useEffect(() => {
    if (selectedInvoice && !visibleInvoices.find((i) => i.id === selectedInvoice.id)) {
      setSelectedInvoice(null);
    }
  }, [statusFilter, visibleInvoices, selectedInvoice]);

  return (
    <div className="space-y-12">
      {/* CREATION FORM */}
      <div className="mb-16">
        <h3 className="font-display-xl text-3xl font-black uppercase text-text-main mb-6 flex items-center gap-4">
          <span className="material-symbols-outlined text-4xl text-brand-green">add_box</span>
          Create New Invoice
        </h3>

        <form onSubmit={generateInvoice}>
          {error && <Alert className="mb-6">{error}</Alert>}
          {message && <Alert kind="warning" className="mb-6">{message}</Alert>}
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Selections */}
            <div className="lg:col-span-7 space-y-8">
              <div className={`border-4 border-border-strong p-6 md:p-8 transition-all duration-300 ${filter.projectId ? "bg-bg-base shadow-[8px_8px_0px_0px_var(--shadow-strong)]" : "bg-bg-panel-alt/30 opacity-50 grayscale pointer-events-none"}`}>
                <div className="flex items-center justify-between mb-6">
                  <h4 className="font-label-caps text-sm font-black uppercase tracking-widest text-text-muted flex items-center gap-2">
                    <span className={`w-2 h-2 ${filter.projectId ? "bg-brand-green" : "bg-text-muted"}`}></span>
                    Billable Features
                  </h4>
                  {eligibleFeatures.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="font-data-mono text-[10px] uppercase tracking-widest bg-text-main text-white px-4 py-2 hover:bg-brand-green transition-colors font-bold shadow-[2px_2px_0px_0px_var(--shadow-strong)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                    >
                      {allSelected ? "DESELECT ALL" : "SELECT ALL"}
                    </button>
                  )}
                </div>

                {!filter.projectId ? (
                  <div className="border-4 border-border-strong border-dashed p-8 text-center bg-bg-panel-alt/50">
                    <span className="material-symbols-outlined text-4xl text-text-muted mb-2">folder_off</span>
                    <p className="font-data-mono text-sm text-text-muted uppercase tracking-widest">
                      Please select a specific project from the global filter first.
                    </p>
                  </div>
                ) : eligibleFeatures.length === 0 ? (
                  <div className="border-4 border-border-strong border-dashed p-8 text-center bg-bg-panel-alt/50">
                    <span className="material-symbols-outlined text-4xl text-text-muted mb-2">inbox</span>
                    <p className="font-data-mono text-sm text-text-muted uppercase tracking-widest">
                      No billable features found for this project.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col h-full border-4 border-border-strong bg-bg-panel-alt shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)]">
                    <div className="p-4 border-b-4 border-border-strong bg-bg-base flex items-center gap-3">
                      <span className="material-symbols-outlined text-text-muted">search</span>
                      <input
                        type="text"
                        placeholder="Search features..."
                        value={featureSearch}
                        onChange={(e) => setFeatureSearch(e.target.value)}
                        className="w-full bg-transparent font-data-mono font-bold text-sm focus:outline-none placeholder:text-text-muted/60"
                      />
                    </div>
                    {searchedFeatures.length === 0 ? (
                      <div className="p-8 text-center text-text-muted font-data-mono text-sm uppercase tracking-widest">
                        No features match your search.
                      </div>
                    ) : (
                      <div className="flex flex-col max-h-[400px] overflow-y-auto custom-scrollbar">
                        {searchedFeatures.map((f) => (
                          <button
                            type="button"
                            key={f.id}
                            onClick={() => toggleFeature(f.id)}
                            className={`flex items-center justify-between p-4 border-b-4 border-border-strong last:border-b-0 transition-colors group ${
                              selectedFeatures.includes(f.id)
                                ? "bg-[var(--footer-strip)] text-white"
                                : "bg-bg-panel-alt hover:bg-bg-base text-text-main hover:text-text-main"
                            }`}
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div className={`w-5 h-5 border-4 flex items-center justify-center shrink-0 transition-colors ${selectedFeatures.includes(f.id) ? "border-brand-green bg-white" : "border-text-muted bg-white group-hover:border-text-main"}`}>
                                {selectedFeatures.includes(f.id) && <div className="w-2 h-2 bg-brand-green" />}
                              </div>
                              <div className="min-w-0 text-left">
                                <div className="font-bold truncate text-base">{f.name}</div>
                                <div className={`font-data-mono text-[9px] uppercase tracking-widest ${selectedFeatures.includes(f.id) ? "text-white/50" : "text-text-muted"}`}>
                                  {f.is_base_feature ? "Base Feature" : "Extra Feature"}
                                </div>
                              </div>
                            </div>
                            <span className={`font-data-mono font-black shrink-0 ml-4 ${selectedFeatures.includes(f.id) ? "text-brand-green drop-shadow-[0_0_4px_rgba(74,222,128,0.5)]" : "text-text-main"}`}>
                              ₹{(f.price ?? 0).toFixed(2)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Dynamic Invoice Builder (The Receipt) */}
            <div className="lg:col-span-5 relative">
              <div className="sticky top-8">
                <div className="bg-bg-base border-4 border-border-strong shadow-[12px_12px_0px_0px_var(--shadow-strong)] flex flex-col">
                  {/* Receipt Header */}
                  <div className="bg-text-main text-white p-6 border-b-4 border-border-strong flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay pointer-events-none"></div>
                    <span className="material-symbols-outlined text-4xl mb-2">receipt</span>
                    <h4 className="font-display-xl text-2xl font-black uppercase tracking-widest">Draft Invoice</h4>
                    <span className="font-data-mono text-xs text-brand-green uppercase tracking-widest font-bold mt-1">Live Preview</span>
                  </div>

                  {/* Receipt Body */}
                  <div className="p-6 space-y-6 flex-1 font-data-mono">
                    {/* Line items -- exactly what's selected on the left, so the subtotal below is never a mystery number */}
                    <div className="pb-6 border-b-4 border-border-strong border-dashed">
                      {selectedFeatureObjects.length === 0 ? (
                        <div className="text-center text-text-muted text-xs uppercase tracking-widest py-4">
                          Select features on the left to build this invoice
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedFeatureObjects.map((f) => (
                            <div key={f.id} className="flex justify-between items-start gap-4">
                              <div className="min-w-0">
                                <div className="font-bold text-sm text-text-main truncate">{f.name}</div>
                                <div className="text-[9px] text-text-muted uppercase tracking-widest">
                                  {f.is_base_feature ? "Base Feature" : "Extra Feature"}
                                </div>
                              </div>
                              <span className="font-bold text-sm text-text-main whitespace-nowrap">₹{(f.price ?? 0).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 pb-6 border-b-4 border-border-strong border-dashed">
                      <div className="flex justify-between items-end">
                        <span className="text-text-muted font-bold text-sm">SUBTOTAL ({selectedFeatures.length} items)</span>
                        <span className="text-xl font-black text-text-main">₹{previewSubtotal.toFixed(2)}</span>
                      </div>

                      {activeDiscount && (
                        <div className="flex justify-between items-start bg-forest-green/10 border-2 border-forest-green p-3 mt-4">
                          <div>
                            <span className="text-forest-green font-black uppercase text-xs block mb-1">DISCOUNT APPLIED</span>
                            <span className="text-forest-green/80 text-[10px] font-bold uppercase">{activeDiscount.name}</span>
                          </div>
                          <span className="text-xl font-black text-forest-green">-₹{previewDiscount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    {/* Inputs inside the receipt */}
                    <div className="space-y-6 pt-2 pb-6 border-b-4 border-border-strong border-dashed">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">
                          + Tax Amount (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          value={taxAmount}
                          onChange={(e) => setTaxAmount(e.target.value)}
                          className="w-full bg-bg-panel-alt border-4 border-border-strong p-3 font-data-mono text-lg font-black focus:outline-none focus:border-text-main shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <div className="text-[9px] text-text-muted uppercase tracking-widest mt-2">Added into the total amount below</div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">
                          Internal Notes / Memo
                        </label>
                        <input
                          type="text"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Optional notes"
                          className="w-full bg-bg-panel-alt border-4 border-border-strong p-3 font-bold focus:outline-none focus:border-text-main shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)] transition-colors"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-end pt-2">
                      <span className="font-black text-lg text-text-main uppercase tracking-widest">Total Amount</span>
                      <span className="text-4xl font-black text-brand-green drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]">₹{previewTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="p-6 bg-bg-panel-alt border-t-4 border-border-strong">
                    <button
                      type="submit"
                      disabled={submitting || !filter.projectId || (selectedFeatures.length === 0)}
                      className="w-full flex items-center justify-center gap-3 bg-brand-green text-on-brand-green font-black text-xl uppercase py-6 border-4 border-on-brand-green shadow-[6px_6px_0px_0px_var(--on-brand-green)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[6px_6px_0px_0px_var(--on-brand-green)] disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                    >
                      {submitting ? "PROCESSING..." : "GENERATE DRAFT INVOICE"}
                      {!submitting && <span className="material-symbols-outlined text-2xl">arrow_forward</span>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* INVOICES LIST */}
      <div>
        <div className="flex flex-col md:flex-row justify-between items-end mb-6 border-b-2 border-border-subtle pb-4">
          <h3 className="font-display-xl text-3xl font-black uppercase text-text-main tracking-tight">
            Invoice Registry
          </h3>
          <div className="flex gap-2">
            {["all", "draft", "finalized", "paid"].map(status => (
              <button
                key={status}
                onClick={() => { setStatusFilter(status); setPage(1); }}
                className={`font-data-mono text-[10px] uppercase font-bold tracking-widest px-4 py-2 border-4 transition-all ${
                  statusFilter === status 
                    ? "bg-text-main border-text-main text-white shadow-[2px_2px_0px_0px_var(--shadow-strong)]" 
                    : "bg-bg-panel-alt border-border-strong text-text-muted hover:border-text-main"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Invoice Directory */}
          <div className="lg:col-span-4 space-y-4">
            {loading ? (
              <div className="py-12 text-center animate-pulse">
                <p className="font-data-mono text-text-muted">Fetching records...</p>
              </div>
            ) : visibleInvoices.length === 0 ? (
              <div className="border-4 border-border-strong border-dashed p-12 text-center bg-bg-panel-alt/30">
                <p className="font-data-mono uppercase tracking-widest font-bold text-text-muted">No records found.</p>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="space-y-4 flex-1">
                  {visibleInvoices.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE).map((inv) => (
                    <button
                      key={inv.id}
                      onClick={() => setSelectedInvoice(inv)}
                      className={`block w-full border-4 p-5 text-left transition-all relative overflow-hidden group ${
                        selectedInvoice?.id === inv.id
                          ? "border-text-main bg-[var(--footer-strip)] text-white shadow-[4px_4px_0px_0px_var(--shadow-strong)]"
                          : "border-border-strong bg-bg-base hover:border-text-main"
                      }`}
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-[60px]">receipt_long</span>
                      </div>
                      <div className="flex items-center justify-between mb-3 relative z-10">
                        <span className={`font-data-mono text-xs font-black tracking-widest px-2 py-1 border-2 ${selectedInvoice?.id === inv.id ? "bg-white/10 border-white/30" : "bg-bg-panel-alt border-border-strong"}`}>INV-{inv.id}</span>
                        <StatusBadge status={inv.status} />
                      </div>
                      <h4 className={`font-bold mb-3 truncate relative z-10 ${selectedInvoice?.id === inv.id ? "text-white" : "text-text-main"}`}>
                        {clientName(clients, inv.client_id)}
                      </h4>
                      <div className="flex justify-between items-end relative z-10">
                        <div className={`font-data-mono text-[10px] uppercase tracking-wider flex items-center gap-1 ${selectedInvoice?.id === inv.id ? "text-white/70" : "text-text-muted"}`}>
                          <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                          {formatDate(inv.created_at)}
                        </div>
                        <div className={`font-black text-xl ${selectedInvoice?.id === inv.id ? "text-brand-green drop-shadow-[0_0_4px_rgba(74,222,128,0.5)]" : "text-text-main"}`}>
                          ₹{inv.total.toFixed(2)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {/* Pagination */}
                {Math.ceil(visibleInvoices.length / ITEMS_PER_PAGE) > 1 && (
                  <div className="flex items-center justify-between mt-6 border-t-4 border-border-strong pt-4">
                    <Button variant="ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 border-2 border-transparent hover:border-border-strong">
                      PREV
                    </Button>
                    <span className="font-data-mono text-sm font-bold uppercase tracking-widest text-text-main">
                      PAGE {page} OF {Math.ceil(visibleInvoices.length / ITEMS_PER_PAGE)}
                    </span>
                    <Button variant="ghost" onClick={() => setPage(p => Math.min(Math.ceil(visibleInvoices.length / ITEMS_PER_PAGE), p + 1))} disabled={page === Math.ceil(visibleInvoices.length / ITEMS_PER_PAGE)} className="px-4 py-2 border-2 border-transparent hover:border-border-strong">
                      NEXT
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Invoice Detail View */}
          <div className="lg:col-span-8">
            {selectedInvoice ? (
              <InvoiceDetailView
                invoice={selectedInvoice}
                clients={clients}
                features={features}
                onChanged={async () => {
                  const fresh = await loadAll();
                  setSelectedInvoice((prev) => fresh.find((x) => x.id === prev?.id) ?? prev);
                }}
                onDelete={async () => {
                  await loadAll();
                  setSelectedInvoice(null);
                }}
              />
            ) : (
              <div className="border-4 border-border-strong border-dashed p-12 text-center text-text-muted h-full flex items-center justify-center bg-bg-panel-alt/50">
                <p className="font-data-mono uppercase tracking-widest">Select an invoice to view document details</p>
              </div>
            )}
          </div>
        </div>
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

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<DiscountType>("percentage");
  const [editValue, setEditValue] = useState("");
  const [editActive, setEditActive] = useState(true);
  const confirm = useConfirm();
  const discountsVersion = useWsEvent("discounts");

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
    if (discountsVersion) loadAll();
  }, [discountsVersion]);

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
          body: { name, discount_type: discountType, value: Number(value), is_active: true },
        });
      } else {
        await apiRequest("/api/admin/discounts", {
          method: "POST",
          body: { client_id: Number(clientId), name, discount_type: discountType, value: Number(value), is_active: true },
        });
      }
      setName("");
      setValue("");
      setMessage("Discount created successfully.");
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not create discount");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteDiscount(id: number) {
    const ok = await confirm({
      message: "Delete this discount? This can't be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await apiRequest(`/api/admin/discounts/${id}`, { method: "DELETE" });
    setMessage("Discount deleted.");
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
      setMessage("Discount updated successfully.");
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not update discount");
    }
  }

  return (
    <div className="space-y-12">
      {/* CREATION FORM - REDESIGNED */}
      <div className="mb-16">
        <h3 className="font-display-xl text-3xl font-black uppercase text-text-main mb-6 flex items-center gap-4">
          <span className="material-symbols-outlined text-4xl text-accent">local_offer</span>
          Create Discount
        </h3>

        <form onSubmit={deploy}>
          {error && <Alert className="mb-6">{error}</Alert>}
          {message && <Alert kind="warning" className="mb-6">{message}</Alert>}
          
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            
            {/* Left Col: Setup Form */}
            <div className="xl:col-span-8 space-y-6">
              <div className="bg-bg-base border-4 border-border-strong p-6 md:p-8 shadow-[8px_8px_0px_0px_var(--shadow-strong)] relative overflow-hidden">
                
                <div className="space-y-8 relative z-10">
                  {/* Step 1: Mapping */}
                  <div>
                    <h4 className="font-label-caps text-xs font-black uppercase tracking-widest text-text-muted mb-4 border-b-4 border-border-strong pb-2">
                      Client
                    </h4>
                    {filter.clientId ? (
                      <div className="bg-bg-panel-alt border-4 border-border-strong p-5 font-bold text-lg text-text-main shadow-[4px_4px_0px_0px_var(--shadow-strong)] flex justify-between items-center">
                        <div>
                          {clients.find((c) => String(c.id) === filter.clientId)?.full_name ?? `#${filter.clientId}`}
                          <div className="font-data-mono text-[10px] uppercase text-text-muted mt-1">From the project filter above</div>
                        </div>
                        <span className="material-symbols-outlined text-accent text-3xl">link</span>
                      </div>
                    ) : (
                      <BrutalistSelect
                        value={clientId}
                        onChange={setClientId}
                        placeholder="Select a client"
                        options={clients.map(c => ({ value: String(c.id), label: c.full_name }))}
                      />
                    )}
                  </div>

                  {/* Step 2: Tag & Values */}
                  <div>
                    <h4 className="font-label-caps text-xs font-black uppercase tracking-widest text-text-muted mb-4 border-b-4 border-border-strong pb-2">
                      Discount Details
                    </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="lg:col-span-2">
                        <input
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Discount Name (e.g. VIP Retainer)"
                          className="w-full bg-white border-4 border-text-main p-4 font-bold text-xl focus:outline-none placeholder:text-text-muted/40 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)]"
                        />
                      </div>

                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={() => setDiscountType("percentage")}
                          className={`flex-1 p-4 border-4 font-black uppercase tracking-widest text-sm transition-all flex flex-col items-center justify-center gap-2 ${
                            discountType === "percentage"
                              ? "bg-text-main border-text-main text-white shadow-[4px_4px_0px_0px_var(--shadow-strong)] translate-x-[-2px] translate-y-[-2px]"
                              : "bg-bg-panel-alt border-border-strong text-text-muted hover:border-text-main"
                          }`}
                        >
                          <span className="material-symbols-outlined text-3xl mb-1">percent</span>
                          PERCENTAGE
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscountType("fixed_amount")}
                          className={`flex-1 p-4 border-4 font-black uppercase tracking-widest text-sm transition-all flex flex-col items-center justify-center gap-2 ${
                            discountType === "fixed_amount"
                              ? "bg-text-main border-text-main text-white shadow-[4px_4px_0px_0px_var(--shadow-strong)] translate-x-[-2px] translate-y-[-2px]"
                              : "bg-bg-panel-alt border-border-strong text-text-muted hover:border-text-main"
                          }`}
                        >
                          <span className="material-symbols-outlined text-3xl mb-1">payments</span>
                          FIXED AMOUNT
                        </button>
                      </div>

                      <div className="flex items-center relative h-full">
                        {discountType === "fixed_amount" && <span className="absolute left-6 font-black text-3xl text-text-muted">₹</span>}
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          placeholder={discountType === "percentage" ? "15.00" : "5000.00"}
                          className={`w-full h-full bg-white border-4 border-text-main p-4 font-data-mono font-black text-4xl focus:outline-none placeholder:text-text-muted/30 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${discountType === "fixed_amount" ? "pl-14" : ""}`}
                        />
                        {discountType === "percentage" && <span className="absolute right-6 font-black text-3xl text-text-muted">%</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Col: Preview & Actions */}
            <div className="xl:col-span-4 relative">
              <div className="sticky top-8 space-y-6">
                
                {/* Preview */}
                <div className="border-4 border-border-strong bg-text-main p-6 shadow-[8px_8px_0px_0px_var(--shadow-strong)] text-white">
                   <div className="space-y-2">
                     <h5 className="font-display-xl text-3xl font-black uppercase leading-none truncate" title={name || "Unnamed Discount"}>
                       {name || "Unnamed Discount"}
                     </h5>
                     <div className="font-data-mono font-black text-brand-green text-5xl py-4">
                       {discountType === "percentage" ? `${value || "0"}%` : `₹${value || "0"}`} <span className="text-xl text-white/50">OFF</span>
                     </div>
                   </div>

                   {clientId && existingActiveForClient && (
                    <div className="mt-6 bg-amber text-on-amber p-4 font-bold border-4 border-on-amber shadow-[4px_4px_0px_0px_var(--on-amber)]">
                      <div className="flex items-center gap-2 font-black uppercase text-sm mb-1">
                        <span className="material-symbols-outlined text-lg">warning</span>
                        Heads Up
                      </div>
                      This will replace this client&apos;s current active discount, &quot;{existingActiveForClient.name}&quot;.
                    </div>
                  )}
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-accent text-white font-black text-xl uppercase py-6 border-4 border-text-main shadow-[8px_8px_0px_0px_var(--shadow-strong)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex justify-center items-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {submitting ? "SAVING..." : "CREATE DISCOUNT"}
                  {!submitting && <span className="material-symbols-outlined text-2xl">arrow_forward</span>}
                </button>
              </div>
            </div>

          </div>
        </form>
      </div>

      {/* RULES LIST */}
      <div>
        <h3 className="font-display-xl text-3xl font-black uppercase text-text-main mb-6 border-b-4 border-border-strong pb-4">
          Discounts
        </h3>

        {loading ? (
          <p className="font-data-mono text-text-muted">Loading...</p>
        ) : discounts.length === 0 ? (
          <div className="border-4 border-border-strong border-dashed p-12 text-center bg-bg-panel-alt">
             <p className="font-data-mono uppercase tracking-widest font-bold">No discounts yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {discounts.map((d) => (
              <div key={d.id} className="border-4 border-border-strong bg-bg-base flex flex-col shadow-[8px_8px_0px_0px_var(--shadow-strong)] relative overflow-hidden">
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
                      {d.is_active ? "Active" : "Inactive"}
                    </div>
                  </div>

                  <div className="space-y-4 font-data-mono text-sm">
                    <div className="flex justify-between border-b-2 border-border-strong/30 pb-2">
                      <span className="text-text-muted uppercase font-bold">Client</span>
                      <span className="font-bold">{clientName(clients, d.client_id)}</span>
                    </div>
                    <div className="flex justify-between border-b-2 border-border-strong/30 pb-2">
                      <span className="text-text-muted uppercase font-bold">Type</span>
                      <span className="font-bold">{d.discount_type === "percentage" ? "PERCENTAGE" : "FIXED AMOUNT"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted uppercase font-bold">Amount</span>
                      <span className="font-black text-xl text-brand-green">
                        {d.discount_type === "percentage" ? `${d.value}%` : `₹${d.value.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Edit Form */}
                {editingId === d.id && (
                  <div className="p-6 bg-accent/10 border-t-4 border-accent relative z-10">
                    <h5 className="font-label-caps font-black uppercase tracking-widest text-accent mb-6 flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">edit</span> Edit Discount
                    </h5>
                    <div className="space-y-6 mb-8">
                      <div>
                        <label className="block font-data-mono text-[10px] font-black uppercase tracking-widest text-accent mb-2">
                          Discount Name
                        </label>
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full border-4 border-text-main p-4 font-bold focus:outline-none shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)]" placeholder="Discount Name" />
                      </div>
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1">
                          <label className="block font-data-mono text-[10px] font-black uppercase tracking-widest text-accent mb-2">
                            Type
                          </label>
                          <select value={editType} onChange={(e) => setEditType(e.target.value as DiscountType)} className="w-full border-4 border-text-main p-4 font-bold focus:outline-none shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)]">
                            <option value="percentage">Percentage</option>
                            <option value="fixed_amount">Fixed Amount</option>
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block font-data-mono text-[10px] font-black uppercase tracking-widest text-accent mb-2">
                            Amount
                          </label>
                          <input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-full border-4 border-text-main p-4 font-data-mono font-black text-xl focus:outline-none shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <button onClick={() => overwriteDiscount(d.id)} className="bg-text-main text-white font-black uppercase tracking-widest px-8 py-4 border-4 border-transparent shadow-[4px_4px_0px_0px_var(--shadow-strong)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex-1">
                        SAVE CHANGES
                      </button>
                      <button onClick={() => setEditingId(null)} className="border-4 border-border-strong text-text-main font-black uppercase tracking-widest px-8 py-4 hover:bg-bg-panel-alt transition-colors bg-white">
                        CANCEL
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Footer */}
                <div className="p-4 bg-bg-panel-alt border-t-4 border-border-strong flex justify-between relative z-10">
                  <button onClick={() => startEditDiscount(d)} className="font-data-mono text-[10px] font-bold uppercase tracking-widest text-accent hover:underline flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">edit</span> EDIT
                  </button>
                  <button onClick={() => deleteDiscount(d.id)} className="font-data-mono text-[10px] font-bold uppercase tracking-widest text-coral-red hover:underline flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">delete</span> DELETE
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


function InvoiceDetailView({ invoice, clients, features, onChanged, onDelete }: {
  invoice: Invoice;
  clients: User[];
  features: FeatureRequest[];
  onChanged: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [editTax, setEditTax] = React.useState(String(invoice.tax_amount));
  const [editNotes, setEditNotes] = React.useState(invoice.notes ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [removingLineItemId, setRemovingLineItemId] = React.useState<number | null>(null);
  const [addFeatureId, setAddFeatureId] = React.useState("");
  const [addingFeature, setAddingFeature] = React.useState(false);
  const confirm = useConfirm();

  useEffect(() => {
    setEditing(false);
    setEditTax(String(invoice.tax_amount));
    setEditNotes(invoice.notes ?? "");
    setError(null);
    setMessage(null);
    setAddFeatureId("");
  }, [invoice.id]);

  async function finalize() {
    const ok = await confirm("Finalize this invoice? This issues the signed document to the client and cannot be undone.");
    if (!ok) return;
    setError(null);
    setMessage(null);
    try {
      await apiRequest(`/api/admin/billing/invoices/${invoice.id}/finalize`, { method: "POST" });
      await onChanged();
    } catch (err: any) {
      setError(String(err.detail || "Could not finalize invoice"));
    }
  }

  async function deleteDraft() {
    const ok = await confirm({
      message: "Delete this draft invoice? This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await apiRequest(`/api/admin/billing/invoices/${invoice.id}`, { method: "DELETE" });
    await onDelete();
  }

  async function overwrite() {
    setError(null);
    try {
      await apiRequest(`/api/admin/billing/invoices/${invoice.id}`, {
        method: "PUT",
        body: { tax_amount: Number(editTax) || 0, notes: editNotes },
      });
      setEditing(false);
      await onChanged();
    } catch (err: any) {
      setError(String(err.detail || "Could not overwrite invoice"));
    }
  }

  async function removeLineItem(lineItemId: number) {
    const ok = await confirm({
      message: "Remove this line item from the draft invoice?",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    setError(null);
    setRemovingLineItemId(lineItemId);
    try {
      await apiRequest(`/api/admin/billing/invoices/${invoice.id}/line-items/${lineItemId}`, { method: "DELETE" });
      await onChanged();
    } catch (err: any) {
      setError(String(err.detail || "Could not remove line item"));
    } finally {
      setRemovingLineItemId(null);
    }
  }

  async function addFeature() {
    if (!addFeatureId) return;
    setError(null);
    setAddingFeature(true);
    try {
      await apiRequest(`/api/admin/billing/invoices/${invoice.id}/line-items`, {
        method: "POST",
        body: { feature_ids: [Number(addFeatureId)] },
      });
      setAddFeatureId("");
      await onChanged();
    } catch (err: any) {
      setError(String(err.detail || "Could not add feature to invoice"));
    } finally {
      setAddingFeature(false);
    }
  }

  const client = clients.find(c => c.id === invoice.client_id);
  const clientNameStr = client?.full_name ?? `#${invoice.client_id}`;

  const eligibleToAdd = features.filter(
    (f) =>
      f.client_id === invoice.client_id &&
      f.project_id === invoice.project_id &&
      f.added_by_client &&
      f.status === "approved" &&
      !invoice.line_items.some((li) => li.feature_request_id === f.id)
  );

  return (
    <div className="border-4 border-border-strong bg-bg-base p-6 md:p-8 shadow-[8px_8px_0px_0px_var(--shadow-strong)] relative overflow-hidden h-full flex flex-col">
      <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none transform translate-x-1/4 -translate-y-1/4">
        <span className="material-symbols-outlined text-[300px]">receipt_long</span>
      </div>
      
      <div className="space-y-6 relative z-10 flex-1">
        {error && <Alert>{error}</Alert>}
        {message && <Alert kind="warning">{message}</Alert>}

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b-4 border-border-strong pb-6">
           <div>
             <div className="flex items-center gap-3 mb-3">
               <span className="font-data-mono text-xs font-black tracking-widest text-text-main bg-border-strong/10 px-2 py-1 border-2 border-border-strong">
                 DOCUMENT INV-{invoice.id}
               </span>
               <StatusBadge status={invoice.status} />
             </div>
             <h2 className="font-headline-lg text-3xl font-black uppercase text-text-main leading-tight mb-2">
               {clientNameStr}
             </h2>
             <span className="font-data-mono text-sm text-text-muted">
               Generated: {formatDate(invoice.created_at)}
             </span>
           </div>
        </div>

        <div className="bg-bg-panel-alt border-4 border-border-strong p-6 space-y-4">
          <h4 className="font-label-caps font-black uppercase tracking-widest text-text-muted border-b-2 border-border-strong pb-4 mb-4">Line Item Diagnostics</h4>
          {invoice.line_items.length === 0 ? (
            <p className="font-data-mono text-sm text-text-muted">No line items mapped.</p>
          ) : (
            <div className="space-y-4">
              {invoice.line_items.map((li) => (
                <div key={li.id} className="flex justify-between items-center border-b-2 border-border-strong/20 pb-4">
                  <span className="font-bold text-base text-text-main flex items-center gap-3">
                    {li.item_type === "maintenance" && (
                      <span className="font-data-mono text-[10px] font-black uppercase tracking-widest bg-brand-green text-on-brand-green px-2 py-1 border-2 border-on-brand-green">MAINT</span>
                    )}
                    {li.description}
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="font-data-mono font-black text-lg">₹{li.amount.toFixed(2)}</span>
                    {editing && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(li.id)}
                        disabled={removingLineItemId === li.id}
                        title="Remove line item"
                        className="text-coral-red hover:bg-coral-red hover:text-white border-2 border-coral-red p-1 transition-colors disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-base block">delete</span>
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {editing && (
            <div className="pt-4 border-t-2 border-border-strong/20">
              {eligibleToAdd.length === 0 ? (
                <p className="font-data-mono text-xs text-text-muted uppercase tracking-widest">No approved features available to add.</p>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <BrutalistSelect
                      value={addFeatureId}
                      onChange={setAddFeatureId}
                      placeholder="Select feature to add..."
                      searchable={true}
                      options={eligibleToAdd.map((f) => ({ value: String(f.id), label: `${f.name} (₹${(f.price ?? 0).toFixed(2)})` }))}
                    />
                  </div>
                  <Button onClick={addFeature} disabled={!addFeatureId || addingFeature} className="font-bold uppercase tracking-widest px-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">add_circle</span>
                    {addingFeature ? "Adding..." : "Add to Invoice"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-12 font-data-mono border-4 border-border-strong p-8 bg-bg-base">
          <div className="space-y-3 text-right">
            <div className="text-text-muted font-bold text-sm">SUBTOTAL</div>
            {invoice.discount_amount > 0 && <div className="text-forest-green font-bold text-sm">DISCOUNT ALIGNMENT</div>}
            <div className="text-text-muted font-bold text-sm">TAX COMPUTATION</div>
            <div className="font-black text-xl pt-4 text-text-main uppercase tracking-widest border-t-4 border-border-strong mt-4">FINAL SUMMATION</div>
          </div>
          <div className="space-y-3 text-right font-black text-base">
            <div>₹{invoice.subtotal.toFixed(2)}</div>
            {invoice.discount_amount > 0 && <div className="text-forest-green">-₹{invoice.discount_amount.toFixed(2)}</div>}
            <div>₹{invoice.tax_amount.toFixed(2)}</div>
            <div className="text-4xl text-brand-green pt-4 border-t-4 border-border-strong mt-4 drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]">₹{invoice.total.toFixed(2)}</div>
          </div>
        </div>

        {invoice.notes && (
          <div className="p-6 border-4 border-border-strong bg-bg-panel-alt">
            <span className="font-data-mono text-xs uppercase font-black tracking-widest text-text-muted flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-base">notes</span>
              Internal Notes / Memo
            </span>
            <p className="font-bold text-base text-text-main leading-relaxed">{invoice.notes}</p>
          </div>
        )}

        {invoice.status === "draft" && !editing && (
          <div className="flex flex-wrap gap-4 pt-6 border-t-4 border-border-strong mt-8">
            <Button onClick={finalize} className="flex items-center gap-2 bg-brand-green text-on-brand-green font-black uppercase tracking-widest border-4 border-on-brand-green shadow-[4px_4px_0px_0px_var(--on-brand-green)] hover:-translate-y-1 hover:shadow-none transition-all px-8 py-4">
              <span className="material-symbols-outlined text-xl">check_circle</span>
              Finalize Invoice
            </Button>
            <Button onClick={() => setEditing(true)} variant="secondary" className="flex items-center gap-2 border-4 border-text-main text-text-main font-black uppercase tracking-widest hover:bg-text-main hover:text-white transition-colors px-8 py-4">
              <span className="material-symbols-outlined text-xl">edit</span>
              Edit Invoice
            </Button>
            <Button onClick={deleteDraft} variant="danger" className="flex items-center gap-2 font-black uppercase tracking-widest ml-auto border-4 border-coral-red bg-transparent text-coral-red hover:bg-coral-red hover:text-white px-8 py-4">
              <span className="material-symbols-outlined text-xl">delete</span>
              Delete Draft
            </Button>
          </div>
        )}

        {editing && (
          <div className="mt-8 bg-bg-panel-alt border-4 border-border-strong p-8 relative shadow-[8px_8px_0px_0px_var(--shadow-strong)]">
            <h5 className="font-label-caps font-black text-lg uppercase tracking-widest text-text-main mb-6 flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl">edit_note</span>
              Edit Draft Invoice
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <label className="block font-data-mono text-xs font-black uppercase tracking-widest text-text-muted mb-3">
                  Tax Amount (₹)
                </label>
                <input type="number" step="0.01" value={editTax} onChange={(e) => setEditTax(e.target.value)} className="w-full border-4 border-text-main p-4 font-data-mono font-black text-xl focus:outline-none shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
              <div>
                <label className="block font-data-mono text-xs font-black uppercase tracking-widest text-text-muted mb-3">
                  Internal Notes / Memo
                </label>
                <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="w-full border-4 border-text-main p-4 font-bold text-lg focus:outline-none shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)]" />
              </div>
            </div>
            <div className="flex gap-4">
              <Button onClick={overwrite} className="flex items-center gap-2 bg-text-main text-white font-black uppercase tracking-widest border-4 border-transparent shadow-[4px_4px_0px_0px_var(--shadow-strong)] px-8 py-4 hover:translate-x-1 hover:translate-y-1 hover:shadow-none">
                <span className="material-symbols-outlined text-xl">save</span>
                Save Changes
              </Button>
              <Button onClick={() => setEditing(false)} variant="secondary" className="flex items-center gap-2 font-black uppercase tracking-widest border-4 border-border-strong px-8 py-4 bg-bg-panel-alt hover:bg-border-strong/10">
                <span className="material-symbols-outlined text-xl">close</span>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center pt-8 mt-8 border-t-4 border-border-strong relative z-10">
        <Link
          href={`/admin/billing/invoices/${invoice.id}`}
          className="font-data-mono text-sm uppercase font-black tracking-widest flex items-center gap-3 text-text-main hover:text-brand-green hover:bg-brand-green/10 transition-colors py-4 px-8 border-4 border-text-main hover:border-brand-green"
        >
          [ EXECUTE / VIEW FULL DOCUMENT ]
          <span className="material-symbols-outlined text-xl">open_in_new</span>
        </Link>
      </div>
    </div>
  );
}
