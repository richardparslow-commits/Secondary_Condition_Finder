"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { parseDd214Text } from "@/lib/evidence/dd214-extract";
import { EVIDENCE_DEPTH_LIMITS } from "@/lib/evidence/limits";
import {
  assemblePageOrderedText,
  computeOcrRenderMetrics,
  createLocalOcrWorker,
  OCR_JOB_DEADLINE_MS,
  planImageDecode,
  probeWorkerHealth,
  releaseCanvas,
  startOcrJobDeadline,
  yieldToBrowser,
  type ImageDecodeRejection,
} from "@/lib/evidence/ocr-session";
import {
  normalizeServiceHistoryDraft,
  persistServiceHistory,
  SERVICE_HISTORY_MESSAGES,
  type ServiceHistoryFailureCode,
} from "@/lib/presumptive/browser-history";
import { dd214ToServiceHistoryFields } from "@/lib/presumptive/dd214-adapter";

type Props = {
  locations: string[];
};

/**
 * Copy for a refused image upload (A06 decode bounds). The refusal names the
 * measured size so the Veteran can pick a smaller copy, and restates that the
 * file never left the tab.
 */
function imageRefusalMessage(
  reason: ImageDecodeRejection | "ok",
  dimensions: { width: number; height: number } | null,
): string {
  const size = dimensions ? `${dimensions.width}×${dimensions.height}` : "unknown dimensions";
  if (reason === "too-many-pixels" || reason === "dimension-too-large") {
    return `This image is too large to analyze safely in this browser (${size}). Try a smaller or lower-resolution copy — the file never leaves this tab.`;
  }
  return "This image could not be read in this browser. Try a PNG or JPEG copy — the file never leaves this tab.";
}

