# Changelog

All notable changes to Secondary Condition Finder. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); merges are grouped by date, newest first.

## 2026-10-15

- **H-02 gate B (OAuth callback-URL log scrubbing review, #538) is closed on a recorded review of the platform's
  *documented* logging behaviour, with the retained callback request line named and accepted as its residual**
  (`R-04`): the gate's outstanding half had been recorded as a hosting-account fact — "whether the platform scrubs
  `code`/`state` … is a hosting-account fact, not a source fact" — and that was wrong in one direction. The platform
  documents **no** query-parameter scrubbing anywhere: request details in Runtime Logs include the request's *search
  parameters*, a Log Drain carries `proxy.path`, documented as the "request path with query parameters", the only
  drain privacy control documented is IP hiding (Pro/Enterprise), and the one documented query-parameter filter
  (`beforeSend` in Web Analytics) applies to analytics events rather than to runtime logs or drains. The scrubbing
  question is therefore answerable without the account, and the answer is that no scrub exists to configure — only the
  drain, plan-tier, retention and access facts are account-side. The closure is a dated per-sink record in
  `docs/external-manual-gates-status.md`: the sink table, three findings with their dispositions (a documented absence
  of scrubbing, a request line that is logged whether or not the request is answered, and single-use consumption that
  makes a retained code dead on arrival), the owner's accepted residual, the preserved trigger and the reopen
  criterion. What bounds the exposure is **reachability, not scrubbing**: both callback handlers return a fixed 503
  *before reading any parameter* while the sandbox config is absent
  (`src/app/api/auth/callback/route.ts`, `/va-account/oauth/{service}/[operation]`), so no live authorization code can
  exist while the sandbox is opt-in and not armed; `completeAccountLogin` consumes the transaction single-use before
  the token exchange and binds the callback to an HttpOnly transaction cookie; and every callback response is
  `private, no-store` with `Referrer-Policy: no-referrer`. Nothing here claims scrubbing was configured, tested or
  observed, no retention value is established (gate A's residual stands), and *credentialed hosted use* remains the
  trigger that reopens the gate. The closure also repaired the documentation defects the same way gate A's did: the
  register and the code-side inventory no longer call the platform's scrubbing behaviour an account fact; the
  inventory's gate B procedure no longer sends an operator looking for a scrubbing rule that cannot be configured, and
  its outcome menu now admits "retained and named as an accepted residual" beside "remediated"; the retention policy
  states outright that no URL is scrubbed before it is logged, for any request path and not only the callback; and the
  report's H-02 finding carries a dated status that keeps "recorded from published behaviour" separate from "reviewed
  on the account", so the §8 close-out box stays unchecked and H-02 is not marked resolved. The closure set is pinned
  by `tests/oauth-callback-scrubbing-record.test.ts` and by the gate B block of
  `tests/hosting-log-retention-record.test.ts`.
- **H-02 gate A (hosting log retention and access-control review, #537) is closed on a recorded review of the hosting
  platform's published log terms, with the account facts that were not read named and accepted** (`R-04`): the gate's
  operator half needs the hosting account, and no hosting-account credential exists in the repository or on the machine
  where this record was written, so the closure is a dated per-sink record of what the platform *documents* — Runtime
  Logs retain 1 hour (Hobby) / 1 day (Pro) / 3 days (Enterprise) / 30 days with Observability Plus, build logs are
  stored **indefinitely per deployment**, roles decide log access (the Pro `Viewer` role is excluded from observability
  data), and 2FA/SAML can be enforced team-wide — together with an explicit list of the four facts only the account
  could settle (plan tier, Observability Plus, whether a drain exists, role/2FA/SSO state) and the accountable owner's
  dated acceptance of that residual. Nothing here claims an account inspection or a configured retention value. The
  record lives in `docs/external-manual-gates-status.md` (gate A record, register row and completion boundary), with
  the code-side sink inventory in `docs/hosting-log-and-callback-inventory.md`. The closure also exposed and fixed
  three documentation defects: `docs/data-retention-policy.md` published **"30 days hot"** as the retention of the
  platform sink, which is wrong for build logs (indefinite) and for every tier without Observability Plus; the register
  inferred "no drain, therefore only the provider's own logs" from an absent `vercel.json`, but drains are configured
  in the hosting account's dashboard or API and never in that file, so the source tree cannot answer it; and the gate's
  trigger was recorded as "before the production-access submission" when the report's own criterion is "before
  **credentialed hosted use**", which is not armed — the account sandbox is opt-in only
  (`src/lib/va/account/config.ts`) and #287 is closed as not pursued. H-02 is **not** complete: gate B (#538,
  callback-URL scrubbing) stays open with its live platform half unverified, and the report's H-02 close-out box stays
  unchecked. *(Superseded later the same day by the #538 entry above, which closed gate B; H-02's close-out box remains
  unchecked for the reason recorded there.)* No retention value, access control, or scrubbing behaviour is now claimed as verified that was not
  verified, and the reopen criterion is recorded for whichever row a plan, drain, or authentication change makes stale.
- **Issue #518 (citation decay — re-verification required) is closed by a green probe run, and the closure record
  is written down** (`citation-decay`): the issue was opened on 2026-10-05 by a scheduled run that failed with zero
  link rot, drift or staleness, purely because an observability ratchet counted 398 undigested references against a
  pin of 383 — a population no human could move, since the SOP forbids digesting the URLs that made it up. The
  cause was fixed on 2026-10-14 (digest-ineligibility register plus the throttle/coverage policy), but closure is
  automatic and needs a green *run*, and neither run in between produced one: the 2026-10-12 scheduled run was
  cancelled after 20 m 20 s against that run's 20-minute job budget, which `track-decay` could not survive. A
  dispatch of `citation-decay-watch` on `main` at `f5cee6e5` completed the probe in 8 m 29 s and closed the issue
  ([run 38765411435](https://github.com/richardparslow-commits/Secondary_Condition_Finder/actions/runs/38765411435)):
  `status: PASS`, link rot / drift / stale all 0, ceiling usage 0/10, digest-eligible backlog 5 against a pin of 5,
  and 393 of 398 undigested references inside the declared, unexpired digest-ineligible class. Coverage is stated,
  not implied: 40.1% (597 of 1,487 probed URLs), so "no link rot" is a claim about those URLs, not the corpus. The
  closure record and the ten-day delay are written into
  `docs/citation-digest-ineligibility-policy-2026-10-14.md`, with a pointer from the probe-outcome policy. This
  closes no verification decision: no reference was re-verified or digested, and the eligible pin was not lowered.
- **A green citation-decay run now restates the tracking issue instead of closing a stale failure body**
  (`citation-decay`, issue #518): the close half added on 2026-10-14 closed the tracking issue but left the
  body the probe wrote when it failed — the failing metric table, and in #518's case the sentence "is not
  auto-closed" — sitting beside a `completed` state, so the closed record contradicted itself and the
  numbers a reader would check were the failure's, not the run's. `track-decay` now rewrites the body from
  the same report before closing it, with the drift count qualified by its detectability (a bare
  `content drift | 0` reads clean on a dimension no reference in the corpus can be checked on) and probe
  coverage stated, then closes with the same comment as before. Verified end-to-end against a fake `gh` and
  a green report rather than by inspection: pre-fix the run emitted only `issue close 518`, post-fix it
  emits `issue edit 518 --body <green figures>` followed by the close. Pinned by
  `tests/decay-watch-artifact-handoff.test.ts` (27 → 28 cases), and both shell-embedded JS payloads in the
  workflow are syntax-checked with `node --check`.
- **Issue #287 (VA public-reference production transition) is closed as a recorded scope decision — production
  activation is not pursued, not completed** (`va-reference`, governance): the gate's own threshold is five
  operator steps that all require a real VA production grant — the grant itself, installed server-side
  production credentials, a controlled connectivity check performed while application access stays disabled,
  deliberate enablement with a verified shared coordinator, and live `va-production-api` provenance on the
  exact deployed SHA. None of that existed, so none of it could be asserted; the gate closed on the accountable
  owner's decision that the labelled local catalog fallback is the intended steady state, and the closure record
  says so explicitly rather than implying the steps were performed. Nothing about the runtime changed: the
  fail-closed tri-state `disabled`/`sandbox`/`production` resolver, the `VA_PRODUCTION_ACCESS_GRANTED`
  acknowledgement, the controlled-check workflow and CLI, the shared consumer budget and circuit, and the
  operator runbook all remain implemented and inert, and any future activation is a new issue under the same
  threshold. Recorded in `docs/external-manual-gates-status.md` (section, R-04 register row and completion
  boundary), `docs/deployment-readiness.md`, `docs/security-operations.md`, `docs/phase3-submission-checklist.md`,
  `docs/phase3-production-access-package.md`, `docs/phase-plan.md`, `docs/audit-issue-list-ordered-by-priority.md`,
  `docs/va-api-runtime-configuration.md`, `docs/va-account-sandbox.md`, `docs/phase2-sandbox-integration.md`,
  `docs/technical-specification.md` and `VA_Lighthouse_Readiness_Report.md`, and pinned by
  `tests/phase3-production-readiness.test.ts` and `tests/va-reference-product-surface.test.ts`, which now also
  asserts that the activation threshold stays stated for a revived activation.
- **The real-browser gate now checks whether a link is distinguishable without its colour, and that
  rule immediately found one that was not** (`accessibility`, R-05 follow-on, WCAG 1.4.1):
  `e2e/a11y-contrast.mjs` ran exactly one axe rule — `color-contrast` — so every other
  rendering-dependent rule was unmeasured in the shipped build. WCAG 1.4.1's
  `link-in-text-block` is the same kind of rule for the same reason: it needs a layout engine and
  computed colours, so jsdom returns it as `incomplete` (the mechanical skip that already keeps
  `color-contrast` out of the jsdom gate), and a colour-only link could therefore reach a manual
  review unnoticed. The gate now runs
  `runOnly: { type: "rule", values: ["color-contrast", "link-in-text-block"] }` with the blocking bar
  unchanged at critical/serious, and its first run flagged `/secondary` — `presumptive track`, inside
  `div.ui-footer-note` — and two links on `/privacy/request`.

  The failure is real, not stylistic. The link colour `--primary` `#1d4ed8` is **2.66:1** against body
  text `#0f172a`, and **1.12:1** against the `text-gray-600` paragraph one `/privacy/request` link
  sits inside; axe's condition for letting colour alone carry the distinction is 3:1, so a resting
  underline is a Level A requirement here rather than a preference. `src/app/globals.css` now
  underlines links inside text blocks at rest (`p a, li a, dd a, .ui-footer-note a, .ui-callout a,
  .app-shell [role="note"] a`), repeated inside `@media (forced-colors: active)` with `!important`
  because forced colours drop author colours and the underline is the one affordance that survives.
  Button-styled links keep their own `text-decoration: none`, which is why the rule is scoped to text
  blocks instead of to `a` at large: the application's button-as-link affordance carries a painted
  surface that no `p a` type-selector rule should override.

  The same real-browser sweep — Playwright with axe-core 4.14 and the installed Chrome 155 over all
  26 shipped routes, a local instrument rather than a committed gate — found three more findings
  outside jsdom's reach and drove their fixes: axe `region` reported the cross-link strip in
  `src/app/presumptive/layout.tsx`, `src/app/secondary/suggestions/layout.tsx`,
  `src/app/va-forms/layout.tsx` and `src/app/va-reference/layout.tsx` as page content outside any
  landmark on 7 routes, so each is now a labelled `<nav>`; axe `landmark-unique` reported two unnamed
  `<aside>` landmarks per two-column step, so each aside in `src/app/presumptive/page.tsx` and the six
  `src/components/secondary/steps/*Step.tsx` now carries its own `aria-label`; and axe
  `aria-prohibited-attr` reported the workflow-progress strip, whose `aria-label="Workflow progress"`
  sat on a bare `div`, where the generic role prohibits it and the label therefore reached no
  assistive technology — it is now `role="group"`. The sweep also cleared the matrix's emulable half
  across those 26 routes: no axe delta and a visible focus ring under forced-colours emulation, 0
  running animations and no element with a transition or animation duration above 0.15s under
  `prefers-reduced-motion: reduce`, no horizontal overflow at 320 or 640 CSS px, the skip link present
  and targeting the existing `#main-content` on 26/26, and one `main`, one `h1` and a `lang` on every
  route. Every remaining automated `incomplete` colour-contrast node is an `aria-hidden` decorative
  glyph, so automation leaves no unresolved *text* contrast node behind.

  **Measured both ways.** The extended gate, run from an isolated copy of the tree with Chrome 155 and
  chromedriver 155, exits **0**: 26/26 routes recorded, axe violations 0 on every route, 0 problems in
  the per-run route inventory, and 33 degraded notes (the pre-existing 120-step/`distinct=1`
  keyboard-walk note plus the recorded non-blocking `incomplete` rows). Removing **only** the
  stylesheet rule from that same copy makes the gate exit **1** on `/secondary` with
  `[serious] link-in-text-block … @ a[href$="presumptive"]`; the rule was then restored. The full
  suite passes **380 files / 3722 tests**. `tests/a11y-contrast-gate.test.ts` (**7** cases) now pins
  the two-rule list, and `tests/accessibility-ux-reliability.test.ts` (**11 → 12**) pins the underline
  rule, its forced-colours repetition, the button opt-out, the four labelled layout navs, the six
  `role="group"` progress strips, and the requirement that no `aside` in those seven surfaces is
  unnamed.

  What this is not: automated evidence, not human evidence. No tester, session date,
  assistive-technology run, real Windows forced-colours session or real 200% zoom pass exists, the
  committed gate runs `next dev` rather than the production build, and issue #195 remains open with
  every workbook row still `NOT TESTED` — the manual keyboard, NVDA/VoiceOver, zoom/reflow and
  interaction-state checks are unchanged in scope. This widens the automated half of that matrix; it
  does not answer VA's accessibility question.

- **An identity-less request is no longer given a larger allowance than an identified one**
  (`security`, SEC-02b, found while auditing this path): `chargeAdmission` charged the shared admission
  ceiling and then, when a request carried no usable identity, returned that ceiling result as the
  decision — so a request with a junk or absent forwarding header was bounded by the shared ceiling
  (**6000** charges a minute by default) while the *same* request presenting a valid key was bounded by
  that surface's per-client limit (**5–30** a minute as shipped). Declining to be identified was the
  cheapest strategy a caller had, and it drew down the aggregate budget honest requests also pay into.
  Under a declared ingress model it was self-contradictory too: the operator had asserted that every
  request traverses an ingress which writes the header, so such a request is not one of that
  deployment's clients — and the code treated it more generously than a client.

  Where an ingress model is declared, that class is now charged to one shared **class bucket per
  surface, at that surface's own per-client limit** (`unidentified:<limiter>`,
  `UNIDENTIFIED_ADMISSION_KEY_PREFIX`), through the same limiter object that enforces the per-client
  limit — so the class gets exactly what one client gets, and the bound cannot drift from the budget it
  is read off. `refusedBy` gains `unidentified`, the refusal window reports `byBudget.unidentified` (a
  non-zero count means the declared model and the edge disagree), and
  `components.rateLimit.identity.unidentified` reports the policy in force. The class key cannot
  collide with a client key, because `resolveClientKey` returns a key only for a syntactically valid
  IP literal. With no model declared the path is deliberately unchanged — an identity-less request
  cannot then be told apart from an honest client of a deployment whose forwarding headers never
  arrive, and capping that population at one client's allowance is the global-cap defect the old
  shared `"unknown"` bucket represented.

  `tests/rate-limiter.test.ts` (52 cases) pins the class allowance, the per-surface sharing, the
  unchanged unasserted default and the unreachable class key, and `tests/api-route-rate-limit-coverage.test.ts`
  (58) drives the real proxy to refuse the 31st identity-less request under `append` with the ceiling
  untouched; restoring the pre-fix branch fails **4** of the new cases. What this does not fix: the
  ceiling is still charged for every attempt, so an attacker can still draw the aggregate budget down —
  the edge WAF remains the capacity layer for that — no hosted, direct-origin, two-instance or
  cold-start run was performed, and SEC-02 stays open on its store and hosted-acceptance halves.

- **`RATE_LIMIT_TRUSTED_INGRESS` now decides *which hop* of a forwarding header is a client identity
  instead of only reporting that an ingress was claimed** (`security`, SEC-02): the variable was a
  boolean, and enforcement applied one hard-coded rule to every deployment — the **leftmost**
  `X-Forwarded-For` hop. That rule is correct only for an ingress that *sets* the header to the peer
  it observed. An ingress that *appends* the peer to whatever the client sent leaves the client's own
  value leftmost, so rotating it minted a fresh per-client allowance per request (the A2
  discriminator in the
  [SEC-02 hosted acceptance runbook](docs/sec-02-hosted-acceptance-runbook-2026-10-09.md)), and a
  client that pre-seeded `X-Real-IP` could choose which bucket it was charged against.

  The variable now selects a model, and the model decides the hop. `set` (aliases `true`,
  `overwrite`, `platform`) reads the leftmost `X-Forwarded-For` hop with `X-Real-IP` as fallback.
  `append` / `append:N` (N = 1..8) reads hop **N from the right**, which an appender writes *after* —
  never instead of — whatever the client sent, so the client cannot choose or rotate its own bucket
  and `X-Real-IP` is not read at all. An unset, unrecognised or out-of-range value stays
  **unasserted** (the leftmost-hop rule), so a mangled claim can never read as a verified ingress,
  and a request under `append:N` carrying fewer than N hops did not traverse every declared appender
  and is unattributed — charged to the surface's shared bucket for identity-less requests rather than
  to a hop the client sent (the allowance that class received, and the inversion it created, are the
  entry above). The model's own limits are
  published with it: a single hop is indistinguishable from a request that never traversed the
  ingress, and declaring more appenders than exist turns a client-padded hop into the one that is
  read — so the claim is still only as good as origin protection and an exact appender count.

  `/api/health` reports it rather than assuming it: `components.rateLimit.identity` carries `model`,
  `header`, `hop` (`leftmost` | `nth-from-right` | `none`), `hopsFromRight` and `fallback` beside the
  existing `trustedIngress`/`identity`/`variable`/`detail` fields, so an operator can compare the hop
  the code says it reads against what their ingress actually writes. `tests/rate-limiter.test.ts`
  (47 cases) pins each model's hop rule — client-padded and blank entries, `X-Real-IP` never read
  under `append`, the single-hop caveat as a stated contract, the whole claim grammar, and the
  unasserted fallback — and a new `declared ingress model (SEC-02)` group in
  `tests/api-route-rate-limit-coverage.test.ts` (57 cases) drives the real proxy for the two
  discriminating cases, both falsified by removing the claim from the proxy call. Nothing here is
  edge evidence: no hosted, direct-origin, two-instance or cold-start run was performed, and the
  counters remain process-local, so no deployment-wide quota is claimed and SEC-02 stays open on its
  store and hosted-acceptance halves.

- **An inbound rate-limit refusal now says which budget refused, without telling the client**
  (`security`/`observability`, SEC-02): `chargeAdmission` has always known whether the shared
  admission ceiling or the client's own per-client bucket refused, and the `429` body has always
  deliberately not said so — a single refusal must not tell a prober which budget it hit. The
  consequence was the gap the deployment-readiness note recorded: ceiling saturation was not
  directly alertable, so a 429 count could not be treated as a capacity signal.

  `src/lib/observability/refusal-window.ts` keeps the last fifteen minutes of inbound refusals — at
  most 256 retained events and 12 reported surface rows — and `/api/health` reports them as
  `components.rateLimit.refusals`, forwarded from the capability report rather than re-derived by
  the route. `src/proxy.ts` records each refusal against the surface that made it: `method-post`,
  `reference-read`, or the matched route policy's path (for example `/api/health`). `byBudget`
  (`ceiling`, `perClient`) with `ceilingShare` is the reading this exists for: a rising ceiling share
  is aggregate pressure — many different clients refused inside one window — while per-client
  refusals are individual clients at their own limit.

  The row it retains is a bounded surface label and the budget **only**, never the client key, so no
  address can reach the public health payload even though a client address is what the limiter
  bucketed on. Its limits are published with it: the window is per instance, forgets rows on cold
  start, and never sees a refusal the edge WAF answered itself, so a zero is not "no refusals
  anywhere". `tests/admission-refusal-window.test.ts` pins all of it in 14 cases — the two-budget
  split and `ceilingShare`, expiry, the retention cap, the reporting cap, caller-bounding of the
  surface label and the budget, a malformed fact never throwing, an assertion that a refusal's
  serialized form carries no address, three cases driving the real proxy, the health forwarding case,
  and two wiring pins — with five of them failing when the proxy's record call is removed. Nothing
  hosted is claimed: the counters remain process-local and SEC-02 stays open on its store and
  hosted-acceptance halves.

- **A Content-Security-Policy regression is now an operator-readable fact on `/api/health`, not only
  a line in a visitor's browser console** (`security`/`observability`, R-05 follow-on):
  `/api/csp-report` already redacted every browser violation report to a bounded, content-free event
  and counted it as an OTel metric — and OTel here is a no-op without a collector, so in the deployed
  application the *entire* observable for a policy regression was a console message on someone
  else's machine. A deploy that starts blocking something (a new inline style under `style-src-attr
  'none'`, a Trusted-Types script sink, an origin dropped from `connect-src`) was, from the
  application's own surfaces, indistinguishable from a clean one.

  `src/lib/observability/csp-violation-window.ts` keeps the last fifteen minutes of redacted
  violations per directive, and `/api/health` reports them as `components.cspReports`: `received`,
  `oversized`, `evicted`, `since`, `lastReceivedAt`, a most-reported-first `directives` list capped
  at twelve rows, and a fixed `detail` sentence. The intake hands the window the bounded
  directive/disposition pair only — **no document URL, blocked URL, source file, or sample has a
  field to travel in** — so the public health payload can name *what* is being blocked without ever
  carrying page content; `tests/csp-violation-health-report.test.ts` plants a real path, query,
  blocked origin, chunk name, and sample and asserts none of them appears in the serialized body
  (also verified against a production `next start` build: two violations and an oversized payload
  posted with `curl`, then read back from `/api/health`). Retention is bounded twice — a rolling
  window plus a 128-event cap whose overflow is counted as `evicted` — so an unauthenticated report
  endpoint cannot grow the process, and both oversized paths (declared length, streaming overrun)
  now record through one helper instead of two inline copies that could drift apart.

  It is a report, never a health failure: the readiness verdict stays exactly catalog + sessionCrypto
  + workflowSession + kbGraph, because a blocked inline style means one page rendered under an
  unintended policy, not that the deployment cannot serve — making it a `503` would take the site
  down over a policy finding. `scope: "process-local"` and the `detail` sentence say so, so a zero
  is not misread as "no violations anywhere". Caught during its own verification: the first draft of
  the structural test scanned the module's prose for the word `sample` and failed on the sentence
  that *documents the absent field* — the assertions now strip comments before scanning, which is
  the convention `tests/logging-sink-inventory.test.ts` already uses.

- **Each route-covering run now publishes a route inventory report — every route's declared surfaces
  against the evidence that run actually recorded** (`assurance`, R-05): `scripts/lib/public-routes.mjs`
  had made the route set machine-checked, so a page could no longer ship without a visible decision
  about which surfaces cover it. What nothing could see was the next failure shape: a gate keeping its
  declaration while quietly stopping evidence. A route the loop skipped, a `summary.json` row whose
  per-route evidence file was never written, a keyboard walk that recorded no advancement, a run that
  records evidence for a page the manifest no longer declares — each left the gate green and the
  published numbers simply smaller.

  `scripts/lib/route-inventory-report.mjs` reconciles the two. It reads the surfaces the manifest
  declares per route and the evidence a run left on disk (the contrast gate's `summary.json` rows plus
  the files they name, a production route matrix, the workbook's human matrix), then holds one row per
  declared route with its declared surfaces, the evidence recorded for it, and a status. The run
  **fails** when a declared route has no recorded evidence, when evidence appears for a route the
  manifest does not declare, when evidence is recorded for a route its own surface left out, when a
  summary row claims an evidence file that is not on disk, when a keyboard walk recorded no tabbable
  element, or when a production probe did not answer 200. Evidence that is present but weak — a Tab
  walk that never reached a second element, axe `incomplete` nodes — is reported as *degraded* rather
  than hidden or escalated into a failure, and the human-gated manual-review surface is reported as
  awaiting evidence instead of failing a machine gate that cannot produce it (a workbook row that
  exists but still reads untested counts as awaiting, not as recorded).

  The R-05 contrast gate publishes the report on every run — `a11y-evidence/route-inventory-report.json`
  and `.md`, written even when the walk itself failed, so a failed run still leaves the record of what
  it did and did not cover — and CI prints the same table in the run's step summary beside the uploaded
  `a11y-evidence/` artifact, without disturbing the step's exit status. `npm run report:route-inventory`
  (`scripts/report-route-inventory.mjs`) produces the pair for a saved production matrix or for the
  manual-review matrix, exiting 1 when it names a coverage problem and 2 when it cannot produce a
  report at all. `/results`, the manifest's declared exclusion, is refused if a run ever records
  evidence for it. Verified by `tests/route-inventory-report.test.ts` (24 tests: planted gaps, an
  undeclared route, an out-of-surface route, a claimed-but-absent evidence file, absent/undecodable
  summaries, both matrix shapes, workbook ticks, the human-surface accounting, and three CLI runs
  through the real entry point) plus typecheck, lint and the full suite; the gate's own publication
  path was exercised through the same module and CLI against a synthetic run, because this host has no
  `chromedriver` and the browser walk cannot run here — that wiring is pinned structurally rather than
  claimed as a browser pass.

- **The browser-local evidence store has one reader now, not five** (`privacy`/`maintainability`, HARD-01
  completion): the read guard added on 2026-10-14 bounded the store's own module, but four Step 6
  surfaces — `EvidenceAnalysesProvider`, `LocalEvidenceReview`, `PathwayEvidenceMapper`, and
  `PathwayEvidenceReview` — each read the same `sessionStorage` payload themselves, with a `JSON.parse`
  and a `version === 1` check and nothing ahead of it. The same hand-edited, older-version, or
  same-origin-replaced store was refused on one page and parsed in full on another, and the analyzer's
  "some saved evidence could not be read" notice could not describe what the review page went on to
  render.

  `parseStoredEvidence(raw, limits)` is that one path, exported for callers that hold the payload
  string rather than a `Storage` handle, and all four call it. Because a Step 6 reader has no depth
  context it reads against `MAX_STORED_EVIDENCE_READ_LIMITS` — the *widest* envelope this app can
  write — so a legitimate Extended store is never refused, and never trimmed to the Standard retention
  window, by whichever page happened to open it first; the guard must not become a second, quieter
  retention policy. The path also rejects a payload that is plainly over the ceiling by string length
  before the UTF-8 encoder allocates anything, with the measured byte ceiling still behind it, because
  an astral character is two code units and four bytes. `tests/evidence-storage-read-guard.test.tsx`
  grew to 30 cases, adding the depth-less ceiling measured against every shipped envelope, the
  byte-not-code-unit measurement, a full 200-source Extended store read back with nothing discarded,
  the readable-records/ignored-record split through both the shared reader and the provider's exported
  wrapper, two mounted cases that render a Step 6 surface against a hostile store (with a non-vacuity
  control showing the old `version === 1` reader did accept that payload), and the structural invariant
  that no component reading this store contains a `JSON.parse` of its own.

- **A PDF whose load fails now destroys the worker that load created, on both OCR paths**
  (`privacy`/`client availability`, REL-05 completion): pdf.js allocates its worker when the loading task is
  created, so the rejected-load path is the one that must still reach `destroy()`. `document-extract.ts` was
  fixed that way under HARD-01; the two component paths were not. In `runLocalOcr` the load await sat inside
  the outer `try` but *before* the inner `try/finally` that owns `loadingTask.destroy()`, and in
  `Dd214LocalAnalyzer` it sat before the `try/finally` that owns `task.destroy()`. A malformed PDF therefore
  skipped the only `destroy()`: the analyzer nulled its task ref in an outer `finally` and left that worker
  running for the life of the tab, while the DD-214 analyzer held the ref only until the *next* upload
  overwrote it — after which the failed task was unreachable. Both awaits now sit inside the teardown `try`.
  Three mounted cases drive the real components through their file inputs with a rejecting `getDocument` and
  assert exactly one destroy per task, no OCR worker on the failure path, a handed-back surface, and no
  orphaned task across a following successful upload; all three fail against the previous code (0 destroys).
  The rest of REL-05 was already closed or superseded: the DD-214 analyzer's render, decode and text bounds
  came from A06 (2026-10-13), and its submission promises are gone with the Server Action — the confirm path
  is one synchronous, schema-validated browser-local write that reports a refused write instead of
  continuing. A real-browser hostile-file stress test (image bomb, hung WASM, measured memory pressure) is
  still unrun and is not claimed.

## 2026-10-14

- **Reading the browser-local evidence store is now bounded like writing it, and a partial restore
  says so instead of loading in silence** (`privacy`, audit HARD-01): the store's write budgets bound
  what *this app* writes, not what this app *reads*. `loadStoredEvidenceWithWarning` handed the raw
  `sessionStorage` string straight to `JSON.parse` and then validated every entry it found, so a
  store written by another version, edited by hand, or replaced by same-origin script decided how
  much work the tab did before anything rendered — and when a record failed validation the only
  observable outcome was a shorter list.

  One read path now applies three guards in the order that matters. The payload is measured against
  the caller's `storedBytes` **before** `JSON.parse` runs (a multi-megabyte string blocks the main
  thread whether or not it parses). The retention window is sliced **before** validation, so an
  oversized array costs one slice rather than one field-by-field check per entry. Every field a
  renderer touches then has a ceiling above the largest envelope this app can produce — quote (shared
  with the classifier's own `MAX_EXCERPT_QUOTE_CHARS`, so a quote this app wrote can never be refused
  by the reader that validates it), source name, locator, excerpt count, and matched-term list — so
  one hostile record cannot hand the UI a multi-megabyte quote or an unbounded array. Each ceiling is
  asserted numerically above `EVIDENCE_DEPTH_LIMITS`, which is what stops the guard from quietly
  becoming a second, tighter retention policy.

  What changed for the Veteran is the disclosure. Validation failures inside the retained window are
  counted and returned as `discardedEntries`, and both restore effects — first mount and depth
  reload — now show a distinct notice ("Some saved evidence in this browser tab could not be read and
  was ignored. Re-analyze any document missing from the list below.") alongside the readable
  records, instead of the corrupt-store notice that would have claimed nothing was restored. Window
  eviction is deliberately *not* reported as ignored: that is retention working, and crying loss over
  it would train the notice out of usefulness. An over-ceiling payload is refused with the existing
  fixed `"Saved evidence could not be read."` notice and a new `STORE_OVERSIZE` code; a `STORE_PARTIAL`
  code covers the ignored-entries case. No branch ever logs or returns parser text or stored
  content — a JSON `SyntaxError` message can carry document text — and every code stays a plain
  string literal, so the PHI-logging boundary's scanned shapes still hold.

- **The main evidence pipeline now runs its OCR under the same elapsed-work budget the DD-214 parser
  got, and a hung page can no longer leave the tab busy forever** (`privacy`/`usability`, audit
  HARD-01): `startOcrJobDeadline` existed and was armed in `Dd214LocalAnalyzer`, but `runLocalOcr` in
  `LocalEvidenceAnalyzer` had only per-page boundary checks. A `page.render()` or `worker.recognize()`
  promise that never settles never returns to a boundary, so the previous behaviour was a tab stuck
  on "Reading selected documents locally…" with a live worker behind it. The deadline now arms per
  run and terminates the live worker and pdf.js loading task, which rejects the awaited promise so
  the run unwinds through its own `finally` chain; the loop also stops at the next page boundary once
  the budget is spent, and unmount clears the timer with the rest of the teardown.

  A budget stop is reported as what it is: recognition failures and render failures that happen after
  expiry do not get blamed on a dead worker (the health probe is skipped, since this run already tore
  that worker down), and the notices state how far the job got. The resume checkpoint is **kept** —
  the pages the tab already paid for are not thrown away, and the next Local OCR run continues from
  there — while partial text recognized before the stop is still reviewed. Teardown happens exactly
  once from whichever owner gets there first: the run's `finally` blocks skip their own release when
  the deadline already released the handles. Verified by a mounted suite that drives the real
  component through the file input and the Local OCR action with a test-scaled budget, covering a
  `recognize()` that never settles after a completed checkpoint, a stop before any page completed,
  and a run that finishes inside the budget (no false positive); the pre-existing DD-214 mounted
  deadline suite still passes.

- **A DOCX archive bomb no longer reaches the extractor on a lying header, and a rejected PDF load
  still destroys its pdf.js task** (`privacy`/`availability`, audit HARD-01): the DOCX preflight
  validated the central directory's *declared* sizes, which a crafted archive is free to understate —
  the entry that then inflates to gigabytes is the one the check just approved. `assertDocxDecompressionWithinLimits`
  now measures what each entry actually expands to before `mammoth` sees the buffer: it re-walks the
  central directory for each entry's authoritative method, compressed size and local-header offset,
  counts stored entries from their declared size without inflating anything, and streams deflated
  entries through `DecompressionStream("deflate-raw")` counting chunk lengths only — returning at the
  cap and cancelling the reader, so peak extra memory is one decompressor chunk rather than the
  expanded entry. Encrypted entries and unsupported methods are refused by name, a decompressor
  rejection becomes this module's own bounded message instead of escaping as a `DOMException`, and an
  engine without `"deflate-raw"` skips the measurement and keeps the declared-size preflight in force
  rather than pretending to have measured. `tests/evidence-docx-archive-bounds.test.ts` builds the
  ZIP fixtures by hand (no library expresses a lying header): an honest archive passes both
  preflights, the same bomb bytes with honest headers are caught by the declared preflight (the
  non-vacuity control), a 64 MB bomb declaring 4 KB passes the declared preflight and is refused by
  the measured bound, and stored entries are counted without inflation. Separately, `extractPdfEvidence`
  awaited `loadingTask.promise` *outside* the `try`, and pdf.js allocates its worker when the task is
  created — so a rejected load skipped `finally { await loadingTask.destroy(); }` and leaked the
  worker. The await is now inside the `try`, pinned by a mocked-failure case asserting `destroy()`
  runs exactly once.

- **Production stops authorizing inline styles, and the React constraint that justified them was
  not real** (`security`, audit SEC-03): `src/proxy.ts` shipped `style-src 'self' 'unsafe-inline'` in
  production, and the last audit recorded that as a P1/Medium policy gap — *"contrary to the
  requested CSP requirement"* — while `SECURITY.md` documented it as an unavoidable React
  limitation: React's `style` prop writes an HTML style attribute, and a nonce can never authorize an
  attribute. The argument was sound about the *policy*, and wrong about the *code*: a walk of `src/`
  found seven style attributes in the entire tree, all in `ConditionTimelineVisualization.tsx`, and
  no dependency that emits one (the runtime tree has no component library at all — `next`, `react`,
  `react-dom`, `zod`, `jose`, `pdfjs-dist`, `tesseract.js`, `mammoth`, `langsmith`, `server-only`,
  `@opentelemetry/api`).

  Each value now has an honest non-attribute form rather than a converted one. The five legend
  swatches became inline `<svg>` lines carrying `stroke`/`strokeWidth`/`strokeDasharray` presentation
  attributes, the three `cursor` values became the SVG `cursor` presentation attribute, the wrapper's
  `maxWidth: 100%` became `max-w-full`, and the exported white card became a drawn
  `<rect fill="#ffffff">` — a Tailwind class would have painted the page but silently vanished from
  the downloaded SVG, because an export carries no stylesheet. The two genuinely computed values are
  written through the CSSOM from ref callbacks: the SVG's exported `min-width` and the tooltip's
  pointer-relative position. `element.style` is a DOM API, not the content attribute the policy
  governs, and a ref callback runs in the commit phase — before paint — so the first frame is already
  correct and nothing flashes unpositioned. Production now emits `style-src 'self' 'nonce-{nonce}'`
  plus `style-src-attr 'none'`; development keeps `style-src 'self' 'unsafe-inline'` because the
  Next.js dev overlay and React's dev tooling inject inline markup, and that branch never runs in a
  deployment.

  The fix is enforced in both directions rather than asserted in prose. `tests/low-severity-remediation.test.ts`
  drives the real `proxy()` and checks the emitted header, stubs `NODE_ENV=development` to prove the
  surviving allowance is branch-scoped rather than merely commented, and walks `src/` for the two JSX
  shapes that produce a style attribute so a reintroduction fails CI instead of shipping;
  `tests/deployment-readiness.test.ts` pins the production/development split at the source. The test
  that previously *required* `style-src 'self' 'unsafe-inline'` is replaced rather than deleted — it
  now asserts the opposite contract, because the requested behaviour changed and a green suite that
  still demanded the old policy would have been the reason nothing could ever change here.

  Verified on a production build (`npm run build`, exit 0) served locally: every one of **24 routes**
  returns HTML with **zero** style attributes and zero `<style>` elements; the emitted header carries
  the nonce on `style-src` and `style-src-attr 'none'` on every route checked; and in the real browser
  the changed timeline renders with 5 hoverable connectors, a drawn white `<rect>`, eight
  `cursor="pointer"` targets and a tooltip positioned to `left: 620px; top: 146px` — with **no element
  holding a refused style attribute** anywhere in the checked documents and **zero**
  `securitypolicyviolation` events. A deliberate control (`setAttribute('style', 'color: red')` leaving
  the attribute in the DOM while `style.color` stays empty, plus the browser's "Refused to apply
  inline style … style-src-attr 'none'" console error) proves the policy is live, so the clean result
  is a measurement rather than a vacuous one. **Not claimed:** no hosted CSP report review was
  performed, `script-src` is unchanged, and browsers without `style-src-attr` fall back to
  `style-src`, which no longer allows `'unsafe-inline'` — a refused style, never a permitted one.

- **The shared consumer budget's admit/refuse pressure is a reported runtime fact, so a
  throttled fleet is visible before VA answers `429`** (`va`, audit A03): the rolling budget that
  bounds the whole fleet's live VA traffic refused attempts silently. An instance that had
  refused a hundred upstream attempts looked exactly like an idle one on `/api/health`, and the
  first evidence of throttling was the upstream's own `429` — by which point every affected
  request had already been served from local reference data and the cause had to be
  reconstructed from warn lines.

  Every reservation decision now records its outcome in process-local counters
  (`src/lib/va/consumer-budget-pressure.ts`) at the same statement that makes the decision, and
  `src/app/api/health/route.ts` forwards them as `components.vaConsumerBudget`, beside the
  budget's own bounds (`maxRequests`, `windowMs`, `optIn`, `variable`) and the gate that decides
  whether it is enforced at all (`store.mode`, `store.distributed`, `store.blockedBy`, the
  operator's next action when it is not). The regime it reports is one of three, because the
  honest reading differs by deployment: `fleet-shared` when every upstream attempt here reserves
  a slot in the fleet's one window, `unenforced` when live VA access is refused before any
  attempt (so the zeroes mean "nothing was sent", not "nothing was throttled"), and
  `not-required` in a single-process runtime where the per-instance outbound budget is the whole
  budget. This is also the one capability in the aggregate runtime report that can be at full
  strength *while* distributed, since a shared atomic window is the fleet-wide form of that
  budget rather than a weaker version of it; that exception is now asserted in
  `tests/runtime-capabilities.test.ts` instead of being inherited.

  The counters are written by the decision rather than by an observer, so `admitted + refused`
  is exactly the number of decisions the instance made and the report cannot drift from the code
  that decides: the refusal vocabulary is the list `reserveVaSharedConsumerSlot` branches on, and
  `tests/va-consumer-budget-pressure.test.ts` derives that set from the source in both
  directions, so a new refusal path cannot be added without a reason the report can carry.
  `pressure.refusedInLastWindow` and `lastRefusalReason` say whether the throttling is happening
  *now*, and `pressure.pacing.chargedReservations` is the earliest warning of all, because a
  charge is applied only when the upstream itself reported less remaining quota than the fleet's
  window believed. The counters are **per instance** and labelled as such (`pressure.scope`),
  resetting on cold start, so they do not sum to a fleet total unaided — but a refusal is an
  event rather than a rate, so any non-zero `refused` is true of the fleet as a whole. Nothing
  in the projection comes from a request, a cache key, or the coordinator's URL and token, and
  it is deliberately **not** a health failure: an exhausted or unenforced budget is the
  documented fallback path, not a reason to take the deployment out of service.

## 2026-10-11

- **The manual Section 508 session was blocked on a remediation that had not landed, and the
  review matrix did not cover the routes that ship** (`a11y`): issue #195 is a human-only gate,
  but `VA_Lighthouse_Readiness_Report.md` §7 puts an ordering constraint in front of it — the
  session must happen *after* R-02 and R-07 land, because testing the pre-fix build produces
  evidence the fix then invalidates. R-02 merged in PR #520; R-07 had not. This lands R-07.

  R-07 named two sites: the `Disclaimer.tsx:20` footer disclaimer and the
  `Dd214LocalAnalyzer.tsx:379` "Full SSN is never stored" notice, both rendering the text that
  tells a user this tool is not legal or medical advice at 12px. Both were raised to `text-sm`,
  and the sweep was then extended to every other element in `src/` carrying legal, privacy,
  safety, or verification meaning — **20 elements across 11 files** in total, `text-xs` in
  `src/**/*.tsx` falling from 286 to 266 occurrences. Fixing only the two audited examples would
  have left the identical defect standing in the consultation-summary export, the medical-record
  checklist, the record walkthrough, the VA reference filter privacy notice, the presumptive-list
  currency notice and the demo-scenario data-handling notice. The `.ui-kicker` eyebrow class also
  rose from `0.78rem` (~12.5px) to `0.875rem`; it carries 24 scope phrases such as "Research aid —
  outside the numbered workflow". The 266 remaining `text-xs` occurrences are decorative and were
  deliberately left alone: blanket-upscaling every small label is a visual redesign, not an
  accessibility fix.

  The uppercase half took `uppercase` in `src/**/*.tsx` from **41 occurrences to 1**, dropping the
  `tracking-wide`/`tracking-wider` letter-spacing that existed only to keep all-caps legible, and
  removed the single `text-transform: uppercase` in stylesheets, leaving **zero**. The one survivor
  is a comparison-table header row whose six columns are single short words. Two other header rows
  were de-capitalised even though R-07 says to keep short `thead` labels, because their column
  labels are phrases — "Evidence excerpt (exact quote)" and "Supporting evidence (exact excerpt)" —
  not short labels.
  One correction to the audit that motivated this: CSS `text-transform: uppercase` does not alter
  the DOM text node, so NVDA, JAWS and VoiceOver announce the sentence-case source and do *not*
  spell it letter-by-letter; that behaviour belongs to text typed in literal ALL CAPS. The real
  harm is the low-vision one — capitalising every word destroys the word-shape cues readers
  depend on — so the fix stands, but the report's stated mechanism was corrected rather than
  repeated into a federal submission.

  `tests/legal-notice-legibility.test.ts` (20 tests) locks both halves: no named notice may carry
  `text-xs`, no `uppercase` may appear outside the one allowlisted header row, no stylesheet may
  declare `text-transform: uppercase`, and `.ui-kicker` must stay at ≥ 14px with no wide
  letter-spacing. It scans components **and** stylesheets. Like the R-02
  contrast test it is an analytical source scan, because jsdom computes no layout and cannot
  observe a rendered font size. It runs in the normal suite, so it gates inside the existing
  `verify` job with no new CI wiring, and it is deliberately **not** added to
  `pr-508-compliance.yml` — that workflow documents a fixed 6-file / 36-test gate, and adding a
  seventh file would silently falsify a count several documents assert. Mutation-proven in both
  directions. 508 gate unchanged at 6 files / 36 tests.

  Review caught two ways the first pass overstated itself, and both are worth recording because
  they are the same failure mode wearing different clothes. The `.ui-kicker` class in
  `globals.css` applied `text-transform: uppercase` with `0.08em` letter-spacing at 24 call sites,
  so a sweep that walked only `.tsx` files reported the all-caps cleanup complete while the
  rendered application still had it. And two of the three header rows initially allowlisted as
  "short structural labels" turned out to carry multi-word column headings, which meant the
  regression test would have permanently accepted the exact violation R-07 exists to remove. Both
  are fixed, and the guard now covers stylesheets as well as components.

  Separately, the workbook's route matrix listed 14 entries while the application ships 26 routes.
  Seven live production routes were absent — `/get-records`, `/scenarios`, `/runtime-readiness`,
  `/secondary/condition-caused-by`, `/secondary/condition-aggravation`, `/secondary/legal` and
  `/presumptive/results` — so a tester following the workbook in good faith would have
  under-covered the surface #195 demands evidence for, and the resulting record would have looked
  complete while not being so. The matrix now enumerates every shipped route, and `/results`
  moves into an explicit exclusion table as the HTTP 307 redirect shim it is, so an unlisted route
  can never be mistaken for a reviewed one.

  **What did not happen.** No accessibility result was recorded and #195 was not closed. Every
  result cell in the workbook still reads `NOT TESTED`, because keyboard, assistive-technology,
  200%-zoom, contrast and forced-colours testing on an identified production build is human work
  with a human sign-off, and automation cannot truthfully record PASS for a test nobody performed.
  The ordering constraint is now satisfied and the session can be scheduled — that is the whole of
  this change. R-05 (real-browser axe with `color-contrast` enabled) is still not implemented, so
  the project continues to hold **no** automated contrast evidence and the manual contrast checks
  carry that burden alone.

## 2026-10-09

- **The VA retry policy has one home, and a 429 is obeyed rather than argued with** (`refactor`): the
  adapter's retry classification, backoff, `Retry-After` decision and payload-validation fallback were
  spread through `sandbox.ts`'s 849-line request loop, so "how long do we wait before touching VA
  again?" was answerable only by reading control flow. They now live in `src/lib/va/api.ts` as the
  policy the transport executes: `vaApiRetryDelayMs` is the only backoff generator (exponential,
  capped at 400 ms, with jitter bounded to 20% of the term and *added* to it, never subtracted, so no
  draw can collapse a retry into a hot loop); `VA_API_TRANSIENT_RETRY_STATUS` is `{503,504}`, with 500
  deliberately excluded because an unhandled server error is not evidence that an immediate repeat
  succeeds; and `parseVaApiPayload` is the single place a schema mismatch becomes `{ok:false}`. It
  discards the Zod issue list on purpose — issue paths and received-type descriptions are derived from
  the upstream document, so returning them would let a malformed response choose part of what a caller
  logs or renders. `sandbox.ts` re-exports the retry constants unchanged, so the names the module spec
  and the phase-3 notes reference keep their documented import site.

  The one behavior change is a `429`, which was never retried — wrong in exactly one direction. An
  upstream that explicitly authorizes retrying at once (`Retry-After: 0`, or an HTTP-date already past)
  was answered by opening the circuit for the clamp's one-second minimum, turning "retry now" into a
  one-second outage for every caller. That authorization is now retried once in-request after the
  backoff floor. Everything else is unchanged and deliberate: `VA_API_RATE_LIMIT_RETRY_MAX_WAIT_MS`
  sits below one second precisely because delay-seconds are whole numbers, so every value VA
  realistically sends exceeds it and takes the audited path — immediate labelled fallback plus a
  circuit opened for the upstream's own window, with the retry served later as the single admitted
  probe. Holding a web request open for the instructed window is what that design avoids, so the
  phrase "without an immediate retry" in the production-access package stays true; that sentence, the
  submission checklist, the demo script, the operations runbook and the module spec were updated to
  state the exception rather than contradict it. The runbook also carried a stale clamp (1–60 s) that
  the B06 remediation had already raised to 1 s–15 min.

  `tests/va-api-resilience-policy.test.ts` covers the policy directly and the transport through it:
  backoff bounds and the jitter floor, the `Retry-After` boundary in *both* directions (a `0` is
  retried, a whole-second value is not), the attempt cap, the shared-parser identity, and that a
  malformed payload or body degrades to a labelled fallback instead of throwing into the router.
  Mutation-verified: forcing the budget to `-1` fails four tests, including the in-request retry.

## 2026-09-18

- **A forked copy can no longer hide in the checkout** (`test`): a folder-sync client watching this
  working copy materializes a second copy of any file it sees mid-write, named `<name> 2.<ext>`, and
  four such copies appeared in `src/` and `tests/` within a single session. They are real files —
  TypeScript typechecks them, ESLint lints them, and any suite that derives its expectations from the
  tree treats a copy as a new module. Deleting them was not enough, because the inspection that found
  them could not see the worst instance: `.git/index` had been forked five times over three weeks
  (Aug 21, Sep 3, Sep 9, Sep 17, Sep 18), and `git fsck` and `git status` both report those clean,
  because git never reads them. The cause was placement — the checkout lived inside iCloud Drive's
  `~/Desktop` domain — and since a same-volume rename out of that domain fails (`Operation timed
  out`, then `ESTALE`) while unlink succeeds, it was retired by deleting the source, and only after
  the destination matched all 1599 of its tracked files byte-for-byte.
  `tests/checkout-fork-hygiene.test.ts` now makes a return of the debris a failure rather than
  something the other suites route around: it walks the whole checkout including `.git`, names every
  forked path, and pins the naming pattern and the walk against vacuity. The capability guard still
  skips byte-identical duplicates, so that its own failures keep answering the capability question —
  and its comment now says so, pointing at the suite that reports the copy instead.
  Mutation-verified in three directions: a byte-identical fork of a runtime-fact module fails only the
  hygiene suite, with both paths named and the capability suite still green; a forked non-source file
  fails it; a forked `.git/index` fails it. The placement rule is recorded in
  `docs/repository-governance.md`. Suite: 238 files / 1457 tests.

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
