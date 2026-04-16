import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import "./globals.css";

import { AppQueryProvider } from "@/components/query-provider";
import { SessionProvider } from "@/components/session-provider";
import { withBasePath } from "@/lib/env";

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Oasis",
  description: "Stateful process mining workspace built with Next.js and PM4Py",
  icons: {
    icon: withBasePath("/oasis.png"),
    shortcut: withBasePath("/oasis.png"),
    apple: withBasePath("/oasis.png"),
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${monoFont.variable}`}>
      <body>
        <AppQueryProvider>
          <SessionProvider>{children}</SessionProvider>
        </AppQueryProvider>
      </body>
    </html>
  );
}
