"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { apiRequest, clearTokens, getAccessToken, setTokens } from "@/lib/api";
import { User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiRequest<User>("/api/auth/me");
      setUser(me);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await apiRequest<{ access_token: string; refresh_token: string }>("/api/auth/login", {
        method: "POST",
        body: { email, password },
        skipAuth: true,
      });
      setTokens(tokens.access_token, tokens.refresh_token);
      await refreshUser();
    },
    [refreshUser]
  );

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem("garia_refresh_token");
    try {
      if (refreshToken) {
        await apiRequest("/api/auth/logout", { method: "POST", body: { refresh_token: refreshToken } });
      }
    } catch {
      // best-effort revoke
    }
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
