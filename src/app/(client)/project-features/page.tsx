"use client";

import { useEffect, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import { FeatureRequest, ProjectFeatures } from "@/lib/types";
import { Alert, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, StatusBadge } from "@/components/ui";

export default function ProjectFeaturesPage() {
  const [features, setFeatures] = useState<ProjectFeatures | null>(null);
  const [verifyChecks, setVerifyChecks] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await apiRequest<ProjectFeatures>("/api/project-features");
    setFeatures(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function activate(fr: FeatureRequest) {
    if (!verifyChecks[fr.id]) return;
    setError(null);
    try {
      await apiRequest(`/api/feature-requests/${fr.id}/activate-base-feature`, {
        method: "POST",
        body: { verified: true },
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not activate feature");
    }
  }

  async function requestCancellation(fr: FeatureRequest) {
    setError(null);
    try {
      await apiRequest(`/api/feature-requests/${fr.id}/request-cancellation-review`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not request cancellation review");
    }
  }

  if (!features) return <p className="text-text-muted">Loading...</p>;

  return (
    <div className="space-y-6">
      <PageHeader title="Base Project & Extra Features" />
      {error && <Alert>{error}</Alert>}

      <Card>
        <CardHeader>Base Project Features</CardHeader>
        <CardBody>
          {features.base_features.length === 0 ? (
            <EmptyState>No base features on this account.</EmptyState>
          ) : (
            <div className="space-y-3">
              {features.base_features.map((fr) => (
                <div key={fr.id} className="rounded-sm border border-border-muted p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-heading">{fr.name}</span>
                    <StatusBadge status={fr.base_feature_activated ? "completed" : "pending"} />
                  </div>
                  <p className="mt-1 text-sm text-text-muted">{fr.description}</p>

                  {!fr.base_feature_activated && (
                    <div className="mt-3 rounded-sm border border-gold bg-gold/10 p-3">
                      <p className="text-sm text-gold">
                        [!] Activating this feature confirms its requirement profile as final.
                      </p>
                      <label className="mt-2 flex items-center gap-2 text-xs text-text-muted">
                        <input
                          type="checkbox"
                          checked={!!verifyChecks[fr.id]}
                          onChange={(e) => setVerifyChecks((prev) => ({ ...prev, [fr.id]: e.target.checked }))}
                        />
                        I verify that this baseline feature implementation is required (Irreversible).
                      </label>
                      <div className="mt-2 flex gap-2">
                        <Button disabled={!verifyChecks[fr.id]} onClick={() => activate(fr)}>
                          Confirm Irreversible Feature Activation
                        </Button>
                        <Button variant="ghost" onClick={() => requestCancellation(fr)}>
                          Request Cancellation Review
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>Approved Extra Features</CardHeader>
        <CardBody>
          {features.extra_features.length === 0 ? (
            <EmptyState>No extra features added yet.</EmptyState>
          ) : (
            <div className="space-y-3">
              {features.extra_features.map((fr) => (
                <div key={fr.id} className="rounded-sm border border-border-muted p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-heading">{fr.name}</span>
                    <StatusBadge status={fr.status} />
                  </div>
                  <p className="mt-1 text-sm text-text-muted">{fr.description}</p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
