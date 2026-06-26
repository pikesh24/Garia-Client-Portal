"use client";

import { useEffect, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import { FeatureRequest, FeatureRequestMessage, InfrastructureCostEntry, ProjectFeatures } from "@/lib/types";
import { Alert, Button, EmptyState, Modal, PageHeader, StatusBadge } from "@/components/ui";
import { ChatDiscussion } from "@/components/ChatDiscussion";

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function ProjectFeaturesPage() {
  const [features, setFeatures] = useState<ProjectFeatures | null>(null);
  const [services, setServices] = useState<InfrastructureCostEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [challenging, setChallenging] = useState<FeatureRequest | null>(null);

  async function load() {
    const [featureData, serviceData] = await Promise.all([
      apiRequest<ProjectFeatures>("/api/project-features"),
      apiRequest<InfrastructureCostEntry[]>("/api/maintenance/infrastructure-costs"),
    ]);
    setFeatures(featureData);
    setServices(serviceData);
    if (challenging) {
      const updated = [...featureData.base_features, ...featureData.extra_features].find(
        (f) => f.id === challenging.id
      );
      setChallenging(updated ?? null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(fr: FeatureRequest) {
    setError(null);
    try {
      await apiRequest(`/api/feature-requests/${fr.id}/approve`, {
        method: "POST",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not approve feature");
    }
  }

  async function decline(fr: FeatureRequest) {
    setError(null);
    try {
      await apiRequest(`/api/feature-requests/${fr.id}/decline-base-feature`, {
        method: "POST",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not decline feature");
    }
  }

  async function openChallenge(fr: FeatureRequest) {
    setError(null);
    try {
      await apiRequest(`/api/feature-requests/${fr.id}/challenge`, { method: "POST" });
      await load();
      setChallenging(fr);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not open challenge");
    }
  }

  function renderFeatureCard(fr: FeatureRequest) {
    const featureServices = services.filter((s) => s.feature_request_id === fr.id);
    const needsApproval =
      fr.is_base_feature && !fr.base_feature_activated && fr.status !== "declined";
    const challengeOpen = fr.challenge_status === "open";

    return (
      <div key={fr.id} className="border-4 border-border-strong bg-bg-base p-8 shadow-[8px_8px_0px_0px_var(--border-strong)] relative transition-all mb-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6 border-b-2 border-border-strong pb-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="font-data-mono text-xs uppercase tracking-widest text-text-muted bg-bg-panel-alt px-2 py-1 border border-border-strong">
                ID: #{fr.id} {fr.feature_id ? `· ${fr.feature_id}` : ""}
              </span>
              <StatusBadge status={needsApproval ? "pending" : fr.status} />
            </div>
            <h4 className="font-headline-lg text-2xl font-black uppercase text-text-main leading-tight mb-2">
              {fr.name}
            </h4>
            <p className="text-sm text-text-muted max-w-3xl whitespace-pre-wrap">{fr.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 gap-4 bg-bg-panel-alt p-4 border-2 border-border-strong mb-6">
          <div>
            <div className="font-label-caps text-[10px] text-text-muted tracking-widest uppercase mb-1">Hours (F / B / P)</div>
            <div className="font-data-mono text-sm text-text-main font-bold">
              {fr.quoted_frontend_hours ?? "—"} / {fr.quoted_backend_hours ?? "—"} / {fr.quoted_production_hours ?? "—"}
            </div>
          </div>
          <div>
            <div className="font-label-caps text-[10px] text-text-muted tracking-widest uppercase mb-1">Agreement Date</div>
            <div className="font-data-mono text-sm text-text-main font-bold">{fr.agreement_date ?? "—"}</div>
          </div>
        </div>

        {featureServices.length > 0 && (
          <div className="border-t-2 border-dashed border-border-strong pt-4 mt-2">
            <div className="font-label-caps text-[10px] text-text-muted tracking-widest uppercase mb-3">
              External Services ({featureServices.length})
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {featureServices.map((s) => (
                <div key={s.id} className="bg-bg-panel-alt border border-border-strong p-3 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-sm text-text-main">{s.module}</div>
                    {s.description && <div className="text-xs text-text-muted mt-1">{s.description}</div>}
                  </div>
                  <div className="font-data-mono text-xs text-coral-red font-bold shrink-0 text-right">
                    {formatINR(s.monthly_overhead_price)}<span className="text-[10px] text-text-muted block md:inline md:ml-1">/mo</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {fr.is_base_feature && (
          <div className="mt-6 border-t-2 border-dashed border-border-strong pt-4 flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => (challengeOpen ? setChallenging(fr) : openChallenge(fr))}
            >
              {challengeOpen ? "View Challenge" : "Challenge"}
            </Button>
          </div>
        )}

        {needsApproval && (
          <div className="mt-6 border-4 border-coral-red bg-coral-red/5 p-6 shadow-[4px_4px_0px_0px_var(--coral-red)]">
            <p className="text-sm font-bold text-coral-red mb-2 uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">warning</span>
              Approval Required
            </p>
            <p className="text-sm text-text-main mb-4 font-bold">
              This feature requires your review. Approve to accept the stated hours and scope, or decline it.
            </p>
            <div className="flex items-center gap-4">
              <Button onClick={() => approve(fr)}>Approve Feature</Button>
              <Button variant="danger" onClick={() => decline(fr)}>
                Decline Feature
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!features) return <p className="text-text-muted">Loading...</p>;

  return (
    <div className="space-y-12">
      <PageHeader title="Project Features Overview" />
      {error && <Alert>{error}</Alert>}

      <div>
        <h3 className="font-display-xl text-3xl font-black uppercase text-text-main mb-6 border-b-4 border-border-strong pb-4">
          Core Base Features
        </h3>
        {features.base_features.length === 0 ? (
          <EmptyState>No core base features assigned yet.</EmptyState>
        ) : (
          <div className="space-y-6">
            {features.base_features.map(renderFeatureCard)}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-display-xl text-3xl font-black uppercase text-text-main mb-6 border-b-4 border-border-strong pb-4">
          Extra Features (Client Requested)
        </h3>
        {features.extra_features.length === 0 ? (
          <EmptyState>No extra features requested yet.</EmptyState>
        ) : (
          <div className="space-y-6">
            {features.extra_features.map(renderFeatureCard)}
          </div>
        )}
      </div>

      {challenging && <ChallengeModal featureRequest={challenging} onClose={() => setChallenging(null)} onChanged={load} />}
    </div>
  );
}

function ChallengeModal({
  featureRequest,
  onClose,
  onChanged,
}: {
  featureRequest: FeatureRequest;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [messages, setMessages] = useState<FeatureRequestMessage[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMessages() {
    try {
      const data = await apiRequest<FeatureRequestMessage[]>(
        `/api/feature-requests/${featureRequest.id}/challenge-messages`
      );
      setMessages(data);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not load challenge messages");
    }
  }

  useEffect(() => {
    loadMessages();
  }, [featureRequest.id]);

  async function sendMessage() {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const message = await apiRequest<FeatureRequestMessage>(
        `/api/feature-requests/${featureRequest.id}/challenge-messages`,
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

  return (
    <Modal open onClose={onClose} title={`Challenge: ${featureRequest.name}`}>
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <div className="flex items-center justify-between">
          <StatusBadge status={featureRequest.challenge_status} />
        </div>
        <p className="text-sm text-text-muted">
          Discuss your concerns about this feature&apos;s scope or hours with the admin below. The admin will
          approve or deny this challenge after reviewing.
        </p>
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
