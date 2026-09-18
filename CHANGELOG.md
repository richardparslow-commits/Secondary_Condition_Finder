# Changelog

All notable changes to Secondary Condition Finder. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); merges are grouped by date, newest first.

## 2026-09-18

- **One place answers what this deployment gives up** (`refactor`): four controls depend on
  process-local state, and each behaves differently once more than one process serves traffic —
  live VA access and the VA reference cache **refuse** to run, rate limiting and the VA circuit
  breaker keep running **weaker** than written. Each used to answer that question only inside its
  own file, so `/api/health` could show a hit/miss counter frozen at zero, or a circuit reported
  closed, with nothing saying either reading was structurally uninformative. The circuit breaker
  in particular was never surfaced anywhere: it is deliberately **not** gated on the runtime
  classification, because an absent breaker is worse than a per-instance one, which makes it the
  control most likely to be misread — `getCircuitSnapshot()` reports only the instance that
  answered, so a closed circuit there does not mean upstream is healthy.
  `src/lib/runtime-capabilities.ts` now owns the aggregate — `runtimeCapabilities(env)` returns
  `{distributed, capabilities, summary}`, each capability declaring
  `{id, label, behavior, full, scope, detail, sources}` with a `detail` that states the
  consequence rather than the label. `/api/health` exposes it as `components.runtime`, and takes
  the `scope`/`detail` for `components.vaReferenceCache` and `components.rateLimit` from that
  report instead of re-deriving them, so a health field cannot disagree with the control it
  describes.

  The "a future control cannot hide" property is enforced rather than intended: each capability
  declares `sources` — the modules that consult the runtime fact on its behalf — and
  `tests/runtime-capabilities.test.ts` walks `src/` for those call sites and fails in both
  directions, where an unregistered consumer reports nothing and a claimed source that no longer
  consults the fact is a stale claim. Mutation-verified: adding a module that consults the fact
  without registering fails with that file named, and repointing a claim at a real module that
  does not consult it fails as stale (which also surfaces the now-unaccounted control). `full` is
  `!isDistributedRuntime(env)` for all four today, asserted on purpose so a future capability that
  stays full while distributed has to change the claim deliberately. Suite: 237 files / 1454
  tests.

- **The VA cache control plane stops reporting success it never had** (`fix`): the process-local VA
  reference cache refuses to operate in production and distributed runtimes, which is the intended
  fail-closed behaviour — but nothing said so. `/api/health` reported `hits`/`misses` that are
  structurally frozen at zero, and `POST /api/admin/cache-clear` answered `{ ok: true, cleared: 0 }`,
  which is byte-identical to what a working but cold cache returns. Both now report a `scope`.
  `vaReferenceCacheScope(env)` returns `{scope, detail}` and takes its verdict from the *same*
  `vaProcessLocalStateAllowed()` predicate that gates reads and writes rather than re-deriving it,
  because a status endpoint that computes its own answer can be right while the thing it describes
  is wrong — which is precisely how the cache came to look healthy while unable to store anything.
  `/api/health` exposes it as `components.vaReferenceCache.scope`, and the cache-clear endpoint
  returns it beside a message stating that a disabled cache cleared nothing, with the audit entry
  tagged `cacheScope` so the trail separates "nothing to clear" from "cannot hold anything here".
  The HTTP status stays `200` deliberately: the request was authorized and handled, and the
  disclosure belongs in the body rather than in a status code that existing cron automation would
  read as a failure. The shape matches the rate-limit report added above, so `/api/health` answers
  "what regime is this process in?" the same way for both. Mutation-verified: forcing
  `vaReferenceCacheScope` to report `process-local` unconditionally fails five tests across the
  module, the health endpoint, and the admin endpoint; reverting cache-clear to its bare response
  fails two more. `tests/va-cache-scope-reporting.test.ts`. Suite: 236 files / 1443 tests.

