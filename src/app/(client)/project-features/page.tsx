"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest, ApiError } from "@/lib/api";
import { FeatureRequest, FeatureRequestMessage, InfrastructureCostEntry, ProjectFeatures } from "@/lib/types";
import { Alert, Button, EmptyState, Modal, PageHeader, StatusBadge } from "@/components/ui";
import { ChatDiscussion } from "@/components/ChatDiscussion";
import { useProject } from "@/lib/project-context";
import { formatDate } from "@/lib/date";
import { useWsEvent } from "@/components/WebSocketProvider";
import { markFeatureRequestRead, useUnreadFeatureRequestIds } from "@/lib/unreadFeatureMessages";

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function ProjectFeaturesPage() {
  const { currentProject } = useProject();
  const searchParams = useSearchParams();
  const focusFeatureId = searchParams.get("featureId");
  const [features, setFeatures] = useState<ProjectFeatures | null>(null);
  const [services, setServices] = useState<InfrastructureCostEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [challenging, setChallenging] = useState<FeatureRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const featureRequestsVersion = useWsEvent("feature_requests");
  const maintenanceVersion = useWsEvent("maintenance");
  const unreadIds = useUnreadFeatureRequestIds();
  const autoOpenedFeatureId = useRef<string | null>(null);

  async function load() {
    if (!currentProject) {
      setLoading(false);
      return;
    }
    const [featureData, serviceData] = await Promise.all([
      apiRequest<ProjectFeatures>(`/api/projects/${currentProject.id}/project-features`),
      apiRequest<InfrastructureCostEntry[]>(`/api/projects/${currentProject.id}/maintenance/infrastructure-costs`),
    ]);
    setFeatures(featureData);
    setServices(serviceData);
    setLoading(false);
    if (challenging) {
      const updated = [...featureData.base_features, ...featureData.extra_features].find(
        (f) => f.id === challenging.id
      );
      setChallenging(updated ?? null);
    }
  }

  useEffect(() => {
    load();
  }, [currentProject?.id, featureRequestsVersion, maintenanceVersion]);

  useEffect(() => {
    if (!focusFeatureId || !features) return;
    if (autoOpenedFeatureId.current === focusFeatureId) return;
    const match = [...features.base_features, ...features.extra_features].find(
      (f) => f.id === Number(focusFeatureId)
    );
    if (match && match.challenge_status !== "none") {
      autoOpenedFeatureId.current = focusFeatureId;
      setChallenging(match);
    }
  }, [focusFeatureId, features]);

  async function approve(fr: FeatureRequest) {
    if (!currentProject) return;
    setError(null);
    try {
      await apiRequest(`/api/projects/${currentProject.id}/feature-requests/${fr.id}/approve`, {
        method: "POST",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not approve feature");
    }
  }

  async function decline(fr: FeatureRequest) {
    if (!currentProject) return;
    setError(null);
    try {
      await apiRequest(`/api/projects/${currentProject.id}/feature-requests/${fr.id}/decline-base-feature`, {
        method: "POST",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not decline feature");
    }
  }

  async function openChallenge(fr: FeatureRequest) {
    if (!currentProject) return;
    setError(null);
    try {
      await apiRequest(`/api/projects/${currentProject.id}/feature-requests/${fr.id}/challenge`, { method: "POST" });
      await load();
      setChallenging(fr);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not open challenge");
    }
  }

  function renderFeatureCard(fr: FeatureRequest, type: "base" | "extra") {
    const featureServices = services.filter((s) => s.feature_request_id === fr.id);
    const needsApproval =
      fr.is_base_feature && !fr.base_feature_activated && fr.status !== "declined";
    const challengeOpen = fr.challenge_status === "open";
    const challengeDecided = fr.challenge_status === "approved" || fr.challenge_status === "denied";

    const isExtra = type === "extra";
    const cardBorderColor = "border-border-strong";
    const cardShadow = "shadow-[8px_8px_0px_0px_var(--shadow-strong)]";
    const cardBg = "bg-bg-base";

    return (
      <div key={fr.id} className={`border-4 ${cardBorderColor} ${cardBg} p-8 ${cardShadow} relative transition-all mb-12 hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[12px_12px_0px_0px_var(--shadow-strong)]`}>
        {unreadIds.includes(fr.id) && (
          <span
            className="absolute top-4 right-4 h-3 w-3 rounded-full bg-brand-green animate-pulse z-10"
            title="New message"
          />
        )}
        {isExtra && (
          <div className="absolute -top-5 -right-5 md:-top-6 md:-right-6 rotate-3">
             <span className="bg-coral-red text-white font-data-mono text-xs font-black uppercase tracking-widest px-4 py-2 border-4 border-border-strong shadow-[4px_4px_0px_0px_var(--shadow-strong)]">
               EXTRA FEATURE
             </span>
          </div>
        )}
        
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8 border-b-4 border-border-strong pb-6">
          <div className="w-full">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <span className="font-data-mono text-xs font-black uppercase tracking-widest px-3 py-1 border-2 border-border-strong bg-text-main text-bg-base">
                {fr.feature_id ? `${fr.feature_id}` : `ID: #${fr.id}`}
              </span>
              <div className="flex flex-col items-end">
                <span className="font-data-mono text-[9px] text-text-muted font-bold tracking-widest uppercase mb-1">CURRENT STATUS</span>
                <div className="scale-110 origin-right">
                  <StatusBadge status={needsApproval ? "pending" : fr.status} />
                </div>
              </div>
            </div>
            <h4 className="font-headline-lg text-3xl font-black uppercase leading-tight mb-3 text-text-main">
              {fr.name}
            </h4>
            <p className="text-base text-text-main font-medium max-w-3xl whitespace-pre-wrap leading-relaxed">{fr.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-bg-panel-alt p-6 border-4 border-border-strong mb-6 shadow-[4px_4px_0px_0px_var(--shadow-strong)]">
          <div className="border-l-4 border-border-strong pl-4">
            <div className="font-data-mono text-[9px] text-text-muted font-black tracking-widest uppercase mb-1">HOURS (Frontend / Backend / Production)</div>
            <div className="font-display-xl text-xl text-text-main font-black">
              {fr.quoted_frontend_hours ?? "—"} / {fr.quoted_backend_hours ?? "—"} / {fr.quoted_production_hours ?? "—"}
            </div>
          </div>
          <div className="border-l-4 border-border-strong pl-4">
            <div className="font-data-mono text-[10px] text-text-muted font-black tracking-widest uppercase mb-1">AGREEMENT DATE</div>
            <div className="font-display-xl text-xl text-text-main font-black">{formatDate(fr.agreement_date)}</div>
          </div>
          <div className="border-l-4 border-brand-green pl-4">
            <div className="font-data-mono text-[10px] text-brand-green font-black tracking-widest uppercase mb-1">PRICE</div>
            <div className="font-display-xl text-2xl text-brand-green font-black">{fr.price != null ? formatINR(fr.price) : "—"}</div>
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
                  <div className="font-data-mono text-xs text-brand-green font-bold shrink-0 text-right">
                    {formatINR(s.monthly_overhead_price)}<span className="text-[10px] text-text-muted block md:inline md:ml-1">/mo</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {needsApproval && (
          <div className="mt-8 border-4 border-brand-green bg-brand-green p-6 md:p-8 shadow-[8px_8px_0px_0px_var(--shadow-strong)]">
            <p className="text-xl font-black text-bg-base mb-3 uppercase tracking-widest flex items-center gap-3">
              <span className="material-symbols-outlined text-3xl text-bg-base">check_circle</span>
              ACTION REQUIRED: APPROVE SCOPE
            </p>
            <p className="text-base text-bg-base/90 mb-6 font-bold max-w-3xl">
              This feature specification is ready for your review. Please confirm the hours and pricing to proceed with development.
            </p>
            {fr.is_base_feature && (
              <div className={`bg-bg-base border-4 ${challengeDecided ? (fr.challenge_status === 'approved' ? 'border-brand-green' : 'border-coral-red') : 'border-border-strong'} p-4 mb-6 shadow-[4px_4px_0px_0px_var(--shadow-strong)]`}>
                {challengeOpen ? (
                  <p className="text-sm text-text-main font-bold flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber mt-0.5">forum</span>
                    <span>You have an open <strong className="text-amber uppercase">Challenge</strong> for this feature. Please wait for the admin to review it.</span>
                  </p>
                ) : challengeDecided ? (
                  <p className="text-sm text-text-main font-bold flex items-start gap-2">
                    <span className={`material-symbols-outlined mt-0.5 ${fr.challenge_status === 'approved' ? 'text-brand-green' : 'text-coral-red'}`}>
                      {fr.challenge_status === 'approved' ? 'check_circle' : 'cancel'}
                    </span>
                    <span>Your challenge has been <strong className={`uppercase ${fr.challenge_status === 'approved' ? 'text-brand-green' : 'text-coral-red'}`}>{fr.challenge_status}</strong>. Please review the discussion and decide how to proceed.</span>
                  </p>
                ) : (
                  <p className="text-sm text-text-main font-bold flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber mt-0.5">help</span>
                    <span>Not sure about the scope or price? Open a <strong className="text-amber uppercase">Challenge</strong> to discuss it with the admin before deciding.</span>
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-4">
              <Button onClick={() => approve(fr)} className="bg-bg-base text-brand-green hover:bg-bg-panel-alt border-bg-base hover:border-bg-base font-black">
                APPROVE FEATURE
              </Button>
              {fr.is_base_feature && (
                <Button
                  variant="secondary"
                  onClick={() => (challengeOpen || challengeDecided ? setChallenging(fr) : openChallenge(fr))}
                >
                  {challengeDecided ? "View Challenge" : "Challenge"}
                </Button>
              )}
              <Button variant="danger" onClick={() => decline(fr)} className="bg-bg-base text-coral-red border-bg-base hover:border-bg-base shadow-[4px_4px_0px_0px_var(--shadow-strong)] hover:bg-coral-red hover:text-white font-bold">
                DECLINE
              </Button>
            </div>
          </div>
        )}

        {fr.is_base_feature && !needsApproval && (
          <div className="mt-8 pt-6 flex flex-wrap items-center gap-4">
            <Button
              variant="secondary"
              onClick={() => (challengeOpen || challengeDecided ? setChallenging(fr) : openChallenge(fr))}
            >
              {challengeOpen || challengeDecided ? "View Challenge" : "Challenge"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="space-y-12">
        <PageHeader title="Project Features Overview" />
        <EmptyState>No project assigned yet.</EmptyState>
      </div>
    );
  }

  if (loading || !features) return <p className="text-text-muted">Loading...</p>;

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
            {features.base_features.map(f => renderFeatureCard(f, "base"))}
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
          <div className="space-y-6 mt-12">
            {features.extra_features.map(f => renderFeatureCard(f, "extra"))}
          </div>
        )}
      </div>

      {challenging && (
        <ChallengeModal
          projectId={currentProject.id}
          featureRequest={challenging}
          onClose={() => setChallenging(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function ChallengeModal({
  projectId,
  featureRequest,
  onClose,
  onChanged,
}: {
  projectId: number;
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
        `/api/projects/${projectId}/feature-requests/${featureRequest.id}/challenge-messages`
      );
      setMessages(data);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not load challenge messages");
    }
  }

  useEffect(() => {
    loadMessages();
    markFeatureRequestRead(featureRequest.id);
  }, [featureRequest.id]);

  async function sendMessage() {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const message = await apiRequest<FeatureRequestMessage>(
        `/api/projects/${projectId}/feature-requests/${featureRequest.id}/challenge-messages`,
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
          readOnly={featureRequest.challenge_status !== "open"}
        />
      </div>
    </Modal>
  );
}
