import Link from "next/link";

import { DisclaimerFooter } from "@/components/Disclaimer";
import {
  CAUSED_AGGRAVATED_DISTINCTION,
  PRESUMPTIVE_TRACK_OVERVIEW,
  SECONDARY_TRACK_OVERVIEW,
  TRACK_DISTINCTION_NOTICE,
  UNVERIFIED_REFERENCE_NOTICE,
} from "@/lib/legal/phrases";

export default function HomePage() {
  return (
    <main>
      <header className="page-hero text-center">
        <p className="ui-kicker">VA claim-preparation research aid</p>
        <h1 className="mt-2">Secondary Conditions</h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg">
          Research possible claim pathways for conditions related to service-connected disabilities and qualifying service exposures.
        </p>
      </header>

      <div className="ui-grid">
        <div className="ui-stack">
          <article className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">↗</span><div><p className="ui-kicker">Secondary</p><h2 className="text-2xl font-bold">Condition Caused By Service-Connected Condition</h2></div></div>
            <p>Explore a current condition that may be the result of, or would not have occurred but for, an already service-connected disability (Spicer/M21-1 May 2026).</p>
            <Link href="/secondary/condition-caused-by" className="ui-button mt-6 w-full">Learn More <span aria-hidden="true">→</span></Link>
          </article>

          <article className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">◆</span><h2 className="text-xl font-bold">Presumptive Service Connection</h2></div>
            <p>{PRESUMPTIVE_TRACK_OVERVIEW}</p>
            <Link href="/presumptive" className="ui-button mt-6 w-full">Check Presumptive Conditions <span aria-hidden="true">→</span></Link>
          </article>
        </div>

        <div className="ui-stack">
          <article className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">i</span><h2 className="text-xl font-bold">This is a research aid, not advice.</h2></div>
            <p>This tool helps organize claim-preparation research. It does not diagnose conditions, determine eligibility, or provide medical or legal advice. Every suggestion is a possibility to explore with a qualified provider or an accredited representative, not a determination.</p>
          </article>

          <article className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">⚖</span><h2 className="text-2xl font-bold">Secondary and Presumptive tracks are not mutually exclusive.</h2></div>
            <p>A claim may involve elements from both. Explore each track independently using the links on this page.</p>
            <div className="ui-divider" />
            <p><strong>Secondary service connection:</strong> {SECONDARY_TRACK_OVERVIEW}</p>
            <p className="mt-3">{CAUSED_AGGRAVATED_DISTINCTION} {TRACK_DISTINCTION_NOTICE}</p>
            <nav className="mt-6 flex flex-wrap gap-4 text-sm" aria-label="Utility links">
              <Link href="/scenarios">Demo Scenarios</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/about">About</Link>
            </nav>
          </article>
        </div>

        <div className="ui-stack">
          <article className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">↗</span><div><p className="ui-kicker">Secondary</p><h2 className="text-2xl font-bold">Conditions via Aggravation</h2></div></div>
            <p>Explore a condition that already existed but may have been made worse, or its treatment interfered with, by a service-connected disability (Spicer/M21-1 May 2026).</p>
            <Link href="/secondary/condition-aggravation" className="ui-button mt-6 w-full">Learn More <span aria-hidden="true">→</span></Link>
          </article>

          <article className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Secondary Service Connection</h2></div>
            <p>{CAUSED_AGGRAVATED_DISTINCTION}</p>
            <p className="mt-3">{TRACK_DISTINCTION_NOTICE}</p>
            <div className="ui-callout mt-5"><p>{UNVERIFIED_REFERENCE_NOTICE}</p></div>
            <Link href="/secondary" className="ui-button mt-6 w-full">Proceed to Wizard Step 1 <span aria-hidden="true">→</span></Link>
          </article>
        </div>
      </div>

      <section className="mt-5 grid gap-4 p-5 md:grid-cols-2">
        <div>
          <h2 className="text-lg font-bold">VA Forms Reference</h2>
          <p className="mt-2 text-sm">Search public VA form metadata by form number, keyword, or title through the configured VA reference adapter or a clearly labeled local fallback.</p>
          <Link href="/va-forms/finder" className="mt-3 inline-block">Open VA Form Finder →</Link>
        </div>
        <div>
          <h2 className="text-lg font-bold">VA Disability Reference Terms</h2>
          <p className="mt-2 text-sm">Explore public Benefits Reference Data terms; filtering stays local to your browser.</p>
          <Link href="/va-reference" className="mt-3 inline-block">Open VA Reference Terms →</Link>
        </div>
      </section>

      <div className="ui-footer-note" role="note">
        <strong>Verify before filing.</strong> Suggestions come from a curated knowledge base, not from your medical records, and are not ranked by likelihood of approval. Confirm citations and requirements against current VA guidance and consider an accredited representative or VSO.
      </div>

      <DisclaimerFooter />
    </main>
  );
}
