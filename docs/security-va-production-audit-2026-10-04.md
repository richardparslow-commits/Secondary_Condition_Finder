# Security, Systems, and VA Lighthouse Production-Readiness Audit

**Audit date:** October 4, 2026. **Disposition:** NO-GO for the requested combined Disability Rating / Benefits Claims / Benefits Intake / Forms production capability. The narrower public Forms / Benefits Reference Data transition remains blocked on external access, manual accessibility evidence, and engineering remediation.

**Remediation status:** §9 records local fixes made after the audit, under the October 11 freeze and without release operations (B04 and B05 fixed and browser-verified; B06 and B07 fixed with coordination and fleet regression tests; B01 sandbox read-only phase implemented in code and fail-closed verified; B03 control labels fixed with human review still open; B02 remains externally blocked). The findings above are the audit record and are not rewritten.

## 1. Scope, method, and executive conclusion

This is an audit of the current shared working tree, not a certification, penetration test of production, or implementation of fixes. The branch observed was `catalog-v2-movement-identities`; the starting HEAD was `76e7868f193f19e5b0114534a2a802f347cfd732`. Many application, data, documentation, and test files already had local changes. Findings describe those files as inspected, not an immutable deployed artifact. The two October 3 reports are historical inputs, not current evidence.

Application code was not changed. Synthetic schema-valid fixtures, mock network/KV responses, a local production server with VA and LangSmith disabled, and public official documentation were used. No real veteran records, credentials, VA business transactions, production mutations, account registrations, or document uploads to VA were used. The temporary ten-probe test was removed after execution. No staging, commits, pushes, PRs, or deployments were performed; the October 11 freeze remains intact. Only this report is a new audit deliverable.

### Acceptance criteria for this audit

- Assess client/server and logging boundaries, OAuth/PKCE, accessibility, quotas/outages, graph/traversal integrity, Server Actions, and session state against current code.
- Distinguish demonstrated defects from plausible risks and missing external evidence; show the logic behind each finding.
- Provide Critical Blockers, Architectural Vulnerabilities, an API-specific VA Production Checklist Gap Analysis, and a sequenced Actionable Remediation Plan.
- Cross-check VA and Next.js claims against official sources; do not equate a successful build, fallback response, or source-pattern test with production readiness.
- Preserve unrelated shared-tree changes and avoid fixes or release operations.

### Readiness summary

| Area | Current conclusion |
| --- | --- |
| Public Forms / Benefits Reference Data | Real adapters and fail-closed production selection exist. Repository records sandbox evidence; production grant and connectivity are not verified by this audit. Distributed correctness issues remain. |
| Veteran-specific disability ratings | No implemented OAuth transaction/callback/token lifecycle or production veteran-specific ratings adapter found. Public disability reference data is not a veteran's rating. |
| Benefits Claims | No implemented claim submission/status lifecycle found. An external VA.gov walkthrough is not an API integration. |
| Benefits Intake | No implemented signed-upload/submission/status lifecycle found. Adding it would deliberately change the browser-local document privacy boundary. |
| Section 508 | Cannot claim conformance: manual workbook remains NOT TESTED, and a live browser check found an inadequately named upload control. |
| CRG | Catalog/registry integrity passes, but the full authored relationship corpus is not a DAG. Traversal is bounded and cycle-safe; recommendation aggregation is still order-dependent on valid synthetic inputs. |
| Privacy | Raw evidence parsing is browser-local in inspected paths. Workflow selections/service history do reach the application server. Event logging exists despite contrary policy language. No actual PHI exfiltration was demonstrated. |
| Critical exploit | No externally exploitable critical vulnerability, arbitrary public KV writer, credential disclosure, account takeover, or infinite-recursion exploit was established. Production blockers are not all CVSS-critical security bugs. |

### Current data, not the older project counts

Fresh validation reports **819 catalog conditions and 819 mappings: 140 published, 679 draft**. The authored CRG audit reports **873 relationships, 248 published edges, 825 ASSOCIATION_ONLY edges, 13 enumerated cycles, four bidirectional pairs, and 29 redundancy conflicts**. Status is **REVIEW**, with no hard violations and no cycle-report truncation. A review-debt baseline tolerates existing findings; it does not prove acyclicity or clinical validity.

The master registry passes: **1,699 live source-reference uses**, including **395 verified** and **1,304 pending verification**; **1,492 source entities**; **799 explicit publication guards** and **74 legacy rationale boundaries**. A source-reference use is not a distinct source entity. Passing referential integrity is not qualified-human medical-source verification.

A separate adjacency migration preview contains **three nodes and three edges** and passes its acyclicity check. Its routes are liver-cancer → sarcopenia, alcohol-use-disorder → chronic-liver-disease, and bruxism-awake-sleep → tmj-disorder; these are association-only draft-origin research data. The preview cannot substantiate a claim that all 819 mappings have migrated into one production DAG.

## 2. Critical Blockers — show-stoppers for the requested scope

Priority labels below are release/remediation priorities. **P0** denotes an access, scope, or compliance gate; it does not automatically mean a remotely exploitable critical vulnerability. **P1** denotes a high-impact correctness, availability, privacy-assurance, or usability defect.

### B01 — P0: requested veteran-specific integrations and authentication are absent

