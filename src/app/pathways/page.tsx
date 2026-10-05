import type { Metadata } from "next";
import Link from "next/link";

import { DisclaimerBanner, DisclaimerFooter } from "@/components/Disclaimer";
import { PathwayExplorer } from "@/components/pathways/PathwayExplorer";
import { buildPathwayExplorerView } from "@/lib/engine/pathway-explorer";

export const metadata: Metadata = {
  title: "Claim Pathways | Secondary Condition Finder",
};

/**
 * Dynamic because the adjacency graph and catalog are read from disk through
 * server-only loaders, mirroring the other data-driven research routes.
 */
export const dynamic = "force-dynamic";

/**
 * Claim pathway explorer — the adjacency graph's first user-facing surface.
 *
 * Read-only: renders what the validated graph traversal yields, with every
 * association-only chain carrying its broken-chain disclosure. It authors no
 * relationship, adds no ranking, and routes nothing into the recommendation
 * engine.
 */
export default function PathwaysPage() {
  const view = buildPathwayExplorerView();

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link href="/" className="text-sm underline hover:text-slate-900">
        Back to home
      </Link>

      <header className="page-hero mt-4 text-center">
        <p className="ui-kicker">Adjacency graph — research preview</p>
        <h1 className="mt-2">Claim pathway explorer</h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg">
          A read-only view of the authored adjacency-graph routes between
          conditions. Association-only links are shown with their legal chain
          broken and are never presented as an established nexus.
        </p>
      </header>

      <div className="mt-5">
        <DisclaimerBanner />
      </div>

      <PathwayExplorer view={view} />

      <section className="ui-card mt-5" aria-labelledby="pathway-explorer-limits">
        <h2 id="pathway-explorer-limits" className="text-xl font-bold">
          What this does not mean
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
          <li>
            A route here is not a diagnosis, a service-connection decision, an
            eligibility finding, or a rating prediction. Those determinations
            belong to VA adjudication on an individual record.
          </li>
          <li>
            Every chain is a population-level evidence summary. An individual
            secondary claim still needs the statutory elements plus a medical
            nexus opinion tied to that claimant&apos;s chronology.
          </li>
          <li>
            An association-only hop records co-occurrence or prognostic
            association, not a nexus theory under 38 CFR § 3.310 — the chain is
            broken end-to-end and cannot support a downstream claim.
          </li>
          <li>
            The graph is deliberately incomplete: it grows only as routes pass
            the authored evidence, absent-check, and source-status preflight
            discipline, so an absent route is not a finding.
          </li>
        </ul>
      </section>

      <DisclaimerFooter />
    </main>
  );
}
