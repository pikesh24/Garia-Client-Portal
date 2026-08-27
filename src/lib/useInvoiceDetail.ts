"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Discount,
  FeatureRequest,
  InfrastructureCostEntry,
  Invoice,
  MaintenanceRecord,
  Project,
  ProjectFeatures,
  ProjectListResponse,
  User,
} from "@/lib/types";
import { ProjectDetailData } from "@/components/invoice/InvoicePrintDocument";

interface InvoiceDetailBundle {
  invoice: Invoice | null;
  detail: ProjectDetailData | null;
  billedToName: string;
  billedToEmail: string;
  projectName: string;
  loading: boolean;
  error: string | null;
}

// Shared by the client billing page, the admin invoice page, and the standalone /print page
// (rendered headlessly for the PDF route) so all three fetch the exact same data the exact same
// way, regardless of which role is viewing.
export function useInvoiceDetail(invoiceId: string | number | undefined): InvoiceDetailBundle {
  const { user, loading: authLoading } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [detail, setDetail] = useState<ProjectDetailData | null>(null);
  const [billedToName, setBilledToName] = useState("");
  const [billedToEmail, setBilledToEmail] = useState("");
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user || invoiceId == null) return;
    let cancelled = false;

    async function run() {
      try {
        const isAdmin = user!.role === "admin" || user!.role === "developer";
        let inv: Invoice;
        if (isAdmin) {
          inv = await apiRequest<Invoice>(`/api/admin/billing/invoices/${invoiceId}`);
        } else {
          const invoices = await apiRequest<Invoice[]>("/api/billing/invoices");
          const found = invoices.find((i) => String(i.id) === String(invoiceId));
          if (!found) throw new Error("Invoice not found");
          inv = found;
        }
        if (cancelled) return;
        setInvoice(inv);

        if (isAdmin) {
          const [client, project, features, infraCosts, maintenance, discounts] = await Promise.all([
            apiRequest<User>(`/api/admin/users/${inv.client_id}`),
            apiRequest<Project>(`/api/admin/users/${inv.client_id}/projects/${inv.project_id}`),
            apiRequest<FeatureRequest[]>(`/api/admin/projects/${inv.project_id}/feature-requests?include_base_features=true`),
            apiRequest<InfrastructureCostEntry[]>(`/api/admin/projects/${inv.project_id}/maintenance/infrastructure-costs`),
            apiRequest<MaintenanceRecord[]>(`/api/admin/projects/${inv.project_id}/maintenance/records`),
            apiRequest<Discount[]>(`/api/admin/projects/${inv.project_id}/discounts`),
          ]);
          if (cancelled) return;
          setBilledToName(client.full_name);
          setBilledToEmail(client.email);
          setProjectName(project.name);
          setDetail({ features, infraCosts, maintenance, discount: discounts.find((d) => d.is_active) ?? null });
        } else {
          const [projects, projectFeatures, infraCosts, maintenance, discount] = await Promise.all([
            apiRequest<ProjectListResponse>("/api/projects"),
            apiRequest<ProjectFeatures>(`/api/projects/${inv.project_id}/project-features`),
            apiRequest<InfrastructureCostEntry[]>(`/api/projects/${inv.project_id}/maintenance/infrastructure-costs`),
            apiRequest<MaintenanceRecord[]>(`/api/projects/${inv.project_id}/maintenance/records`),
            apiRequest<Discount | null>(`/api/projects/${inv.project_id}/discounts/active`),
          ]);
          if (cancelled) return;
          setBilledToName(user!.full_name);
          setBilledToEmail(user!.email);
          setProjectName(projects.projects.find((p) => p.id === inv.project_id)?.name ?? `Project #${inv.project_id}`);
          setDetail({
            features: [...projectFeatures.base_features, ...projectFeatures.extra_features],
            infraCosts,
            maintenance,
            discount,
          });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load invoice");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [invoiceId, user, authLoading]);

  return { invoice, detail, billedToName, billedToEmail, projectName, loading, error };
}
