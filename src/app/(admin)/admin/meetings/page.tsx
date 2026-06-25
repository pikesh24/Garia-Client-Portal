"use client";

import { useEffect, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import { Meeting } from "@/lib/types";
import {
  Alert,
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  Input,
  Label,
  Modal,
  PageHeader,
  StatusBadge,
  Table,
  Td,
  Textarea,
  Th,
} from "@/components/ui";

export default function AdminMeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [active, setActive] = useState<Meeting | null>(null);
  const [meetingLink, setMeetingLink] = useState("");
  const [newDatetime, setNewDatetime] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await apiRequest<Meeting[]>("/api/admin/meetings");
    setMeetings(data);
  }

  useEffect(() => {
    load();
  }, []);

  function openDrawer(m: Meeting) {
    setActive(m);
    setMeetingLink(m.meeting_link ?? "");
    setNewDatetime("");
    setReason("");
    setError(null);
  }

  async function confirmSlot() {
    if (!active) return;
    try {
      await apiRequest(`/api/admin/meetings/${active.id}/confirm`, {
        method: "PATCH",
        body: { meeting_link: meetingLink },
      });
      setActive(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not confirm slot");
    }
  }

  async function rescheduleSlot() {
    if (!active) return;
    try {
      await apiRequest(`/api/admin/meetings/${active.id}/reschedule`, {
        method: "PATCH",
        body: { new_proposed_datetime: new Date(newDatetime).toISOString(), reason },
      });
      setActive(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not reschedule");
    }
  }

  async function overwriteMeeting() {
    if (!active) return;
    try {
      await apiRequest(`/api/admin/meetings/${active.id}`, {
        method: "PUT",
        body: {
          meeting_link: meetingLink,
          new_proposed_datetime: newDatetime ? new Date(newDatetime).toISOString() : null,
          reason,
        },
      });
      setActive(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not overwrite meeting");
    }
  }

  async function deleteMeeting() {
    if (!active) return;
    if (!confirm("Delete this meeting entirely?")) return;
    await apiRequest(`/api/admin/meetings/${active.id}`, { method: "DELETE" });
    setActive(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Unified Meetings Calendar" />
      <Card>
        <CardBody>
          {meetings.length === 0 ? (
            <EmptyState>No meetings yet.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Client</Th>
                  <Th>Type</Th>
                  <Th>Proposed</Th>
                  <Th>Status</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m) => (
                  <tr key={m.id}>
                    <Td className="font-mono">#{m.client_id}</Td>
                    <Td>{m.meeting_type}</Td>
                    <Td className="font-mono">{new Date(m.proposed_datetime).toLocaleString()}</Td>
                    <Td>
                      <StatusBadge status={m.status} />
                    </Td>
                    <Td>
                      <button className="text-amber underline" onClick={() => openDrawer(m)}>
                        Manage
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Modal open={!!active} onClose={() => setActive(null)} title={`Meeting #${active?.id ?? ""}`}>
        {error && <Alert>{error}</Alert>}
        <Field>
          <Label>Meeting Link</Label>
          <Input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} />
        </Field>
        <Button onClick={confirmSlot} className="mb-4">
          Confirm Meeting Slot Assignment
        </Button>

        <hr className="my-4 border-border-muted" />

        <Field>
          <Label>New Proposed Date/Time</Label>
          <Input type="datetime-local" value={newDatetime} onChange={(e) => setNewDatetime(e.target.value)} />
        </Field>
        <Field>
          <Label>Reason</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={rescheduleSlot}>
            Force Reschedule
          </Button>
          <Button variant="secondary" onClick={overwriteMeeting}>
            Force Master Update Overwrite
          </Button>
          <Button variant="danger" onClick={deleteMeeting}>
            Delete Appointment Entirely
          </Button>
        </div>
      </Modal>
    </div>
  );
}
