import Link from "next/link";

import { DisclaimerBanner } from "@/components/Disclaimer";
import { SECONDARY_TRACK_OVERVIEW, TRACK_DISTINCTION_NOTICE, UNVERIFIED_REFERENCE_NOTICE } from "@/lib/legal/phrases";
import { SECONDARY_CAUSED_BY_TITLE } from "@/lib/legal/secondary-title";

export const metadata = {
  title: "Secondary Condition Caused By | VA Secondary Connection Finder",
  description:
    "Explore conditions caused by your service-connected disability. This track is for conditions that are proximately due to or the result of your service-connected injury or disease.",
};

export default function ConditionCausedByPage() {
  return (
    <main>
      <header className="page-hero text-center">
        <p className="ui-kicker">Direct secondary pathway</p>
        <h1>{SECONDARY_CAUSED_BY_TITLE}</h1>
        <p className="mx-auto mt-3 max-w-3xl text-lg">Organize research about a current condition that may be proximately due to or the result of an established service-connected disability.</p>
      </header>

      <div className="mb-5">
        <Link href="/secondary" className="ui-button-secondary">← Back to Secondary Conditions</Link>
      </div>

      <div className="ui-grid">
        <article className="ui-card">
          <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Three Required Elements</h2></div>
          <ol className="space-y-5">
            <li><strong>1. Current disability.</strong><p className="mt-1 text-sm">A current diagnosed condition supported by appropriate evidence.</p></li>
            <li><strong>2. Service-connected primary disability.</strong><p className="mt-1 text-sm">An established service-connected disability being evaluated as the possible primary condition.</p></li>
            <li><strong>3. Medical nexus.</strong><p className="mt-1 text-sm">Competent evidence addressing whether the current condition is proximately due to or the result of the service-connected disability.</p></li>
          </ol>
          <div className="ui-divider" />
          <h3 className="font-bold">Common research pathways</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
            <li>Biomechanical compensation or altered movement patterns</li>
            <li>Medication side effects or adverse reactions</li>
            <li>An intermediate condition linking one disability to another</li>
            <li>Disease progression that may be related to the primary condition</li>
          </ul>
        </article>

        <article className="ui-card">
          <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">i</span><h2 className="text-xl font-bold">Secondary Service Connection</h2></div>
          <div className="ui-callout"><p>{SECONDARY_TRACK_OVERVIEW}</p></div>
          <div className="ui-divider" />
          <h3 className="font-bold">How this track helps</h3>
          <p className="mt-2">Use this page to organize the conditions, evidence types, treatment history, and medical questions you may want to research before filing.</p>
          <div className="ui-divider" />
          <h3 className="font-bold">How this differs from presumptive service connection</h3>
          <p className="mt-2">{TRACK_DISTINCTION_NOTICE}</p>
          <div className="ui-callout mt-5"><p>{UNVERIFIED_REFERENCE_NOTICE}</p></div>
          <Link href="/secondary/diagnosed" className="ui-button mt-6 w-full">Proceed to Step 1 <span aria-hidden="true">→</span></Link>
        </article>

        <article className="ui-card">
          <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">§</span><h2 className="text-xl font-bold">Adjudicative Framework</h2></div>
          <h3 className="font-bold">Proximate relationship</h3>
          <p className="mt-2 text-sm">The research question is whether the established primary disability is medically linked to the current secondary condition under 38 CFR § 3.310(a).</p>
          <div className="ui-divider" />
          <h3 className="font-bold">Evidence expectations</h3>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
            <li>Current diagnostic and treatment records</li>
            <li>A medical opinion when the relationship requires medical expertise</li>
            <li>A clear rationale that addresses the specific conditions and relevant history</li>
          </ul>
          <div className="ui-divider" />
          <h3 className="font-bold">Nexus documentation</h3>
          <p className="mt-2 text-sm">Organize records that help a qualified clinician or accredited representative evaluate the claimed relationship. This app does not create or replace a nexus opinion.</p>
        </article>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="ui-footer-note"><strong>Research aid, not advice.</strong> This tool organizes information and does not determine eligibility or provide medical or legal advice.</div>
        <div className="ui-footer-note"><strong>Verify and get support.</strong> Confirm current guidance and consider an accredited representative, attorney, or VSO.</div>
      </div>

      <div className="mt-5"><DisclaimerBanner /></div>
    </main>
  );
}
