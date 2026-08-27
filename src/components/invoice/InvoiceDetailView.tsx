"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Invoice } from "@/lib/types";
import { Button } from "@/components/ui";
import { apiRequest, getAccessToken } from "@/lib/api";
import {
  formatDate,
  formatINR,
  groupLineItems,
  InvoicePrintDocument,
  InvoiceStatusTag,
  ProjectDetailData,
} from "@/components/invoice/InvoicePrintDocument";

export { formatDate, formatINR, InvoiceStatusTag } from "@/components/invoice/InvoicePrintDocument";
export type { ProjectDetailData } from "@/components/invoice/InvoicePrintDocument";

interface InvoiceDetailViewProps {
  invoice: Invoice;
  detail: ProjectDetailData | null;
  detailLoading: boolean;
  billedToName: string;
  billedToEmail: string;
  projectName: string;
  canExport: boolean;
  onBack: () => void;
  backLabel: string;
}

export function InvoiceDetailView({
  invoice: current,
  detail,
  detailLoading,
  billedToName,
  billedToEmail,
  projectName,
  canExport,
  onBack,
  backLabel,
}: InvoiceDetailViewProps) {
  const [downloading, setDownloading] = useState(false);

  const itemGroups = groupLineItems(current.line_items, detail?.features ?? []);
  const recurringTotal = current.line_items.reduce((sum, li) => {
    if (li.feature_request_id == null || !detail) return sum;
    return sum + detail.infraCosts.filter((c) => c.feature_request_id === li.feature_request_id).reduce((s, c) => s + c.monthly_overhead_price, 0);
  }, 0);
  const latestMaintenance = detail?.maintenance[0];
  const taxableValue = current.subtotal - current.discount_amount;

  // The PDF is rendered server-side by navigating a headless browser to /print/invoices/[id]
  // (which renders the same <InvoicePrintDocument> below) and calling page.pdf() on it — see
  // src/app/api/pdf/invoice/[id]/route.ts. That guarantees the download is pixel-identical to
  // what PRINT shows, instead of a hand-drawn jsPDF approximation that drifts out of sync.
  async function handleDownload() {
    setDownloading(true);
    try {
      // The headless page can't run the SPA's own refresh-on-401 dance (it only gets this one
      // access token, not the refresh token), so if the tab's been idle long enough for the
      // access token to expire, a stale token here would make the headless render silently hit
      // /login and time out. A cheap authenticated call first forces apiRequest's existing
      // refresh logic to run and refill localStorage with a live token before we read it.
      await apiRequest("/api/auth/me");
      const token = getAccessToken();
      const res = await fetch(`/api/pdf/invoice/${current.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`PDF render failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Garia_Invoice_${String(current.id).padStart(5, "0")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
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
          onClick={onBack}
          className="inline-flex items-center gap-2 font-data-mono text-xs font-bold tracking-widest text-text-main hover:text-brand-green transition-colors mb-6"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>{backLabel}
        </button>

        <div className="flex items-end justify-between gap-6 flex-wrap mb-8">
          <div>
            <p className="font-data-mono text-xs tracking-[0.2em] uppercase text-text-muted mb-2">
              {`Financial Records // ${projectName} // Project Invoices`}
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
              <div className="font-bold text-lg">{billedToName}</div>
              <div className="font-data-mono text-xs text-[#8A8F95] mt-1">{billedToEmail}</div>
            </div>
            <div className="p-6">
              <div className="font-data-mono text-[10px] tracking-widest text-[#8A8F95] uppercase mb-2">Project</div>
              <div className="font-bold text-lg">{projectName}</div>
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
                    {group.items.length} {group.items.length === 1 ? "ITEM" : "ITEMS"}
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
                          <div className="font-bold text-base">{fr?.name ?? (li.item_type === "maintenance" ? "Annual Maintenance" : "Line Item")}</div>
                          <div className="font-data-mono text-[11px] text-[#8A8F95] my-1">{li.description}</div>
                          {li.item_type === "maintenance" ? (
                            <span className="border-2 border-[#2A2E33] px-2 py-1 font-data-mono text-[10px] font-semibold whitespace-nowrap">Flat annual fee</span>
                          ) : (
                            <div className="flex gap-2 flex-wrap">
                              <span className="border-2 border-[#2A2E33] px-2 py-1 font-data-mono text-[10px] font-semibold whitespace-nowrap">Frontend {li.frontend_hours}h</span>
                              <span className="border-2 border-[#2A2E33] px-2 py-1 font-data-mono text-[10px] font-semibold whitespace-nowrap">Backend {li.backend_hours}h</span>
                              <span className="border-2 border-[#2A2E33] px-2 py-1 font-data-mono text-[10px] font-semibold whitespace-nowrap">Production {li.production_hours}h</span>
                            </div>
                          )}
                        </div>
                        <div className="p-3 border-r-2 border-[#2A2E33]/15 text-right">
                          <div className="font-data-mono font-bold text-sm whitespace-nowrap">{li.item_type === "maintenance" ? "—" : `${hours}h`}</div>
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
                    ].map((row) => (
                      <div key={row.k} className="flex justify-between items-center py-2 border-b-2 border-[#2A2E33]/15">
                        <div className="font-data-mono text-xs text-[#8A8F95]">{row.k}</div>
                        <div className="font-data-mono text-sm font-bold uppercase">{row.v}</div>
                      </div>
                    ))}
                    {(() => {
                      const annualInfraTotal = detail?.infraCosts ? detail.infraCosts.reduce((sum, c) => sum + c.monthly_overhead_price, 0) * 12 : 0;
                      const serverMaintenance = latestMaintenance.amount - annualInfraTotal;
                      
                      return (
                        <div className="pt-2">
                          <div className="flex justify-between items-center py-1">
                            <div className="font-data-mono text-[10px] text-[#8A8F95]">SERVER MAINTENANCE</div>
                            <div className="font-data-mono text-xs">{formatINR(serverMaintenance)}</div>
                          </div>
                          {annualInfraTotal > 0 && (
                            <div className="flex justify-between items-center py-1">
                              <div className="font-data-mono text-[10px] text-[#8A8F95]">EXTERNAL SERVICES (ANNUAL)</div>
                              <div className="font-data-mono text-xs">{formatINR(annualInfraTotal)}</div>
                            </div>
                          )}
                          <div className="flex justify-between items-center py-2 border-t-2 border-[#2A2E33] mt-2">
                            <div className="font-data-mono text-[11px] font-bold text-[#2A2E33]">TOTAL MAINTENANCE</div>
                            <div className="font-data-mono text-sm font-black">{formatINR(latestMaintenance.amount)}</div>
                          </div>
                        </div>
                      );
                    })()}
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
        Compact print document — this is what PRINT (window.print()) renders, and what the
        headless-Chromium PDF route renders too (same component, see /print/invoices/[id]).
        Kept off-screen (not display:none) during normal browsing so it stays laid out;
        @media print in globals.css repositions it on top for window.print().
        Portaled to document.body so it's a sibling of the whole app shell, not a descendant —
        otherwise the app shell's invisible-but-still-laid-out height (Sidebar/min-h-screen) pads
        the print output with a trailing blank page.
      */}
      {typeof document !== "undefined" && createPortal(
        <div id="invoice-print-root" className="fixed top-0 left-[-9999px]">
          <InvoicePrintDocument invoice={current} detail={detail} billedToName={billedToName} billedToEmail={billedToEmail} projectName={projectName} />
        </div>,
        document.body
      )}
    </div>
  );
}
