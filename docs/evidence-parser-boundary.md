# Evidence Parser Boundary

## Overview

Evidence parsers (`src/lib/evidence/`) execute **exclusively in the browser**. They parse user-uploaded medical documents (PDFs, DOCX, plain text) using client-only libraries (pdfjs-dist, mammoth, tesseract.js WASM) and never transmit raw bytes or extracted text to the server. This is a hard architectural boundary enforced by both automated audits and runtime constraints.

## Why This Boundary Exists

1. **Privacy**: Raw medical evidence contains Veterans' protected health information (PHI). Keeping extraction browser-local means no PHI crosses the network boundary, enters server logs, or appears in cookies.

2. **CSP**: The Content Security Policy's `connect-src 'self'` (production) prevents any network egress from client code. Evidence parsers cannot call external APIs.

3. **WASM dependencies**: `pdfjs-dist` and `tesseract.js` load WebAssembly modules from `/public/tesseract/*` and the PDF.js worker. These are browser-only; they fail on the server.

4. **Memory**: Document extraction can use significant memory (ZIP decompression, PDF page rendering, OCR). Browser-local execution bounds this to the user's tab, not a shared server process.

## Evidence Parser Modules

| Module | Responsibility | Browser-only APIs used |
|---|---|---|
| `src/lib/evidence/extract.ts` | Text classification (nexus-relevant, supporting, diagnosis, etc.) | None (pure regex) |
| `src/lib/evidence/document-extract.ts` | PDF/DOCX/text extraction from `File` objects | `pdfjs-dist`, `mammoth`, `File.arrayBuffer()`, `File.text()` |
| `src/lib/evidence/dd214-extract.ts` | DD-214 structured data extraction; slices at the caller's `EvidenceLimits.textChars` and discloses truncation, validates real calendar dates, and minimizes SSN layouts by shape | `File` API |
| `src/lib/evidence/ocr-session.ts` | Browser-local OCR primitives: canvas pixel-area cap, declared-dimension image-decode bound (`planImageDecode`) with no decode on the refusal path, five-minute elapsed-work budget (`startOcrJobDeadline`), page-ordered text assembly under the review budget, page-burst yields, resume checkpoints, worker health probe, factory-only worker spawn | `canvas`, `sessionStorage`, `createImageBitmap`, `Worker` |
| `src/lib/evidence/storage.ts` | `sessionStorage` read/write for extracted evidence, with a bounded read guard (byte ceiling before `JSON.parse`, retention window before validation, per-field ceilings, ignored-entry accounting) and the one reader every consumer of the store uses (`parseStoredEvidence`) | `sessionStorage` |
| `src/lib/evidence/limits.ts` | Byte/char/page limits for Standard and Extended depth modes | None |
| `src/lib/evidence/document-kind.ts` | Document kind detection | None |
| `src/lib/evidence/condition-terms.ts` | Condition term normalization | None |

## Where Evidence Parsers CAN Be Imported

- **Client components** (`"use client"` in `src/components/`) — e.g., `LocalEvidenceAnalyzer.tsx`
- **Lib modules** under `src/lib/evidence/` that share the same browser-local boundary
- **Test files** under `tests/` — for unit/integration testing

## Where Evidence Parsers CANNOT Be Imported

- **App pages** (`src/app/`) — Next.js app pages may run on the server
- **Server Actions** (`src/lib/actions/`) — always execute on the server
- **API routes** (`src/app/api/`) — execute on the server
- **Any module that does not have `"use client"` and runs in a server context**

## Enforcement

### Automated audit

`npm run test:composition` (`scripts/audit-test-composition.js`) enforces the **EVIDENCE-PARSER-BOUNDARY** rule:

```js
const EVIDENCE_PARSER_MODULES = [
  "@/lib/evidence/extract",
  "@/lib/evidence/document-extract",
];

// For each source file, if it's under src/app/ and imports an evidence parser module:
if (
  relative.startsWith("src/app/") &&
  EVIDENCE_PARSER_MODULES.some((moduleId) => specifier.startsWith(moduleId))
) {
  violation("EVIDENCE-PARSER-BOUNDARY", ...);
}
```

This audit runs in CI and blocks merges on violations.

### Privacy tests

