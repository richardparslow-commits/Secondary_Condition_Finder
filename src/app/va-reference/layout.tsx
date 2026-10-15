import Link from "next/link";
import type { ReactNode } from "react";

export default function VaReferenceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Landmark rather than bare container — see the note in
          `src/app/presumptive/layout.tsx`; the `region` finding is the same one. */}
      <nav aria-label="Related VA reference" className="mx-auto max-w-5xl px-6 pt-5">
        <Link href="/va-reference/service-branches" className="text-sm underline">
          Open VA service branch reference
        </Link>
      </nav>
      {children}
    </>
  );
}
