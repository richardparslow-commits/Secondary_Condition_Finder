import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Workflow Suggestions | Secondary Condition Finder",
};

export default function SuggestionsLayout({ children }: { children: ReactNode }) {
  return children;
}
