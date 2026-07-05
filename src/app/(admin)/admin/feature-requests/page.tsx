"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui";

export default function AdminFeaturesLandingPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Features" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Link
          href="/admin/feature-requests/requests"
          className="text-left bg-bg-base border-4 border-border-strong p-card-padding relative overflow-hidden shadow-[8px_8px_0px_0px_var(--shadow-strong)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[12px_12px_0px_0px_var(--shadow-strong)] transition-all block"
        >
          <h3 className="font-headline-lg text-headline-lg font-black uppercase text-text-main mb-3 leading-tight">
            Feature Requests
          </h3>
          <p className="text-sm text-text-muted">
            Review, discuss, and resolve feature requests submitted by clients.
          </p>
        </Link>

        <Link
          href="/admin/feature-requests/base-features"
          className="text-left bg-bg-base border-4 border-border-strong p-card-padding relative overflow-hidden shadow-[8px_8px_0px_0px_var(--shadow-strong)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[12px_12px_0px_0px_var(--shadow-strong)] transition-all block"
        >
          <h3 className="font-headline-lg text-headline-lg font-black uppercase text-text-main mb-3 leading-tight">
            Base + Extra Features
          </h3>
          <p className="text-sm text-text-muted">
            Select a client, then a project, to view and manage its base project and extra features, hours, and pricing.
          </p>
        </Link>
      </div>
    </div>
  );
}
