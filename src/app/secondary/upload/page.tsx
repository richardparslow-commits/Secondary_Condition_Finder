import Link from "next/link";

import { DisclaimerFooter } from "@/components/Disclaimer";
import { indexById } from "@/lib/catalog/lookup";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { readSecondaryWorkflowSession, type StoredSecondaryWorkflowState } from "@/lib/secondary-workflow/session";
import { saveDocumentsSelection } from "../actions";

interface UploadPageProps { workflowState?: StoredSecondaryWorkflowState; }
export const dynamic = "force-dynamic";

export default async function UploadStepPage({ workflowState }: UploadPageProps = {}) {
  const catalog = loadConditionCatalog();
  const byId = indexById(catalog);
  const session = workflowState ?? (await readSecondaryWorkflowSession());
  const diagnosedConditionIds = session.diagnosedConditionIds ?? [];
  const serviceConnectedConditionIds = session.serviceConnectedConditionIds ?? [];
  const ratingsByConditionId = session.ratingsByConditionId;
  const documentsShared = session.documentsShared ?? false;

  if (diagnosedConditionIds.length === 0 || serviceConnectedConditionIds.length === 0 || !ratingsByConditionId || serviceConnectedConditionIds.some((id) => ratingsByConditionId[id] === undefined)) {
    return <main><header className="page-hero"><h1>Enter ratings first</h1><p>Complete the ratings step before continuing to document availability.</p></header><div className="ui-callout mb-5 text-sm"><strong>🔒 Evidence Upload Privacy Contract:</strong> Uploading documents is <strong>strictly optional</strong>. Files are processed locally or through secure non-retentive extraction boundaries. We do not store <strong>raw text logs</strong>, medical record files, or personal identifiers (PII).</div><Link href="/secondary/ratings" className="ui-button">Back to current ratings</Link></main>;
  }

  return (
    <main>
      <header className="page-hero text-center"><p className="ui-kicker">Step 4 of 6</p><h1>Supporting Documents</h1><p className="mx-auto mt-3 max-w-3xl text-lg">Track whether you have records available for manual review. This step does not interpret or score your documents.</p></header>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Workflow progress"><span>✓ Diagnosed</span><span>✓ Service-connected</span><span>✓ Ratings</span><strong className="text-blue-700">4 Documents</strong><span>5 Suggestions</span><span>6 Evidence</span></div>

      <form action={saveDocumentsSelection}>
        <div className="ui-grid">
          <aside className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Optional Document Checklist</h2></div>
            <p className="text-sm">Use this step to note whether you have supporting documents ready to review with a provider or representative.</p>
            <div className="ui-divider" />
            <div className="ui-callout text-sm"><strong>This is a research aid, not a decision.</strong><p className="mt-1">Files selected here are not uploaded for AI analysis in this Phase 1 MVP. This page does not medically interpret, summarize, or rate file contents.</p></div>
            <p className="mt-5 text-sm">You are not required to provide every possible record. Include only what you actually have and intend to review.</p>
          </aside>

          <section className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">□</span><div><h2 className="text-xl font-bold">Document Availability</h2><p className="text-sm text-slate-600">This choice only updates checklist wording; it does not trigger parsing.</p></div></div>
            <label className="block rounded-xl border border-slate-200 p-4">
              <span className="block font-semibold">Optional local file picker</span>
              <span className="mt-1 block text-sm text-slate-600">Select files locally if useful for your own organization. The app does not analyze them in this step.</span>
              <input type="file" multiple className="mt-4 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:font-semibold file:text-white" aria-describedby="upload-processing-limit" />
            </label>

            <fieldset className="mt-5 rounded-xl border border-slate-200 p-4 shadow-none">
              <legend className="font-semibold">Do you want document availability reflected in your checklist?</legend>
              <p id="upload-processing-limit" className="mt-1 text-sm text-slate-600">No document parsing is triggered by this choice.</p>
              <div className="mt-4 grid gap-3">
                <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3"><input type="radio" name="documentsShared" value="yes" defaultChecked={documentsShared} className="h-5 w-5" />Yes, I have documents ready to review manually</label>
                <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3"><input type="radio" name="documentsShared" value="no" defaultChecked={!documentsShared} className="h-5 w-5" />No, continue without documents</label>
              </div>
            </fieldset>

            <div className="ui-callout mt-5 text-sm"><strong>Evidence Upload Privacy Contract:</strong> Uploading documents is <strong>strictly optional</strong>. This workflow does not store raw medical document content in <strong>raw text logs</strong>, event logs, or user accounts.</div>
          </section>

          <aside className="ui-stack">
            <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">★</span><h2 className="text-xl font-bold">What Strong Evidence Often Includes</h2></div><ul className="list-disc space-y-3 pl-5 text-sm"><li>Current diagnosis and treatment records</li><li>A timeline showing onset and progression</li><li>Relevant treatment history and medication records</li><li>A medical opinion when the relationship requires medical expertise</li></ul></section>
            <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">→</span><h2 className="text-xl font-bold">Current Run</h2></div><ul className="space-y-2 text-sm">{serviceConnectedConditionIds.map((id) => { const condition = byId.get(id); if (!condition) return null; const rating = ratingsByConditionId[id]; return <li key={id} className="flex justify-between gap-3 border-b border-slate-100 pb-2"><span className="font-medium">{condition.name}</span><span className="text-blue-700">{rating === null ? "Not provided" : `${rating}%`}</span></li>; })}</ul></section>
          </aside>
        </div>
        <div className="ui-actions"><Link href="/secondary/ratings" className="ui-button-secondary">← Back to Step 3</Link><button type="submit" className="ui-button">View Suggestions <span aria-hidden="true">→</span></button></div>
      </form>
      <DisclaimerFooter />
    </main>
  );
}
