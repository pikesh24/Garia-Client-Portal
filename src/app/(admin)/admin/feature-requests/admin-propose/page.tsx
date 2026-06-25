"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, ApiError } from "@/lib/api";
import { User } from "@/lib/types";
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Label, PageHeader, Select, Textarea } from "@/components/ui";

export default function AdminProposeFeaturePage() {
  const router = useRouter();
  const [clients, setClients] = useState<User[]>([]);
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isBaseFeature, setIsBaseFeature] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<User[]>("/api/admin/users").then(setClients);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const endpoint = isBaseFeature
        ? "/api/admin/feature-requests/inject-base-feature"
        : "/api/admin/feature-requests/admin-propose";
      await apiRequest(endpoint, { method: "POST", body: { client_id: Number(clientId), name, description } });
      router.push("/admin/feature-requests");
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not propose feature");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Propose Optimization Module" />
      <Card>
        <CardHeader>New Proposal</CardHeader>
        <CardBody>
          <form onSubmit={submit}>
            {error && <Alert>{error}</Alert>}
            <Field>
              <Label>Client</Label>
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} ({c.email})
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label>Name</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field>
              <Label>Description</Label>
              <Textarea required value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field>
              <Label className="flex items-center gap-2">Inject as Base Project Feature</Label>
              <input type="checkbox" checked={isBaseFeature} onChange={(e) => setIsBaseFeature(e.target.checked)} />
            </Field>
            <Button type="submit">{isBaseFeature ? "Inject Base Feature" : "Send Proposal to Client"}</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
