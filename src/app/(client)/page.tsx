"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { Discount, Invoice, MaintenanceRecord } from "@/lib/types";
import { PageHeader } from "@/components/ui";

export default function ClientDashboardPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [discount, setDiscount] = useState<Discount | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [inv, disc, maint] = await Promise.all([
        apiRequest<Invoice[]>("/api/billing/invoices"),
        apiRequest<Discount | null>("/api/discounts/active"),
        apiRequest<MaintenanceRecord[]>("/api/maintenance/records"),
      ]);
      setInvoices(inv);
      setDiscount(disc);
      setMaintenance(maint);
      setLoading(false);
    }
    load();
  }, []);

  const rejectedMaintenance = maintenance.filter((m) => m.status === "rejected");

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="h-16 w-16 border-4 border-border-strong border-t-coral-red animate-spin rounded-full"></div>
          <p className="mt-6 font-data-mono text-data-mono font-black tracking-widest text-text-muted uppercase">Loading System</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden flex items-center justify-center opacity-10">
        <span className="font-bg-numeral text-[40vw] text-text-main select-none leading-none tracking-tighter">04</span>
      </div>

      <PageHeader title="COMMAND CENTER" />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 relative z-10">
        {/* Critical Alert Card */}
        {rejectedMaintenance.length > 0 && (
          <div className="md:col-span-8 bg-coral-red border-4 border-border-strong p-card-padding relative overflow-hidden shadow-[8px_8px_0px_0px_var(--border-strong)]">
            <div className="absolute -right-10 -bottom-20 opacity-20 pointer-events-none">
              <span className="font-bg-numeral text-bg-numeral text-white leading-none">!</span>
            </div>
            <div className="relative z-10">
              <div className="inline-block bg-bg-panel text-text-inverse font-label-caps text-label-caps tracking-[0.1em] px-2 py-1 mb-6 border-2 border-border-strong">ACTION_REQUIRED</div>
              <h3 className="font-display-xl text-display-xl text-white uppercase mb-4 max-w-xl">MAINTENANCE_REJECTED</h3>
              {rejectedMaintenance.map((m) => (
                <div key={m.id} className="font-data-mono text-data-mono text-white mb-8 max-w-lg bg-black/20 p-4 border-l-4 border-border-strong">
                  <span className="font-bold">CYCLE {m.cycle_year}:</span> {m.rejection_reason}.
                  <br />
                  REQUIRED BY: {m.penalty_deadline ? new Date(m.penalty_deadline).toLocaleString() : "DEADLINE"}
                </div>
              ))}
              <button className="bg-bg-panel text-text-inverse font-label-caps text-label-caps tracking-[0.1em] font-bold px-8 py-4 uppercase border-2 border-border-strong shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                REVIEW_TICKETS
              </button>
            </div>
          </div>
        )}

        {/* Spotlight/Discount Card */}
        <div className={`bg-bg-panel border-4 border-border-strong p-card-padding relative overflow-hidden flex flex-col justify-between shadow-[8px_8px_0px_0px_#ED4A3F] ${rejectedMaintenance.length > 0 ? "md:col-span-4" : "md:col-span-12"}`}>
          <div className="absolute -right-8 top-0 opacity-10 pointer-events-none">
            <span className="font-bg-numeral text-bg-numeral text-text-inverse leading-none">Q4</span>
          </div>
          <div className="relative z-10 text-text-inverse">
            {discount ? (
              <>
                <div className="flex justify-between items-start mb-8">
                  <span className="font-label-caps text-label-caps tracking-[0.1em] uppercase border border-text-inverse px-2 py-1">PROMO_CODE</span>
                  <span className="material-symbols-outlined text-coral-red" data-icon="sell">sell</span>
                </div>
                <h3 className="font-headline-lg text-headline-lg uppercase font-black leading-tight mb-2">
                  {discount.name.split(' ').map((word, i) => <span key={i}>{word}<br/></span>)}
                </h3>
                <p className="font-data-mono text-data-mono opacity-80 mb-6">Applied automatically to subtotals.</p>
                <div className="text-center bg-bg-base text-coral-red py-4 border-2 border-bg-base font-display-xl text-display-xl shadow-[4px_4px_0px_0px_#ED4A3F]">
                  {discount.discount_type === "percentage" ? `-${discount.value}%` : `-$${discount.value}`}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10">
                 <span className="material-symbols-outlined text-4xl text-text-inverse opacity-50 mb-4" data-icon="sell">sell</span>
                 <p className="font-data-mono text-data-mono uppercase tracking-widest opacity-70">No Active Discounts</p>
              </div>
            )}
          </div>
        </div>

        {/* Invoices Table */}
        <div className="md:col-span-12 bg-bg-panel-alt border-4 border-border-strong shadow-[8px_8px_0px_0px_var(--border-strong)]">
          <div className="bg-bg-panel border-b-4 border-border-strong p-4 flex justify-between items-center">
            <h3 className="font-label-caps text-label-caps tracking-[0.1em] uppercase font-bold text-text-inverse">RECENT_LEDGER_ENTRIES</h3>
            <button className="font-data-mono text-data-mono tracking-[0.1em] uppercase text-coral-red hover:underline decoration-2 underline-offset-4">VIEW_ALL_RECORDS</button>
          </div>
          <div className="p-card-padding overflow-x-auto">
            {invoices.length === 0 ? (
               <div className="py-10 text-center font-data-mono text-data-mono text-text-muted uppercase tracking-widest">No invoices found.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="font-data-mono text-data-mono text-text-muted uppercase border-b-2 border-border-strong">
                    <th className="pb-2 font-normal tracking-widest text-xs">ID</th>
                    <th className="pb-2 font-normal tracking-widest text-xs">DATE</th>
                    <th className="pb-2 font-normal tracking-widest text-xs">TOTAL</th>
                    <th className="pb-2 font-normal tracking-widest text-xs text-right">STATUS</th>
                    <th className="pb-2 font-normal tracking-widest text-xs text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="font-data-mono text-data-mono">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border-subtle hover:bg-border-subtle transition-colors group">
                      <td className="py-2 text-text-main">INV-{inv.id.toString().padStart(4, "0")}</td>
                      <td className="py-2 opacity-70 text-text-main">{inv.finalized_at ? new Date(inv.finalized_at).toLocaleDateString() : "-"}</td>
                      <td className="py-2 text-text-main">${inv.total.toFixed(2)}</td>
                      <td className="py-2 text-right">
                        <span className={`inline-block border px-2 py-1 text-[10px] uppercase tracking-wider transition-colors ${
                          inv.status === "paid"
                            ? "border-[#00FF00] text-[#00FF00] group-hover:bg-[#00FF00] group-hover:text-black"
                            : "border-coral-red text-coral-red group-hover:bg-coral-red group-hover:text-white"
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        {inv.status !== "draft" && <DownloadButton invoiceId={inv.id} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Asset Visualization */}
        <div className="md:col-span-6 bg-bg-panel border-4 border-border-strong p-card-padding relative overflow-hidden flex flex-col shadow-[8px_8px_0px_0px_var(--border-strong)] group transition-colors">
          <div className="absolute -left-10 -top-10 opacity-10 pointer-events-none transition-transform group-hover:scale-110 duration-500">
            <span className="font-bg-numeral text-bg-numeral text-text-inverse leading-none">A1</span>
          </div>
          <div className="relative z-10 flex-1 flex flex-col justify-between text-text-inverse">
            <div className="flex justify-between items-start mb-12">
              <h3 className="font-display-xl text-display-xl uppercase font-black leading-tight">ACTIVE<br/>NODES</h3>
              <span className="font-data-mono text-data-mono tracking-[0.1em] text-coral-red border-b-2 border-coral-red pb-1">LIVE_MAP</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-8">
              <div className="h-24 bg-bg-base relative flex items-end"><div className="w-full bg-coral-red h-[80%] transition-all group-hover:h-[90%]"></div></div>
              <div className="h-24 bg-bg-base relative flex items-end"><div className="w-full bg-coral-red h-[40%] transition-all group-hover:h-[60%]"></div></div>
              <div className="h-24 bg-bg-base relative flex items-end"><div className="w-full bg-coral-red h-[95%] transition-all group-hover:h-[85%]"></div></div>
            </div>
            <div className="flex justify-between items-end border-t-2 border-bg-base pt-4">
              <div className="font-data-mono text-data-mono tracking-[0.1em] uppercase">
                <p className="opacity-70">CAPACITY</p>
                <p className="font-bold text-lg tracking-normal">78.4%</p>
              </div>
              <span className="material-symbols-outlined text-4xl" data-icon="monitoring">monitoring</span>
            </div>
          </div>
        </div>

        {/* Document Quick Access */}
        <div className="md:col-span-6 bg-bg-base border-4 border-border-strong p-0 relative overflow-hidden flex flex-col shadow-[8px_8px_0px_0px_var(--border-strong)]">
          <div className="bg-coral-red border-b-4 border-border-strong p-4 flex justify-between items-center text-white">
            <h3 className="font-label-caps text-label-caps tracking-[0.1em] uppercase font-bold">LATEST_DOCS</h3>
            <span className="material-symbols-outlined" data-icon="file_copy">file_copy</span>
          </div>
          <div className="flex-1 p-card-padding flex flex-col gap-4">
            <a className="group border-2 border-border-strong p-4 flex justify-between items-center hover:border-coral-red hover:bg-bg-panel-alt transition-all hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#ED4A3F]" href="#">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-text-muted group-hover:text-coral-red" data-icon="description">description</span>
                <div>
                  <h4 className="font-body-md font-bold uppercase tracking-widest text-text-main">SLA_REVISION_V3.pdf</h4>
                  <p className="font-data-mono text-data-mono text-text-muted tracking-[0.1em] text-xs">SIZE: 2.4MB | UPDATED: TODAY</p>
                </div>
              </div>
              <span className="material-symbols-outlined opacity-0 group-hover:opacity-100 text-coral-red transition-opacity" data-icon="download">download</span>
            </a>
            <a className="group border-2 border-border-strong p-4 flex justify-between items-center hover:border-coral-red hover:bg-bg-panel-alt transition-all hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#ED4A3F]" href="#">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-text-muted group-hover:text-coral-red" data-icon="description">description</span>
                <div>
                  <h4 className="font-body-md font-bold uppercase tracking-widest text-text-main">ARCH_DIAGRAM_Q4.png</h4>
                  <p className="font-data-mono text-data-mono text-text-muted tracking-[0.1em] text-xs">SIZE: 8.1MB | UPDATED: 2 DAYS AGO</p>
                </div>
              </div>
              <span className="material-symbols-outlined opacity-0 group-hover:opacity-100 text-coral-red transition-opacity" data-icon="download">download</span>
            </a>
          </div>
        </div>

      </div>
    </>
  );
}

function DownloadButton({ invoiceId }: { invoiceId: number }) {
  async function download() {
    const token = localStorage.getItem("garia_access_token");
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/billing/invoices/${invoiceId}/download`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice_${invoiceId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button onClick={download} className="font-data-mono text-data-mono tracking-[0.1em] uppercase text-coral-red hover:underline decoration-2 underline-offset-4">
      EXPORT
    </button>
  );
}

