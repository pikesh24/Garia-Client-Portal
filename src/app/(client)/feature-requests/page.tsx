"use client";

import { useEffect, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import { FeatureRequest, QuoteBreakdown } from "@/lib/types";
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
  Table,
  Td,
  Textarea,
  Th,
} from "@/components/ui";

export default function FeatureRequestsPage() {
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [selected, setSelected] = useState<FeatureRequest | null>(null);
  const [quote, setQuote] = useState<QuoteBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [overrideText, setOverrideText] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    const data = await apiRequest<FeatureRequest[]>("/api/feature-requests");
    setRequests(data);
    setLoading(false);
    return data;
  }

  useEffect(() => {
    load();
  }, []);

  async function selectRequest(fr: FeatureRequest) {
    setSelected(fr);
    setQuote(null);
    setAccepted(fr.accepted_terms);
    setActionError(null);
    setOverrideText(fr.description);
    if (fr.status === "quoted" || fr.status === "accepted") {
      try {
        const q = await apiRequest<QuoteBreakdown>(`/api/feature-requests/${fr.id}/quote`);
        setQuote(q);
      } catch {
        setQuote(null);
      }
    }
  }

  async function createRequest(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    try {
      await apiRequest("/api/feature-requests", { method: "POST", body: { name, description } });
      setName("");
      setDescription("");
      await load();
    } catch (err) {
      setCreateError(err instanceof ApiError ? String(err.detail) : "Could not create feature request");
    }
  }

  async function respondClarification() {
    if (!selected) return;
    setActionError(null);
    try {
      await apiRequest(`/api/feature-requests/${selected.id}/respond-clarification`, {
        method: "POST",
        body: { client_description_override: overrideText },
      });
      setOverrideText("");
      const data = await load();
      const updated = data.find((f) => f.id === selected.id);
      if (updated) selectRequest(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? String(err.detail) : "Could not submit update");
    }
  }

  async function authorize() {
    if (!selected) return;
    setActionError(null);
    try {
      await apiRequest(`/api/feature-requests/${selected.id}/authorize`, {
        method: "POST",
        body: { accepted_terms: true },
      });
      const data = await load();
      const updated = data.find((f) => f.id === selected.id);
      if (updated) selectRequest(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? String(err.detail) : "Could not authorize feature");
    }
  }

  const openClarification = selected?.clarifications.find((c) => !c.resolved);

  return (
    <div className="space-y-6">
      <PageHeader title="Feature Discovery & Description Customization" />

      <Card>
        <CardHeader>Propose a New Feature</CardHeader>
        <CardBody>
          <form onSubmit={createRequest} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {createError && (
              <div className="md:col-span-2">
                <Alert>{createError}</Alert>
              </div>
            )}
            <Field>
              <Label>Name</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <div className="md:col-span-2">
              <Field>
                <Label>Description</Label>
                <Textarea required value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
            </div>
            <div>
              <Button type="submit">Submit Feature Request</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>Pipeline</CardHeader>
          <CardBody>
            {loading ? (
              <p className="text-text-muted">Loading...</p>
            ) : requests.length === 0 ? (
              <EmptyState>No feature requests yet.</EmptyState>
            ) : (
              <div className="space-y-2">
                {requests.map((fr) => (
                  <button
                    key={fr.id}
                    onClick={() => selectRequest(fr)}
                    className={`block w-full rounded-sm border p-3 text-left ${
                      selected?.id === fr.id ? "border-amber" : "border-border-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-heading">{fr.name}</span>
                      <StatusBadge status={fr.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>Review &amp; Clarification</CardHeader>
          <CardBody>
            {!selected ? (
              <EmptyState>Select a feature request.</EmptyState>
            ) : (
              <div className="space-y-4">
                {actionError && <Alert>{actionError}</Alert>}
                <p className="text-sm text-text-primary">{selected.description}</p>

                {openClarification && (
                  <div className="rounded-sm border border-gold bg-gold/10 p-3">
                    <p className="text-sm text-gold">Admin query: {openClarification.admin_query}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      Submitting below fully replaces the description above (one-way update).
                    </p>
                    <Textarea
                      className="mt-2"
                      value={overrideText}
                      onChange={(e) => setOverrideText(e.target.value)}
                    />
                    <Button className="mt-2" onClick={respondClarification}>
                      Submit Clarifying Description Update
                    </Button>
                  </div>
                )}

                {quote && (
                  <div className="rounded-sm border border-border-muted p-3 font-mono text-sm">
                    <Table>
                      <thead>
                        <tr>
                          <Th>Domain</Th>
                          <Th>Hours</Th>
                          <Th>Amount</Th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <Td>Frontend</Td>
                          <Td>{selected.quoted_frontend_hours ?? 0}h</Td>
                          <Td>${quote.frontend_amount.toFixed(2)}</Td>
                        </tr>
                        <tr>
                          <Td>Backend</Td>
                          <Td>{selected.quoted_backend_hours ?? 0}h</Td>
                          <Td>${quote.backend_amount.toFixed(2)}</Td>
                        </tr>
                        <tr>
                          <Td>Production</Td>
                          <Td>{selected.quoted_production_hours ?? 0}h</Td>
                          <Td>${quote.production_amount.toFixed(2)}</Td>
                        </tr>
                        <tr>
                          <Td colSpan={2}>Subtotal</Td>
                          <Td>${quote.subtotal.toFixed(2)}</Td>
                        </tr>
                        <tr>
                          <Td colSpan={2} className="text-amber">Discount</Td>
                          <Td className="text-amber">-${quote.discount_amount.toFixed(2)}</Td>
                        </tr>
                        <tr>
                          <Td colSpan={2} className="text-text-heading">Total</Td>
                          <Td className="text-text-heading">${quote.total.toFixed(2)}</Td>
                        </tr>
                      </tbody>
                    </Table>

                    {selected.status === "quoted" && (
                      <div className="mt-3 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={accepted}
                          onChange={(e) => setAccepted(e.target.checked)}
                        />
                        <label className="text-xs text-text-muted">I accept these terms</label>
                        <Button disabled={!accepted} onClick={authorize}>
                          Authorize Feature Inclusion
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
