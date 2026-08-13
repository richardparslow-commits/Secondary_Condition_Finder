import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | Secondary Condition Finder",
};

export default function AboutLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
