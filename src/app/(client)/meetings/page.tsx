"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { BlockedDate, BusyRange, Meeting, MeetingBlock, MeetingType } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { useProject } from "@/lib/project-context";
import { EmptyState, PageHeader } from "@/components/ui";
import { MeetingCalendarView, MeetingActions, BookableConfig, TimeRange, toDateKey } from "@/components/MeetingCalendar";
import { useWsEvent } from "@/components/WebSocketProvider";

const MIN_HOURS_AHEAD = 36;

function minBookableInstant(): Date {
  return new Date(Date.now() + MIN_HOURS_AHEAD * 60 * 60 * 1000);
}

export default function MeetingsPage() {
  const { user } = useAuth();
  const { currentProject } = useProject();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [blocks, setBlocks] = useState<MeetingBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const meetingsVersion = useWsEvent("meetings");

  const minInstant = useMemo(() => minBookableInstant(), []);

  async function load() {
    if (!currentProject) {
      setLoading(false);
      return;
    }
    const data = await apiRequest<Meeting[]>(`/api/projects/${currentProject.id}/meetings`);
    setMeetings(data);
    setLoading(false);
  }

  async function loadBlocks() {
    if (!currentProject) return;
    const data = await apiRequest<MeetingBlock[]>(`/api/projects/${currentProject.id}/meetings/blocks`);
    setBlocks(data);
  }

  useEffect(() => {
    load();
    loadBlocks();
  }, [currentProject?.id, meetingsVersion]);

  const fetchBusyRanges = async (date: Date, excludeMeetingId?: number): Promise<TimeRange[]> => {
    if (!currentProject) return [];
    const params = new URLSearchParams({ date: toDateKey(date) });
    if (excludeMeetingId) params.set("exclude_meeting_id", String(excludeMeetingId));
    const data = await apiRequest<BusyRange[]>(`/api/projects/${currentProject.id}/meetings/busy?${params.toString()}`);
    return data.map((r) => ({ start: new Date(r.start_datetime), end: new Date(r.end_datetime) }));
  };

  const fetchBlockedDates = async (rangeStart: Date, rangeEnd: Date): Promise<BlockedDate[]> => {
    if (!currentProject) return [];
    const params = new URLSearchParams({ range_start: toDateKey(rangeStart), range_end: toDateKey(rangeEnd) });
    return apiRequest<BlockedDate[]>(`/api/projects/${currentProject.id}/meetings/blocked-dates?${params.toString()}`);
  };

  const actions: MeetingActions = {
    onCancel: async (m) => {
      if (!currentProject) return;
      await apiRequest(`/api/projects/${currentProject.id}/meetings/${m.id}/cancel`, { method: "POST" });
      await load();
    },
    onProposeReschedule: async (m, start, end) => {
      if (!currentProject) return;
      await apiRequest(`/api/projects/${currentProject.id}/meetings/${m.id}/propose-reschedule`, {
        method: "POST",
        body: { pending_start_datetime: start.toISOString(), pending_end_datetime: end.toISOString() },
      });
      await load();
    },
    onAcceptReschedule: async (m) => {
      if (!currentProject) return;
      await apiRequest(`/api/projects/${currentProject.id}/meetings/${m.id}/accept-reschedule`, { method: "POST" });
      await load();
    },
    onDenyReschedule: async (m, reason) => {
      if (!currentProject) return;
      await apiRequest(`/api/projects/${currentProject.id}/meetings/${m.id}/deny-reschedule`, { method: "POST", body: { reason } });
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

      {!currentProject ? (
        <EmptyState>No project assigned yet.</EmptyState>
      ) : loading ? (
        <p className="text-text-muted">Loading...</p>
      ) : (
        <MeetingCalendarView
          role="client"
          meetings={meetings}
          actions={actions}
          labelFor={(m) => m.status.replace(/_/g, " ")}
          bookable={bookable}
          fetchBusyRanges={fetchBusyRanges}
          fetchBlockedDates={fetchBlockedDates}
          blocks={blocks}
        />
      )}
    </div>
  );
}
