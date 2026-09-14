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
| `src/lib/evidence/dd214-extract.ts` | DD-214 structured data extraction | `File` API |
| `src/lib/evidence/storage.ts` | `sessionStorage` read/write for extracted evidence | `sessionStorage` |
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
- Maximum stored evidence is bounded by `STANDARD_LIMITS.storedBytes` (256 KB) or `EXTENDED` mode (3 MB)

## Adding New Evidence Parser Modules

When adding a new evidence parser (e.g., `dd214-extract.ts`):

1. Place it in `src/lib/evidence/`
2. Add a JSDoc header explaining it is browser-only (see existing modules for the pattern)
3. Add it to the `EVIDENCE_PARSER_MODULES` array in `scripts/audit-test-composition.js`
4. Add it to the `REQUIRED_EXECUTABLE_IMPORTS` array if it exports functions that tests should exercise
5. Verify `npm run test:composition` passes
6. Add `tests/ingestion-privacy.test.ts` coverage for the new module

## Cross-References

- `SECURITY.md` — CSP `connect-src 'self'` constraint
- `docs/technical-specification.md:438` — Evidence-parser architecture contract
- `docs/secondary-technical-2026-09-09.md:426` — Evidence-parser architecture contract
- `tests/ingestion-privacy.test.ts` — Runtime privacy enforcement
- `tests/evidence-architecture.test.ts` — Evidence classification architecture tests
