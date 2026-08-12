"use client";

import { useMemo, useState } from "react";

import {
  analyzeEvidenceText,
  evidenceAnalysisStorageKey,
  type ClinicianCredential,
  type EvidenceAnalysis,
} from "@/lib/evidence/extract";

interface Props {
  conditionTerms: string[];
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_SOURCES = 10;
const SUPPORTED_EXTENSIONS = [".txt", ".md", ".csv", ".json", ".log"];

function isSupportedTextFile(file: File): boolean {
  const lower = file.name.toLocaleLowerCase();
  return file.type.startsWith("text/") || file.type === "application/json" || SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function loadStored(): EvidenceAnalysis[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(evidenceAnalysisStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is EvidenceAnalysis => Boolean(item && typeof item === "object" && (item as EvidenceAnalysis).version === 1));
  } catch {
    return [];
  }
}

function saveStored(analyses: EvidenceAnalysis[]): void {
  window.sessionStorage.setItem(evidenceAnalysisStorageKey, JSON.stringify(analyses.slice(-MAX_SOURCES)));
}

export function LocalEvidenceAnalyzer({ conditionTerms }: Props) {
  const [credential, setCredential] = useState<ClinicianCredential>("unknown");
  const [locatorPrefix, setLocatorPrefix] = useState("");
  const [pastedSourceName, setPastedSourceName] = useState("Pasted medical record text");
  const [pastedText, setPastedText] = useState("");
  const [analyses, setAnalyses] = useState<EvidenceAnalysis[]>(() => loadStored());
  const [message, setMessage] = useState<string | null>(null);

  const totals = useMemo(
    () => ({
      nexus: analyses.reduce((sum, analysis) => sum + analysis.nexusRelevantCount, 0),
      supporting: analyses.reduce((sum, analysis) => sum + analysis.supportingCount, 0),
    }),
    [analyses],
  );

  function commitAnalysis(analysis: EvidenceAnalysis) {
    const next = [...analyses.filter((existing) => existing.sourceName !== analysis.sourceName), analysis].slice(-MAX_SOURCES);
    setAnalyses(next);
    saveStored(next);
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setMessage(null);

    for (const file of Array.from(files).slice(0, MAX_SOURCES)) {
      if (file.size > MAX_FILE_BYTES) {
        setMessage(`${file.name} was not analyzed because it exceeds the 5 MB local-analysis limit.`);
        continue;
      }
      if (!isSupportedTextFile(file)) {
        setMessage(`${file.name} is not a directly supported text format. For PDF/DOCX records, paste text exported from the document and provide the page or section locator below.`);
        continue;
      }

      const text = await file.text();
      const analysis = analyzeEvidenceText(
        text,
        { sourceName: file.name, credential, locatorPrefix: locatorPrefix.trim() || undefined },
        conditionTerms,
      );
      commitAnalysis(analysis);
    }
  }

  function analyzePastedText() {
    setMessage(null);
    const text = pastedText.trim();
    if (!text) {
      setMessage("Paste source text before running local evidence analysis.");
      return;
    }
    const analysis = analyzeEvidenceText(
      text,
      {
        sourceName: pastedSourceName.trim() || "Pasted medical record text",
        credential,
        locatorPrefix: locatorPrefix.trim() || undefined,
      },
      conditionTerms,
    );
    commitAnalysis(analysis);
    setPastedText("");
  }

  function clearEvidence() {
    window.sessionStorage.removeItem(evidenceAnalysisStorageKey);
    setAnalyses([]);
    setMessage("Local evidence excerpts were cleared from this browser tab.");
  }

  return (
    <section className="space-y-5" aria-labelledby="local-evidence-heading">
      <div>
        <h2 id="local-evidence-heading" className="text-xl font-bold">Local Evidence Review</h2>
        <p className="mt-1 text-sm text-slate-600">
          Evidence text is analyzed in this browser tab. Raw document text is not submitted to the application server, stored in workflow cookies, or written to application logs.
        </p>
      </div>

      <div className="ui-callout text-sm">
        <strong>Conservative evidence rule:</strong> the app labels an excerpt “nexus-relevant” only when the source is identified as clinician-authored, the excerpt contains causation/aggravation language, and it mentions at least one condition selected in this workflow. This does not decide whether VA will consider the evidence competent or persuasive.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium">
          Source author / credential
          <select className="mt-1 w-full px-3" value={credential} onChange={(event) => setCredential(event.target.value as ClinicianCredential)}>
            <option value="unknown">Unknown / not specified</option>
            <option value="physician">Physician (MD/DO)</option>
            <option value="psychologist">Licensed psychologist</option>
            <option value="np-pa">Nurse practitioner / physician assistant</option>
            <option value="other-licensed-clinician">Other licensed clinician</option>
            <option value="non-clinician">Non-clinician / lay statement</option>
          </select>
        </label>
        <label className="block text-sm font-medium">
          Page / section locator (optional)
          <input className="mt-1 w-full px-3" value={locatorPrefix} onChange={(event) => setLocatorPrefix(event.target.value)} placeholder="Example: page 14 or Assessment section" />
        </label>
      </div>

      <label className="block rounded-xl border border-slate-200 p-4">
        <span className="block font-semibold">Analyze supported text files locally</span>
        <span className="mt-1 block text-sm text-slate-600">Supported directly: TXT, Markdown, CSV, JSON and other text files, up to 5 MB each. Files stay in the browser.</span>
        <input
          type="file"
          multiple
          accept="text/*,.txt,.md,.csv,.json,.log"
          className="mt-4 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:font-semibold file:text-white"
          onChange={(event) => void handleFiles(event.target.files)}
        />
      </label>

      <div className="rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold">PDF / DOCX or other records</h3>
        <p className="mt-1 text-sm text-slate-600">Direct PDF/DOCX parsing is not enabled in this privacy-first slice. Export or copy the relevant text from the document, enter a page/section locator above, and analyze it locally here. Scanned-image records require OCR outside this app before text can be reviewed.</p>
        <label className="mt-4 block text-sm font-medium">
          Source name
          <input className="mt-1 w-full px-3" value={pastedSourceName} onChange={(event) => setPastedSourceName(event.target.value)} />
        </label>
        <label className="mt-3 block text-sm font-medium">
          Paste exact extracted text
          <textarea className="mt-1 min-h-40 w-full px-3 py-2" value={pastedText} onChange={(event) => setPastedText(event.target.value)} placeholder="Paste text exactly as it appears in the source record." />
        </label>
        <button type="button" className="ui-button mt-3" onClick={analyzePastedText}>Analyze pasted text locally</button>
      </div>

      {message && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}

      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Evidence excerpt summary</h3>
            <p className="text-sm text-slate-600">{totals.nexus} nexus-relevant excerpt(s); {totals.supporting} supporting excerpt(s) retained for this browser tab.</p>
          </div>
          <button type="button" className="ui-button-secondary" onClick={clearEvidence}>Clear local evidence</button>
        </div>
        {analyses.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No evidence excerpts have been analyzed in this tab.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {analyses.map((analysis) => (
              <article key={analysis.sourceName} className="rounded-lg bg-slate-50 p-3">
                <h4 className="font-semibold">{analysis.sourceName}</h4>
                <p className="text-xs text-slate-600">{analysis.nexusRelevantCount} nexus-relevant; {analysis.supportingCount} supporting</p>
                <ul className="mt-2 space-y-2">
                  {analysis.excerpts.slice(0, 5).map((excerpt, index) => (
                    <li key={`${excerpt.locator}-${index}`} className="text-sm">
                      <span className={`mr-2 rounded px-1.5 py-0.5 text-xs ${excerpt.strength === "nexus-relevant" ? "bg-blue-100 text-blue-900" : "bg-slate-200 text-slate-800"}`}>{excerpt.strength}</span>
                      <q>{excerpt.quote}</q> <span className="text-xs text-slate-500">— {excerpt.locator}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
