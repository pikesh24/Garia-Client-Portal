"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { Project } from "@/lib/types";
import { Button, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";

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
      <Card>
        <CardHeader>Management Areas</CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link href={`/admin/users/${params.id}/projects/${params.projectId}/base-features`}>
              <Button type="button" variant="secondary" className="w-full">
                Base + Extra Features
              </Button>
            </Link>
            <Link href={`/admin/tickets?clientId=${params.id}&projectId=${params.projectId}`}>
              <Button type="button" variant="secondary" className="w-full">
                Support Tickets
              </Button>
            </Link>
            <Link href={`/admin/meetings?clientId=${params.id}&projectId=${params.projectId}`}>
              <Button type="button" variant="secondary" className="w-full">
                Meetings
              </Button>
            </Link>
            <Link href={`/admin/billing?clientId=${params.id}&projectId=${params.projectId}`}>
              <Button type="button" variant="secondary" className="w-full">
                Billing
              </Button>
            </Link>
            <Link href={`/admin/maintenance?clientId=${params.id}&projectId=${params.projectId}`}>
              <Button type="button" variant="secondary" className="w-full">
                Maintenance
              </Button>
            </Link>
            <Link href={`/admin/billing?clientId=${params.id}&projectId=${params.projectId}&tab=discounts`}>
              <Button type="button" variant="secondary" className="w-full">
                Discounts
              </Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
