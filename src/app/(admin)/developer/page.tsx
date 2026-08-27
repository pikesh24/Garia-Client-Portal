"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { API_BASE_URL, apiRequest, ApiError, fileUrl, getAccessToken } from "@/lib/api";
import { Ticket } from "@/lib/types";
import { Alert, Button, EmptyState, Field, Label, PageHeader, StatusBadge, Textarea } from "@/components/ui";
import { useWsEvent } from "@/components/WebSocketProvider";

const CLOSED_STATUSES = ["resolved", "out_of_scope"];

function TicketCard({
  ticket,
  selected,
  onSelect,
  draggable,
}: {
  ticket: Ticket;
  selected: boolean;
  onSelect: () => void;
  draggable: boolean;
}) {
  const sortable = useSortable({ id: ticket.id, disabled: !draggable });
  const style = draggable
    ? {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.4 : 1,
      }
    : undefined;

  const isDone = CLOSED_STATUSES.includes(ticket.status);

  return (
    <button
      ref={draggable ? sortable.setNodeRef : undefined}
      style={style}
      {...(draggable ? sortable.attributes : {})}
      {...(draggable ? sortable.listeners : {})}
      onClick={onSelect}
      className={`block w-full border-4 p-5 text-left transition-all ${
        selected
          ? "border-text-main bg-[var(--footer-strip)] text-white shadow-[4px_4px_0px_0px_var(--shadow-strong)]"
          : isDone
            ? "border-border-subtle bg-bg-panel-alt opacity-60 hover:border-text-main"
            : "border-border-strong bg-bg-base hover:border-text-main"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-data-mono text-xs font-black tracking-widest">#{ticket.id}</span>
        <StatusBadge status={ticket.status} />
      </div>
      <h4 className={`font-bold mb-3 truncate ${selected ? "text-white" : "text-text-main"}`}>{ticket.name}</h4>
      <span className={`text-xs ${selected ? "text-white/70" : "text-text-muted"}`}>
        {new Date(ticket.created_at).toLocaleString()}
      </span>
    </button>
  );
}

export default function DeveloperQueuePage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [resolutionText, setResolutionText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const proofInputRef = useRef<HTMLInputElement>(null);

  // Each pick/drop only hands us the files from that one interaction -- merge into what's
  // already selected instead of replacing it. Dedupe by name+size so re-picking the same
  // file isn't added twice.
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
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const ticketsVersion = useWsEvent("tickets");

  async function load() {
    const data = await apiRequest<Ticket[]>("/api/developer/tickets");
    setTickets(data);
    setLoading(false);
    setSelected((prev) => (prev ? data.find((t) => t.id === prev.id) ?? null : null));
  }

  useEffect(() => {
    load();
  }, [ticketsVersion]);

  const totalPages = Math.ceil(tickets.length / ITEMS_PER_PAGE);
  const paginatedTickets = tickets.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const activePaginated = paginatedTickets.filter((t) => !CLOSED_STATUSES.includes(t.status));
  const donePaginated = paginatedTickets.filter((t) => CLOSED_STATUSES.includes(t.status));

  const activeTickets = tickets.filter((t) => !CLOSED_STATUSES.includes(t.status));
  const doneTickets = tickets.filter((t) => CLOSED_STATUSES.includes(t.status));

  function selectTicket(t: Ticket) {
    setSelected(t);
    setResolutionText("");
    setSelectedFiles([]);
    if (proofInputRef.current) proofInputRef.current.value = "";
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = activeTickets.findIndex((t) => t.id === active.id);
    const newIdx = activeTickets.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(activeTickets, oldIdx, newIdx);
    setTickets([...reordered, ...doneTickets]);
    try {
      await apiRequest("/api/developer/tickets/reorder", {
        method: "PATCH",
        body: { ordered_ticket_ids: reordered.map((t) => t.id) },
      });
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not save new order");
      await load();
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  async function resolveTicket() {
    if (!selected) return;
    setError(null);
    const form = new FormData();
    form.append("resolution_text", resolutionText);
    for (const file of selectedFiles) {
      form.append("proof_attachments", file);
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/developer/tickets/${selected.id}/resolve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        body: form,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new ApiError(res.status, data.detail);
      }
      setResolutionText("");
      setSelectedFiles([]);
      if (proofInputRef.current) proofInputRef.current.value = "";
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not mark ticket resolved");
    }
  }

  return (
    <div className="space-y-12">
      <PageHeader title="My Queue" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Draggable queue */}
        <div className="lg:col-span-4 space-y-4">
          <h3 className="font-display-xl text-3xl font-black uppercase text-text-main mb-6 border-b-4 border-border-strong pb-4">
            Assigned Tickets
          </h3>
          {loading ? (
            <p className="font-data-mono text-text-muted">Loading...</p>
          ) : tickets.length === 0 ? (
            <EmptyState>No tickets assigned to you yet.</EmptyState>
          ) : (
            <div className="flex flex-col h-full">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={activePaginated.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-4">
                    {activePaginated.map((t) => (
                      <TicketCard key={t.id} ticket={t} selected={selected?.id === t.id} onSelect={() => selectTicket(t)} draggable />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              {donePaginated.length > 0 && (
                <div className="space-y-4 pt-4 mt-4 border-t-2 border-border-subtle">
                  {donePaginated.map((t) => (
                    <TicketCard key={t.id} ticket={t} selected={selected?.id === t.id} onSelect={() => selectTicket(t)} draggable={false} />
                  ))}
                </div>
              )}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 border-t-4 border-border-strong pt-4">
                  <Button variant="ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 border-2 border-transparent hover:border-border-strong">
                    PREV
                  </Button>
                  <span className="font-data-mono text-sm font-bold uppercase tracking-widest text-text-main">
                    PAGE {page} OF {totalPages}
                  </span>
                  <Button variant="ghost" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 border-2 border-transparent hover:border-border-strong">
                    NEXT
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ticket detail */}
        <div className="lg:col-span-8">
          <h3 className="font-display-xl text-3xl font-black uppercase text-text-main mb-6 border-b-4 border-border-strong pb-4">
            Ticket Detail
          </h3>

          {error && <Alert>{error}</Alert>}

          {!selected ? (
            <div className="border-4 border-border-strong border-dashed p-12 text-center text-text-muted h-full flex items-center justify-center">
              <p className="font-data-mono uppercase tracking-widest">Select a ticket from your queue</p>
            </div>
          ) : (
            <div className="border-4 border-border-strong bg-bg-base p-6 md:p-8 shadow-[8px_8px_0px_0px_var(--shadow-strong)] relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6 border-b-2 border-border-strong pb-6">
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

              <div className="mb-8">
                <div className="flex flex-wrap gap-6">
                  {selected.attachments.filter((a) => !a.is_proof).map((a) => (
                    <div key={a.id} className="relative group max-w-sm w-full sm:w-auto">
                      <p className="font-data-mono text-[10px] text-text-muted uppercase mb-2 flex items-center gap-2 tracking-widest font-bold">
                         <span className="material-symbols-outlined text-sm">image</span> Initial Upload Media
                      </p>
                      <a href={fileUrl(a.file_path)} target="_blank" rel="noreferrer" className="block relative bg-bg-panel-alt border-4 border-border-strong p-2 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_var(--shadow-strong)] transition-all shadow-[6px_6px_0px_0px_var(--shadow-strong)]">
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 z-10">
                          <span className="bg-bg-panel text-text-main font-data-mono font-bold px-4 py-2 uppercase tracking-widest border-4 border-text-main shadow-[4px_4px_0px_0px_#000]">
                            Enlarge
                          </span>
                        </div>
                        <div className="bg-bg-base/50 border-2 border-border-subtle border-dashed overflow-hidden flex items-center justify-center h-64 w-full sm:w-72">
                          <img src={fileUrl(a.file_path)} alt="Initial Media" className="max-w-full max-h-full object-contain" />
                        </div>
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {CLOSED_STATUSES.includes(selected.status) ? (
                <div className="mt-8 border-t-2 border-border-strong pt-6">
                  <h4 className="font-label-caps text-xs text-text-muted font-black uppercase tracking-widest mb-4">
                    Resolution Provided
                  </h4>
                  <div className="p-4 border-2 border-border-strong bg-forest-green/10 border-forest-green">
                    {selected.resolution_text}
                  </div>
                  {selected.attachments.filter((a) => a.is_proof).length > 0 && (
                    <div className="mt-8">
                      <p className="font-data-mono text-[10px] text-text-muted font-bold uppercase mb-2 flex items-center gap-2 tracking-widest">
                        <span className="material-symbols-outlined text-sm">verified</span> Attached Proof
                      </p>
                      <div className="flex flex-wrap gap-6">
                        {selected.attachments.filter((a) => a.is_proof).map((a) => (
                          <div key={a.id} className="relative group max-w-sm w-full sm:w-auto">
                            <a href={fileUrl(a.file_path)} target="_blank" rel="noreferrer" className="block relative bg-bg-panel-alt border-4 border-border-strong p-2 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_var(--shadow-strong)] transition-all shadow-[6px_6px_0px_0px_var(--shadow-strong)]">
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 z-10">
                                <span className="bg-bg-panel text-text-main font-data-mono font-bold px-3 py-1 text-xs uppercase tracking-widest border-4 border-text-main shadow-[2px_2px_0px_0px_#000]">
                                  Enlarge
                                </span>
                              </div>
                              <div className="bg-forest-green/10 border-2 border-border-subtle border-dashed overflow-hidden flex items-center justify-center h-48 w-full sm:w-64">
                                <img src={fileUrl(a.file_path)} alt="Resolution Proof" className="max-w-full max-h-full object-contain" />
                              </div>
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-bg-panel-alt border-4 border-border-strong p-6 md:p-8 mt-12 relative shadow-[8px_8px_0px_0px_var(--shadow-strong)]">
                  <div className="absolute -top-5 right-2 md:-top-5 md:right-6">
                    <span className="bg-[var(--footer-strip)] text-white font-data-mono text-[10px] md:text-xs font-black uppercase tracking-widest px-4 py-2 shadow-[4px_4px_0px_0px_var(--shadow-strong)] border-4 border-border-strong">
                      DEVELOPER ACTION
                    </span>
                  </div>
                  <h4 className="font-label-caps text-xs text-text-muted font-black uppercase tracking-widest mb-4">
                    Mark Ticket Resolved
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <Field>
                      <Label>Resolution Notes</Label>
                      <Textarea value={resolutionText} onChange={(e) => setResolutionText(e.target.value)} rows={7} placeholder="Explain what was done to resolve this ticket..." />
                    </Field>

                    <Field>
                      <Label>Proof Images (optional)</Label>
                      <div
                        className={`relative flex flex-col items-center justify-center border-2 border-dashed p-6 text-center transition-colors min-h-[150px] ${
                          dragActive ? "border-brand-green bg-brand-green/5" : "border-border-strong bg-bg-base hover:border-text-main"
                        }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                      >
                        <span className={`material-symbols-outlined text-4xl mb-2 ${dragActive ? "text-brand-green" : "text-text-muted"}`} data-icon="upload_file">
                          upload_file
                        </span>
                        <p className="font-data-mono text-text-main mb-1 font-bold text-sm">
                          {selectedFiles.length > 0 ? (
                            <span className="text-brand-green uppercase">
                              {selectedFiles.length === 1 ? "1 FILE SELECTED" : `${selectedFiles.length} FILES SELECTED`}
                            </span>
                          ) : (
                            "DRAG & DROP IMAGES HERE"
                          )}
                        </p>
                        <p className="font-data-mono text-[10px] text-text-muted uppercase tracking-widest mb-4">
                          OR CLICK TO BROWSE (ADDS TO YOUR SELECTION)
                        </p>
                        <input
                          ref={proofInputRef}
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
                        <ul className="mt-3 space-y-1 max-h-28 overflow-y-auto">
                          {selectedFiles.map((file, i) => (
                            <li key={`${file.name}-${file.size}-${i}`} className="flex items-center gap-2 font-data-mono text-[10px] text-text-main bg-bg-base border-2 border-border-strong/50 px-3 py-1.5">
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
                  <Button onClick={resolveTicket} disabled={!resolutionText.trim()} className="bg-forest-green text-white hover:bg-forest-green/80">
                    Confirm Resolved
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
