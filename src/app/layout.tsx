import type { Metadata } from "next";

import { AppInsightsInit } from "@/components/AppInsightsInit";
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
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <AppInsightsInit />
        <div className="mx-auto max-w-3xl px-5 py-10">{children}</div>
      </body>
    </html>
  );
}
