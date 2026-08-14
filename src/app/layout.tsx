import type { Metadata } from "next";
import { connection } from "next/server";

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

  return (
    <html lang="en">
      <body>
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
