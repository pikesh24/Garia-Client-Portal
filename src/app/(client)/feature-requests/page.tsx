"use client";

import { useEffect, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import { FeatureRequest, FeatureRequestMessage } from "@/lib/types";
import {
  Alert,
  Button,
  Field,
  Input,
  Label,
  Modal,
  StatusBadge,
  Table,
  Td,
  Textarea,
  Th,
} from "@/components/ui";
import { ChatDiscussion } from "@/components/ChatDiscussion";

export default function FeatureRequestsPage() {
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [selected, setSelected] = useState<FeatureRequest | null>(null);

  async function load() {
    try {
      const data = await apiRequest<FeatureRequest[]>("/api/feature-requests");
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
  }, []);

  async function createRequest(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    try {
      await apiRequest("/api/feature-requests", { method: "POST", body: { name, description } });
      setName("");
      setDescription("");
      setShowCreate(false);
      await load();
    } catch (err) {
      setCreateError(err instanceof ApiError ? String(err.detail) : "Could not create feature request");
    }
  }

  return (
    <div className="space-y-6">
      <div className="mb-12 border-b-4 border-border-strong pb-8 flex flex-col md:flex-row md:items-end justify-between">
        <div>
          <p className="font-label-caps text-label-caps tracking-[0.1em] uppercase text-coral-red font-bold mb-2">
            Backlog &middot; Intake
          </p>
          <h2 className="font-display-2xl text-display-2xl font-black uppercase text-text-main leading-none">
            Feature<br />Requests
          </h2>
        </div>
        <div className="mt-6 md:mt-0">
          <Button onClick={() => setShowCreate(true)}>+ Request Feature</Button>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <p className="text-text-muted">Loading...</p>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-bg-panel-alt border-4 border-dashed border-border-strong">
          <p className="font-data-mono text-data-mono text-text-muted uppercase tracking-widest">
            No feature requests yet.
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
                    FRQ-{fr.id}
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

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Request a Feature">
        <form onSubmit={createRequest}>
          {createError && <Alert>{createError}</Alert>}
          <Field>
            <Label>Name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field>
            <Label>Description</Label>
            <Textarea required rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Button type="submit">Submit Feature Request</Button>
        </form>
      </Modal>

      {selected && (
        <FeatureRequestDetail featureRequest={selected} onClose={() => setSelected(null)} onChanged={load} />
      )}
    </div>
  );
}

function FeatureRequestDetail({
  featureRequest,
  onClose,
  onChanged,
}: {
  featureRequest: FeatureRequest;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(featureRequest.name);
  const [description, setDescription] = useState(featureRequest.description);
  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<FeatureRequestMessage[]>(featureRequest.messages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setName(featureRequest.name);
    setDescription(featureRequest.description);
    setMessages(featureRequest.messages);
    setEditing(false);
  }, [featureRequest]);

  async function resubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest(`/api/feature-requests/${featureRequest.id}`, { method: "PUT", body: { name, description } });
      setEditing(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not resubmit feature request");
    }
  }

  async function sendMessage() {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const message = await apiRequest<FeatureRequestMessage>(`/api/feature-requests/${featureRequest.id}/messages`, {
        method: "POST",
        body: { body },
      });
      setMessages((prev) => [...prev, message]);
      setBody("");
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`FRQ-${featureRequest.id}: ${featureRequest.name}`}>
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}

        <div className="flex items-center justify-between">
          <StatusBadge status={featureRequest.status} />
          <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel Edit" : "Edit"}
          </Button>
        </div>

        {editing ? (
          <form onSubmit={resubmit} className="space-y-4">
            <Field>
              <Label>Name</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field>
              <Label>Description</Label>
              <Textarea required rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Button type="submit">Resubmit Feature Request</Button>
          </form>
        ) : (
          <p className="text-sm text-text-main whitespace-pre-wrap">{featureRequest.description}</p>
        )}

        <ChatDiscussion
          messages={messages}
          currentRole="client"
          body={body}
          setBody={setBody}
          sendMessage={sendMessage}
          sending={sending}
        />
      </div>
    </Modal>
  );
}
