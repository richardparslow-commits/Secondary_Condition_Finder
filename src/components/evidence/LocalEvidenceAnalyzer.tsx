"use client";

import { useEffect, useMemo, useState } from "react";
import { useRef } from "react";

import { extractLocalEvidenceDocument } from "@/lib/evidence/document-extract";
import {
  analyzeEvidenceSegments,
  type ClinicianCredential,
  type EvidenceAnalysis,
  type EvidenceTextSegment,
} from "@/lib/evidence/extract";
import {
  detectDocumentKindHint,
  isClinicianCredential,
  type EvidenceDocumentKindHint,
} from "@/lib/evidence/document-kind";
import {
  EVIDENCE_DEPTH_LIMITS,
  formatLimitBytes,
  formatLimitChars,
  type EvidenceAnalysisDepth,
  type EvidenceLimits,
} from "@/lib/evidence/limits";
import {
  clearOcrCheckpoint,
  computeOcrRenderMetrics,
  createLocalOcrWorker,
  loadOcrCheckpoint,
  OCR_PAGES_PER_CHUNK,
  probeWorkerHealth,
  releaseCanvas,
  saveOcrCheckpoint,
  sourceFingerprintForFile,
  yieldToBrowser,
} from "@/lib/evidence/ocr-session";
import {
  clearStoredEvidence,
  loadStoredEvidenceWithWarning,
  saveStoredEvidence,
  serializeStoredEvidenceWithInfo,
} from "@/lib/evidence/storage";

interface Props {
  conditionTerms: string[];
}

import { evidenceDepthStorageKey } from "@/lib/secondary-workflow/local-state";
const SUPPORTED_TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".json", ".log"];

const CREDENTIAL_OPTIONS: Array<{ value: ClinicianCredential; label: string }> = [
  { value: "unknown", label: "Unknown / not specified" },
  { value: "physician", label: "Physician (MD/DO)" },
  { value: "psychologist", label: "Licensed psychologist" },
  { value: "np-pa", label: "Nurse practitioner / physician assistant" },
  { value: "other-licensed-clinician", label: "Other licensed clinician" },
  { value: "non-clinician", label: "Non-clinician / lay statement" },
];

interface PendingEvidenceFile {
  id: number;
  file: File;
  sourceName: string;
  credential: ClinicianCredential;
  analyzed: boolean;
  hint?: EvidenceDocumentKindHint;
}

function isPdfFile(file: File): boolean {
  const lower = file.name.toLocaleLowerCase();
  return file.type === "application/pdf" || lower.endsWith(".pdf");
}

let stagedSequence = 0;

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

// #11: a corrupted evidence store must never reset the tab silently.
// Diagnostics contain a fixed code only, never parser messages or record text.
const STORAGE_CORRUPTED_WARNING =
  "Saved evidence in this browser tab could not be read and was not restored. It may have been corrupted; re-analyze the affected documents.";

function saveStored(
  analyses: EvidenceAnalysis[],
  limits: EvidenceLimits,
): boolean {
  return saveStoredEvidence(getSessionStorage(), analyses, limits);
}

function loadDepth(): EvidenceAnalysisDepth {
  try {
    const value = window.sessionStorage.getItem(evidenceDepthStorageKey);
    return value === "extended" ? "extended" : "standard";
  } catch {
    return "standard";
  }
}

