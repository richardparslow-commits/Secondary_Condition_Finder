"use client";

import { useRef, useState } from "react";

import { parseDd214Text } from "@/lib/evidence/dd214-extract";
import { EVIDENCE_DEPTH_LIMITS } from "@/lib/evidence/limits";
import { createLocalOcrWorker } from "@/lib/evidence/ocr-session";
import { dd214ToServiceHistoryFields } from "@/lib/presumptive/dd214-adapter";

type Props = {
  locations: string[];
};

export function Dd214LocalAnalyzer({ locations }: Props) {
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

  async function handleFile(file: File | null) {
    if (!file || busyRef.current || busy) return;
    busyRef.current = true;
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
      if (isPdf) {
        // Legacy main build + legacy worker: see scripts/copy-pdf-worker.mjs
        // for why the modern build is unusable on older browsers.
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const bytes = new Uint8Array(await file.arrayBuffer());
        const task = pdfjs.getDocument({ data: bytes });
        const doc = await task.promise;
        try {
          const total = doc.numPages;
          const limit = Math.min(total, limits.pdfPages);
          const segments: string[] = [];
          // If PDF has a text layer, use it; otherwise fall back to OCR per page.
          let usedTextLayer = false;
          for (let p = 1; p <= limit; p += 1) {
            const page = await doc.getPage(p);
            try {
              const content = await page.getTextContent();
              const t = (content.items as unknown as { str?: string }[]).map((i) => i.str ?? "").join(" ").trim();
              if (t) {
                usedTextLayer = true;
                segments.push(t);
              }
            } finally {
              try { page.cleanup(); } catch {}
            }
          }
          rawText = segments.join("\n");
          if (!usedTextLayer || !rawText.trim()) {
            // OCR path — same Tesseract contract as LocalEvidenceAnalyzer
            setProgress("Running browser-local OCR…");
            const worker = await createLocalOcrWorker();
            try {
              const ocrSegments: string[] = [];
              for (let p = 1; p <= limit; p += 1) {
                setProgress(`OCR page ${p} of ${limit}…`);
                const page = await doc.getPage(p);
                let canvas: HTMLCanvasElement | null = null;
                try {
                  const viewport = page.getViewport({ scale: 2 });
                  canvas = document.createElement("canvas");
                  canvas.width = viewport.width;
                  canvas.height = viewport.height;
                  const ctx = canvas.getContext("2d");
                  if (!ctx) throw new Error("Canvas 2D context unavailable for PDF rendering.");
                  ctx.fillStyle = "#fff";
                  ctx.fillRect(0, 0, viewport.width, viewport.height);
                  await page.render({ canvas, viewport }).promise;
                  const result = await worker.recognize(canvas);
                  const text = (result?.data?.text ?? "").trim();
                  if (text) ocrSegments.push(text);
                } finally {
                  try { page.cleanup(); } catch {}
                }
              }
              rawText = ocrSegments.join("\n");
            } finally {
              await worker.terminate();
            }
          }
        } finally {
          await task.destroy();
        }
      } else {
        // Image file: direct OCR
        const worker = await createLocalOcrWorker();
        try {
          setProgress("Running browser-local OCR…");
          const result = await worker.recognize(file);
          rawText = (result?.data?.text ?? "").trim();
        } finally {
          await worker.terminate();
        }
      }

      if (!rawText.trim()) {
        setMessage("No readable text was extracted. Try a clearer scan or enter service history manually.");
        return;
      }
      const ex = parseDd214Text(rawText, limits);
      setExtraction(ex);
      setEditedLocations(ex.fields.locations ?? []);
      setEditedStart(ex.fields.serviceStart ?? "");
      setEditedEnd(ex.fields.serviceEnd ?? "");
      setEditedBranches(ex.fields.serviceBranchCodes ?? []);
      setConfirmed(false);
      setMessage("DD-214 text extracted locally. Verify dates and locations for accuracy before continuing. SSN is masked and never sent to a server.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not extract DD-214 locally.");
    } finally {
      busyRef.current = false;
      setBusy(false);
      setProgress(null);
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

  const adapterPreview = extraction
    ? dd214ToServiceHistoryFields(extraction, { locationsOverride: editedLocations })
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
          <p className="text-xs text-slate-600">Review and correct the extracted fields. Nothing is saved until you confirm below.</p>

          {extraction.fields.maskedSsn && (
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <p className="text-xs font-medium text-slate-700">SSN (masked)</p>
              <p className="mt-1 font-mono text-sm">
                {showSsn ? extraction.fields.maskedSsn : "XXX-XX-••••"}
                <button type="button" onClick={() => setShowSsn((v) => !v)} className="ml-3 text-xs underline">
                  {showSsn ? "Hide" : "Show"}
                </button>
              </p>
              <p className="mt-1 text-xs text-slate-500">Full SSN is never stored. This preview is in-memory only.</p>
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
            <p className="text-xs text-slate-500">Edit as needed. Locations are matched exactly against the presumptive catalog.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {locations.map((loc) => (
                <label key={loc} className="flex items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={editedLocations.includes(loc)}
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
            {editedLocations.length > 0 && (
              <p className="mt-2 text-xs text-slate-600">Selected: {editedLocations.join(", ")}</p>
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
            onSubmit={(e) => {
              e.preventDefault();
              if (!confirmed) return;
              // Submit to the existing presumptive Server Action via hidden form — we synthesize submission
              // by creating a FormData compatible post. Simplest: use a real form post to the action endpoint
              // by programmatically submitting a hidden form to saveServiceHistory.
              const form = document.createElement("form");
              form.method = "POST";
              form.action = "";
              // We cannot directly invoke the Server Action from here without a round-trip; instead we rely on
              // the outer page's ServiceHistoryForm by populating a hidden form that posts to the same action
              // via fetch with FormData. Use fetch to the current page's action handler.
              const fd = new FormData();
              editedLocations.forEach((loc) => fd.append("location", loc));
              editedBranches.forEach((c) => fd.append("serviceBranchCode", c));
              if (editedStart) fd.set("serviceStart", editedStart);
              if (editedEnd) fd.set("serviceEnd", editedEnd);
              // Use the server action via a hidden submit to /presumptive (Next Server Action boundary)
              // Workaround: submit via the existing form action by dispatching to the server action import.
              // We import dynamically to avoid \"use client\" boundary violation for server actions.
              import("@/lib/actions/presumptive").then(({ saveServiceHistory }) => {
                // Server Actions from client components are invoked as functions that POST automatically in Next.js.
                void saveServiceHistory(fd);
              });
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

          <details className="text-xs text-slate-600">
            <summary className="cursor-pointer">Show redacted extracted text</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-white p-3 text-xs">{extraction.rawText.slice(0, 4000)}</pre>
          </details>
        </div>
      )}
    </section>
  );
}
