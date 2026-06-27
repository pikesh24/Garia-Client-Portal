"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { Project, User } from "@/lib/types";
import { PaginatedCardGrid } from "@/components/PaginatedCardGrid";
import { ProjectFilterValue } from "@/components/AdminProjectFilter";

export function ClientProjectCardPicker({
  value,
  onChange,
}: {
  value: ProjectFilterValue;
  onChange: (v: ProjectFilterValue) => void;
}) {
  const [clients, setClients] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    apiRequest<User[]>("/api/admin/users").then(setClients);
  }, []);

  useEffect(() => {
    if (!value.clientId) {
      setProjects([]);
      return;
    }
    apiRequest<Project[]>(`/api/admin/users/${value.clientId}/projects`).then(setProjects);
  }, [value.clientId]);

  if (value.clientId && value.projectId) {
    const client = clients.find((c) => String(c.id) === value.clientId);
    const project = projects.find((p) => String(p.id) === value.projectId);
    return (
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-4 border-border-strong bg-bg-panel-alt p-6 shadow-[6px_6px_0px_0px_var(--border-strong)]">
        <div className="font-data-mono text-sm">
          <span className="font-bold uppercase text-text-muted mr-2">Client:</span>
          <span className="font-bold text-text-main mr-6">{client?.full_name ?? `#${value.clientId}`}</span>
          <span className="font-bold uppercase text-text-muted mr-2">Project:</span>
          <span className="font-bold text-text-main">{project?.name ?? `#${value.projectId}`}</span>
        </div>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => onChange({ clientId: value.clientId, projectId: "" })}
            className="font-data-mono text-[10px] uppercase tracking-widest text-amber underline"
          >
            Change Project
          </button>
          <button
            type="button"
            onClick={() => onChange({ clientId: "", projectId: "" })}
            className="font-data-mono text-[10px] uppercase tracking-widest text-amber underline"
          >
            Change Client
          </button>
        </div>
      </div>
    );
  }

  if (!value.clientId) {
    return (
      <div className="space-y-6">
        <h3 className="font-label-caps text-xs font-black uppercase tracking-widest text-text-muted">
          Select a Client
        </h3>
        <PaginatedCardGrid
          items={clients}
          emptyMessage="No clients yet."
          renderItem={(c, index) => {
            const watermark = String.fromCharCode(65 + (index % 26));
            const initial = c.full_name ? c.full_name[0].toUpperCase() : "?";
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onChange({ clientId: String(c.id), projectId: "" })}
                className="group block h-full text-left"
              >
                <div className="relative overflow-hidden bg-bg-panel-alt border-4 border-border-strong shadow-[8px_8px_0px_0px_var(--border-strong)] transition-all hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_var(--border-strong)] h-full flex flex-col p-6">
                  <div className="absolute bottom-2 right-6 text-[100px] font-black text-border-strong/10 select-none z-0 leading-none pointer-events-none">
                    {watermark}
                  </div>

                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-10">
                      <div className="w-10 h-10 bg-coral-red border-2 border-border-strong flex items-center justify-center font-bold text-white shadow-[3px_3px_0px_0px_var(--border-strong)] text-xl">
                        {initial}
                      </div>
                      <div
                        className={`px-2 py-1 text-[10px] font-bold tracking-widest uppercase ${
                          c.is_active ? "bg-forest-green text-white" : "bg-border-muted text-white"
                        }`}
                      >
                        {c.is_active ? "Active" : "Inactive"}
                      </div>
                    </div>

                    <div className="mb-10">
                      <h2 className="font-headline-lg text-2xl font-black uppercase text-text-main mb-1 truncate">
                        {c.full_name}
                      </h2>
                      <p className="font-data-mono text-xs text-text-muted">{c.email}</p>
                    </div>
                  </div>

                  <div className="mt-auto relative z-10 border-t-2 border-border-strong pt-4 flex justify-between items-center group-hover:border-text-main transition-colors">
                    <span className="font-label-caps text-[10px] font-black uppercase tracking-widest text-text-main">
                      Select Client
                    </span>
                    <span className="material-symbols-outlined text-text-main transition-transform group-hover:translate-x-1 text-sm font-bold">
                      arrow_forward
                    </span>
                  </div>
                </div>
              </button>
            );
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-label-caps text-xs font-black uppercase tracking-widest text-text-muted">
          Select a Project
        </h3>
        <button
          type="button"
          onClick={() => onChange({ clientId: "", projectId: "" })}
          className="font-data-mono text-[10px] uppercase tracking-widest text-amber underline"
        >
          ← Change Client
        </button>
      </div>
      <PaginatedCardGrid
        items={projects}
        emptyMessage="No projects yet for this client."
        renderItem={(p, index) => {
          const watermark = String.fromCharCode(65 + (index % 26));
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange({ clientId: value.clientId, projectId: String(p.id) })}
              className="group block h-full text-left"
            >
              <div className="relative overflow-hidden bg-bg-panel-alt border-4 border-border-strong shadow-[8px_8px_0px_0px_var(--border-strong)] transition-all hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_var(--border-strong)] h-full flex flex-col p-6">
                <div className="absolute bottom-2 right-6 text-[100px] font-black text-border-strong/10 select-none z-0 leading-none pointer-events-none">
                  {watermark}
                </div>

                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-10">
                    <div className="w-10 h-10 bg-coral-red border-2 border-border-strong flex items-center justify-center font-bold text-white shadow-[3px_3px_0px_0px_var(--border-strong)] text-xl">
                      {p.name ? p.name[0].toUpperCase() : "?"}
                    </div>
                    <div
                      className={`px-2 py-1 text-[10px] font-bold tracking-widest uppercase ${
                        p.status === "active" ? "bg-forest-green text-white" : "bg-border-muted text-white"
                      }`}
                    >
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
                    Select Project
                  </span>
                  <span className="material-symbols-outlined text-text-main transition-transform group-hover:translate-x-1 text-sm font-bold">
                    arrow_forward
                  </span>
                </div>
              </div>
            </button>
          );
        }}
      />
    </div>
  );
}
