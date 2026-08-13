import Link from "next/link";
import type { ReactNode } from "react";

export default function VaFormsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="mx-auto max-w-5xl px-6 pt-5 text-sm">
        <Link href="/va-forms/finder" className="underline">
          Open VA Form Finder
        </Link>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          Use form numbers or general form keywords only. The Finder query is sent to the public VA Forms endpoint, so do not enter names, account identifiers, claim numbers, or other personal information.
        </p>
      </div>
      {children}
    </>
  );
}
