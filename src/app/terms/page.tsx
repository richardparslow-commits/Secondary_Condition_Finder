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
      <p className="mb-6 text-sm text-gray-600">Last updated: July 2026</p>

      <section className="space-y-4 text-sm leading-relaxed">
        <div className="rounded border-l-4 border-amber-600 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900">Not Legal or Medical Advice</h2>
          <p className="mt-1 text-xs text-amber-800">
            This application is a claim-preparation research aid intended solely for informational exploration. It is not accredited legal representation, formal medical diagnosis, or binding VA decision-making.
          </p>
        </div>

        <h2 className="mt-6 text-xl font-semibold">1. Regulatory Path Distinction</h2>
        <p>Users must distinguish between legally distinct claim paths:</p>
        <ul className="list-disc space-y-1 pl-6 text-xs">
          {secondaryReferences.map((reference) => (
            <li key={reference.id}>
              <strong>{reference.title} ({reference.citation}):</strong>{" "}
              {reference.description}
            </li>
          ))}
        </ul>
        <p className="text-xs">{CAUSED_AGGRAVATED_DISTINCTION}</p>
        <p className="text-xs">{TRACK_DISTINCTION_NOTICE}</p>

        <h2 className="mt-6 text-xl font-semibold">2. Citation Verification Notice</h2>
        <p>
          {UNVERIFIED_REFERENCE_NOTICE} All regulatory references are provided as unverified starting points requiring verification by a qualified Veterans Service Officer (VSO) or accredited representative.
        </p>

        <h2 className="mt-6 text-xl font-semibold">3. Knowledge Base Completeness</h2>
        <p>
          The VASRD catalog contains {totalConditions} conditions across {totalBodySystems} body systems, and {publishedMappingCount} currently have published secondary mappings in this phase dataset.
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
