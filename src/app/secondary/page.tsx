import Link from "next/link";

import { DisclaimerBanner } from "@/components/Disclaimer";
import {
  DISCLAIMER_NONDIAGNOSTIC,
  SECONDARY_CONTINUE_CTA,
  SECONDARY_TRACK_OVERVIEW,
  UNVERIFIED_REFERENCE_NOTICE,
} from "@/lib/legal/phrases";
import { SECONDARY_AGGRAVATED_BY_TITLE, SECONDARY_CAUSED_BY_TITLE } from "@/lib/legal/secondary-title";
import { CANONICAL_REFERENCES } from "@/lib/legal/references";

export default function SecondaryLandingPage() {
  return (
    <main>
      <header className="page-hero text-center">
        <p className="ui-kicker">Secondary workflow</p>
        <h1>Secondary Service Connection Conditions</h1>
        <p className="mx-auto mt-3 max-w-3xl text-lg">{SECONDARY_TRACK_OVERVIEW}</p>
      </header>

      <div className="ui-grid">
        <article className="ui-card">
          <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">1</span><h2 className="text-xl font-bold">{SECONDARY_CAUSED_BY_TITLE}</h2></div>
          <p>A secondary condition that is proximately due to or the result of an already service-connected primary condition.</p>
          <p className="mt-4 text-sm"><strong>Legal framework:</strong> 38 CFR § 3.310(a).</p>
          <Link href="/secondary/condition-caused-by" className="ui-button mt-6 w-full">Learn More <span aria-hidden="true">→</span></Link>
        </article>

        <article className="ui-card">
          <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">i</span><h2 className="text-xl font-bold">Secondary Service Connection</h2></div>
          <p>{SECONDARY_TRACK_OVERVIEW}</p>
          <div className="ui-divider" />
          <p>{DISCLAIMER_NONDIAGNOSTIC}</p>
          <div className="ui-callout mt-5"><p>{UNVERIFIED_REFERENCE_NOTICE}</p></div>
          <Link href="/secondary/diagnosed" className="ui-button mt-6 w-full">{SECONDARY_CONTINUE_CTA} <span aria-hidden="true">→</span></Link>
        </article>

        <article className="ui-card">
          <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">2</span><h2 className="text-xl font-bold">{SECONDARY_AGGRAVATED_BY_TITLE}</h2></div>
          <p>A non-service-connected condition may be considered under an aggravation theory when it is made worse beyond its natural progression by an established service-connected disability.</p>
          <p className="mt-4 text-sm"><strong>Legal framework:</strong> 38 CFR § 3.310(b).</p>
          <Link href="/secondary/condition-aggravation" className="ui-button mt-6 w-full">Learn More <span aria-hidden="true">→</span></Link>
        </article>
      </div>

      <section className="mt-5 p-6">
        <h2 className="text-xl font-bold">Legal references used by this research aid</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {CANONICAL_REFERENCES.map((reference) => (
            <div key={reference.id} className="rounded-xl border border-slate-200 p-4">
              <p className="font-semibold">{reference.citation}</p>
              <p className="mt-1 text-sm text-slate-600">{reference.description}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="ui-footer-note" role="note">
        If your condition may be tied to where and when you served, use the separate <Link href="/presumptive">presumptive track</Link>. The tracks are not mutually exclusive.
      </div>

      <div className="mt-5"><DisclaimerBanner /></div>
    </main>
  );
}
