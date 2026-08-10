import { DisclaimerBanner, DisclaimerFooter } from "@/components/Disclaimer";
import {
  SECONDARY_TRACK_OVERVIEW,
  CAUSED_AGGRAVATED_DISTINCTION,
  TRACK_DISTINCTION_NOTICE,
  UNVERIFIED_REFERENCE_NOTICE,
  SECONDARY_CONTINUE_CTA,
  PRESUMPTIVE_TRACK_OVERVIEW,
  PRESUMPTIVE_CONTINUE_CTA,
  DISCLAIMER_NONDIAGNOSTIC,
} from "@/lib/legal/phrases";
import { CitationLabel } from "./components/CitationLabel";
import { CausedByExplainer, AggravatedByExplainer } from "@/lib/legal/phrases";
import { CANONICAL_REFERENCES } from "@/lib/legal/references";

// Helper function to dynamically filter presumptive statute citations
const getPresumptiveCitations = () => {
  return CANONICAL_REFERENCES
    .filter(
      ref =>
        ref.sourceType === "Statute" &&
        (ref.title.toLowerCase().includes("presumption") ||
          ref.title.toLowerCase().includes("presumptive"))
    )
    .map(ref => ref.citation);
};

// Custom Link component wrapper for client-side navigation (Next.js 14+ compatibility)
// Uses href="/path" for client-side navigation using Next.js router
const Link: React.FC<React.AnchorProps> = (props) => {
  return <a href={props.href}>{props.children}</a>;
};

export default function HomePage() {
  return (
    <main>
      {/* 1. Header — "Secondary Condition Finder" title + short description */}
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Secondary Condition Finder
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          A research aid for VA claim preparation. Choose a track below to explore how your condition may connect to your service.
        </p>
      </header>

      {/* 2. Two separate links (md:grid-cols-2, negative-margin bleed to 150% width on desktop) */}
      <div className="md:grid md:grid-cols-2 gap-6 md:gap-10 mt-2 -mt-12 px-4">
        {/* Secondary path card (/secondary) */}
        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Secondary Service Connection
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {SECONDARY_TRACK_OVERVIEW}
          </p>

          {/* CitationLabel for Secondary card - dynamically generated */}
          <div className="mt-3 flex flex-wrap gap-2">
            {getPresumptiveCitations().map(citation => (
              <CitationLabel key={citation} citation={citation} />
            ))}
          </div>

          {/* CTA button for Secondary path */}
          <a
            href="/secondary"
            className="mt-6 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Check Secondary Conditions
          </a>
        </article>

        {/* Presumptive path card (/presumptive) */}
        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Presumptive Service Connection
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {PRESUMPTIVE_TRACK_OVERVIEW}
          </p>

          {/* CitationLabel for Presumptive card - dynamically generated */}
          <div className="mt-3 flex flex-wrap gap-2">
            {getPresumptiveCitations().map(citation => (
              <CitationLabel key={citation} citation={citation} />
            ))}
          </div>

          {/* CTA button for Presumptive path */}
          <a
            href="/presumptive"
            className="mt-6 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Check Presumptive Conditions
          </a>
        </article>
      </div>

      {/* 4. Footer copy — tracks are not mutually exclusive */}
      <div className="mt-8 text-xs text-slate-500">
        <p className="mb-3">
          <strong>Note:</strong> The Secondary and Presumptive tracks are not 
          mutually exclusive. Your claim may involve elements from both. You 
          can explore each track independently using the links above.
        </p>
        <div className="flex flex-wrap justify-center gap-4 mt-3">
          <a href="/scenarios" className="text-blue-600 hover:underline">
            Demo Scenarios
          </a>
          <a href="/privacy" className="text-slate-600 hover:underline">
            Privacy
          </a>
          <a href="/terms" className="text-slate-600 hover:underline">
            Terms
          </a>
        </div>
      </div>

      {/* DisclaimerFooter component */}
      <DisclaimerFooter />
    </main>
  );
}