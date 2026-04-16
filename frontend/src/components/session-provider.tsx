"use client";

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { apiRequest } from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth-token";
import type { AuthResponse, User } from "@/lib/types";
import { useUiStore } from "@/store/ui-store";

interface SessionContextValue {
  user: User | null;
  loading: boolean;
  bootstrap: (user: User | null) => Promise<void>;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async (nextUser: User | null) => {
    if (!nextUser) {
      clearAuthToken();
      setUser(null);
      useUiStore.getState().resetAll();
      return;
    }

    setUser(nextUser);
    try {
      const response = await apiRequest<{ status: string; states: Record<string, unknown> }>("/api/page-states");
      useUiStore.getState().hydrateRemoteStates(response.states);
    } catch (error) {
      console.error("Failed to hydrate page states", error);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      await bootstrap(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest<AuthResponse>("/api/auth/me");
      await bootstrap(response.user);
    } catch {
      await bootstrap(null);
    } finally {
      setLoading(false);
    }
  }, [bootstrap]);

  const logout = useCallback(async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } finally {
      await bootstrap(null);
    }
  }, [bootstrap]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  return <SessionContext.Provider value={{ user, loading, bootstrap, refreshSession, logout }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}
