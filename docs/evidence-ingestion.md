# Evidence ingestion and local review

## Purpose

Step 4 can optionally identify exact evidence excerpts that may help a Veteran organize a later discussion with a qualified medical provider or accredited representative. This feature is an evidence-review aid. It does not determine medical causation, legal competency, credibility, probative weight, or VA entitlement.

## Privacy boundary

Raw supporting-document bytes and text stay in the browser. The application server receives neither those bytes/text nor a `documentsShared` workflow field; workflow context is browser-local. Raw medical text and locally extracted quotations are not written to application logs, aggregate recommendation events, URLs, or user accounts.

The browser stores only the extracted excerpt objects needed for Step 6 in `sessionStorage`. That storage is tab-scoped, is removed when the tab is closed, and can be cleared manually from Step 4.

PDF.js and Mammoth are bundled application dependencies. The app does not upload the selected document to Mozilla, Mammoth, a CDN, an OCR service, or another document-analysis service.

## Supported input

Direct local parsing supports:

- PDF files, with page-level provenance (`page N`);
- DOCX files, with deterministic paragraph provenance (`paragraph N`);
- text formats (`text/*`, TXT, Markdown, CSV, JSON, LOG).

Local analysis uses explicit browser-resource ceilings:

- 20 MB maximum per selected file;
- 10 selected files per analysis batch;
- 50 MB maximum accepted file bytes per batch;
- 300 pages maximum per PDF source;
- 500,000 extracted characters maximum per source, including pasted-text input;
- 10 retained source analyses per browser tab.

The file-size check is repeated inside the document-extraction library before file bytes are read, so callers cannot bypass the UI check by invoking the parser directly. PDF page count is checked before page-by-page extraction, and cumulative extracted text is checked while PDF pages are processed. DOCX and text extraction are rejected when their extracted text exceeds the same per-source character ceiling. Sources over a limit are rejected with a local notice rather than silently truncated; users can split or narrow a source and analyze it again.

PDF pages that contain no extractable/selectable text are reported to the user rather than guessed. Two in-app paths then exist for image-only records, both staying in the browser: (1) the per-document **Local OCR** action recognizes scanned PDF pages with a bundled, self-hosted OCR engine and classifies the recognized text under the document's assigned author (recognized segments carry a `page N (OCR)` locator); and (2) the paste-text fallback remains available so text from a trusted external OCR tool can be reviewed with user-supplied locator context.

The Local OCR path runs under explicit memory-safety bounds (`src/lib/evidence/ocr-session.ts`) so large scanned records do not crash the browser tab:

- page renders are capped at 16,777,216 canvas pixels (4096 × 4096); oversized scans are rendered at a reduced scale with a visible accuracy notice rather than crashing mobile renderers;
- recognition runs in 8-page chunks separated by browser yields, so the compositor and garbage collector can run between bursts;
- recognized pages are checkpointed to tab-scoped `sessionStorage` (same privacy envelope as the excerpt store, never transmitted) after each chunk, so an interrupted or memory-killed job resumes at its last completed page on the next Local OCR run instead of re-recognizing from page 1; the checkpoint is cleared on successful completion and is keyed to the selected file's name/size/last-modified so a different document never inherits another's transcript;
- a failed page recognition triggers a worker-health probe: a page-specific failure skips the page, but a dead OCR worker (typically a WASM out-of-memory crash) stops the loop with a resume message instead of retrying every remaining page; and
- the rendered canvas is released immediately after each page instead of waiting for garbage collection.

When `sessionStorage` is unavailable or full, OCR continues in memory with checkpointing disabled and a visible notice; resume then restarts from page 1. These bounds never transmit document bytes or recognized text anywhere — they only shape local computation.

DOCX is a flow-oriented format and does not reliably encode stable rendered page numbers. The application therefore uses paragraph locators instead of inventing DOCX page numbers.

## PDF parser security boundary

The application pins `pdfjs-dist` to 6.3.289, the patched release required by the repository's high-severity dependency gate for the reviewed malicious-PDF advisory. The earlier vulnerable pin was rejected by CI and is not retained. Extraction uses only the PDF.js display-layer text-content API, does not render the PDF viewer or execute document actions, and destroys the `PDFDocumentLoadingTask` after page text extraction. The generated PDF.js worker is copied verbatim from the pinned dependency during installation and is excluded from source-code linting; application-authored parser and worker-copy code remains linted normally.

The browser-local OCR engine (`tesseract.js` and `tesseract.js-core`, plus the `eng` traineddata) is likewise pinned in `package.json`; its worker script and WASM core are copied verbatim from `node_modules` during the same postinstall into `public/tesseract/` and excluded from source-code linting. Only the single-file `tesseract-core-simd.wasm.js` core is provisioned — its glue embeds the WASM module, so the separate `.wasm` binary is never fetched and would only add 3.3 MiB to the deployment. The 10.4 MiB traineddata is not a public asset (the Sites upload budget cannot hold it): postinstall writes it to `.data-bundle/ocr/`, and `/api/ocr-model` serves the pinned file at `/tesseract/eng.traineddata.gz` — from that copy on Node, from the digest-verified pinned package file on Workers (memoized per isolate; a Sites Worker cannot use the Cache API). The browser requests all OCR assets from the application's own origin only — no external OCR or CDN request — and page rendering/recognition happen inside the browser tab. The production CSP adds the narrow `'wasm-unsafe-eval'` script-source allowance (WebAssembly compilation only, no general `eval`) for the WASM core; `connect-src` remains `'self'`.

## Evidence classification

The deterministic classifier looks for narrowly defined evidence categories:

- diagnosis
- causation
- aggravation
- treatment
- medication
- timeline/progression
- alternative-cause language

An excerpt receives the stronger `nexus-relevant` label only when all of the following are true:

1. the user identifies the source as clinician-authored;
2. the excerpt contains explicit causation, aggravation, or alternative-cause language; and
3. the excerpt mentions at least one condition selected in the workflow.

Everything else is retained, when relevant, as `supporting` evidence. The product must not describe `nexus-relevant` as a determination that the evidence is legally competent, medically correct, sufficient, or persuasive.

## Quote and provenance requirement

The classifier does not rewrite an evidence sentence after extraction. Step 6 displays the extracted sentence together with:

- source name;
- PDF page, DOCX paragraph, text line, or user-supplied locator context;
- evidence category;
- matched selected-condition terms.

PDF/DOCX parsers may normalize layout whitespace while reconstructing selectable text. The displayed quotation is therefore the exact text passed from the local parser to the classifier, not a claim of byte-for-byte identity with the underlying file package. If the app cannot retain extracted text plus source provenance, it must not present the text as a quotation from the source.

## Non-goals

- no claim-success probability;
- no automated medical diagnosis;
- no determination that a clinician opinion satisfies VA nexus requirements;
- no server-side medical-record retention;
- no third-party OCR/document API;
- no automatic OCR of scanned pages;
- no fabricated DOCX page numbers.
