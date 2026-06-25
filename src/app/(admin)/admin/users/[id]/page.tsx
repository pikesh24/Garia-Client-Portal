"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest, ApiError } from "@/lib/api";
import { User } from "@/lib/types";
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Label, PageHeader } from "@/components/ui";

export default function AdminClientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<User>(`/api/admin/users/${params.id}`).then(setClient);
  }, [params.id]);

  if (!client) return <p className="text-text-muted">Loading...</p>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const updated = await apiRequest<User>(`/api/admin/users/${client!.id}`, {
        method: "PATCH",
        body: {
          full_name: client!.full_name,
          email: client!.email,
          can_book_offline_meeting: client!.can_book_offline_meeting,
          hourly_rate_frontend: client!.hourly_rate_frontend,
          hourly_rate_backend: client!.hourly_rate_backend,
          hourly_rate_production: client!.hourly_rate_production,
          maintenance_price: client!.maintenance_price,
          project_start_date: client!.project_start_date,
        },
      });
      setClient(updated);
      setMessage("Account configuration updated.");
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Update failed");
    }
  }

  async function overwrite() {
    setError(null);
    setMessage(null);
    try {
      const updated = await apiRequest<User>(`/api/admin/users/${client!.id}`, {
        method: "PUT",
        body: {
          full_name: client!.full_name,
          email: client!.email,
          can_book_offline_meeting: client!.can_book_offline_meeting,
          hourly_rate_frontend: client!.hourly_rate_frontend,
          hourly_rate_backend: client!.hourly_rate_backend,
          hourly_rate_production: client!.hourly_rate_production,
          maintenance_price: client!.maintenance_price,
          project_start_date: client!.project_start_date,
        },
      });
      setClient(updated);
      setMessage("Account master record overwritten.");
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Overwrite failed");
    }
  }

  async function deactivate() {
    const updated = await apiRequest<User>(`/api/admin/users/${client!.id}/deactivate`, { method: "POST" });
    setClient(updated);
  }

  async function purge() {
    if (!confirm("Permanently delete this client and all associated data? This cannot be undone.")) return;
    await apiRequest(`/api/admin/users/${client!.id}`, { method: "DELETE" });
    router.push("/admin/users");
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`Configure ${client.full_name}`} />
      <Card>
        <CardHeader>Detailed Client Profile Configuration</CardHeader>
        <CardBody>
          <form onSubmit={save} className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {message && (
              <div className="md:col-span-3">
                <Alert kind="warning">{message}</Alert>
              </div>
            )}
            {error && (
              <div className="md:col-span-3">
                <Alert>{error}</Alert>
              </div>
            )}
            <Field>
              <Label>Full Name</Label>
              <Input value={client.full_name} onChange={(e) => setClient({ ...client, full_name: e.target.value })} />
            </Field>
            <Field>
              <Label>Email</Label>
              <Input
                type="email"
                value={client.email}
                onChange={(e) => setClient({ ...client, email: e.target.value })}
              />
            </Field>
            <Field>
              <Label className="flex items-center gap-2">Can Book Offline Meetings</Label>
              <input
                type="checkbox"
                checked={client.can_book_offline_meeting}
                onChange={(e) => setClient({ ...client, can_book_offline_meeting: e.target.checked })}
              />
            </Field>
            <Field>
              <Label>Hourly Rate (Frontend)</Label>
              <Input
                type="number"
                value={client.hourly_rate_frontend ?? ""}
                onChange={(e) => setClient({ ...client, hourly_rate_frontend: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
            <Field>
              <Label>Hourly Rate (Backend)</Label>
              <Input
                type="number"
                value={client.hourly_rate_backend ?? ""}
                onChange={(e) => setClient({ ...client, hourly_rate_backend: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
            <Field>
              <Label>Hourly Rate (Production)</Label>
              <Input
                type="number"
                value={client.hourly_rate_production ?? ""}
                onChange={(e) => setClient({ ...client, hourly_rate_production: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
            <Field>
              <Label>Annual Maintenance Price</Label>
              <Input
                type="number"
                value={client.maintenance_price ?? ""}
                onChange={(e) => setClient({ ...client, maintenance_price: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
            <Field>
              <Label>Project Start Date</Label>
              <Input
                type="date"
                value={client.project_start_date ?? ""}
                onChange={(e) => setClient({ ...client, project_start_date: e.target.value || null })}
              />
            </Field>

            <div className="flex flex-wrap items-center gap-2 md:col-span-3">
              <Button type="submit">Commit Account Configuration Updates</Button>
              <Button type="button" variant="secondary" onClick={overwrite}>
                Overwrite Account Master Record
              </Button>
              <Button type="button" variant="secondary" onClick={deactivate} disabled={!client.is_active}>
                Deactivate Client Profile Identity
              </Button>
              <Button type="button" variant="danger" onClick={purge}>
                Permanently Purge User Profile Mapping
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
