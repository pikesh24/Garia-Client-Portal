"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { Project } from "@/lib/types";
import { PageHeader } from "@/components/ui";

const AREAS = [
  {
    label: "Base + Extra Features",
    description: "View and manage the project's base features, extra features, hours, and pricing.",
    href: (id: string, projectId: string) => `/admin/users/${id}/projects/${projectId}/base-features`,
  },
  {
    label: "Support Tickets",
    description: "Review and resolve support tickets filed against this project.",
    href: (id: string, projectId: string) => `/admin/tickets?clientId=${id}&projectId=${projectId}`,
  },
  {
    label: "Meetings",
    description: "Confirm, reschedule, or review meetings booked on this project.",
    href: (id: string, projectId: string) => `/admin/meetings?clientId=${id}&projectId=${projectId}`,
  },
  {
    label: "Billing",
    description: "Generate, finalize, and review invoices for this project.",
    href: (id: string, projectId: string) => `/admin/billing?clientId=${id}&projectId=${projectId}`,
  },
  {
    label: "Maintenance",
    description: "Track infrastructure costs and annual maintenance compliance.",
    href: (id: string, projectId: string) => `/admin/maintenance?clientId=${id}&projectId=${projectId}`,
  },
  {
    label: "Discounts",
    description: "Apply or manage discount rules for this project's invoices.",
    href: (id: string, projectId: string) => `/admin/billing?clientId=${id}&projectId=${projectId}&tab=discounts`,
  },
];

export default function AdminProjectMenuPage() {
  const params = useParams<{ id: string; projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    apiRequest<Project>(`/api/admin/users/${params.id}/projects/${params.projectId}`).then(setProject);
  }, [params.id, params.projectId]);

  if (!project) return <p className="text-text-muted">Loading...</p>;

  return (
    <div className="space-y-6">
      <PageHeader title={`Project: ${project.name}`} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {AREAS.map((area) => (
          <Link
            key={area.label}
            href={area.href(params.id, params.projectId)}
            className="text-left bg-bg-base border-4 border-border-strong p-card-padding relative overflow-hidden shadow-[8px_8px_0px_0px_var(--shadow-strong)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[12px_12px_0px_0px_var(--shadow-strong)] transition-all block"
          >
            <h3 className="font-headline-lg text-headline-lg font-black uppercase text-text-main mb-3 leading-tight">
              {area.label}
            </h3>
            <p className="text-sm text-text-muted">{area.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
