"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { Project, User } from "@/lib/types";
import { BrutalistSelect } from "@/components/BrutalistSelect";

export interface ProjectFilterValue {
  clientId: string;
  projectId: string;
}

/**
 * Client + Project selector synced to the URL (?clientId=&projectId=), so a project
 * picked from the deep-link tile menu lands here pre-selected instead of forcing the
 * admin to re-pick it, while still letting the admin change project from this page directly.
 */
export function useAdminProjectFilter(): [ProjectFilterValue, (v: ProjectFilterValue) => void] {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams.get("clientId") ?? "";
  const projectId = searchParams.get("projectId") ?? "";

  function setValue(v: ProjectFilterValue) {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (v.clientId) params.set("clientId", v.clientId);
    else params.delete("clientId");
    if (v.projectId) params.set("projectId", v.projectId);
    else params.delete("projectId");
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return [{ clientId, projectId }, setValue];
}

export function AdminProjectFilter({
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-4 border-border-strong bg-bg-panel-alt p-6 shadow-[6px_6px_0px_0px_var(--border-strong)] mb-8">
      <div>
        <label className="block font-label-caps text-xs font-black uppercase tracking-widest text-text-muted mb-2">
          Client
        </label>
        <BrutalistSelect
          value={value.clientId}
          onChange={(clientId) => onChange({ clientId, projectId: "" })}
          placeholder="-- ALL CLIENTS --"
          options={clients.map((c) => ({ value: String(c.id), label: `${c.full_name} (${c.email})` }))}
        />
      </div>
      <div>
        <label className="block font-label-caps text-xs font-black uppercase tracking-widest text-text-muted mb-2">
          Project
        </label>
        <BrutalistSelect
          value={value.projectId}
          onChange={(projectId) => onChange({ clientId: value.clientId, projectId })}
          placeholder={value.clientId ? "-- ALL PROJECTS --" : "-- SELECT A CLIENT FIRST --"}
          options={projects.map((p) => ({ value: String(p.id), label: p.name }))}
        />
      </div>
    </div>
  );
}
