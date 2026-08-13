import Link from "next/link";
import type { ReactNode } from "react";

export default function VaReferenceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="mx-auto max-w-5xl px-6 pt-5">
        <Link href="/va-reference/service-branches" className="text-sm underline">
          Open VA service branch reference
        </Link>
      </div>
      {children}
    </>
  );
}
