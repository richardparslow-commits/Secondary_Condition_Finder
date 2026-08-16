import type { Metadata } from "next";
import Link from "next/link";

import { DisclaimerFooter } from "@/components/Disclaimer";
import { LocalEvidenceAnalyzer } from "@/components/evidence/LocalEvidenceAnalyzer";
import { indexById } from "@/lib/catalog/lookup";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { buildEvidenceConditionTerms } from "@/lib/evidence/condition-terms";
import { readSecondaryWorkflowSession, type StoredSecondaryWorkflowState } from "@/lib/secondary-workflow/session";
import { saveDocumentsSelection } from "../actions";

interface UploadPageProps { workflowState?: StoredSecondaryWorkflowState; }

export const metadata: Metadata = {
  title: "Supporting Documents | Secondary Condition Finder",
};

export const dynamic = "force-dynamic";

export default async function UploadStepPage({ workflowState }: UploadPageProps = {}) {
  const catalog = loadConditionCatalog();
  const byId = indexById(catalog);
  const session = workflowState ?? (await readSecondaryWorkflowSession());
  const diagnosedConditionIds = session.diagnosedConditionIds ?? [];
  const serviceConnectedConditionIds = session.serviceConnectedConditionIds ?? [];
  const ratingsByConditionId = session.ratingsByConditionId;
  const documentsShared = session.documentsShared ?? false;
  const medications = session.medications ?? [];
  const treatments = session.treatments ?? [];

  if (diagnosedConditionIds.length === 0 || serviceConnectedConditionIds.length === 0 || !ratingsByConditionId || serviceConnectedConditionIds.some((id) => ratingsByConditionId[id] === undefined)) {
    return <main><header className="page-hero"><h1>Enter ratings first</h1><p>Complete the ratings step before continuing to document availability.</p></header><div className="ui-callout mb-5 text-sm"><strong>🔒 Evidence Upload Privacy Contract:</strong> Document review is <strong>strictly optional</strong>. Supported evidence text is analyzed locally in the browser. Raw document text is not sent to the application server, stored in workflow cookies, or written to <strong>raw text logs</strong>.</div><Link href="/secondary/ratings" className="ui-button">Back to current ratings</Link></main>;
  }

  const selectedConditions = diagnosedConditionIds.flatMap((id) => {
    const condition = byId.get(id);
    return condition ? [condition] : [];
  });
  const conditionTerms = buildEvidenceConditionTerms(selectedConditions);

  return (
    <main>
      <header className="page-hero text-center"><p className="ui-kicker">Step 4 of 6</p><h1>Supporting Documents</h1><p className="mx-auto mt-3 max-w-3xl text-lg">Optionally review evidence and add limited medication or treatment context that may help identify authored pathways worth discussing with a qualified professional.</p></header>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Workflow progress"><span>✓ Diagnosed</span><span>✓ Service-connected</span><span>✓ Ratings</span><strong className="text-blue-700">4 Documents</strong><span>5 Connections</span><span>6 Evidence</span></div>

      <div className="ui-grid">
        <aside className="ui-card">
          <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Optional Evidence Review</h2></div>
          <p className="text-sm">Use this step if you want the app to identify exact source excerpts that may be useful for later review with a qualified provider or accredited representative.</p>
          <div className="ui-divider" />
          <div className="ui-callout text-sm"><strong>This is evidence triage, not a medical or legal conclusion.</strong><p className="mt-1">The app preserves exact excerpt text and provenance. It does not decide whether an excerpt is sufficient to establish a nexus, whether an author is legally competent, or whether VA will find the evidence persuasive.</p></div>
          <p className="mt-5 text-sm">Document, medication, and treatment context are all optional. You can continue without providing them.</p>
        </aside>

        <section className="ui-card min-w-0">
          <LocalEvidenceAnalyzer conditionTerms={conditionTerms} />

          <form action={saveDocumentsSelection} className="mt-6 space-y-5">
            <fieldset className="rounded-xl border border-slate-200 p-4 shadow-none">
              <legend className="font-semibold">Optional medication and treatment context</legend>
              <p className="mt-1 text-sm text-slate-600">Enter only the minimum context useful for pathway research, one item per line. Up to 20 entries per field, 160 characters each. Do not enter Social Security numbers, claim numbers, addresses, or unrelated medical details.</p>
              <div className="mt-4 grid gap-5">
                <div>
                  <label htmlFor="medications" className="block font-medium">Medications</label>
                  <p id="medications-help" className="mt-1 text-sm text-slate-600">Examples: SSRI, NSAID, prescribed corticosteroid. A reported term is highlighted only when it literally overlaps authored pathway or evidence-gap text.</p>
                  <textarea id="medications" name="medications" aria-describedby="medications-help" rows={4} maxLength={3220} defaultValue={medications.join("\n")} className="mt-2 w-full rounded-lg border border-slate-300 p-3" />
                </div>
                <div>
                  <label htmlFor="treatments" className="block font-medium">Treatments, procedures, or devices</label>
                  <p id="treatments-help" className="mt-1 text-sm text-slate-600">Examples: physical therapy, CPAP, knee brace, surgery. This context does not change recommendation ranking or establish causation.</p>
                  <textarea id="treatments" name="treatments" aria-describedby="treatments-help" rows={4} maxLength={3220} defaultValue={treatments.join("\n")} className="mt-2 w-full rounded-lg border border-slate-300 p-3" />
                </div>
              </div>
              <div className="ui-callout mt-4 text-sm"><strong>Workflow privacy:</strong> These optional entries are stored only in the same encrypted, HttpOnly, short-lived workflow cookie used for the current secondary review. They are not placed in URLs, recommendation logs, telemetry, or user accounts.</div>
            </fieldset>

            <fieldset className="rounded-xl border border-slate-200 p-4 shadow-none">
              <legend className="font-semibold">Do you want document availability reflected in your checklist?</legend>
              <p className="mt-1 text-sm text-slate-600">This choice stores a yes/no workflow flag. Raw evidence text and locally extracted excerpts are not added to the workflow cookie.</p>
              <div className="mt-4 grid gap-3">
                <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3"><input type="radio" name="documentsShared" value="yes" defaultChecked={documentsShared} className="h-5 w-5" />Yes, I reviewed or have documents available</label>
                <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3"><input type="radio" name="documentsShared" value="no" defaultChecked={!documentsShared} className="h-5 w-5" />No, continue without documents</label>
              </div>
            </fieldset>

            <div className="ui-callout text-sm"><strong>Evidence Upload Privacy Contract:</strong> Raw medical document content is not sent to this application server, persisted in user accounts, included in telemetry, or written to <strong>raw text logs</strong>. Only locally extracted excerpts remain temporarily in this browser tab via session storage until cleared or the tab is closed. Optional medication/treatment entries are separate bounded workflow context stored only in the encrypted short-lived cookie described above.</div>

            <div className="ui-actions"><Link href="/secondary/ratings" className="ui-button-secondary">← Back to Step 3</Link><button type="submit" className="ui-button">Review Possible Connections <span aria-hidden="true">→</span></button></div>
          </form>
        </section>

        <aside className="ui-stack">
          <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">★</span><h2 className="text-xl font-bold">What Strong Evidence Often Includes</h2></div><ul className="list-disc space-y-3 pl-5 text-sm"><li>Current diagnosis and treatment records</li><li>A timeline showing onset and progression</li><li>Relevant treatment history and medication records</li><li>A clinician-authored medical opinion addressing causation or aggravation when medical expertise is required</li><li>Evidence discussing alternative causes when clinically relevant</li></ul></section>
          <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">→</span><h2 className="text-xl font-bold">Current Run</h2></div><ul className="space-y-2 text-sm">{serviceConnectedConditionIds.map((id) => { const condition = byId.get(id); if (!condition) return null; const rating = ratingsByConditionId[id]; return <li key={id} className="flex justify-between gap-3 border-b border-slate-100 pb-2"><span className="font-medium">{condition.name}</span><span className="text-blue-700">{rating === null ? "Not provided" : `${rating}%`}</span></li>; })}</ul>{(medications.length > 0 || treatments.length > 0) && <p className="mt-4 text-xs text-slate-600">Optional context saved: {medications.length} medication item(s), {treatments.length} treatment item(s).</p>}</section>
        </aside>
      </div>
      <DisclaimerFooter />
    </main>
  );
}
