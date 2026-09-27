"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest, ApiError, formatApiError } from "@/lib/api";
import { FeatureRequest, FeatureRequestMessage, InfrastructureCostEntry, Project, User } from "@/lib/types";
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
  Modal,
  StatusBadge,
  Textarea,
  Toggle,
} from "@/components/ui";
import { ChatDiscussion } from "@/components/ChatDiscussion";
import { BrutalistDatePicker } from "@/components/BrutalistDatePicker";
import { formatDate } from "@/lib/date";
import { useWsEvent } from "@/components/WebSocketProvider";
import { markFeatureRequestRead, useUnreadFeatureRequestIds } from "@/lib/unreadFeatureMessages";

function formatINR(amount: number | null): string {
  if (amount == null) return "—";
  return `₹${amount.toLocaleString("en-IN")}`;
}

const emptyDraft = {
  feature_id: "",
  name: "",
  description: "",
  is_base_feature: true,
  quoted_frontend_hours: "",
  quoted_backend_hours: "",
  quoted_production_hours: "",
  agreement_date: "",
};

const emptyServiceDraft = { name: "", description: "", recurring_cost: "" };
type ServiceDraft = typeof emptyServiceDraft;

const WHOLE_HOURS_ERROR = "Hours must be whole numbers.";

function hasFractionalHours(d: typeof emptyDraft): boolean {
  return [d.quoted_frontend_hours, d.quoted_backend_hours, d.quoted_production_hours].some(
    (h) => h !== "" && !Number.isInteger(Number(h))
  );
}

function computeLivePrice(project: Project, d: typeof emptyDraft): number {
  return (
    Number(d.quoted_frontend_hours || 0) * (project.hourly_rate_frontend ?? 0) +
    Number(d.quoted_backend_hours || 0) * (project.hourly_rate_backend ?? 0) +
    Number(d.quoted_production_hours || 0) * (project.hourly_rate_production ?? 0)
  );
}

