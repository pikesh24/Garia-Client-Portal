"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, apiRequest, ApiError, fileUrl, getAccessToken } from "@/lib/api";
import { Ticket } from "@/lib/types";
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
  StatusBadge,
  Textarea,
} from "@/components/ui";

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [hasFile, setHasFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const data = await apiRequest<Ticket[]>("/api/tickets");
    setTickets(data);
    setLoading(false);
    if (selected) {
      const updated = data.find((t) => t.id === selected.id);
      setSelected(updated ?? null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function fileTicket(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("An attachment is required to file an incident ticket");
      return;
    }
    const form = new FormData();
    form.append("description", description);
    form.append("file_upload", file);
    try {
      const res = await fetch(`${API_BASE_URL}/api/tickets`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        body: form,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new ApiError(res.status, data.detail);
      }
      setDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setHasFile(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not file ticket");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Support Ticket Center" />

      <Card>
        <CardHeader>New Incident Log</CardHeader>
        <CardBody>
          <form onSubmit={fileTicket}>
            {error && <Alert>{error}</Alert>}
            <Field>
              <Label>Description</Label>
              <Textarea required value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field>
              <Label>Attachment (required)</Label>
              <input
                ref={fileInputRef}
                type="file"
                required
                className="text-sm text-text-primary"
                onChange={(e) => setHasFile(!!e.target.files?.length)}
              />
            </Field>
            <Button type="submit" disabled={!hasFile}>
              File Incident Ticket
            </Button>
          </form>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>Ticket Directory</CardHeader>
          <CardBody>
            {loading ? (
              <p className="text-text-muted">Loading...</p>
            ) : tickets.length === 0 ? (
              <EmptyState>No tickets filed yet.</EmptyState>
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
                      <span className="font-mono text-sm text-text-heading">#{t.id}</span>
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
          <CardHeader>History Timeline</CardHeader>
          <CardBody>
            {!selected ? (
              <EmptyState>Select a ticket to view its timeline.</EmptyState>
            ) : (
              <div>
                <p className="mb-3 text-sm text-text-primary">{selected.description}</p>
                {selected.resolution_text && (
                  <div className="mb-3 rounded-sm border border-amber bg-amber/10 p-3 text-sm text-amber">
                    {selected.resolution_text}
                  </div>
                )}
                {selected.attachments.length > 0 && (
                  <div className="mb-3 grid grid-cols-3 gap-2">
                    {selected.attachments.map((a) => (
                      <a
                        key={a.id}
                        href={fileUrl(a.file_path)}
                        target="_blank"
                        className="truncate rounded-sm border border-border-muted px-2 py-1 text-xs text-amber underline"
                      >
                        {a.is_proof ? "Proof: " : ""}
                        {a.original_filename}
                      </a>
                    ))}
                  </div>
                )}
                <ol className="space-y-2 border-l border-border-muted pl-4">
                  {selected.status_history.map((h) => (
                    <li key={h.id} className="text-sm">
                      <span className="font-mono text-text-muted">
                        {new Date(h.created_at).toLocaleString()}
                      </span>{" "}
                      <StatusBadge status={h.status} />
                      {h.note && <span className="ml-2 text-text-primary">{h.note}</span>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
