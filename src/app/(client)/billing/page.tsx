"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiRequest, ApiError } from "@/lib/api";
import {
  Discount,
  FeatureRequest,
  InfrastructureCostEntry,
  Invoice,
  InvoiceLineItem,
  MaintenanceRecord,
  ProjectFeatures,
} from "@/lib/types";
import { Alert, Button, EmptyState } from "@/components/ui";
import { useProject } from "@/lib/project-context";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { generateInvoicePdf, InvoicePdfGroup } from "@/lib/invoice-pdf";

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

// jsPDF's built-in helvetica/courier fonts only cover WinAnsi (Latin-1) — the ₹ glyph
// (U+20B9) isn't in that encoding, so it renders as mojibake and throws off jsPDF's
// per-character width math for the rest of the string. Use a plain-ASCII prefix in the PDF.
function formatINRPdf(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN")}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso)
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
}

// The print document mirrors the source design, which renders dates in mixed case (not caps).
function formatDateMixedCase(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const statusStyle: Record<string, string> = {
  paid: "bg-brand-green text-on-brand-green",
  finalized: "bg-brand-green text-on-brand-green",
  draft: "bg-[#8A8F95] text-[#E8E2D6]",
};

const statusHex: Record<string, { bg: string; color: string }> = {
  paid: { bg: "#15BB00", color: "#0A2E08" },
  finalized: { bg: "#15BB00", color: "#0A2E08" },
  draft: { bg: "#8A8F95", color: "#E8E2D6" },
};

function InvoiceStatusTag({ status }: { status: string }) {
  return (
    <span
      className={`font-data-mono text-[10px] font-bold tracking-widest uppercase px-2 py-1 whitespace-nowrap ${statusStyle[status] ?? "bg-[#8A8F95] text-[#E8E2D6]"}`}
    >
      {status}
    </span>
  );
}

interface ProjectDetailData {
  features: FeatureRequest[];
  infraCosts: InfrastructureCostEntry[];
  maintenance: MaintenanceRecord[];
  discount: Discount | null;
}

type ItemGroup = { key: string; tag: string; tagClass: string; label: string; items: InvoiceLineItem[] };

function groupLineItems(items: InvoiceLineItem[], features: FeatureRequest[]): ItemGroup[] {
  const base: InvoiceLineItem[] = [];
  const extra: InvoiceLineItem[] = [];
  const other: InvoiceLineItem[] = [];
  for (const li of items) {
    const fr = li.feature_request_id != null ? features.find((f) => f.id === li.feature_request_id) : undefined;
    if (fr?.is_base_feature) base.push(li);
    else if (fr) extra.push(li);
    else other.push(li);
  }
  const groups: ItemGroup[] = [];
  if (base.length) groups.push({ key: "base", tag: "BASE", label: "CORE BASE FEATURES", tagClass: "bg-brand-green text-on-brand-green", items: base });
  if (extra.length) groups.push({ key: "extra", tag: "CLIENT REQUESTED", label: "EXTRA FEATURES · CLIENT REQUESTED", tagClass: "bg-warning text-text-inverse", items: extra });
  if (other.length) groups.push({ key: "other", tag: "OTHER", label: "OTHER CHARGES", tagClass: "bg-text-muted text-text-inverse", items: other });
  return groups;
}

// Hex equivalents of the Tailwind classes above, for the vector PDF (which draws its own
// shapes/text instead of reading computed CSS).
const groupTagHex: Record<string, { bg: string; color: string }> = {
  base: { bg: "#15BB00", color: "#0A2E08" },
  extra: { bg: "#B25E00", color: "#FFFFFF" },
  other: { bg: "#8A8F95", color: "#FFFFFF" },
};

export default function BillingPage() {
  const { user } = useAuth();
  const { projects } = useProject();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filterProjectId, setFilterProjectId] = useState<number | "all">("all");

  const [detailCache, setDetailCache] = useState<Record<number, ProjectDetailData>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    apiRequest<Invoice[]>("/api/billing/invoices")
      .then(setInvoices)
      .catch((err) => setError(err instanceof ApiError ? String(err.detail) : "Could not load invoices"))
      .finally(() => setLoading(false));
  }, []);

  const current = selectedId != null ? invoices.find((i) => i.id === selectedId) ?? null : null;

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
  }, [current?.project_id]);

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
    const itemGroups = groupLineItems(current.line_items, detail?.features ?? []);
    const recurringTotal = current.line_items.reduce((sum, li) => {
      if (li.feature_request_id == null || !detail) return sum;
      return sum + detail.infraCosts.filter((c) => c.feature_request_id === li.feature_request_id).reduce((s, c) => s + c.monthly_overhead_price, 0);
    }, 0);
    const latestMaintenance = detail?.maintenance[0];
    const canExport = current.status !== "draft";
    const taxableValue = current.subtotal - current.discount_amount;

    async function handleDownload() {
      const invoice = current;
      if (!invoice) return;
      setDownloading(true);
      try {
        const groups: InvoicePdfGroup[] = itemGroups.map((group) => ({
          tag: group.tag,
          label: group.label,
          tagBg: groupTagHex[group.key]?.bg ?? "#8A8F95",
          tagColor: groupTagHex[group.key]?.color ?? "#FFFFFF",
          items: group.items.map((li) => {
            const fr = li.feature_request_id != null ? detail?.features.find((f) => f.id === li.feature_request_id) : undefined;
            const externals = detail && li.feature_request_id != null
              ? detail.infraCosts.filter((c) => c.feature_request_id === li.feature_request_id)
              : [];
            return {
              id: li.id,
              name: fr?.name ?? "Line Item",
              code: fr?.feature_id ?? null,
              description: li.description,
              hoursLine: `Frontend ${li.frontend_hours}h · Backend ${li.backend_hours}h · Production ${li.production_hours}h`,
              agreement: fr?.agreement_date ?? null,
              price: formatINRPdf(li.amount),
              externals: externals.map((ext) => ({ name: ext.module, price: `${formatINRPdf(ext.monthly_overhead_price)} /mo` })),
            };
          }),
        }));

        const doc = await generateInvoicePdf({
          invoiceNumber: String(invoice.id).padStart(5, "0"),
          status: invoice.status,
          statusBg: (statusHex[invoice.status] ?? statusHex.draft).bg,
          statusColor: (statusHex[invoice.status] ?? statusHex.draft).color,
          issuedDate: formatDateMixedCase(invoice.finalized_at ?? invoice.created_at),
          dueDate: formatDateMixedCase(addDays(invoice.finalized_at ?? invoice.created_at, 15)),
          billedToName: user?.full_name ?? "—",
          billedToEmail: user?.email ?? "",
          projectName: projectName(invoice.project_id),
          groups,
          maintenance: latestMaintenance
            ? [
                { k: "CYCLE YEAR", v: String(latestMaintenance.cycle_year) },
                { k: "STATUS", v: latestMaintenance.status.replace(/_/g, " ") },
                { k: "DUE DATE", v: formatDateMixedCase(latestMaintenance.due_date) },
                { k: "AMOUNT", v: formatINRPdf(latestMaintenance.amount) },
              ]
            : null,
          discount: detail?.discount
            ? {
                name: detail.discount.name,
                pctLabel: detail.discount.discount_type === "percentage" ? `-${detail.discount.value}%` : `-${formatINRPdf(detail.discount.value)}`,
              }
            : null,
          recurringNote: recurringTotal > 0 ? `+ Recurring ${formatINRPdf(recurringTotal)}/mo billed separately` : null,
          totals: [
            { k: "SUBTOTAL", v: formatINRPdf(invoice.subtotal) },
            { k: "DISCOUNT", v: `-${formatINRPdf(invoice.discount_amount)}` },
            { k: "TAXABLE VALUE", v: formatINRPdf(taxableValue) },
            { k: "GST", v: formatINRPdf(invoice.tax_amount) },
          ],
          totalDue: formatINRPdf(invoice.total),
          footerNote: invoice.notes || "Thank you for your business. This is a computer-generated invoice.",
          logoUrl: "/brand/garia-logo.png",
        });
        doc.save(`Garia_Invoice_${String(invoice.id).padStart(5, "0")}.pdf`);
        toast.success("PDF Downloaded Successfully");
      } catch (err) {
        console.error(err);
        toast.error("Failed to generate PDF.");
      } finally {
        setDownloading(false);
      }
    }

    return (
      <div className="space-y-6 pb-24">
        <div className="no-print">
          <button
            onClick={backToList}
            className="inline-flex items-center gap-2 font-data-mono text-xs font-bold tracking-widest text-text-main hover:text-brand-green transition-colors mb-6"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>ALL INVOICES
          </button>

          <div className="flex items-end justify-between gap-6 flex-wrap mb-8">
            <div>
              <p className="font-data-mono text-xs tracking-[0.2em] uppercase text-text-muted mb-2">
                {`Financial Records // ${projectName(current.project_id)} // Project Invoices`}
              </p>
              <h1 className="font-display-2xl text-5xl md:text-7xl font-black uppercase text-text-main leading-none tracking-tighter">
                Invoice<br />#{String(current.id).padStart(5, "0")}
              </h1>
            </div>
            {canExport && (
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => window.print()} className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">print</span>PRINT
                </Button>
                <Button onClick={handleDownload} disabled={downloading} className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">download</span>
                  {downloading ? "PROCESSING..." : "DOWNLOAD PDF"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/*
          This is the on-screen reading view. What actually gets printed/exported to PDF is the
          separate compact document below (#invoice-print-root) — it intentionally uses literal
          colors instead of the app's light/dark theme tokens, since a printed invoice is a fixed
          document, not adaptive UI chrome.
        */}
        <div className="border-4 border-[#2A2E33] bg-[#E8E2D6] text-[#2A2E33] shadow-[8px_8px_0px_0px_#2A2E33] overflow-x-auto">
          <div className="min-w-[720px]">
            {/* Header strip */}
            <div className="grid grid-cols-[1.25fr_1fr_1.05fr] border-b-4 border-[#2A2E33]">
              <div className="p-6 border-r-4 border-[#2A2E33] bg-[#F2ECE0]">
                <div className="flex items-center gap-3 mb-3">
                  <img src="/brand/garia-logo.png" alt="Garia Solutions" className="w-11 h-11 object-contain" />
                  <div className="font-black text-2xl leading-none tracking-tighter uppercase">GARIA<br />SOLUTIONS</div>
                </div>
                <div className="font-data-mono text-[11px] leading-relaxed text-[#8A8F95]">
                  GARIA SOFTWARE PVT. LTD.<br />billing@garia.solutions
                </div>
              </div>
              <div className="p-6 border-r-4 border-[#2A2E33] bg-[#F2ECE0] flex flex-col gap-4 justify-center">
                <div>
                  <div className="font-data-mono text-[10px] tracking-widest text-[#8A8F95] uppercase">Invoice No.</div>
                  <div className="font-data-mono font-bold text-2xl">#{String(current.id).padStart(5, "0")}</div>
                </div>
                <div>
                  <div className="font-data-mono text-[10px] tracking-widest text-[#8A8F95] uppercase">Date Issued</div>
                  <div className="font-data-mono font-bold text-sm">{formatDate(current.finalized_at ?? current.created_at)}</div>
                </div>
              </div>
              <div className="p-6 bg-[#3E444A] text-[#E8E2D6] flex flex-col justify-between gap-5">
                <div className="flex justify-end"><InvoiceStatusTag status={current.status} /></div>
                <div>
                  <div className="font-data-mono text-[10px] tracking-[0.2em] text-[#c1c7ce]">AMOUNT DUE</div>
                  <div className="font-black text-3xl md:text-4xl leading-tight tracking-tight text-brand-green whitespace-nowrap">
                    {formatINR(current.total)}
                  </div>
                </div>
              </div>
            </div>

            {/* Billed to / Project */}
            <div className="grid grid-cols-2 border-b-4 border-[#2A2E33]">
              <div className="p-6 border-r-4 border-[#2A2E33]">
                <div className="font-data-mono text-[10px] tracking-widest text-[#8A8F95] uppercase mb-2">Billed To</div>
                <div className="font-bold text-lg">{user?.full_name ?? "—"}</div>
                <div className="font-data-mono text-xs text-[#8A8F95] mt-1">{user?.email}</div>
              </div>
              <div className="p-6">
                <div className="font-data-mono text-[10px] tracking-widest text-[#8A8F95] uppercase mb-2">Project</div>
                <div className="font-bold text-lg">{projectName(current.project_id)}</div>
              </div>
            </div>

            {/* Line item groups */}
            {itemGroups.length === 0 ? (
              <div className="p-8 text-center font-data-mono text-[#8A8F95]">No line items on this invoice.</div>
            ) : (
              itemGroups.map((group) => (
                <div key={group.key}>
                  <div className="bg-[#3E444A] text-[#E8E2D6] px-6 py-3 flex items-center justify-between border-b-4 border-[#2A2E33] border-t-4">
                    <div className="flex items-center gap-3">
                      <span className={`font-data-mono font-bold text-[10px] tracking-widest px-2 py-1 ${group.tagClass}`}>{group.tag}</span>
                      <div className="font-black text-base tracking-wide">{group.label}</div>
                    </div>
                    <div className="font-data-mono text-[11px] text-[#c1c7ce]">
                      {group.items.length} {group.items.length === 1 ? "FEATURE" : "FEATURES"}
                    </div>
                  </div>

                  <div className="grid grid-cols-[48px_1fr_108px_112px] bg-[#F2ECE0] border-b-2 border-[#2A2E33] font-data-mono text-[10px] tracking-widest text-[#8A8F95] font-bold">
                    <div className="p-3 border-r-2 border-[#2A2E33]/15">ID</div>
                    <div className="p-3 border-r-2 border-[#2A2E33]/15">DELIVERABLE / EFFORT</div>
                    <div className="p-3 text-right border-r-2 border-[#2A2E33]/15">HOURS</div>
                    <div className="p-3 text-right">AMOUNT</div>
                  </div>

                  {group.items.map((li) => {
                    const fr = li.feature_request_id != null ? detail?.features.find((f) => f.id === li.feature_request_id) : undefined;
                    const externals = detail && li.feature_request_id != null
                      ? detail.infraCosts.filter((c) => c.feature_request_id === li.feature_request_id)
                      : [];
                    const hours = li.frontend_hours + li.backend_hours + li.production_hours;
                    return (
                      <div key={li.id} className="border-b-4 border-[#2A2E33]">
                        <div className="grid grid-cols-[48px_1fr_108px_112px]">
                          <div className="p-4 border-r-2 border-[#2A2E33]/15 font-data-mono font-bold text-sm text-[#8A8F95]">#{li.id}</div>
                          <div className="p-4 border-r-2 border-[#2A2E33]/15">
                            <div className="font-bold text-base">{fr?.name ?? "Line Item"}</div>
                            <div className="font-data-mono text-[11px] text-[#8A8F95] my-1">{li.description}</div>
                            <div className="flex gap-2 flex-wrap">
                              <span className="border-2 border-[#2A2E33] px-2 py-1 font-data-mono text-[10px] font-semibold whitespace-nowrap">Frontend {li.frontend_hours}h</span>
                              <span className="border-2 border-[#2A2E33] px-2 py-1 font-data-mono text-[10px] font-semibold whitespace-nowrap">Backend {li.backend_hours}h</span>
                              <span className="border-2 border-[#2A2E33] px-2 py-1 font-data-mono text-[10px] font-semibold whitespace-nowrap">Production {li.production_hours}h</span>
                            </div>
                          </div>
                          <div className="p-3 border-r-2 border-[#2A2E33]/15 text-right">
                            <div className="font-data-mono font-bold text-sm whitespace-nowrap">{hours}h</div>
                            {fr?.agreement_date && (
                              <>
                                <div className="font-data-mono text-[9px] tracking-widest text-[#8A8F95] mt-2 whitespace-nowrap">AGREEMENT</div>
                                <div className="font-data-mono text-[10px] font-semibold whitespace-nowrap">{formatDate(fr.agreement_date)}</div>
                              </>
                            )}
                          </div>
                          <div className="p-4 text-right font-data-mono font-bold text-base text-brand-green whitespace-nowrap">{formatINR(li.amount)}</div>
                        </div>
                        {externals.length > 0 && (
                          <div className="bg-[#F2ECE0] border-t-2 border-dashed border-[#2A2E33] px-4 pt-3 pb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="material-symbols-outlined text-warning text-sm">cloud</span>
                              <div className="font-data-mono text-[10px] tracking-widest font-bold">EXTERNAL SERVICES ({externals.length})</div>
                              <div className="font-data-mono text-[10px] text-[#8A8F95]">· RECURRING / BILLED SEPARATELY</div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {externals.map((ext) => (
                                <div key={ext.id} className="border-2 border-[#2A2E33] bg-[#3E444A] text-[#E8E2D6] px-3 py-2 flex justify-between items-center">
                                  <div className="font-bold text-sm">{ext.module}</div>
                                  <div className="font-data-mono font-bold text-sm text-brand-green">
                                    {formatINR(ext.monthly_overhead_price)}<span className="text-[10px] text-[#c1c7ce]"> /mo</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}

            {/* Maintenance / Discount / Totals */}
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-6 border-r-0 md:border-r-4 border-[#2A2E33] flex flex-col gap-6 border-t-4 md:border-t-0">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-brand-green text-lg">build</span>
                    <div className="font-data-mono text-[11px] tracking-widest font-bold">MAINTENANCE PROFILE</div>
                  </div>
                  {detailLoading && !detail ? (
                    <div className="font-data-mono text-xs text-[#8A8F95]">Loading…</div>
                  ) : latestMaintenance ? (
                    <div className="space-y-2">
                      {[
                        { k: "CYCLE YEAR", v: String(latestMaintenance.cycle_year) },
                        { k: "STATUS", v: latestMaintenance.status.replace(/_/g, " ") },
                        { k: "DUE DATE", v: formatDate(latestMaintenance.due_date) },
                        { k: "AMOUNT", v: formatINR(latestMaintenance.amount) },
                      ].map((row) => (
                        <div key={row.k} className="flex justify-between items-center py-2 border-b-2 border-[#2A2E33]/15">
                          <div className="font-data-mono text-xs text-[#8A8F95]">{row.k}</div>
                          <div className="font-data-mono text-sm font-bold uppercase">{row.v}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="font-data-mono text-xs text-[#8A8F95]">No maintenance cycle on file.</div>
                  )}
                </div>

                <div>
                  <div className="font-data-mono text-[11px] tracking-widest font-bold mb-3">DISCOUNT PROFILE</div>
                  {detail?.discount ? (
                    <div className="border-2 border-[#2A2E33] bg-[#3E444A] text-[#E8E2D6] p-4 shadow-[4px_4px_0px_0px_#15BB00]">
                      <div className="flex justify-between items-center">
                        <div className="font-data-mono font-bold text-lg tracking-widest text-brand-green">{detail.discount.name}</div>
                        <div className="font-black text-xl text-brand-green">
                          {detail.discount.discount_type === "percentage" ? `-${detail.discount.value}%` : `-${formatINR(detail.discount.value)}`}
                        </div>
                      </div>
                      <div className="font-data-mono text-[11px] text-[#c1c7ce] mt-2">Currently active for this project</div>
                    </div>
                  ) : (
                    <div className="font-data-mono text-xs text-[#8A8F95]">No active discount on this project.</div>
                  )}
                </div>
              </div>

              <div className="p-6 flex flex-col justify-end border-t-4 md:border-t-0 border-[#2A2E33]">
                {recurringTotal > 0 && (
                  <div className="border-2 border-warning bg-warning/10 px-4 py-3 mb-4 flex items-start gap-3">
                    <span className="material-symbols-outlined text-warning text-lg leading-none">info</span>
                    <div className="font-data-mono text-xs text-[#2A2E33] leading-relaxed">
                      <span className="font-bold">Note:</span> {formatINR(recurringTotal)}/mo in recurring external services is billed separately and is <span className="font-bold">not</span> included in the total below.
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {[
                    { k: "SUBTOTAL", v: formatINR(current.subtotal) },
                    { k: "DISCOUNT", v: `-${formatINR(current.discount_amount)}` },
                    { k: "TAXABLE VALUE", v: formatINR(taxableValue) },
                    { k: "GST", v: formatINR(current.tax_amount) },
                  ].map((row) => (
                    <div key={row.k} className="flex justify-between py-1">
                      <div className="font-data-mono text-xs tracking-widest text-[#8A8F95]">{row.k}</div>
                      <div className="font-data-mono text-sm font-bold">{row.v}</div>
                    </div>
                  ))}
                </div>
                <div className="h-[3px] bg-[#2A2E33] my-4" />
                <div className="bg-brand-green text-on-brand-green border-4 border-[#2A2E33] px-5 py-4 shadow-[6px_6px_0px_0px_#2A2E33] flex justify-between items-center gap-3 flex-wrap">
                  <div className="font-data-mono text-xs tracking-widest font-bold">TOTAL DUE</div>
                  <div className="font-black text-2xl md:text-4xl tracking-tight whitespace-nowrap">{formatINR(current.total)}</div>
                </div>
              </div>
            </div>

            {current.notes && (
              <div className="p-6 border-t-4 border-[#2A2E33] font-data-mono text-xs text-[#8A8F95]">{current.notes}</div>
            )}
          </div>
        </div>

        {/*
          Compact print document — this is what PRINT (window.print()) renders.
          DOWNLOAD PDF no longer captures this DOM node; it draws its own PDF via
          generateInvoicePdf (see src/lib/invoice-pdf.ts) since html2canvas mangled text here.
          Kept off-screen (not display:none) during normal browsing so it stays laid out;
          @media print in globals.css repositions it on top for window.print().
          Portaled to document.body so it's a sibling of the whole app shell, not a descendant —
          otherwise the app shell's invisible-but-still-laid-out height (Sidebar/min-h-screen) pads
          the print output with a trailing blank page.
        */}
        {typeof document !== "undefined" && createPortal(
        <div
          id="invoice-print-root"
          className="fixed top-0 left-[-9999px] w-[794px] bg-white text-[#2A2E33]"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          <div className="p-10">
            <div className="flex justify-between items-start border-b-4 border-[#2A2E33] pb-5">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <img src="/brand/garia-logo.png" alt="Garia Solutions" className="w-11 h-11 object-contain" />
                  <div className="font-black text-2xl leading-none tracking-tighter uppercase">GARIA<br />SOLUTIONS</div>
                </div>
                <div className="font-data-mono text-[10px] leading-relaxed text-[#8A8F95]">
                  GARIA SOFTWARE PVT. LTD.<br />billing@garia.solutions
                </div>
              </div>
              <div className="text-right">
                <div className="font-black text-3xl tracking-tight">INVOICE</div>
                <div className="font-data-mono font-bold text-sm">#{String(current.id).padStart(5, "0")}</div>
                <div className="inline-block mt-2"><InvoiceStatusTag status={current.status} /></div>
              </div>
            </div>

            <div className="grid grid-cols-3 border border-[#2A2E33] my-5 font-data-mono" style={{ borderWidth: 3 }}>
              <div className="p-4 border-r-[3px] border-[#2A2E33]">
                <div className="text-[9px] tracking-widest text-[#8A8F95] mb-2">BILLED TO</div>
                <div className="font-black text-lg leading-tight" style={{ fontFamily: "Inter, sans-serif" }}>{user?.full_name ?? "—"}</div>
                <div className="text-[11px] text-[#8A8F95] mt-1">{user?.email}</div>
              </div>
              <div className="p-4 border-r-[3px] border-[#2A2E33]">
                <div className="text-[9px] tracking-widest text-[#8A8F95] mb-2">PROJECT</div>
                <div className="font-black text-lg leading-tight" style={{ fontFamily: "Inter, sans-serif" }}>{projectName(current.project_id)}</div>
              </div>
              <div className="p-4 flex flex-col gap-2">
                <div className="text-[9px] tracking-widest text-[#8A8F95]">DATES</div>
                <div>
                  <div className="text-[9px] text-[#8A8F95] mb-0.5">ISSUED</div>
                  <div className="font-black text-base" style={{ fontFamily: "Inter, sans-serif" }}>{formatDateMixedCase(current.finalized_at ?? current.created_at)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#8A8F95] mb-0.5">DUE</div>
                  <div className="font-black text-base" style={{ fontFamily: "Inter, sans-serif" }}>{formatDateMixedCase(addDays(current.finalized_at ?? current.created_at, 15))}</div>
                </div>
              </div>
            </div>

            {itemGroups.map((group) => (
              <div key={group.key}>
                <div className="bg-[#2A2E33] text-white px-3 py-2 flex items-center justify-between mt-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className={`font-data-mono font-bold text-[9px] tracking-widest px-[7px] py-[3px] ${group.tagClass}`}>{group.tag}</span>
                    <span className="font-black text-[13px] tracking-wide">{group.label}</span>
                  </div>
                  <span className="font-data-mono text-[10px]">
                    {group.items.length} {group.items.length === 1 ? "FEATURE" : "FEATURES"}
                  </span>
                </div>
                {group.items.map((li) => {
                  const fr = li.feature_request_id != null ? detail?.features.find((f) => f.id === li.feature_request_id) : undefined;
                  const externals = detail && li.feature_request_id != null
                    ? detail.infraCosts.filter((c) => c.feature_request_id === li.feature_request_id)
                    : [];
                  return (
                    <div key={li.id} className="border-2 border-t-0 border-[#2A2E33] p-3.5">
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <div className="font-extrabold text-[15px]">
                            {fr?.name ?? "Line Item"}
                            {fr?.feature_id && <span className="font-data-mono text-[10px] text-[#8A8F95] font-medium"> · {fr.feature_id}</span>}
                          </div>
                          <div className="font-data-mono text-[10px] text-[#8A8F95]">{li.description}</div>
                          <div className="font-data-mono text-[11px] mt-1.5">
                            Frontend {li.frontend_hours}h &nbsp;·&nbsp; Backend {li.backend_hours}h &nbsp;·&nbsp; Production {li.production_hours}h
                            {fr?.agreement_date && <span className="text-[#8A8F95]"> &nbsp;(Agreement {fr.agreement_date})</span>}
                          </div>
                        </div>
                        <div className="font-black text-lg whitespace-nowrap">{formatINR(li.amount)}</div>
                      </div>
                      {externals.length > 0 && (
                        <div className="mt-2.5 border-t border-dashed border-[#2A2E33] pt-2">
                          <div className="font-data-mono text-[9px] tracking-widest text-[#8A8F95] mb-1.5">
                            EXTERNAL SERVICES ({externals.length}) · RECURRING
                          </div>
                          {externals.map((ext) => (
                            <div key={ext.id} className="flex justify-between font-data-mono text-[11px] py-0.5">
                              <span>{ext.module}</span>
                              <span className="font-bold">{formatINR(ext.monthly_overhead_price)} /mo</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            <div className="grid grid-cols-2 gap-5 mt-4.5">
              <div>
                <div className="font-data-mono text-[9px] tracking-widest font-bold mb-1.5">MAINTENANCE PROFILE</div>
                {latestMaintenance ? (
                  <>
                    {[
                      { k: "CYCLE YEAR", v: String(latestMaintenance.cycle_year) },
                      { k: "STATUS", v: latestMaintenance.status.replace(/_/g, " ") },
                      { k: "DUE DATE", v: formatDateMixedCase(latestMaintenance.due_date) },
                      { k: "AMOUNT", v: formatINR(latestMaintenance.amount) },
                    ].map((row) => (
                      <div key={row.k} className="flex justify-between font-data-mono text-[11px] py-[3px] border-b border-[#2A2E33]/15">
                        <span className="text-[#8A8F95]">{row.k}</span>
                        <span className="font-bold uppercase">{row.v}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="font-data-mono text-[11px] text-[#8A8F95]">No maintenance cycle on file.</div>
                )}
                {detail?.discount && (
                  <div className="border-2 border-[#2A2E33] p-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-data-mono font-bold tracking-widest text-brand-green">{detail.discount.name}</span>
                      <span className="font-black text-lg text-brand-green">
                        {detail.discount.discount_type === "percentage" ? `-${detail.discount.value}%` : `-${formatINR(detail.discount.value)}`}
                      </span>
                    </div>
                    <div className="font-data-mono text-[9px] text-[#8A8F95] mt-1">Currently active for this project</div>
                  </div>
                )}
              </div>
              <div>
                {recurringTotal > 0 && (
                  <div className="font-data-mono text-[10px] text-[#8A8F95] mb-2">
                    + Recurring {formatINR(recurringTotal)}/mo billed separately
                  </div>
                )}
                {[
                  { k: "SUBTOTAL", v: formatINR(current.subtotal) },
                  { k: "DISCOUNT", v: `-${formatINR(current.discount_amount)}` },
                  { k: "TAXABLE VALUE", v: formatINR(taxableValue) },
                  { k: "GST", v: formatINR(current.tax_amount) },
                ].map((row) => (
                  <div key={row.k} className="flex justify-between font-data-mono text-[13px] py-[5px]">
                    <span className="text-[#8A8F95]">{row.k}</span>
                    <span className="font-bold">{row.v}</span>
                  </div>
                ))}
                <div className="bg-[#2A2E33] text-white border-2 border-[#2A2E33] px-4 py-3.5 mt-2.5 flex justify-between items-center">
                  <span className="font-data-mono text-[11px] tracking-widest font-bold">TOTAL DUE</span>
                  <span className="font-black text-2xl">{formatINR(current.total)}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t-2 border-[#2A2E33] font-data-mono text-[10px] text-[#8A8F95] leading-relaxed">
              {current.notes || "Thank you for your business. This is a computer-generated invoice."}
            </div>
          </div>
        </div>,
        document.body
        )}
      </div>
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
