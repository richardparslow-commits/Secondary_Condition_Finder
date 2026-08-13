# Evidence ingestion and local review

## Purpose

Step 4 can optionally identify exact evidence excerpts that may help a Veteran organize a later discussion with a qualified medical provider or accredited representative. This feature is an evidence-review aid. It does not determine medical causation, legal competency, credibility, probative weight, or VA entitlement.

## Privacy boundary

Raw supporting-document bytes and text stay in the browser. The application server receives only the existing `documentsShared` yes/no workflow choice. Raw medical text and locally extracted quotations are not written to application logs, aggregate recommendation events, workflow cookies, URLs, or user accounts.

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

PDF pages that contain no extractable/selectable text are reported to the user rather than guessed. Scanned or image-only records therefore still require OCR in a trusted tool before their text can be analyzed. The paste-text fallback remains available so OCR/exported text can be reviewed with user-supplied locator context.

DOCX is a flow-oriented format and does not reliably encode stable rendered page numbers. The application therefore uses paragraph locators instead of inventing DOCX page numbers.

## PDF parser security boundary

The application pins `pdfjs-dist` to 6.2.108, the patched release required by the repository's high-severity dependency gate for the reviewed malicious-PDF advisory. The earlier vulnerable pin was rejected by CI and is not retained. Extraction uses only the PDF.js display-layer text-content API, does not render the PDF viewer or execute document actions, and destroys the `PDFDocumentLoadingTask` after page text extraction. The generated PDF.js worker is copied verbatim from the pinned dependency during installation and is excluded from source-code linting; application-authored parser and worker-copy code remains linted normally.

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
