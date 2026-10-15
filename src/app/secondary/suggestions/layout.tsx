import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Connection Review | Secondary Condition Finder",
};

export default function SuggestionsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Landmark rather than bare container — see the note in
          `src/app/presumptive/layout.tsx`; the `region` finding is the same one. */}
      <nav aria-label="Related VA reference" className="mx-auto max-w-5xl px-6 pt-5">
        <Link href="/va-reference" className="text-sm underline">
          Compare a diagnosis name with VA reference terminology
        </Link>
      </nav>
      {children}
    </>
  );
}
