# Browser-local veteran workflow — design (2026-10-07)

**Status: implemented and verified.** This document is the normative design record
for the secondary-condition (compensation-nexus) workflow that keeps every piece of
veteran health context inside the browser. The implementation landed as PRIV-01
stages 1–4; the acceptance contract is
[privacy-acceptance-contract-2026-10-07.md](privacy-acceptance-contract-2026-10-07.md)
and the audit finding is PRIV-01 in
[security-architecture-audit-2026-10-07.md](security-architecture-audit-2026-10-07.md).
The stage-4 browser sentinel run passed 20/20 assertions with zero private-field
leakage ([evidence](../tmp/security-audit-2026-10-07/rel-01-kb-repair/priv01-stage4-evidence.json)).

This is a design for **one workflow**, not a claim that the whole application is
free of server-side veteran data; see [Residual risks and exclusions](#residual-risks-and-exclusions).

## The invariant

No value in the following classes may appear in a server request (URL, query, body,
header, cookie), a server response (HTML, RSC payload, JSON), a server or browser
log, a trace, or any third-party request:

| Class | Examples |
|---|---|
| Diagnosed condition ids | the catalog ids a visitor selected in Step 1 |
| Service-connected selections | ids plus the yes/no answer draft |
| Ratings | per-condition disability ratings, including “prefer not to answer” |
| Chronology | onset/diagnosis years per condition |
| Bounded health context | medications, treatments, free-text history entries |
| Symptoms | selected symptom-prompt ids |
| Documents and extracts | uploaded bytes, extracted document text, OCR transcripts |
| Derived context | anything that reveals which conditions a visitor selected |

Public authored content is **not** covered: the condition catalog, published
knowledge-base mappings, adjacency-graph nodes, regulatory/VA reference data and the
demo scenarios may be served, but only through **uniform requests** — byte-identical
for every visitor and unaffected by selections.

## Architecture at a glance

```text
┌─ Browser (the only home of veteran context) ─────────────────────────────┐
│  six client steps  →  browser-local record (sessionStorage, versioned)   │
│  engine over public corpus   |   evidence extraction + OCR in workers   │
│  checklists / depth / review marks (sessionStorage, clear-on-completion) │
└──────────────┬───────────────────────────────────────────────────────────┘
               │ uniform requests only: page/RSC, /kb/client-corpus.json,
               │ same-origin workers (/pdf.worker.min.mjs, /tesseract/*)
┌──────────────▼─────────────── Server (never sees context) ───────────────┐
│  uniform route shells (no session reads)                                 │
│  public regulatory snapshot + public VA reference data                   │
│  retired cookie rejected with expired tombstones (edge proxy)            │
└──────────────────────────────────────────────────────────────────────────┘
```

## Layer 1 — server: uniform shells and public assets

- The six routes (`/secondary/diagnosed`, `/secondary/service-connected`,
  `/secondary/ratings`, `/secondary/upload`, `/secondary/suggestions`,
  `/secondary/evidence`) are server components that render a client step and read
  **no session**: no cookie reads, no `next/headers`, no query-derived context.
  Steps 5–6 load only a scope-free regulatory snapshot plus public VA reference
  data; relevance filtering runs in the browser
  (`src/lib/regulatory/preflight/client-relevance.ts`).
- The only artifact served for the workflow is the static, generated
  `/kb/client-corpus.json` (`public/kb/`).
- URLs may carry only public or non-context values: `?regSnapshot=<public snapshot
  id>` for Steps 5–6 navigation and `?error=<validation code>` for the legacy
  cross-step error transport. No URL is ever built from the record.
- No workflow cookie is set. A stale `secondary-workflow-v2` presentation is
  answered with expired, path-scoped tombstones on `/secondary` and `/`
  (`src/proxy.ts`), so old browsers delete their payload on the next request.

## Layer 2 — browser: the sanctioned home for context

### The record

`src/lib/secondary-workflow/browser-context.ts` owns the only sanctioned context
store:

- key `secondary-condition-finder:secondary-workflow:v1`, version `1`; a version
  bump intentionally orphans older payloads;
- Zod-validated on every read and write; missing, corrupt, out-of-version or
  out-of-bounds payloads read as **absent**, never partially trusted;
- bounds mirror the retired sealed-cookie schema: `MAX_CONTEXT_ITEMS = 20`
  entries and `MAX_CONTEXT_ITEM_LENGTH = 160` characters per medications /
  treatments / history entry, timeline years `1900–2100`, symptom ids matching
  `^[a-z0-9-]+$` (max 20), ratings integers `0–100` or `null`;
- a failed write throws, and the step holds the user in place with
  `context-too-large` instead of navigating (no silent truncation).

`src/lib/secondary-workflow/use-browser-context.ts` exposes the read path
(`readSessionContext`, `useBrowserWorkflowContext`) with a `ready` gate and no
swallowed errors. `src/lib/secondary-workflow/transport.ts` is the client-safe
state↔form-params bridge used to rebuild parser input from the record — it never
builds URLs.

### Step logic

`src/lib/secondary-workflow/client-steps.ts` holds the pure step functions
(`applyDiagnosedStep`, `applyServiceConnectedStep`, `applyRatingsStep`,
`applyDocumentsStep`) and the persistence wrappers (`persistStepResult`,
`persistStepContext`). They preserve the retired Server Action semantics exactly:
the `appendFormData` allowlists that prevent late-step overposting, the
`serviceConnectedAnswerDraft` carry, the `parse*Selection` Zod schemas and bounds,
and the downstream-reset rules. The six components in
`src/components/secondary/steps/` only render and call them.

### Data flow, step by step

1. **Diagnosed** — catalog checkboxes → `applyDiagnosedStep` → record replaced with
   the new diagnosed list (re-entering the step intentionally resets downstream
   fields).
2. **Service-connected** — one yes/no per diagnosed id; partial answers persist as
   a draft; an all-“no” run persists the empty selection and shows guidance.
3. **Ratings** — a select per service-connected condition; `decline` is stored as
   `null`; every condition must carry an answer.
4. **Documents** — `documentsShared`, bounded medications / treatments / history,
   symptom prompts, and per-condition onset/diagnosis years. This step also hosts
   the evidence analyzer, which never leaves the browser.
5. **Connections** — the browser fetches the public corpus, builds the intake from
   the record, and runs the **same** `recommend()` engine the server uses
   (`src/lib/engine/recommend.ts`), then renders results locally.
6. **Evidence** — the same corpus and record drive the evidence-gap checklist,
   consultation summary and research aids. Print/export paths build blobs in the
   browser.

### Clearing and lifetime

`src/lib/secondary-workflow/local-state.ts` is the single registry of
browser-local keys (record, evidence analysis, evidence-gap review, pathway-record
checklist, VA.gov walkthrough progress, OCR checkpoint, depth preference).
`clearSecondaryWorkflowLocalState` removes all of them;
`SecondaryWorkflowCompletionActions.tsx` (“Finish Review” / “Start a new review”)
clears first and navigates only on confirmed success — otherwise it shows
`CleanupErrorAlert` instead of pretending the review is finished.

## The public corpus contract

- `src/lib/client-corpus/client-corpus.ts` defines `CLIENT_CORPUS_VERSION = 2`,
  `CLIENT_CORPUS_PATH = "/kb/client-corpus.json"`, the Zod parser
  (`parseClientCorpus` / `isClientCorpus`), `buildClientCorpus` and the graph
  anchor index.
- `scripts/build-client-corpus.mjs` writes `public/kb/client-corpus.json` and is
  wired into `postinstall`, `predev` and `prebuild`, so the artifact cannot go
  stale relative to the knowledge base.
- `use-client-corpus.ts` (`loadClientCorpus` / `useClientCorpus`) memoizes the
  fetch per tab and surfaces failures; the request carries no parameters,
  selections or cookie, and the response is byte-identical for every visitor.
- **Parity is enforced**: a test in
  `tests/privacy-browser-context.test.ts` asserts that `recommend()` over
  `buildClientCorpus()` output equals `recommend()` over the live server loaders,
  so the browser path cannot drift from server output.

## Engine placement and observability

- The engine is imported by client steps and runs in the browser; the server-side
  LangSmith wrapper (`src/lib/engine/recommend-tracing.ts`) is `server-only`,
  unused by the workflow, and its redaction contract only emits counts for
  synthetic/public callers.
- Nothing in the browser-local path logs ids or free text: tests assert the
  context modules contain no `next/headers`, no `document.cookie`, no
  `sendBeacon`, and no URL building; the stage-4 gate scans browser console,
  browser log, dev-server log and traces for sentinels.

## Evidence and OCR stay local

- `src/components/evidence/LocalEvidenceAnalyzer.tsx` stages files, extracts
  text (`src/lib/evidence/document-extract.ts` for PDF/DOCX/text) and classifies
  excerpts (`src/lib/evidence/extract.ts`) entirely in the tab; retained excerpts
  live in `sessionStorage` under `secondary-condition-finder:evidence-analysis:v1`
  (`src/lib/evidence/storage.ts`).
- Image-only scanned PDFs are recognized by a same-origin tesseract worker
  (`/tesseract/worker-guard.js` plus core and language assets); PDF rendering uses
  the same-origin `/pdf.worker.min.mjs`. No upload, fetch or beacon carries file
  bytes, extracted text or OCR transcripts.
- Bounds (file/batch/page/character limits, stored-source and byte budgets) come
  from `src/lib/evidence/limits.ts`; the OCR resume checkpoint
  (`src/lib/evidence/ocr-session.ts`) is tab-scoped and is on the clear-all list.

## Enforcement

| Mechanism | What it prevents | Where |
|---|---|---|
| Record bounds + absent-on-corruption | oversized, tampered or stale payloads being trusted | `tests/privacy-browser-context.test.ts` |
| Step allowlists + draft carry | cross-step overposting, lost drafts, silent resets | `tests/privacy-client-steps.test.ts` |
| Client-boundary import rule | `"use client"` files importing `@/lib/kb`, session crypto, store, presumptive session | `scripts/audit-test-composition.js` (`CLIENT-BOUNDARY`, critical-module manifest) |
| Evidence boundary audit | evidence parser imported by a server route, bytes in cookie/log | `scripts/audit-evidence-architecture.js` (`npm run evidence:architecture`) |
| Completion privacy | clear-all coverage and no navigation on failed cleanup | `tests/workflow-completion-privacy.test.ts`, `tests/browser-local-budget-contract.test.ts`, `tests/browser-local-persistence-failure-contract.test.ts` |
| Retired-cookie tombstone test | a stale `secondary-workflow-v2` surviving instead of being cleared | `tests/retired-secondary-cookie.test.ts` |
| Sentinel acceptance | any private field reaching a request, HTML/RSC, log, trace or storage | `node scripts/acceptance-browser-sentinel.mjs` (requires the app on `http://127.0.0.1:3107`) |

The sentinel gate walks the real UI with sentinels in the free-text/evidence
fields and re-drives Steps 5–6 from a seeded record carrying sentinels in every
schema string field; it attaches the page **and** worker sessions, then scans
request URLs/bodies/headers/cookies, response headers/bodies (including server
HTML/RSC payloads), console/browser/server logs, `.next/trace`, cookies and a
deep IndexedDB read. It also asserts that Finish Review removes every registered
key and that nothing remains in sessionStorage/localStorage/cookies.

## How to extend without breaking the invariant

1. **New private field** — add it to `browser-context.ts` with explicit bounds,
   thread it through the owning step's `client-steps.ts` function and allowlist,
   add it to the privacy tests, and extend the sentinel gate's Pass B record.
   The clear-all registry needs no change: one record covers all its fields.
2. **New server-needed lookup** — it must be scope-free and uniform: no ids, no
   selection-derived parameters, cacheable, identical for every visitor. Prove it
   with the sentinel gate before adding it to a step.
3. **New export/download** — build it as a browser blob; never POST a payload to
   create a document.
4. **New client module** — keep it free of `@/lib/kb`, session crypto, `store`,
   and `next/headers`; the composition audit will fail otherwise.

**Anti-patterns** (each one breaks the contract): Server Actions, route handlers
or API endpoints receiving any field in the table above; cookies (encrypted or
not) persisting context; context in query strings or `history`; `document.cookie`
or `sendBeacon` in context modules; logging ids or free text; per-selection
fetches; third-party assets or error reporting carrying any derived identifier.

## Residual risks and exclusions

- **Browser-local ≠ encrypted.** `sessionStorage` is same-origin script-readable
  and available to extensions the user has installed; isolation is by origin and
  tab, not by cryptography. Device-level protections (shared computers, profiles)
  remain the user's responsibility. Trusted Types / strict-style work is a
  separate audit item.
- **Adjacent tracks keep their own boundaries.** The presumptive track still
  writes the encrypted, HttpOnly `presumptive-workflow-v1` cookie, and the DD-214
  analyzer posts **confirmed service locations, branches and dates** (never
  diagnoses, ratings, health context or evidence bytes) to
  `saveServiceHistory`; that documented exception is out of scope here.
- **This design does not authorize production veteran data.** Hosted
  two-account PKCE testing (COMP-01) and the human Section 508 review remain
  release gates in the audit report.
- **Deliberately not covered:** the accreditation lookup, regulatory preflight
  API and VA account surfaces; none of them receive the private fields above, and
  each has its own contract.

## Related documents

- [privacy-acceptance-contract-2026-10-07.md](privacy-acceptance-contract-2026-10-07.md) — accepted contract, staged migration, acceptance evidence
- [security-architecture-audit-2026-10-07.md](security-architecture-audit-2026-10-07.md) — PRIV-01 finding and the remaining release gates
- [technical-specification.md](technical-specification.md) — module-level implementation inventory
- [evidence-parser-boundary.md](evidence-parser-boundary.md) — evidence parser boundary rules
- [data-retention-policy.md](data-retention-policy.md) — retention classes and clearing
