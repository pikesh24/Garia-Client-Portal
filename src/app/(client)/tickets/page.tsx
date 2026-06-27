"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, apiRequest, ApiError, fileUrl, getAccessToken } from "@/lib/api";
import { Ticket } from "@/lib/types";
import { Alert, Button, EmptyState, Field, Label, PageHeader, StatusBadge, Textarea, Input } from "@/components/ui";
import { useProject } from "@/lib/project-context";

function priorityBadgeColor(priority: string) {
  switch (priority) {
    case "critical": return "bg-coral-red text-white";
    case "high": return "bg-amber text-black";
    case "low": return "bg-text-muted text-white";
    default: return "bg-bg-panel-alt border-border-strong text-text-main border-2";
  }
}

export default function TicketsPage() {
  const { currentProject } = useProject();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hasFile, setHasFile] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!currentProject) return;
    const data = await apiRequest<Ticket[]>(`/api/projects/${currentProject.id}/tickets`);
    setTickets(data);
    setLoading(false);
    if (selected) {
      const updated = data.find((t) => t.id === selected.id);
      setSelected(updated ?? null);
    }
  }

  useEffect(() => {
    load();
  }, [currentProject?.id]);

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
      if (fileInputRef.current) {
        fileInputRef.current.files = e.dataTransfer.files;
        setHasFile(true);
        setFileName(e.dataTransfer.files[0].name);
      }
    }
  };

  async function fileTicket(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!currentProject) return;
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("An attachment is required to file an incident ticket");
      return;
    }
    const form = new FormData();
    form.append("name", name);
    form.append("description", description);
    form.append("file_upload", file);
    try {
      const res = await fetch(`${API_BASE_URL}/api/projects/${currentProject.id}/tickets`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        body: form,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new ApiError(res.status, data.detail);
      }
      setName("");
      setDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setHasFile(false);
      setFileName(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not file ticket");
    }
  }

  return (
    <div className="space-y-12">
      <PageHeader title="Support & Incidents" />

      <div>
        <h3 className="font-display-xl text-3xl font-black uppercase text-text-main mb-6 border-b-4 border-border-strong pb-4">
          File a New Incident
        </h3>
        <div className="border-4 border-border-strong bg-bg-panel-alt shadow-[8px_8px_0px_0px_var(--border-strong)] p-6 md:p-8">
          <form onSubmit={fileTicket}>
            {error && <Alert>{error}</Alert>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-6">
                <Field>
                  <Label>Ticket Name</Label>
                  <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Short title of the issue" />
                </Field>
                <Field>
                  <Label>Description</Label>
                  <Textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={7} placeholder="Detailed explanation of the problem..." />
                </Field>
              </div>
              
              <Field>
                <Label>Media / Screenshot (Required)</Label>
                <div
                  className={`relative flex flex-col items-center justify-center border-4 border-dashed p-10 text-center transition-colors h-full min-h-[250px] ${
                    dragActive ? "border-coral-red bg-coral-red/5" : "border-border-strong bg-bg-base hover:border-text-main"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <span className={`material-symbols-outlined text-5xl mb-4 ${dragActive ? "text-coral-red" : "text-text-muted"}`} data-icon="upload_file">
                    upload_file
                  </span>
                  <p className="font-data-mono text-text-main mb-2 font-bold">
                    {fileName ? <span className="text-coral-red uppercase">{fileName}</span> : "DRAG & DROP IMAGE HERE"}
                  </p>
                  <p className="font-data-mono text-xs text-text-muted uppercase tracking-widest mb-6">
                    OR CLICK TO BROWSE
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    required
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
            
            <div className="flex justify-end pt-6 border-t-4 border-border-strong border-dashed mt-6">
              <Button type="submit" disabled={!hasFile || !name.trim() || !description.trim()}>
                Submit Incident Report
              </Button>
            </div>
          </form>
        </div>
      </div>

      <div>
        <h3 className="font-display-xl text-3xl font-black uppercase text-text-main mb-6 border-b-4 border-border-strong pb-4">
          Ticket Timeline & History
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Ticket Directory */}
          <div className="lg:col-span-4 space-y-4">
            {loading ? (
              <p className="font-data-mono text-text-muted">Loading...</p>
            ) : tickets.length === 0 ? (
              <EmptyState>No tickets filed yet.</EmptyState>
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
                    <span className="font-data-mono text-xs font-black tracking-widest">#{t.id}</span>
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

          {/* Ticket Timeline Viewer */}
          <div className="lg:col-span-8">
            {!selected ? (
              <div className="border-4 border-border-strong border-dashed p-12 text-center text-text-muted h-full flex items-center justify-center">
                <p className="font-data-mono uppercase tracking-widest">Select a ticket to view its timeline</p>
              </div>
            ) : (
              <div className="border-4 border-border-strong bg-bg-base p-6 md:p-8 shadow-[8px_8px_0px_0px_var(--border-strong)]">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8 border-b-2 border-border-strong pb-8">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-data-mono text-xs font-black tracking-widest text-text-muted">
                        INCIDENT #{selected.id}
                      </span>
                      <StatusBadge status={selected.status} />
                      <span className={`font-data-mono text-[10px] uppercase tracking-widest px-2 py-1 ${priorityBadgeColor(selected.priority)}`}>
                        {selected.priority} priority
                      </span>
                    </div>
                    <h2 className="font-headline-lg text-3xl font-black uppercase text-text-main leading-tight mb-4">
                      {selected.name}
                    </h2>
                    <p className="text-text-main whitespace-pre-wrap leading-relaxed">{selected.description}</p>
                  </div>
                </div>

                <h4 className="font-label-caps text-xs text-text-muted font-black uppercase tracking-widest mb-6">
                  Resolution Timeline
                </h4>
                
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-1 before:bg-border-strong">
                  
                  {/* Creation Event */}
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-border-strong bg-text-main text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-[2px_2px_0px_0px_var(--border-strong)] relative z-10">
                      <span className="material-symbols-outlined text-sm">add</span>
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] border-2 border-border-strong bg-bg-panel-alt p-4 shadow-[4px_4px_0px_0px_var(--border-strong)]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-text-main">Ticket Raised</span>
                        <span className="font-data-mono text-[10px] text-text-muted">
                          {new Date(selected.created_at).toLocaleString()}
                        </span>
                      </div>
                      
                      {selected.attachments.filter(a => !a.is_proof).map((a) => (
                        <div key={a.id} className="mt-3">
                          <a href={fileUrl(a.file_path)} target="_blank" rel="noreferrer" className="block cursor-zoom-in">
                            <img src={fileUrl(a.file_path)} alt="Initial Media" className="border-2 border-border-strong w-full max-h-48 object-cover object-top hover:opacity-90 transition-opacity" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* History Events */}
                  {selected.status_history.map((h) => (
                    <div key={h.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-border-strong shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-[2px_2px_0px_0px_var(--border-strong)] relative z-10 ${
                        h.status === 'resolved' ? 'bg-forest-green text-white' : 
                        h.status === 'out_of_scope' ? 'bg-coral-red text-white' : 'bg-amber text-black'
                      }`}>
                        <span className="material-symbols-outlined text-sm">
                          {h.status === 'resolved' ? 'check' : h.status === 'out_of_scope' ? 'close' : 'update'}
                        </span>
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] border-2 border-border-strong bg-bg-base p-4 shadow-[4px_4px_0px_0px_var(--border-strong)]">
                        <div className="flex items-center justify-between mb-2">
                          <StatusBadge status={h.status} />
                          <span className="font-data-mono text-[10px] text-text-muted">
                            {new Date(h.created_at).toLocaleString()}
                          </span>
                        </div>
                        {h.note && (
                          <div className={`text-sm p-4 border-2 border-border-strong mt-2 leading-relaxed ${h.status === 'out_of_scope' ? 'bg-coral-red/10 border-coral-red font-semibold' : h.status === 'resolved' ? 'bg-forest-green/10 border-forest-green font-semibold' : 'bg-bg-panel-alt'}`}>
                            {h.status === 'out_of_scope' && <span className="font-black text-coral-red block mb-1 uppercase tracking-widest text-[10px]">Decline Reason</span>}
                            {h.status === 'resolved' && <span className="font-black text-forest-green block mb-1 uppercase tracking-widest text-[10px]">Resolution</span>}
                            {h.note}
                          </div>
                        )}
                        
                        {/* Show resolution images if this is the resolved event */}
                        {h.status === 'resolved' && selected.attachments.filter(a => a.is_proof).length > 0 && (
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
                      </div>
                    </div>
                  ))}

                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
