import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Secondary Workflow | Secondary Condition Finder",
};

export default function SecondaryLayout({ children }: { children: ReactNode }) {
  return children;
}
