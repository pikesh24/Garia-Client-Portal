"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, apiRequest, ApiError, fileUrl, getAccessToken } from "@/lib/api";
import { Ticket } from "@/lib/types";
import { Alert, Button, EmptyState, Field, Label, PageHeader, StatusBadge, Textarea, Input } from "@/components/ui";
import { useProject } from "@/lib/project-context";
import { useWsEvent } from "@/components/WebSocketProvider";

export default function TicketsPage() {
  const { currentProject } = useProject();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const ticketsVersion = useWsEvent("tickets");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Each pick/drop only ever hands us the files from that one interaction -- a native file
  // input has no memory of what was chosen before, so we merge into what's already selected
  // instead of replacing it. Dedupe by name+size so re-picking the same file isn't added twice.
  function addFiles(newFiles: FileList | File[]) {
    setSelectedFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const additions = Array.from(newFiles).filter((f) => !existingKeys.has(`${f.name}:${f.size}`));
      return [...prev, ...additions];
    });
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function load() {
    if (!currentProject) {
      setLoading(false);
      return;
    }
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
  }, [currentProject?.id, ticketsVersion]);

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
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  async function fileTicket(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!currentProject) return;
    if (selectedFiles.length === 0) {
      setError("At least one attachment is required to file an incident ticket");
      return;
    }
    const form = new FormData();
    form.append("name", name);
    form.append("description", description);
    for (const file of selectedFiles) {
        form.append("file_upload", file);
    }
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
      setSelectedFiles([]);
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
        <div className="border-4 border-border-strong bg-bg-panel-alt shadow-[8px_8px_0px_0px_var(--shadow-strong)] p-6 md:p-8">
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
                  className={`relative flex flex-col items-center justify-center border-4 border-dashed p-10 text-center transition-colors min-h-[250px] ${
                    dragActive ? "border-brand-green bg-brand-green/5" : "border-border-strong bg-bg-base hover:border-text-main"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <span className={`material-symbols-outlined text-5xl mb-4 ${dragActive ? "text-brand-green" : "text-text-muted"}`} data-icon="upload_file">
                    upload_file
                  </span>
                  <p className="font-data-mono text-text-main mb-2 font-bold">
                    {selectedFiles.length > 0 ? (
                      <span className="text-brand-green uppercase">
                        {selectedFiles.length === 1 ? "1 FILE SELECTED" : `${selectedFiles.length} FILES SELECTED`}
                      </span>
                    ) : (
                      "DRAG & DROP IMAGES HERE"
                    )}
                  </p>
                  <p className="font-data-mono text-xs text-text-muted uppercase tracking-widest mb-6">
                    OR CLICK TO BROWSE (ADDS TO YOUR SELECTION)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                    onChange={(e) => {
                      // Snapshot into a plain array before touching e.target.value -- e.target.files
                      // is a *live* FileList tied to the input, and clearing the input's value below
                      // empties that same live list, which would race against React's state update.
                      if (e.target.files && e.target.files.length > 0) {
                        addFiles(Array.from(e.target.files));
                      }
                      // Reset so picking the exact same file(s) again still fires onChange next time.
                      e.target.value = "";
                    }}
                  />
                </div>
                {selectedFiles.length > 0 && (
                  <ul className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                    {selectedFiles.map((file, i) => (
                      <li key={`${file.name}-${file.size}-${i}`} className="flex items-center gap-2 font-data-mono text-xs text-text-main bg-bg-base border-2 border-border-strong/50 px-3 py-2">
                        <span className="material-symbols-outlined text-sm text-brand-green shrink-0">image</span>
                        <span className="truncate flex-1">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="material-symbols-outlined text-sm text-text-muted hover:text-coral-red transition-colors shrink-0"
                          aria-label={`Remove ${file.name}`}
                        >
                          close
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Field>
            </div>
            
            <div className="flex justify-end pt-6 border-t-4 border-border-strong border-dashed mt-6">
              <Button type="submit" disabled={selectedFiles.length === 0 || !name.trim() || !description.trim()}>
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
                      ? "border-text-main bg-[var(--footer-strip)] text-white shadow-[4px_4px_0px_0px_var(--shadow-strong)]" 
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
              <div className="border-4 border-border-strong bg-bg-base p-6 md:p-8 shadow-[8px_8px_0px_0px_var(--shadow-strong)]">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8 border-b-2 border-border-strong pb-8">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-data-mono text-xs font-black tracking-widest text-text-muted">
                        INCIDENT #{selected.id}
                      </span>
                      <StatusBadge status={selected.status} />
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
                  
                  {/* Creation Event -- raised by the client, always pinned to the left */}
                  <div className="relative flex items-center justify-between md:justify-normal group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-border-strong bg-[var(--footer-strip)] text-white shrink-0 md:order-1 md:translate-x-1/2 shadow-[2px_2px_0px_0px_var(--shadow-strong)] relative z-10">
                      <span className="material-symbols-outlined text-xl font-bold">add</span>
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] border-2 border-border-strong bg-bg-panel-alt p-4 shadow-[4px_4px_0px_0px_var(--shadow-strong)]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-text-main">Ticket Raised</span>
                        <span className="font-data-mono text-[10px] text-text-muted">
                          {new Date(selected.created_at).toLocaleString()}
                        </span>
                      </div>
                      
                      {selected.attachments.filter(a => !a.is_proof).length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-4">
                          {selected.attachments.filter(a => !a.is_proof).map((a) => (
                            <div key={a.id} className="relative group max-w-sm w-full sm:w-auto">
                              <a href={fileUrl(a.file_path)} target="_blank" rel="noreferrer" className="block relative bg-bg-panel-alt border-2 border-border-strong p-1.5 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all shadow-[4px_4px_0px_0px_var(--shadow-strong)]">
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 z-10">
                                  <span className="bg-bg-panel text-text-main font-data-mono font-bold px-3 py-1 text-xs uppercase tracking-widest border-2 border-text-main shadow-[2px_2px_0px_0px_#000]">
                                    Enlarge
                                  </span>
                                </div>
                                <div className="bg-border-subtle/20 overflow-hidden flex items-center justify-center h-32 w-full sm:w-48">
                                  <img src={fileUrl(a.file_path)} alt="Initial Media" className="max-w-full max-h-full object-contain" />
                                </div>
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* History Events -- always on the opposite side from the client's creation event, never alternating */}
                  {selected.status_history.map((h) => (
                    <div key={h.id} className="relative flex items-center justify-between md:justify-normal md:flex-row-reverse group is-active">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-border-strong shrink-0 md:order-1 md:-translate-x-1/2 shadow-[2px_2px_0px_0px_var(--shadow-strong)] relative z-10 ${
                        h.status === 'resolved' ? 'bg-forest-green text-white' : 
                        h.status === 'out_of_scope' ? 'bg-coral-red text-white' : 'bg-amber text-black'
                      }`}>
                        <span className="material-symbols-outlined text-xl font-bold">
                          {h.status === 'resolved' ? 'check' : h.status === 'out_of_scope' ? 'close' : 'update'}
                        </span>
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] border-2 border-border-strong bg-bg-base p-4 shadow-[4px_4px_0px_0px_var(--shadow-strong)]">
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
                        
                        {h.status === 'resolved' && selected.attachments.filter(a => a.is_proof).length > 0 && (
                          <div className="mt-4">
                            <p className="font-data-mono text-[10px] text-text-muted font-bold uppercase mb-2">Attached Proof</p>
                            <div className="flex flex-wrap gap-4">
                              {selected.attachments.filter(a => a.is_proof).map((a) => (
                                <div key={a.id} className="relative group max-w-sm w-full sm:w-auto">
                                  <a href={fileUrl(a.file_path)} target="_blank" rel="noreferrer" className="block relative bg-bg-panel-alt border-2 border-border-strong p-1.5 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all shadow-[4px_4px_0px_0px_var(--shadow-strong)]">
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 z-10">
                                      <span className="bg-bg-panel text-text-main font-data-mono font-bold px-3 py-1 text-xs uppercase tracking-widest border-2 border-text-main shadow-[2px_2px_0px_0px_#000]">
                                        Enlarge
                                      </span>
                                    </div>
                                    <div className="bg-forest-green/10 border border-border-subtle border-dashed overflow-hidden flex items-center justify-center h-32 w-full sm:w-48">
                                      <img src={fileUrl(a.file_path)} alt="Resolution Proof" className="max-w-full max-h-full object-contain" />
                                    </div>
                                  </a>
                                </div>
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
