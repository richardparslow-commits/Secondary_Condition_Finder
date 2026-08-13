import type { Metadata } from "next";
import Link from "next/link";

import { DisclaimerFooter } from "@/components/Disclaimer";
import { ServiceHistoryForm } from "@/components/ServiceHistoryForm";
import { loadExposureCatalog } from "@/lib/presumptive/load";
import { listLocations } from "@/lib/presumptive/match";

export const metadata: Metadata = {
  title: "Presumptive Research | Secondary Condition Finder",
};

export default function PresumptivePage() {
  const locations = listLocations(loadExposureCatalog());

  return (
    <main>
      <header className="page-hero text-center">
        <p className="ui-kicker">Exposure-based research track</p>
        <h1>Presumptive Service Connection</h1>
        <p className="mx-auto mt-3 max-w-3xl text-lg">Explore conditions that may be linked to qualifying service locations, dates, and recognized exposures.</p>
      </header>

      <div className="mb-5"><Link href="/" className="ui-button-secondary">← Back to Home</Link></div>

      <div className="ui-grid">
        <aside className="ui-stack">
          <section className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Eligibility Basics</h2></div>
            <ul className="list-disc space-y-3 pl-5 text-sm"><li>Qualifying active military service is required.</li><li>The presumption must match a recognized exposure, location, period, or other statutory/regulatory criterion.</li><li>A current diagnosed condition is still required.</li><li>A separate medical nexus opinion generally is not required when the applicable presumption is satisfied.</li></ul>
          </section>
          <section className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">⌖</span><h2 className="text-xl font-bold">Covered Exposure Tracks</h2></div>
            <p className="text-sm">The local presumptive catalog includes exposure/location rules used by the matching tool. Select your actual service locations and dates in the form.</p>
          </section>
        </aside>

        <section className="ui-card">
          <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">↗</span><div><h2 className="text-2xl font-bold">Presumptive Service Connection</h2><p className="text-sm text-slate-600">Enter service history without putting it in the URL.</p></div></div>
          <p className="mb-5">For some conditions, VA presumes a relationship to service when specific legal criteria are met. This track is separate from secondary service connection, which concerns one disability causing or aggravating another.</p>
          <ServiceHistoryForm locations={locations} />
        </section>

        <aside className="ui-stack">
          <section className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">?</span><h2 className="text-xl font-bold">How Matching Works</h2></div>
            <ul className="space-y-4 text-sm"><li><strong>Location.</strong><p>Your selected service locations are compared with catalog exposure rules.</p></li><li><strong>Dates.</strong><p>When provided, service dates are compared with qualifying periods.</p></li><li><strong>Recognized conditions.</strong><p>Results show catalog conditions associated with matched presumptive rules.</p></li></ul>
          </section>
          <section className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">i</span><h2 className="text-xl font-bold">Important Disclaimer</h2></div>
            <p className="text-sm">This is not an eligibility decision. VA also considers discharge characterization, diagnosis, and evidence that can rebut a presumption. Confirm current requirements with official VA sources or an accredited representative or VSO.</p>
          </section>
        </aside>
      </div>

      <div className="ui-footer-note" role="note"><strong>Note:</strong> Secondary and Presumptive tracks are not mutually exclusive. A claim may involve elements from both.</div>
      <DisclaimerFooter />
    </main>
  );
}