- **One owner for the runtime fact, two policies stated instead of implied** (`refactor`/`fix`): the VA
  reference cache failed closed on process-local state in production while the rate limiter kept
  per-instance buckets and called that intentional. Both verdicts are defensible — but each module
  held its **own private copy of the runtime detection**, so the two could disagree about the
  underlying *fact* while each looked locally reasonable, and editing one copy broke nothing. The
  fact now has a single owner in `src/lib/runtime-deployment.ts` (`isDistributedRuntime`,
  `DISTRIBUTED_RUNTIME_MARKERS`, `RuntimeEnvironment`); `vaProcessLocalStateAllowed(env)` is
  `!isDistributedRuntime(env)`, keeping the fail-closed policy (a per-instance cache can serve the
  wrong environment's data, and a per-instance outbound budget can permit N× the intended traffic
  against VA), while `rate-limiter.ts` now states its opposite policy explicitly and publishes what
  it means for operators — `rateLimitScope()` reports `per-instance` vs `single-process` and is
  surfaced as `components.rateLimit` on `/api/health`, so the instance-count multiplier is readable
  instead of buried in a comment. That module deliberately carries no `server-only` marker, because
  `proxy.ts` runs in the middleware runtime and needs the classification there.

  Separately, the shared `"unknown"` bucket is gone. `resolveClientKey` returns `{key, source}` with
  `key: null` when a request carries neither `X-Forwarded-For` nor `X-Real-IP` (the latter added for
  nginx-style proxies), and the proxy then applies **no** per-client limit. The old fallback was not
  a per-client limit at all: every unattributed client drew from one bucket, so the configured
  per-IP allowance silently became a *global* cap that a single client could exhaust on everyone
  else's behalf — and nothing in a response, a log line, or a metric revealed that the control had
  changed meaning. Capacity is the edge WAF's job, which is why an absent limiter is preferred over
  a mislabelled one. Both halves were mutation-checked rather than assumed: restoring the
  `?? "unknown"` fallback fails the new proxy test with `unattributed POST 31: expected 429 not to be
  429`, and reintroducing a private `NODE_ENV` check in `va/runtime-state.ts` fails both the new
  cross-module parity assertion and the pre-existing distributed-state boundary tests. Suite: 235
  files / 1434 tests.

- **Route → rate-limit mapping is now data, checked against the real route files** (`refactor`):
  `src/proxy.ts` chose its limiter with three `url.pathname === "…"` comparisons and recorded the
  route list nowhere a machine could check, so a fourth sensitive route would have shipped
  unlimited behind a passing build. The mapping moves into `src/lib/api-route-policies.ts`
  (`API_ROUTE_LIMIT_POLICIES`, `API_ROUTES_WITHOUT_LIMITER`, `compileApiRoutePattern`,
  `findApiRouteLimitPolicy`) and the proxy consults it in a single lookup. Each policy carries its
  own 429 body plus a recorded rationale, and matching is anchored exact-match with `[param]` for
  exactly one path segment — one exported implementation shared by the proxy and the test, so the
  two cannot drift apart. `tests/api-route-rate-limit-coverage.test.ts` (16 tests) derives the real
  routes from `src/app/api/**/route.ts`, reading both the directory pattern and each route's
  exported handler methods off disk, then fails when a route is neither policed nor explicitly
  exempt, when a policy names a route that no longer exists, when two policies could both match one
  request, or when the proxy stops consulting the registry. Both directions were confirmed
  non-vacuous by deliberate mutation: adding an unclassified `route.ts` failed the coverage
  assertion (naming the offending route), and making the proxy skip the lookup failed four wiring
  tests. Three things are deliberately unchanged. Every 429 status, body, and header is what it was
  — the routes answer 429 with two different shapes, and clients may parse them. The `POST` rule
  stays an inline method-scoped branch because it is not route-scoped: it covers **all** non-`_next`
  POSTs, API POSTs included, so such a request still consumes the workflow-session bucket as well as
  its own route policy. And one honest limit: the registry cannot be *derived* at request time,
  because `proxy.ts` runs in the middleware runtime with no filesystem access — the derivation
  lives in the test, which makes the registry a checked declaration rather than a generated one.
  Suite: 234 files / 1421 tests.

## 2026-09-17

