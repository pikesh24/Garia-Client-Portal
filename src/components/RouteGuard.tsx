"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { UserRole } from "@/lib/types";

const HOME_BY_ROLE: Record<UserRole, string> = { admin: "/admin", client: "/", developer: "/admin" };

export function RouteGuard({ role, children }: { role: UserRole | UserRole[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = Array.isArray(role) ? role : [role];

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!allowed.includes(user.role)) {
      router.replace(HOME_BY_ROLE[user.role]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, role, router]);

  if (loading || !user || !allowed.includes(user.role)) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas text-text-muted">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