export function BaseProjectSection({
  projectId,
  client,
  project,
}: {
  projectId: string;
  client: User;
  project: Project;
}) {
  const searchParams = useSearchParams();
  const focusFeatureId = searchParams.get("featureId");
  const [features, setFeatures] = useState<FeatureRequest[] | null>(null);
  const [services, setServices] = useState<InfrastructureCostEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [serviceDrafts, setServiceDrafts] = useState<ServiceDraft[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<typeof emptyDraft | null>(null);
  const [newServiceByFeature, setNewServiceByFeature] = useState<Record<number, ServiceDraft>>({});
  // Track only the id so the modal always reflects the latest loaded feature (e.g. its challenge status).
  const [reviewingChallengeId, setReviewingChallengeId] = useState<number | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
  const [editServiceDraft, setEditServiceDraft] = useState<ServiceDraft | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmingCompletionFor, setConfirmingCompletionFor] = useState<FeatureRequest | null>(null);
  const featureRequestsVersion = useWsEvent("feature_requests");
  const maintenanceVersion = useWsEvent("maintenance");
  const unreadIds = useUnreadFeatureRequestIds();

  async function load() {
    const [featureData, serviceData] = await Promise.all([
      apiRequest<FeatureRequest[]>(`/api/admin/projects/${projectId}/base-project`),
      apiRequest<InfrastructureCostEntry[]>(`/api/admin/maintenance/infrastructure-costs?client_id=${client.id}`),
    ]);
    setFeatures(featureData);
    setServices(serviceData);
  }

  useEffect(() => {
    load();
  }, [projectId, featureRequestsVersion, maintenanceVersion]);

  const autoOpenedFeatureId = useRef<string | null>(null);

  useEffect(() => {
    if (!focusFeatureId || !features) return;
    if (autoOpenedFeatureId.current === focusFeatureId) return;
    const match = features.find((f) => f.id === Number(focusFeatureId));
    if (match && match.challenge_status !== "none") {
      autoOpenedFeatureId.current = focusFeatureId;
      setReviewingChallengeId(match.id);
    }
  }, [focusFeatureId, features]);

  function toPayload(d: typeof emptyDraft) {
    return {
      feature_id: d.feature_id || null,
      name: d.name,
      description: d.description,
      is_base_feature: d.is_base_feature,
      quoted_frontend_hours: d.quoted_frontend_hours ? Number(d.quoted_frontend_hours) : null,
      quoted_backend_hours: d.quoted_backend_hours ? Number(d.quoted_backend_hours) : null,
      quoted_production_hours: d.quoted_production_hours ? Number(d.quoted_production_hours) : null,
      agreement_date: d.agreement_date || null,
    };
  }

  async function createExternalService(featureRequestId: number, service: ServiceDraft) {
    await apiRequest("/api/admin/maintenance/infrastructure-costs", {
      method: "POST",
      body: {
        client_id: client.id,
        project_id: Number(projectId),
        feature_request_id: featureRequestId,
        module: service.name,
        description: service.description || null,
        monthly_overhead_price: Number(service.recurring_cost || 0),
      },
    });
  }

  async function createFeature(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (hasFractionalHours(draft)) {
      setError(WHOLE_HOURS_ERROR);
      return;
    }
    try {
      const fr = await apiRequest<FeatureRequest>(`/api/admin/projects/${projectId}/base-project`, {
        method: "POST",
        body: toPayload(draft),
      });
      for (const service of serviceDrafts) {
        if (service.name.trim()) await createExternalService(fr.id, service);
      }
      setDraft(emptyDraft);
      setServiceDrafts([]);
      setShowAddForm(false);
      await load();
    } catch (err) {
      setError(formatApiError(err, "Could not create feature"));
    }
  }

  async function addServiceToFeature(featureId: number) {
    const service = newServiceByFeature[featureId] ?? emptyServiceDraft;
    if (!service.name.trim()) return;
    setError(null);
    try {
      await createExternalService(featureId, service);
      setNewServiceByFeature((prev) => ({ ...prev, [featureId]: emptyServiceDraft }));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not add external service");
    }
  }

  async function deleteService(id: number) {
    setError(null);
    try {
      await apiRequest(`/api/admin/maintenance/infrastructure-costs/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not remove external service");
    }
  }

  function startEditService(s: InfrastructureCostEntry) {
    setEditingServiceId(s.id);
    setEditServiceDraft({
      name: s.module,
      description: s.description ?? "",
      recurring_cost: String(s.monthly_overhead_price),
    });
  }

  async function saveServiceEdit(id: number) {
    if (!editServiceDraft) return;
    setError(null);
    try {
      await apiRequest(`/api/admin/maintenance/infrastructure-costs/${id}`, {
        method: "PATCH",
        body: {
          module: editServiceDraft.name,
          description: editServiceDraft.description || null,
          monthly_overhead_price: Number(editServiceDraft.recurring_cost || 0),
        },
      });
      setEditingServiceId(null);
      setEditServiceDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not update external service");
    }
  }

  function startEdit(fr: FeatureRequest) {
    setEditingId(fr.id);
    setEditDraft({
      feature_id: fr.feature_id ?? "",
      name: fr.name,
      description: fr.description,
      is_base_feature: fr.is_base_feature,
      quoted_frontend_hours: fr.quoted_frontend_hours?.toString() ?? "",
      quoted_backend_hours: fr.quoted_backend_hours?.toString() ?? "",
      quoted_production_hours: fr.quoted_production_hours?.toString() ?? "",
      agreement_date: fr.agreement_date ?? "",
    });
  }

  async function saveEdit(id: number) {
    if (!editDraft) return;
    setError(null);
    if (hasFractionalHours(editDraft)) {
      setError(WHOLE_HOURS_ERROR);
      return;
    }
    try {
      await apiRequest(`/api/admin/projects/${projectId}/base-project/${id}`, {
        method: "PATCH",
        body: toPayload(editDraft),
      });
      setEditingId(null);
      setEditDraft(null);
      await load();
    } catch (err) {
      setError(formatApiError(err, "Could not update feature"));
    }
  }

  async function markInProgress(fr: FeatureRequest) {
    setError(null);
    try {
      await apiRequest(`/api/admin/feature-requests/${fr.id}/start`, { method: "PATCH" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not mark feature in progress");
    }
  }

  async function confirmHoursMatch(fr: FeatureRequest) {
    const totalQuotedHours =
      (fr.quoted_frontend_hours ?? 0) + (fr.quoted_backend_hours ?? 0) + (fr.quoted_production_hours ?? 0);
    if (totalQuotedHours <= 0) {
      setError("Enter the hours spent on this feature before marking it completed.");
      setConfirmingCompletionFor(null);
      startEdit(fr);
      return;
    }
    setError(null);
    try {
      await apiRequest(`/api/admin/feature-requests/${fr.id}/complete`, {
        method: "PATCH",
        body: { actual_hours_taken: totalQuotedHours },
      });
      setConfirmingCompletionFor(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not mark feature completed");
    }
  }

  function hoursDontMatch(fr: FeatureRequest) {
    setConfirmingCompletionFor(null);
    startEdit(fr);
  }

  async function approveFeature(fr: FeatureRequest) {
    setError(null);
    try {
      await apiRequest(`/api/admin/feature-requests/${fr.id}/status`, {
        method: "PATCH",
        body: { status: "approved" },
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not approve feature");
    }
  }

  if (!features) return <p className="text-text-muted">Loading base project...</p>;

  const reviewingChallenge =
    reviewingChallengeId == null ? null : features.find((f) => f.id === reviewingChallengeId) ?? null;

  return (
    <Card>
      <CardHeader>Base + Extra Features</CardHeader>
      <CardBody>
        {error && <Alert>{error}</Alert>}

        <div className="mb-16 border-4 border-border-strong bg-bg-panel-alt shadow-[8px_8px_0px_0px_var(--shadow-strong)]">
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="w-full text-left border-b-4 border-border-strong bg-bg-base p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-bg-panel-alt transition-colors"
          >
            <div>
              <h3 className="font-display-xl text-2xl font-black uppercase text-text-main leading-none mb-1">Add New Feature</h3>
              <p className="font-data-mono text-xs text-text-muted uppercase tracking-widest">Draft a base or extra feature</p>
            </div>
            <span className="material-symbols-outlined text-2xl shrink-0 transition-transform" style={{ transform: showAddForm ? "rotate(180deg)" : "none" }}>
              expand_more
            </span>
          </button>

          {showAddForm && (
          <>
          <div className="border-b-4 border-border-strong bg-bg-base px-6 pb-6 md:px-8 flex items-center justify-end">
            <Toggle
              checked={draft.is_base_feature}
              onChange={(next) => setDraft({ ...draft, is_base_feature: next })}
              label={draft.is_base_feature ? "Base Feature" : "Extra Feature"}
            />
          </div>

          <form onSubmit={createFeature} className="p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-6 mb-8">
              <div className="md:col-span-8">
                <Field>
                  <Label>Name</Label>
                  <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required placeholder="e.g. User Authentication" />
                </Field>
              </div>
              <div className="md:col-span-4">
                <Field>
                  <Label>Feature ID</Label>
                  <Input
                    value={draft.feature_id}
                    onChange={(e) => setDraft({ ...draft, feature_id: e.target.value })}
                    placeholder="e.g. F-001"
                  />
                </Field>
              </div>

              <div className="md:col-span-12">
                <Field>
                  <Label>Description</Label>
                  <Textarea
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    required
                    placeholder="Describe the feature details..."
                    rows={3}
                  />
                </Field>
              </div>

              <div className="md:col-span-3">
                <Field>
                  <Label>Frontend Hours</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={draft.quoted_frontend_hours}
                    onChange={(e) => setDraft({ ...draft, quoted_frontend_hours: e.target.value })}
                    placeholder="0"
                  />
                </Field>
              </div>
              <div className="md:col-span-3">
                <Field>
                  <Label>Backend Hours</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={draft.quoted_backend_hours}
                    onChange={(e) => setDraft({ ...draft, quoted_backend_hours: e.target.value })}
                    placeholder="0"
                  />
                </Field>
              </div>
              <div className="md:col-span-3">
                <Field>
                  <Label>Production Hours</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={draft.quoted_production_hours}
                    onChange={(e) => setDraft({ ...draft, quoted_production_hours: e.target.value })}
                    placeholder="0"
                  />
                </Field>
              </div>
              <div className="md:col-span-3">
                <Field>
                  <Label>Agreement Date</Label>
                  <BrutalistDatePicker
                    value={draft.agreement_date}
                    onChange={(val) => setDraft({ ...draft, agreement_date: val })}
                  />
                </Field>
              </div>
            </div>

            <div className="border-t-4 border-border-strong border-dashed pt-8 mb-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h4 className="font-headline-lg text-lg font-black uppercase text-text-main mb-1">External Services</h4>
                  <p className="font-data-mono text-xs text-text-muted uppercase tracking-widest">Add hosting, APIs, or recurring costs</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setServiceDrafts((prev) => [...prev, { ...emptyServiceDraft }])}
                >
                  + Add External Service
                </Button>
              </div>

              {serviceDrafts.length === 0 ? (
                <div className="bg-bg-base border-2 border-border-strong p-6 text-center">
                  <p className="font-data-mono text-xs text-text-muted uppercase tracking-widest">
                    No external services attached yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {serviceDrafts.map((service, i) => (
                    <div key={i} className="grid grid-cols-1 gap-4 md:grid-cols-12 items-end bg-bg-base border-2 border-border-strong p-4 relative group">
                      <div className="md:col-span-3">
                        <Field>
                          <Label>Service Name</Label>
                          <Input
                            value={service.name}
                            onChange={(e) =>
                              setServiceDrafts((prev) =>
                                prev.map((s, idx) => (idx === i ? { ...s, name: e.target.value } : s))
                              )
                            }
                            placeholder="e.g. AWS Hosting"
                          />
                        </Field>
                      </div>
                      <div className="md:col-span-5">
                        <Field>
                          <Label>Description</Label>
                          <Input
                            value={service.description}
                            onChange={(e) =>
                              setServiceDrafts((prev) =>
                                prev.map((s, idx) => (idx === i ? { ...s, description: e.target.value } : s))
                              )
                            }
                            placeholder="Optional details"
                          />
                        </Field>
                      </div>
                      <div className="md:col-span-3">
                        <Field>
                          <Label>Cost (INR/mo)</Label>
                          <Input
                            type="number"
                            value={service.recurring_cost}
                            onChange={(e) =>
                              setServiceDrafts((prev) =>
                                prev.map((s, idx) => (idx === i ? { ...s, recurring_cost: e.target.value } : s))
                              )
                            }
                            placeholder="0"
                          />
                        </Field>
                      </div>
                      <div className="md:col-span-1 pb-[26px]">
                        <button
                          type="button"
                          className="w-full h-[52px] bg-coral-red border-2 border-border-strong text-white font-black hover:bg-text-main transition-colors flex items-center justify-center"
                          onClick={() => setServiceDrafts((prev) => prev.filter((_, idx) => idx !== i))}
                          title="Remove Service"
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-bg-base border-4 border-border-strong p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <Label>Calculated Live Price (INR)</Label>
                <div className="font-display-xl text-3xl font-black text-brand-green flex items-center gap-2">
                  {formatINR(computeLivePrice(project, draft))}
                </div>
              </div>
              <Button type="submit" className="w-full md:w-auto px-12 py-6">Add Feature to Project</Button>
            </div>
          </form>
          </>
          )}
        </div>

        {features.length === 0 ? (
          <EmptyState>No base or extra features for this client yet.</EmptyState>
        ) : (
          <div className="mt-12">
            {features.filter((f) => f.is_base_feature).length > 0 && (
              <div className="mb-16">
                <h3 className="font-display-xl text-3xl font-black uppercase text-text-main mb-6 border-b-4 border-border-strong pb-4">
                  Core Base Features
                </h3>
                <div className="space-y-6">
                  {features.filter((f) => f.is_base_feature).map(renderFeatureCard)}
                </div>
              </div>
            )}

            {features.filter((f) => !f.is_base_feature).length > 0 && (
              <div>
                <h3 className="font-display-xl text-3xl font-black uppercase text-text-main mb-6 border-b-4 border-border-strong pb-4">
                  Extra Features (Client Requested)
                </h3>
                <div className="space-y-6">
                  {features.filter((f) => !f.is_base_feature).map(renderFeatureCard)}
                </div>
              </div>
            )}
          </div>
        )}
      </CardBody>

      {reviewingChallenge && (
        <ChallengeReviewModal
          featureRequest={reviewingChallenge}
          onClose={() => setReviewingChallengeId(null)}
          onChanged={load}
        />
      )}

      {confirmingCompletionFor && (
        <Modal open onClose={() => setConfirmingCompletionFor(null)} title="Mark As Completed">
          <div className="space-y-6">
            <p className="text-sm text-text-main">
              Did the actual hours spent on <span className="font-bold">{confirmingCompletionFor.name}</span> match
              the quoted estimate below?
            </p>
            <div className="bg-bg-base border-2 border-border-strong p-4">
              <div className="font-label-caps text-[10px] text-text-muted tracking-widest uppercase mb-1">
                Quoted Hours (Frontend / Backend / Production)
              </div>
              <div className="font-data-mono text-lg text-text-main font-bold">
                {confirmingCompletionFor.quoted_frontend_hours ?? "—"} / {confirmingCompletionFor.quoted_backend_hours ?? "—"} /{" "}
                {confirmingCompletionFor.quoted_production_hours ?? "—"}
              </div>
            </div>
            {(confirmingCompletionFor.quoted_frontend_hours ?? 0) +
              (confirmingCompletionFor.quoted_backend_hours ?? 0) +
              (confirmingCompletionFor.quoted_production_hours ?? 0) <=
              0 && (
              <Alert>No hours have been entered for this feature yet. Add hours before marking it completed.</Alert>
            )}
            <div className="flex gap-4 pt-2">
              <Button
                disabled={
                  (confirmingCompletionFor.quoted_frontend_hours ?? 0) +
                    (confirmingCompletionFor.quoted_backend_hours ?? 0) +
                    (confirmingCompletionFor.quoted_production_hours ?? 0) <=
                  0
                }
                onClick={() => confirmHoursMatch(confirmingCompletionFor)}
              >
                Yes, Matches
              </Button>
              <Button variant="secondary" onClick={() => hoursDontMatch(confirmingCompletionFor)}>
                No, Edit Hours
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );

  function renderFeatureCard(fr: FeatureRequest) {
    const editing = editingId === fr.id;
    const featureServices = services.filter((s) => s.feature_request_id === fr.id);
    const newService = newServiceByFeature[fr.id] ?? emptyServiceDraft;

    return (
      <div key={fr.id} className="border-4 border-border-strong bg-bg-base p-card-padding shadow-[8px_8px_0px_0px_var(--shadow-strong)] relative group transition-all">
        {unreadIds.includes(fr.id) && (
          <span
            className="absolute top-4 right-4 h-3 w-3 rounded-full bg-brand-green animate-pulse z-10"
            title="New message"
          />
        )}
        {editing && editDraft ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field>
                <Label>Name</Label>
                <Input
                  value={editDraft.name}
                  onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                />
              </Field>
              <Field>
                <Label>Feature ID</Label>
                <Input
                  value={editDraft.feature_id}
                  onChange={(e) => setEditDraft({ ...editDraft, feature_id: e.target.value })}
                />
              </Field>
            </div>
            <Field>
              <Label>Description</Label>
              <Textarea
                value={editDraft.description}
                onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Field>
                <Label>Frontend Hours</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={editDraft.quoted_frontend_hours}
                  onChange={(e) => setEditDraft({ ...editDraft, quoted_frontend_hours: e.target.value })}
                />
              </Field>
              <Field>
                <Label>Backend Hours</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={editDraft.quoted_backend_hours}
                  onChange={(e) => setEditDraft({ ...editDraft, quoted_backend_hours: e.target.value })}
                />
              </Field>
              <Field>
                <Label>Production Hours</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={editDraft.quoted_production_hours}
                  onChange={(e) => setEditDraft({ ...editDraft, quoted_production_hours: e.target.value })}
                />
              </Field>
              <Field>
                <Label>Agreement Date</Label>
                <BrutalistDatePicker
                  value={editDraft.agreement_date}
                  onChange={(val) => setEditDraft({ ...editDraft, agreement_date: val })}
                />
              </Field>
            </div>
            <div className="border-t-4 border-border-strong border-dashed pt-6 mt-2">
              <div className="font-label-caps text-xs text-text-main font-black uppercase tracking-widest mb-4">
                External Services {featureServices.length > 0 && `(${featureServices.length})`}
              </div>

              {featureServices.length > 0 && (
                <div className="space-y-3 mb-6">
                  {featureServices.map((s) =>
                    editingServiceId === s.id && editServiceDraft ? (
                      <div key={s.id} className="grid grid-cols-1 gap-4 md:grid-cols-12 items-end bg-bg-panel-alt border-2 border-brand-green p-4">
                        <div className="md:col-span-4">
                          <Field>
                            <Label>Service Name</Label>
                            <Input
                              value={editServiceDraft.name}
                              onChange={(e) => setEditServiceDraft({ ...editServiceDraft, name: e.target.value })}
                            />
                          </Field>
                        </div>
                        <div className="md:col-span-4">
                          <Field>
                            <Label>Description</Label>
                            <Input
                              value={editServiceDraft.description}
                              onChange={(e) => setEditServiceDraft({ ...editServiceDraft, description: e.target.value })}
                              placeholder="Optional details"
                            />
                          </Field>
                        </div>
                        <div className="md:col-span-2">
                          <Field>
                            <Label>Cost (INR/mo)</Label>
                            <Input
                              type="number"
                              value={editServiceDraft.recurring_cost}
                              onChange={(e) => setEditServiceDraft({ ...editServiceDraft, recurring_cost: e.target.value })}
                            />
                          </Field>
                        </div>
                        <div className="md:col-span-2 pb-[26px] flex gap-2">
                          <button
                            type="button"
                            className="flex-1 h-[52px] bg-brand-green border-2 border-border-strong text-on-brand-green font-black hover:bg-text-main hover:text-white transition-colors flex items-center justify-center"
                            onClick={() => saveServiceEdit(s.id)}
                            title="Save Service"
                          >
                            <span className="material-symbols-outlined">check</span>
                          </button>
                          <button
                            type="button"
                            className="flex-1 h-[52px] bg-bg-base border-2 border-border-strong text-text-muted hover:text-text-main transition-colors flex items-center justify-center"
                            onClick={() => {
                              setEditingServiceId(null);
                              setEditServiceDraft(null);
                            }}
                            title="Cancel"
                          >
                            <span className="material-symbols-outlined">close</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-4 bg-bg-panel-alt border-2 border-border-strong p-4 group"
                      >
                        <div>
                          <span className="font-bold text-base text-text-main block mb-1">{s.module}</span>
                          {s.description && <span className="text-sm text-text-muted">{s.description}</span>}
                        </div>
                        <div className="flex items-center gap-6 shrink-0">
                          <span className="font-data-mono text-sm text-brand-green font-bold">
                            {formatINR(s.monthly_overhead_price)}/mo
                          </span>
                          <button
                            type="button"
                            className="w-10 h-10 flex items-center justify-center bg-bg-base border-2 border-border-strong text-text-muted hover:bg-text-main hover:text-white transition-colors"
                            onClick={() => startEditService(s)}
                            title="Edit Service"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          <button
                            type="button"
                            className="w-10 h-10 flex items-center justify-center bg-bg-base border-2 border-border-strong text-text-muted hover:bg-coral-red hover:text-white hover:border-coral-red transition-colors"
                            onClick={() => deleteService(s.id)}
                            title="Remove Service"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}

              {editingServiceId !== null && featureServices.some((s) => s.id === editingServiceId) ? null : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12 items-end bg-bg-base border-2 border-border-strong p-4">
                <div className="md:col-span-4">
                  <Field>
                    <Label>New Service Name</Label>
                    <Input
                      value={newService.name}
                      onChange={(e) =>
                        setNewServiceByFeature((prev) => ({ ...prev, [fr.id]: { ...newService, name: e.target.value } }))
                      }
                      placeholder="e.g. AWS Hosting"
                    />
                  </Field>
                </div>
                <div className="md:col-span-4">
                  <Field>
                    <Label>Description</Label>
                    <Input
                      value={newService.description}
                      onChange={(e) =>
                        setNewServiceByFeature((prev) => ({
                          ...prev,
                          [fr.id]: { ...newService, description: e.target.value },
                        }))
                      }
                      placeholder="Optional details"
                    />
                  </Field>
                </div>
                <div className="md:col-span-3">
                  <Field>
                    <Label>Cost (INR/mo)</Label>
                    <Input
                      type="number"
                      value={newService.recurring_cost}
                      onChange={(e) =>
                        setNewServiceByFeature((prev) => ({
                          ...prev,
                          [fr.id]: { ...newService, recurring_cost: e.target.value },
                        }))
                      }
                      placeholder="0"
                    />
                  </Field>
                </div>
                <div className="md:col-span-1 pb-[26px]">
                  <button
                    type="button"
                    className="w-full h-[52px] bg-text-main border-2 border-border-strong text-white font-black hover:bg-black transition-colors flex items-center justify-center"
                    onClick={() => addServiceToFeature(fr.id)}
                    title="Add Service"
                  >
                    <span className="material-symbols-outlined">add</span>
                  </button>
                </div>
              </div>
              )}
            </div>

            <div className="flex gap-4 pt-6 border-t-2 border-border-strong">
              <Button type="button" onClick={() => saveEdit(fr.id)}>
                Save Changes
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setEditDraft(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6 border-b-2 border-border-strong pb-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-data-mono text-xs uppercase tracking-widest text-text-muted bg-bg-panel-alt px-2 py-1 border border-border-strong">
                    ID: #{fr.id} {fr.feature_id ? `· ${fr.feature_id}` : ""}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="font-data-mono text-[9px] uppercase tracking-widest text-text-muted">Status:</span>
                    <StatusBadge status={fr.is_base_feature && !fr.base_feature_activated ? "pending" : fr.status} />
                  </span>
                  {fr.is_base_feature && fr.challenge_status !== "none" && (
                    <span className="flex items-center gap-1.5">
                      <span className="font-data-mono text-[9px] uppercase tracking-widest text-text-muted">Challenge:</span>
                      <StatusBadge status={fr.challenge_status} />
                    </span>
                  )}
                </div>
                <h4 className="font-headline-lg text-2xl font-black uppercase text-text-main leading-tight mb-2">
                  {fr.name}
                </h4>
                <p className="text-sm text-text-muted max-w-3xl whitespace-pre-wrap">{fr.description}</p>
              </div>
              <div className="shrink-0 flex gap-3">
                {fr.is_base_feature && fr.challenge_status !== "none" && (
                  <Button variant="secondary" onClick={() => setReviewingChallengeId(fr.id)}>
                    {fr.challenge_status === "open" ? "Review Challenge" : "View Challenge"}
                  </Button>
                )}
                {fr.status === "under_review" && !fr.is_base_feature && (
                  <Button variant="secondary" onClick={() => approveFeature(fr)}>
                    Approve
                  </Button>
                )}
                {fr.status === "approved" && (!fr.is_base_feature || fr.base_feature_activated) && (
                  <Button variant="secondary" onClick={() => markInProgress(fr)}>
                    Mark In Progress
                  </Button>
                )}
                {fr.status === "in_progress" && (
                  <Button variant="secondary" onClick={() => setConfirmingCompletionFor(fr)}>
                    Mark Completed
                  </Button>
                )}
                <Button variant="secondary" onClick={() => startEdit(fr)}>
                  Edit Feature
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-bg-panel-alt p-4 border-2 border-border-strong mb-6">
              <div>
                <div className="font-label-caps text-[10px] text-text-muted tracking-widest uppercase mb-1">Hours (F / B / P)</div>
                <div className="font-data-mono text-sm text-text-main font-bold">
                  {fr.quoted_frontend_hours ?? "—"} / {fr.quoted_backend_hours ?? "—"} / {fr.quoted_production_hours ?? "—"}
                </div>
              </div>
              <div>
                <div className="font-label-caps text-[10px] text-text-muted tracking-widest uppercase mb-1">
                  Calculated Price
                </div>
                <div className="font-data-mono text-xl text-brand-green font-black">{formatINR(fr.price)}</div>
              </div>
              <div>
                <div className="font-label-caps text-[10px] text-text-muted tracking-widest uppercase mb-1">Agreement Date</div>
                <div className="font-data-mono text-sm text-text-main font-bold">{formatDate(fr.agreement_date)}</div>
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
          </div>
        )}
      </div>
    );
  }
}

function ChallengeReviewModal({
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
  const featureRequestsVersion = useWsEvent("feature_requests");

  async function loadMessages() {
    try {
      const data = await apiRequest<FeatureRequestMessage[]>(
        `/api/admin/feature-requests/${featureRequest.id}/challenge-messages`
      );
      setMessages(data);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not load challenge messages");
    }
  }

  useEffect(() => {
    loadMessages();
    markFeatureRequestRead(featureRequest.id);
  }, [featureRequest.id, featureRequestsVersion]);

  async function sendMessage() {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const message = await apiRequest<FeatureRequestMessage>(
        `/api/admin/feature-requests/${featureRequest.id}/challenge-messages`,
        { method: "POST", body: { body } }
      );
      setMessages((prev) => [...prev, message]);
      setBody("");
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not send message");
    } finally {
      setSending(false);
    }
  }

  async function decide(decision: "approved" | "denied") {
    setError(null);
    try {
      await apiRequest(`/api/admin/feature-requests/${featureRequest.id}/challenge-decision`, {
        method: "PATCH",
        body: { decision },
      });
      await onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not record challenge decision");
    }
  }

  const isOpen = featureRequest.challenge_status === "open";

  return (
    <Modal open onClose={onClose} title={`Challenge: ${featureRequest.name}`}>
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <div className="flex items-center justify-between">
          <StatusBadge status={featureRequest.challenge_status} />
        </div>
        <ChatDiscussion
          messages={messages}
          currentRole="admin"
          body={body}
          setBody={setBody}
          sendMessage={sendMessage}
          sending={sending}
          readOnly={!isOpen}
        />
        {isOpen && (
          <div className="flex gap-4 pt-2">
            <Button onClick={() => decide("approved")}>Approve Challenge</Button>
            <Button variant="danger" onClick={() => decide("denied")}>
              Deny Challenge
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
