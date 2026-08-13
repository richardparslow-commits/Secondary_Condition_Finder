import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Presumptive Research | Secondary Condition Finder",
};

export default function PresumptiveLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="mx-auto max-w-5xl px-6 pt-5">
        <Link href="/va-reference/service-branches" className="text-sm underline">
          View standardized VA service branch names
        </Link>
      </div>
      {children}
    </>
  );
}
