"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { User } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { BaseProjectSection } from "@/components/BaseProjectSection";

export default function AdminBaseFeaturesClientPage() {
  const params = useParams<{ clientId: string }>();
  const [client, setClient] = useState<User | null>(null);

  useEffect(() => {
    apiRequest<User>(`/api/admin/users/${params.clientId}`).then(setClient);
  }, [params.clientId]);

  if (!client) return <p className="text-text-muted">Loading...</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Base + Extra Features — ${client.full_name}`}
        action={
          <Link href="/admin/feature-requests/base-features" className="text-amber underline">
            ← Back to Clients
          </Link>
        }
      />
      <BaseProjectSection clientId={params.clientId} client={client} />
    </div>
  );
}
