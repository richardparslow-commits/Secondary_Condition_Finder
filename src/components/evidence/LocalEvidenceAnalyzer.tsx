"use client";

import { useEffect, useMemo, useState } from "react";

import {
  extractLocalEvidenceDocument,
  MAX_LOCAL_EVIDENCE_FILE_BYTES,
  MAX_LOCAL_EVIDENCE_PDF_PAGES,
  MAX_LOCAL_EVIDENCE_TEXT_CHARS,
} from "@/lib/evidence/document-extract";
import {
  analyzeEvidenceSegments,
  type ClinicianCredential,
  type EvidenceAnalysis,
  type EvidenceTextSegment,
} from "@/lib/evidence/extract";
import {
  clearStoredEvidence,
  loadStoredEvidence,
  saveStoredEvidence,
} from "@/lib/evidence/storage";

interface Props {
  conditionTerms: string[];
}

const MAX_SOURCES = 10;
const MAX_BATCH_BYTES = 50 * 1024 * 1024;
const SUPPORTED_TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".json", ".log"];

function isSupportedFile(file: File): boolean {
  const lower = file.name.toLocaleLowerCase();
  return (
    file.type.startsWith("text/") ||
    file.type === "application/json" ||
    file.type === "application/pdf" ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".pdf") ||
    lower.endsWith(".docx") ||
    SUPPORTED_TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext))
  );
}

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function loadStored(): EvidenceAnalysis[] {
  return loadStoredEvidence(getSessionStorage());
}

function saveStored(analyses: EvidenceAnalysis[]): boolean {
  return saveStoredEvidence(getSessionStorage(), analyses);
}

function withUserLocatorPrefix(segments: EvidenceTextSegment[], prefix: string): EvidenceTextSegment[] {
  const trimmed = prefix.trim();
  if (!trimmed) return segments;
  return segments.map((segment) => ({
    ...segment,
    locatorPrefix: `${trimmed}, ${segment.locatorPrefix}`,
  }));
}

