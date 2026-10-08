# Privacy acceptance contract — 2026-10-07

**Decision (accepted by the repository owner on 2026-10-07): all veteran health
context stays in the browser.** This document is the acceptance contract for
PRIV-01 in [security-architecture-audit-2026-10-07.md](security-architecture-audit-2026-10-07.md);
it replaces the previous ambiguity between "raw documents only" and "all PII/PHI".

## Scope — what must never leave the browser

The private workflow context, exactly as the legacy sealed cookie defined it:

- diagnosed condition ids and service-connected selections (with their answer draft);
- per-condition ratings and the assessment timeline (onset/diagnosis years);
- medications, treatments and free-text history entries;
- symptom ids;
- uploaded evidence, extracted document text and OCR transcripts;
- any derived value that identifies which conditions a visitor selected.

Public authored content is not private: the catalog, published knowledge-base
mappings, adjacency-graph nodes and regulatory/VA reference data may be served,
but only through **uniform requests** that are identical for every visitor and
carry no visitor context.

## Prohibited flows

1. Server Actions, route handlers or API endpoints receiving any field above
   (implemented 2026-10-08: the edge proxy refuses such a request outright —
   see [Request-refusal layer](#request-refusal-layer-2026-10-08)).
2. Cookies (encrypted or otherwise) persisting any field above; the legacy
   `secondary-workflow-v2` cookie must be rejected/cleared, not merely sealed
   (implemented in stage 3: the module is deleted and the edge proxy appends
   expired tombstones on `Path=/secondary` and `Path=/` whenever a request
   still presents the cookie).
3. Server-rendered HTML, RSC payloads or URLs embedding any field above.
4. Logs, metrics attributes and tracing (including LangSmith) receiving any
   field above. The engine's tracing wrapper must never see veteran context.
5. Third-party requests (analytics, fonts, images, error reporting) carrying any
   field above or any identifier derived from it.

## Target architecture

- The wizard runs client-side; context lives in a versioned, bounded browser
  record ([browser-context.ts](../src/lib/secondary-workflow/browser-context.ts)).
- The recommendation engine runs in the browser over a public corpus artifact
  ([client-corpus.ts](../src/lib/client-corpus/client-corpus.ts)) fetched once via
  `/kb/client-corpus.json`; it is byte-identical for every visitor.
- The server keeps only public content and public VA/regulatory lookups, none of
  which accept veteran context.

The full design record — invariant, layers, data flow, storage model, corpus,
evidence pipeline, enforcement and extension rules — is
[browser-local-veteran-workflow-design.md](browser-local-veteran-workflow-design.md).

## Staged migration and status

| Stage | Work | Status |
|---|---|---|
| 1 | Contract recorded; browser-local context store with schema bounds and clear-all coverage; public client corpus generator; engine parity proven (client corpus reproduces server recommendations exactly) | **Landed 2026-10-07** |
| 2 | Convert the six workflow step pages (diagnosed, service-connected, ratings, upload, suggestions, evidence) to client components reading the browser-local context; remove the PHI-bearing Server Actions | **Landed 2026-10-07** |
| 3 | Delete the legacy cookie path: no server reader, reject/clear `secondary-workflow-v2`, retire the workflow's use of the session crypto; keep no server-side copy of context | **Landed 2026-10-07** |
| 4 | Browser sentinel acceptance: unique sentinels in every private field, full flow, assert no sentinel in any request URL/body/header/cookie, server HTML/RSC, logs or traces; verify data-clearing covers all browser storage; re-verify upload/OCR stay local | **Landed 2026-10-07** |

All four stages have landed, so **the browser-local boundary in this contract
is met**: the 2026-10-07 sentinel run left no private field in any inspected
request URL/body/header/cookie, server HTML/RSC payload, console or server
log, trace file, or browser storage. This finding does not by itself close the
audit's other release gates — hosted two-account PKCE testing and the human
Section 508 review remain tracked in
[security-architecture-audit-2026-10-07.md](security-architecture-audit-2026-10-07.md)
— and real veteran data must not be enabled until those gates close.

## Acceptance criteria (from the audit, unchanged)

- Sentinel tests on every private field show no sentinel in HTTP bodies,
  headers/cookies, URLs, server HTML/RSC payloads, logs or tracing —
  **satisfied 2026-10-07** ([stage-4 evidence](#stage-4-evidence-2026-10-07)).
- Local evidence upload/OCR and the workflow still operate — **satisfied**
  (text extraction and image-only-PDF OCR both ran in-browser during the walk).
- Data-clearing tests cover all private storage — **satisfied** (Finish Review
  removed all seven registered keys; sessionStorage, localStorage, cookies and
  IndexedDB were re-scanned clean).
- Network inspection includes workers, not only component imports —
  **satisfied** (pdf.js and tesseract worker sessions were attached and their
  requests inspected).

## Stage-1 evidence (2026-10-07)

- Context store: round-trip, bounds rejection, corruption/version tolerance,
  direct clear and shared clear-all — [tests/privacy-browser-context.test.ts](../tests/privacy-browser-context.test.ts) (11/11 pass after the stage-2 graph-anchor additions).
- Corpus: `/kb/client-corpus.json` served by the running app (HTTP 200,
  `application/json`, 1.82 MB raw: 819 conditions, 140 published mappings, 5
  graph nodes); generation wired into `postinstall`, `predev` and `prebuild`.
- Parity: `recommend()` over the artifact equals `recommend()` over the live
  server loaders for two intakes (minimal and full context), so the client path
  cannot drift from server output.
- Generator and store lint clean; project typecheck exit 0.

## Stage-2 evidence (2026-10-07)

- **Browser walk (Chromium, real dev server):** Steps 1→6 completed with a
  synthetic PTSD selection (service-connected yes, rating 70, documents yes).
  State appeared only in `sessionStorage` under
  `secondary-condition-finder:secondary-workflow:v1`; `document.cookie` stayed
  empty at every step; the browser fetched `/kb/client-corpus.json` and ran
  `recommend()` locally (engine logs in the browser console); Finish Review
  cleared every registered key and returned to `/secondary`. Network log:
  page/RSC/script/font/corpus requests only — no request carried a selection.
  Evidence: `tmp/security-audit-2026-10-07/rel-01-kb-repair/priv01-stage2-evidence.json`.
- **Uniform shells:** the six `src/app/secondary/*/page.tsx` files contain no
  session reads or veteran context; `suggestions`/`evidence` load only a
  scope-free regulatory snapshot plus public VA reference data, and relevance
  filtering runs in the browser (`relevantChangesForConditionIds`).
- **Retired artifacts:** the secondary and scenario Server Actions and the
  ratings validation bridge are deleted; tests assert their absence
  (`tests/workflow-completion-privacy.test.ts`,
  `tests/browser-local-budget-contract.test.ts`,
  `tests/demo-scenario-launcher.test.ts`).
- **Corpus v2:** `/kb/client-corpus.json` (HTTP 200, `application/json`, 1.82 MB:
  819 conditions, 140 published mappings, 5 graph anchors) is generated by
  `npm run build:client-corpus` and wired into `postinstall`/`predev`/`prebuild`.
- **Checks:** focused step/privacy suites green; composition audit
  (`CLIENT-BOUNDARY`, track separation) exits 0; project typecheck exits 0; full
  suite failing-file set equals the pre-stage-2 baseline (102 files, zero newly
  failing).

## Stage-3 evidence (2026-10-07)

- **Legacy path deleted, not sealed:** the sealed `secondary-workflow-v2`
  module, its compact catalog encoding and the dead cookie-budget metric were
  removed; `tests/cookie-budget-contract.test.ts` was retired in favor of the
  browser-local budget/persistence contracts.
- **Stale presentations are rejected and cleared:** `src/proxy.ts` appends
  expired, path-scoped tombstones on both historical paths (`/secondary` and
  `/`) whenever a request still presents the cookie, so a browser holding the
  old payload deletes it on its next request. Pinned by
  `tests/retired-secondary-cookie.test.ts` (3 cases, including “no tombstone
  when absent”).
- **Composition audit:** the critical-module manifest now requires executable
  test coverage of `browser-context` instead of the retired module (14 modules,
  100% executable-import coverage, `architectureClean`), and the client-boundary
  rule no longer lists the deleted module.
- **Tests updated to the live contracts:** symptom round-trip and
  medication/treatment round-trip now assert the browser-local record; the
  privacy suite pins “no `next/headers`, no `document.cookie`, no `sendBeacon`,
  no URL building” for the context modules and keeps the presumptive cookie
  hardening assertions; the cookie-scope regression is presumptive-only;
  `demo-scenarios` validates through the client-safe transport.
- **Maintainer tooling:** the VA.gov walkthrough screenshot script seeds the
  browser-local record through `sessionStorage` instead of sealing a cookie.
- **Checks:** focused suites (10 files / 55 tests) pass; typecheck exits 0;
  composition audit exits 0; full-suite failing-file set equals the pre-stage-2
  baseline (zero new). Evidence:
  `tmp/security-audit-2026-10-07/rel-01-kb-repair/priv01-stage3-evidence.json`.

## Stage-4 evidence (2026-10-07)

- **Runner:** [acceptance-browser-sentinel.mjs](../scripts/acceptance-browser-sentinel.mjs)
  drives a real headless Chrome over the DevTools Protocol against the running
  app (`node scripts/acceptance-browser-sentinel.mjs`, app on
  `http://127.0.0.1:3107`; CI now starts that app itself — see
  [CI enforcement](#ci-enforcement-2026-10-08) below). It captures every request (URL, method,
  headers, cookies, post data), every response header and body, the browser
  console and log, the dev-server log tail, `.next/trace`, and the cookie jar,
  from the page session **and** every attached worker session.
- **Sentinel coverage (two passes):** Pass A walks the real UI with
  sentinels in the free-text context fields, the evidence file name/content,
  and the scanned-PDF file name plus its rendered OCR image; Pass B seeds the
  browser-local record (the sanctioned storage home) with sentinels in every
  string field of the schema — diagnosed ids, service-connected ids, answer
  draft key, rating key, symptom id, timeline key, medications, treatments and
  history — then re-walks Steps 5–6 and Finish Review.
- **Result:** run token `0f953e99`, **20/20 assertions passed, exit 0** — zero
  sentinel occurrences across 99 requests, 99 responses, 93 response bodies
  (including 9 server HTML/RSC payloads), 20 console messages, 4 browser log
  entries, the dev-server log, `.next/trace` and browser cookies; the only host
  contacted was `127.0.0.1:3107`. Evidence:
  `tmp/security-audit-2026-10-07/rel-01-kb-repair/priv01-stage4-evidence.json`
  (log and exit file alongside).
- **Upload/OCR stayed local, workers included:** the image-only scanned PDF
  was recognized in-browser by the tesseract worker; the attached worker
  sessions (`/pdf.worker.min.mjs` ×2, `/tesseract/worker-guard.js`) fetched
  only same-origin assets (`/tesseract/worker.min.js`,
  `/tesseract/tesseract-core-simd.wasm.js`, `/tesseract/eng.traineddata.gz`),
  and the retained browser-local excerpt read
  `The sleep apnea was caused by SENTINELOCROF953E99`. No image bytes,
  extracted text or OCR transcript appeared in any request.
- **Clearing covers all browser storage:** Finish Review removed all seven
  keys registered in
  [local-state.ts](../src/lib/secondary-workflow/local-state.ts) (the runner
  asserts that list against the key identifiers' defining modules);
  sessionStorage, localStorage and cookies were empty afterwards, and an
  IndexedDB scan (`__next_debug_channel` — Next dev internal — and the
  `keyval-store` cache owned by the tesseract.js dependency) held no sentinel.
- **No server log or trace leakage:** the dev-server log tail and `.next/trace`
  contained no sentinel; no third-party host or LangSmith endpoint was
  contacted, and the walk raised no uncaught browser exceptions.

## Request-refusal layer (2026-10-08)

Stages 1–4 removed every server path that *read* veteran context; the server
now also **refuses** a request that carries it. `src/lib/security/private-context-request-guard.ts`
is the boundary and [proxy.ts](../src/proxy.ts) is the single choke point:

- A request presenting a private context parameter is refused with **400** on
  **every** path, because the contract's first prohibited flow names no route.
  The refusal list covers both the browser-local record's field names and the
  retired flat transport names, and is pinned by tests to the live record
  schema, so adding a private field without extending the guard fails the
  suite.
- A write method (anything but GET/HEAD/OPTIONS) is refused on the workflow
  area (`/secondary…`) only, because those pages are read-only shells while
  other tracks still POST their own Server Actions.
- The refusal **never echoes a value**: it names at most one constant parameter
  name from the guard's list, never the request's content. It still appends the
  expired retired-cookie tombstones, so a refused request cannot leave the
  legacy payload in place.
- It runs *after* the existing limiters, so admission control keeps its
  coverage and a refusal cannot become an unthrottled endpoint.

**Retired transport deleted:** [SecondaryWorkflowHiddenFields.tsx](../src/components/SecondaryWorkflowHiddenFields.tsx)
was the pre-PRIV-01 transport that rendered `diagnosed`, `serviceConnected`,
`rating-<id>` and `documentsShared` as hidden form inputs for a Server Action.
It had no remaining reference anywhere in `src`, `tests`, `e2e` or `scripts`,
and it is gone — so the form-post shape cannot be reintroduced by importing it.

**Evidence:** [tests/private-context-request-guard.test.ts](../tests/private-context-request-guard.test.ts)
(8 cases: refusal per parameter family, record-field coverage derived from the
written record, retired-parser coverage derived from `state.ts`, write-method
scope, allowed shapes, value-free body) and real HTTP against the running app —
**11/11** probes, with refusals carrying no value and the six-step walk keeping
clean URLs. Evidence:
`tmp/security-audit-2026-10-07/priv01-request-guard/http-evidence.json`.
A browser walk of Steps 1→4 (diagnosed → service-connected → ratings → upload)
confirmed live: state appears only in `sessionStorage`, `document.cookie` stays
empty, navigation URLs carry only `_rsc`, and the server log records **zero**
refusals during the walk — while the crafted requests above are refused and
produce no server log entry that would echo their query.

**Not re-verified by this layer:** the full sentinel walk was re-run twice and
stopped both times at the page-side OCR wait — the recorded runner-error report
(`tmp/security-audit-2026-10-07/priv01-request-guard/priv01-sentinel-recheck.json`)
shows the 240-second OCR completion wait expiring while every probe returned
`CDP Runtime.evaluate timed out`, i.e. the renderer stayed busy on the
in-browser tesseract run on this host rather than a budget being mis-sized — so
the 2026-10-07 stage-4 acceptance remains the contract's leakage evidence. A
refusal path that the correct flow never triggers does not change that record;
a completed sentinel re-run is still outstanding.

## CI enforcement (2026-10-08)

Stage 4 was a maintainer-run gate; it is now enforced. The `verify` job in
[ci.yml](../.github/workflows/ci.yml) runs a named gate,
**Run PRIV-01 stage-4 browser sentinel**, whose failure re-fails the job (it is
listed in the job's final aggregator, not left advisory). The step starts a dev server on its
own port, waits for `/api/health`, points `SENTINEL_APP_BASE` and
`SENTINEL_SERVER_LOG` at that server, and runs
[acceptance-browser-sentinel.mjs](../scripts/acceptance-browser-sentinel.mjs)
with the runner's Chrome. A missing browser, an unhealthy server, or a failed
walk fails the gate — it never degrades to a skip, because a green `verify` has
to mean the walk actually happened.

Pull requests are selected by their change set through
[priv01-sentinel-scope.mjs](../scripts/priv01-sentinel-scope.mjs): the
workflow's routes, step components and browser-local state, the evidence/OCR
pipeline and its self-hosted tesseract assets, the client corpus, the
private-context refusal layer, the proxy, the COOP/COEP configuration, the
runner itself, and the contract suites that encode the same invariant.
Detection fails closed — an unreadable change set runs the gate rather than
skipping it — and every non-PR event (push to main, manual dispatch) runs it
unconditionally. [priv01-sentinel-gate-wiring.test.ts](../tests/priv01-sentinel-gate-wiring.test.ts)
walks those directories on disk, so a new privacy-bearing module cannot land
outside the gate's scope, and pins the wiring above.

**Not yet measured, and the one open risk:** the step's first run on a CI
runner is outstanding as of this layer. The walk was rehearsed locally through
the step's own extracted script, and the page-side OCR leg failed
**4 of 4** attempts the same way — the 240-second "Local OCR completed for"
wait expiring while every probe returned `CDP Runtime.evaluate timed out`
([rehearsal record](../tmp/security-audit-2026-10-07/priv01-request-guard/ci-rehearsal/README.md);
tokens `34d6f3e0` and `40387030`, both `runner-error`). The renderer stayed busy
for the whole wait while the tesseract workers ran, so the suspect is page-side
saturation during in-browser OCR rather than the walk's own logic; the
2026-10-07 stage-4 runs completed on this same host (tokens `7e6f1861` at 45/45
and `0f953e99` at 20/20), so it is not a static defect in the runner. Until a run
completes on a runner, this gate must be read as *wired and enforced, not yet
observed green*, and the OCR leg is the leg to fix or budget before it is treated
as a required check.

## Non-goals

- No medical content, mapping, or verification-status changes.
- No change to what the server may publish as public authored content.
- This contract does not by itself authorize production VA account use or
  Section 508 conformance claims (see COMP-01).