- **Single shared VA reference provenance vocabulary** (`refactor`/`fix`): the label/notice pair each
  public-reference loader shows beside its data now lives once, in
  `src/lib/va/provenance.ts`. Between them the five loaders carried 25 distinct label/notice
  strings, each selected by a hand-written ternary per module, so wording and trust semantics
  were enforced by discipline across five files. `SURFACE_COPY` owns all of it keyed by surface
  (`service-branches`, `forms-finder`, `form-reference`, `disability-reference`,
  `accredited-representatives`); `vaProvenanceCopy`/`vaFallbackCopy` return the pair for views that
  carry no status fields (`ClaimFormReference`), and `vaLiveStatus`/`vaFallbackStatus` return the
  full `VaReferenceSourceStatus` block for the other four. Centralizing exposed a second, subtler
  duplication: environment resolution had **three** implementations — `result.environment ??
  (source === "va-production-api" ? "production" : configured)` in three modules, the raw source
  check in `form-reference`, and the *configured* environment only in `forms-finder`. Worth being
  precise about the impact: those three rules were extensionally **equivalent**, because the adapter
  derives both `environment` and `source` from a single `resolveEnvironment(config)` call, so all
  three expressions agree for every result it can return today. No live mislabelling was fixed.
  What changed is the basis of the agreement — from coincidence to construction. A result reporting
  an environment other than the one requested (a production request downgraded to sandbox, a retry
  routed elsewhere) would have made three modules disagree with each other and the other two
  disagree with all of them, with nothing to catch it.
  `resolveVaResultEnvironment` is now the one rule, preferring the result over configuration and
  never inventing production, so an under-claiming result is honoured — the fail-safe direction.
  `tests/va-provenance-copy.test.ts`
  (9 tests) reads the table through the module's own API — rather than restating the copy — and
  asserts every surface has distinct production/sandbox wording, that sandbox notices warn the data
  may not be current and fallback notices say the upstream was unavailable or disabled, that
  resolution never promotes a sandbox result to production, and that each loader delegates to the
  shared owner for its own surface. The last check matches a *call site*, not a bare identifier:
  an earlier version of it passed on the import line alone when the resolver was swapped out, which
  a deliberate mutation caught. Suite: 233 files / 1405 tests.

- **Single shared VA reference cache protocol** (`refactor`/`fix`): extracts
  `withVaReferenceCache` into `src/lib/va/reference-cache-access.ts` and migrates all five
  public-reference loaders (`service-branches`, `forms-finder`, `form-reference`,
  `disability-reference`, `accredited-representatives`) onto it, collapsing five hand-rolled
  copies of the process-local → shared → promote → write-both sequence into one. `cacheable` is
  now a required field on the loader result, so the previously unstated "never cache a local
  fallback" rule is enforced by the type system instead of by each copy remembering to return
  early before the write. Key namespaces move from string literals in each loader to one registry
  (`VA_REFERENCE_NAMESPACES`) with `clearVaReferenceNamespace(ns)`. This fixes a real collision:
  `clearVaFormsFinderCache()` cleared the `"forms:"` prefix, which also matched
  `form-reference`'s `forms:reference:` keys, so one module silently evicted another's cache — and
  `form-reference` had grown no clear function of its own because it appeared to work by accident.
  Keys are now `forms-finder:{env}:{query}` and `forms-reference:{env}`, and `form-reference.ts`
  gains `clearClaimFormReferenceCache()` for parity with its four siblings.
  `tests/va-reference-cache-namespace.test.ts` (10 tests) pins namespace disjointness, per-owner
  clearing in both directions, clear-function parity across all five modules, and the
  `withVaReferenceCache` contract (hit decoration, miss caching, fallback never cached, shared-hit
  promotion into the process-local tier, `enabled: false` bypass). The source-text pin in
  `tests/va-reference-product-surface.test.ts` that asserted each loader called
  `readVaReferenceCache<…View>` is replaced by an architecture pin asserting every loader goes
  through the shared entry point and none reaches into the cache tiers directly. Suite: 231 files /
  1385 tests.

- **Bounded VA response bodies** (`fix`/`harden`): the VA adapter now reads every upstream body
  through a size bound, matching the limit the regulatory HTTP stack already enforced.
  `requestVaJson` previously called `await response.json()`, so `src/lib/va/sandbox.ts` — the
  outbound family behind the public `force-dynamic` pages — had no body-size limit at all, while
  `regulatory/preflight/http.ts` bounded its bodies at 25 MB (12 MB for Federal Register). The
  bound now lives once, in the new `src/lib/bounded-response.ts`, and both stacks consume it: a
  declared over-cap `content-length` is rejected before the body is read, and the stream is
  accumulated with a running total so an under-declaring upstream is still stopped mid-read via
  `reader.cancel("response-size-limit")`. A breach maps to the new terminal `response-too-large`
  outcome — recorded in latency/error metrics, logged, counted as a circuit failure, and returned
  as a `local-fallback` result with **no retry**, so a hostile upstream cannot be amplified with
  exponential backoff. Request query params (which can carry a user-supplied search value, such as
  a zip) are kept out of both the error message and the observation, matching the adapter's
  existing `pathname`-only logging. `tests/bounded-response.test.ts` (10 tests) covers both
  rejection branches, the at-the-cap boundary, multi-chunk reassembly, the no-stream `text()`
  fallback, and that malformed JSON still surfaces as `SyntaxError`;
  `tests/va-sandbox-public-reference.test.ts` gains an end-to-end case asserting the fallback, the
  `response-too-large` observation, exactly one fetch attempt, and no query-string or API-key
  leakage. Suite: 232 files / 1396 tests.