**Evidence:** Current routes and action modules provide anonymous local research workflows and public-reference adapters. No OAuth authorization endpoint handler, callback, PKCE verifier transaction, state validation, token exchange/refresh/revocation lifecycle, or veteran identity-bound session was found. The legacy [VA adapter](../src/lib/va/index.ts#L45) uses configurable Bearer + X-User-Id and a custom rating schema, not the current official ratings contract; no production caller was found.

**Exact contradiction:** “Upgrade this app's Disability Rating/Claims/Intake integration” implies implemented integrations. The current product itself correctly states that it does not connect to a veteran account or submit claims in [privacy §6](../src/app/privacy/page.tsx#L90). Public Benefits Reference Data contains administrative reference information, not an authenticated individual's disability ratings.

**Impact:** The requested combined production capability cannot be demonstrated or safely enabled. This is missing capability, not proof that an existing OAuth flow is vulnerable.

**Required direction:** Keep the public-reference transition separate. Choose and confirm eligible API versions/grants with VA before implementing veteran-specific flows. Forms and Intake use API keys, not a universal PKCE flow. Ratings and Claims require the appropriate OAuth grant and user/representative authorization. See §5.

### B02 — P0: VA production access and build-specific deployment proof remain external

**Evidence:** [External/manual gates](external-manual-gates-status.md) records #287 OPEN and no VA production grant; #189 CLOSED with a credentialed Forms/Reference sandbox run; #213 CLOSED for the production workflow secret; #195 OPEN for human accessibility review. These are repository assertions with linked evidence, not independently verified live deployment/GitHub state in this audit.

**Implemented positive control:** [Runtime mode resolution](../src/lib/va/runtime-state.ts#L106) requires production intent, `VA_PRODUCTION_ACCESS_GRANTED`, and both service-specific production keys. Missing acknowledgement/keys fail closed. Distributed live transport additionally requires the shared consumer-budget opt-in and reachable coordinator. This is an operator acknowledgement, not independent verification that VA granted access.

**Gap:** No sanitized grant letter, approved API/version/scope list, registered redirect configuration, current production connectivity evidence, or reviewed deployed KV/WAF/logging configuration was available. Do not enable production or close the gate from fallback HTTP 200s. Grant approval and a controlled authorized connectivity check are separate evidence events; do not create a circular procedure requiring connectivity before any authorized way to enable it.

### B03 — P0/P1: Section 508 attestation is unsupported and a browser-visible control defect exists

**Evidence:** The [manual workbook](section508-manual-review-workbook.md) explicitly has no completed human accessibility evidence or sign-off. In the production-mode Chromium browser, `/presumptive` exposed the DD-214 file input only as **“Choose File”**, with no associated label, id, or aria-label naming its DD-214 purpose. Its surrounding section heading does not give the input that contextual accessible name. Source: [file input](../src/components/presumptive/Dd214LocalAnalyzer.tsx#L172). The later free-text location input also relies on placeholder text rather than a durable associated label [source](../src/components/presumptive/Dd214LocalAnalyzer.tsx#L252).

**Impact:** Users of assistive technology may not understand the upload's purpose. Automated title, source, and validation tests cannot certify keyboard, screen-reader, contrast, reflow, or forced-colors behavior.

**Requirement precision:** VA's production request asks for a Section 508 answer; its published request guidance encourages compliance. This audit does not invent an automatic rejection rule for every “No” answer or demand an ATO for every public API. The project's own #195 requires human evidence before a conformance claim. Fix labels, complete the identified-build workbook, retest findings, and answer VA truthfully.

### B04 — P1: current production Trusted Types policy breaks browser-local OCR

**Demonstrated through the user interface:** A 22,502-byte synthetic DD-214 PNG was selected on the production-mode local `/presumptive` page. Extraction ended with the visible status **“Trusted Types: refused non-same-origin script URL (blob:http://127.0.0.1:3123/…)”**. No extraction result appeared.

**Cause:** Both DD-214 worker constructors [lines 77 and 114](../src/components/presumptive/Dd214LocalAnalyzer.tsx#L77) and the main evidence OCR constructor [line 429](../src/components/evidence/LocalEvidenceAnalyzer.tsx#L429) omit a `workerBlobURL` override. Pinned Tesseract defaults that option to true and spawns `new Worker(URL.createObjectURL(blob))`. The [Trusted Types policy](../src/lib/security/trusted-types-policy.ts#L50) rejects every non-http(s) script URL, including blob URLs. `worker-src 'self' blob:` in [Proxy](../src/proxy.ts#L189) does not override Trusted Types sink checks.

**Exact contradiction:** [SECURITY](../SECURITY.md#L89) claims verified worker success through the production gate. Allowing a same-origin worker path is insufficient when the library wraps it in a blob first. Existing cleanup/TT unit tests do not run this full browser path.

**Scope:** DD-214 image OCR failure was observed. The main evidence OCR uses the same incompatible configuration, but its end-to-end failure was not separately exercised. A pre-existing TrustedScript console error was also seen; it was not assigned a separate cause without a stack trace.

**Remedy:** Prefer the library's direct same-origin worker mode where supported, retain strict URL/body policy, and browser-test image and scanned-PDF OCR under the actual production headers. Do not fix this by globally trusting blob/script bodies or disabling CSP/Trusted Types.

### B05 — P1: recommendation aggregation remains order-dependent despite an order-invariant contract

**Evidence:** [Direct accumulator](../src/lib/engine/recommend.ts#L174), [path accumulator](../src/lib/engine/recommend.ts#L228), and [final score derivation](../src/lib/engine/recommend.ts#L267). Two valid synthetic fixtures used `diagnosedConditionIds: [target]`, matching the workflow's focused recommendation boundary.

1. A → M → T and B → T, all rank one: primaries `[A, B]` produce target score **2**; `[B, A]` produce **1**. A path-first target is created with a synthetic contributing primary A. When the direct contribution B arrives, it is appended without removing A. `directScoreOf` later sums both ranks. A direct-first target records the path without adding A. Merely deriving scores after the loop cannot make the collected inputs invariant.
2. A → M rank one; B → M rank two; M → T rank one: `[A, B]` produces **1**, `[B, A]` **0.5**, even though both outputs contain two intermediate paths. The existing-target branch assumes “existing” means “direct”; it appends the second path then `continue`s, skipping its score, source-reference, and consensus aggregation.

**Impact:** Discovery order changes ranking and can change contributing-primary/provenance/consensus presentation. These are research scores, not approval probabilities, but inconsistent clinical-research output is still material.

**Test blind spot:** [Order-invariance tests](../tests/recommend-order-invariance.test.ts#L28) omit `diagnosedConditionIds`; the [path composer](../src/lib/engine/pathways.ts#L124) requires a diagnosed target, so those tests do not activate the mixed direct/path cases they claim to protect. Current real-corpus affected combinations were not exhaustively quantified; an older report's number is not reused as current proof.

**Remedy:** Separate direct contributions from paths and aggregate each collection before choosing the explicitly documented score/provenance policy. Test every permutation of mixed/direct/path-only fixtures with diagnosed targets, consensus differences, and distinct source references.

### B06 — P1: distributed cooldown recovery is unfenced and Retry-After is not faithfully enforced

**Evidence:** [Outcome recorder](../src/lib/va/outbound-circuit.ts#L102) resets local circuit state and publishes shared recovery on every success, regardless of `probeAdmitted`. [Shared recovery](../src/lib/va/shared-circuit.ts#L193) unconditionally deletes the open marker.

**Reproduction:** Publish a newer shared cooldown, then report a late successful ordinary request with `probeAdmitted: false`; the marker is deleted. The analogous local success also clears a newly opened local circuit. A request admitted before a later 429 can erase that newer 429's backoff.

**Second contradiction:** [Shared marker](../src/lib/va/shared-circuit.ts#L48) stores only state/openedAt. [Gate](../src/lib/va/shared-circuit.ts#L115) compares against a fixed 60 seconds. `publishSharedCircuitOpen({cooldownMs: 1000})` logs one second but remains in cooldown at two seconds. Local Retry-After clamps to 1–60 seconds; a ten-minute upstream Retry-After is shortened to one minute. The shared implementation also does not preserve a caller-supplied longer duration.

**Impact:** A fleet can resume too early after an upstream limit, or stay blocked longer than a short requested cooldown. Circuit breaking exists, but “whole-consumer backoff obeys Retry-After” is not supported.

**Remedy:** Store an absolute retry-not-before deadline and generation/fencing identity. Only the currently admitted matching recovery probe may close its generation; older ordinary successes must not clear later failures. Long Retry-After may be served by immediate fallback with deferred retries rather than holding a web request open.

### B07 — P1: shared coordination has false-success and ownership races

**False-success reproduction:** A KV HTTP 200 body `{error: "ERR synthetic failure"}` makes [cooldown publication](../src/lib/va/shared-circuit.ts#L174) report true: it checks transport `.ok`, not command payload error/result. Shared recovery also returns transport success for the marker deletion. Outcome callers do not act on these boolean failures. Read paths often validate payload errors correctly; this is a write/result inconsistency, not absence of all fail-closed handling.

**Lease race reproduction:** [Fetch release](../src/lib/va/shared-single-flight.ts#L140) and [probe release](../src/lib/va/shared-circuit.ts#L226) compare the token via GET then issue a separate DEL. Replacing an old-owner lease with a new owner between those commands causes the old owner to delete the new lease. Existing token mismatch protection only covers replacement before GET. Publishing an open marker also unconditionally deletes a shared probe lease.

**Duration contradiction:** [Fetch lease](../src/lib/va/shared-single-flight.ts#L30) is 45 seconds although a logical fetch can make three attempts at up to 30 seconds each, plus backoff and coordination/write time. Contenders do three cache reads with 200-ms intervals, then can fetch even while a lease remains held. The code correctly calls this best-effort deduplication, not a quota safety control; it cannot guarantee one upstream fetch per key.

**Remedy:** Use atomic compare-and-delete/compare-and-transition operations supported by the existing coordinator, validate exact command results, fence ownership/generation, and test interleavings and HTTP-success/command-error responses. Align or renew fetch leases with a total deadline. Preserve the separate fail-closed shared budget.

### B08 — P1: privacy statements contradict actual events; some error channels bypass redaction

**Demonstrated contradiction:** [Privacy §3](../src/app/privacy/page.tsx#L55) and [§7](../src/app/privacy/page.tsx#L108) say no workflow/recommendation event history is persisted through an application event logger. [auditLog](../src/lib/observability/audit.ts#L32) emits workflow action/status/route/count events, and [recommendation execution](../src/lib/engine/recommend.ts#L367) emits counts/duration. [Logger](../src/lib/observability/logger.ts#L179) writes timestamped records to stdout/stderr for platform ingestion. The synthetic probe log actually contained these recommendation events.

**Important boundary:** Event existence is confirmed; long-term host retention, IP/request correlation, and access controls are not. Typical inspected events are operational counts, not raw clinical selections. “No medical-record database” can remain true while “no event logging” is false.

**Bypasses:** Six persistence error paths use direct `console.error(error.message/String(error))` in [secondary actions](../src/lib/actions/secondary.ts#L152), outside the otherwise strong structured-log allowlist. Client error boundaries also emit exception messages. Optional [LangSmith tracing](../src/lib/observability/langsmith.ts#L49) is separate from disabled automatic OpenTelemetry. Its recommendation input/output processors use counts; the installed SDK records `String(error)` on exception. No actual PHI-bearing exception export was observed, and deployed tracing settings are unknown.

**Remedy:** Inventory and document operational events and platform retention; sanitize exceptions at every sink, not just custom attributes. Do not enable optional tracing until success, thrown error, rejected promise, malformed output, and host collector paths have sentinel-based privacy tests. Reconcile SECURITY and submission-package wording with actual data flows.

## 3. Architectural Vulnerabilities and assurance gaps

### A01 — P1/P2: arbitrary reference-search text has a URL, upstream, and cache-value exposure path

The [Forms Finder](../src/app/va-forms/finder/page.tsx#L37) is a GET form allowing arbitrary 120-character text. [Loader](../src/lib/va/forms-finder.ts#L57) trims/bounds it, hashes the cache key, sends it as the configured VA query when live access is allowed, and stores the raw query inside the returned/cached view. A sensitive identifier accidentally typed there can appear in browser history, application/edge request URLs, upstream VA traffic, and shared cache **values**. Hashing a key is not encryption or removal of its value. ZIP/radius/type likewise appear in directory parameters and cached values; low-entropy ZIP hashes can be enumerated.

Privacy §6 warns against identifiers, but the Forms input has no equivalent adjacent warning. Source confirms the path, not actual ingestion of a real identifier. CSP does not govern server-side VA or KV requests; no-referrer does not remove the original request URL from a host's logs.

Prefer constrained form identifiers where practical; otherwise show an explicit warning, reject identifier-like input where safe, avoid raw text in URLs/cache values, and verify host/CDN log scrubbing. POST reduces URL exposure, not all logging risk. Treat ZIP as a lookup context with reviewed retention, not magically anonymous because hashed.

### A02 — P1/P2: inbound reference rate limiting misses actual loader routes

The [GET limiter](../src/proxy.ts#L274) matches only `/va-forms`, `/va-reference`, `/presumptive/results`, and `/secondary/suggestions`. It misses `/va-forms/finder`, `/va-reference/service-branches`, `/secondary/evidence`, and `/presumptive`, which also reach reference loaders. This is a route-coverage gap, not a demonstrated bypass of the outbound shared budget.

Limiters are process-local defense in depth; the workflow POST limiter is 30/minute per client key per instance. [Client key extraction](../src/lib/rate-limiter.ts#L198) trusts the first X-Forwarded-For entry. Whether a user can spoof it depends on the deployed edge's stripping/normalization rules, which were unavailable. Next.js 16 Proxy defaults to **Node.js**, not a guaranteed Edge runtime or fleet-shared memory.

Build one auditable route-to-upstream coverage list, include ordinary/RSC/prefetch/HEAD paths as applicable, and enforce fleet abuse controls at a verified boundary. Do not flood production to test this. The previously reported prefetch CSP exclusion is no longer present: a synthetic `next-router-prefetch: 1` request retained CSP in the local runtime.

### A03 — P2: fixed-minute budget permits a boundary burst; upstream quota semantics remain unconfirmed

[Shared budget](../src/lib/va/reference-shared-cache.ts#L492) increments `budget:floor(now/60000)`, permits 60, and separately sets a 120-second expiration. Mock proof: 60 reservations at 59,999 ms plus 60 at 60,000 ms admits **120 in a millisecond-spanning boundary interval**. This is expected fixed-window behavior, not proof of a VA quota violation without the applicable consumer's rolling/fixed/reset semantics. Every network retry does reserve another distributed slot, which is a positive control.

`ratelimit-remaining`/reset guidance is not used to adapt pacing. Lower-priority issues include accepting any finite positive numeric result rather than an integer, and not validating the expiration command result. Verify the issued consumer policy with VA; use conservative pacing or an appropriate atomic sliding/token mechanism until exact semantics are documented. Budget key scope must match the issued consumer, environment, and credential sharing arrangement; that deployment relationship was not supplied.

### A04 — P2: cached live-view guards validate labels/links, not the loader's actual schema

[Common guard](../src/lib/va/cached-view-guard.ts#L110) accepts a correctly labeled/environment-matched object with `items: "NOT_AN_ARRAY"`. [Generic cache reader](../src/lib/va/reference-shared-cache.ts#L288) casts envelope.value to T. The UI's [items.map](../src/app/va-forms/finder/page.tsx#L56) can then fail on a malformed cached value. Timestamp checks bound length rather than parse dates; HTTPS links are credential-free but not necessarily official VA hosts; cached query/params are not matched to the requested lookup.

Envelope version/epoch is not cryptographic proof of author or source authenticity. No arbitrary public cache writer or proven XSS was found; exploitability depends on KV access, stale/cross-version data, or another write defect. The writer allows 256 KiB but KV reads cap responses at 64 KiB, so a successfully written large view may be unreadable.

Validate a per-loader Zod cache DTO, exact query/params, item/field bounds, timestamps, and appropriate link origin provenance before serving. Align read/write envelope limits. Invalid values should become bounded misses/fallbacks, never trusted live cards.

### A05 — P2: disabling the representative feature does not revoke cached live results

[Directory loader](../src/lib/va/accredited-representatives.ts#L80) gates cache reads on global `config.enabled`, not the service-specific accreditedRepEnabled flag. Mocked `VA_API_ENABLED=true` plus `VA_ACCREDITED_REP_ENABLED=false` still returns a cached live directory. The fresh transport can remain disabled; this is serving previously cached data, not demonstrated fresh outbound traffic or PHI transfer.

Evaluate the effective service flag before every cache tier, wait path, and transport. Define whether disable means “no new fetch” or “show no live data”; make UI/policy and tests agree. Privacy currently describes the service as gated, so cached bypass is material to that promise.

### A06 — P1/P2: alternate DD-214 parser does not share the main evidence resource/integrity controls

[DD-214 analyzer](../src/components/presumptive/Dd214LocalAnalyzer.tsx#L55) limits file bytes to Standard (20 MiB) and pages to 300, but:

- Any page with a text layer sets one document-wide `usedTextLayer`; scanned pages in a mixed text/scanned PDF are not OCRed if any usable text was found. The comment promises per-page fallback; the condition implements document-wide fallback.
- Page truncation at 300 is not disclosed there. Full extracted/recognized text is accumulated before the [parser's fixed 200,000-character slice](../src/lib/evidence/dd214-extract.ts#L170); `_limits` is ignored.
- Scale-two PDF canvases have no pixel/dimension cap or explicit release. Image OCR has no decoded-image dimension cap. A byte limit does not bound canvas/WASM memory or CPU duration.
- There is no job cancellation/deadline/unmount teardown contract. Normal finally cleanup exists for acquired pages/workers/tasks; it does not guarantee cancellation when a promise hangs or navigation abandons the UI.
- SSN masking recognizes three numeric layouts. “Full SSN is never displayed” is stronger than that heuristic can establish for arbitrary OCR spacing/punctuation/errors. A raw-text preview can retain identifiers not matching those patterns. This is a local display/minimization risk; no server transmission of the preview was found.
- Parsed dates only validate day ≤31, not real calendar validity at this layer. Downstream service-history validation/user confirmation are separate safeguards. Heuristic extraction is not authoritative DD-214 interpretation.

Reuse the stricter main document/OCR helpers, add per-page text/OCR decisions, bounded streaming retention, pixel limits and teardown, partial-result warnings, and cancellation. Avoid a broad local-preview identifier guarantee unless tested and enforceable. All document-derived fields require explicit user review.

### A07 — P2: finish/restart can hide incomplete browser cleanup; in-flight OCR has no cancellation fence

[Local cleanup](../src/lib/secondary-workflow/local-state.ts#L33) attempts all six workflow stores and throws if any removal failed, but [completion UI](../src/components/secondary/SecondaryWorkflowCompletionActions.tsx#L9) silently catches the error and still submits the cookie-clearing action. Cookie deletion is useful, but it is not proof that excerpts/checkpoints were removed from sessionStorage.

[Main evidence OCR](../src/components/evidence/LocalEvidenceAnalyzer.tsx#L422) writes resume checkpoints asynchronously and lacks a cancellation/unmount generation check. Clear controls are disabled during work. Continued writes after workflow exit are a plausible lifecycle race, not a browser-reproduced race in this audit. SessionStorage is tab-local, not encrypted or inaccessible to same-origin code/XSS; TTL checks on read are not background physical deletion at the exact expiry time.

Cancel and fence jobs before clearing all stores; expose a cleanup failure warning while still permitting safe cookie deletion. Verify both stores and post-clear absence of writes with delayed synthetic OCR and throwing storage implementations. The completion controls must not equate “cookie removed” with “all local evidence erased.”

### A08 — P2: graph safety and DAG integrity are different, and two graph representations coexist

The authored graph contains cycles, including fully published association-bearing cycles, so describing the entire corpus as one DAG is false. ASSOCIATION_ONLY is not transitive medical causation. [Recommendation path composition](../src/lib/engine/pathways.ts#L113) correctly excludes association-only edges and requires published mappings and a diagnosed target; draft mappings do not become recommendations merely because they exist in the corpus.

The adjacency preview's [runtime loader](../src/lib/kb/graph.ts#L90) validates schema, identities, and catalog references, but leaves acyclicity to CI. A valid synthetic ptsd ↔ hypertension graph loaded successfully. [Generator](../src/lib/engine/pathway-generator.ts#L105) then terminated, skipped repeated ancestors, and emitted only a one-hop branch. Its shared [MAX_PATHWAY_HOPS = 2](../src/lib/kb/pathway-depth.ts#L26) supports a secondary and a tertiary edge, not arbitrary-depth chains. Depth cap plus ancestor guard prevent infinite recursion here; they do not validate the graph as a DAG or globally bound a future dense frontier's output.

Decide whether acyclicity applies to causal inference edges only or every research relationship. Enforce the selected invariant at authoring, CI, and runtime load, with explicit governance for bidirectional associations. Never remove medically legitimate directions merely to make an all-relationships audit green. Reconcile the authored recommendations and adjacency preview before migration, with publication/provenance parity tests. The 29 redundancy rows have a separate [triage report](crg-redundancy-triage-2026-10-04.md); that triage is not a clinical approval.

### A09 — P2: dynamic graph path over-expands server deployment tracing

The final production build warns that [graph path construction](../src/lib/kb/graph.ts#L33) causes tracing of the whole project. Final `.nft.json` manifests contain **2,747 files for the pathways route and 2,731 for health**, including **269 docs and 289 tests** in each trace. This increases packaging scope, size, and accidental future inclusion risk. It does **not** prove those files are publicly downloadable, that secrets were included, or that a secret leaked.

Scope the filesystem path statically to the required data directory and assert package contents/size. Prefer fixing tracing scope over suppressing the warning or excluding data required at runtime. Separately, root [await connection()](../src/app/layout.tsx#L18) deliberately makes routes dynamic for nonce CSP. That is a performance trade-off, not misuse of React Server Components. Optimize only while preserving per-request nonce semantics and private workflow rendering.

### A10 — P2: latent legacy adapter and development dependency debt

The [legacy adapter](../src/lib/va/index.ts#L109) accepts any absolute base URL, sends a bearer credential, and uses unbounded response.json. It blocks redirects and no production entrypoint was found, so a publicly reachable SSRF or credential-exfiltration exploit was not established. Retire it or clearly isolate it from real integrations; never use its fabricated schema/auth headers as proof of VA compliance.

Runtime-only npm audit passed with zero advisories. The full dependency audit failed with **five high-severity package entries arising from one braces stack-exhaustion advisory chain**, GHSA-vfj7-8cjw-p6xm: braces → micromatch → fast-glob → Next ESLint plugin → eslint-config-next. This is not five independent application vulnerabilities; hostile-pattern reachability in the development workflow was not demonstrated. CI deliberately treats full-tooling inventory separately from the runtime hard gate. Do not apply npm's proposed forced downgrade of eslint-config-next to 14.2.35; track a compatible patched dependency path or an explicit evidence-based tooling risk disposition.

## 4. Boundary and security controls that are actually present

### Client → server → provider map

| Data | Inspected behavior | Residual exposure/assurance boundary |
| --- | --- | --- |
| Raw PDFs/DOCX/images and pasted evidence | Parsed by bundled browser libraries; OCR assets are same-origin. No raw upload found in inspected action payloads. | Same-origin code can read browser memory/sessionStorage. OCR resource/cancellation and production TT problems remain. Browser egress test was limited to one synthetic DD-214 image attempt. |
| Conditions, service-connected answers, ratings, optional medication/treatment/history | Submitted through anonymous Server Actions, validated and persisted as encrypted/authenticated workflow cookies. Server decrypts to compute recommendations. | Not “all veteran data stays local.” Selected health context is processed server-side; ordinary action-body host logging settings were unavailable. |
| DD-214 dates, locations, recognized branches | After explicit confirmation, sent through the presumptive action; raw preview/SSN is not included by that submit code. | Raw document stays local, but reviewed service-history fields do not. Free-text duty-station strings are still sensitive context. |
| Reference query and ZIP/radius/type | Used by public lookup pages/actions, configured VA GETs, and short-lived reference cache views. | Query URLs, cache values, and provider processing; hashed keys do not eliminate those flows. |
| Operational events/errors | Structured logger allowlists fields; workflow/recommendation events exist. Automatic framework trace export is disabled by policy. | Direct console exceptions, optional LangSmith SDK error recording, hosting logs/retention and correlation require review. |

### Server Actions and authorization

- Next.js exported/used Server Actions are callable POST entrypoints. Action identifiers are references, not authorization or proof of user intent.
- Current workflow writes are intentionally anonymous and affect the caller's encrypted cookie, not another user's record or VA account. Missing VA login is not by itself an IDOR in these anonymous research actions. Future account-bound/API submission actions must authenticate, verify consent, and authorize the veteran/representative/resource on every invocation.
- [Secondary actions](../src/lib/actions/secondary.ts#L36) merge only step-owned allowed form keys; catalog-backed parsers/Zod and stored-session validation constrain input. Prior-step state is session-authoritative rather than blindly overposted. Invalid input holds the user at a validation route; the 3,800-byte cookie budget rejects oversized state before replacing the last good cookie.
- Admin cache clear and regulatory preflight use server bearer checks with minimum configured secret length and constant-time comparison. Local uncredentialed requests returned 401. No anonymous privileged access was demonstrated.
- Next.js supplies POST action Origin-versus-Host/X-Forwarded-Host protections; SameSite=Strict is additional defense. Audit deployed proxy/allowed-origin rules rather than assuming generic CSRF tokens are either mandatory or unnecessary. The repository's explicit origin helper is not automatically invoked by every workflow action; framework and route-specific protection must be assessed separately.
- Imports from a client component to a `use server` module are legal action references, not evidence that Node/secret code is bundled into the browser. Catalog/KB/VA/tracing server-only guards are present; `recommend` becomes server-only through its LangSmith import. A helper that is merely server-called need not itself be a Server Action.

### Session and local state

[Shared crypto](../src/lib/workflow-session-crypto.ts) uses AES-256-GCM, random 12-byte IVs, 16-byte authentication tags, version-bound AAD, authenticated issuance/expiry, and a fail-closed production secret requirement. [Secondary cookies](../src/lib/secondary-workflow/session.ts#L184) are HttpOnly, Secure in production, SameSite=Strict, scoped to `/secondary`, and expire in 30 minutes. [Presumptive cookies](../src/lib/presumptive/session.ts#L42) have equivalent settings and `/presumptive` scope. Deletes use the matching paths. Compact catalog fingerprints fail closed on incompatible state. A 32-character minimum is not proof that the configured secret has adequate entropy; production secret management/rotation evidence was not inspected.

Completion/restart removes the cookie but does not revoke an already copied stateless ciphertext before expiry. This is a replay property, not a demonstrated account-session takeover: there is no account authorization lifecycle here. If real OAuth/account sessions are added, use a separate identity-bound server session with logout/revocation and token lifecycle design. SameSite=Strict workflow cookies scoped to workflow paths are not suitable as an assumed OAuth callback correlation mechanism; design a short-lived callback transaction explicitly, accounting for cross-site redirects without weakening all workflow cookies.

Local evidence excerpts/checkmarks/checkpoints use tab sessionStorage and guarded restoration. SessionStorage survives reload within the tab and is not a protected secret store. Selected File objects and raw document bytes stay in browser memory in inspected paths. Avoid absolute secure-erasure guarantees; garbage collection, browser restoration, storage failures, and running jobs are separate concerns.

### Outage handling: what is implemented versus missing

The public-reference transport validates trusted HTTPS VA origins, uses server-only API keys, denies redirects, bounds JSON bodies to 2 MiB, validates payloads, and includes body reading within a per-attempt timeout (default four seconds, maximum 30). It performs up to **three attempts total** for network/timeout and 503/504 errors, with 100/200-ms base backoff and bounded jitter. 500 and 429 immediately fall back; 429 opens a circuit without an immediate retry. Immediate 500 fallback is graceful handling, not proof that “all 5xx are retried.” No official evidence reviewed requires retries of every 500.

Local/shared circuits and distributed budgets exist; the defects in B06/B07 limit their guarantees. A 750-ms KV timeout is **per command**, not an overall loader deadline. Cache epochs, read/write budgets, leases, and cache publication can issue multiple sequential commands. Three maximum-duration HTTP attempts plus coordination can exceed 90 seconds. Set a measured total logical deadline compatible with hosting limits; verify fallback latency, not only that an individual fetch has an AbortSignal.

## 5. VA Production Checklist Gap Analysis — requirements by API

The user premise “OAuth 2.0 PKCE required by VA” is too broad. Official current metadata differentiates API keys, Authorization Code Grant (ACG), and restricted Client Credentials Grant (CCG). The following requirements are from official process pages and published metadata/OpenAPI, checked October 4. They are not a promise that VA will approve this particular organization or application.

### API contract matrix

| Target | Official authentication/contract | Current gap |
| --- | --- | --- |
| VA Forms v0 | Open-data API; `apikey` authentication, no OAuth requirement in metadata. | Adapter exists; confirm grant/service key, coordinator correctness, live production evidence, and honest source labels. |
| Benefits Reference Data | Public-reference API-key integration; not veteran-specific ratings. | Adapter exists. It does not satisfy the requested Disability Rating feature. |
| Veteran Service History and Eligibility v2: disability ratings | OAuth ACG/CCG. GET `/disability_rating`: `disability_rating.read`; GET `/summary/disability_rating`: `disability_rating_summary.read`. ACG obtains veteran ICN through sign-in launch context; CCG must supply ICN in token launch context and production requires VA employment or specific agreements. Demographic-match POSTs and restricted scopes have separate contracts. | No approved grant/registered application/token lifecycle/identity authorization/current ratings DTO adapter found. Do not fabricate X-User-Id or request excess scopes. |
| Benefits Claims | Metadata distinguishes v2 “Internal VA Use Only” from v1 “Non-VA Use.” v1 uses OAuth with `claim.read`/`claim.write`; required scopes depend on operation. Representatives require applicable claimant identifying headers and verified POA, not merely a representative search result. | No submission, schema validation, authorized representative/claimant context, attachment controls, or polling/status lifecycle. Confirm eligible version with VA; do not select v2 solely because “Current Version.” |
| Benefits Intake v1 | `apikey` control-plane calls; POST `/uploads` returns GUID plus signed upload location valid 15 minutes. PUT multipart PDF/JSON to the signed location requires **no apikey header**. Track `/uploads/{id}`; bulk report data is cached for an hour. PDF ≤100 MB and ≤78 ×101 inches; entire payload ≤5 GB. Not for VHA 10-10EZ or CHAMPVA 10-10d. | No upload/control/status integration, eligible-consumer attestation, transmission consent, bounded streaming, signed-URL handling, receipt/reconciliation storage or support flow. The existing 20-MiB/300-page local parser limits are app choices, not VA Intake upload limits. |

A Claims HTTP 200 means submitted, not established in VBMS. Use returned IDs and the appropriate status endpoint. An Intake successful PUT/“uploaded” does not establish VA date of receipt; “received” establishes the documented receipt stage, with later Success/VBMS semantics depending on the submission. Do not show “claim received/established” prematurely.

Do not automatically reuse GET retry rules for mutating submissions. Reconcile uncertain POST outcomes by the API's supported identifiers/status semantics; uncontrolled resubmission can duplicate requests. Intake documentation specifically discusses retrying the same submission within its valid window and obtaining a new location after expiry under the documented conditions.

### Production review evidence matrix

| Review item | Evidence available | Exact gap / next evidence |
| --- | --- | --- |
| API/use-case selection and eligibility | Public-reference research product is visible; official request form distinguishes API grant categories. | State the actual scope. Supply organization identity, US-based-company answer, employee/active-ATO answer, intended users, authorized roles, and VA-confirmed eligibility for each chosen restricted API. Do not infer universal US-location/ATO eligibility rules from a questionnaire alone. |
| Sandbox implementation/proof | Repository #189 record links Forms/Reference run 33997305230 with HTTP 200s, request IDs, and result counts. | Verify lineage/time/artifacts for the current integration. No authenticated Ratings/Claims or Intake lifecycle sandbox proof was supplied. |
| Production request, review, demonstration, grant | Official process is sandbox → request → review/changes → demo → grant; #287 remains open in repository. | Approval and requested changes are external. Demonstrate actual implemented features, privacy boundaries, fallback/outages and accessibility limitations. A working local build does not satisfy grant approval. |
| Terms and API-specific attestations | Official request includes terms; API metadata advertises Intake attestation/ethics and Claims/service-history ethics requirements. | Provide accepted/current terms and exact API-specific attestations. Confirm eligible Intake end users directly with VA; do not substitute an unverified truncated search snippet for the full eligibility policy. |
| Section 508 answer | Manual workbook exists; automated checks and one browser defect observed. | Human keyboard, assistive technology, zoom/reflow, contrast, forced colors, validation and status coverage, finding retests and reviewer sign-off on an identified build. No honest full-conformance claim yet. |
| OAuth registration/callback for applicable APIs | No implementation/evidence supplied. | VA-approved grant, client type, scopes, exact registered HTTPS redirect URIs (documented local-development exception only), short-lived one-use state/verifier transaction, token/error lifecycle and authorized user/representative binding. |
| Token refresh/revocation | None found because OAuth capability is absent. | Obtain the issued grant's documented lifetimes, refresh support/rotation and revocation/logout contract. Do not invent a VA refresh duration or claim a nonexistent implementation is robust. |
| Data protection and consent | Local raw-document processing and encrypted workflow cookies are implemented; policy exists but has contradictions. | Accurate data-flow inventory, host logs/body/query capture and retention controls, tracing exception sanitation, key management, and separate informed consent/privacy review before transmitting documents/identity to VA. |
| Quota/outage handling | 60/min published guidance; shared budget, fallback, retry and circuits implemented with reproduced flaws. | Confirm issued consumer scope and reset semantics; fix fencing/command validation/leases; record multi-instance failure-mode and boundary timing evidence. |
| Deployment/operations | Build and local headers/auth failures checked; repository references runtime readiness. | Current approved build identity, edge XFF/allowed-origin/WAF rules, server coordinator settings, credential secret management, incident contacts, access/log retention and live authorized connectivity checks. These settings cannot be inferred from source. |
| Production source claims | Runtime acknowledgement and source-status DTOs exist. | Do not label fallback/cache content as newly verified production connectivity. Apply loader schemas and effective flags to every cache tier. |

### PKCE recommendations versus verified VA requirements

Official indexed Claims ACG guidance states that a client unable to safely store a client secret, such as a native mobile app, uses PKCE, and references RFC 7636. This does not impose PKCE on Forms or Intake API-key calls. For a new applicable ACG design, S256 PKCE, cryptographically random state, exact redirect allowlisting, one-use callback transactions, minimal scopes, server-held tokens, and OIDC nonce/issuer/audience verification when ID tokens are actually used are recommended security controls. Confirm all provider-specific details with the approved VA registration; do not label every recommendation a VA-specific mandatory clause.

The public request form's Section 508 and organization/ATO questions were inspected without filling or submitting it. Published timings and current delay notices are estimates, not a delivery guarantee. Neither current delays nor normal review windows remove the need for approval.

## 6. Actionable Remediation Plan — sequencing and acceptance checks

No code fixes below were applied. Local remediation can be prepared under the freeze, but release operations must remain unperformed until authorized and permitted.

### Step 1 — scope and evidence gates (P0)

Choose either the narrow Forms/Reference production request or a separately designed veteran-specific phase. Reconcile #189/#195/#213/#287 status and remove stale blocker statements from the submission packet without inventing external closure. Obtain sanitized approvals/configuration evidence, not secrets or real records.

**Acceptance:** A versioned API/grant/scope matrix matches actual implemented routes and demo features; the exact submitted request, terms/attestations and external decision are recorded. Existing disabled defaults remain disabled until the applicable approved activation procedure. No “all four APIs ready” claim from public-reference tests.

### Step 2 — deterministic recommendation collections (P1)

Separate direct contributions and intermediate paths at accumulation time. For each target, collect all direct edges and all paths, deduplicate deterministically, aggregate source references/consensus under a written policy, then select direct versus path-only scoring. A later direct edge must not leave a synthetic pathway contributor in the direct score.

**Acceptance:** Mixed synthetic example produces the same documented direct score under both orders; path-only example produces the same chosen aggregation under every order. Distinct provenance and consensus are invariant as well. Include diagnosed targets, empty/unmapped cases, draft/association exclusions, and permutation tests over representative real published inputs. No unsupported count of real affected cases.

### Step 3 — fenced circuit recovery and atomic coordination (P1)

Add generation and absolute retry-not-before to markers and admission context. Make success close only the matching current admitted recovery generation. Validate KV transport and command-level outcomes. Use atomic token compare/delete and guarded marker/probe transitions; propagate publication failure into a deliberate safe fallback/control decision.

**Acceptance:** A success admitted before a later 429 cannot clear it. A stale owner cannot delete a replacement lease between reads/writes. HTTP 200 command errors cannot be reported successful. Short and long Retry-After deadlines behave consistently across instances. Probe rejection, coordinator outage, process death, clock skew, abandoned requests and recovered matching probe have explicit tests.

### Step 4 — measured pacing, route coverage and total deadlines (P1/P2)

Confirm consumer quota semantics, align budget scoping and conservative pacing, validate integer command results/expiry, cover every route reaching public-reference loaders, and verify edge identity normalization. Treat single-flight as best effort or deliberately redesign it to a documented guarantee. Set one logical deadline covering fetch retries and KV work; align lease life/renewal with that deadline.

**Acceptance:** A fake-clock burst/boundary test and multi-instance failure test demonstrate the selected quota policy, every attempt reserves a slot, and fallback completion time is measured within the target hosting request budget. All actual loader routes have mapped inbound controls. No production flooding or silent fail-open quota path.

### Step 5 — browser OCR/CSP and parser integrity (P1)

Use a validated same-origin worker path configuration compatible with strict production Trusted Types. Consolidate DD-214 extraction with shared resource-limited PDF/OCR helpers. Add page-level mixed-PDF fallback, limits applied before accumulation, canvas/image caps, cancellation/unmount teardown and accurate partial-extraction messaging. Minimize or clearly qualify raw identifier preview/redaction claims.

**Acceptance:** Through the production browser interface, synthetic image, scanned PDF and mixed PDF complete successfully under CSP/TT; no cross-origin document payload is sent. Oversized image/page/text and worker failure return bounded partial/failure states; cancellation terminates workers/tasks and cannot save late results. Screen-reader announcements and manual input remain usable. CSP/TT is not globally weakened.

### Step 6 — schema-complete cache and kill-switch semantics (P2)

Apply loader-specific Zod schemas, query/parameter matches, environment/provenance/link policies, and matching envelope byte limits. Check effective service flags before cache lookup and after waits as appropriate.

**Acceptance:** Wrong-shaped `items`, invalid dates, incorrect query/ZIP, cross-environment data, untrusted links, oversized envelopes and command errors produce safe misses/fallbacks. Disabling the directory shows no cached live directory if that is the documented disable contract. No fabricated authentication assurance from an envelope version.

### Step 7 — truthful privacy and reliable cleanup (P1/P2)

Inventory events and all error sinks; route operational exceptions through explicit code-controlled schemas; prevent raw SDK exception exports. Reconcile policy/submission docs with count events, workflow server processing, URLs and cached lookup values. Cancel/fence extraction before finish/restart, attempt all storage removals, and show a clear warning when erasure cannot be confirmed.

**Acceptance:** Synthetic PHI sentinels do not appear in application stdout, error paths, exception traces, CSP reports, proxy/access logs or optional collector payloads. Verify the platform sinks, not just unit redaction functions. Document allowed events, retention, access and correlation. Delayed work cannot repopulate cleared storage; cookie removal and local cleanup outcome are reported separately.

### Step 8 — graph invariants and deployment packaging (P2)

Document separate association research and causal-chain invariants. Enforce chosen DAG constraints at runtime load and CI, retaining explicit human-reviewed governance rather than deleting legitimate medical relationships solely to eliminate cycles. Preserve two-hop and ancestor guards. Establish parity before expanding adjacency migration. Statically scope filesystem tracing and inspect generated package manifests.

**Acceptance:** Schema-valid cycle fixtures are rejected where DAG is promised; research cycles remain explicitly labeled/governed without circular causal inference. Publication/provenance and depth/association tests pass on both representations. Deployment manifests contain required data/assets but not an unintended whole-repository copy. Measure package size rather than claiming a speed improvement without timing.

### Step 9 — complete accessibility review (P0/P1)

Associate the DD-214 upload and free-text location inputs with durable labels. Review progress/status/error announcements, headings/landmarks, validation focus, file-input/disclosure keyboard paths and user-result contrast/reflow. Include `/pathways`, DD-214 OCR, directory searches and completion controls in the coverage matrix, beyond the current workbook routes.

**Acceptance:** Human reviewers record keyboard-only, NVDA/Chrome-or-Edge and VoiceOver/Safari observations as required by the project, zoom/reflow, contrast and forced-colors evidence on an identified build. All material FAILs are retested. No fabricated PASS from a title/source contract or an HTTP 200. A conformance report/VPAT may support procurement/review if required, but this audit does not invent a universal Lighthouse VPAT requirement.

### Step 10 — implement veteran-specific capabilities only as a separate reviewed phase

After confirmed API eligibility and scope decisions, design an identity-bound server session and provider-specific OAuth where applicable. Implement callback/state/PKCE, scopes/token/refresh/error/logout handling and resource authorization; then official DTOs and minimally required representative controls. Design Claims/Intake submission as an explicit consented transmission workflow with bounded streaming, signed-URL protection, conservative retry/reconciliation and correct receipt/status interpretation. Do not forward API keys to signed uploads or expose OAuth tokens in workflow cookies/client storage.

**Acceptance:** Sandbox end-to-end scenarios use official synthetic data/contracts and cover denial, expiry, replay, refresh races, logout/revocation, wrong-veteran/representative authorization, duplicate/uncertain submission, expired upload URLs, payload limits, polling failures and final receipt states. Approved registration/version/grant proof precedes production activation. Revised privacy accurately describes intentional document/identity transmission; there is no promise that uploaded records never leave the browser.

## 7. Verification record and limitations

All local checks used Node **22.23.2**, matching the project's Node 22 engine. Current dependencies include Next **16.3.8**, React **19.2.8**, Vitest **4.1.11**, and Zod **4.5.4**.

| Check | Observed result | Interpretation |
| --- | --- | --- |
| Focused existing audit-related tests | 11 files / 93 tests passed | Narrow behavioral/source coverage, not full browser or fleet proof. |
| Ten temporary synthetic defect probes | 10/10 passed as observation assertions | These assert demonstrated bad behavior, not safety. Probes removed; results described in B05–B07 and A03–A05/A08. |
| Final full Vitest run after probe removal | **281 files / 2,048 tests passed**, exit 0; 26.23 seconds reported | Existing suite passes despite reproduced uncovered cases. |
| Final typecheck | Passed, exit 0 | Static consistency, not behavioral safety. |
| Final ESLint | Exit 0, zero errors, five warnings | Warnings: unused items in E2E/session-write-failure/VA-cache-management code. No suppressions added. |
| Documentation checks after report creation | Three files / 109 tests passed, exit 0; all 58 report-local file links and line-range bounds checked | Report saved with every requested section. This does not independently validate external approval or conformance claims. |
| Final production build after probe removal | Passed, exit 0 | All routes dynamic; whole-project graph trace warning and workspace-root/lockfile warning remain. |
| Catalog/KB validation | 819/819, no errors | Includes draft-only single-unverified-citation quarantine warnings, not clinical verification. |
| Authored CRG audit | REVIEW; 13 cycles, four bidirectional pairs, 29 redundancy; no hard violations, untruncated | Not a DAG PASS. |
| Adjacency preview audit | PASS; three nodes/three edges | Only this small separate representation is acyclic. |
| Master registry audit | PASS, counts in §1 | Referential/registry integrity, not medical qualification of every reference. |
| Runtime-only dependency audit | Exit 0, zero advisories | Registry advisory snapshot, not proof of no exploitable code defect. |
| Full dependency audit | **Exit 1**, five high package entries in one advisory chain | Open development-tooling debt; not reported as passing. |
| Production-mode local HTTP | Health 200; `/presumptive`, `/pathways`, `/va-forms/finder` 200 with CSP/private no-store page behavior | VA disabled. Health did not have a cache-control header in this check. No live production VA connectivity proven. |
| Synthetic prefetch-header request | 200 with CSP | Old prefetch exclusion allegation is not current. |
| Synthetic CSP-report POST | 204, empty response body | Response behavior checked; this alone is not proof of log sanitation. Source and existing tests provide separate evidence. |
| Unauthorized local admin/preflight calls | 401 each | Supports endpoint authentication; does not exhaust deployment/auth policy. |
| Production-mode browser DD-214 image | Visible TT blob-worker rejection; upload accessible name only “Choose File” | Functional/accessibility failures, despite successful unit/build checks. |

The owned loopback server on port 3123 was stopped after browser/HTTP checks; unrelated servers were not stopped. Local test/build logs and audit JSON were retained in session temporary files, not committed. The final report is the persisted audit artifact. Production services/credentialed API paths were not invoked.

### Missing evidence to request — sanitized only

1. VA approval/request correspondence naming eligible API versions, grants, scopes, intended users and any required attestations/agreements; terms and demo feedback.
2. Registration metadata showing exact redirect URIs, client type, issuer/endpoints and allowed scopes; official issued refresh/revocation behavior. **Do not provide client secrets, API keys, access/refresh tokens or real ICNs.**
3. Identified deployed commit/build, sanitized production smoke results and coordinator configuration/health/failure evidence, including shared consumer key scoping and host request-duration limits.
4. Edge WAF/forwarded-header/allowed-origin policy, platform request/body/query logging settings, retention/access/export controls, optional LangSmith/OTel enablement and sanitized collector evidence.
5. Completed manual accessibility workbook and retest sign-off on the exact approved build; clinical reviewer dispositions for unresolved sources/association cycles and redundancy where appropriate.

Source audit cannot substitute for these settings or human/external evidence. Do not request real records to resolve an audit uncertainty. No broad production-readiness, legal/privacy, HIPAA, Section 508, or VA approval certification is made.

## 8. Official sources and self-audit

### Official sources used

- [VA production access process](https://developer.va.gov/production-access) and [request production access](https://developer.va.gov/production-access/request-prod-access): process, form questions, API categories, terms and accessibility answer. Inspected in the browser without submission.
- [VA working with APIs](https://developer.va.gov/about/working-with-va-apis) and [official FAQ](https://developer.va.gov/support/faq): published 60 requests/minute and 429 guidance. Exact rolling/reset semantics for this consumer were not established.
- [Claims ACG documentation](https://developer.va.gov/explore/api/benefits-claims/authorization-code): official indexed PKCE/secret-storage wording and redirect guidance. The detail SPA did not reliably render; no unobserved token lifetime/rotation behavior is inferred from it.
- [Official provider registry](https://developer.va.gov/platform-backend/v0/providers/transformations/legacy.json?environment=sandbox): API authentication categories and advertised API-specific attestation metadata.
- [Forms metadata](https://api.va.gov/internal/docs/forms/metadata.json) and [Forms v0 OpenAPI](https://api.va.gov/internal/docs/forms/v0/openapi.json).
- [Benefits Claims metadata](https://api.va.gov/internal/docs/benefits-claims/metadata.json) and [non-VA v1 OpenAPI](https://api.va.gov/internal/docs/benefits-claims/v1/openapi.json): eligible version distinction, OAuth operation scopes, representative headers/POA and submitted-versus-established semantics.
- [Benefits Intake metadata](https://api.va.gov/internal/docs/benefits-intake/metadata.json) and [Intake v1 OpenAPI](https://api.va.gov/internal/docs/benefits-intake/v1/openapi.json): API key, signed URL/15-minute window, payload limits, receipt/status and excluded VHA/CHAMPVA forms.
- [Veteran Service History and Eligibility metadata](https://api.va.gov/internal/docs/veteran-verification/metadata.json) and [v2 OpenAPI](https://api.va.gov/internal/docs/veteran-verification/v2/openapi.json): ratings/summary endpoints/scopes, ACG/CCG, ICN launch context and CCG production eligibility limits.
- [Next.js data security guide](https://nextjs.org/docs/app/guides/data-security): Server Action POST reachability, input validation, independent authorization, server-only guards, legal client action references and built-in origin protections.
- [Next.js Proxy reference](https://nextjs.org/docs/app/api-reference/file-conventions/proxy): Node.js default runtime, matcher/Server Function coverage and headers-before-Proxy execution order.

Public `internal/docs` URLs above served unauthenticated documentation, not privileged VA records. Some VA detail SPAs yielded only shells; readable published OpenAPI/metadata was used instead. Intake description examples and version labels can diverge: use the selected OpenAPI paths rather than inventing a v2 application path from prose. Documentation can change after this audit.

### Contradiction and hallucination checks before delivery

- **No universal PKCE claim:** Forms and Intake API keys are distinguished from OAuth Ratings/Claims. ACG and restricted CCG eligibility are not interchangeable.
- **No fabricated OAuth assurance:** Absence of an implementation is reported as missing capability; redirect/refresh/logout robustness is not invented.
- **No whole-corpus DAG claim:** Authored CRG REVIEW and three-node adjacency PASS are separate. Runtime cycle acceptance does not imply infinite recursion because traversal has an ancestor guard and two-hop cap.
- **No direct-nexus promotion:** Association edges are not composed by the recommendation helper. Remaining score/provenance order bugs are demonstrated independently with valid causal fixtures.
- **No local-only overclaim:** Raw documents stay local in inspected flows; workflow context/service fields reach the server; new Intake intentionally transmits documents and requires changed consent/privacy.
- **No “no telemetry SDK” claim:** Automatic OTel export is disabled, optional LangSmith exists, operational stdout events exist, and host collection is unknown. No observed raw PHI exfiltration is invented.
- **No action-ID authorization claim:** Server Actions remain reachable POSTs; anonymous own-cookie workflows are distinct from account-bound privileged submissions. Client imports of use-server actions are legal.
- **No Edge assumption or nonce misuse allegation:** Next 16 Proxy defaults Node.js. Dynamic root rendering supports per-request CSP nonces. Header behavior was checked in the actual local production runtime.
- **No conformance from tests:** Manual Section 508 is unperformed; the browser upload-name issue and TT OCR failure are real findings even with all unit tests passing.
- **No quota semantic invention:** Boundary burst is measured against the implementation. Whether it violates VA's actual issued quota depends on unverified reset/window semantics.
- **No signed-upload key forwarding:** Intake control-plane apikey and signed PUT authorization are distinct. Upload/200 does not mean received or established.
- **No universal ATO/VPAT or approval timeline promise:** Questionnaire fields and published guidance are reported as such; organization-specific eligibility/review decisions require VA confirmation.
- **No advisory count inflation:** Five high dependency entries are one transitive development advisory chain, while runtime audit is clean. Build tracing is packaging scope, not proven public file disclosure.
- **No certification or release action:** Audit only; missing production/human evidence remains open. The freeze and shared-tree ownership boundaries were respected.

## 9. Local remediation status (2026-10-04, under the freeze)

Section 1 records the audit as performed on the tree as found. This section is the post-audit remediation log for local work done afterwards. It does not rewrite any finding, close any external gate, or assert production readiness, and no commit, push, PR, or deployment was performed. The §7 browser row that records the visible Trusted Types OCR rejection describes the pre-remediation state; this section supersedes it as current status.

### B05 (P1) — recommendation aggregation order dependence: FIXED (local)

- Direct contributions and intermediate paths are collected separately in [recommend.ts](../src/lib/engine/recommend.ts) before the documented score/provenance policy is applied; a later direct edge can no longer leave a synthetic path contributor in the direct score, and the existing-target branch now aggregates the second path's score, source references, and consensus instead of skipping them. Path-only targets sum unique path scores under the strongest bounded consensus, and recognition summaries keep input order.
- [recommend-order-invariance.test.ts](../tests/recommend-order-invariance.test.ts) exercises every permutation of mixed direct/path/path-only fixtures with diagnosed targets, consensus differences, and distinct source references.
- No count of real-corpus affected combinations is claimed; the synthetic cases are the evidence.

### B04 (P1) — Trusted Types broke browser-local OCR: FIXED (local, browser-verified)

The audit's reproduction was correct but the failure had two layers, and fixing only the first does not make OCR work:

1. **Document realm.** Tesseract defaults `workerBlobURL: true` and spawns `new Worker(URL.createObjectURL(blob))`, which the strict `default` policy refuses. All three OCR entry points (two in [Dd214LocalAnalyzer.tsx](../src/components/presumptive/Dd214LocalAnalyzer.tsx), one in [LocalEvidenceAnalyzer.tsx](../src/components/evidence/LocalEvidenceAnalyzer.tsx)) now spawn through `createLocalOcrWorker()` in [ocr-session.ts](../src/lib/evidence/ocr-session.ts) with `workerBlobURL: false` and root-relative `/tesseract/` paths, so the worker script is a direct same-origin URL.
2. **Worker realm.** Pointing `workerPath` at `/tesseract/worker.min.js` is still not enough: the worker realm enforces `require-trusted-types-for 'script'` (the `/tesseract/*` responses carry the same policy), a worker does not inherit the document's policy *object*, and the pinned Tesseract worker loads its WASM core with `importScripts(corePath)` — a TrustedScriptURL sink. That produced `Failed to execute 'importScripts' … This document requires 'TrustedScriptURL' assignment` and OCR still failed. `workerPath` now points at `/tesseract/worker-guard.js`, provisioned by [copy-pdf-worker.mjs](../scripts/copy-pdf-worker.mjs) into the gitignored `public/tesseract/` directory: it installs a realm-local `default` policy narrowed to same-origin `/tesseract/*` script URLs (`createScript`/`createHTML` refuse; no other origin or path) and then imports the pinned `worker.min.js`. Non-enforcing browsers skip the policy; a failed policy creation surfaces at the `importScripts` sink instead of hanging the worker.
3. **CSP.** [proxy.ts](../src/proxy.ts) now emits `worker-src 'self'` (the previous `blob:` allowance is removed so a regression to blob spawning fails in every browser, not only TT-enforcing ones). Chrome also reported the quoted `'nextjs'` and `'dompurify'` entries in `trusted-types` as invalid policy names on every production page load and refused both policies; the directive is now `trusted-types default 'allow-duplicates'`. Client-side navigation was verified violation-free under that stricter configuration because Next.js's route loader tolerates its own policy failing and its plain chunk URLs then ride the `default` policy.

**Browser verification (production build, `next start`, Chromium, VA/LangSmith disabled):** a synthetic DD-214 PNG was selected on `/presumptive`; extraction completed with **"DD-214 text extracted locally"** and parsed duty stations (`CAMP HUMPHREYS`, `SAN ANTONIO, TEXAS`) — no Trusted Types refusal, `data-tt-ready` set. A client-side navigation (`/` → `/secondary`) produced zero console errors. Response headers showed `require-trusted-types-for 'script'`, `trusted-types default 'allow-duplicates'`, and `worker-src 'self'`.

**Residual console output on the OCR path (not failures):** the pinned libraries attempt two string-to-code operations that the browser logs and then catch — webpack's `new Function("return this")` global detection in `worker.min.js`, and Emscripten's single-file build trying `fetch()` of its embedded `data:application/octet-stream;base64,` wasm fallback, which `connect-src 'self'` refuses before the loader decodes the base64 inline. OCR depends on neither path succeeding, and neither is a successful sink assignment. They are recorded rather than hidden because they are browser-visible console errors; silencing them would require weakening CSP or patching vendored assets.

**Regression coverage:** [local-ocr-worker-spawn.test.ts](../tests/local-ocr-worker-spawn.test.ts) executes the factory against a mocked module boundary, pins the guard provisioning and its `/tesseract/`-only policy, and fails if any OCR entry point constructs its own blob-capable worker; [csp-trusted-types.test.ts](../tests/csp-trusted-types.test.ts) pins `worker-src 'self'` and the unquoted policy-name form.

### B04b (new finding, P1-class) — pdf.js modern build is unusable on older browsers: FIXED (local)

Found while exercising B04's acceptance criterion ("synthetic image, scanned PDF and mixed PDF complete successfully under CSP/TT"). The pinned `pdfjs-dist@6.3.289` **modern** build requires very recent engine APIs that the audit's production browser (Chrome 130 / Electron 33) does not implement:

- the modern **worker** fingerprints documents with `Uint8Array.prototype.toHex` (Chrome 140+), so every PDF load failed with `n.toHex is not a function` (reproduced with a synthetic scanned DD-214 PDF);
- the modern **main** build then failed with `getOrInsertComputed is not a function` (the `Map`/`WeakMap` proposal helpers, also Chrome 140+).

[copy-pdf-worker.mjs](../scripts/copy-pdf-worker.mjs) now serves the legacy worker (which bundles the core-js polyfills), and [document-extract.ts](../src/lib/evidence/document-extract.ts), [Dd214LocalAnalyzer.tsx](../src/components/presumptive/Dd214LocalAnalyzer.tsx), and [LocalEvidenceAnalyzer.tsx](../src/components/evidence/LocalEvidenceAnalyzer.tsx) import the matching legacy main build. The two PDF-cleanup tests' mock specifiers were moved to the same path so a silent switch back to the modern build fails the suite; [evidence-document-ingestion.test.ts](../tests/evidence-document-ingestion.test.ts) pins the legacy worker source. This is a real compatibility defect for older devices, not a cosmetic change; no CSP was weakened and no vendored asset was patched.

**Verification (same production build and browser that failed before):** a temporary probe importing the served legacy build resolved `getDocument` in **36 ms** and `getPage` in **1 ms** (previously an explicit `toHex`/`getOrInsertComputed` failure), and a 2200×1040 canvas — the exact input shape the scanned-PDF path feeds to OCR — was recognized through the guarded Tesseract worker in **1.37 s** with correct text.

**Verification limitation (environmental):** the full scanned-PDF UI journey could not be completed inside the automation panel because `document.visibilityState` is `hidden` there and the hidden tab never fires `requestAnimationFrame` — verified directly (`raf-timeout` while timers fire) — and pdf.js schedules rendering via rAF, so `page.render()` never settles. This is an automation-panel constraint, not a product defect: the image path completed end-to-end in the same panel, and every pdf.js/OCR stage is exercised above. A human or visible-browser pass should still confirm the scanned/mixed-PDF journey on an identified build (already listed in the manual workbook).

### B01 (P0) — veteran-specific integrations: sandbox read-only account phase implemented in code

A disabled-by-default, sandbox-only read-only phase (OAuth/PKCE + ID-token verification, veteran self-service ratings summary and Claims status, atomic single-use state, refresh/revocation lifecycle) now exists in code and is documented in [va-account-sandbox.md](va-account-sandbox.md). Live fail-closed checks in the production build returned 200 for `/va-account` and 503 for `/va-account/oauth/ratings/start` with VA flags off. This is **not** a claim that veteran-specific capability is delivered: no real VA registration, no live OAuth sign-in, no production grant, and the phase is not enabled anywhere. B01's production scope remains open pending B02.

### B02 (P0) — VA production access and deployment proof: still external

No sanitized grant/approval correspondence, registered sandbox client IDs, approved API/version/scope list, authorized connectivity evidence, or reviewed deployed KV/WAF/logging configuration was available. This cannot be closed by code; the gate process (separate grant approval and connectivity evidence, no circular enablement) is recorded in [external-manual-gates-status.md](external-manual-gates-status.md).

### B03 (P0/P1) — accessibility control defect: code part fixed, human review still open

- The DD-214 upload now has `id="dd214-file"`, a durable visible label (`DD-214 file`), and `aria-describedby` pointing at the existing help paragraph; the free-text location input now has `id="dd214-location-add"` and the label `Add a location (free text)` with an example placeholder. Verified in the production browser DOM and accessibility tree; [accessibility-ux-reliability.test.ts](../tests/accessibility-ux-reliability.test.ts) pins the association.
- The manual workbook remains **NOT TESTED** with no human sign-off, and [section508-manual-review-workbook.md](section508-manual-review-workbook.md) now covers the DD-214 image and scanned/mixed-PDF OCR paths, extracted-field verification, `/pathways`, `/va-account`, and workflow completion controls. Keyboard-only, screen-reader, contrast, reflow, and forced-colors evidence on an identified build (#195) remains a human gate; no conformance claim is made.

### B06 (P1) — distributed cooldown fencing and Retry-After fidelity: FIXED (local)

- **Absolute deadline, not a fixed window.** [shared-circuit.ts](../src/lib/va/shared-circuit.ts) stores `circuit-deadline:{service}` (epoch ms) as the authoritative value alongside the marker JSON `{state, openedAt, deadline, generation}`; the gate compares the clock against that instant instead of the old fixed 60-second window. Legacy markers written without a deadline key are still read as `openedAt + 60 s` and are cleared through the same generation comparison, so a mixed-version fleet cannot lose an active cooldown mid-rollout. The marker and deadline keys share one TTL of `max(3600, remaining + 300)` seconds, so the deadline never expires before the cooldown it describes.
- **Retry-After honored exactly, 1 s–15 min.** `clampRetryAfterCooldownMs`/`clampSharedCooldownMs` replace the old 1–60 s clamp (`CIRCUIT_RATE_LIMIT_MAX_COOLDOWN_MS` is now 15 minutes); a ten-minute upstream `Retry-After` produces a ten-minute cooldown both locally and fleet-wide, and the request still returns its labelled local fallback immediately rather than holding the HTTP request open for the window. `parseRetryAfterMs` still parses delay-seconds and HTTP-date forms and rejects garbage; local and shared windows use the same clamp.
- **Extend-only publication.** Opening or refreshing a cooldown is one Lua script (`SHARED_CIRCUIT_EXTEND_DEADLINE_SCRIPT`) that returns 0 rather than shortening a deadline already in force, so a late failure from a request admitted earlier can never cut a newer, longer backoff.
- **Fenced recovery.** `evaluateVaOutboundCircuit` returns `{decision, localVersion, sharedMarker}` and all four outcome paths in [sandbox.ts](../src/lib/va/sandbox.ts) pass that admission back to `recordVaOutboundCircuitOutcome`. Only a success with `probeAdmitted` attempts shared recovery, and `SHARED_CIRCUIT_CLEAR_SCRIPT` removes the marker and deadline only when the stored marker string equals the generation the probe observed (returns -1 for a newer marker); a probe success with no admission is treated as "observed no marker", so the compare-and-delete refuses any cooldown that now exists. The local success path is fenced the same way through the admission's `localVersion`.

**Regression coverage:** [va-outbound-circuit.test.ts](../tests/va-outbound-circuit.test.ts) (absolute deadlines, extend-only, exact long-Retry-After windows, stale/ordinary-success refusal, Redis-body-error handling) and [va-fleet-simulation.test.ts](../tests/va-fleet-simulation.test.ts) (429 flare → one fleet probe → phase 5 where a newer cooldown survives a stale probe success).

### B07 (P1) — shared coordination false-success and ownership races: FIXED (local)

- **Command results validated, not transport status.** Shared publish, recovery and lease release now validate the Redis payload result and reject `{error}` bodies served at HTTP 200, as well as unexpected result values. A failed publication reports false and writes no marker; a failed gate read still reports `unavailable` and the caller fails closed without an upstream attempt. [fake-shared-kv.ts](../tests/helpers/fake-shared-kv.ts) grew `failCommand()` so the HTTP-success/command-error case is reproduced by the same script bodies production sends.
- **Atomic compare-and-delete ownership.** Probe-lease and fetch-lease releases use `SHARED_CIRCUIT_COMPARE_DELETE_SCRIPT` (single Lua compare-and-delete) instead of GET-then-DEL, so a lease that expired and was re-claimed by another instance between the read and the delete is never cancelled by the old owner; publishing a cooldown releases only this instance's own lease.
- **Lease lifetime aligned with the logical fetch.** `VA_SHARED_FETCH_LEASE_MS` is now 120 s (was 45 s), covering three 30 s attempts plus inter-attempt backoff and the shared write, so contenders cannot start a duplicate fetch while a legal winner is still running. Single-flight remains documented best-effort deduplication; the shared consumer budget remains the fail-closed quota control.

**Regression coverage:** [va-outbound-circuit.test.ts](../tests/va-outbound-circuit.test.ts) (HTTP 200 `{error}` on GET → fail-closed; on EVAL → failed publication with no partial write; CAD release never deletes a replacement lease), [va-shared-single-flight.test.ts](../tests/va-shared-single-flight.test.ts) (a re-claimed lease survives the old owner's release), and [va-fleet-simulation.test.ts](../tests/va-fleet-simulation.test.ts) (lease claims and releases counted through the CAD script across the 40-instance storm).

### Verification record for this remediation

| Check | Observed result |
| --- | --- |
| Full Vitest suite | **283 files / 2,090 tests passed, exit 0** (2026-10-04) |
| B06/B07 coordination suites | 3 files / 34 tests passed, including four new B06/B07 regression tests (`va-outbound-circuit`, `va-fleet-simulation`, `va-shared-single-flight`) |
| Typecheck | Exit 0 |
| ESLint | Exit 0, zero errors, five pre-existing warnings (unrelated files) |
| Production build, all VA/LangSmith flags off | Exit 0; `/va-account` and `/va-account/oauth/[service]/[operation]` dynamic routes present |
| Production-mode browser DD-214 image OCR | Extraction completed through the UI under enforced Trusted Types; no refusal |
| Production-mode client-side navigation | Zero console errors under `trusted-types default 'allow-duplicates'` |
| HTTP header inspection | `require-trusted-types-for 'script'`, `trusted-types default 'allow-duplicates'`, `worker-src 'self'`; page responses `private, no-store` |

Local checks used Node 22.23.2 and the running app with VA, sandbox, and LangSmith integrations disabled. Synthetic data only; no veteran records, credentials, or VA transactions. Steps 3, 4, 6, 7, 8, the human part of 9, and 10 of the remediation plan remain open as recorded above.
