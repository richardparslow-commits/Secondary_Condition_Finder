import type { Metadata } from "next";

import { TelemetryConsent } from "@/components/TelemetryConsent";
import "./globals.css";

export const metadata: Metadata = {
  title: "Secondary Condition Finder",
  description:
    "A claim-preparation research aid for exploring possible secondary VA conditions. Not medical or legal advice.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <TelemetryConsent />
        <div className="mx-auto max-w-3xl px-5 py-10">{children}</div>
      </body>
    </html>
  );
}
