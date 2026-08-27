"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { Project, User } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { BaseProjectSection } from "@/components/BaseProjectSection";

export default function AdminBaseFeaturesProjectPage() {
  const params = useParams<{ id: string; projectId: string }>();
  const [client, setClient] = useState<User | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    apiRequest<User>(`/api/admin/users/${params.id}`).then(setClient);
    apiRequest<Project>(`/api/admin/users/${params.id}/projects/${params.projectId}`).then(setProject);
  }, [params.id, params.projectId]);

  if (!client || !project) return <p className="text-text-muted">Loading...</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Base + Extra Features"
        action={
          <Link 
            href={`/admin/users/${params.id}/projects`} 
            className="inline-flex items-center gap-2 font-label-caps text-xs font-black uppercase tracking-widest border-2 border-border-strong bg-bg-panel-alt px-6 py-3 text-text-main transition-all shadow-[4px_4px_0px_0px_var(--shadow-strong)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_var(--shadow-strong)] hover:bg-text-main hover:text-bg-base"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Back to Projects
          </Link>
        }
      />
      <div className="-mt-8 mb-10 flex flex-col md:flex-row border-4 border-border-strong bg-bg-base shadow-[6px_6px_0px_0px_var(--shadow-strong)]">
        <div className="flex-1 p-4 md:p-6 border-b-4 md:border-b-0 md:border-r-4 border-border-strong flex flex-col justify-center">
          <span className="font-data-mono text-[10px] text-text-muted font-black tracking-widest uppercase mb-1">Client</span>
          <span className="font-headline-lg text-xl md:text-2xl font-black uppercase text-text-main truncate">{client.full_name}</span>
        </div>
        <div className="flex-1 p-4 md:p-6 bg-brand-green flex flex-col justify-center">
          <span className="font-data-mono text-[10px] text-on-brand-green/80 font-black tracking-widest uppercase mb-1">Project</span>
          <span className="font-headline-lg text-xl md:text-2xl font-black uppercase text-on-brand-green truncate">{project.name}</span>
        </div>
      </div>
      <BaseProjectSection projectId={params.projectId} client={client} project={project} />
    </div>
  );
}
