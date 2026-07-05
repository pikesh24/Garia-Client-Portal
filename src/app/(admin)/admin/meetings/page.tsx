"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { BusyRange, Meeting, MeetingBlock } from "@/lib/types";
import { Button, Card, CardBody, CardHeader, PageHeader, StatusBadge } from "@/components/ui";
import { BlockTimeModal, MeetingActions, MeetingDetailsModal, TimeRange, meetingDisplayRange, formatTimeFn } from "@/components/MeetingCalendar";
import { AdminProjectFilter, useAdminProjectFilter } from "@/components/AdminProjectFilter";

function toLocalDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function AdminMeetingsPage() {
  const searchParams = useSearchParams();
  const meetingIdParam = searchParams.get("meetingId");
  const [filter, setFilter] = useAdminProjectFilter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [blocks, setBlocks] = useState<MeetingBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  async function load() {
    const endpoint = filter.projectId
      ? `/api/admin/projects/${filter.projectId}/meetings`
      : "/api/admin/meetings";
    const data = await apiRequest<Meeting[]>(endpoint);
    setMeetings(data);
    setLoading(false);
    if (meetingIdParam) {
      const match = data.find((m) => m.id === Number(meetingIdParam));
      if (match) setActiveMeeting(match);
    }
  }

  async function loadBlocks() {
    const data = await apiRequest<MeetingBlock[]>("/api/admin/meetings/blocks");
    setBlocks(data);
  }

  useEffect(() => {
    load();
  }, [filter.projectId]);

  useEffect(() => {
    loadBlocks();
  }, []);

  async function deleteBlock(id: number) {
    await apiRequest(`/api/admin/meetings/blocks/${id}`, { method: "DELETE" });
    await loadBlocks();
  }

  const fetchBusyRanges = async (date: Date, excludeMeetingId?: number): Promise<TimeRange[]> => {
    const params = new URLSearchParams({ date: toLocalDateParam(date) });
    if (excludeMeetingId) params.set("exclude_meeting_id", String(excludeMeetingId));
    const data = await apiRequest<BusyRange[]>(`/api/admin/meetings/busy?${params.toString()}`);
    return data.map((r) => ({ start: new Date(r.start_datetime), end: new Date(r.end_datetime) }));
  };

  const actions: MeetingActions = {
    onConfirm: async (m, meetingLink) => {
      await apiRequest(`/api/admin/meetings/${m.id}/confirm`, { method: "PATCH", body: { meeting_link: meetingLink } });
      await load();
    },
    onDeny: async (m, reason) => {
      await apiRequest(`/api/admin/meetings/${m.id}/deny`, { method: "PATCH", body: { reason } });
      await load();
    },
    onProposeReschedule: async (m, start, end) => {
      await apiRequest(`/api/admin/meetings/${m.id}/propose-reschedule`, {
        method: "POST",
        body: { pending_start_datetime: start.toISOString(), pending_end_datetime: end.toISOString() },
      });
      await load();
    },
  };

  // Sort meetings by date
  const sortedMeetings = [...meetings].sort((a, b) => {
    const aDate = meetingDisplayRange(a).start;
    const bDate = meetingDisplayRange(b).start;
    return aDate.getTime() - bDate.getTime();
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Unified Meetings Calendar" />

      <AdminProjectFilter value={filter} onChange={setFilter} />

      <div className="grid grid-cols-1 gap-6">
        <Card className="flex flex-col">
          <CardHeader>Blocked Time Management</CardHeader>
          <CardBody className="flex flex-col flex-1">
            <div className="flex justify-between items-center mb-4">
              <p className="font-data-mono text-[10px] uppercase font-bold tracking-widest text-text-muted">Prevent bookings on specific dates</p>
              <Button onClick={() => setBlockModalOpen(true)} size="sm">
                + Block Time Off
              </Button>
            </div>
            
            {blocks.length === 0 ? (
              <div className="flex-1 flex items-center justify-center border-4 border-dashed border-border-strong/30 bg-bg-panel-alt p-4">
                <p className="font-data-mono text-[10px] uppercase font-bold tracking-widest text-text-muted">No blocked time ranges.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[120px] overflow-y-auto custom-scrollbar pr-2 flex-1">
                {blocks.map((b) => (
                  <div key={b.id} className="flex items-center justify-between border-2 border-border-strong bg-bg-panel-alt p-2">
                    <div>
                      <p className="font-data-mono text-xs font-bold text-text-main uppercase">
                        {new Date(b.start_datetime).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        {", "}
                        {new Date(b.start_datetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} –{" "}
                        {new Date(b.end_datetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </p>
                      {b.reason && <p className="text-[10px] text-text-muted font-bold uppercase mt-1">{b.reason}</p>}
                    </div>
                    <button onClick={() => deleteBlock(b.id)} className="text-coral-red hover:underline font-data-mono text-[10px] uppercase font-black ml-2">
                      REMOVE
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Meeting list — screenshot 3 inspired */}
      {loading ? (
        <p className="text-text-muted">Loading...</p>
      ) : sortedMeetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-bg-panel-alt border-4 border-dashed border-border-strong">
          <span className="material-symbols-outlined text-4xl text-text-muted mb-4" data-icon="event_busy">event_busy</span>
          <p className="font-data-mono text-data-mono text-text-muted uppercase tracking-widest">No meetings scheduled yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedMeetings.map((m) => {
            const range = meetingDisplayRange(m);
            const monthStr = range.start.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
            const dayStr = String(range.start.getDate()).padStart(2, "0");

            return (
              <button
                key={m.id}
                onClick={() => { setActiveMeeting(m); setDetailError(null); }}
                className="w-full text-left flex items-stretch border-4 border-border-strong bg-bg-panel-alt overflow-hidden shadow-[6px_6px_0px_0px_var(--shadow-strong)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_var(--shadow-strong)] transition-all group"
              >
                {/* Date badge */}
                <div className="flex-shrink-0 w-20 bg-bg-panel border-r-4 border-border-strong flex flex-col items-center justify-center py-4">
                  <span className="font-data-mono text-[10px] uppercase tracking-widest text-brand-green font-bold">{monthStr}</span>
                  <span className="font-display-2xl text-4xl font-black text-white leading-none">{dayStr}</span>
                </div>

                {/* Content */}
                <div className="flex-1 flex items-center justify-between px-5 py-4 min-w-0">
                  <div className="min-w-0">
                    <h3 className="font-headline-lg text-base font-black uppercase text-text-main truncate leading-tight">
                      {m.agenda}
                    </h3>
                    <p className="font-data-mono text-xs text-text-muted tracking-[0.1em] mt-1">
                      {formatTimeFn(range.start)}–{formatTimeFn(range.end)}{" "}
                      <span className="opacity-60">· Client #{m.client_id} · {m.meeting_type}</span>
                    </p>
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    <StatusBadge status={m.status} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <MeetingDetailsModal
        role="admin"
        meeting={activeMeeting}
        actions={actions}
        error={detailError}
        setError={setDetailError}
        onClose={() => setActiveMeeting(null)}
        fetchBusyRanges={fetchBusyRanges}
      />

      <BlockTimeModal
        open={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        minDate={new Date()}
        fetchBusyRanges={fetchBusyRanges}
        onCreate={async (start, end, reason) => {
          await apiRequest("/api/admin/meetings/blocks", {
            method: "POST",
            body: { start_datetime: start.toISOString(), end_datetime: end.toISOString(), reason: reason || null },
          });
          await loadBlocks();
        }}
      />
    </div>
  );
}
