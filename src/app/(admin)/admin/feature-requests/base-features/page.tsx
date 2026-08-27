"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { Project, User } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { useAdminProjectFilter } from "@/components/AdminProjectFilter";
import { ClientProjectCardPicker } from "@/components/ClientProjectCardPicker";
import { BaseProjectSection } from "@/components/BaseProjectSection";

export default function AdminBaseFeaturesPickerPage() {
  const [filter, setFilter] = useAdminProjectFilter();
  const [client, setClient] = useState<User | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!filter.clientId || !filter.projectId) {
      setClient(null);
      setProject(null);
      return;
    }
    apiRequest<User>(`/api/admin/users/${filter.clientId}`).then(setClient);
    apiRequest<Project>(`/api/admin/users/${filter.clientId}/projects/${filter.projectId}`).then(setProject);
  }, [filter.clientId, filter.projectId]);

  const showSection = filter.clientId && filter.projectId && client && project;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Base + Extra Features"
        action={
          <Link
            href="/admin/feature-requests"
            className="inline-flex items-center gap-2 font-label-caps text-xs font-black uppercase tracking-widest border-2 border-border-strong bg-bg-panel-alt px-6 py-3 text-text-main transition-all shadow-[4px_4px_0px_0px_var(--shadow-strong)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_var(--shadow-strong)] hover:bg-text-main hover:text-bg-base"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Back to Features
          </Link>
        }
      />
      <p className="font-data-mono text-sm uppercase tracking-widest text-text-muted">
        Select a client, then a project, to view and manage its base project and extra features.
      </p>
      <ClientProjectCardPicker value={filter} onChange={setFilter} />

      {filter.clientId && filter.projectId && !showSection && <p className="text-text-muted">Loading...</p>}

      {showSection && (
        <BaseProjectSection projectId={filter.projectId} client={client} project={project} />
      )}
    </div>
  );
}
