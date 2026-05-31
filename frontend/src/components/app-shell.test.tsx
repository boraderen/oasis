import type { AnchorHTMLAttributes, ImgHTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { AppShell } from "@/components/app-shell";

vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => <div role="img" aria-label={props.alt} data-src={props.src} />,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/exploration",
}));

vi.mock("@/components/session-provider", () => ({
  useSession: () => ({
    user: {
      id: 1,
      username: "guest",
      is_guest: true,
      created_at: "2026-04-03T10:00:00Z",
    },
    logout: vi.fn(),
  }),
}));

describe("AppShell", () => {
  it("marks the current route as active", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    const explorationLinks = screen.getAllByRole("link", { name: "Exploration" });
    expect(explorationLinks.some((link) => link.classList.contains("active"))).toBe(true);
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Oasis" })).toBeInTheDocument();
  });

  it("shows grouped navigation without apps search or inbox", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.getByText("Case-centric PM")).toBeInTheDocument();
    expect(screen.getByText("OCPM")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Apps" })).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: "Search" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inbox" })).not.toBeInTheDocument();
  });

  it("collapses and expands the sidebar", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(screen.queryByRole("navigation", { name: "Main sections" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));

    expect(screen.getByRole("navigation", { name: "Main sections" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