## 2026-09-14 (later)

- **Standalone `/get-records` page + README screenshot** (`feat`/`docs`) Adds
  `/get-records`, a standalone route outside the numbered workflow that reuses the
  `VaGovRecordWalkthrough` component with its own explicit no-credential boundary copy and
  onward links into the secondary workflow and privacy policy; linked from the home page's
  utility nav and a new utility-section card. `tests/get-records-page.test.ts` (2 tests) pins
  the shared-component composition, boundary phrasing, no-fetch/no-password surfaces, and home
  wiring. Adds `scripts/capture-va-gov-walkthrough-screens.mjs` (maintainer-gate utility):
  starts a dev server + headless Chrome, seals a dev-only workflow cookie, and captures the
  walkthrough card over the DevTools Protocol (CDP clip coordinates are CSS px with
  independent `scale` — combining it with `deviceScaleFactor` double-scales); the regenerated
  `docs/assets/va-gov-walkthrough.png` is embedded in the README. Suite: 230 files / 1375
  tests.

## 2026-09-14

- **Guided VA.gov medical-records download walkthrough (Step 4)** (`feat`) Adds a
  `VaGovRecordWalkthrough` research aid at the top of the Step 4 documents page, mirroring the real
  VA.gov sign-in → ID.me (email, password, MFA, SMS code) → My VA → My Health → Medical records →
  Download (All time / Select all VA records / PDF / Download report) flow as a 14-step checklist
  with deep links that open VA.gov in a new tab. Authored steps live in
  `src/lib/secondary-workflow/va-gov-record-walkthrough.ts`; progress checkmarks persist in a new
  tab-scoped `sessionStorage` store (`secondary-condition-finder:va-gov-record-walkthrough:v1`)
  registered in `local-state.ts` so Finish Review / Start a new review clear it, with a
  browser-only text export. The aid never collects, transmits, or stores VA.gov/ID.me credentials,
  MFA codes, or session data — sign-in happens entirely on VA.gov, and ID.me steps are described
  without hard-coded links (their URLs carry session/event identifiers). Privacy policy, retention
  list, functional spec, and technical spec updated for the fourth store. Contract-pinned by
  `tests/va-gov-record-walkthrough.test.ts` (7 tests: step fidelity + URL fragments,
  no-credential/no-egress boundaries, registry registration, page wiring, text export, disclaimer);
  completion-privacy and research-aids registry pins updated to four stores. Follow-up: the MFA step
  now carries an alternate-method note (authenticator app / push / security key / passkey / PIV-CAC)
  and the download step a "can't find the file" note (browser Downloads/Desktop) — both rendered as
  small-print `note` fields, not new steps; SSR render of `/secondary/upload` with a sealed v2
  workflow cookie verified all 14 steps, 8 deep links, notes, counter, and the local analyzer below.
  Suite: 229 files / 1373 tests.

- **Walkthrough follow-ups — E2E journey, README, copy tune** (`test`/`docs`) Extends
  `e2e/secondary-workflow.mjs` to cover the aid on Step 4: heading + counter + boundary callout +
  alternate-MFA note assertions, a count of ≥8 `https://www.va.gov` deep links, step-1 progress
  written to `secondary-condition-finder:va-gov-record-walkthrough:v1` via hydrated onChange (same
  retry pattern as the pathway checklist), and Start-a-new-review clearing of the walkthrough store
  alongside the pathway store; final journey log names the aid. README adds the guided-download
  blurb (real-flow context, deep links, no-credential boundary, tab-scoped progress). Component
  copy split into two paragraphs with `space-y-4` step spacing. Suite: 229 files / 1373 tests
  (e2e journey itself runs in CI with Chrome/ChromeDriver).

## 2026-09-12 (later still)

