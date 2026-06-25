"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest, ApiError } from "@/lib/api";
import { FeatureRequest, QuoteBreakdown } from "@/lib/types";
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Label, PageHeader, Table, Td } from "@/components/ui";

export default function AdminQuoteFeaturePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [fr, setFr] = useState<FeatureRequest | null>(null);
  const [frontendHours, setFrontendHours] = useState("");
  const [backendHours, setBackendHours] = useState("");
  const [productionHours, setProductionHours] = useState("");
  const [breakdown, setBreakdown] = useState<QuoteBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<FeatureRequest[]>("/api/admin/feature-requests").then((all) => {
      const found = all.find((f) => f.id === Number(params.id));
      setFr(found ?? null);
      if (found) {
        setFrontendHours(String(found.quoted_frontend_hours ?? ""));
        setBackendHours(String(found.quoted_backend_hours ?? ""));
        setProductionHours(String(found.quoted_production_hours ?? ""));
      }
    });
  }, [params.id]);

  async function publishQuote(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await apiRequest<QuoteBreakdown>(`/api/admin/feature-requests/${params.id}/quote`, {
        method: "POST",
        body: {
          quoted_frontend_hours: Number(frontendHours),
          quoted_backend_hours: Number(backendHours),
          quoted_production_hours: Number(productionHours),
        },
      });
      setBreakdown(result);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not publish quote");
    }
  }

  if (!fr) return <p className="text-text-muted">Loading...</p>;

  return (
    <div className="space-y-6">
      <PageHeader title={`Tech Scoping & Quoting: ${fr.name}`} />
      <Card>
        <CardHeader>Quote Inputs</CardHeader>
        <CardBody>
          <form onSubmit={publishQuote} className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {error && (
              <div className="md:col-span-3">
                <Alert>{error}</Alert>
              </div>
            )}
            <Field>
              <Label>Frontend Hours</Label>
              <Input type="number" required value={frontendHours} onChange={(e) => setFrontendHours(e.target.value)} />
            </Field>
            <Field>
              <Label>Backend Hours</Label>
              <Input type="number" required value={backendHours} onChange={(e) => setBackendHours(e.target.value)} />
            </Field>
            <Field>
              <Label>Production Hours</Label>
              <Input type="number" required value={productionHours} onChange={(e) => setProductionHours(e.target.value)} />
            </Field>
            <div className="md:col-span-3">
              <Button type="submit">Publish Formal Price Quotation</Button>
            </div>
          </form>

          {breakdown && (
            <div className="mt-4 rounded-sm border border-border-muted p-3 font-mono text-sm">
              <Table>
                <tbody>
                  <tr>
                    <Td>Frontend</Td>
                    <Td>${breakdown.frontend_amount.toFixed(2)}</Td>
                  </tr>
                  <tr>
                    <Td>Backend</Td>
                    <Td>${breakdown.backend_amount.toFixed(2)}</Td>
                  </tr>
                  <tr>
                    <Td>Production</Td>
                    <Td>${breakdown.production_amount.toFixed(2)}</Td>
                  </tr>
                  <tr>
                    <Td>Subtotal</Td>
                    <Td>${breakdown.subtotal.toFixed(2)}</Td>
                  </tr>
                  <tr>
                    <Td className="text-amber">Discount Applied</Td>
                    <Td className="text-amber">-${breakdown.discount_amount.toFixed(2)}</Td>
                  </tr>
                  <tr>
                    <Td className="text-text-heading">Total</Td>
                    <Td className="text-text-heading">${breakdown.total.toFixed(2)}</Td>
                  </tr>
                </tbody>
              </Table>
              <Button className="mt-3" variant="secondary" onClick={() => router.push("/admin/feature-requests")}>
                Back to Pipeline
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
