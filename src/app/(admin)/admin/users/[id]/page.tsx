"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiRequest, ApiError } from "@/lib/api";
import { User } from "@/lib/types";
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Label, PageHeader, Toggle } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function AdminClientDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const canManage = user?.role !== "developer";
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Configure ${client.full_name}`}
        action={
          <div className="flex flex-wrap gap-3">
            <Link href={`/admin/users/${client.id}/projects`}>
              <Button type="button" variant="secondary">
                Manage Projects
              </Button>
            </Link>
            <Link href={`/admin/users/${client.id}/projects`}>
              <Button type="button" variant="secondary">
                Manage Base + Extra Features
              </Button>
            </Link>
          </div>
        }
      />
      <Card>
        <CardHeader>Detailed Client Profile Configuration</CardHeader>
        <CardBody>
          {!canManage ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field>
                <Label>Full Name</Label>
                <Input value={client.full_name} disabled />
              </Field>
              <Field>
                <Label>Email</Label>
                <Input value={client.email} disabled />
              </Field>
              <Field>
                <Label>Can Book Offline Meetings</Label>
                <Input value={client.can_book_offline_meeting ? "Enabled" : "Disabled"} disabled />
              </Field>
              <Field>
                <Label>Status</Label>
                <Input value={client.is_active ? "Active" : "Inactive"} disabled />
              </Field>
            </div>
          ) : (
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

            <div className="flex flex-wrap items-center gap-2 md:col-span-3">
              <Button type="submit">Commit Account Configuration Updates</Button>
              <Button type="button" variant="secondary" onClick={deactivate} disabled={!client.is_active}>
                Deactivate Client Profile Identity
              </Button>
            </div>
          </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