- **Sixth audit report — session-write failure contracts pinned** (`test`) Adds
  `tests/session-write-failure-contract.test.ts` (4 tests): behavioral pins (mocked session
  module) that a rejected `writeSecondaryWorkflowSession` in `saveDiagnosedSelection` and
  `saveRatingsSelection` holds the user on the step via validation redirect (never resolves
  forward), emits a failure `auditLog`, and that a successful write advances with a success audit;
  plus a structural pin that all 6 write sites in `secondary.ts` remain guarded and the `#386`
  remediation comment (`#5 do not silently lose data`) stays in place. The report's headline
  scenario (missing production secret) throws at write time and lands in exactly these catch
  blocks — fail-fast secret handling was already pinned in `secret-fallback-contract` and
  `deployment-readiness`. Suite: 215 files / 1151 tests.

- **Fifth audit report — size-limit cleanup path pinned** (`test`) Adds
  `tests/evidence-pdf-size-limit-cleanup.test.ts` (3 tests): when `assertExtractedTextSize`
  throws mid-loop (PDF exceeds the `textChars` budget), the per-page `finally` releases the
  in-flight page **before** the error propagates, every earlier page cleaned in its own
  iteration (3 pages → 3 cleanups), and the outer `finally` destroys the loading task. The
  report's claim of "fragile" cleanup was already-structured-correct in `extractPdfEvidence`
  (the assertion sits inside the per-page try, so cleanup order is guaranteed by construction);
  the size-limit path was the one scenario the #407 contract didn't pin — now it is. Suite:
  214 files / 1147 tests.

- **#420 — Phase 4 item D closed + presumptive-track E2E journey** (`test`) Adds
  `e2e/presumptive-workflow.mjs`, the presumptive track's first real-browser journey:
  home → intake → Agent Orange quick-start template pre-fill (controlled-checkbox clicks + date
  fields) → submit → results (category, confirmed-date window, not-an-eligibility-decision
  notice) → the Phase 4 item C cross-link panel (heading, mapping sentence, secondary-track link)
  → cross-track navigation to the clean secondary entry route. Harness mirrors
  `secondary-workflow.mjs` (sessions via `POST /session`; uses `execute/sync` for input reads —
  local chromedriver does not implement the W3C `property` endpoint). Item D (DD-214 →
  presumptive prefill) verified one-click and pinned by `tests/dd214-presumptive-handoff.test.ts`
  (4 contracts: field extraction with SSN redaction, adapter draft validity, locations-override
  path, full match through to the Agent Orange category). `verify-checklist.sh --full` now runs
  all three journeys. Suite: 213 files / 1144 tests.

- **Phase 4 item C — Presumptive × secondary research-cue panel** (`feat`) On
  `/presumptive/results`, matched presumptive conditions that also appear as published KB
  secondary targets render a research-cue panel: the condition, the published primaries that map
  to it, and a link to the secondary track's clean entry route. Built entirely at the app layer
  (`src/app/presumptive/results/secondary-cross-link.ts` + page wiring) — the TRACK-SEPARATION
  composition rules bind only `src/lib/secondary-workflow/` and `src/lib/presumptive/`, so no rule
  changes were needed. New `secondaryTargetIndex` KB lookup (display-only, draft-excluded, never
  fed into `recommend()`); no session state crosses the track boundary. Real-data intersection:
  11 of 48 presumptive conditions carry secondary pathways (hypertension, asthma, COPD, CAD, …).
  Tests: `tests/secondary-cross-link.test.ts` (7) and
  `tests/track-separation-cross-link-contract.test.ts` (4) — the latter names the composition
  rules so a refactor cannot quietly weaken the boundary the panel depends on. Suite: 212 files /
  1140 tests.

- **Phase 4 item B — Unified consultation packet** (`feat`) Adds `ConsultationPacketDownload` on
  the Step 6 evidence page: one printable text download concatenating the existing privacy-stripped
  exports (claim summary, ranked suggestions, pathway record checklists, action plan, rating guide)
  behind a section table of contents — all `format*` helpers reused, no new content composition and
  no new data collection. Contract-pinned by `tests/consultation-packet.test.ts` (5 tests): packet
  composition, TOC ordering, and privacy exclusions (no condition selections, ratings, or evidence
  text beyond what the existing exports already carry). Suite: 210 files / 1129 tests.

## 2026-09-12

