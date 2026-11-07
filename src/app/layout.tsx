import type { Metadata } from "next";
import { connection } from "next/server";
import { headers } from "next/headers";

import { TrustedTypesGate } from "@/components/security/TrustedTypesGate";

import "./globals.css";

export const metadata: Metadata = {
  title: "Secondary Condition Finder",
  description:
    "A claim-preparation research aid for exploring possible secondary VA conditions. Not medical or legal advice.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Nonce-based CSP requires request-time rendering so Next.js can apply the
  // per-request nonce to framework and page scripts.
  await connection();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en">
      <head>
        {process.env.NODE_ENV !== "development" && (
          // No async/defer: install the narrow policy before module evaluation.
          // The proxy's per-request nonce authorizes this parser-loaded script.
          // eslint-disable-next-line @next/next/no-sync-scripts
          <script nonce={nonce} src="/trusted-types-bootstrap.js" />
        )}
      </head>
      <body>
        {/* Hydration-time fallback; the head bootstrap handles early sinks. */}
        <TrustedTypesGate />
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <div className="app-shell" id="main-content" tabIndex={-1}>
          {children}
        </div>
      </body>
    </html>
  );
}