function persistDepth(depth: EvidenceAnalysisDepth): void {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(evidenceDepthStorageKey, depth);
  } catch {
    // The depth choice is session-only; failure to persist is not fatal.
  }
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
  const [depth, setDepth] = useState<EvidenceAnalysisDepth>("standard");
  const [pending, setPending] = useState<PendingEvidenceFile[]>([]);
  const [ocrProgress, setOcrProgress] = useState<string | null>(null);
  const limits: EvidenceLimits = EVIDENCE_DEPTH_LIMITS[depth];
  // F-07: dual guard — `busyRef` is the synchronous guard across `await` gaps
  // (React state `busy` is async and would re-introduce a race if relied on
  // alone); `busy` drives the disabled UI. Every handler checks
  // `busyRef.current || busy` and sets both synchronously before any await.
  // Pinned by `tests/evidence-storage-parse-warning: busyRef guard at every entry point`.
  const busyRef = useRef(false);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const { analyses, parseError } = loadStoredEvidenceWithWarning(
        getSessionStorage(),
      );
      setAnalyses(analyses);
      if (parseError) {
        setWarnings((prev) =>
          prev.includes(STORAGE_CORRUPTED_WARNING)
            ? prev
            : [...prev, STORAGE_CORRUPTED_WARNING],
        );
      }
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  // Restore the depth choice after mount, then reload retained analyses with
  // the matching retention window so an Extended run is not truncated to the
  // Standard source window on return to this step.
  useEffect(() => {
    const depthTimer = window.setTimeout(() => {
      setDepth(loadDepth());
    }, 0);
    return () => window.clearTimeout(depthTimer);
  }, []);

  useEffect(() => {
    if (depth === "standard") return;
    const reloadTimer = window.setTimeout(() => {
      const { analyses, parseError } = loadStoredEvidenceWithWarning(
        getSessionStorage(),
        EVIDENCE_DEPTH_LIMITS[depth],
      );
      setAnalyses(analyses);
      if (parseError) {
        setWarnings((prev) =>
          prev.includes(STORAGE_CORRUPTED_WARNING)
            ? prev
            : [...prev, STORAGE_CORRUPTED_WARNING],
        );
      }
    }, 0);
    return () => window.clearTimeout(reloadTimer);
  }, [depth]);

  const totals = useMemo(
    () => ({
      nexus: analyses.reduce((sum, analysis) => sum + analysis.nexusRelevantCount, 0),
      supporting: analyses.reduce((sum, analysis) => sum + analysis.supportingCount, 0),
    }),
    [analyses],
  );

  function commitAnalysis(analysis: EvidenceAnalysis) {
    setAnalyses((current) => {
      const next = [...current.filter((existing) => existing.sourceName !== analysis.sourceName), analysis].slice(-limits.storedSources);
      const info = serializeStoredEvidenceWithInfo(next, limits);
      if (info.dropped > 0) {
        // Defer warning to avoid calling setState inside the setAnalyses updater (#3 silent-data-loss)
        queueMicrotask(() => {
          setWarnings((prev) => {
            const msg = `Storage limit reached (${formatLimitBytes(limits.storedBytes)}): ${info.dropped} older analyzed source(s) were dropped to fit. Clear old analyses or switch to Extended depth to retain more.`;
            return prev.includes(msg) ? prev : [...prev, msg];
          });
        });
      }
      saveStored(next, limits);
      return next;
    });
  }

  function dropAnalysis(sourceName: string) {
    setAnalyses((current) => {
      const next = current.filter((existing) => existing.sourceName !== sourceName);
      saveStored(next, limits);
      return next;
    });
  }

  function setRowOutcome(id: number, hint?: EvidenceDocumentKindHint) {
    setPending((current) =>
      current.map((row) =>
        row.id === id
          ? { ...row, analyzed: true, hint: hint ?? row.hint }
          : row,
      ),
    );
  }

  function stageFiles(fileList: FileList | null) {
    if (busyRef.current || busy || !fileList?.length) return;
    const selected = Array.from(fileList);
    const room = limits.batchSources - pending.length;
    if (room <= 0) {
      setMessage(
        `Only ${limits.batchSources} documents can be selected at once in ${depth === "standard" ? "Standard" : "Extended"} depth. Remove some selected documents first.`,
      );
      return;
    }
    const accepted = selected.slice(0, room).map((file) => ({
      id: (stagedSequence += 1),
      file,
      sourceName: file.name.trim() || "Local evidence document",
      credential,
      analyzed: false,
    }));
    setPending((current) => [...current, ...accepted]);
    setWarnings([]);
    setMessage(null);
    if (selected.length > room) {
      setWarnings([
        `Only ${room} of ${selected.length} selected documents fit in the current selection (${limits.batchSources} limit).`,
      ]);
    }
  }

  function clearPending() {
    if (busyRef.current || busy) return;
    clearOcrCheckpoint(getSessionStorage());
    setPending([]);
    setWarnings([]);
    setMessage("Selected document list cleared.");
  }

  function removePending(id: number) {
    if (busyRef.current || busy) return;
    clearOcrCheckpoint(getSessionStorage());
    const row = pending.find((item) => item.id === id);
    setPending((current) => current.filter((item) => item.id !== id));
    if (row?.analyzed) dropAnalysis(row.sourceName);
  }

  async function analyzeOneFile(
    row: PendingEvidenceFile,
    remainingBatchBytes: number,
  ): Promise<{ processed: number; warnings: string[]; skipped: boolean; hint?: EvidenceDocumentKindHint }> {
    const nextWarnings: string[] = [];
    if (row.file.size > limits.fileBytes) {
      nextWarnings.push(`${row.sourceName} was not analyzed because it exceeds the ${formatLimitBytes(limits.fileBytes)} local-analysis limit.`);
      return { processed: 0, warnings: nextWarnings, skipped: true };
    }
    if (!isSupportedFile(row.file)) {
      nextWarnings.push(`${row.sourceName} is not a supported local-analysis format. Use PDF, DOCX, TXT, Markdown, CSV, JSON, LOG, or paste exact text below.`);
      return { processed: 0, warnings: nextWarnings, skipped: true };
    }
    if (row.file.size > remainingBatchBytes) {
      nextWarnings.push(`${row.sourceName} was not analyzed because the selected documents would exceed the ${formatLimitBytes(limits.batchBytes)} per-batch local-analysis limit.`);
      return { processed: 0, warnings: nextWarnings, skipped: true };
    }

    try {
      const extracted = await extractLocalEvidenceDocument(row.file, limits);
      nextWarnings.push(...extracted.warnings.map((warning) => `${row.sourceName}: ${warning}`));
      if (extracted.segments.length === 0) {
        return { processed: 0, warnings: nextWarnings, skipped: false, hint: undefined };
      }
      const hint = detectDocumentKindHint(extracted.segments);
      if (hint === "va-decision-letter" && isClinicianCredential(row.credential)) {
        nextWarnings.push(
          `${row.sourceName}: This reads like a VA decision letter or adjudication text. You selected a clinician author, so the app may label adjudication language as clinician-authored. Set this document's author to “Non-clinician” if it is not a medical opinion.`,
        );
      }
      const analysis = analyzeEvidenceSegments(
        withUserLocatorPrefix(extracted.segments, locatorPrefix),
        { sourceName: extracted.sourceName, credential: row.credential },
        conditionTerms,
      );
      commitAnalysis(analysis);
      return { processed: 1, warnings: nextWarnings, skipped: false, hint };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown extraction error";
      nextWarnings.push(`${row.sourceName} could not be analyzed locally: ${detail}`);
      return { processed: 0, warnings: nextWarnings, skipped: false };
    }
  }

  async function runAllAnalysis() {
    if (busyRef.current || busy) return;
    const targets = pending.filter((row) => !row.analyzed);
    if (targets.length === 0) {
      setMessage("All selected documents have already been analyzed. Adjust a document's author to re-analyze it.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setWarnings([]);
    setMessage(null);

    const nextWarnings: string[] = [];
    let remainingBatchBytes = limits.batchBytes;
    let processed = 0;
    try {
      for (const row of targets) {
        const result = await analyzeOneFile(row, remainingBatchBytes);
        nextWarnings.push(...result.warnings);
        processed += result.processed;
        remainingBatchBytes -= result.skipped ? 0 : Math.min(row.file.size, limits.batchBytes);
        if (!result.skipped) setRowOutcome(row.id, result.hint);
      }

      setWarnings(nextWarnings);
      setMessage(
        processed > 0
          ? `Analyzed ${processed} document${processed === 1 ? "" : "s"} locally in this browser tab.`
          : "No document produced extractable text or passed the active limits.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function reprocessFile(id: number, nextCredential: ClinicianCredential) {
    if (busyRef.current || busy) return;
    const row = pending.find((item) => item.id === id);
    if (!row?.analyzed) return;

    busyRef.current = true;
    setBusy(true);
    setWarnings([]);
    setMessage(null);

    try {
      const updated = { ...row, credential: nextCredential };
      setPending((current) =>
        current.map((item) => (item.id === id ? updated : item)),
      );
      const result = await analyzeOneFile(updated, Number.MAX_SAFE_INTEGER);
      setWarnings(result.warnings);
      setRowOutcome(id, result.hint);
      setMessage(
        result.processed > 0
          ? `Re-analyzed ${updated.sourceName} locally with the selected author.`
          : `${updated.sourceName} produced no new analysis under the selected author.`,
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function runLocalOcr(id: number) {
    if (busyRef.current || busy) return;
    const row = pending.find((item) => item.id === id);
    if (!row || !isPdfFile(row.file)) {
      if (row) setMessage("Local OCR supports PDF documents only.");
      return;
    }

    // Reject before loading a worker or allocating the document buffer.
    if (row.file.size > limits.fileBytes || pending.reduce((total, item) => total + item.file.size, 0) > limits.batchBytes) {
      setMessage("This document or selection exceeds the active local-analysis size limit. Remove oversized files before OCR.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    setWarnings([]);
    setOcrProgress("Preparing the browser-local OCR worker…");
    const nextWarnings: string[] = [];
    let recognizedChars = 0;
    let ocrPages = 0;

    try {
      // pdf.js first: if its chunk fails to load there is no OCR worker to
      // tear down yet (a parallel worker spawn would leak on that rejection).
      // Legacy main build: the modern build calls very recent typed-array/Map
      // helpers (Chrome 140+) that crash PDF loading on older browsers — see
      // scripts/copy-pdf-worker.mjs. The worker is the matching legacy build.
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }
      const worker = await createLocalOcrWorker();
      try {
        const bytes = new Uint8Array(await row.file.arrayBuffer());
        const loadingTask = pdfjs.getDocument({ data: bytes });
        const pdfDocument = await loadingTask.promise;
        try {
          // #7: validate untrusted page count before using it as a loop bound
          const totalPages = pdfDocument.numPages;
          if (!Number.isInteger(totalPages) || totalPages <= 0) {
            throw new Error("Invalid PDF page count");
          }
          const readLimit = Math.min(totalPages, limits.pdfPages);
          const segments: EvidenceTextSegment[] = [];
          const sourceFingerprint = sourceFingerprintForFile(row.file);
          const storage = getSessionStorage();
          const loadedCheckpoint = loadOcrCheckpoint(storage, sourceFingerprint);
          const savedCheckpoint = loadedCheckpoint && loadedCheckpoint.lastCompletedPage <= readLimit && loadedCheckpoint.recognizedChars <= limits.textChars
            ? loadedCheckpoint : null;
          if (loadedCheckpoint && !savedCheckpoint) clearOcrCheckpoint(storage);
          if (totalPages > readLimit) {
            nextWarnings.push(`${row.sourceName}: partial OCR only — this PDF has ${totalPages} pages; only the first ${readLimit} pages will be reviewed.`);
          }
          if (savedCheckpoint && savedCheckpoint.lastCompletedPage > 0 && savedCheckpoint.segments.length > 0) {
            for (const checkpointSegment of savedCheckpoint.segments) {
              segments.push({
                text: checkpointSegment.text,
                locatorPrefix: `page ${checkpointSegment.page} (OCR)`,
              });
            }
            recognizedChars = savedCheckpoint.recognizedChars;
            ocrPages = savedCheckpoint.segments.length;
            setOcrProgress(`Resuming OCR of ${row.sourceName} after page ${savedCheckpoint.lastCompletedPage}…`);
          } else if (savedCheckpoint) {
            clearOcrCheckpoint(storage);
          }
          const resumeFromPage = savedCheckpoint?.lastCompletedPage ?? 0;
          let checkpointEnabled = true;
          let abortedForDeadWorker = false;
          let downscaledWarned = false;
          for (let pageNumber = resumeFromPage + 1; pageNumber <= readLimit; pageNumber += 1) {
            setOcrProgress(`OCR page ${pageNumber} of ${readLimit} in ${row.sourceName}…`);
            let page: Awaited<ReturnType<typeof pdfDocument.getPage>> | null = null;
            try {
              page = await pdfDocument.getPage(pageNumber);
              const unitViewport = page.getViewport({ scale: 1 });
              const renderMetrics = computeOcrRenderMetrics(unitViewport.width, unitViewport.height);
              if (renderMetrics.downscaled && !downscaledWarned) {
                downscaledWarned = true;
                nextWarnings.push(`${row.sourceName}: page ${pageNumber} is large; rendered at reduced scale to stay under the browser canvas memory cap — recognition may be less accurate on oversized pages.`);
              }
              const viewport = page.getViewport({ scale: renderMetrics.scale });
              const canvas = document.createElement("canvas");
              canvas.width = renderMetrics.canvasWidth;
              canvas.height = renderMetrics.canvasHeight;
              const context = canvas.getContext("2d");
              if (context) {
                context.fillStyle = "#ffffff";
                context.fillRect(0, 0, canvas.width, canvas.height);
              } else {
                nextWarnings.push(`${row.sourceName}: page ${pageNumber} canvas context unavailable — rendering may be incomplete.`);
              }
              try {
                await page.render({ canvas, viewport }).promise;
              } catch (renderError) {
                const detail = renderError instanceof Error ? renderError.message : String(renderError);
                releaseCanvas(canvas);
                nextWarnings.push(`${row.sourceName}: page ${pageNumber} render failed (${detail}) — skipped.`);
                continue;
              }
              let text = "";
              try {
                const result = await worker.recognize(canvas);
                text = (result?.data?.text ?? "").trim();
              } catch (recognizeError) {
                const detail = recognizeError instanceof Error ? recognizeError.message : String(recognizeError);
                releaseCanvas(canvas);
                // Probe worker health: a dead WASM worker (typical OOM) must
                // stop the loop — retrying every remaining page only burns
                // minutes and accumulates garbage — while a page-specific
                // failure just skips the page.
                const probeCanvas = document.createElement("canvas");
                probeCanvas.width = 1;
                probeCanvas.height = 1;
                const workerAlive = await probeWorkerHealth({
                  recognize: (input: unknown) => worker.recognize(input as HTMLCanvasElement),
                  createProbeInput: () => probeCanvas,
                });
                releaseCanvas(probeCanvas);
                if (!workerAlive) {
                  abortedForDeadWorker = true;
                  nextWarnings.push(`${row.sourceName}: page ${pageNumber} OCR failed and the browser-local OCR worker is no longer responding (${detail}); the tab most likely hit its memory limit. Pages through ${pageNumber - 1} are kept and the job can be resumed.`);
                  break;
                }
                nextWarnings.push(`${row.sourceName}: page ${pageNumber} OCR recognition failed (${detail}) — skipped.`);
                continue;
              }
              releaseCanvas(canvas);
              if (!text) continue;
              if (recognizedChars + text.length > limits.textChars) {
                nextWarnings.push(
                  `${row.sourceName}: partial OCR — text exceeded ${formatLimitChars(limits.textChars)} characters; page ${pageNumber} and later pages were not retained.`,
                );
                break;
              }
              recognizedChars += text.length;
              segments.push({ text, locatorPrefix: `page ${pageNumber} (OCR)` });
              ocrPages += 1;
            } catch (pageError) {
              // getPage / getViewport or other unexpected per-page failure
              if (page === null) {
                const detail = pageError instanceof Error ? pageError.message : String(pageError);
                nextWarnings.push(`${row.sourceName}: page ${pageNumber} could not be loaded (${detail}) — skipped.`);
              } else {
                // already handled render/recognize above; re-throw if truly unexpected
                throw pageError;
              }
            } finally {
              // #2: guarantee cleanup even when render/recognize/viewport throws
              if (page) {
                try {
                  page.cleanup();
                } catch {
                  // best-effort
                }
              }
            }
            // Chunk boundary: yield to the browser and persist the resume
            // checkpoint so an interrupted/crashed job resumes where it
            // stopped instead of re-recognizing from page 1.
            if (pageNumber % OCR_PAGES_PER_CHUNK === 0) {
              await yieldToBrowser();
              if (checkpointEnabled) {
                const persisted = saveOcrCheckpoint(storage, {
                  version: 1,
                  sourceFingerprint,
                  lastCompletedPage: pageNumber,
                  segments: segments.map((segment) => ({
                    page: Number.parseInt(segment.locatorPrefix.replace(/^page (\d+).*$/, "$1"), 10) || 0,
                    text: segment.text,
                  })),
                  recognizedChars,
                  updatedAt: Date.now(),
                });
                if (!persisted) {
                  checkpointEnabled = false;
                  nextWarnings.push(`${row.sourceName}: OCR resume checkpoint unavailable (storage limit); continuing in memory. An interruption restarts the job from page 1.`);
                }
              }
            }
          }
          if (abortedForDeadWorker) {
            // Keep the checkpoint so the next Local OCR run resumes where the
            // dead worker stopped.
          } else {
            clearOcrCheckpoint(storage);
          }
          if (segments.length === 0) {
            nextWarnings.push(`${row.sourceName}: OCR produced no readable text.`);
          } else {
            const analysis = analyzeEvidenceSegments(
              withUserLocatorPrefix(segments, locatorPrefix),
              { sourceName: row.sourceName, credential: row.credential },
              conditionTerms,
            );
            commitAnalysis(analysis);
            setRowOutcome(row.id);
            setMessage(
              abortedForDeadWorker
                ? `Local OCR paused for ${row.sourceName} after ${ocrPages} page(s): the OCR worker stopped responding. Run Local OCR again on this document to resume from where it stopped.`
                : `Local OCR completed for ${row.sourceName}: ${ocrPages} page(s) recognized in this browser tab.`,
            );
          }
        } finally {
          await loadingTask.destroy();
        }
      } finally {
        await worker.terminate();
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown OCR error";
      nextWarnings.push(`${row.sourceName}: browser-local OCR failed (${detail}).`);
      setMessage(`${row.sourceName} could not be OCR'd locally.`);
    } finally {
      setWarnings(nextWarnings);
      busyRef.current = false;
      setBusy(false);
      setOcrProgress(null);
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
    if (text.length > limits.textChars) {
      setMessage(`Pasted text is limited to ${formatLimitChars(limits.textChars)} characters per source.`);
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
    if (busyRef.current || busy) return;
    const storage = getSessionStorage();
    const excerptsCleared = clearStoredEvidence(storage);
    const checkpointCleared = clearOcrCheckpoint(storage);
    setAnalyses([]);
    setPending([]);
    setPastedText("");
    setPastedSourceName("Pasted medical record text");
    setLocatorPrefix("");
    setCredential("unknown");
    setWarnings([]);
    setMessage(
      excerptsCleared && checkpointCleared
        ? "Local evidence excerpts, OCR checkpoints, selected files, and pasted text were cleared from this browser tab."
        : "Local evidence was cleared from this view. Browser storage removal could not be confirmed.",
    );
  }

  const selectedForAnalysis = pending.filter((row) => !row.analyzed).length;

  return (
    <section className="space-y-5" aria-labelledby="local-evidence-heading">
      <div>
        <h2 id="local-evidence-heading" className="text-xl font-bold">Local Evidence Review</h2>
        <p className="mt-1 text-sm text-slate-600">
          PDF, DOCX, and supported text records are read in this browser tab. Raw document bytes and raw document text are not submitted to the application server, stored in browser-local workflow records, or written to application logs. If browser session storage is unavailable or full, the current analysis continues in memory but may not restore after navigation or reload.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          OCR may save a full-text resume checkpoint in this tab’s session storage for up to 15 minutes. It is removed on successful completion, Clear local evidence, source removal, Finish, or Restart. Browser session restoration can preserve storage; tab closure is not a secure-erasure guarantee.
        </p>
      </div>

      <div className="ui-callout text-sm">
        <strong>Conservative evidence rule:</strong> the app labels an excerpt “nexus-relevant” only when the source is identified as clinician-authored, the excerpt contains causation/aggravation language, and it mentions at least one condition selected in this workflow. This does not decide whether VA will consider the evidence competent or persuasive.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium">
          Default author for new documents
          <select className="mt-1 w-full px-3" value={credential} onChange={(event) => setCredential(event.target.value as ClinicianCredential)}>
            {CREDENTIAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Additional locator context (optional)
          <input className="mt-1 w-full px-3" value={locatorPrefix} onChange={(event) => setLocatorPrefix(event.target.value)} placeholder="Example: C-file export or Assessment section" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center rounded-xl border border-slate-200 p-4">
        <div>
          <h3 className="font-semibold">Analysis depth</h3>
          <p className="mt-1 text-sm text-slate-600">Standard is the default bound. Extended raises file, batch, and retention limits for large local document sets; every file is still analyzed only in this browser tab and is never uploaded.</p>
        </div>
        <label className="block text-sm font-medium">
          Active depth
          <select
            className="mt-1 w-full px-3"
            value={depth}
            onChange={(event) => {
              const next = event.target.value as EvidenceAnalysisDepth;
              setDepth(next);
              persistDepth(next);
            }}
          >
            <option value="standard">Standard</option>
            <option value="extended">Extended</option>
          </select>
        </label>
      </div>
      <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
        Active limits ({depth === "standard" ? "Standard" : "Extended"}): {formatLimitBytes(limits.fileBytes)} per file, {limits.batchSources} selected files and {formatLimitBytes(limits.batchBytes)} per batch, {limits.pdfPages} PDF pages per source, and {formatLimitChars(limits.textChars)} extracted or pasted characters per source. Up to {limits.storedSources} analyzed sources are retained for the Step 6 checklist. Files stay in the browser.
      </p>

      <div className="rounded-xl border border-slate-200 p-4">
        <label htmlFor="local-evidence-files" className="block font-semibold">Select evidence files</label>
        <span className="mt-1 block text-sm text-slate-600">Supported directly: PDF, DOCX, TXT, Markdown, CSV, JSON and other text files. Limits: {formatLimitBytes(limits.fileBytes)} per file, {limits.batchSources} selected files and {formatLimitBytes(limits.batchBytes)} per batch, {limits.pdfPages} PDF pages per source, and {formatLimitChars(limits.textChars)} extracted characters per source. Files stay in the browser.</span>
        <input
          id="local-evidence-files"
          type="file"
          multiple
          accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*,.pdf,.docx,.txt,.md,.csv,.json,.log"
          className="mt-4 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:font-semibold file:text-white"
          onChange={(event) => {
            stageFiles(event.target.files);
            event.target.value = "";
          }}
          disabled={busy}
        />
        {busy && <span role="status" className="mt-3 block text-sm font-medium text-blue-800">Reading selected documents locally…</span>}

        {pending.length > 0 && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="font-semibold">Selected documents ({pending.length})</h4>
              <button type="button" className="ui-button-secondary" onClick={clearPending} disabled={busy}>Clear selection</button>
            </div>
            <p className="mt-1 text-sm text-slate-600">Set each document&apos;s author before analyzing. Changing the author of an already-analyzed document re-runs that document&apos;s local classification.</p>
            <ul className="mt-3 space-y-2">
              {pending.map((row) => (
                <li key={row.id} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={row.sourceName}>{row.sourceName}</p>
                    <p className="text-xs text-slate-500">
                      {(row.file.size / (1024 * 1024)).toFixed(1)} MB{row.analyzed ? " · analyzed" : " · not yet analyzed"}
                    </p>
                    {row.hint === "va-decision-letter" && (
                      <p className="mt-1 text-xs font-medium text-amber-700">Looks like a VA decision letter or adjudication text — set Author to “Non-clinician” unless a clinician wrote the medical opinion.</p>
                    )}
                    {row.hint === "clinical-note" && (
                      <p className="mt-1 text-xs text-slate-500">Looks like a clinical note.</p>
                    )}
                  </div>
                  <label className="block text-xs font-medium text-slate-600">
                    Author
                    <select
                      className="mt-0.5 w-full px-2 py-1 text-sm sm:w-56"
                      value={row.credential}
                      disabled={busy}
                      onChange={(event) => {
                        const next = event.target.value as ClinicianCredential;
                        if (row.analyzed) {
                          void reprocessFile(row.id, next);
                        } else {
                          setPending((current) =>
                            current.map((item) =>
                              item.id === row.id ? { ...item, credential: next } : item,
                            ),
                          );
                        }
                      }}
                    >
                      {CREDENTIAL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  {isPdfFile(row.file) && (
                    <button
                      type="button"
                      className="text-sm font-medium text-blue-700 hover:underline disabled:opacity-50"
                      onClick={() => void runLocalOcr(row.id)}
                      disabled={busy}
                    >
                      Local OCR
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-sm font-medium text-red-700 hover:underline disabled:opacity-50"
                    onClick={() => removePending(row.id)}
                    disabled={busy}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" className="ui-button" onClick={() => void runAllAnalysis()} disabled={busy || selectedForAnalysis === 0}>
                {busy ? "Analyzing…" : `Analyze ${selectedForAnalysis} document${selectedForAnalysis === 1 ? "" : "s"}`}
              </button>
              {ocrProgress && <p className="text-sm font-medium text-blue-800">{ocrProgress}</p>}
              {pending.length > 0 && pending.every((row) => row.analyzed) && (
                <span className="text-xs text-slate-600">All selected documents analyzed. Change an author to re-classify that document, or run Local OCR on a scanned PDF.</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold">OCR and manual text fallback</h3>
        <p className="mt-1 text-sm text-slate-600">Image-only/scanned PDF pages may contain no selectable text — the extraction pass reports those pages instead of guessing. Use the <strong>Local OCR</strong> action on that document above (recognized entirely in this browser tab), or paste exact text here with any available page/section context.</p>
        <label className="mt-4 block text-sm font-medium">
          Source name
          <input className="mt-1 w-full px-3" value={pastedSourceName} onChange={(event) => setPastedSourceName(event.target.value)} />
        </label>
        <label className="mt-3 block text-sm font-medium">
          Paste exact extracted text (up to {formatLimitChars(limits.textChars)} characters)
          <textarea className="mt-1 min-h-40 w-full px-3 py-2" maxLength={limits.textChars} value={pastedText} onChange={(event) => setPastedText(event.target.value)} placeholder="Paste text exactly as it appears in the source record." />
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
          {warnings.length > 40 && <p className="mt-2 text-xs text-amber-900">Showing the first 40 of {warnings.length} notices (for example, image-only pages).</p>}
          <ul className="mt-2 list-disc space-y-1 pl-5">{warnings.slice(0, 40).map((warning) => <li key={warning}>{warning}</li>)}</ul>
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
          <button type="button" className="ui-button-secondary" onClick={clearEvidence} disabled={busy}>Clear local evidence</button>
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
                  {analysis.excerpts.slice(0, limits.storedExcerptsPerSource).map((excerpt, index) => (
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
