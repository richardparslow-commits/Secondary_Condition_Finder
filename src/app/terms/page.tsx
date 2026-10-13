import type { Metadata } from "next";
import Link from "next/link";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { groupByBodySystem } from "@/lib/catalog/lookup";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { mappedConditionIds } from "@/lib/kb/lookup";
import {
  CAUSED_AGGRAVATED_DISTINCTION,
  TRACK_DISTINCTION_NOTICE,
  UNVERIFIED_REFERENCE_NOTICE,
} from "@/lib/legal/phrases";
import { CANONICAL_REFERENCES } from "@/lib/legal/references";

const SECONDARY_LEGAL_REFERENCE_IDS = [
  "38-cfr-3.310-a",
  "38-cfr-3.310-b",
  "m21-1-v-ii-2",
] as const;

export const metadata: Metadata = {
  title: "Terms | Secondary Condition Finder",
};

export default async function TermsPage() {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const totalConditions = catalog.length;
  const totalBodySystems = groupByBodySystem(catalog).length;
  const publishedMappingCount = mappedConditionIds(kb).size;
  const secondaryReferences = CANONICAL_REFERENCES.filter((reference) =>
    SECONDARY_LEGAL_REFERENCE_IDS.includes(reference.id as (typeof SECONDARY_LEGAL_REFERENCE_IDS)[number]),
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-gray-900">
      <h1 className="mb-4 text-3xl font-bold">Terms of Use & Legal Disclaimers</h1>
      <p className="mb-6 text-sm text-gray-600">Last updated: August 2026</p>

      <section className="space-y-4 text-sm leading-relaxed">
        <div className="rounded border-l-4 border-amber-600 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900">Not Legal or Medical Advice</h2>
          <p className="mt-1 text-sm text-amber-800">
            This application is a claim-preparation research aid intended solely for informational exploration. It is not accredited legal representation, formal medical diagnosis, or binding VA decision-making.
          </p>
        </div>

        <h2 className="mt-6 text-xl font-semibold">1. Regulatory Path Distinction</h2>
        <p>Users must distinguish between legally distinct claim paths:</p>
        <ul className="list-disc space-y-1 pl-6 text-sm">
          {secondaryReferences.map((reference) => (
            <li key={reference.id}>
              <strong>{reference.title} ({reference.citation}):</strong>{" "}
              {reference.description}
            </li>
          ))}
        </ul>
        <p className="text-sm">{CAUSED_AGGRAVATED_DISTINCTION}</p>
        <p className="text-sm">{TRACK_DISTINCTION_NOTICE}</p>

        <h2 className="mt-6 text-xl font-semibold">2. Citation Verification Notice</h2>
        <p>
          {UNVERIFIED_REFERENCE_NOTICE} All regulatory references are provided as unverified starting points requiring verification by a qualified Veterans Service Officer (VSO) or accredited representative.
        </p>

        <h2 className="mt-6 text-xl font-semibold">3. Knowledge Base Completeness</h2>
        <p>
          The VASRD catalog contains {totalConditions} conditions across {totalBodySystems} body systems, and {publishedMappingCount} currently have published secondary mappings in this phase dataset.
        </p>

        <h2 className="mt-6 text-xl font-semibold">4. Independent Service; No VA Affiliation</h2>
        <p>
          The Secondary Condition Finder is an independent research aid. It is not an official U.S. Department of Veterans Affairs website, is not operated by VA, and does not speak for or bind VA. References to VA forms, regulations, manuals, programs, or APIs are provided to support research and verification, not to imply endorsement or affiliation.
        </p>

        <h2 className="mt-6 text-xl font-semibold">5. No Claim Filing, Representation, or Account Access</h2>
        <p>
          This phase does not file claims, submit evidence to VA, access a Veteran&apos;s VA account, represent a claimant before VA, or create an attorney-client, representative-client, or clinician-patient relationship. The environment-aware VA public-reference adapter is disabled by default; credentialed sandbox connectivity and future production connectivity remain separate external gates and must not be treated as live VA connectivity until objectively verified.
        </p>
        <p>
          Users remain responsible for deciding what, if anything, to submit through official VA channels and should use current official forms and instructions. A qualified accredited representative or clinician should be consulted when professional judgment is needed.
        </p>

        <h2 className="mt-6 text-xl font-semibold">6. User Verification Responsibility</h2>
        <p>
          Laws, regulations, VA manuals, forms, medical literature, and administrative procedures can change. The app&apos;s authored mappings and references are research starting points. Users should verify current source material before relying on it for a filing, medical discussion, or other consequential decision.
        </p>
        <p>
          Recommendation ranking, evidence-gap text, medication/treatment text overlap, and local evidence labels are organizational aids only. They do not establish service connection, medical causation, aggravation, nexus, rating entitlement, credibility, competency, or evidentiary sufficiency for an individual claim.
        </p>

        <h2 className="mt-6 text-xl font-semibold">7. Privacy and Local Evidence Handling</h2>
        <p>
          Use of the application is also subject to the <Link href="/privacy" className="font-medium text-blue-700 hover:underline">Privacy Policy</Link>, which describes browser-local workflow state, evidence review, session-storage retention, telemetry posture, the current VA API boundary, and <strong>your data-deletion right, its 45-day completion commitment, and the privacy contact channel</strong> — see &quot;8. Your privacy rights and how to contact us&quot; in the Privacy Policy for how to request deletion or correction. The <Link href="/privacy/request" className="font-medium text-blue-700 hover:underline">privacy request intake page</Link> prepares a deletion, access, correction, or question message in your own email application; nothing on it is submitted to this application. Users should avoid entering unrelated sensitive information and should use the minimum information needed for the research task.
        </p>

        <h2 className="mt-6 text-xl font-semibold">8. Availability and Future Integrations</h2>
        <p>
          Features, datasets, and integrations may change as the project is reviewed and expanded. A future VA sandbox or production API integration requires separate credential, privacy, security, and deployment review before the application may describe Veteran-specific data as being transmitted to VA. Successful local fallback behavior, automated tests, or mock responses do not prove live VA connectivity.
        </p>
      </section>

      <div className="mt-8 border-t pt-4">
        <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
          &larr; Return to Home
        </Link>
      </div>
    </main>
  );
}
