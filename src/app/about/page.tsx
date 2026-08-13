import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-gray-900">
      <h1 className="mb-4 text-3xl font-bold">About Secondary Condition Finder</h1>
      <p className="mb-6 text-sm text-gray-600">Claim-preparation research and organization for Veterans</p>

      <section className="space-y-5 text-sm leading-relaxed">
        <div className="rounded border-l-4 border-blue-600 bg-blue-50 p-4">
          <h2 className="font-semibold text-blue-900">What this application does</h2>
          <p className="mt-1 text-xs text-blue-800">
            Secondary Condition Finder helps Veterans organize disability-benefit claim-preparation research, distinguish secondary and presumptive research paths, review possible conditions to explore, identify evidence gaps, and locate relevant public VA reference information.
          </p>
        </div>

        <h2 className="text-xl font-semibold">Who it is for</h2>
        <p>
          The primary end user is a Veteran researching and organizing information for their own VA disability-benefit claim preparation. A Veteran may use the resulting research when speaking with a qualified health-care professional, Veterans Service Officer, accredited representative, agent, or attorney.
        </p>

        <h2 className="text-xl font-semibold">What it does not do</h2>
        <p>
          The application does not diagnose medical conditions, determine VA eligibility, calculate or promise disability ratings, make service-connection decisions, submit claims, or provide legal representation. Suggestions are possibilities to research, not adjudications or medical conclusions.
        </p>

        <h2 className="text-xl font-semibold">VA reference integrations</h2>
        <p>
          The application currently demonstrates two bounded public-reference integrations: VA Forms metadata for Form 21-526EZ and Benefits Reference Data disability terminology. These features are separate from the core research engine and fall back safely when VA API access is unavailable.
        </p>
        <p>
          The initial integration scope does not access an individual Veteran&apos;s VA account, claims file, health record, or other authenticated Veteran-specific VA data.
        </p>

        <h2 className="text-xl font-semibold">Privacy boundary</h2>
        <p>
          Health/disability workflow selections and presumptive service-history state are kept out of page query strings. Short-lived workflow cookies are encrypted and authenticated. The current application does not persist workflow or recommendation event history through an application event logger.
        </p>

        <h2 className="text-xl font-semibold">How to use the research</h2>
        <p>
          Verify important medical, factual, and legal information with authoritative sources and appropriate professionals before filing or changing a claim strategy. Official eligibility and benefit decisions are made by the Department of Veterans Affairs, not by this application.
        </p>
      </section>

      <nav className="mt-8 flex flex-wrap gap-4 border-t pt-4 text-sm">
        <Link href="/" className="font-medium text-blue-600 hover:underline">&larr; Return to Home</Link>
        <Link href="/privacy" className="font-medium text-blue-600 hover:underline">Privacy Policy</Link>
        <Link href="/terms" className="font-medium text-blue-600 hover:underline">Terms of Use</Link>
      </nav>
    </main>
  );
}
