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
- confirmed service locations, service branches and service dates (the
  presumptive/DD-214 track — added 2026-10-08, see
  [Presumptive track](#presumptive-track--browser-local-2026-10-08));
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
   still presents the cookie). The same applies to the presumptive track's
   `presumptive-workflow-v1` cookie (retired 2026-10-08): its session module is
   deleted and the proxy appends an expired `Path=/presumptive` tombstone.
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
| 5 | Presumptive/DD-214 track: service locations, branches and dates move to a browser-local record; delete the `saveServiceHistory` Server Action and the sealed-cookie session module; tombstone `presumptive-workflow-v1`; name the track's one remaining server call | **Landed 2026-10-08** (this document, below) |

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
- Applied to the presumptive track's own private fields — **not yet**: the
  sentinel walk does not visit that track (see
  [Evidence and its limits](#evidence-and-its-limits)); its evidence is the
  focused suites listed there.

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
  no URL building” for the context modules. Its presumptive cookie-scope suite
  was retired on 2026-10-08 with the cookie itself: `tests/workflow-cookie-scope.test.ts`
  no longer exists and is replaced by `tests/retired-presumptive-cookie.test.ts`,
  the tombstone contract for `presumptive-workflow-v1`; `demo-scenarios`
  validates through the client-safe transport.
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
  step pages that host **no** public action, because those pages are read-only
  shells while other tracks still POST their own Server Actions. The two pages
  that do host a public action are exempt and named: the
  accredited-representative finder posts `zip` / `radiusMiles` / `type` from
  `/secondary/suggestions` and `/secondary/evidence`. That exemption is a
  correction, not a design choice: refusing every write in the workflow area
  answered 400 to that public action on the CI gate's first run — the Step 5
  locator search never redirected, the page fell to its error boundary, and the
  pre-existing browser E2E gate failed. The gap is body-carried context, which
  stays out of scope for the same reason it always was: the edge proxy does not
  read bodies.
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

## Presumptive track — browser-local (2026-10-08)

The DD-214 → presumptive flow was the contract's last open item: it held
confirmed **service locations, service branches and service dates** and shipped
them to a Server Action, which sealed them into the encrypted,
HttpOnly `presumptive-workflow-v1` cookie. That server boundary is retired.

- **The record.** [browser-history.ts](../src/lib/presumptive/browser-history.ts)
  owns `presumptive-condition-finder:service-history:v1` (version `1`): the same
  `serviceHistorySchema` the retired action validated with, applied on every
  read and write, a failed write throwing instead of truncating, and missing/
  corrupt/out-of-version/out-of-bounds payloads reading as **absent**. The key
  is on the track's clear-all registry (`presumptiveLocalStorageKeys`), which
  the design-conformance suite holds against every versioned key in `src/`.
- **The read path.** [use-browser-history.ts](../src/lib/presumptive/use-browser-history.ts)
  binds the record with `useSyncExternalStore` (cached snapshot, server
  snapshot “no history”), so it is never read in a server render and no
  `setState` runs inside an effect. `/presumptive/results` reads **no session**:
  it renders public data (exposure catalog, published-mapping cross-link index,
  service-branch reference) and the client view reads the record and runs
  `matchPresumptives` in the tab.
- **The retired boundary.** `src/lib/actions/presumptive.ts` (the
  `saveServiceHistory` Server Action) and `src/lib/presumptive/session.ts` (the
  sealed-cookie session module) are deleted; the proxy tombstones a stale
  `presumptive-workflow-v1` presentation on `Path=/presumptive`. The
  authored-catalog membership allowlist that ran server-side now runs in the
  browser before the write, so a crafted value still cannot be stored.
- **The DD-214 analyzer** extracts PDF text or OCRs in the tab and stores
  nothing until the veteran confirms; SSN stays masked and no document byte or
  transcript is sent anywhere.

### The track's one remaining server-boundary exception

**Accredited-representative directory lookup.** The “Find Help Near You” card on
`/presumptive/results` — the same component the secondary track renders on
`/secondary/suggestions` and `/secondary/evidence` — resolves the 5-digit ZIP a
visitor types against the public VA accredited-representative directory. It is
the only call in this flow that leaves the tab, and it is recorded as an
exception rather than left implicit:

- It sends **only** `zip` / `radiusMiles` / `type`, never a service location,
  branch, date, health selection or evidence excerpt, and the ZIP is not
  persisted to the browser-local record, a cookie, an account or application
  logs.
- The lookup is submitted through a Server Action that returns the directory view
  as action state (no redirect), so the ZIP travels in the request **body** and is
  never a query value: it does not reach the page URL, browser history, or a
  copied link (audit A01, 2026-10-12).
- It is a **public-directory lookup**: results are public data, not veteran PII.
  It is gated by `VA_ACCREDITED_REP_ENABLED` behind the shared `VA_API_ENABLED`
  fail-closed boundary, it is rate-limited, its results are cached under a key
  hashed from the lookup parameters (the raw ZIP is not the cache key), and it
  falls back to a clearly labelled local view when the integration is off.
- The ZIP still reaches the upstream directory and can appear in that provider's
  access logs. That exposure is unchanged from the secondary track's identical
  finder, it carries no veteran context, and the privacy page states it.

### Evidence and its limits

- Focused suites: `tests/presumptive-browser-local.test.ts` (record bounds,
  fail-safe reads, the surviving validation taxonomy, and “no server transport
  left” / “keeps the confirmed history out of every URL” over the track's client
  modules), `tests/retired-presumptive-cookie.test.ts` (tombstone contract),
  `tests/browser-local-design-conformance.test.ts` (the three static design
  rules, now covering the presumptive registry and client surface),
  `tests/dd214-presumptive-handoff.test.ts` (parse → adapt → match) and
  `tests/dd214-local-analyzer-cleanup-contract.test.ts` (browser resource
  cleanup).
- **Log:** typecheck, changed-file ESLint and the focused suites (106 tests / 13 files) are recorded in
  `tmp/security-audit-2026-10-07/priv01-presumptive-browser-local/`
  ([tests](../tmp/security-audit-2026-10-07/priv01-presumptive-browser-local/tests.log),
  [typecheck](../tmp/security-audit-2026-10-07/priv01-presumptive-browser-local/typecheck.log),
  [lint](../tmp/security-audit-2026-10-07/priv01-presumptive-browser-local/lint.log)).
- **Limit — no sentinel pass for this track yet.** The stage-4 browser sentinel
  walks the secondary workflow and the shared surfaces (proxy, refusal layer,
  public pages); it does not open the presumptive pages or seed this record, and
  `scripts/priv01-sentinel-scope.mjs` does not match `src/lib/presumptive/` or
  `src/components/presumptive/`. A green sentinel run is therefore **not**
  evidence about this track, and a presumptive pass in the walk remains
  outstanding. What is claimed here is the source-level and unit evidence above.

## CI enforcement (2026-10-08)

Stage 4 was a maintainer-run gate; it is now enforced. In
[ci.yml](../.github/workflows/ci.yml) it is a job of its own, `priv01_sentinel`,
whose step **Run PRIV-01 stage-4 browser sentinel** starts a dev server on its
own port, waits for `/api/health`, points `SENTINEL_APP_BASE` and
`SENTINEL_SERVER_LOG` at that server, and runs
[acceptance-browser-sentinel.mjs](../scripts/acceptance-browser-sentinel.mjs)
with the runner's Chrome. A missing browser, an unhealthy server, or a failed
walk fails the gate — it never degrades to a skip, because a green run has to
mean the walk actually happened.

It is required, and it has its own time budget. The walk is the workflow's
slowest and most environment-dependent gate, so as a step on `verify`'s clock it
could spend the budget every other gate needed, and `verify`'s ceiling could
truncate it into an opaque job cancellation. Now the job carries its own ceiling
and the walk has a smaller step budget inside it, and enforcement stays on the
single required context branch protection already watches: `verify` needs this
job, runs with `if: always()` — without which a failed sentinel job would *skip*
the required context rather than fail it — and its aggregator fails when the
job failed, when it was cancelled, or when the scope job did not succeed.

Pull requests are selected by their change set through
[priv01-sentinel-scope.mjs](../scripts/priv01-sentinel-scope.mjs): the
workflow's routes, step components and browser-local state, the evidence/OCR
pipeline and its self-hosted tesseract assets, the client corpus, the
private-context refusal layer, the proxy, the COOP/COEP configuration, the
runner itself, and the contract suites that encode the same invariant.
Detection fails closed — an unreadable change set runs the gate rather than
skipping it — and every non-PR event (push to main, manual dispatch) runs it
unconditionally, because that is where the contract has to hold. The filter is a
job (`priv01_scope`) rather than a workflow-level `paths:` filter on purpose: a
workflow skipped that way leaves its required checks waiting forever, so the
filtering has to happen inside a run that always starts.
[priv01-sentinel-gate-wiring.test.ts](../tests/priv01-sentinel-gate-wiring.test.ts)
walks those directories on disk, so a new privacy-bearing module cannot land
outside the gate's scope, and pins the wiring above.

**Repeatable entrypoint (2026-10-08).** The walk is also runnable unattended
through one command, `npm run acceptance:sentinel`
([run-acceptance-sentinel.mjs](../scripts/run-acceptance-sentinel.mjs)), which
owns the app server the walk needs: it resolves the browser, starts a dev server
on its own port, waits for `/api/health`, runs the walk pointed at that server's
log, stops the server on every path (success, failure, thrown error, or
SIGINT/SIGTERM), and exits non-zero on any regression. It requires **two
independent signals** — the walk's exit code *and* the evidence report it wrote
— so a zero exit with a report that records failures, records a runner error, or
does not exist is also a failure; a run that cannot be verified is not a pass.
`--dry-run` resolves and prints the plan without starting anything, and
`--base <url>` drives an app that is already running. The plan resolution,
fail-before-the-walk behaviour, teardown and evidence cross-check are pinned by
[acceptance-sentinel-harness.test.ts](../tests/acceptance-sentinel-harness.test.ts)
(24 cases). CI exposes the same command as the opt-in **`sentinel-acceptance`**
job (manual dispatch with `sentinel_acceptance=true`, evidence uploaded as an
artifact). That job is deliberately **not** in the `verify` job's aggregator, so
the required merge gate below is unchanged.

**First CI run (PR #522, 2026-10-08): green.** Scope detection answered
`changed=true (6 in-scope file(s))`, and the walk completed on the runner —
**PASSED, 45/45 assertions**, run token `6c81355a` — so this gate is now
observed green in CI, and its log, server log and evidence report ride that
run's diagnostics artifact. It stayed green on the branch's next run too, which
re-ran the walk because the write-rule correction below touches the guard: 45/45
again, token `bf16408a`, with the pre-existing browser journeys also green. The page-side OCR leg that stops the walk on the
audit host (five of five local attempts, including one on 2026-10-08 that stopped
at the same wait, the 240-second "Local OCR completed
for" wait expiring on `CDP Runtime.evaluate` timeouts while the tesseract
workers ran; tokens `34d6f3e0` and `40387030`, both `runner-error`, recorded in
the [rehearsal record](../tmp/security-audit-2026-10-07/priv01-request-guard/ci-rehearsal/README.md))
is therefore an environment condition on that host, not a gate defect — the
2026-10-07 stage-4 runs completed there too (tokens `7e6f1861` at 45/45 and
`0f953e99` at 20/20), and the refusal layer's earlier recheck carried token
`6d648b47`.

**Stage-4 strengthening pass (PR #522, 2026-10-08): green, 46/46.** Two harness
defects surfaced on the runner after the write-rule correction, neither a
privacy finding. A re-run walk **passed 45/45** (token `7dead152`) and the step
still failed: removing the temporary Chrome profile raced Chrome's shutdown
flush and threw `ENOTEMPTY`, so the cleanup now retries and is best-effort — a
leftover temp profile is not a result and cannot decide the gate. A later run
then stopped at the seeded Step 5→6 navigation when a single click on the Next
`<Link>` was swallowed with no navigation and no error (token `aedc9da4`,
`runner-error`); the seeded wait now asserts the CTA advertises a uniform,
scope-free URL — `/secondary/evidence?regSnapshot=<public snapshot id>`, no
sentinel — clicks the real link, and if the route has not changed after a grace
period follows that same advertised href. The route and every privacy
assertion are unchanged; only the navigation trigger is deterministic. The run
on head `c3891104` completed **PASSED, 46/46 assertions**, run token
`9288ea04`, zero violations, with the pre-existing browser journeys green.

The same pass adds the source-level half of the contract in
[browser-local-design-conformance.test.ts](../tests/browser-local-design-conformance.test.ts):
it fails when a step page or client module starts reading context outside the
sanctioned record (storage, cookies, or a query value other than the two public
ones), when a browser storage key appears without clear-all registration, or
when a client fetcher builds a selection-derived request. Each rule was
negative-controlled with a deliberate violation before landing, and the design
record lists it in its enforcement table.

The same first run failed the job on the *pre-existing* browser E2E step, not
on this gate — and that failure was real: the guard's write rule refused the
public accredited-representative action on Step 5, so the locator search never
redirected and the page fell to its error boundary. The rule is now narrowed to
workflow step pages that host no public action, with that action's two pages
exempt by name and the exemption pinned to the finder's own wiring; body-carried
context stays out of scope as before, because the edge proxy does not read
bodies.

## Dev-trace source repair (2026-10-10)

CI run `38016379181` on PR #522 reached **45/46** assertions: the trace-file
surface was unexercised because the walk read `.next/trace`, while Next 16's
dev server writes `.next/dev/trace`. A workstation build trace at the old path
could also conceal this mistake. The walk now reads only the development trace,
with no fallback to build output. Missing or empty server logs and traces fail
the full-scan assertion; neither surface receives a non-exercise exemption.
The existing 4,000,000-character scan cap and all privacy assertions remain.

[The text-surface helper](../scripts/lib/sentinel-text-surfaces.mjs) and
[its regression suite](../tests/sentinel-text-surfaces.test.ts) cover dev-only
checkouts, a stale clean build beside a sentinel-bearing dev trace, missing and
empty traces, unreadable files, rotation, and the scan cap. Both are included in
the sentinel's CI trigger scope. The five focused suites passed **82 tests**.

A full local Node 22 / headless Chrome run completed **46/46** assertions,
run token `5b3a2ce6`, with zero violations: 96 requests, 96 responses, 90 response
bodies, 2,529 server-log characters and 1,010,984 dev-trace characters scanned.
Evidence: [report](../tmp/acceptance-sentinel/trace-fix-evidence.json),
[walk log](../tmp/acceptance-sentinel/trace-fix-walk.log), and
[driven server log](../tmp/acceptance-sentinel/trace-fix-dev.log).
This is local verification, not a new GitHub CI pass, and the walk still does
not cover the presumptive track described above.

## Non-goals

- No medical content, mapping, or verification-status changes.
- No change to what the server may publish as public authored content.
- This contract does not by itself authorize production VA account use or
  Section 508 conformance claims (see COMP-01).
