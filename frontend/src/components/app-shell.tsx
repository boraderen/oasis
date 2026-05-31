"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSession } from "@/components/session-provider";
import { withBasePath } from "@/lib/env";

const navigationSections = [
  {
    heading: "Workspace",
    items: [
      { href: "/data", label: "Data" },
      { href: "/ocel-flatten", label: "Flatten OCEL" },
    ],
  },
  {
    heading: "Case-centric PM",
    items: [
      { href: "/exploration", label: "Exploration" },
      { href: "/discovery", label: "Discovery" },
      { href: "/conformance", label: "Conformance" },
      { href: "/autopm", label: "AutoPM" },
    ],
  },
  {
    heading: "OCPM",
    items: [
      { href: "/ocpm-exploration", label: "OCPM Exploration" },
      { href: "/ocpm-discovery", label: "OCPM Discovery" },
      { href: "/ocpm-conformance", label: "OCPM Conformance" },
      { href: "/auto-ocpm", label: "AutoOCPM" },
    ],
  },
];

function isRouteActive(pathname: string, href: string) {
  const fullHref = withBasePath(href);
  return (
    pathname === href ||
    pathname === fullHref ||
    pathname.startsWith(`${href}/`) ||
    pathname.startsWith(`${fullHref}/`)
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useSession();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className={sidebarCollapsed ? "app-shell sidebar-collapsed" : "app-shell"}>
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="sidebar-frame">
          <div className="sidebar-header">
            <Link href="/data" className="sidebar-brand-link" aria-label="Oasis">
              <Image className="sidebar-brand-icon" src={withBasePath("/oasis.png")} alt="Oasis" width={36} height={36} />
            </Link>

            <button
              className="sidebar-toggle"
              type="button"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!sidebarCollapsed}
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {sidebarCollapsed ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
              </svg>
            </button>
          </div>

          {!sidebarCollapsed ? (
            <>
              <nav className="sidebar-nav" aria-label="Main sections">
                {navigationSections.map((section) => (
                  <div key={section.heading} className="sidebar-nav-block">
                    <p className="sidebar-nav-heading">{section.heading}</p>
                    {section.items.map((item) => {
                      const active = isRouteActive(pathname, item.href);
                      return (
                        <Link key={item.href} href={item.href} className={active ? "nav-link active" : "nav-link"}>
                          <span className="nav-link-label">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>

              <div className="sidebar-user-inline">
                <strong>{user?.username ?? "guest"}</strong>
                <button className="secondary-button sidebar-signout" type="button" onClick={() => void logout()}>
                  Sign out
                </button>
              </div>
            </>
          ) : null}
        </div>
      </aside>

      <div className="app-workspace">
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