- **#417 — Symptom-bridge expansion (Phase 4 item A)** (`feat`) Adds 8 controlled symptom entries
  to `SYMPTOM_BRIDGE_ENTRIES` (8 → 16): chronic widespread pain (fibromyalgia), ringing in ears
  (tinnitus, hearing-loss), heartburn/reflux (gerd, esophagitis), stomach pain (gastritis), bowel
  changes (irritable-bowel-syndrome), low back pain (lumbar-strain, lumbar-spinal-stenosis,
  intervertebral-disc-syndrome), neck pain with arm numbness (cervical-strain,
  carpal-tunnel-syndrome), weight/temperature change (hyperthyroidism, hypothyroidism), pelvic
  pain (chronic-pelvic-pain-syndrome). Every `discussionConditionIds` entry verified to exist in
  the catalog (25 unique references, zero missing); all prompts keep the established
  non-determination voice. Data-only change: no schema, UI, or egress surface touched; the Step 4
  checkbox grid renders 16 entries within the existing layout. Suite: 209 files / 1124 tests.

## 2026-09-11 (later)

- **#416 — Secret-fallback contract completed** (`test`) Adds
  `tests/secret-fallback-contract.test.ts` (5 tests): a configured-but-short secret throws in
  production (length and production gates are independent), production can never return the
  dev-only secret (throw precedes fallback), the dev fallback warns outside test/prod (#386
  observability) and stays silent under test. Response to a fourth circulated audit report — the
  fail-fast claim was already implemented and pinned (`deployment-readiness.test.ts`), with the
  report's central "silently used in production" scenario unreachable by construction. Suite: 209
  files / 1124 tests.

- **#415 — Symptom-discussion-panel E2E + session round-trip contract** (`test`) The last backlog
  polish item: the real-browser journey now selects a controlled symptom at Step 4
  (`daytime-sleepiness-snoring`, matching the fixture sleep-apnea pathway) and asserts the vetted
  provider-discussion prompts render on Step 5 (label + prompt text) and follow to Step 6. Adds
  `tests/symptom-session-roundtrip.test.ts` pinning the server chain (seal → open →
  `workflowSessionToQueryParams`). Debugging note: WebDriver `innerText` returns CSS-transformed
  text, so the panel's `uppercase` heading must be matched case-insensitively — the first run
  failed on assertion case, not app behavior. Suite: 208 files / 1119 tests.

- **#414 — Evidence-storage drop-notice contract pinned** (`test`) Adds
  `tests/evidence-storage-drop-notice.test.ts`: behavioral coverage of `serializeStoredEvidenceWithInfo`
  (accurate `dropped` count under byte pressure, oldest-first, empty-store full-drop accounting,
  string/info API parity) + structural pins that `commitAnalysis` surfaces byte-budget eviction as a
  user warning before saving. Response to a third circulated audit report — the fix was already
  shipped in #386 as remediation #3 (HIGH) of the same audit series; only the untested contract
  was closed. Suite: 207 files / 1117 tests.

- **#413 — Backlog closure: #6 confirmed shipped, phase3 Deferred section corrected** (`docs`)
  Investigation for next-phase planning found Idea #6's compliant rule-based surface shipped
  2026-09-05 (`a9120bb`): `SymptomDiscussionReview` renders vetted provider-discussion prompts on
  Steps 5/6, pinned by `tests/symptom-bridge.test.ts`. The 2026-09-09 backlog is therefore fully
  shipped or compliant-shipped (10/10); the phase3-scope Deferred section now records the
  correction, and the only optional polish is E2E coverage of the symptom panel.

- **#411 — DD-214 analyzer cleanup contract + full-surface audit** (`test`) Adds
  `tests/dd214-local-analyzer-cleanup-contract.test.ts` (5 structural pins): both `page.cleanup()`
  sites, both `worker.terminate()` sites, and `task.destroy()` sit in `finally` blocks — the third
  and last browser-local PDF/OCR surface. Component-wide audit also verified all 9
  `createObjectURL` sites are paired with `revokeObjectURL` (timeline viz revokes early on
  failure, delays only post-download). Suite: 206 files / 1110 tests.

- **#410 — OCR cleanup contract pinned** (`test`) Adds
  `tests/local-ocr-cleanup-contract.test.ts`: structural pins for `runLocalOcr()`'s guaranteed
  teardown — per-page `finally` with best-effort `page.cleanup()` (handle pre-initialized to
  `null`), render/recognize failures exiting through the finally via `continue`, and
  `loadingTask.destroy()` + `worker.terminate()` each in their own `finally`. Response to a
  second circulated audit report — investigation found the fix already present (remediated
  against a prior audit finding, `#2` in source); no source change needed. Suite: 205 files /
  1105 tests.

