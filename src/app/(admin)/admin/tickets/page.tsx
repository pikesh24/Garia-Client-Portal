"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, apiRequest, ApiError, fileUrl, getAccessToken } from "@/lib/api";
import { Ticket, TicketStatus } from "@/lib/types";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Label,
  PageHeader,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui";

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [statusToggle, setStatusToggle] = useState<TicketStatus>("in_progress");
  const [note, setNote] = useState("");
  const [resolutionText, setResolutionText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const data = await apiRequest<Ticket[]>("/api/admin/tickets");
    setTickets(data);
    if (selected) {
      setSelected(data.find((t) => t.id === selected.id) ?? null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus() {
    if (!selected) return;
    setError(null);
    const form = new FormData();
    form.append("status_toggle", statusToggle);
    if (note) form.append("note", note);
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
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not update status");
    }
  }

  async function resolveTicket() {
    if (!selected) return;
    setError(null);
    const form = new FormData();
    form.append("resolution_text", resolutionText);
    const proofFile = proofInputRef.current?.files?.[0];
    if (proofFile) form.append("proof_attachments", proofFile);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/tickets/${selected.id}/resolve`, {
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
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not resolve ticket");
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
    <div className="space-y-6">
      <PageHeader title="Support Ticket Evaluation" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>Ticket Directory</CardHeader>
          <CardBody>
            {tickets.length === 0 ? (
              <EmptyState>No tickets filed.</EmptyState>
            ) : (
              <div className="space-y-2">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className={`block w-full rounded-sm border p-3 text-left ${
                      selected?.id === t.id ? "border-amber" : "border-border-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm text-text-heading">
                        #{t.id} (client {t.client_id})
                      </span>
                      <StatusBadge status={t.status} />
                    </div>
                    <p className="mt-1 truncate text-sm text-text-muted">{t.description}</p>
                  </button>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>Ticket Analysis & Resolution</CardHeader>
          <CardBody>
            {!selected ? (
              <EmptyState>Select a ticket.</EmptyState>
            ) : (
              <div className="space-y-4">
                {error && <Alert>{error}</Alert>}
                <p className="text-sm text-text-primary">{selected.description}</p>
                <div className="grid grid-cols-3 gap-2">
                  {selected.attachments.map((a) => (
                    <a
                      key={a.id}
                      href={fileUrl(a.file_path)}
                      target="_blank"
                      className="truncate rounded-sm border border-border-muted px-2 py-1 text-xs text-amber underline"
                    >
                      {a.original_filename}
                    </a>
                  ))}
                </div>

                <div className="rounded-sm border border-border-muted p-3">
                  <Field>
                    <Label>Status</Label>
                    <Select value={statusToggle} onChange={(e) => setStatusToggle(e.target.value as TicketStatus)}>
                      <option value="in_progress">In Progress</option>
                      <option value="out_of_scope">Out of Scope</option>
                    </Select>
                  </Field>
                  <Field>
                    <Label>Note</Label>
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
                  </Field>
                  <Button onClick={updateStatus}>Update Ticket Status State</Button>
                </div>

                <div className="rounded-sm border border-amber/40 p-3">
                  <Field>
                    <Label>Resolution Text</Label>
                    <Textarea value={resolutionText} onChange={(e) => setResolutionText(e.target.value)} />
                  </Field>
                  <Field>
                    <Label>Proof Attachment</Label>
                    <input ref={proofInputRef} type="file" className="text-sm text-text-primary" />
                  </Field>
                  <Button onClick={resolveTicket}>Authorize Final Bug Resolution Sign-off</Button>
                </div>

                <Button variant="danger" onClick={eraseTicket}>
                  Erase Support Incident History Maps
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
