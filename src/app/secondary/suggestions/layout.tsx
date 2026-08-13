import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Workflow Suggestions | Secondary Condition Finder",
};

export default function SuggestionsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="mx-auto max-w-5xl px-6 pt-5">
        <Link href="/va-reference" className="text-sm underline">
          Compare a suggestion name with VA reference terminology
        </Link>
      </div>
      {children}
    </>
  );
}
