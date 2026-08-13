import Link from "next/link";
import type { ReactNode } from "react";

export default function VaFormsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="mx-auto max-w-5xl px-6 pt-5">
        <Link href="/va-forms/finder" className="text-sm underline">
          Open VA Form Finder
        </Link>
      </div>
      {children}
    </>
  );
}
