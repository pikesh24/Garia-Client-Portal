"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiRequest, ApiError } from "@/lib/api";
import { User } from "@/lib/types";
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Label, PageHeader, Toggle } from "@/components/ui";
import { BrutalistDatePicker } from "@/components/BrutalistDatePicker";
import { useConfirm } from "@/lib/confirm";

export default function AdminClientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const confirm = useConfirm();

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

  async function deactivate() {
    const updated = await apiRequest<User>(`/api/admin/users/${client!.id}/deactivate`, { method: "POST" });
    setClient(updated);
  }

  async function purge() {
    const ok = await confirm({
      title: "Confirm Deletion",
      message: "Permanently delete this client and all associated data? This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await apiRequest(`/api/admin/users/${client!.id}`, { method: "DELETE" });
    router.push("/admin/users");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Configure ${client.full_name}`}
        action={
          <Link href={`/admin/users/${client.id}/projects`}>
            <Button type="button" variant="secondary">
              Manage Base + Extra Features
            </Button>
          </Link>
        }
      />
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
              <Label>Can Book Offline Meetings</Label>
              <Toggle
                checked={client.can_book_offline_meeting}
                onChange={(next) => setClient({ ...client, can_book_offline_meeting: next })}
                label={client.can_book_offline_meeting ? "Enabled" : "Disabled"}
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
              <BrutalistDatePicker
                value={client.project_start_date ?? ""}
                onChange={(val) => setClient({ ...client, project_start_date: val || null })}
              />
            </Field>

            <div className="flex flex-wrap items-center gap-2 md:col-span-3">
              <Button type="submit">Commit Account Configuration Updates</Button>
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
