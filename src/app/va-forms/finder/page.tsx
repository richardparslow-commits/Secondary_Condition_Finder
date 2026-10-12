import type { Metadata } from "next";
import Link from "next/link";

import { VaFormsFinder } from "@/components/va/VaFormsFinder";
import { loadVaFormsFinder } from "@/lib/va/forms-finder";

export const metadata: Metadata = {
  title: "VA Form Finder | Secondary Condition Finder",
};

export const dynamic = "force-dynamic";

/**
 * VA Form Finder shell (audit A01).
 *
 * This page reads **no** query parameter. That is load-bearing, not incidental:
 * the previous GET form put the visitor's search text in the request URL, and a
 * URL is copied, bookmarked, and written to the hosting request log. The search
 * itself is a Server Action POST from `VaFormsFinder`, so the only URL that
 * ever exists for this surface is `/va-forms/finder`.
 *
 * The default view is still resolved server-side so the surface renders
 * complete (provenance label, notice, and current form metadata) before any
 * interaction, and so a JS-less load shows a labelled reference rather than an
 * empty shell.
 */
export default async function VaFormsFinderPage() {
  const reference = await loadVaFormsFinder();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/" className="underline">
          Home
        </Link>
        <Link href="/va-forms" className="underline">
          VA form reference
        </Link>
      </div>

      <VaFormsFinder initialView={reference} />
    </main>
  );
}
