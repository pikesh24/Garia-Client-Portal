"use client";

import { usePathname } from "next/navigation";
import { RouteGuard } from "@/components/RouteGuard";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { ProjectProvider } from "@/lib/project-context";

const labels: Record<string, string> = {
  "/": "Dashboard",
  "/profile": "Profile",
  "/feature-requests": "Feature Requests",
  "/project-features": "Base Project",
  "/tickets": "Support Tickets",
  "/meetings": "Meetings Calendar",
  "/maintenance": "Maintenance Schedule",
};

export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const label = labels[pathname] ?? "Client Portal";

  return (
    <RouteGuard role="client">
      <ProjectProvider>
        <div className="min-h-screen">
          <Sidebar variant="client" />
          <Header breadcrumbs={[label]} />
          <main className="md:ml-64 pt-20 md:pt-24 pb-20 px-gutter md:px-margin-page z-10 relative">
            {children}
          </main>
        </div>
      </ProjectProvider>
    </RouteGuard>
  );
}

