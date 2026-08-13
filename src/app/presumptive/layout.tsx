import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Presumptive Research | Secondary Condition Finder",
};

export default function PresumptiveLayout({ children }: { children: ReactNode }) {
  return children;
}