- **#408 — DOCX/text extractor failure-path contracts** (`test`) Adds
  `tests/evidence-docx-text-failure-paths.test.ts`: a Mammoth parser failure after the ZIP
  preflight passes must propagate (no silent "no text"); Mammoth conversion messages surface as
  `DOCX parser:` warnings; an empty DOCX warns; an oversized text body fails closed on the
  character budget after preflight; valid text keeps its `document` locator. Suite: 204 files /
  1101 tests.
- **#407 — PDF page-cleanup regression contract** (`test`) Adds
  `tests/evidence-pdf-page-cleanup.test.ts`: behavioral pinning (mocked pdfjs) that
  `page.cleanup()` runs even when `getTextContent()` throws, `loadingTask.destroy()` runs even
  when `getPage()` fails, and the success path cleans up per page with provenance intact.
  Response to a circulated audit report claiming a leak at `document-extract.ts:199-211` —
  investigation found the finally-wrapped cleanup already in place since `99757d7` (hardened in
  #386), so no source change was needed; only the untested throw-path contract was closed.
  Suite: 203 files / 1096 tests.

## 2026-09-11

- **#400 — Locator E2E coverage + flag-on/missing-key contract + `VA_ACCREDITED_REP_*` env docs**
  (`chore`) Adds the Find Help accredited-representative locator segment to the real-browser E2E
  journey; pins the fail-closed contract (`tests/accredited-representative-locator.test.ts`, 7
  contracts: flag-on + missing key → graceful local fallback before any fetch, circuit breaker
  stays `closed`); documents the `VA_ACCREDITED_REP_*` environment variables in the tech-spec env
  table. Suite grows to 202 files / 1093 tests.
- **#401 — Spec Status pins refreshed** (`docs`) Both specification Status lines updated to the
  post-#400 `main` SHA.
- **#402 — Feature-ideas brainstorm** (`docs`) Adds the 2026-09-09 Agiloop brainstorm output
  (`docs/secondary-feature-ideas-2026-09-09.md`).
- **#403 — Corrected v2 executive specification + unit-clarified KB counts** (`docs`) Adds
  `docs/executive-specification-v2.md` (six-step workflow, Phase 3.1 features, verified constants);
  clarifies units in both spec docs: 363 authored relationships across 813 mapping files (140
  published / 673 draft counted by publication state).
- **#404 — Tech spec v1.6: `build:azure` documented, Status pin refreshed** (`docs`) Conformance
  audit found the `npm run build:azure` standalone-packaging script undocumented; names it on the
  Hosting & CDN line and refreshes the Status pin.
- **#405 — Corrected v2 technical specification** (`docs`) Adds
  `docs/technical-specification-v2.md`, regenerated from the 2026-09-11 conformance audit:
  `/secondary/` route group, verified Server Action inventory, real CSP directives, 33 data files
  across 14 body-system categories, engine result shape, research-aid module locations, CI's
  real-browser E2E gate. Living source of truth remains `docs/technical-specification.md` (v1.6).

### Verification (2026-09-11)

- Full suite: 202 files / 1093 tests green on merged `main`.
- Real-browser E2E journey passed on merged `main` (locator segment included).
- Post-merge prod: `/api/health` 200 healthy (catalog ok, session crypto ok, all three circuit
  breakers `closed`, `vaConfig` fail-closed sandbox); `/runtime-readiness` ready.

## 2026-09-10

- **#399 — Locator fee note + specializations + first locator tests** (`feat`) Completes Idea #8
  spec coverage: 38 U.S.C. § 5904 fee note (no upfront cost; fees only after decision + approved
  fee agreement), optional `specializations` directory field (never fabricated), first test
  coverage for the locator.
- **#398 — Shared evidence-strength badges** (`feat`) Harmonizes the Idea #4 consensus-badge
  signal onto shared color-coded primitives (`consensusTone`, `CONSENSUS_BADGE_CLASS`,
  `consensusLiteratureSentence`) across all suggestion surfaces.
- **#397 — Post-merge spec consistency fixes** (`chore`) Resolves four-way-merge spec drift;
  adds the research-aids integration test.
