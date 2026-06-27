"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, apiRequest, ApiError, getAccessToken } from "@/lib/api";
import { FeatureRequest, InfrastructureCostEntry, MaintenanceRecord } from "@/lib/types";
import { Alert, StatusBadge, Button } from "@/components/ui";
import { useProject } from "@/lib/project-context";

type Tab = "costs" | "compliance";

export default function MaintenancePage() {
  const { currentProject } = useProject();
  const [tab, setTab] = useState<Tab>("costs");
  const [infraCosts, setInfraCosts] = useState<InfrastructureCostEntry[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [features, setFeatures] = useState<FeatureRequest[]>([]);
  const [loadedAt, setLoadedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  // Custom file selection state
  const [selectedFiles, setSelectedFiles] = useState<Record<number, File | null>>({});
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});

  async function load() {
    if (!currentProject) return;
    const [costs, recs, feats] = await Promise.all([
      apiRequest<InfrastructureCostEntry[]>(`/api/projects/${currentProject.id}/maintenance/infrastructure-costs`),
      apiRequest<MaintenanceRecord[]>(`/api/projects/${currentProject.id}/maintenance/records`),
      apiRequest<FeatureRequest[]>(`/api/projects/${currentProject.id}/feature-requests`),
    ]);
    setInfraCosts(costs);
    setRecords(recs);
    setFeatures(feats);
    setLoadedAt(Date.now());
  }

  useEffect(() => {
    load();
  }, [currentProject?.id]);

  const handleFileChange = (recordId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFiles(prev => ({ ...prev, [recordId]: file }));
  };

  async function submitProof(recordId: number) {
    if (!currentProject) return;
    const file = selectedFiles[recordId];
    if (!file) {
      setError("NO_FILE_DETECTED: Select a transaction voucher file before transmitting.");
      return;
    }
    setSubmittingId(recordId);
    setError(null);
    const form = new FormData();
    form.append("voucher", file);
    try {
      const res = await fetch(`${API_BASE_URL}/api/projects/${currentProject.id}/maintenance/records/${recordId}/submit-proof`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        body: form,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new ApiError(res.status, data.detail);
      }
      setSelectedFiles(prev => ({ ...prev, [recordId]: null }));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not submit proof");
    } finally {
      setSubmittingId(null);
    }
  }

  function daysRemaining(deadline: string | null): number | null {
    if (!deadline || !loadedAt) return null;
    const ms = new Date(deadline).getTime() - loadedAt;
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  return (
    <div className="space-y-12 pb-24">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 mb-8 border-b-4 border-border-strong pb-8">
        <div>
          <h1 className="font-display-xl text-5xl md:text-6xl font-black uppercase text-text-main leading-none tracking-tight">
            Deployment Infrastructure <br/>&<br/> Maintenance Ledger
          </h1>
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
          Infrastructure Cost Registry
        </button>
        <button
          onClick={() => setTab("compliance")}
          className={`border-4 border-border-strong px-8 py-4 font-bold uppercase transition-all flex-1 md:flex-none text-center
            ${tab === "compliance" 
              ? "bg-text-main text-white shadow-[6px_6px_0px_0px_var(--border-strong)] translate-x-[-2px] translate-y-[-2px]" 
              : "bg-bg-panel-alt text-text-main hover:bg-border-strong/10"
            }`}
        >
          Annual Maintenance Compliance
        </button>
      </div>

      {error && (
        <div className="border-4 border-coral-red bg-coral-red/10 p-6 flex items-start gap-4">
          <span className="material-symbols-outlined text-coral-red text-3xl">warning</span>
          <div>
            <h4 className="font-data-mono font-bold text-coral-red uppercase tracking-widest text-sm mb-1">SYSTEM EXCEPTION</h4>
            <p className="font-mono text-coral-red">{error}</p>
          </div>
        </div>
      )}

      {tab === "costs" && (
        <div className="space-y-6">
          <div className="bg-bg-base border-4 border-border-strong shadow-[8px_8px_0px_0px_var(--border-strong)] p-1">
            <div className="bg-text-main p-4 flex justify-between items-center">
              <h3 className="font-data-mono text-white text-xs font-black uppercase tracking-widest">
                INFRASTRUCTURE COST REGISTRY
              </h3>
            </div>
            
            {infraCosts.length === 0 ? (
              <div className="p-12 text-center border-4 border-dashed border-border-strong/30 m-4">
                <span className="material-symbols-outlined text-text-muted/30 text-5xl mb-4">warning</span>
                <p className="font-data-mono uppercase tracking-widest font-bold text-text-muted">No infrastructure costs registered.</p>
              </div>
            ) : (
              <div className="overflow-x-auto p-4">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-4 border-border-strong">
                      <th className="font-label-caps p-4 text-text-muted">Module</th>
                      <th className="font-label-caps p-4 text-text-muted">Linked Feature</th>
                      <th className="font-label-caps p-4 text-text-muted">Billing Type</th>
                      <th className="font-label-caps p-4 text-text-muted text-right">Evaluated Monthly Overhead Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {infraCosts.map((c) => (
                      <tr key={c.id} className="border-b-2 border-border-strong/30 hover:bg-bg-panel-alt transition-colors group">
                        <td className="p-4 font-bold text-lg">{c.module}</td>
                        <td className="p-4">
                          <span className="inline-block border-2 border-border-strong/50 px-3 py-1 font-data-mono text-xs uppercase font-bold text-text-muted">
                            {features.find((f) => f.id === c.feature_request_id)?.name ?? "N/A (CORE INFRA)"}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-bold text-text-muted">{c.billing_type}</td>
                        <td className="p-4 font-mono font-black text-xl text-right text-text-main group-hover:text-coral-red transition-colors">
                          ₹{c.monthly_overhead_price.toFixed(2)}<span className="text-sm text-text-muted ml-1">/mo</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "compliance" && (
        <div className="space-y-6">
          <div className="bg-bg-base border-4 border-border-strong shadow-[8px_8px_0px_0px_var(--border-strong)] p-1">
            <div className="bg-text-main p-4 flex justify-between items-center">
              <h3 className="font-data-mono text-white text-xs font-black uppercase tracking-widest">
                ANNUAL MAINTENANCE COMPLIANCE
              </h3>
            </div>

            <div className="p-4 space-y-8">
              {records.length === 0 ? (
                <div className="p-12 text-center border-4 border-dashed border-border-strong/30">
                  <span className="material-symbols-outlined text-text-muted/30 text-5xl mb-4">task</span>
                  <p className="font-data-mono uppercase tracking-widest font-bold text-text-muted">No maintenance cycles documented.</p>
                </div>
              ) : (
                records.map((r) => {
                  const remaining = daysRemaining(r.penalty_deadline);
                  const isRejected = r.status === "rejected";
                  const isPending = r.status === "pending";
                  const file = selectedFiles[r.id];

                  return (
                    <div key={r.id} className={`border-4 ${isRejected ? 'border-coral-red shadow-[8px_8px_0px_0px_var(--coral-red)]' : 'border-border-strong shadow-[8px_8px_0px_0px_var(--border-strong)]'} relative overflow-hidden transition-all`}>
                      
                      {/* Rejected Warning Banner */}
                      {isRejected && (
                        <div className="bg-coral-red text-white p-4 flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-3xl">error</span>
                            <div>
                              <div className="font-data-mono text-xs font-black uppercase tracking-widest opacity-80">ACTION REQUIRED: PROOF REJECTED</div>
                              <div className="font-bold text-lg mt-1">{r.rejection_reason}</div>
                            </div>
                          </div>
                          
                          {/* Structural Clock Component */}
                          {remaining !== null && (
                            <div className="bg-white/10 border-2 border-white p-3 text-center min-w-[120px]">
                              <div className="font-data-mono text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">PENALTY WINDOW</div>
                              <div className="font-mono font-black text-3xl tabular-nums tracking-tighter">
                                {remaining}<span className="text-base opacity-70 ml-1">T-d</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="p-6 bg-bg-base">
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <h4 className="font-headline-lg font-black text-3xl uppercase">
                              CYCLE {r.cycle_year}
                            </h4>
                            <div className="font-data-mono text-sm text-text-muted mt-2 uppercase font-bold flex items-center gap-2">
                              <span className="material-symbols-outlined text-sm">calendar_today</span> 
                              DUE: {new Date(r.due_date).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-3">
                            <StatusBadge status={r.status} />
                            <span className="font-black text-4xl">₹{r.amount.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* File Upload Override Terminal */}
                        {(isPending || isRejected) && (
                          <div className={`mt-8 p-6 border-4 ${isRejected ? 'border-coral-red/30 bg-coral-red/5' : 'border-border-strong bg-bg-panel-alt'}`}>
                            <div className="flex flex-col md:flex-row gap-6 items-center">
                              
                              <div className="flex-1 w-full">
                                <label className={`font-data-mono text-xs font-black uppercase tracking-widest block mb-3 ${isRejected ? 'text-coral-red' : 'text-text-muted'}`}>
                                  {isRejected ? ">> OVERRIDE MULTIPART FILE SELECTION (RESUBMIT)" : ">> MULTIPART FILE SELECTION (VOUCHER)"}
                                </label>
                                
                                <div className="relative">
                                  <input
                                    type="file"
                                    id={`file-${r.id}`}
                                    className="hidden"
                                    onChange={(e) => handleFileChange(r.id, e)}
                                    ref={(el) => { fileInputs.current[r.id] = el; }}
                                  />
                                  <label 
                                    htmlFor={`file-${r.id}`}
                                    className={`w-full flex items-center justify-between p-4 border-4 cursor-pointer transition-colors ${
                                      file 
                                        ? 'border-forest-green bg-forest-green/10' 
                                        : 'border-border-strong bg-white hover:border-text-main'
                                    }`}
                                  >
                                    <span className={`font-mono font-bold truncate pr-4 ${file ? 'text-forest-green' : 'text-text-muted'}`}>
                                      {file ? file.name : "SELECT VOUCHER DOCUMENT..."}
                                    </span>
                                    <span className="material-symbols-outlined font-black">
                                      {file ? 'check_circle' : 'upload_file'}
                                    </span>
                                  </label>
                                </div>
                              </div>

                              <div className="md:mt-7 w-full md:w-auto">
                                <button 
                                  onClick={() => submitProof(r.id)}
                                  disabled={submittingId === r.id || !file}
                                  className={`w-full font-black text-sm uppercase px-8 py-4 border-4 transition-all flex items-center justify-center gap-2
                                    ${file 
                                      ? "bg-text-main text-white border-text-main shadow-[6px_6px_0px_0px_var(--forest-green)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none cursor-pointer" 
                                      : "bg-bg-panel-alt text-text-muted border-border-strong cursor-not-allowed opacity-50"
                                    }
                                  `}
                                >
                                  {submittingId === r.id ? (
                                    <>UPLOADING...</>
                                  ) : (
                                    <>
                                      <span className="material-symbols-outlined text-sm">send</span>
                                      {isRejected ? "[ TRANSMIT OVERRIDE ]" : "[ TRANSMIT PROOF ]"}
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {r.status === "proof_submitted" && (
                          <div className="mt-8 p-6 border-4 border-border-strong border-dashed bg-bg-panel-alt flex items-center gap-4 justify-center">
                            <div className="w-6 h-6 border-4 border-t-text-main border-border-strong rounded-full animate-spin"></div>
                            <span className="font-data-mono font-bold uppercase tracking-widest text-sm">VOUCHER TRANSMITTED. AWAITING ADMINISTRATOR VERIFICATION.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
