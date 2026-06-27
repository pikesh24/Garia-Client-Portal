"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiRequest, ApiError } from "@/lib/api";
import { Project } from "@/lib/types";
import { Alert, Button, EmptyState, Field, Input, Label, PageHeader } from "@/components/ui";

export default function AdminClientProjectsPage() {
  const params = useParams<{ id: string }>();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await apiRequest<Project[]>(`/api/admin/users/${params.id}/projects`);
    setProjects(data);
  }

  useEffect(() => {
    load();
  }, [params.id]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest(`/api/admin/users/${params.id}/projects`, {
        method: "POST",
        body: { name },
      });
      setShowForm(false);
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not create project");
    }
  }

  return (
    <div className="space-y-12">
      <PageHeader
        title="Client Projects"
        action={<Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "New Project"}</Button>}
      />

      {showForm && (
        <div className="border-4 border-border-strong bg-bg-panel-alt shadow-[8px_8px_0px_0px_var(--border-strong)] p-6 md:p-8">
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
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((p, index) => {
            const watermark = String.fromCharCode(65 + (index % 26));
            return (
              <Link key={p.id} href={`/admin/users/${params.id}/projects/${p.id}`} className="group block h-full">
                <div className="relative overflow-hidden bg-bg-panel-alt border-4 border-border-strong shadow-[8px_8px_0px_0px_var(--border-strong)] transition-all hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_var(--border-strong)] h-full flex flex-col p-6">
                  <div className="absolute bottom-2 right-6 text-[100px] font-black text-border-strong/10 select-none z-0 leading-none pointer-events-none">
                    {watermark}
                  </div>

                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-10">
                      <div className="w-10 h-10 bg-coral-red border-2 border-border-strong flex items-center justify-center font-bold text-white shadow-[3px_3px_0px_0px_var(--border-strong)] text-xl">
                        {p.name ? p.name[0].toUpperCase() : "?"}
                      </div>
                      <div className={`px-2 py-1 text-[10px] font-bold tracking-widest uppercase ${p.status === "active" ? "bg-forest-green text-white" : "bg-border-muted text-white"}`}>
                        {p.status === "active" ? "Active" : "Inactive"}
                      </div>
                    </div>

                    <div className="mb-10">
                      <h2 className="font-headline-lg text-2xl font-black uppercase text-text-main mb-1 truncate">
                        {p.name}
                      </h2>
                      <p className="font-data-mono text-xs text-text-muted">
                        Created {new Date(p.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto relative z-10 border-t-2 border-border-strong pt-4 flex justify-between items-center group-hover:border-text-main transition-colors">
                    <span className="font-label-caps text-[10px] font-black uppercase tracking-widest text-text-main">
                      Manage Project
                    </span>
                    <span className="material-symbols-outlined text-text-main transition-transform group-hover:translate-x-1 text-sm font-bold">
                      arrow_forward
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
