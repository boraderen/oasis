"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useSession } from "@/components/session-provider";
import { withBasePath } from "@/lib/env";

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useSession();
  const loginPath = withBasePath("/login");

  useEffect(() => {
    if (!loading && !user && pathname !== "/login" && pathname !== loginPath) {
      router.replace("/login");
    }
  }, [loading, loginPath, pathname, router, user]);

  if (loading || !user) {
    return (
      <div className="center-stage">
        <div className="loading-card">
          <div className="loading-orbit" />
          <p>Loading workspace…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
