import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy | Secondary Condition Finder" };

export default function PrivacyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