`tests/ingestion-privacy.test.ts` verifies that evidence bytes never appear in:
- `writeSecondaryWorkflowSession` payloads
- Server-side cookies
- Audit log entries

### Runtime constraints

- `connect-src 'self'` prevents any evidence data from leaving the browser
- Evidence is stored only in `sessionStorage:evidence-analysis:v1` (tab-scoped)
- Maximum stored evidence is bounded by `STANDARD_LIMITS.storedBytes` (256 KB) or `EXTENDED` mode (3 MB) on write **and** on read: the stored payload is measured against the caller's ceiling before it is parsed, so a store written by another version, edited by hand, or replaced by same-origin script cannot make the tab parse an unbounded value

## Adding New Evidence Parser Modules

When adding a new evidence parser (e.g., `dd214-extract.ts`):

1. Place it in `src/lib/evidence/`
2. Add a JSDoc header explaining it is browser-only (see existing modules for the pattern)
3. Add it to the `EVIDENCE_PARSER_MODULES` array in `scripts/audit-test-composition.js`
4. Add it to the `REQUIRED_EXECUTABLE_IMPORTS` array if it exports functions that tests should exercise
5. Verify `npm run test:composition` passes
6. Add `tests/ingestion-privacy.test.ts` coverage for the new module

## Browser-local resource bounds (audit A06)

Every browser-local extraction is bounded **before** it allocates, because a Veteran's tab — not a server process — pays for an unbounded decode:

- **Elapsed work.** An OCR job runs under a five-minute budget. A per-page boundary check cannot stop a `recognize()` or `page.render()` promise that never settles, so the owning component arms a timer that terminates the live worker and loading task, which rejects the awaited promise and unwinds the run through its normal teardown.
- **Decode size.** A direct image upload is measured from its container header (PNG, JPEG, GIF, BMP, WebP, TIFF) and refused when the declared pixel count or either dimension exceeds the ceiling, or when the header cannot be read at all. An accepted image renders through the same canvas pixel-area cap the PDF path uses, so what reaches the OCR worker is bounded by construction. Refusals are shown with the measured size and always restate that the file never left the tab.
- **Retained text.** Per-page text is joined in **page order** under the depth limit's character budget, so a truncated review is the document's prefix rather than whichever pass (text layer or OCR) ran first, and truncation is disclosed.
- **Teardown.** Cancel, the elapsed-work deadline, and unmount share one teardown path; a worker or pdf.js task already terminated by that path is not terminated a second time inside a `finally`. Both browser-local OCR pipelines run under the same budget — the DD-214 analyzer and the main evidence pipeline — so a hung recognition is stopped in either.
- **Stored excerpts.** Reading the browser-local store is bounded like writing it. The payload is measured against the active depth ceiling **before** `JSON.parse` runs, the retention window is applied **before** per-entry validation, and every field a renderer touches has its own ceiling above the largest envelope this app writes (quote, source name, locator, excerpt count, matched terms). A record that fails validation is ignored and **counted**, and the surface discloses how many were ignored instead of restoring a partial store in silence; a payload over the ceiling is refused with the same fixed notice a corrupt store gets. Neither path ever echoes parser text or stored content — a JSON syntax error can carry document text — and the observability codes are fixed strings (`STORE_UNREADABLE`, `STORE_OVERSIZE`, `STORE_PARTIAL`).

  **Every reader of that store goes through the one path.** The Step 6 surfaces (the analyses provider and its gap-coverage chips, the local excerpt review, the pathway mapper, and the per-hop review) hold the payload string rather than a `Storage` handle, so each of them called `parseStoredEvidence` with `MAX_STORED_EVIDENCE_READ_LIMITS` — the widest envelope this app can write — instead of parsing the payload itself. A reader without depth context cannot know whether the store was written under Standard or Extended retention, and a ceiling narrower than a shipped envelope would refuse or trim a legitimate Extended store on whichever page opened it first; that is why the depth-less reader takes the maximum rather than a default.

## Cross-References

- `SECURITY.md` — CSP `connect-src 'self'` constraint
- `docs/technical-specification.md:438` — Evidence-parser architecture contract
- `docs/secondary-technical-2026-09-09.md:426` — Evidence-parser architecture contract
- `tests/ingestion-privacy.test.ts` — Runtime privacy enforcement
- `tests/evidence-architecture.test.ts` — Evidence classification architecture tests
