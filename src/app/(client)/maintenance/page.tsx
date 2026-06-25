"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, apiRequest, ApiError, getAccessToken } from "@/lib/api";
import { FeatureRequest, InfrastructureCostEntry, MaintenanceRecord } from "@/lib/types";
import { Alert, Card, CardBody, CardHeader, EmptyState, PageHeader, StatusBadge, Table, Td, Th, Button } from "@/components/ui";

export default function MaintenancePage() {
  const [infraCosts, setInfraCosts] = useState<InfrastructureCostEntry[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [features, setFeatures] = useState<FeatureRequest[]>([]);
  const [loadedAt, setLoadedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});

  async function load() {
    const [costs, recs, feats] = await Promise.all([
      apiRequest<InfrastructureCostEntry[]>("/api/maintenance/infrastructure-costs"),
      apiRequest<MaintenanceRecord[]>("/api/maintenance/records"),
      apiRequest<FeatureRequest[]>("/api/feature-requests"),
    ]);
    setInfraCosts(costs);
    setRecords(recs);
    setFeatures(feats);
    setLoadedAt(Date.now());
  }

  useEffect(() => {
    load();
  }, []);

  async function submitProof(recordId: number) {
    const file = fileInputs.current[recordId]?.files?.[0];
    if (!file) {
      setError("Select a voucher file before submitting proof");
      return;
    }
    const form = new FormData();
    form.append("voucher", file);
    try {
      const res = await fetch(`${API_BASE_URL}/api/maintenance/records/${recordId}/submit-proof`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        body: form,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new ApiError(res.status, data.detail);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not submit proof");
    }
  }

  function daysRemaining(deadline: string | null): number | null {
    if (!deadline || !loadedAt) return null;
    const ms = new Date(deadline).getTime() - loadedAt;
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Deployment Infrastructure & Maintenance Ledger" />
      {error && <Alert>{error}</Alert>}

      <Card>
        <CardHeader>Infrastructure Cost Registry</CardHeader>
        <CardBody>
          {infraCosts.length === 0 ? (
            <EmptyState>No infrastructure costs registered.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Module</Th>
                  <Th>Linked Feature</Th>
                  <Th>Billing Type</Th>
                  <Th>Monthly Overhead</Th>
                </tr>
              </thead>
              <tbody>
                {infraCosts.map((c) => (
                  <tr key={c.id}>
                    <Td>{c.module}</Td>
                    <Td className="text-text-muted">
                      {features.find((f) => f.id === c.feature_request_id)?.name ?? "-"}
                    </Td>
                    <Td className="font-mono">{c.billing_type}</Td>
                    <Td className="font-mono">${c.monthly_overhead_price.toFixed(2)}/mo</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>Annual Maintenance Compliance</CardHeader>
        <CardBody>
          {records.length === 0 ? (
            <EmptyState>No maintenance cycles created yet.</EmptyState>
          ) : (
            <div className="space-y-3">
              {records.map((r) => {
                const remaining = daysRemaining(r.penalty_deadline);
                return (
                  <div key={r.id} className="rounded-sm border border-border-muted p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm text-text-heading">
                        Cycle {r.cycle_year} &middot; ${r.amount.toFixed(2)} &middot; due {new Date(r.due_date).toLocaleDateString()}
                      </span>
                      <StatusBadge status={r.status} />
                    </div>

                    {r.status === "rejected" && (
                      <div className="mt-2 rounded-sm border border-gold bg-gold/10 p-3">
                        <p className="text-sm text-gold">Rejected: {r.rejection_reason}</p>
                        {remaining !== null && (
                          <p className="mt-1 font-mono text-xs text-gold">
                            {remaining} day{remaining === 1 ? "" : "s"} remaining in penalty extension window
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="file"
                            ref={(el) => {
                              fileInputs.current[r.id] = el;
                            }}
                            className="text-sm text-text-primary"
                          />
                          <Button onClick={() => submitProof(r.id)}>Resubmit Voucher</Button>
                        </div>
                      </div>
                    )}

                    {r.status === "pending" && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="file"
                          ref={(el) => {
                            fileInputs.current[r.id] = el;
                          }}
                          className="text-sm text-text-primary"
                        />
                        <Button onClick={() => submitProof(r.id)}>Submit Payment Proof</Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