export function LocalEvidenceAnalyzer({ conditionTerms }: Props) {
  const [credential, setCredential] = useState<ClinicianCredential>("unknown");
  const [locatorPrefix, setLocatorPrefix] = useState("");
  const [pastedSourceName, setPastedSourceName] = useState("Pasted medical record text");
  const [pastedText, setPastedText] = useState("");
  const [analyses, setAnalyses] = useState<EvidenceAnalysis[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      setAnalyses(loadStored());
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  const totals = useMemo(
    () => ({
      nexus: analyses.reduce((sum, analysis) => sum + analysis.nexusRelevantCount, 0),
      supporting: analyses.reduce((sum, analysis) => sum + analysis.supportingCount, 0),
    }),
    [analyses],
  );

  function commitAnalysis(analysis: EvidenceAnalysis) {
    setAnalyses((current) => {
      const next = [...current.filter((existing) => existing.sourceName !== analysis.sourceName), analysis].slice(-MAX_SOURCES);
      saveStored(next);
      return next;
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setMessage(null);
    setWarnings([]);
    setBusy(true);

    const nextWarnings: string[] = [];
    const selectedFiles = Array.from(files);
    if (selectedFiles.length > MAX_SOURCES) {
      nextWarnings.push(`Only the first ${MAX_SOURCES} selected documents are considered in one local-analysis batch.`);
    }
    let processed = 0;
    let acceptedBatchBytes = 0;

    try {
      for (const file of selectedFiles.slice(0, MAX_SOURCES)) {
        if (file.size > MAX_LOCAL_EVIDENCE_FILE_BYTES) {
          nextWarnings.push(`${file.name} was not analyzed because it exceeds the 20 MB local-analysis limit.`);
          continue;
        }
        if (acceptedBatchBytes + file.size > MAX_BATCH_BYTES) {
          nextWarnings.push(`${file.name} was not analyzed because the selected documents would exceed the 50 MB per-batch local-analysis limit.`);
          continue;
        }
        if (!isSupportedFile(file)) {
          nextWarnings.push(`${file.name} is not a supported local-analysis format. Use PDF, DOCX, TXT, Markdown, CSV, JSON, LOG, or paste exact text below.`);
          continue;
        }

        acceptedBatchBytes += file.size;
        try {
          const extracted = await extractLocalEvidenceDocument(file);
          nextWarnings.push(...extracted.warnings.map((warning) => `${file.name}: ${warning}`));
          if (extracted.segments.length === 0) continue;

          const analysis = analyzeEvidenceSegments(
            withUserLocatorPrefix(extracted.segments, locatorPrefix),
            { sourceName: extracted.sourceName, credential },
            conditionTerms,
          );
          commitAnalysis(analysis);
          processed += 1;
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Unknown extraction error";
          nextWarnings.push(`${file.name} could not be analyzed locally: ${detail}`);
        }
      }

      setWarnings(nextWarnings);
      setMessage(processed > 0 ? `Analyzed ${processed} document${processed === 1 ? "" : "s"} locally in this browser tab.` : "No document produced extractable text.");
    } finally {
      setBusy(false);
    }
  }

  function analyzePastedText() {
    setMessage(null);
    setWarnings([]);
    const text = pastedText.trim();
    if (!text) {
      setMessage("Paste source text before running local evidence analysis.");
      return;
    }
    if (text.length > MAX_LOCAL_EVIDENCE_TEXT_CHARS) {
      setMessage(`Pasted text is limited to ${MAX_LOCAL_EVIDENCE_TEXT_CHARS.toLocaleString("en-US")} characters per source.`);
      return;
    }
    const segments = withUserLocatorPrefix([{ text, locatorPrefix: "pasted text" }], locatorPrefix);
    const analysis = analyzeEvidenceSegments(
      segments,
      {
        sourceName: pastedSourceName.trim() || "Pasted medical record text",
        credential,
      },
      conditionTerms,
    );
    commitAnalysis(analysis);
    setPastedText("");
    setMessage("Pasted text was analyzed locally in this browser tab.");
  }

  function clearEvidence() {
    const storageCleared = clearStoredEvidence(getSessionStorage());
    setAnalyses([]);
    setWarnings([]);
    setMessage(
      storageCleared
        ? "Local evidence excerpts were cleared from this browser tab."
        : "Local evidence excerpts were cleared from this view. Browser session storage was unavailable, so stored excerpts could not be confirmed removed.",
    );
  }

  return (
    <section className="space-y-5" aria-labelledby="local-evidence-heading">
      <div>
        <h2 id="local-evidence-heading" className="text-xl font-bold">Local Evidence Review</h2>
        <p className="mt-1 text-sm text-slate-600">
          PDF, DOCX, and supported text records are read in this browser tab. Raw document bytes and raw document text are not submitted to the application server, stored in workflow cookies, or written to application logs. If browser session storage is unavailable or full, the current analysis continues in memory but may not restore after navigation or reload.
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
          Additional locator context (optional)
          <input className="mt-1 w-full px-3" value={locatorPrefix} onChange={(event) => setLocatorPrefix(event.target.value)} placeholder="Example: C-file export or Assessment section" />
        </label>
      </div>

      <label className="block rounded-xl border border-slate-200 p-4">
        <span className="block font-semibold">Analyze evidence files locally</span>
        <span className="mt-1 block text-sm text-slate-600">Supported directly: PDF, DOCX, TXT, Markdown, CSV, JSON and other text files. Limits: 20 MB per file, 10 selected files and 50 MB per batch, {MAX_LOCAL_EVIDENCE_PDF_PAGES} PDF pages per source, and {MAX_LOCAL_EVIDENCE_TEXT_CHARS.toLocaleString("en-US")} extracted characters per source. Files stay in the browser.</span>
        <input
          type="file"
          multiple
          accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*,.pdf,.docx,.txt,.md,.csv,.json,.log"
          className="mt-4 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:font-semibold file:text-white"
          onChange={(event) => void handleFiles(event.target.files)}
          disabled={busy}
        />
        {busy && <span role="status" className="mt-3 block text-sm font-medium text-blue-800">Reading selected documents locally…</span>}
      </label>

      <div className="rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold">OCR and manual text fallback</h3>
        <p className="mt-1 text-sm text-slate-600">Image-only/scanned PDF pages may contain no selectable text. The app reports those pages instead of guessing. Run OCR in a trusted tool first, then paste the exact text here with any available page/section context.</p>
        <label className="mt-4 block text-sm font-medium">
          Source name
          <input className="mt-1 w-full px-3" value={pastedSourceName} onChange={(event) => setPastedSourceName(event.target.value)} />
        </label>
        <label className="mt-3 block text-sm font-medium">
          Paste exact extracted text (up to {MAX_LOCAL_EVIDENCE_TEXT_CHARS.toLocaleString("en-US")} characters)
          <textarea className="mt-1 min-h-40 w-full px-3 py-2" maxLength={MAX_LOCAL_EVIDENCE_TEXT_CHARS} value={pastedText} onChange={(event) => setPastedText(event.target.value)} placeholder="Paste text exactly as it appears in the source record." />
        </label>
        <button type="button" className="ui-button mt-3" onClick={analyzePastedText}>Analyze pasted text locally</button>
      </div>

      {message && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{message}</p>}
      {warnings.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
        >
          <strong>Extraction notices</strong>
          <ul className="mt-2 list-disc space-y-1 pl-5">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Evidence excerpt summary</h3>
            <p
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="text-sm text-slate-600"
            >
              {totals.nexus} nexus-relevant excerpt(s); {totals.supporting} supporting excerpt(s) retained for this browser tab.
            </p>
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
