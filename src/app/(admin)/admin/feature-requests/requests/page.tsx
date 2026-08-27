"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiRequest, ApiError } from "@/lib/api";
import { FeatureRequest, FeatureRequestMessage } from "@/lib/types";
import { Alert, Button, Field, Input, Label, Modal, PageHeader, StatusBadge, Textarea } from "@/components/ui";
import { ChatDiscussion } from "@/components/ChatDiscussion";
import { useAdminProjectFilter } from "@/components/AdminProjectFilter";
import { ClientProjectCardPicker } from "@/components/ClientProjectCardPicker";
import { formatDate } from "@/lib/date";
import { useWsEvent } from "@/components/WebSocketProvider";
import { markFeatureRequestRead, useUnreadFeatureRequestIds } from "@/lib/unreadFeatureMessages";

function formatINR(amount: number | null): string {
  if (amount == null) return "—";
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function AdminFeatureRequestsPage() {
  const [filter, setFilter] = useAdminProjectFilter();
  const searchParams = useSearchParams();
  const featureIdParam = searchParams.get("featureId");
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FeatureRequest | null>(null);
  const featureRequestsVersion = useWsEvent("feature_requests");
  const unreadIds = useUnreadFeatureRequestIds();

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
      if (featureIdParam) {
        const match = data.find((f) => f.id === Number(featureIdParam));
        if (match) setSelected(match);
      }
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not load feature requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [filter.projectId, featureRequestsVersion]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feature Requests"
        action={
          <Link 
            href="/admin/feature-requests" 
            className="inline-flex items-center gap-2 font-label-caps text-xs font-black uppercase tracking-widest border-2 border-border-strong bg-bg-panel-alt px-6 py-3 text-text-main transition-all shadow-[4px_4px_0px_0px_var(--shadow-strong)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_var(--shadow-strong)] hover:bg-text-main hover:text-bg-base"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Back to Features
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
              {unreadIds.includes(fr.id) && (
                <span
                  className="absolute top-4 right-4 h-3 w-3 rounded-full bg-brand-green animate-pulse"
                  title="New message"
                />
              )}
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
                  {formatDate(fr.created_at)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <AdminFeatureRequestDetail
          featureRequest={selected}
          projectId={filter.projectId}
          onClose={() => setSelected(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function AdminFeatureRequestDetail({
  featureRequest,
  projectId,
  onClose,
  onChanged,
}: {
  featureRequest: FeatureRequest;
  projectId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<FeatureRequestMessage[]>(featureRequest.messages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [frontendHours, setFrontendHours] = useState(featureRequest.quoted_frontend_hours?.toString() ?? "");
  const [backendHours, setBackendHours] = useState(featureRequest.quoted_backend_hours?.toString() ?? "");
  const [productionHours, setProductionHours] = useState(featureRequest.quoted_production_hours?.toString() ?? "");
  const [savingHours, setSavingHours] = useState(false);

  const locked = featureRequest.status !== "under_review" && featureRequest.status !== "declined";
  const totalQuotedHours =
    (featureRequest.quoted_frontend_hours ?? 0) +
    (featureRequest.quoted_backend_hours ?? 0) +
    (featureRequest.quoted_production_hours ?? 0);

  useEffect(() => {
    setMessages(featureRequest.messages);
    setFrontendHours(featureRequest.quoted_frontend_hours?.toString() ?? "");
    setBackendHours(featureRequest.quoted_backend_hours?.toString() ?? "");
    setProductionHours(featureRequest.quoted_production_hours?.toString() ?? "");
    markFeatureRequestRead(featureRequest.id);
  }, [featureRequest]);

  async function saveHours() {
    setSavingHours(true);
    setError(null);
    try {
      await apiRequest(`/api/admin/projects/${projectId}/base-project/${featureRequest.id}`, {
        method: "PATCH",
        body: {
          quoted_frontend_hours: frontendHours ? Number(frontendHours) : null,
          quoted_backend_hours: backendHours ? Number(backendHours) : null,
          quoted_production_hours: productionHours ? Number(productionHours) : null,
        },
      });
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not save hours");
    } finally {
      setSavingHours(false);
    }
  }

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

        {featureRequest.status === "under_review" ? (
          <div className="bg-bg-panel-alt border-2 border-border-strong p-4 space-y-3">
            <div className="font-label-caps text-[10px] text-text-muted tracking-widest uppercase">
              Quoted Hours — required before this can be approved
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field>
                <Label>Frontend</Label>
                <Input
                  type="number"
                  min="0"
                  value={frontendHours}
                  onChange={(e) => setFrontendHours(e.target.value)}
                />
              </Field>
              <Field>
                <Label>Backend</Label>
                <Input
                  type="number"
                  min="0"
                  value={backendHours}
                  onChange={(e) => setBackendHours(e.target.value)}
                />
              </Field>
              <Field>
                <Label>Production</Label>
                <Input
                  type="number"
                  min="0"
                  value={productionHours}
                  onChange={(e) => setProductionHours(e.target.value)}
                />
              </Field>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-data-mono text-sm text-brand-green font-bold">
                {formatINR(featureRequest.price)}
              </span>
              <Button variant="secondary" disabled={savingHours} onClick={saveHours}>
                {savingHours ? "Saving..." : "Save Hours"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-bg-panel-alt border-2 border-border-strong p-4 flex items-center justify-between gap-3">
            <span className="font-data-mono text-xs text-text-muted uppercase tracking-widest">
              Hours (F/B/P): {featureRequest.quoted_frontend_hours ?? "—"} / {featureRequest.quoted_backend_hours ?? "—"} /{" "}
              {featureRequest.quoted_production_hours ?? "—"}
            </span>
            <span className="font-data-mono text-sm text-brand-green font-bold">
              {formatINR(featureRequest.price)}
            </span>
          </div>
        )}

        {featureRequest.status === "under_review" && (
          <div className="flex flex-wrap gap-2">
            <Button disabled={updating || totalQuotedHours <= 0} onClick={() => setStatus("approved")}>
              Approve
            </Button>
            <Button disabled={updating} variant="danger" onClick={() => setStatus("declined")}>
              Decline
            </Button>
          </div>
        )}

        <ChatDiscussion
          messages={messages}
          currentRole="admin"
          body={body}
          setBody={setBody}
          sendMessage={sendMessage}
          sending={sending}
          readOnly={locked}
        />
      </div>
    </Modal>
  );
}