export function Dd214LocalAnalyzer({ locations }: Props) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<ServiceHistoryFailureCode | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [extraction, setExtraction] = useState<ReturnType<typeof parseDd214Text> | null>(null);
  const [editedLocations, setEditedLocations] = useState<string[]>([]);
  const [editedStart, setEditedStart] = useState<string>("");
  const [editedEnd, setEditedEnd] = useState<string>("");
  const [editedBranches, setEditedBranches] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showSsn, setShowSsn] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  // A06: extraction generation fence (same contract as LocalEvidenceAnalyzer's
  // A07 fence). Finish/restart navigates away and clears the workflow stores;
  // a detached run must abandon itself at the next page boundary before any
  // state write instead of committing stale fields after cleanup. Teardown
  // still runs through the existing finally chain.
  const extractionGenerationRef = useRef(0);
  const cancelRequestedRef = useRef(false);
  // A06: prompt-teardown handles. Flags alone only take effect at the next page
  // boundary, so an in-flight render or `recognize()` that never settles would
  // keep the worker alive and the tab busy forever. These refs let cancel and
  // the elapsed-work deadline terminate the live worker/task immediately, which
  // rejects the awaited promise so the run unwinds through its own finally.
  const workerRef = useRef<Awaited<ReturnType<typeof createLocalOcrWorker>> | null>(null);
  // REL-05: the construction window is its own teardown path. Until the worker
  // factory returns, `workerRef` is empty, so a worker that stalls during its
  // initialize handshake would survive cancel and the deadline; aborting this
  // controller terminates it from inside the factory instead.
  const creationAbortRef = useRef<AbortController | null>(null);
  const pdfTaskRef = useRef<{ destroy: () => Promise<void> } | null>(null);
  const deadlineRef = useRef<{ exceeded(): boolean; clear(): void } | null>(null);

  useEffect(() => () => {
    extractionGenerationRef.current += 1;
    // Unmount must tear the live job down too, not just invalidate it: the
    // completion controls navigate away, and a detached run must not keep a
    // worker (or a pdf.js document) alive behind the new page.
    cancelRequestedRef.current = true;
    creationAbortRef.current?.abort();
    creationAbortRef.current = null;
    const worker = workerRef.current;
    workerRef.current = null;
    if (worker) void worker.terminate().catch(() => {});
    const task = pdfTaskRef.current;
    pdfTaskRef.current = null;
    if (task) void task.destroy().catch(() => {});
    deadlineRef.current?.clear();
    deadlineRef.current = null;
  }, []);

  /**
   * Stops whatever is running right now. Used by the Cancel button, the
   * elapsed-work deadline, and unmount — one teardown path, so "cancelled"
   * cannot mean three slightly different things.
   */
  function terminateActiveRun() {
    creationAbortRef.current?.abort();
    creationAbortRef.current = null;
    const worker = workerRef.current;
    workerRef.current = null;
    if (worker) void worker.terminate().catch(() => {});
    const task = pdfTaskRef.current;
    pdfTaskRef.current = null;
    if (task) void task.destroy().catch(() => {});
  }

  function requestCancel() {
    cancelRequestedRef.current = true;
    extractionGenerationRef.current += 1;
    terminateActiveRun();
    deadlineRef.current?.clear();
    deadlineRef.current = null;
    busyRef.current = false;
    setBusy(false);
    setProgress(null);
    setMessage("Extraction cancelled. No fields were saved — upload again to retry.");
  }

  async function handleFile(file: File | null) {
    if (!file || busyRef.current || busy) return;
    busyRef.current = true;
    cancelRequestedRef.current = false;
    const generation = (extractionGenerationRef.current += 1);
    const isCurrentGeneration = () => generation === extractionGenerationRef.current;
    const abandoned = () => cancelRequestedRef.current || !isCurrentGeneration();
    let deadlineExpired = false;
    // A06: elapsed-work budget. The per-page checks stop at the next boundary;
    // this timer also reaches a page whose render or `recognize()` never
    // settles, by terminating the live worker/task so the awaited promise
    // rejects and the run unwinds through its normal finally chain.
    const deadline = startOcrJobDeadline(OCR_JOB_DEADLINE_MS, () => {
      deadlineExpired = true;
      cancelRequestedRef.current = true;
      terminateActiveRun();
    });
    deadlineRef.current = deadline;
    // One owner for worker teardown. Cancel, the elapsed-work deadline, and
    // unmount all go through `terminateActiveRun()`, which already terminated
    // the live worker and cleared the ref; the run's own finally must then not
    // terminate it a second time, because a second terminate can reject inside
    // a finally and mask the outcome it was cleaning up after.
    const finishWorker = async (
      worker: Awaited<ReturnType<typeof createLocalOcrWorker>>,
    ): Promise<void> => {
      if (workerRef.current !== worker) return;
      workerRef.current = null;
      await worker.terminate();
    };
    setBusy(true);
    setMessage(null);
    setProgress("Preparing browser-local extraction…");
    try {
      const limits = EVIDENCE_DEPTH_LIMITS.standard;
      if (file.size > limits.fileBytes) {
        setMessage(`File exceeds the ${limits.fileBytes / (1024 * 1024)} MB local-analysis limit.`);
        return;
      }
      const lower = file.name.toLowerCase();
      const isPdf = file.type === "application/pdf" || lower.endsWith(".pdf");
      const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|tiff|bmp|webp)$/i.test(lower);
      if (!isPdf && !isImage) {
        setMessage("DD-214 upload supports PDF or image files only.");
        return;
      }

      let rawText = "";
      // Page-level notices (page cap, skips, downscales) merge into the
      // extraction warnings below so partial results are never silent.
      const pageWarnings: string[] = [];
      const reviewBudgetWarning = `Only the first ${limits.textChars.toLocaleString("en-US")} characters will be reviewed.`;
      // A06: one slot per reviewed page. The text-layer pass and the OCR pass
      // both write here, so the assembled text follows page order rather than
      // pass order — previously every OCR'd page was appended after every
      // text-layer page, silently re-ordering the document.
      const pageTexts: Array<string | null> = [];
      const setPageText = (page: number, text: string): void => {
        pageTexts[page - 1] = text;
      };
      const knownChars = (): number =>
        pageTexts.reduce((total, text) => total + (text?.length ?? 0), 0);
      const warnReviewBudget = (): void => {
        if (!pageWarnings.includes(reviewBudgetWarning)) pageWarnings.push(reviewBudgetWarning);
      };
      // One spawn path for both surfaces, so every live worker is reachable by
      // `terminateActiveRun()` for cancel, deadline, and unmount.
      const spawnWorker = async () => {
        if (deadlineExpired || abandoned()) return null;
        const controller = new AbortController();
        creationAbortRef.current = controller;
        try {
          const created = await createLocalOcrWorker({ signal: controller.signal });
          workerRef.current = created;
          return created;
        } finally {
          if (creationAbortRef.current === controller) creationAbortRef.current = null;
        }
      };
      if (isPdf) {
        // Legacy main build + legacy worker: see scripts/copy-pdf-worker.mjs
        // for why the modern build is unusable on older browsers.
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const bytes = new Uint8Array(await file.arrayBuffer());
        const task = pdfjs.getDocument({ data: bytes });
        pdfTaskRef.current = task;
        try {
          // REL-05: the load await belongs inside the teardown try. pdf.js
          // allocates its worker when the task is created, so a load that
          // rejects (a malformed or crafted file) is exactly the case that must
          // still reach the `task.destroy()` below. Awaiting it outside skipped
          // that finally, and the next upload replaced `pdfTaskRef.current`
          // with its own task — so the failed one was never destroyed at all.
          const doc = await task.promise;
          const total = doc.numPages;
          const limit = Math.min(total, limits.pdfPages);
          if (total > limit) {
            pageWarnings.push(
              `This PDF has ${total} pages; only the first ${limit} pages will be reviewed.`,
            );
          }
          // Bounded work: the page-order budget is checked before starting more
          // OCR, so a dense text layer cannot make the OCR pass run across
          // pages whose text the review will never keep.
          const budgetReached = (): boolean => knownChars() >= limits.textChars;
          // Per-page OCR with the shared main-surface controls: pixel-capped
          // render, prompt canvas release, worker-health probe, and a browser
          // yield between pages. Runs either the full page set (no text
          // layer) or just the pages without extractable text (mixed PDFs).
          const runOcrPages = async (
            worker: Awaited<ReturnType<typeof createLocalOcrWorker>>,
            pages: number[],
          ): Promise<"done" | "worker-dead" | "cancelled"> => {
            for (const p of pages) {
              if (deadlineExpired || abandoned()) return "cancelled";
              if (budgetReached()) {
                warnReviewBudget();
                return "done";
              }
              setProgress(`OCR page ${p} of ${limit}…`);
              const page = await doc.getPage(p);
              let canvas: HTMLCanvasElement | null = null;
              let pageError: unknown = null;
              try {
                const unitViewport = page.getViewport({ scale: 1 });
                const renderMetrics = computeOcrRenderMetrics(unitViewport.width, unitViewport.height);
                const viewport = page.getViewport({ scale: renderMetrics.scale });
                canvas = document.createElement("canvas");
                canvas.width = renderMetrics.canvasWidth;
                canvas.height = renderMetrics.canvasHeight;
                const ctx = canvas.getContext("2d");
                if (!ctx) throw new Error("Canvas 2D context unavailable for PDF rendering.");
                ctx.fillStyle = "#fff";
                ctx.fillRect(0, 0, renderMetrics.canvasWidth, renderMetrics.canvasHeight);
                await page.render({ canvas, viewport }).promise;
                if (renderMetrics.downscaled) {
                  pageWarnings.push(`Page ${p} was rendered below full resolution to stay within the browser memory budget.`);
                }
                const result = await worker.recognize(canvas);
                const text = (result?.data?.text ?? "").trim();
                if (text) {
                  setPageText(p, text);
                  if (budgetReached()) warnReviewBudget();
                } else {
                  pageWarnings.push(`Page ${p} produced no recognizable text and was skipped.`);
                }
              } catch (ocrError) {
                pageError = ocrError;
              } finally {
                if (canvas) {
                  try { releaseCanvas(canvas); } catch {}
                }
                try { page.cleanup(); } catch {}
              }
              if (pageError !== null) {
                // A dead WASM worker (OOM) fails the probe too — stop
                // instead of retrying every remaining page.
                const workerAlive = await probeWorkerHealth({
                  recognize: (input) => worker.recognize(input as HTMLCanvasElement),
                  createProbeInput: () => {
                    const probe = document.createElement("canvas");
                    probe.width = 1;
                    probe.height = 1;
                    return probe;
                  },
                });
                if (!workerAlive) {
                  pageWarnings.push("Browser-local OCR stopped early: the OCR worker failed, so the remaining pages were skipped.");
                  return "worker-dead";
                }
                pageWarnings.push(`Page ${p} could not be processed and was skipped.`);
              }
              await yieldToBrowser();
            }
            return "done";
          };
          // If PDF has a text layer, use it; otherwise fall back to OCR per page.
          const textlessPages: number[] = [];
          for (let p = 1; p <= limit; p += 1) {
            if (deadlineExpired || abandoned()) return;
            if (budgetReached()) {
              warnReviewBudget();
              break;
            }
            const page = await doc.getPage(p);
            try {
              const content = await page.getTextContent();
              const t = (content.items as unknown as { str?: string }[]).map((i) => i.str ?? "").join(" ").trim();
              if (t) setPageText(p, t);
              else textlessPages.push(p);
            } finally {
              try { page.cleanup(); } catch {}
            }
          }
          // Abandonment during the spawn await is still fenced: runOcrPages
          // returns cancelled at its first boundary and the caller's finally
          // terminates the worker, so nothing leaks on any path.
          const hasTextLayer = pageTexts.some((text) => (text ?? "").trim().length > 0);
          if (!hasTextLayer) {
            // OCR path — same Tesseract contract as LocalEvidenceAnalyzer
            pageTexts.length = 0;
            setProgress("Running browser-local OCR…");
            const worker = await spawnWorker();
            if (worker) {
              try {
                const outcome = await runOcrPages(worker, Array.from({ length: limit }, (_, i) => i + 1));
                if (outcome === "cancelled") return;
              } finally {
                await finishWorker(worker);
              }
            }
          } else if (textlessPages.length > 0) {
            // Per-page decision: text pages stay as-is; only the pages
            // without a text layer pay for OCR.
            pageWarnings.push(
              `${textlessPages.length} of ${limit} pages had no extractable text; those pages were read with browser-local OCR.`,
            );
            setProgress("Running browser-local OCR…");
            const worker = await spawnWorker();
            if (worker) {
              try {
                const outcome = await runOcrPages(worker, textlessPages);
                if (outcome === "cancelled") return;
              } finally {
                await finishWorker(worker);
              }
            }
          }
          // A06: assembled in page order under the review budget, so a
          // truncated review is the document's prefix instead of whichever
          // pass happened to run first.
          const assembled = assemblePageOrderedText(pageTexts, limits.textChars);
          if (assembled.truncated) warnReviewBudget();
          rawText = assembled.text;
          if (abandoned()) return;
        } finally {
          // Same once-only rule for the pdf.js loading task: `terminateActiveRun`
          // already destroyed it on a cancel/deadline/unmount, so skip a second
          // destroy rather than depend on the library's idempotency.
          if (pdfTaskRef.current === task) {
            pdfTaskRef.current = null;
            await task.destroy();
          }
        }
      } else {
        // Image file. A06: bound the decode **before** it happens. The declared
        // dimensions come from the container header, so a decompression bomb is
        // refused without allocating a bitmap; an accepted image then renders
        // through the same pixel-area cap the PDF path uses, so what reaches the
        // OCR worker is bounded by construction rather than by luck.
        setProgress("Preparing browser-local image analysis…");
        const imageBytes = new Uint8Array(await file.arrayBuffer());
        const plan = planImageDecode(imageBytes);
        if (!plan.accepted || !plan.metrics || !plan.dimensions) {
          setMessage(imageRefusalMessage(plan.reason, plan.dimensions));
          return;
        }
        if (plan.metrics.downscaled) {
          pageWarnings.push(
            `This image was downscaled to ${plan.metrics.canvasWidth}×${plan.metrics.canvasHeight} to stay within the browser memory budget.`,
          );
        }
        const worker = await spawnWorker();
        if (!worker) return;
        let canvas: HTMLCanvasElement | null = null;
        let source: ImageBitmap | null = null;
        try {
          if (abandoned()) return;
          setProgress("Running browser-local OCR…");
          canvas = document.createElement("canvas");
          canvas.width = plan.metrics.canvasWidth;
          canvas.height = plan.metrics.canvasHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas 2D context unavailable for image rendering.");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          try {
            // Ask the browser to decode straight to the bounded size where it
            // supports that. The header check above is the guarantee; this is
            // the cheap path.
            source = await createImageBitmap(file, {
              resizeWidth: canvas.width,
              resizeHeight: canvas.height,
              resizeQuality: "low",
            });
          } catch {
            try {
              source = await createImageBitmap(file);
            } catch {
              // A container this browser cannot decode (e.g. TIFF). Its
              // declared dimensions already passed the pixel ceiling, so the
              // original path still runs inside a bound — but say so, because
              // the render cap itself did not apply.
              pageWarnings.push(
                "This image could not be re-rendered at a bounded size in this browser, so OCR ran on the original file within its declared-dimension limit.",
              );
            }
          }
          if (source) ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
          const result = source
            ? await worker.recognize(canvas)
            : await worker.recognize(file);
          if (abandoned()) return;
          rawText = (result?.data?.text ?? "").trim();
        } finally {
          if (canvas) {
            try { releaseCanvas(canvas); } catch {}
          }
          if (source) {
            try { source.close(); } catch {}
          }
          await finishWorker(worker);
        }
      }

      if (abandoned()) return;
      if (!rawText.trim()) {
        const notices = pageWarnings.length > 0 ? ` Notices: ${pageWarnings.slice(0, 2).join(" ")}` : "";
        setMessage(`No readable text was extracted. Try a clearer scan or enter service history manually.${notices}`);
        return;
      }
      const ex = parseDd214Text(rawText, limits);
      // Surface page-level notices alongside the field warnings.
      const merged: typeof ex = {
        ...ex,
        fields: { ...ex.fields, warnings: [...pageWarnings, ...ex.fields.warnings] },
      };
      setExtraction(merged);
      setEditedLocations(merged.fields.locations ?? []);
      setEditedStart(merged.fields.serviceStart ?? "");
      setEditedEnd(merged.fields.serviceEnd ?? "");
      setEditedBranches(merged.fields.serviceBranchCodes ?? []);
      setConfirmed(false);
      setMessage("DD-214 text extracted locally. Verify dates and locations for accuracy before continuing. SSN is masked and never sent to a server.");
    } catch (err) {
      // A stale run must not overwrite the message of the run that replaced
      // it; a cancelled run already reported its own cancellation.
      if (isCurrentGeneration() && !cancelRequestedRef.current) {
        setMessage(err instanceof Error ? err.message : "Could not extract DD-214 locally.");
      }
    } finally {
      deadline.clear();
      if (deadlineRef.current === deadline) deadlineRef.current = null;
      // Reset busy state only when still current — a cancelled or superseded
      // run must not clear the state of the run that replaced it.
      if (isCurrentGeneration() && !cancelRequestedRef.current) {
        busyRef.current = false;
        setBusy(false);
        setProgress(null);
      } else if (deadlineExpired && isCurrentGeneration()) {
        // The budget, not the Veteran, stopped this run. Report it and hand the
        // tab back — leaving the surface stuck busy is the failure mode the
        // deadline exists to prevent.
        cancelRequestedRef.current = false;
        busyRef.current = false;
        setBusy(false);
        setProgress(null);
        setMessage(
          `Browser-local extraction reached the ${OCR_JOB_DEADLINE_MS / 60000}-minute limit and was stopped. Try a smaller file or enter service history manually.`,
        );
      }
    }
  }

  function clearDraft() {
    setExtraction(null);
    setEditedLocations([]);
    setEditedStart("");
    setEditedEnd("");
    setEditedBranches([]);
    setConfirmed(false);
    setMessage("Uploaded DD-214 cleared from this tab.");
    setShowSsn(false);
  }

  /**
   * Extracted duty stations are raw text; only exact catalog entries can be
   * matched or persisted. Unmatched entries stay visible for review and can be
   * removed, but must not make the whole step fail when a catalog location was
   * also extracted (or selected by hand).
   */
  const catalogLocationSet = new Set(locations);
  const catalogLocations = [
    ...new Set(editedLocations.filter((location) => catalogLocationSet.has(location))),
  ];
  const unmatchedLocations = [
    ...new Set(editedLocations.filter((location) => !catalogLocationSet.has(location))),
  ];

  function removeLocation(location: string) {
    setEditedLocations((prev) => prev.filter((value) => value !== location));
  }

  // The preview must validate the same values Confirm will save. Passing the
  // edited dates here makes the check line react as soon as they are out of
  // order instead of checking only the extraction's original dates (Heal
  // s7-dd214-edited-dates-unchecked-1).
  const adapterPreview = extraction
    ? dd214ToServiceHistoryFields(extraction, {
        locationsOverride: catalogLocations,
        serviceStart: editedStart || null,
        serviceEnd: editedEnd || null,
      })
    : null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="dd214-heading">
      <h2 id="dd214-heading" className="text-lg font-semibold">Upload DD-214 (optional)</h2>
      <p id="dd214-file-help" className="mt-1 text-sm text-slate-600">
        PDF or image. Extracted in this browser tab only. Verify dates and locations for accuracy before proceeding. SSN is masked and never sent to a server.
      </p>

      <div className="mt-4">
        <label htmlFor="dd214-file" className="block text-sm font-medium text-slate-700">
          DD-214 file
        </label>
        <input
          id="dd214-file"
          type="file"
          accept="application/pdf,image/*,.pdf,.png,.jpg,.jpeg,.tiff,.bmp,.webp"
          aria-describedby="dd214-file-help"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = "";
            void handleFile(f);
          }}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-white"
        />
        {progress && <p className="mt-2 text-sm text-blue-800">{progress}</p>}
        {busy && (
          <button
            type="button"
            onClick={requestCancel}
            className="mt-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            Cancel extraction
          </button>
        )}
        {message && <p role="status" className="mt-2 text-sm text-slate-700">{message}</p>}
        {extraction?.fields.warnings?.length ? (
          <ul className="mt-2 list-disc pl-5 text-xs text-amber-800">
            {extraction.fields.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {extraction && (
        <div className="mt-5 space-y-4 rounded-lg bg-slate-50 p-4">
          <h3 className="font-semibold">Verify your service history</h3>
          <p className="text-sm text-slate-600">Review and correct the extracted fields. Nothing is saved until you confirm below.</p>

          {extraction.fields.maskedSsn && (
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <p className="text-sm font-medium text-slate-700">SSN (masked)</p>
              <p className="mt-1 font-mono text-sm">
                {showSsn ? extraction.fields.maskedSsn : "XXX-XX-••••"}
                <button type="button" onClick={() => setShowSsn((v) => !v)} className="ml-3 text-sm underline">
                  {showSsn ? "Hide" : "Show"}
                </button>
              </p>
              <p className="mt-1 text-sm text-muted">Full SSN is never stored. This preview is in-memory only.</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Service start
              <input
                type="date"
                value={editedStart}
                onChange={(e) => setEditedStart(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm font-medium">
              Service end
              <input
                type="date"
                value={editedEnd}
                onChange={(e) => setEditedEnd(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div>
            <p className="text-sm font-medium">Locations / duty stations</p>
            <p className="text-xs text-muted">Edit as needed. Only exact matches in the presumptive catalog are used; other extracted duty stations stay listed so you can review or remove them.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {locations.map((loc) => (
                <label key={loc} className="flex items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={catalogLocations.includes(loc)}
                    onChange={(e) => {
                      setEditedLocations((prev) =>
                        e.target.checked ? [...new Set([...prev, loc])] : prev.filter((x) => x !== loc),
                      );
                    }}
                  />
                  {loc}
                </label>
              ))}
            </div>
            {unmatchedLocations.length > 0 && (
              <div role="note" className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-900">
                  Not in the presumptive catalog — these will not be matched:
                </p>
                <ul className="mt-1 space-y-1">
                  {unmatchedLocations.map((loc) => (
                    <li key={loc} className="flex flex-wrap items-center gap-2 text-xs text-amber-900">
                      <span>{loc}</span>
                      <span>(not in the presumptive catalog)</span>
                      <button
                        type="button"
                        aria-label={`Remove ${loc}`}
                        onClick={() => removeLocation(loc)}
                        className="rounded border border-amber-400 bg-white px-2 py-0.5 text-xs"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <label htmlFor="dd214-location-add" className="mt-3 block text-sm font-medium text-slate-700">
              Add a location (free text)
            </label>
            <input
              id="dd214-location-add"
              type="text"
              placeholder="e.g. Fort Liberty, NC"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (v) {
                    setEditedLocations((prev) => [...new Set([...prev, v])]);
                    (e.target as HTMLInputElement).value = "";
                  }
                }
              }}
            />
            {catalogLocations.length > 0 && (
              <p className="mt-2 text-xs text-slate-600">
                Selected catalog locations: {catalogLocations.join(", ")}
              </p>
            )}
            {adapterPreview?.validationCode && (
              <p className="mt-2 text-xs text-red-700">Check: {adapterPreview.validationCode}</p>
            )}
          </div>

          <label className="flex gap-2 text-sm">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>I verified these dates and locations against my DD-214 before continuing.</span>
          </label>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!confirmed) return;
              // Confirmed service history is stored in this browser tab and read
              // back by the results view. The retired Server Action posted these
              // values to the server and sealed them into a cookie; this path
              // makes no request, and the same authored-catalog membership
              // allowlist still runs before the write.
              const result = persistServiceHistory(
                window.sessionStorage,
                normalizeServiceHistoryDraft({
                  serviceBranchCodes: editedBranches,
                  locations: catalogLocations,
                  serviceStart: editedStart,
                  serviceEnd: editedEnd,
                }),
                locations,
              );
              if (!result.ok) {
                setSubmitError(result.code);
                return;
              }
              setSubmitError(null);
              router.push("/presumptive/results");
            }}
            className="flex flex-wrap gap-3"
          >
            <button
              type="submit"
              disabled={!confirmed || busy}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Confirm and continue
            </button>
            <button type="button" onClick={clearDraft} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm">
              Clear uploaded DD-214 from this tab
            </button>
          </form>

          {submitError && (
            <div role="alert" className="ui-callout text-sm">
              <strong>Check the extracted service history:</strong>{" "}
              {SERVICE_HISTORY_MESSAGES[submitError]}
            </div>
          )}

          <details className="text-sm text-slate-600">
            <summary className="cursor-pointer">Show extracted text (common SSN layouts redacted)</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-white p-3 text-sm">{extraction.rawText.slice(0, 4000)}</pre>
            <p className="mt-1 text-sm text-muted">Redaction covers common SSN layouts; unusual OCR spacing may remain — verify before sharing.</p>
          </details>
        </div>
      )}
    </section>
  );
}
