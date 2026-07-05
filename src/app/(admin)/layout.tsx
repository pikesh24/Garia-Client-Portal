"use client";

import { usePathname } from "next/navigation";
import { RouteGuard } from "@/components/RouteGuard";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { BrandWatermark } from "@/components/ui";

const labels: Record<string, string> = {
  "/admin": "GLOBAL DASHBOARD",
  "/admin/profile": "PROFILE",
  "/admin/users": "CLIENT ACCOUNTS MATRIX",
  "/admin/meetings": "UNIFIED MEETINGS CALENDAR",
  "/admin/tickets": "SUPPORT TICKET COMMAND",
  "/admin/feature-requests": "FEATURES & PROPOSALS PIPELINE",
  "/admin/feature-requests/base-features": "BASE FEATURES PIPELINE",
  "/admin/feature-requests/requests": "EXTRA FEATURE REQUESTS",
  "/admin/billing": "BILLING, INVOICES & DISCOUNTS",
  "/admin/maintenance": "MAINTENANCE",
};

// Dynamic routes (client/project detail pages) can't be keyed by exact pathname above.
const DYNAMIC_LABELS: [RegExp, string][] = [
  [/^\/admin\/users\/[^/]+\/projects\/[^/]+\/base-features$/, "BASE + EXTRA FEATURES"],
  [/^\/admin\/users\/[^/]+\/projects\/[^/]+$/, "PROJECT OVERVIEW"],
  [/^\/admin\/users\/[^/]+\/projects$/, "CLIENT PROJECTS"],
  [/^\/admin\/users\/[^/]+$/, "CLIENT DETAIL"],
];

function labelFor(pathname: string): string {
  if (labels[pathname]) return labels[pathname];
  for (const [pattern, label] of DYNAMIC_LABELS) {
    if (pattern.test(pathname)) return label;
  }
  return "ADMIN PORTAL";
}

export default function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const label = labelFor(pathname);

  return (
    <RouteGuard role="admin">
      <div className="min-h-screen">
        <BrandWatermark />
        <Sidebar variant="admin" />
        <Header breadcrumbs={label === "ADMIN PORTAL" ? [label] : ["ADMIN PORTAL", label]} />
        <main className="md:ml-64 pt-20 md:pt-24 pb-20 px-gutter md:px-margin-page z-10 relative">
          {children}
        </main>
      </div>
    </RouteGuard>
  );
}

