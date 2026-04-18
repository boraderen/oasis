"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { BACKEND_WAKEUP_DELAY_MS, BACKEND_WAKEUP_MESSAGE } from "@/lib/backend-wakeup";
import { useSession } from "@/components/session-provider";
import { withBasePath } from "@/lib/env";

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useSession();
  const loginPath = withBasePath("/login");
  const [showBackendWarning, setShowBackendWarning] = useState(false);

  useEffect(() => {
    if (!loading && !user && pathname !== "/login" && pathname !== loginPath) {
      router.replace("/login");
    }
  }, [loading, loginPath, pathname, router, user]);

  useEffect(() => {
    if (!loading) {
      return;
    }

    const timer = window.setTimeout(() => {
      setShowBackendWarning(true);
    }, BACKEND_WAKEUP_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loading]);

  if (loading || !user) {
    return (
      <div className="center-stage">
        <div className="loading-card">
          <div className="loading-orbit" />
          <p>Loading workspace…</p>
          {loading && showBackendWarning ? <p className="loading-note">{BACKEND_WAKEUP_MESSAGE}</p> : null}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
