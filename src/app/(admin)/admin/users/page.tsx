"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest, ApiError } from "@/lib/api";
import { User } from "@/lib/types";
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
  Table,
  Td,
  Th,
} from "@/components/ui";

export default function AdminUsersPage() {
  const [clients, setClients] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    can_book_offline_meeting: false,
    hourly_rate_frontend: "",
    hourly_rate_backend: "",
    hourly_rate_production: "",
    maintenance_price: "",
    project_start_date: "",
  });

  async function load() {
    const data = await apiRequest<User[]>("/api/admin/users");
    setClients(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest("/api/admin/users", {
        method: "POST",
        body: {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          can_book_offline_meeting: form.can_book_offline_meeting,
          hourly_rate_frontend: form.hourly_rate_frontend ? Number(form.hourly_rate_frontend) : null,
          hourly_rate_backend: form.hourly_rate_backend ? Number(form.hourly_rate_backend) : null,
          hourly_rate_production: form.hourly_rate_production ? Number(form.hourly_rate_production) : null,
          maintenance_price: form.maintenance_price ? Number(form.maintenance_price) : null,
          project_start_date: form.project_start_date || null,
        },
      });
      setShowForm(false);
      setForm({ ...form, email: "", password: "", full_name: "" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not create client");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Accounts Configuration Matrix"
        action={<Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "New Client"}</Button>}
      />

      {showForm && (
        <Card>
          <CardHeader>Create Client Account</CardHeader>
          <CardBody>
            <form onSubmit={createClient} className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {error && (
                <div className="md:col-span-3">
                  <Alert>{error}</Alert>
                </div>
              )}
              <Field>
                <Label>Email</Label>
                <Input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field>
                <Label>Temporary Password</Label>
                <Input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </Field>
              <Field>
                <Label>Full Name</Label>
                <Input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </Field>
              <Field>
                <Label>Hourly Rate (Frontend)</Label>
                <Input
                  type="number"
                  value={form.hourly_rate_frontend}
                  onChange={(e) => setForm({ ...form, hourly_rate_frontend: e.target.value })}
                />
              </Field>
              <Field>
                <Label>Hourly Rate (Backend)</Label>
                <Input
                  type="number"
                  value={form.hourly_rate_backend}
                  onChange={(e) => setForm({ ...form, hourly_rate_backend: e.target.value })}
                />
              </Field>
              <Field>
                <Label>Hourly Rate (Production)</Label>
                <Input
                  type="number"
                  value={form.hourly_rate_production}
                  onChange={(e) => setForm({ ...form, hourly_rate_production: e.target.value })}
                />
              </Field>
              <Field>
                <Label>Annual Maintenance Price</Label>
                <Input
                  type="number"
                  value={form.maintenance_price}
                  onChange={(e) => setForm({ ...form, maintenance_price: e.target.value })}
                />
              </Field>
              <Field>
                <Label>Project Start Date</Label>
                <Input
                  type="date"
                  value={form.project_start_date}
                  onChange={(e) => setForm({ ...form, project_start_date: e.target.value })}
                />
              </Field>
              <Field>
                <Label className="flex items-center gap-2">Can Book Offline Meetings</Label>
                <input
                  type="checkbox"
                  checked={form.can_book_offline_meeting}
                  onChange={(e) => setForm({ ...form, can_book_offline_meeting: e.target.checked })}
                />
              </Field>
              <div className="md:col-span-3">
                <Button type="submit">Create Client</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>Client Accounts</CardHeader>
        <CardBody>
          {clients.length === 0 ? (
            <EmptyState>No clients yet.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Status</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <Td>{c.full_name}</Td>
                    <Td className="font-mono">{c.email}</Td>
                    <Td>{c.is_active ? "Active" : "Deactivated"}</Td>
                    <Td>
                      <Link href={`/admin/users/${c.id}`} className="text-amber underline">
                        Configure
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
