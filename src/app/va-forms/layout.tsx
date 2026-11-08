import Link from "next/link";
import type { ReactNode } from "react";

export default function VaFormsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Landmark rather than bare container — see the note in
          `src/app/presumptive/layout.tsx`; the `region` finding is the same one.
          The privacy note stays inside the landmark with the link it qualifies. */}
      <nav aria-label="Related VA forms" className="mx-auto max-w-5xl px-6 pt-5 text-sm">
        <Link href="/va-forms/finder" className="underline">
          Open VA Form Finder
        </Link>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          Use form numbers or general form keywords only. Searches are submitted to this application server and forwarded to the VA Forms service only when live VA access is enabled. Do not enter names, account identifiers, claim numbers, or other personal information.
        </p>
      </nav>
      {children}
    </>
  );
}
