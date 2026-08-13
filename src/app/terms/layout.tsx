import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms | Secondary Condition Finder" };

export default function TermsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
