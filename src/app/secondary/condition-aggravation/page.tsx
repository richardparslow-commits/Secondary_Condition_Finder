import Link from "next/link";

import { DisclaimerBanner } from "@/components/Disclaimer";
import { CAUSED_AGGRAVATED_DISTINCTION, SECONDARY_TRACK_OVERVIEW, TRACK_DISTINCTION_NOTICE, UNVERIFIED_REFERENCE_NOTICE } from "@/lib/legal/phrases";
import { SECONDARY_AGGRAVATED_BY_TITLE } from "@/lib/legal/secondary-title";

export const metadata = {
  title: "Secondary Condition via Aggravation | VA Secondary Connection Finder",
  description:
    "Explore conditions that were aggravated by your service-connected disability. This track is for conditions that were worsened beyond their natural progression by your service.",
};

export default function ConditionAggravationPage() {
  return (
    <main>
      <header className="page-hero text-center">
        <p className="ui-kicker">Aggravation pathway</p>
        <h1>{SECONDARY_AGGRAVATED_BY_TITLE}</h1>
        <p className="mx-auto mt-3 max-w-3xl text-lg">Organize research about a condition that already existed but may have been made worse beyond its natural progression by an established service-connected disability.</p>
      </header>

      <div className="mb-5">
        <Link href="/secondary" className="ui-button-secondary">← Back to Secondary Conditions</Link>
      </div>

      <div className="ui-grid">
        <div className="ui-stack">
          <article className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">§</span><h2 className="text-xl font-bold">Legal / Regulatory Basis</h2></div>
            <ul className="list-disc space-y-3 pl-5 text-sm">
              <li>38 CFR § 3.310(b) provides the legal framework for aggravation of a non-service-connected disability by a service-connected disability.</li>
              <li>After the May 2026 Spicer update (M21-1 § 5.ii.2.D), aggravation includes any increase in severity that would not have occurred but for the SC disability, and cases where the SC disability interfered with or impeded treatment for the NSC disability.</li>
              <li>Permanent worsening is not required. The key question is: would the condition be less severe today but for the service-connected disability?</li>
              <li>A baseline of pre-aggravation severity is still required for aggravation claims under 38 CFR § 3.310(b).</li>
            </ul>
          </article>

          <article className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">+</span><h2 className="text-xl font-bold">Primary Clinical Pathways</h2></div>
            <ul className="space-y-3 text-sm">
              <li><strong>Biomechanical:</strong> compensatory stress or altered movement patterns</li>
              <li><strong>Metabolic / endocrine:</strong> physiological changes affecting another condition</li>
              <li><strong>Mental health / physiologic interaction:</strong> clinically supported pathways requiring condition-specific evidence</li>
              <li><strong>Medication side effects:</strong> adverse effects or treatment-related pathways</li>
              <li><strong>Treatment interference (Spicer):</strong> the SC disability delayed, prevented, or impeded treatment for the NSC disability</li>
              <li><strong>Obesity-related chains:</strong> an intermediate-factor theory where supported by evidence</li>
            </ul>
          </article>
        </div>

        <article className="ui-card">
          <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">↗</span><h2 className="text-xl font-bold">Secondary Service Connection</h2></div>
          <div className="ui-callout"><p>{SECONDARY_TRACK_OVERVIEW}</p></div>
          <p className="mt-5">{CAUSED_AGGRAVATED_DISTINCTION}</p>
          <p className="mt-4">{TRACK_DISTINCTION_NOTICE}</p>
          <div className="ui-divider" />
          <p><strong>Important:</strong> {UNVERIFIED_REFERENCE_NOTICE}</p>
          <div className="ui-callout mt-5"><p>See 38 CFR § 3.310(a) and § 3.310(b) for the legal secondary-service-connection framework, as implemented by the May 2026 Spicer update to M21-1 § 5.ii.2.D. The &quot;but for&quot; causation standard and treatment-interference pathway now apply. Clinical support still must come from appropriate medical evidence.</p></div>
          <Link href="/secondary/diagnosed" className="ui-button mt-6 w-full">Proceed to Step 1 <span aria-hidden="true">→</span></Link>
        </article>

        <div className="ui-stack">
          <article className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Adjudicative Mechanics</h2></div>
            <div className="space-y-5">
              <div><h3 className="font-bold">Baseline evidence</h3><p className="mt-1 text-sm">Identify evidence describing severity before the claimed aggravation. A baseline of pre-aggravation severity is still required under 38 CFR § 3.310(b) to determine what part of the current disability resulted from the service-connected condition.</p></div>
              <div className="ui-divider" />
              <div><h3 className="font-bold">Current severity</h3><p className="mt-1 text-sm">Organize evidence describing the present level of severity and the course of the condition.</p></div>
              <div className="ui-divider" />
              <div><h3 className="font-bold">Medical theory / nexus support</h3><p className="mt-1 text-sm">A condition-specific medical explanation should address whether the condition would be less severe today but for the service-connected disability. This includes direct worsening, treatment interference (the SC disability delayed, prevented, or impeded treatment), and medication side effects.</p></div>
            </div>
          </article>

          <article className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">i</span><h2 className="text-xl font-bold">Disclaimer</h2></div>
            <p className="text-sm">Suggestions come from a curated knowledge base and are not ranked by likelihood of approval. Confirm current VA guidance and consider an accredited representative or VSO before filing.</p>
          </article>
        </div>
      </div>

      <div className="ui-footer-note" role="note"><strong>Note:</strong> The Secondary and Presumptive tracks are not mutually exclusive. A claim may involve elements from both.</div>
      <div className="mt-5"><DisclaimerBanner /></div>
    </main>
  );
}
