"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiRequest, ApiError } from "@/lib/api";
import { InfrastructureCostEntry, Project } from "@/lib/types";
import { Alert, Button, EmptyState, Field, Input, Label, PageHeader } from "@/components/ui";
import { BrutalistDatePicker } from "@/components/BrutalistDatePicker";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/date";
import { useWsEvent } from "@/components/WebSocketProvider";

const emptyForm = {
  name: "",
  hourly_rate_frontend: "",
  hourly_rate_backend: "",
  hourly_rate_production: "",
  maintenance_price: "",
  project_start_date: "",
};

export default function AdminClientProjectsPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const canManage = user?.role !== "developer";
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const projectsVersion = useWsEvent("projects");

  async function load() {
    const data = await apiRequest<Project[]>(`/api/admin/users/${params.id}/projects`);
    setProjects(data);
  }

  useEffect(() => {
    load();
  }, [params.id, projectsVersion]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest(`/api/admin/users/${params.id}/projects`, {
        method: "POST",
        body: {
          name: form.name,
          hourly_rate_frontend: form.hourly_rate_frontend ? Number(form.hourly_rate_frontend) : null,
          hourly_rate_backend: form.hourly_rate_backend ? Number(form.hourly_rate_backend) : null,
          hourly_rate_production: form.hourly_rate_production ? Number(form.hourly_rate_production) : null,
          maintenance_price: form.maintenance_price ? Number(form.maintenance_price) : null,
          project_start_date: form.project_start_date || null,
        },
      });
      setShowForm(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not create project");
    }
  }

  return (
    <div className="space-y-12">
      <PageHeader
        title="Client Projects"
        action={canManage ? <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "New Project"}</Button> : undefined}
      />

      {canManage && showForm && (
        <div className="border-4 border-border-strong bg-bg-panel-alt shadow-[8px_8px_0px_0px_var(--shadow-strong)] p-6 md:p-8">
          <h3 className="font-display-xl text-3xl font-black uppercase text-text-main mb-6 border-b-4 border-border-strong pb-4">
            Create Project
          </h3>
          <form onSubmit={createProject} className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {error && (
              <div className="md:col-span-3">
                <Alert>{error}</Alert>
              </div>
            )}
            <Field>
              <Label>Project Name</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
              <Label>Server Maintenance Price</Label>
              <Input
                type="number"
                value={form.maintenance_price}
                onChange={(e) => setForm({ ...form, maintenance_price: e.target.value })}
              />
            </Field>
            <Field>
              <Label>Project Start Date</Label>
              <BrutalistDatePicker
                value={form.project_start_date}
                onChange={(val) => setForm({ ...form, project_start_date: val })}
              />
            </Field>
            <div className="md:col-span-3 mt-4 pt-6 border-t-4 border-border-strong border-dashed flex justify-end">
              <Button type="submit">Create Project</Button>
            </div>
          </form>
        </div>
      )}

      {projects.length === 0 ? (
        <EmptyState>No projects yet for this client.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {projects.map((p, index) => (
            <ProjectCard
              key={p.id}
              project={p}
              clientId={params.id}
              watermark={String.fromCharCode(65 + (index % 26))}
              canManage={canManage}
              onSaved={(updated) => setProjects((prev) => prev.map((pr) => (pr.id === updated.id ? updated : pr)))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  clientId,
  watermark,
  canManage,
  onSaved,
}: {
  project: Project;
  clientId: string;
  watermark: string;
  canManage: boolean;
  onSaved: (updated: Project) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project);
  const [infraCosts, setInfraCosts] = useState<InfrastructureCostEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    setDraft(project);
    apiRequest<InfrastructureCostEntry[]>(`/api/admin/projects/${project.id}/maintenance/infrastructure-costs`).then(
      setInfraCosts
    );
  }, [editing, project]);

  const annualInfraTotal = infraCosts.reduce((sum, c) => sum + c.monthly_overhead_price, 0) * 12;
  const totalMaintenancePrice = (draft.maintenance_price ?? 0) + annualInfraTotal;

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const updated = await apiRequest<Project>(`/api/admin/users/${clientId}/projects/${project.id}`, {
        method: "PATCH",
        body: {
          hourly_rate_frontend: draft.hourly_rate_frontend,
          hourly_rate_backend: draft.hourly_rate_backend,
          hourly_rate_production: draft.hourly_rate_production,
          maintenance_price: draft.maintenance_price,
          project_start_date: draft.project_start_date,
        },
      });
      onSaved(updated);
      setMessage("Project billing configuration updated.");
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Update failed");
    }
  }

  return (
    <div className="relative overflow-hidden bg-bg-panel-alt border-4 border-border-strong shadow-[8px_8px_0px_0px_var(--shadow-strong)] flex flex-col p-6">
      <div className="absolute bottom-2 right-6 text-[100px] font-black text-border-strong/10 select-none z-0 leading-none pointer-events-none">
        {watermark}
      </div>

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-8">
          <div className="w-10 h-10 bg-brand-green border-2 border-border-strong flex items-center justify-center font-bold text-on-brand-green shadow-[3px_3px_0px_0px_var(--shadow-strong)] text-xl">
            {project.name ? project.name[0].toUpperCase() : "?"}
          </div>
          <div className={`px-2 py-1 text-[10px] font-bold tracking-widest uppercase ${project.status === "active" ? "bg-brand-green text-white" : "bg-coral-red text-white"}`}>
            {project.status === "active" ? "Active" : "Inactive"}
          </div>
        </div>

        <div className="mb-8">
          <h2 className="font-headline-lg text-2xl font-black uppercase text-text-main mb-1 truncate">
            {project.name}
          </h2>
          <p className="font-data-mono text-xs text-text-muted">
            Created {formatDate(project.created_at)}
          </p>
        </div>

        {editing && (
          <div className="bg-bg-base border-4 border-border-strong p-4 md:p-6 mb-8">
            {message && <Alert kind="warning">{message}</Alert>}
            {error && <Alert>{error}</Alert>}
            {canManage ? (
              <form onSubmit={saveSettings} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <Label>Hourly Rate (Frontend)</Label>
                  <Input
                    type="number"
                    value={draft.hourly_rate_frontend ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, hourly_rate_frontend: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </Field>
                <Field>
                  <Label>Hourly Rate (Backend)</Label>
                  <Input
                    type="number"
                    value={draft.hourly_rate_backend ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, hourly_rate_backend: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </Field>
                <Field>
                  <Label>Hourly Rate (Production)</Label>
                  <Input
                    type="number"
                    value={draft.hourly_rate_production ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, hourly_rate_production: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </Field>
                <Field>
                  <Label>Server Maintenance Price</Label>
                  <Input
                    type="number"
                    value={draft.maintenance_price ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, maintenance_price: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </Field>
                <Field>
                  <Label>Total Maintenance Price (Auto-calculated)</Label>
                  <Input value={`₹${totalMaintenancePrice.toFixed(2)}`} disabled />
                </Field>
                <Field>
                  <Label>Project Start Date</Label>
                  <BrutalistDatePicker
                    value={draft.project_start_date ?? ""}
                    onChange={(val) => setDraft({ ...draft, project_start_date: val || null })}
                  />
                </Field>
                <div className="sm:col-span-2 flex justify-end pt-2">
                  <Button type="submit">Save Billing Configuration</Button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <Label>Hourly Rate (Frontend)</Label>
                  <Input value={project.hourly_rate_frontend ?? "—"} disabled />
                </Field>
                <Field>
                  <Label>Hourly Rate (Backend)</Label>
                  <Input value={project.hourly_rate_backend ?? "—"} disabled />
                </Field>
                <Field>
                  <Label>Hourly Rate (Production)</Label>
                  <Input value={project.hourly_rate_production ?? "—"} disabled />
                </Field>
                <Field>
                  <Label>Server Maintenance Price</Label>
                  <Input value={project.maintenance_price ?? "—"} disabled />
                </Field>
                <Field>
                  <Label>Total Maintenance Price (Auto-calculated)</Label>
                  <Input value={`₹${totalMaintenancePrice.toFixed(2)}`} disabled />
                </Field>
                <Field>
                  <Label>Project Start Date</Label>
                  <Input value={project.project_start_date ?? "—"} disabled />
                </Field>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto relative z-10 border-t-2 border-border-strong pt-6 flex flex-col sm:flex-row gap-3">
        <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditing((v) => !v)}>
          {editing ? "Hide Billing Config" : "Edit Billing Config"}
        </Button>
        <Link href={`/admin/feature-requests/base-features?clientId=${clientId}&projectId=${project.id}`} className="flex-1">
          <Button type="button" className="w-full">
            Manage Base + Extra Features
          </Button>
        </Link>
      </div>
    </div>
  );
}
