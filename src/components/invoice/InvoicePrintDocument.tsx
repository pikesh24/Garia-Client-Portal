import {
  Discount,
  FeatureRequest,
  InfrastructureCostEntry,
  Invoice,
  InvoiceLineItem,
  MaintenanceRecord,
} from "@/lib/types";

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso)
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
}

// The print document mirrors the source design, which renders dates in mixed case (not caps).
export function formatDateMixedCase(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const statusStyle: Record<string, string> = {
  paid: "bg-brand-green text-on-brand-green",
  finalized: "bg-brand-green text-on-brand-green",
  draft: "bg-[#8A8F95] text-[#E8E2D6]",
};

export function InvoiceStatusTag({ status }: { status: string }) {
  return (
    <span
      className={`font-data-mono text-[10px] font-bold tracking-widest uppercase px-2 py-1 whitespace-nowrap ${statusStyle[status] ?? "bg-[#8A8F95] text-[#E8E2D6]"}`}
    >
      {status}
    </span>
  );
}

export interface ProjectDetailData {
  features: FeatureRequest[];
  infraCosts: InfrastructureCostEntry[];
  maintenance: MaintenanceRecord[];
  discount: Discount | null;
}

export type ItemGroup = { key: string; tag: string; tagClass: string; label: string; items: InvoiceLineItem[] };

export function groupLineItems(items: InvoiceLineItem[], features: FeatureRequest[]): ItemGroup[] {
  const base: InvoiceLineItem[] = [];
  const extra: InvoiceLineItem[] = [];
  const maintenance: InvoiceLineItem[] = [];
  const other: InvoiceLineItem[] = [];
  for (const li of items) {
    if (li.item_type === "maintenance") {
      maintenance.push(li);
      continue;
    }
    const fr = li.feature_request_id != null ? features.find((f) => f.id === li.feature_request_id) : undefined;
    if (fr?.is_base_feature) base.push(li);
    else if (fr) extra.push(li);
    else other.push(li);
  }
  const groups: ItemGroup[] = [];
  if (base.length) groups.push({ key: "base", tag: "BASE", label: "CORE BASE FEATURES", tagClass: "bg-brand-green text-on-brand-green", items: base });
  if (extra.length) groups.push({ key: "extra", tag: "CLIENT REQUESTED", label: "EXTRA FEATURES · CLIENT REQUESTED", tagClass: "bg-warning text-text-inverse", items: extra });
  if (maintenance.length) groups.push({ key: "maintenance", tag: "MAINTENANCE", label: "ANNUAL MAINTENANCE", tagClass: "bg-coral-red text-white", items: maintenance });
  if (other.length) groups.push({ key: "other", tag: "OTHER", label: "OTHER CHARGES", tagClass: "bg-text-muted text-text-inverse", items: other });
  return groups;
}

export interface InvoicePrintDocumentProps {
  invoice: Invoice;
  detail: ProjectDetailData | null;
  billedToName: string;
  billedToEmail: string;
  projectName: string;
}

// The exact document rendered for both PRINT (window.print()) and DOWNLOAD PDF (headless
// Chromium navigates to /print/invoices/[id], which renders this same component, and prints
// it to PDF via page.pdf() -- see src/app/api/pdf/invoice/[id]/route.ts). Keeping one component
// for both guarantees the PDF is pixel-identical to what PRINT shows, instead of a hand-drawn
// approximation that has to be manually kept in sync.
export function InvoicePrintDocument({ invoice: current, detail, billedToName, billedToEmail, projectName }: InvoicePrintDocumentProps) {
  const itemGroups = groupLineItems(current.line_items, detail?.features ?? []);
  const recurringTotal = current.line_items.reduce((sum, li) => {
    if (li.feature_request_id == null || !detail) return sum;
    return sum + detail.infraCosts.filter((c) => c.feature_request_id === li.feature_request_id).reduce((s, c) => s + c.monthly_overhead_price, 0);
  }, 0);
  const latestMaintenance = detail?.maintenance[0];
  const taxableValue = current.subtotal - current.discount_amount;

  return (
    <div className="w-[794px] bg-white text-[#2A2E33]" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="px-8 py-6">
        <div className="flex justify-between items-start border-b-4 border-[#2A2E33] pb-3">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <img src="/brand/garia-logo.png" alt="Garia Solutions" className="w-11 h-11 object-contain" />
              <div className="font-black text-2xl leading-none tracking-tighter uppercase">GARIA<br />SOLUTIONS</div>
            </div>
            <div className="font-sans text-[10px] leading-relaxed text-[#8A8F95]">
              GARIA SOFTWARE PVT. LTD.<br />billing@garia.solutions
            </div>
          </div>
          <div className="text-right">
            <div className="font-black text-3xl tracking-tight">INVOICE</div>
            <div className="font-sans font-bold text-sm">#{String(current.id).padStart(5, "0")}</div>
            <div className="inline-block mt-2"><InvoiceStatusTag status={current.status} /></div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 my-3 font-sans">
          <div className="p-5 rounded-2xl border-2 border-[#2A2E33] bg-[#F9F9FB] shadow-[4px_4px_0_0_#2A2E33]">
            <div className="text-[10px] font-bold tracking-widest text-[#8A8F95] mb-2 uppercase">Billed To</div>
            <div className="font-black text-xl leading-tight text-[#2A2E33]" style={{ fontFamily: "Inter, sans-serif" }}>{billedToName}</div>
            <div className="text-[11px] text-[#8A8F95] mt-1.5 truncate">{billedToEmail}</div>
          </div>
          
          <div className="p-5 rounded-2xl border-2 border-[#2A2E33] bg-[#F9F9FB] shadow-[4px_4px_0_0_#2A2E33]">
            <div className="text-[10px] font-bold tracking-widest text-[#8A8F95] mb-2 uppercase">Project</div>
            <div className="font-black text-xl leading-tight text-[#2A2E33]" style={{ fontFamily: "Inter, sans-serif" }}>{projectName}</div>
          </div>

          <div className="p-5 rounded-2xl border-2 border-[#2A2E33] bg-[#2A2E33] text-white shadow-[4px_4px_0_0_#15BB00] flex flex-col justify-center relative overflow-hidden">
            {/* Subtle background accent */}
            <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-[#15BB00]/10" />
            <div className="flex justify-between items-center relative z-10">
              <div>
                <div className="text-[9px] font-bold tracking-widest text-[#8A8F95] mb-1.5 uppercase">Issued</div>
                <div className="font-bold text-[13px]" style={{ fontFamily: "Inter, sans-serif" }}>{formatDateMixedCase(current.finalized_at ?? current.created_at)}</div>
              </div>
              <div className="w-[2px] h-10 bg-white/10"></div>
              <div>
                <div className="text-[9px] font-bold tracking-widest text-[#8A8F95] mb-1.5 uppercase">Due</div>
                <div className="font-bold text-[13px] text-white" style={{ fontFamily: "Inter, sans-serif" }}>{formatDateMixedCase(addDays(current.finalized_at ?? current.created_at, 15))}</div>
              </div>
            </div>
          </div>
        </div>

        {itemGroups.map((group) => (
          <div key={group.key}>
            <div className="bg-[#2A2E33] text-white px-3 py-2 flex items-center justify-between mt-2.5">
              <div className="flex items-center gap-2.5">
                <span className={`font-sans font-bold text-[9px] tracking-widest px-[7px] py-[3px] ${group.tagClass}`}>{group.tag}</span>
                <span className="font-black text-[13px] tracking-wide">{group.label}</span>
              </div>
              <span className="font-sans text-[10px]">
                {group.items.length} {group.items.length === 1 ? "ITEM" : "ITEMS"}
              </span>
            </div>
            {group.items.map((li) => {
              const fr = li.feature_request_id != null ? detail?.features.find((f) => f.id === li.feature_request_id) : undefined;
              const externals = detail && li.feature_request_id != null
                ? detail.infraCosts.filter((c) => c.feature_request_id === li.feature_request_id)
                : [];
              return (
                <div key={li.id} className="border-2 border-t-0 border-[#2A2E33] p-2.5">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <div className="font-extrabold text-[15px]">
                        {fr?.name ?? (li.item_type === "maintenance" ? "Annual Maintenance" : "Line Item")}
                        {fr?.feature_id && <span className="font-sans text-[10px] text-[#8A8F95] font-medium"> · {fr.feature_id}</span>}
                      </div>
                      <div className="font-sans text-[10px] text-[#8A8F95]">{li.description}</div>
                      <div className="font-sans text-[11px] mt-1.5">
                        {li.item_type === "maintenance" ? (
                          "Flat annual fee"
                        ) : (
                          <>
                            Frontend {li.frontend_hours}h &nbsp;·&nbsp; Backend {li.backend_hours}h &nbsp;·&nbsp; Production {li.production_hours}h
                            {fr?.agreement_date && <span className="text-[#8A8F95]"> &nbsp;(Agreement {fr.agreement_date})</span>}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="font-black text-lg whitespace-nowrap">{formatINR(li.amount)}</div>
                  </div>
                  {externals.length > 0 && (
                    <div className="mt-2.5 border-t-[3px] border-dashed border-[#2A2E33] pt-2.5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="font-sans text-[9px] font-bold tracking-widest bg-[#2A2E33] text-white px-2 py-1">
                          EXTERNAL SERVICES ({externals.length})
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {externals.map((ext) => (
                          <div key={ext.id} className="border-2 border-[#2A2E33] px-2 py-1.5 flex justify-between items-center">
                            <span className="font-sans font-bold text-[#2A2E33] text-[11px]">{ext.module}</span>
                            <span className="font-sans font-black text-[#2A2E33] text-[11px]">{formatINR(ext.monthly_overhead_price)}<span className="font-normal text-[9px] text-[#8A8F95]"> /mo</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <div className="grid grid-cols-2 gap-4 mt-3 break-inside-avoid">
          <div>
            <div className="font-sans text-[9px] tracking-widest font-bold mb-1.5">MAINTENANCE PROFILE</div>
            {latestMaintenance ? (
              <>
                {[
                  { k: "CYCLE YEAR", v: String(latestMaintenance.cycle_year) },
                  { k: "STATUS", v: latestMaintenance.status.replace(/_/g, " ") },
                  { k: "DUE DATE", v: formatDateMixedCase(latestMaintenance.due_date) },
                ].map((row) => (
                  <div key={row.k} className="flex justify-between font-sans text-[11px] py-[3px] border-b border-[#2A2E33]/15">
                    <span className="text-[#8A8F95]">{row.k}</span>
                    <span className="font-bold uppercase">{row.v}</span>
                  </div>
                ))}
                {(() => {
                  const annualInfraTotal = detail?.infraCosts ? detail.infraCosts.reduce((sum, c) => sum + c.monthly_overhead_price, 0) * 12 : 0;
                  const serverMaintenance = latestMaintenance.amount - annualInfraTotal;
                  return (
                    <div className="mt-2">
                      <div className="flex justify-between font-sans text-[10px] py-[2px]">
                        <span className="text-[#8A8F95]">SERVER MAINTENANCE</span>
                        <span className="font-bold">{formatINR(serverMaintenance)}</span>
                      </div>
                      {annualInfraTotal > 0 && (
                        <div className="flex justify-between font-sans text-[10px] py-[2px]">
                          <span className="text-[#8A8F95]">EXTERNAL SERVICES (ANNUAL)</span>
                          <span className="font-bold">{formatINR(annualInfraTotal)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-sans text-[11px] py-[4px] border-t border-[#2A2E33] mt-1.5">
                        <span className="font-bold">TOTAL MAINTENANCE</span>
                        <span className="font-black">{formatINR(latestMaintenance.amount)}</span>
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="font-sans text-[11px] text-[#8A8F95]">No maintenance cycle on file.</div>
            )}
            {detail?.discount && (
              <div className="border-2 border-[#2A2E33] p-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="font-sans font-bold tracking-widest text-brand-green">{detail.discount.name}</span>
                  <span className="font-black text-lg text-brand-green">
                    {detail.discount.discount_type === "percentage" ? `-${detail.discount.value}%` : `-${formatINR(detail.discount.value)}`}
                  </span>
                </div>
                <div className="font-sans text-[9px] text-[#8A8F95] mt-1">Currently active for this project</div>
              </div>
            )}
          </div>
          <div>
            {[
              { k: "SUBTOTAL", v: formatINR(current.subtotal) },
              { k: "DISCOUNT", v: `-${formatINR(current.discount_amount)}` },
              { k: "TAXABLE VALUE", v: formatINR(taxableValue) },
              { k: "GST", v: formatINR(current.tax_amount) },
            ].map((row) => (
              <div key={row.k} className="flex justify-between font-sans text-[13px] py-[3px]">
                <span className="text-[#8A8F95]">{row.k}</span>
                <span className="font-bold">{row.v}</span>
              </div>
            ))}
            <div className="bg-[#2A2E33] text-white border-2 border-[#2A2E33] px-3 py-2.5 mt-1.5 flex justify-between items-center">
              <span className="font-sans text-[11px] tracking-widest font-bold">TOTAL DUE</span>
              <span className="font-black text-2xl">{formatINR(current.total)}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t-2 border-[#2A2E33] font-sans text-[10px] text-[#8A8F95] leading-relaxed">
          {current.notes || "Thank you for your business. This is a computer-generated invoice."}
        </div>
      </div>
    </div>
  );
}
