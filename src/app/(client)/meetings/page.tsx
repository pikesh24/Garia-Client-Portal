"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { BusyRange, Meeting, MeetingBlock, MeetingType } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { useProject } from "@/lib/project-context";
import { PageHeader } from "@/components/ui";
import { MeetingCalendarView, MeetingActions, BookableConfig, TimeRange } from "@/components/MeetingCalendar";

const MIN_HOURS_AHEAD = 36;

function minBookableInstant(): Date {
  return new Date(Date.now() + MIN_HOURS_AHEAD * 60 * 60 * 1000);
}

function toLocalDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function MeetingsPage() {
  const { user } = useAuth();
  const { currentProject } = useProject();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [blocks, setBlocks] = useState<MeetingBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const minInstant = useMemo(() => minBookableInstant(), []);

  async function load() {
    if (!currentProject) return;
    const data = await apiRequest<Meeting[]>(`/api/projects/${currentProject.id}/meetings`);
    setMeetings(data);
    setLoading(false);
  }

  async function loadBlocks() {
    const data = await apiRequest<MeetingBlock[]>("/api/meetings/blocks");
    setBlocks(data);
  }

  useEffect(() => {
    load();
    loadBlocks();
  }, [currentProject?.id]);

  const fetchBusyRanges = async (date: Date, excludeMeetingId?: number): Promise<TimeRange[]> => {
    const params = new URLSearchParams({ date: toLocalDateParam(date) });
    if (excludeMeetingId) params.set("exclude_meeting_id", String(excludeMeetingId));
    const data = await apiRequest<BusyRange[]>(`/api/meetings/busy?${params.toString()}`);
    return data.map((r) => ({ start: new Date(r.start_datetime), end: new Date(r.end_datetime) }));
  };

  const actions: MeetingActions = {
    onCancel: async (m) => {
      await apiRequest(`/api/meetings/${m.id}/cancel`, { method: "POST" });
      await load();
    },
    onProposeReschedule: async (m, start, end) => {
      await apiRequest(`/api/meetings/${m.id}/propose-reschedule`, {
        method: "POST",
        body: { pending_start_datetime: start.toISOString(), pending_end_datetime: end.toISOString() },
      });
      await load();
    },
    onAcceptReschedule: async (m) => {
      await apiRequest(`/api/meetings/${m.id}/accept-reschedule`, { method: "POST" });
      await load();
    },
    onDenyReschedule: async (m, reason) => {
      await apiRequest(`/api/meetings/${m.id}/deny-reschedule`, { method: "POST", body: { reason } });
      await load();
    },
  };

  const bookable: BookableConfig = {
    minInstant,
    allowOnline: true,
    allowOffline: !!user?.can_book_offline_meeting,
    onBook: async (start: Date, end: Date, meetingType: MeetingType, agenda: string) => {
      if (!currentProject) return;
      await apiRequest(`/api/projects/${currentProject.id}/meetings`, {
        method: "POST",
        body: {
          meeting_type: meetingType,
          pending_start_datetime: start.toISOString(),
          pending_end_datetime: end.toISOString(),
          agenda,
        },
      });
      await load();
    },
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Meetings Calendar" />

      {loading || !currentProject ? (
        <p className="text-text-muted">Loading...</p>
      ) : (
        <MeetingCalendarView
          role="client"
          meetings={meetings}
          actions={actions}
          labelFor={(m) => m.status.replace(/_/g, " ")}
          bookable={bookable}
          fetchBusyRanges={fetchBusyRanges}
          blocks={blocks}
        />
      )}
    </div>
  );
}
