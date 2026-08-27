"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { getAccessToken } from "@/lib/api";
import { realtimeSocket, RECONNECTED_EVENT, RealtimeEvent } from "@/lib/ws";
import { markFeatureRequestUnread } from "@/lib/unreadFeatureMessages";

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    const token = getAccessToken();
    if (!token) return;

    realtimeSocket.connect(token);
    return () => realtimeSocket.disconnect();
  }, [loading, user]);

  useEffect(() => {
    if (loading || !user) return;

    return realtimeSocket.subscribeRaw((event: RealtimeEvent) => {
      if (event.resource !== "feature_requests" || event.kind !== "message") return;
      const featureRequestId = event.feature_request_id as number;
      const featureName = (event.feature_name as string) ?? "a feature request";
      const senderRole = (event.sender_role as string) ?? "someone";

      markFeatureRequestUnread(featureRequestId);

      const isBaseFeature = event.is_base_feature === true;
      const destination =
        user.role === "client"
          ? isBaseFeature
            ? `/project-features?featureId=${featureRequestId}`
            : `/feature-requests?featureId=${featureRequestId}`
          : isBaseFeature
            ? `/admin/feature-requests/base-features?clientId=${event.client_id}&projectId=${event.project_id}&featureId=${featureRequestId}`
            : `/admin/feature-requests/requests?clientId=${event.client_id}&projectId=${event.project_id}&featureId=${featureRequestId}`;

      toast.info(`New message on "${featureName}"`, {
        description: `From ${senderRole}`,
        action: { label: "View", onClick: () => router.push(destination) },
      });
    });
  }, [loading, user, router]);

  return <>{children}</>;
}

export function useWsEvent(resource: string): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    const unsubResource = realtimeSocket.subscribe(resource, bump);
    const unsubReconnect = realtimeSocket.subscribe(RECONNECTED_EVENT, bump);
    return () => {
      unsubResource();
      unsubReconnect();
    };
  }, [resource]);

  return version;
}
