"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, apiRequest, ApiError, fileUrl, getAccessToken } from "@/lib/api";
import { Ticket, TicketStatus } from "@/lib/types";
import { Alert, Button, EmptyState, Field, Label, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { AdminProjectFilter, useAdminProjectFilter } from "@/components/AdminProjectFilter";

function priorityBadgeColor(priority: string) {
  switch (priority) {
    case "critical": return "bg-coral-red text-white";
    case "high": return "bg-amber text-black";
    case "low": return "bg-text-muted text-white";
    default: return "bg-bg-panel-alt border-border-strong text-text-main border";
  }
}

export default function AdminTicketsPage() {
  const [filter, setFilter] = useAdminProjectFilter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);

  const [resolutionText, setResolutionText] = useState("");
  const [hasFile, setHasFile] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const proofInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const endpoint = filter.projectId
      ? `/api/admin/projects/${filter.projectId}/tickets`
      : "/api/admin/tickets";
    const data = await apiRequest<Ticket[]>(endpoint);
    setTickets(data);
    setSelected((prev) => (prev ? data.find((t) => t.id === prev.id) ?? null : null));
  }

  useEffect(() => {
    load();
    setSelected(null);
  }, [filter.projectId]);

  async function updatePriority(priority: string) {
    if (!selected) return;
    setError(null);
    const form = new FormData();
    form.append("priority", priority);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/tickets/${selected.id}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        body: form,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new ApiError(res.status, data.detail);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not update priority");
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (proofInputRef.current) {
        proofInputRef.current.files = e.dataTransfer.files;
        setHasFile(true);
        setFileName(e.dataTransfer.files[0].name);
      }
    }
  };

  async function processTicket(status: TicketStatus) {
    if (!selected) return;
    if (status === "out_of_scope" && !resolutionText.trim()) {
      setError("You must provide a description when declining a ticket (Out of Scope)");
      return;
    }
    setError(null);
    const form = new FormData();
    form.append("status", status);
    form.append("resolution_text", resolutionText);
    const proofFile = proofInputRef.current?.files?.[0];
    if (proofFile) form.append("proof_attachments", proofFile);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/tickets/${selected.id}/process`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        body: form,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new ApiError(res.status, data.detail);
      }
      setResolutionText("");
      if (proofInputRef.current) proofInputRef.current.value = "";
      setHasFile(false);
      setFileName(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not process ticket");
    }
  }

  async function eraseTicket() {
    if (!selected) return;
    if (!confirm("Permanently erase this ticket's full history? This cannot be undone.")) return;
    await apiRequest(`/api/admin/tickets/${selected.id}`, { method: "DELETE" });
    setSelected(null);
    await load();
  }

  return (
    <div className="space-y-12">
      <PageHeader title="Support Ticket Operations" />

      <AdminProjectFilter value={filter} onChange={setFilter} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Ticket Directory */}
        <div className="lg:col-span-4 space-y-4">
          <h3 className="font-display-xl text-3xl font-black uppercase text-text-main mb-6 border-b-4 border-border-strong pb-4">
            Ticket Queue
          </h3>
          {tickets.length === 0 ? (
            <EmptyState>No tickets in queue.</EmptyState>
          ) : (
            tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className={`block w-full border-4 p-5 text-left transition-all ${
                  selected?.id === t.id 
                    ? "border-text-main bg-text-main text-white shadow-[4px_4px_0px_0px_var(--border-strong)]" 
                    : "border-border-strong bg-bg-base hover:border-text-main"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-data-mono text-xs font-black tracking-widest">#{t.id} (Client {t.client_id})</span>
                  <StatusBadge status={t.status} />
                </div>
                <h4 className={`font-bold mb-3 truncate ${selected?.id === t.id ? "text-white" : "text-text-main"}`}>
                  {t.name}
                </h4>
                <div className="flex items-center gap-3">
                  <span className={`font-data-mono text-[10px] uppercase tracking-widest px-2 py-0.5 ${selected?.id === t.id ? "bg-white/20 border-white/50 border" : priorityBadgeColor(t.priority)}`}>
                    {t.priority}
                  </span>
                  <span className={`text-xs ${selected?.id === t.id ? "text-white/70" : "text-text-muted"}`}>
                    {new Date(t.created_at).toLocaleString()}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Ticket Processor */}
        <div className="lg:col-span-8">
          <h3 className="font-display-xl text-3xl font-black uppercase text-text-main mb-6 border-b-4 border-border-strong pb-4">
            Ticket Analysis & Operations
          </h3>
          
          {!selected ? (
            <div className="border-4 border-border-strong border-dashed p-12 text-center text-text-muted h-full flex items-center justify-center">
              <p className="font-data-mono uppercase tracking-widest">Select a ticket to begin processing</p>
            </div>
          ) : (
            <div className="space-y-6">
              {error && <Alert>{error}</Alert>}
              
              <div className="border-4 border-border-strong bg-bg-base p-6 md:p-8 shadow-[8px_8px_0px_0px_var(--border-strong)] relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6 border-b-2 border-border-strong pb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-data-mono text-xs font-black tracking-widest text-text-muted">
                        INCIDENT #{selected.id}
                      </span>
                      <StatusBadge status={selected.status} />
                      <Select 
                        value={selected.priority} 
                        onChange={(e) => updatePriority(e.target.value)}
                        className={`font-data-mono text-[10px] uppercase tracking-widest ${priorityBadgeColor(selected.priority)}`}
                      >
                        <option value="low">Low Priority</option>
                        <option value="medium">Medium Priority</option>
                        <option value="high">High Priority</option>
                        <option value="critical">Critical Priority</option>
                      </Select>
                    </div>
                    <h2 className="font-headline-lg text-3xl font-black uppercase text-text-main leading-tight mb-4">
                      {selected.name}
                    </h2>
                    <p className="text-text-main whitespace-pre-wrap leading-relaxed">{selected.description}</p>
                  </div>
                </div>

                <div className="mb-8">
                  {selected.attachments.filter(a => !a.is_proof).map((a) => (
                    <div key={a.id} className="mt-3">
                      <p className="font-data-mono text-[10px] text-text-muted uppercase mb-2">Initial Upload Media</p>
                      <a href={fileUrl(a.file_path)} target="_blank" rel="noreferrer" className="block cursor-zoom-in">
                        <img src={fileUrl(a.file_path)} alt="Initial Media" className="border-2 border-border-strong w-full max-h-64 object-cover object-top hover:opacity-90 transition-opacity" />
                      </a>
                    </div>
                  ))}
                </div>
                
                {selected.status === 'open' || selected.status === 'in_progress' ? (
                  <div className="bg-bg-panel-alt border-2 border-border-strong p-6 mt-8 relative">
                    <div className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2">
                      <span className="bg-text-main text-white font-data-mono text-[10px] font-black uppercase tracking-widest px-3 py-1 shadow-[2px_2px_0px_0px_var(--border-strong)] border-2 border-border-strong">
                        ADMIN ACTION
                      </span>
                    </div>
                    <h4 className="font-label-caps text-xs text-text-muted font-black uppercase tracking-widest mb-4">
                      Process Ticket Decision
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <Field>
                        <Label>Reply / Decline Description (Required for decline)</Label>
                        <Textarea value={resolutionText} onChange={(e) => setResolutionText(e.target.value)} rows={7} placeholder="Explain the resolution or why it is out of scope..." />
                      </Field>
                      
                      <Field>
                        <Label>Reply Media / Proof Image</Label>
                        <div
                          className={`relative flex flex-col items-center justify-center border-2 border-dashed p-6 text-center transition-colors h-full min-h-[150px] ${
                            dragActive ? "border-coral-red bg-coral-red/5" : "border-border-strong bg-bg-base hover:border-text-main"
                          }`}
                          onDragEnter={handleDrag}
                          onDragLeave={handleDrag}
                          onDragOver={handleDrag}
                          onDrop={handleDrop}
                        >
                          <span className={`material-symbols-outlined text-4xl mb-2 ${dragActive ? "text-coral-red" : "text-text-muted"}`} data-icon="upload_file">
                            upload_file
                          </span>
                          <p className="font-data-mono text-text-main mb-1 font-bold text-sm">
                            {fileName ? <span className="text-coral-red uppercase">{fileName}</span> : "DRAG & DROP IMAGE HERE"}
                          </p>
                          <p className="font-data-mono text-[10px] text-text-muted uppercase tracking-widest mb-4">
                            OR CLICK TO BROWSE
                          </p>
                          <input
                            ref={proofInputRef}
                            type="file"
                            accept="image/*"
                            className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) {
                                setHasFile(true);
                                setFileName(files[0].name);
                              } else {
                                setHasFile(false);
                                setFileName(null);
                              }
                            }}
                          />
                        </div>
                      </Field>
                    </div>
                    <div className="flex gap-4">
                      <Button onClick={() => processTicket("resolved")} className="bg-forest-green text-white hover:bg-forest-green/80">
                        Approve (Resolve Issue)
                      </Button>
                      <Button onClick={() => processTicket("out_of_scope")} variant="danger">
                        Decline (Out of Scope)
                      </Button>
                    </div>
                  </div>
                ) : (
                   <div className="mt-8 border-t-2 border-border-strong pt-6">
                      <h4 className="font-label-caps text-xs text-text-muted font-black uppercase tracking-widest mb-4">
                        Resolution Provided
                      </h4>
                      <div className={`p-4 border-2 border-border-strong ${selected.status === 'out_of_scope' ? 'bg-coral-red/10 border-coral-red' : 'bg-forest-green/10 border-forest-green'}`}>
                          {selected.status === 'out_of_scope' && <span className="font-black text-coral-red block mb-1 uppercase tracking-widest text-[10px]">Decline Reason</span>}
                          {selected.status === 'resolved' && <span className="font-black text-forest-green block mb-1 uppercase tracking-widest text-[10px]">Resolution</span>}
                          {selected.resolution_text}
                      </div>
                       {selected.status === 'resolved' && selected.attachments.filter(a => a.is_proof).length > 0 && (
                        <div className="mt-4">
                          <p className="font-data-mono text-[10px] text-text-muted font-bold uppercase mb-2">Attached Proof</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {selected.attachments.filter(a => a.is_proof).map((a) => (
                              <a key={a.id} href={fileUrl(a.file_path)} target="_blank" rel="noreferrer" className="block cursor-zoom-in">
                                <img src={fileUrl(a.file_path)} alt="Resolution Proof" className="border-2 border-border-strong w-full h-32 object-cover object-top hover:opacity-90 transition-opacity" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-6 text-right">
                        <Button variant="ghost" className="text-coral-red hover:bg-coral-red/10" onClick={eraseTicket}>
                          Erase Ticket Permanently
                        </Button>
                      </div>
                   </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
