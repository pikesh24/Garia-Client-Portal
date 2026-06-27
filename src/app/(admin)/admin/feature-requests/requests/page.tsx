"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest, ApiError } from "@/lib/api";
import { FeatureRequest, FeatureRequestMessage } from "@/lib/types";
import { Alert, Button, Label, Modal, PageHeader, StatusBadge, Textarea } from "@/components/ui";
import { ChatDiscussion } from "@/components/ChatDiscussion";
import { useAdminProjectFilter } from "@/components/AdminProjectFilter";
import { ClientProjectCardPicker } from "@/components/ClientProjectCardPicker";

export default function AdminFeatureRequestsPage() {
  const [filter, setFilter] = useAdminProjectFilter();
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FeatureRequest | null>(null);

  async function load() {
    if (!filter.projectId) {
      setRequests([]);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<FeatureRequest[]>(`/api/admin/projects/${filter.projectId}/feature-requests`);
      setRequests(data);
      if (selected) setSelected(data.find((f) => f.id === selected.id) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not load feature requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [filter.projectId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feature Requests"
        action={
          <Link href="/admin/feature-requests" className="text-amber underline">
            ← Back to Features
          </Link>
        }
      />

      <ClientProjectCardPicker value={filter} onChange={setFilter} />

      {error && <Alert>{error}</Alert>}

      {!filter.projectId ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-bg-panel-alt border-4 border-dashed border-border-strong">
          <p className="font-data-mono text-data-mono text-text-muted uppercase tracking-widest">
            Select a client, then a project, to see its feature requests.
          </p>
        </div>
      ) : loading ? (
        <p className="text-text-muted">Loading...</p>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-bg-panel-alt border-4 border-dashed border-border-strong">
          <p className="font-data-mono text-data-mono text-text-muted uppercase tracking-widest">
            No feature requests yet for this project.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {requests.map((fr, i) => (
            <button
              key={fr.id}
              onClick={() => setSelected(fr)}
              className="text-left bg-bg-base border-4 border-border-strong p-card-padding relative overflow-hidden shadow-[8px_8px_0px_0px_var(--border-strong)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[12px_12px_0px_0px_var(--border-strong)] transition-all"
            >
              <span className="absolute -right-4 -bottom-10 opacity-10 pointer-events-none font-bg-numeral text-[10rem] text-text-main leading-none select-none">
                {String.fromCharCode(65 + (i % 26))}
              </span>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <span className="font-data-mono text-data-mono text-text-muted tracking-[0.1em]">
                    FRQ-{fr.id} <span className="opacity-60">(client {fr.client_id})</span>
                  </span>
                  <StatusBadge status={fr.status} />
                </div>
                <h3 className="font-headline-lg text-headline-lg font-black uppercase text-text-main mb-3 leading-tight">
                  {fr.name}
                </h3>
                <p className="text-sm text-text-muted line-clamp-2 mb-6">{fr.description}</p>
                <p className="font-data-mono text-data-mono text-xs text-text-muted tracking-[0.1em]">
                  {new Date(fr.created_at).toLocaleDateString()}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <AdminFeatureRequestDetail featureRequest={selected} onClose={() => setSelected(null)} onChanged={load} />
      )}
    </div>
  );
}

function AdminFeatureRequestDetail({
  featureRequest,
  onClose,
  onChanged,
}: {
  featureRequest: FeatureRequest;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<FeatureRequestMessage[]>(featureRequest.messages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    setMessages(featureRequest.messages);
  }, [featureRequest]);

  async function sendMessage() {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const message = await apiRequest<FeatureRequestMessage>(
        `/api/admin/feature-requests/${featureRequest.id}/messages`,
        { method: "POST", body: { body } }
      );
      setMessages((prev) => [...prev, message]);
      setBody("");
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not send message");
    } finally {
      setSending(false);
    }
  }

  async function setStatus(status: "approved" | "declined") {
    setUpdating(true);
    setError(null);
    try {
      await apiRequest(`/api/admin/feature-requests/${featureRequest.id}/status`, {
        method: "PATCH",
        body: { status },
      });
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not update status");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`FRQ-${featureRequest.id}: ${featureRequest.name}`}>
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}

        <div className="flex items-center justify-between">
          <span className="font-data-mono text-data-mono text-text-muted tracking-[0.1em]">
            Client {featureRequest.client_id}
          </span>
          <StatusBadge status={featureRequest.status} />
        </div>

        <p className="text-sm text-text-main whitespace-pre-wrap">{featureRequest.description}</p>

        <div className="flex flex-wrap gap-2">
          <Button disabled={updating} onClick={() => setStatus("approved")}>
            Approve
          </Button>
          <Button disabled={updating} variant="danger" onClick={() => setStatus("declined")}>
            Decline
          </Button>
        </div>

        <ChatDiscussion
          messages={messages}
          currentRole="admin"
          body={body}
          setBody={setBody}
          sendMessage={sendMessage}
          sending={sending}
        />
      </div>
    </Modal>
  );
}
