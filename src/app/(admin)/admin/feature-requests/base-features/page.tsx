"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { useAdminProjectFilter } from "@/components/AdminProjectFilter";
import { ClientProjectCardPicker } from "@/components/ClientProjectCardPicker";

export default function AdminBaseFeaturesPickerPage() {
  const router = useRouter();
  const [filter, setFilter] = useAdminProjectFilter();

  useEffect(() => {
    if (filter.clientId && filter.projectId) {
      router.replace(`/admin/users/${filter.clientId}/projects/${filter.projectId}/base-features`);
    }
  }, [filter.clientId, filter.projectId, router]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Base + Extra Features"
        action={
          <Link href="/admin/feature-requests" className="text-amber underline">
            ← Back to Features
          </Link>
        }
      />
      <p className="font-data-mono text-sm uppercase tracking-widest text-text-muted">
        Select a client, then a project, to view and manage its base project and extra features.
      </p>
      <ClientProjectCardPicker value={filter} onChange={setFilter} />
    </div>
  );
}
