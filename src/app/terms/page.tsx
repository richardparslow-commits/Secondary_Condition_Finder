import Link from "next/link";

import {
  CAUSED_AGGRAVATED_DISTINCTION,
  TRACK_DISTINCTION_NOTICE,
  UNVERIFIED_REFERENCE_NOTICE,
} from "@/lib/legal/phrases";
import { SECONDARY_LEGAL_REFERENCES } from "@/lib/legal/secondaryReferences";

export default function TermsPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8 text-gray-900">
      <h1 className="text-3xl font-bold mb-4">Terms of Use & Legal Disclaimers</h1>
      <p className="text-sm text-gray-600 mb-6">Last updated: July 2026</p>
      
      <section className="space-y-4 text-sm leading-relaxed">
        <div className="bg-amber-50 border-l-4 border-amber-600 p-4 rounded">
          <h2 className="font-semibold text-amber-900">Not Legal or Medical Advice</h2>
          <p className="text-amber-800 text-xs mt-1">
            This application is a claim-preparation research aid intended solely for informational exploration. It is not accredited legal representation, formal medical diagnosis, or binding VA decision-making.
          </p>
        </div>

        <h2 className="text-xl font-semibold mt-6">1. Regulatory Path Distinction</h2>
        <p>
          Users must distinguish between legally distinct claim paths:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-xs">
          {SECONDARY_LEGAL_REFERENCES.map((reference) => (
            <li key={reference.id}>
              <strong>{reference.label} ({reference.citation}):</strong>{" "}
              {reference.explanation}
            </li>
          ))}
        </ul>
        <p className="text-xs">
          {CAUSED_AGGRAVATED_DISTINCTION}
        </p>
        <p className="text-xs">
          {TRACK_DISTINCTION_NOTICE}
        </p>

        <h2 className="text-xl font-semibold mt-6">2. Citation Verification Notice</h2>
        <p>
          {UNVERIFIED_REFERENCE_NOTICE} All regulatory references (such as 38
          CFR citations) are provided as unverified starting points (
          <code className="bg-gray-100 px-1 rounded">verified: false</code>)
          requiring verification by a qualified Veterans Service Officer (VSO)
          or accredited representative.
        </p>

        <h2 className="text-xl font-semibold mt-6">3. Knowledge Base Completeness</h2>
        <p>
          The VASRD catalog contains 191 conditions across 14 body systems. Published secondary mappings actively return exploration suggestions, while draft placeholders are strictly excluded from recommendation results. Absence of a published mapping does not imply a secondary connection is legally invalid.
        </p>
      </section>

      <div className="mt-8 pt-4 border-t">
        <Link href="/" className="text-blue-600 hover:underline text-sm font-medium">
          &larr; Return to Home
        </Link>
      </div>
    </main>
  );
}
