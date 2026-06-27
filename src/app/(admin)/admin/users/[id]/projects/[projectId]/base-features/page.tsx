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
          <Link href={`/admin/users/${params.id}/projects/${params.projectId}`} className="text-amber underline">
            ← Back to Project
          </Link>
        }
      />
      <p className="font-data-mono text-sm uppercase tracking-widest text-text-muted -mt-8 mb-4">
        Client: <span className="text-text-main font-bold">{client.full_name}</span>
        <span className="mx-3 text-border-strong">/</span>
        Project: <span className="text-text-main font-bold">{project.name}</span>
      </p>
      <BaseProjectSection projectId={params.projectId} client={client} />
    </div>
  );
}
