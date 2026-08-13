import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Evidence & Research Checklist | Secondary Condition Finder",
};

export default function EvidenceLayout({ children }: { children: ReactNode }) {
  return children;
}
