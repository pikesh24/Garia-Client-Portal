"use client";

import { useEffect, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import { Meeting, MeetingType } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Label,
  PageHeader,
  StatusBadge,
  Textarea,
} from "@/components/ui";

export default function MeetingsPage() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [meetingType, setMeetingType] = useState<MeetingType>("online");
  const [proposedDatetime, setProposedDatetime] = useState("");
  const [agenda, setAgenda] = useState("");
  const [counterProposals, setCounterProposals] = useState<Record<number, string>>({});

  async function load() {
    const data = await apiRequest<Meeting[]>("/api/meetings");
    setMeetings(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest("/api/meetings", {
        method: "POST",
        body: { meeting_type: meetingType, proposed_datetime: new Date(proposedDatetime).toISOString(), agenda },
      });
      setAgenda("");
      setProposedDatetime("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not submit request");
    }
  }

  async function cancelMeeting(id: number) {
    await apiRequest(`/api/meetings/${id}/cancel`, { method: "POST" });
    await load();
  }

  async function acceptReschedule(id: number) {
    await apiRequest(`/api/meetings/${id}/accept-reschedule`, { method: "POST" });
    await load();
  }

  async function counterPropose(id: number) {
    const value = counterProposals[id];
    if (!value) return;
    await apiRequest(`/api/meetings/${id}/counter-propose`, {
      method: "POST",
      body: { proposed_datetime: new Date(value).toISOString() },
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Meetings Calendar" />

      <Card>
        <CardHeader>Request a New Appointment</CardHeader>
        <CardBody>
          <form onSubmit={submitRequest} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {error && (
              <div className="md:col-span-2">
                <Alert>{error}</Alert>
              </div>
            )}
            <Field>
              <Label>Meeting Type</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-text-primary">
                  <input
                    type="radio"
                    name="meeting_type"
                    value="online"
                    checked={meetingType === "online"}
                    onChange={() => setMeetingType("online")}
                  />
                  Online
                </label>
                <label className="flex items-center gap-2 text-sm text-text-primary">
                  <input
                    type="radio"
                    name="meeting_type"
                    value="offline"
                    checked={meetingType === "offline"}
                    disabled={!user?.can_book_offline_meeting}
                    onChange={() => setMeetingType("offline")}
                  />
                  Offline
                </label>
              </div>
              {!user?.can_book_offline_meeting && (
                <p className="mt-2 rounded-sm border border-gold bg-gold/10 px-2 py-1 text-xs text-gold">
                  403: This account is not authorized to book offline meetings.
                </p>
              )}
            </Field>
            <Field>
              <Label>Proposed Date/Time</Label>
              <Input
                type="datetime-local"
                required
                value={proposedDatetime}
                onChange={(e) => setProposedDatetime(e.target.value)}
              />
            </Field>
            <div className="md:col-span-2">
              <Field>
                <Label>Agenda (min. 15 characters)</Label>
                <Textarea required minLength={15} value={agenda} onChange={(e) => setAgenda(e.target.value)} />
              </Field>
            </div>
            <div>
              <Button type="submit">Submit Appointment Request</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>List &amp; History</CardHeader>
        <CardBody>
          {loading ? (
            <p className="text-text-muted">Loading...</p>
          ) : meetings.length === 0 ? (
            <EmptyState>No meetings yet.</EmptyState>
          ) : (
            <div className="space-y-3">
              {meetings.map((m) => (
                <div key={m.id} className="rounded-sm border border-border-muted p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm text-text-heading">
                        {new Date(m.proposed_datetime).toLocaleString()} &middot; {m.meeting_type}
                      </p>
                      <p className="mt-1 text-sm text-text-muted">{m.agenda}</p>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>

                  {m.meeting_link && m.status === "confirmed" && (
                    <a href={m.meeting_link} target="_blank" className="mt-2 block font-mono text-sm text-amber underline">
                      Join Google Meet Link
                    </a>
                  )}

                  {m.status === "rescheduled" && (
                    <div className="mt-3 rounded-sm border border-gold bg-gold/10 p-3">
                      <p className="text-sm text-gold">
                        Admin proposed rescheduling to {m.rescheduled_datetime && new Date(m.rescheduled_datetime).toLocaleString()}
                        {m.reschedule_reason && ` — ${m.reschedule_reason}`}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Button variant="secondary" onClick={() => acceptReschedule(m.id)}>
                          Accept Proposal
                        </Button>
                        <Input
                          type="datetime-local"
                          className="w-auto"
                          onChange={(e) => setCounterProposals((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        />
                        <Button variant="secondary" onClick={() => counterPropose(m.id)}>
                          Counter-Propose
                        </Button>
                      </div>
                    </div>
                  )}

                  {(m.status === "requested" || m.status === "confirmed") && (
                    <div className="mt-2">
                      <Button variant="ghost" onClick={() => cancelMeeting(m.id)}>
                        Cancel Request
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
