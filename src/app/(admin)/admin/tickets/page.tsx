"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiRequest, ApiError, fileUrl } from "@/lib/api";
import { Ticket, User } from "@/lib/types";
import { Alert, Button, EmptyState, PageHeader, Select, StatusBadge } from "@/components/ui";
import { AdminProjectFilter, useAdminProjectFilter } from "@/components/AdminProjectFilter";
import { useAuth } from "@/lib/auth";
import { useWsEvent } from "@/components/WebSocketProvider";

export default function AdminTicketsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const ticketIdParam = searchParams.get("ticketId");
  const [filter, setFilter] = useAdminProjectFilter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [developers, setDevelopers] = useState<User[]>([]);
  const [pickDeveloperId, setPickDeveloperId] = useState("");
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  const [error, setError] = useState<string | null>(null);
  const ticketsVersion = useWsEvent("tickets");

  async function load() {
    const endpoint = filter.projectId
      ? `/api/admin/projects/${filter.projectId}/tickets`
      : "/api/admin/tickets";
    const data = await apiRequest<Ticket[]>(endpoint);
    setTickets(data);
    setSelected((prev) => {
      if (prev) return data.find((t) => t.id === prev.id) ?? null;
      if (ticketIdParam) return data.find((t) => t.id === Number(ticketIdParam)) ?? null;
      return null;
    });
  }

  useEffect(() => {
    load();
    setSelected(null);
    setPage(1);
  }, [filter.projectId]);

  // A ws-triggered refetch shouldn't clear the currently selected ticket or reset
  // pagination — load() already re-syncs `selected` from the fresh data itself.
  useEffect(() => {
    if (ticketsVersion > 0) load();
  }, [ticketsVersion]);

  useEffect(() => {
    apiRequest<User[]>("/api/admin/developers").then(setDevelopers);
  }, []);

  // Developers manage tickets via their own drag-orderable queue, not this board.
  useEffect(() => {
    if (user?.role === "developer") router.replace("/admin");
  }, [user, router]);

  async function assignDeveloper() {
    if (!selected || !pickDeveloperId) return;
    setError(null);
    try {
      await apiRequest(`/api/admin/tickets/${selected.id}/assignments`, {
        method: "POST",
        body: { developer_ids: [Number(pickDeveloperId)] },
      });
      setPickDeveloperId("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not assign developer");
    }
  }

  async function unassignDeveloper(developerId: number) {
    if (!selected) return;
    setError(null);
    try {
      await apiRequest(`/api/admin/tickets/${selected.id}/assignments/${developerId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not unassign developer");
    }
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
            <div className="flex flex-col h-full">
              <div className="space-y-4 flex-1">
                {tickets.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE).map((t) => (
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
                      <span className="font-data-mono text-xs font-black tracking-widest">#{t.id} (Client {t.client_id})</span>
                      <StatusBadge status={t.status} />
                    </div>
                    <h4 className={`font-bold mb-3 truncate ${selected?.id === t.id ? "text-white" : "text-text-main"}`}>
                      {t.name}
                    </h4>
                    <div className="flex items-center gap-3">
                      <span className={`font-data-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border ${selected?.id === t.id ? "bg-white/20 border-white/50" : t.assignments?.length ? "bg-bg-panel-alt border-border-strong text-text-main" : "bg-coral-red text-white border-coral-red"}`}>
                        {t.assignments?.length ? `${t.assignments.length} DEV` : "UNASSIGNED"}
                      </span>
                      <span className={`text-xs ${selected?.id === t.id ? "text-white/70" : "text-text-muted"}`}>
                        {new Date(t.created_at).toLocaleString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              {Math.ceil(tickets.length / ITEMS_PER_PAGE) > 1 && (
                <div className="flex items-center justify-between mt-6 border-t-4 border-border-strong pt-4">
                  <Button variant="ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 border-2 border-transparent hover:border-border-strong">
                    PREV
                  </Button>
                  <span className="font-data-mono text-sm font-bold uppercase tracking-widest text-text-main">
                    PAGE {page} OF {Math.ceil(tickets.length / ITEMS_PER_PAGE)}
                  </span>
                  <Button variant="ghost" onClick={() => setPage(p => Math.min(Math.ceil(tickets.length / ITEMS_PER_PAGE), p + 1))} disabled={page === Math.ceil(tickets.length / ITEMS_PER_PAGE)} className="px-4 py-2 border-2 border-transparent hover:border-border-strong">
                    NEXT
                  </Button>
                </div>
              )}
            </div>
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

                <div className="mb-8 border-b-2 border-border-strong pb-8">
                  <h4 className="font-label-caps text-sm text-text-muted font-black uppercase tracking-widest mb-5">
                    Assigned Developers
                  </h4>
                  <div className="flex flex-wrap items-center gap-3 mb-5">
                    {selected.assignments?.length ? (
                      selected.assignments.map((a) => (
                        <span key={a.id} className="inline-flex items-center gap-3 border-2 border-border-strong bg-bg-panel-alt px-4 py-2.5 font-data-mono text-sm text-text-main">
                          {a.developer.full_name}
                          <button
                            onClick={() => unassignDeveloper(a.developer.id)}
                            className="text-text-muted hover:text-coral-red transition-colors text-lg leading-none"
                            title="Unassign"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="font-data-mono text-sm text-text-muted uppercase">No developers assigned</span>
                    )}
                  </div>
                  <div className="flex gap-4">
                    <Select value={pickDeveloperId} onChange={(e) => setPickDeveloperId(e.target.value)} className="max-w-sm">
                      <option value="">Select developer…</option>
                      {developers
                        .filter((d) => !selected.assignments?.some((a) => a.developer.id === d.id))
                        .map((d) => (
                          <option key={d.id} value={d.id}>{d.full_name}</option>
                        ))}
                    </Select>
                    <Button variant="secondary" onClick={assignDeveloper} disabled={!pickDeveloperId}>
                      Assign
                    </Button>
                  </div>
                </div>

                <div className="mb-8">
                  {selected.attachments.filter(a => !a.is_proof).map((a) => (
                    <div key={a.id} className="mt-4">
                      <p className="font-data-mono text-[10px] text-text-muted uppercase mb-2 flex items-center gap-2 tracking-widest font-bold">
                         <span className="material-symbols-outlined text-sm">image</span> Initial Upload Media
                      </p>
                      <a href={fileUrl(a.file_path)} target="_blank" rel="noreferrer" className="block group relative bg-bg-panel-alt border-4 border-border-strong p-2 hover:bg-border-subtle transition-colors shadow-[4px_4px_0px_0px_var(--shadow-strong)]">
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 z-10">
                          <span className="bg-bg-panel text-text-inverse font-data-mono font-bold px-4 py-2 uppercase tracking-widest border-2 border-text-inverse shadow-[4px_4px_0px_0px_#000]">
                            Click to Enlarge
                          </span>
                        </div>
                        <div className="bg-[var(--footer-strip)]/5">
                          <img src={fileUrl(a.file_path)} alt="Initial Media" className="w-full h-64 object-contain" />
                        </div>
                      </a>
                    </div>
                  ))}
                </div>

                {selected.status === 'resolved' || selected.status === 'out_of_scope' ? (
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
                        <div className="mt-6">
                          <p className="font-data-mono text-[10px] text-text-muted font-bold uppercase mb-2 flex items-center gap-2 tracking-widest">
                            <span className="material-symbols-outlined text-sm">verified</span> Attached Proof
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {selected.attachments.filter(a => a.is_proof).map((a) => (
                              <a key={a.id} href={fileUrl(a.file_path)} target="_blank" rel="noreferrer" className="block group relative bg-bg-panel-alt border-4 border-border-strong p-2 hover:bg-border-subtle transition-colors shadow-[4px_4px_0px_0px_var(--shadow-strong)]">
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 z-10">
                                  <span className="bg-bg-panel text-text-inverse font-data-mono font-bold px-3 py-1 text-xs uppercase tracking-widest border-2 border-text-inverse shadow-[2px_2px_0px_0px_#000]">
                                    Enlarge
                                  </span>
                                </div>
                                <div className="bg-forest-green/5">
                                  <img src={fileUrl(a.file_path)} alt="Resolution Proof" className="w-full h-40 object-contain" />
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                   </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
