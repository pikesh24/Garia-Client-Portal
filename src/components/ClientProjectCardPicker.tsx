"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { Project, User } from "@/lib/types";
import { PaginatedCardGrid } from "@/components/PaginatedCardGrid";
import { ProjectFilterValue } from "@/components/AdminProjectFilter";
import { formatDate } from "@/lib/date";

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
      <div className="mb-10 flex flex-col md:flex-row border-4 border-border-strong bg-bg-base shadow-[6px_6px_0px_0px_var(--shadow-strong)]">
        <div className="flex-1 p-4 md:p-6 border-b-4 md:border-b-0 md:border-r-4 border-border-strong flex flex-col justify-center relative">
          <div className="flex justify-between items-start mb-1">
            <span className="font-data-mono text-[10px] text-text-muted font-black tracking-widest uppercase">Client</span>
            <button
              type="button"
              onClick={() => onChange({ clientId: "", projectId: "" })}
              className="font-data-mono text-[10px] uppercase tracking-widest text-text-muted hover:text-text-main transition-colors font-bold underline decoration-2 underline-offset-4"
            >
              Change Client
            </button>
          </div>
          <span className="font-headline-lg text-xl md:text-2xl font-black uppercase text-text-main truncate">{client?.full_name ?? `#${value.clientId}`}</span>
        </div>
        <div className="flex-1 p-4 md:p-6 bg-brand-green flex flex-col justify-center relative">
          <div className="flex justify-between items-start mb-1">
            <span className="font-data-mono text-[10px] text-on-brand-green/80 font-black tracking-widest uppercase">Project</span>
            <button
              type="button"
              onClick={() => onChange({ clientId: value.clientId, projectId: "" })}
              className="font-data-mono text-[10px] uppercase tracking-widest text-on-brand-green/80 hover:text-white transition-colors font-bold underline decoration-2 underline-offset-4"
            >
              Change Project
            </button>
          </div>
          <span className="font-headline-lg text-xl md:text-2xl font-black uppercase text-on-brand-green truncate">{project?.name ?? `#${value.projectId}`}</span>
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
                      <div className="w-10 h-10 bg-brand-green border-2 border-border-strong flex items-center justify-center font-bold text-on-brand-green shadow-[3px_3px_0px_0px_var(--border-strong)] text-xl">
                        {initial}
                      </div>
                      <div
                        className={`px-2 py-1 text-[10px] font-bold tracking-widest uppercase text-white ${
                          c.is_active ? "bg-brand-green" : "bg-coral-red"
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
                    <div className="w-10 h-10 bg-brand-green border-2 border-border-strong flex items-center justify-center font-bold text-on-brand-green shadow-[3px_3px_0px_0px_var(--border-strong)] text-xl">
                      {p.name ? p.name[0].toUpperCase() : "?"}
                    </div>
                    <div
                      className={`px-2 py-1 text-[10px] font-bold tracking-widest uppercase text-white ${
                        p.status === "active" ? "bg-brand-green" : "bg-coral-red"
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
                      Created {formatDate(p.created_at)}
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
