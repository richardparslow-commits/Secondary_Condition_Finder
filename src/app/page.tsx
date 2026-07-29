import Link from "next/link";

import { DisclaimerBanner, DisclaimerFooter } from "@/components/Disclaimer";

const paths = [
  {
    href: "/secondary",
    title: "A condition related to one I already have",
    mechanism: "Secondary service connection, 38 CFR 3.310",
    body: "You are already service connected for something, and another condition may have been caused or worsened by it. These claims generally need a medical opinion linking the two.",
    cta: "Explore secondary conditions",
  },
  {
    href: "/presumptive",
    title: "A condition tied to where and when I served",
    mechanism: "Presumptive service connection, 38 CFR 3.307 and 3.309",
    body: "For certain exposures, VA presumes your service caused the condition. No linking opinion is needed and no other service-connected condition is required. This is usually the easier path when it applies.",
    cta: "Check presumptive conditions",
  },
];

export default function HomePage() {
  return (
    <main>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Secondary Condition Finder
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          A research aid for VA claim preparation. Start with how the condition
          you are researching may connect to your service, since the two paths
          need different evidence.
        </p>
      </header>

      <div className="mb-8">
        <DisclaimerBanner />
      </div>

      <div className="space-y-4">
        {paths.map((path) => (
          <article
            key={path.href}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-base font-semibold text-slate-900">
              {path.title}
            </h2>
            <p className="mt-1 text-xs text-slate-500">{path.mechanism}</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              {path.body}
            </p>
            <Link
              href={path.href}
              className="mt-4 inline-block rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              {path.cta}
            </Link>
          </article>
        ))}
      </div>

      <p className="mt-6 text-sm leading-relaxed text-slate-600">
        These paths are not exclusive. A condition can qualify both ways, and
        you can pursue either or both. If you are unsure which applies, an
        accredited representative or VSO can tell you quickly and at no cost.
      </p>

      <p className="mt-6 text-sm text-slate-600">
        Want to see how it works first?{" "}
        <Link href="/scenarios" className="underline hover:text-slate-900">
          Run a demo scenario
        </Link>
        .
      </p>

      <p className="mt-2 text-sm text-slate-600">
        Read our{" "}
        <Link href="/privacy" className="underline hover:text-slate-900">
          privacy policy
        </Link>{" "}
        and{" "}
        <Link href="/terms" className="underline hover:text-slate-900">
          terms of use
        </Link>
        .
      </p>

      <DisclaimerFooter />
    </main>
  );
}
