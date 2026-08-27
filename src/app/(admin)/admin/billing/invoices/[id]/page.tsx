"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest, ApiError } from "@/lib/api";
import {
  Discount,
  FeatureRequest,
  InfrastructureCostEntry,
  Invoice,
  MaintenanceRecord,
  Project,
  User,
} from "@/lib/types";
import { Alert } from "@/components/ui";
import { InvoiceDetailView, ProjectDetailData } from "@/components/invoice/InvoiceDetailView";

export default function AdminInvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [client, setClient] = useState<User | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [detail, setDetail] = useState<ProjectDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<Invoice>(`/api/admin/billing/invoices/${params.id}`)
      .then(setInvoice)
      .catch((err) => setError(err instanceof ApiError ? String(err.detail) : "Could not load invoice"))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (!invoice) return;
    Promise.all([
      apiRequest<User>(`/api/admin/users/${invoice.client_id}`),
      apiRequest<Project>(`/api/admin/users/${invoice.client_id}/projects/${invoice.project_id}`),
      apiRequest<FeatureRequest[]>(`/api/admin/projects/${invoice.project_id}/feature-requests?include_base_features=true`),
      apiRequest<InfrastructureCostEntry[]>(`/api/admin/projects/${invoice.project_id}/maintenance/infrastructure-costs`),
      apiRequest<MaintenanceRecord[]>(`/api/admin/projects/${invoice.project_id}/maintenance/records`),
      apiRequest<Discount[]>(`/api/admin/projects/${invoice.project_id}/discounts`),
    ])
      .then(([c, p, features, infraCosts, maintenance, discounts]) => {
        setClient(c);
        setProject(p);
        setDetail({
          features,
          infraCosts,
          maintenance,
          discount: discounts.find((d) => d.is_active) ?? null,
        });
      })
      .catch((err) => setError(err instanceof ApiError ? String(err.detail) : "Could not load invoice detail"));
  }, [invoice]);

  if (loading) {
    return (
      <div className="flex justify-start py-12">
        <div className="font-data-mono font-bold text-2xl animate-pulse">LOADING_RECORD...</div>
      </div>
    );
  }

  if (error || !invoice) {
    return <Alert>{error ?? "Invoice not found"}</Alert>;
  }

  return (
    <InvoiceDetailView
      invoice={invoice}
      detail={detail}
      detailLoading={!detail}
      billedToName={client?.full_name ?? `Client #${invoice.client_id}`}
      billedToEmail={client?.email ?? ""}
      projectName={project?.name ?? `Project #${invoice.project_id}`}
      canExport
      onBack={() => router.push("/admin/billing")}
      backLabel="INVOICE REGISTRY"
    />
  );
}
