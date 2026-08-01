import Link from "next/link";

import { DisclaimerBanner, DisclaimerFooter } from "@/components/Disclaimer";
import {
  CAUSED_AGGRAVATED_DISTINCTION,
  SECONDARY_TRACK_OVERVIEW,
  TRACK_DISTINCTION_NOTICE,
  UNVERIFIED_REFERENCE_NOTICE,
} from "@/lib/legal/phrases";
import { SECONDARY_REFERENCE_BY_ID } from "@/lib/legal/secondaryReferences";

const paths = [
  {
    href: "/secondary",
    title: "A condition related to one I already have",
    mechanism: `Secondary service connection, ${SECONDARY_REFERENCE_BY_ID["secondary-basis"].citation}`,
    body: SECONDARY_TRACK_OVERVIEW,
    cta: "Click here to continue",
  },
  {
    href: "/presumptive",
    title: "A condition tied to where and when I served",
    mechanism: `Presumptive service connection, ${SECONDARY_REFERENCE_BY_ID["presumptive-distinction"].citation}`,
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

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left column — Secondary Service Connection */}
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Secondary Service Connection: Caused By a Service-Connected
            Condition
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            If you are in the military a health problem generally does not
            remain confined to a single part of the body and over time a
            disability that has been connected with your service can lead to new
            health issues as a result of changes in the body, altered movement,
            or the side effects of treatment.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            The Department of Veterans Affairs (VA) grants Secondary Service
            Connection for new health problems that result directly from an
            existing service-connected condition, as stated in 38 C.F.R.
            § 3.310(a).
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            For the purposes of making a claim, a secondary condition is
            regarded as being linked to your original disability and is given
            its own individual disability rating; this rating is then combined
            with your other ratings by using whole-person math (38 C.F.R.
            § 4.25).
          </p>

          <h3 className="mt-4 text-sm font-semibold text-slate-900">
            The 3 Required Elements
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">
            To win a direct secondary claim, you need to prove three main
            things:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
            <li>
              The main anchor requirement is that the disability in question
              must be both active and service-connected and have already been
              awarded by the VA.
            </li>
            <li>
              The current diagnosis is official medical evidence of the new
              secondary condition; mere symptoms (such as unconfirmed pain) are
              not sufficient.
            </li>
            <li>
              Medical Nexus: This is what a doctor means when he or she says
              that it is &ldquo;at least as likely as not&rdquo; (i.e. a
              probability of 50% or more) that the primary condition or the
              treatment for it caused the secondary condition.
            </li>
          </ul>

          <h3 className="mt-4 text-sm font-semibold text-slate-900">
            Common Causal Pathways
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">
            The VA looks for clear medical reasons that connect your conditions:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
            <li>
              A direct biological cause is when a disease in one part of the
              body affects another (for example, service-connected Type 2
              Diabetes leading to nerve damage).
            </li>
            <li>
              Biomechanical stress occurs when injuries to joints or bones alter
              the way you move and place strain on other parts of the body (such
              as a knee deformity recognised as service-connected leading to
              lower back pain).
            </li>
            <li>
              The side effects of medication consist of new problems arising as
              a result of treating a condition (for example, the intake of
              strong NSAIDs for joint pain leading to acid reflux or stomach
              ulcers).
            </li>
            <li>
              An intermediate stage involves a primary condition restricting
              movement and as a result in weight gain, this extra weight then
              leading to another condition such as Sleep Apnea.
            </li>
          </ul>

          <h3 className="mt-4 text-sm font-semibold text-slate-900">
            Key Legal Precedents
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
            <li>
              The case of <em>Spicer v. McDonough</em> set out the
              &ldquo;but-for&rdquo; test, on the grounds that a secondary
              condition is compensable if it would not have occurred merely
              because of the primary disability or its treatment.
            </li>
            <li>
              In <em>Roper v. Nicholson</em>, secondary conditions that have
              been confirmed are rated separately before being combined.
            </li>
            <li>
              In <em>Ellington</em> and in <em>Manzanares v. Shulkin</em> it
              was decided that secondary claims are independent and do not
              automatically have the same original effective date as the primary
              claim.
            </li>
          </ul>

          <h3 className="mt-4 text-sm font-semibold text-slate-900">
            Presumptive Secondary Conditions
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">
            In certain cases, the legal connection is automatic and does not
            need a special nexus letter:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
            <li>
              Heart disease is believed to be a result of the service-connected
              amputations of the lower extremities.
            </li>
            <li>
              Conditions such as Parkinson&rsquo;s disease, seizures,
              depression, or dementia are generally considered to be associated
              with traumatic brain injury according to the severity and the time
              at which they occur.
            </li>
          </ul>

          <h3 className="mt-4 text-sm font-semibold text-slate-900">
            How to Prepare Your Claim
          </h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
            <li>
              Evidence of primary disability: letters stating your current
              rating.
            </li>
            <li>
              The current records include the diagnoses, laboratory results, and
              imaging findings for the new condition.
            </li>
            <li>
              Letter from a doctor stating that the two conditions are linked,
              using the legal criterion of &lsquo;at least as likely as
              not&rsquo; and giving medical reasons for this.
            </li>
          </ol>
        </section>

        {/* Right column — Aggravation */}
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Why Veterans Can Claim Secondary Conditions via Aggravation
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            Veterans are entitled to additional compensation in the case where a
            service-related (SC) condition permanently worsens a pre-existing or
            non-service-related (NSC) condition since the body functions as a
            connected system and thus SC injuries and illnesses often result in
            problems in other parts of the body.
          </p>

          <h3 className="mt-4 text-sm font-semibold text-slate-900">
            1. The Legal and Regulatory Basis
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
            <li>
              The legal basis for this is found in 38 U.S.C. §§ 1110 and 1131,
              which require compensation for disabilities &ldquo;resulting
              from&rdquo; service in the military.
            </li>
            <li>
              In the case of <em>Allen v. Brown</em> from 1995, the courts
              ruled that it is possible to provide compensation when an NSC
              condition becomes more severe than it would have become naturally.
              This ruling was formally incorporated into 38 C.F.R. § 3.310(b)
              in order to reimburse for the additional severity caused.
            </li>
            <li>
              The &ldquo;but-for&rdquo; criterion: Following the decision in{" "}
              <em>Spicer v. McDonough</em>, the VA applies a &ldquo;but-for
              &rdquo; test; if the non-service-connected condition would have
              been less severe in the absence of the service-connected
              disability (for instance, if the service-connected condition
              prevents proper medical care), then the deterioration can be
              compensated.
            </li>
          </ul>

          <h3 className="mt-4 text-sm font-semibold text-slate-900">
            2. Adjudicative Mechanics
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
            <li>
              To set the baseline, claimants have to give medical evidence
              demonstrating the severity of their NSC condition before it
              worsened.
            </li>
            <li>
              To work out the compensation percentage, the VA raters subtract
              the original severity and the normal progression of the disease
              from the current total severity.
            </li>
            <li>
              The Equipoise Doctrine: According to the VA&rsquo;s &lsquo;benefit
              of the doubt&rsquo; principle, veterans are not required to
              provide full medical evidence. A claim will be approved if the
              evidence indicates that it is &lsquo;at least as likely as
              not&rsquo; (that is, a 50 percent chance) the service-connected
              condition caused the deterioration.
            </li>
          </ul>

          <h3 className="mt-4 text-sm font-semibold text-slate-900">
            3. Primary Clinical Pathways
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
            <li>
              Injuries to the bones and joints caused by biomechanical stress
              result in alterations in the way a person walks, cause changes in
              the distribution of body weight, and accelerate the wear of the
              cartilage, which in turn leads to secondary arthritis in the
              adjacent joints.
            </li>
            <li>
              The conditions known as SC cause high blood sugar over a long
              period, which damages the small blood vessels and exacerbates any
              existing problems with the nerves or blood vessels.
            </li>
            <li>
              Mental health conditions such as PTSD cause a disorder in the
              body&rsquo;s hormone systems and lead to higher cortisol levels,
              which interferes with the relationship between the gut and the
              brain and thus makes digestive problems like IBS or GERD more
              severe.
            </li>
            <li>
              Medicines administered to treat somatic conditions can result in
              other physical problems, for example long-term use of NSAIDs
              causing stomach ulcers or the use of psychiatric drugs leading to
              metabolic syndrome.
            </li>
            <li>
              Obesity in this context: Even though obesity itself is not
              considered a separate compensable disability, if a spinal cord
              (SC) condition results in restricted movement or inactivity and
              this in turn causes obesity, and that obesity subsequently
              aggravates a non-spinal cord (NSC) condition (for example
              Obstructive Sleep Apnea or high blood pressure), then the
              secondary condition can be compensated.
            </li>
          </ul>
        </section>
      </div>

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
            {path.href === "/secondary" ? (
              <>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {CAUSED_AGGRAVATED_DISTINCTION}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {TRACK_DISTINCTION_NOTICE}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {UNVERIFIED_REFERENCE_NOTICE}
                </p>
              </>
            ) : null}
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
