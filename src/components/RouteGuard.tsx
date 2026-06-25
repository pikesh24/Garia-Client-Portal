"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { UserRole } from "@/lib/types";

export function RouteGuard({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== role) {
      router.replace(user.role === "admin" ? "/admin" : "/");
    }
  }, [loading, user, role, router]);

  if (loading || !user || user.role !== role) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas text-text-muted">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
