export function DisclaimerBanner() {
  return (
    <div
      role="note"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900"
    >
      <p className="font-semibold">This is a research aid, not advice.</p>
      <p className="mt-1">
        This tool helps organize claim-preparation research. It does not
        diagnose conditions, determine eligibility, or provide medical or legal
        advice. Every suggestion is a possibility to explore with a qualified
        provider or an accredited representative, not a determination.
      </p>
    </div>
  );
}

export function DisclaimerFooter() {
  return (
    <footer className="mt-12 border-t border-slate-200 pt-6 text-xs leading-relaxed text-slate-500">
      <p>
        Suggestions come from a curated knowledge base, not from your medical
        records, and are not ranked by likelihood of approval. Citations are
        starting points for your own verification and have not yet been
        confirmed by a qualified reviewer. Confirm everything against current VA
        guidance at va.gov and consult an accredited representative or VSO
        before filing.
      </p>
    </footer>
  );
}
