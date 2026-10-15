import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Presumptive Research | Secondary Condition Finder",
};

export default function PresumptiveLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* A landmark rather than a bare container: axe's `region` rule reported
          this cross-link as page content outside any landmark on every route
          that renders a layout strip, which left it unreachable by
          landmark navigation. Confirmed in a real browser. */}
      <nav aria-label="Related VA reference" className="mx-auto max-w-5xl px-6 pt-5">
        <Link href="/va-reference/service-branches" className="text-sm underline">
          View standardized VA service branch names
        </Link>
      </nav>
      {children}
    </>
  );
}
