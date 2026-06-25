"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest, ApiError } from "@/lib/api";
import { FeatureRequest } from "@/lib/types";
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
  PageHeader,
  StatusBadge,
  Textarea,
} from "@/components/ui";

export default function AdminFeatureRequestsPage() {
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [selected, setSelected] = useState<FeatureRequest | null>(null);
  const [query, setQuery] = useState("");
  const [hours, setHours] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await apiRequest<FeatureRequest[]>("/api/admin/feature-requests");
    setRequests(data);
    if (selected) setSelected(data.find((f) => f.id === selected.id) ?? null);
  }

  useEffect(() => {
    load();
  }, []);

  async function raiseClarification() {
    if (!selected) return;
    setError(null);
    try {
      await apiRequest(`/api/admin/feature-requests/${selected.id}/clarify`, {
        method: "POST",
        body: { admin_query: query },
      });
      setQuery("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not raise clarification");
    }
  }

  async function start() {
    if (!selected) return;
    setError(null);
    try {
      await apiRequest(`/api/admin/feature-requests/${selected.id}/start`, { method: "PATCH" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not start feature");
    }
  }

  async function complete() {
    if (!selected) return;
    setError(null);
    try {
      await apiRequest(`/api/admin/feature-requests/${selected.id}/complete`, {
        method: "PATCH",
        body: { actual_hours_taken: Number(hours) },
      });
      setHours("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not complete feature");
    }
  }

  async function markOutOfScope() {
    if (!selected) return;
    await apiRequest(`/api/admin/feature-requests/${selected.id}/mark-out-of-scope`, { method: "PATCH" });
    await load();
  }

  async function overwriteSpec() {
    if (!selected) return;
    setError(null);
    try {
      await apiRequest(`/api/admin/feature-requests/${selected.id}`, {
        method: "PUT",
        body: { client_id: selected.client_id, name: selected.name, description: selected.description },
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not overwrite specification");
    }
  }

  async function deleteRequest() {
    if (!selected) return;
    if (!confirm("Delete this feature request out of the pipeline entirely? This cannot be undone.")) return;
    await apiRequest(`/api/admin/feature-requests/${selected.id}`, { method: "DELETE" });
    setSelected(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Features & Proposals Pipeline"
        action={
          <Link href="/admin/feature-requests/admin-propose">
            <Button>Propose Optimization</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>Pipeline</CardHeader>
          <CardBody>
            {requests.length === 0 ? (
              <EmptyState>No feature requests yet.</EmptyState>
            ) : (
              <div className="space-y-2">
                {requests.map((fr) => (
                  <button
                    key={fr.id}
                    onClick={() => setSelected(fr)}
                    className={`block w-full rounded-sm border p-3 text-left ${
                      selected?.id === fr.id ? "border-amber" : "border-border-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-heading">
                        {fr.name} <span className="font-mono text-xs text-text-muted">(client {fr.client_id})</span>
                      </span>
                      <StatusBadge status={fr.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>Manage Selected Request</CardHeader>
          <CardBody>
            {!selected ? (
              <EmptyState>Select a feature request.</EmptyState>
            ) : (
              <div className="space-y-4">
                {error && <Alert>{error}</Alert>}

                <div className="rounded-sm border border-border-muted p-3">
                  <Field>
                    <Label>Name</Label>
                    <Input
                      value={selected.name}
                      onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                    />
                  </Field>
                  <Field>
                    <Label>Description</Label>
                    <Textarea
                      value={selected.description}
                      onChange={(e) => setSelected({ ...selected, description: e.target.value })}
                    />
                  </Field>
                  <Button variant="secondary" onClick={overwriteSpec}>
                    Overwrite Requirement Baseline Specifications
                  </Button>
                </div>

                {selected.status === "initiated" && (
                  <div className="rounded-sm border border-border-muted p-3">
                    <Link href={`/admin/feature-requests/${selected.id}/quote`}>
                      <Button>Go to Tech Scoping & Quoting</Button>
                    </Link>
                    <div className="mt-3">
                      <Field>
                        <Label>Technical Query</Label>
                        <Textarea value={query} onChange={(e) => setQuery(e.target.value)} />
                      </Field>
                      <Button variant="secondary" onClick={raiseClarification}>
                        Request Clarification
                      </Button>
                    </div>
                  </div>
                )}

                {selected.status === "accepted" && (
                  <Button onClick={start}>Move to In Progress</Button>
                )}

                {selected.status === "in_progress" && (
                  <div className="rounded-sm border border-border-muted p-3">
                    <Field>
                      <Label>Actual Hours Taken</Label>
                      <Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} />
                    </Field>
                    <Button onClick={complete}>Mark Completed</Button>
                  </div>
                )}

                {!["completed", "out_of_scope", "cancelled"].includes(selected.status) && (
                  <Button variant="ghost" onClick={markOutOfScope}>
                    Mark Out of Scope
                  </Button>
                )}

                <Button variant="danger" onClick={deleteRequest}>
                  Delete Feature Request Out of Pipeline Scope
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
