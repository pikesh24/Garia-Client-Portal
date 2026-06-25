"use client";

import { usePathname } from "next/navigation";
import { RouteGuard } from "@/components/RouteGuard";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

const labels: Record<string, string> = {
  "/admin": "GLOBAL DASHBOARD",
  "/admin/profile": "PROFILE",
  "/admin/users": "CLIENT ACCOUNTS MATRIX",
  "/admin/meetings": "UNIFIED MEETINGS CALENDAR",
  "/admin/tickets": "SUPPORT TICKET COMMAND",
  "/admin/feature-requests": "FEATURES & PROPOSALS PIPELINE",
  "/admin/billing": "BILLING, INVOICES & DISCOUNTS",
};

export default function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const label = labels[pathname] ?? "ADMIN PORTAL";

  return (
    <RouteGuard role="admin">
      <div className="min-h-screen">
        <Sidebar variant="admin" />
        <Header breadcrumbs={["ADMIN PORTAL", label]} />
        <main className="md:ml-64 pt-20 md:pt-24 pb-20 px-gutter md:px-margin-page z-10 relative">
          {children}
        </main>
      </div>
    </RouteGuard>
  );
}

