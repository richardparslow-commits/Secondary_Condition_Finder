# Security & Systems Audit — VA Lighthouse Production Readiness

**Audit date:** October 3, 2026  
**Audited checkout:** `catalog-v2-movement-identities`, commit `76e7868f193f19e5b0114534a2a802f347cfd732`  
**Disposition: NO-GO for an unqualified production-readiness submission or enabling additional Veteran-specific APIs.**

This is an engineering audit, not a VA approval, Section 508 certification, clinical review, legal determination, or penetration-test attestation. Severity describes engineering impact; a submission blocker is not necessarily an exploitable critical vulnerability. No application code, dependencies, credentials, production configuration, or knowledge-base data were changed. Temporary synthetic tests were removed after execution. This report is the sole retained change. No commits, pushes, PRs, deployments, or credentialed VA calls were performed. The existing deployment freeze remains in effect.

## 1. Executive conclusion and corrected project assumptions

The project has strong foundations: authenticated encryption of workflow cookies, server-enforced expiry, fail-closed production secret handling, catalog/schema validation, publication filtering, browser-side document extraction, bounded two-edge pathway traversal, public-reference fallbacks, immutable CI action pins, and a final CI failure aggregator.

However, the code and its privacy/security/submission claims materially disagree. Priority findings include ineffective scoped-cookie deletion, undisclosed full-text OCR checkpoints, a raw evidence console log, non-local-guaranteed speech recognition, uncoordinated upstream quotas in distributed production, bypassable proxy enforcement, and order-dependent recommendation scoring. Dependency auditing also fails today.

Three premise corrections are essential:

1. **Actual counts are 817 catalog conditions / 817 mappings, 677 drafts, and 140 published mappings**, not 813/673. There are 870 authored edges, of which 248 are published.
2. **The authored graph is not a DAG.** The structural audit currently reports 13 cycles, four bidirectional pairs, and 29 transitive-redundancy conflicts. Runtime paths are separately bounded and reject repeated nodes; graph cyclicity does not establish an infinite-loop vulnerability.
3. **The repository's current production request is only VA Forms and Benefits Reference Data.** Its [production package](phase3-production-access-package.md) explicitly excludes Claims, Intake, Documents, health, and authenticated Veteran account access. The broader requested target in this audit is therefore a future scope, not an implemented upgrade awaiting credentials.

**Go/no-go by scope:**

| Scope | Assessment |
|---|---|
| Anonymous research tool with VA network disabled | Can continue as a development baseline, but privacy/deletion and recommendation defects need remediation; do not call it fully production-ready. |
| Forms + Benefits Reference Data production access | Not ready for an unqualified submission: correct claims, repair controls, complete evidence, and obtain VA approval. |
| Disability ratings + Benefits Claims + Benefits Intake | Not implemented or onboarded. Requires new API-specific architecture, authorization/data-flow review, contracts, tests, and demo evidence. |

## 2. Verification performed

### Current local results

| Check | Result |
|---|---|
| `npm test` | **1,857 tests passed in 265 files** |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, **five warnings**, zero errors |
| Production build with VA/LangSmith disabled | Passed; **16 Edge-runtime warnings** from instrumentation importing Node filesystem loaders, plus an outside-root lockfile warning |
| `npm run kb:validate` | No errors; 24 draft-only single-unverified-citation warnings |
| `npm run citations:audit` | No hard/review findings under existing ratchet; 1,690 references, **395 live verified / 1,295 unverified**, six retired verified references tracked separately |
| `npm run audit:crg` | **REVIEW**, exit 0 by design; review debt 13/13, redundancy debt 29/29 |
| `npm run audit:crg:graph` | Exit 0 with explicit **vacuous audit** warning at audit time: none of 817 files used its adjacency schema. Post-audit (same day) the graph directory `data/knowledge-base/graph/` gained its first edge-free node, then its first real authored edge (`liver-cancer` → `sarcopenia`, ASSOCIATION_ONLY on preflight-cleared PMIDs, with the `sarcopenia` identity added as staged Leg A of the signed 2026-09-29 migration design), the loader/entry point landed, and the gate now runs hard over live graph data — see `docs/crg-adjacency-migration-checklist.md` |
| `npm run test:composition` | Passed; executable imports cover its 14 listed critical modules. This is not exhaustive behavior coverage. |
| `npm run audit:me-compliance` | No violations; four bidirectional-pair review warnings |
| `npm run evidence:architecture` | Dry-run, no writes; all references have explicit authority categories; proposition roles remain unauthored informational findings |
| `npm audit --audit-level=high` | **FAILED: six high + one critical vulnerability** |
| `npm audit --omit=dev --audit-level=high` | **FAILED: one critical Next.js advisory** |
| Additional temporary audit checks | **19 passed**, across three temporary files; mock-network, public-corpus, and loopback production tests described below |

The local toolchain actually used **Node v24.16.0**; the declared/CI baseline is Node 22. Repeat release validation on Node 22. I did not rerun the full ChromeDriver journeys or human assistive-technology tests. Loopback production HTTP checks are not equivalent to a full browser E2E or production-host review.

### Reproductions that corroborate findings

- Installed Next response-cookie implementation emitted `Path=/` when deleting cookies written at `/secondary` and `/presumptive`.
- Actual loopback production restart action returned a **303** and a root-path tombstone; the original scoped cookie still restored the selected condition afterward.
- An ordinary production HTML GET with `next-router-prefetch: 1` returned HTTP 200 **without CSP**, while the normal request had CSP. Baseline `X-Frame-Options` remained present.
- An external `returnTo` reached the real Next redirect error/digest and the raw route reached stdout using a synthetic canary.
- Corrupt evidence JSON placed a synthetic document-content canary in the console warning.
- Finish/Restart storage cleanup left a full-text OCR checkpoint behind.
- Disabled production mode returned a shared-cache view marked `va-production-api` / `live: true`.
- Shared-cache reads accepted `NOT_A_VIEW` as a typed object; body processing exceeded 750 ms without abort.
- A configured KV allowed an upstream request without a shared budget operation. Two simulated cold instances each spent 60 request slots: **120 calls in the same quota interval**.
- Twenty half-open checks all admitted probes.
- HTTP 503 caused **three attempts**; HTTP 429 and 500 each caused one attempt then fallback.
- A 13-node all-`DIRECT_CAUSATION` cycle returned **PASS**, zero cycles, and `truncated.cycles: false` even under strict analysis.
- The accumulator produced scores **2 versus 1** for the same synthetic conditions in reversed primary order. A scan also found **51 order-sensitive combinations in the current published corpus**.

These tests demonstrate existing behavior, not that it is desirable. They used no real Veteran records or credentials and no real upstream API requests.

## 3. Critical blockers / release-priority findings

### B-01 — Broader API scope has no implementation or approval evidence

**Priority:** P0 for the requested Claims/Intake/rating expansion. **Confidence:** confirmed repository gap.

The [submission checklist](phase3-submission-checklist.md) requests only Forms and Reference Data. A source search found no authorization callback, `code_verifier`, `code_challenge`, access-token exchange, refresh-token lifecycle, or OAuth logout implementation. The only `oauth=true` reference is an outbound VA.gov walkthrough navigation—not an authentication integration.

The legacy [rating adapter](../src/lib/va/index.ts#L45) accepts an arbitrary configured URL and a made-up `X-User-Id`/Bearer exchange. No application caller was found under `src`; tests are not proof of real API connectivity. It is **not** a production Disability Rating implementation and is **not** a demonstrated remotely reachable SSRF endpoint.

**Required action:** retain the narrow public-reference request or establish a separate reviewed expansion. Identify the exact rating API/version/endpoint, approved auth model, scopes, consumer eligibility, and consent/representation model. Do not substitute manual user-entered ratings or a public disabilities terminology list for an individual Veteran's official ratings.

### B-02 — Privacy claims do not match speech, diagnostics, and retained data

**Priority:** P0 to correct assurances; high privacy concern where speech can run remotely. **Confidence:** source-confirmed and partly reproduced.

#### Speech is not guaranteed on-device

[VoiceInputTextarea](../src/components/secondary/VoiceInputTextarea.tsx#L88) and [ServiceHistoryForm](../src/components/ServiceHistoryForm.tsx#L83) instantiate browser `SpeechRecognition`/`webkitSpeechRecognition` and call `start()` without requiring `processLocally=true`, checking on-device availability, or preventing cloud fallback.

The former tells users speech is “processed locally”; the latter says “nothing is sent until you submit.” Both statements are unsupported. [MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally) states the default permits local **or remote** processing. Browser permission is not informed consent to an undisclosed external PHI processor. Browser-native speech service traffic is not safely governed by the app's JavaScript `fetch` allowlist.

[Permissions-Policy](../next.config.ts#L19) simultaneously declares `microphone=()`. This creates a functional/privacy contradiction: where the policy prevents recognition, voice fails; where the browser speech implementation can operate, the code does not guarantee local processing. **I did not activate a real microphone or demonstrate actual audio exfiltration.**

**Fix:** disable these voice features pending a reviewed boundary, or require positively supported on-device processing and language availability, with no remote fallback. Fail closed and offer typing. Provide accurate disclosure; stop/abort recognition on navigation and cleanup. Do not simply enable microphone access while retaining false local-only claims.

#### Evidence parse errors log raw record contents

[storage.ts:153–175](../src/lib/evidence/storage.ts#L153-L175) rereads malformed evidence storage and logs the first 500 characters as `rawPreview`. Parser exception messages can also include input fragments. [LocalEvidenceAnalyzer](../src/components/evidence/LocalEvidenceAnalyzer.tsx#L160) calls this path.

**Observed:** corrupt synthetic JSON produced document text in the warning. This is a **browser-console leak**, not proof the app transmits that content to Vercel or Azure. Console capture, support recordings, extensions, or future client error reporting can increase exposure.

**Fix:** log only a fixed event code and safe counters; never raw preview, filename, parser message, or excerpt. Show a generic user warning and clear malformed data safely.

#### Full OCR text survives documented completion cleanup

[ocr-session.ts](../src/lib/evidence/ocr-session.ts#L43) persists page/text segments and the document-name fingerprint, up to **2,000,000 JSON characters**, with `updatedAt` but no enforced expiry. [LocalEvidenceAnalyzer](../src/components/evidence/LocalEvidenceAnalyzer.tsx#L545) keeps a checkpoint after a dead-worker pause or interruption and clears it on ordinary completion. That intentional resume behavior does not make it harmless.

[local-state.ts](../src/lib/secondary-workflow/local-state.ts#L13) clears only four stores; the OCR checkpoint is missing. The [completion controls](../src/components/secondary/SecondaryWorkflowCompletionActions.tsx#L11) use that list. “Clear local evidence” also clears excerpts, not the checkpoint or all retained in-memory source state. The [privacy policy](../src/app/privacy/page.tsx) says temporary retention is only excerpts and describes clearing all four stores; it never discloses the fifth full-text store.

**Observed:** cleanup left `FULL_DOCUMENT_PHI_CANARY` in the checkpoint. No server egress from the checkpoint was found. Session storage is readable by any same-origin script and can persist through reload/session restoration; do not promise secure erasure merely because a tab closes.

**Fix:** one authoritative sensitive-state inventory; clear checkpoints on clear/finish/restart/source removal, enforce a short resume TTL, validate read size/segments, disclose full-text retention or remove it. Consider memory-only resume as the safer default.

### B-03 — Finish/Restart does not delete the scoped workflow cookie

**Priority:** P0/high privacy correctness. **Confidence:** reproduced through production HTTP and installed Next cookies.

[Secondary writes](../src/lib/secondary-workflow/session.ts#L159-L174) set `path: "/secondary"`, but clearing calls `jar.delete(WORKFLOW_COOKIE)` without a path. [Presumptive](../src/lib/presumptive/session.ts#L28-L47) similarly writes at `/presumptive` and deletes by name only.

**Exact contradiction:** cookie identity includes name, domain, and path. A `Path=/` expiration does not delete an existing `Path=/secondary` cookie. The policy promises deletion before redirect; the actual scoped cookie remains and can restore prior health selections. Expiry at 30 minutes remains effective—it does not implement immediate deletion.

**Fix:** emit a tombstone with the original scope, e.g. `jar.delete({ name: WORKFLOW_COOKIE, path: "/secondary" })`, or `set` the same scoped cookie with an empty value and `maxAge: 0`. Preserve relevant cookie attributes. Mirror the fix for presumptive state and expose a usable presumptive clear control if retained service history needs immediate deletion. Add a real cookie-jar/browser assertion after Finish, Restart, and reload.

Stateless encrypted cookies are replayable until expiry if copied. The present workflow is not a VA login session; account logout/revocation needs a separate server-side session design if authenticated APIs are introduced.

### B-04 — Distributed production does not enforce VA's consumer-wide quota

**Priority:** P0 before live reference activation; high availability/credential-quota risk. **Confidence:** reproduced.

[Official VA guidance](https://developer.va.gov/about/working-with-va-apis) states **60 requests per minute per consumer**, with rate-limit headers and a 429 when exceeded. The code grants 60/minute **per service, per process**, in [sandbox.ts](../src/lib/va/sandbox.ts#L125). [runtime-state.ts](../src/lib/va/runtime-state.ts#L12) promises production/distributed failure until a shared rate-limit/cache coordinator exists.

But [sandbox.ts:312–321](../src/lib/va/sandbox.ts#L312-L321) treats a configured KV URL/token as coordination. [The KV module](../src/lib/va/reference-shared-cache.ts) only does GET/SET of reference views; there is no atomic shared token budget, reservation, semaphore, or circuit lease. It need not be reachable for this gate to allow VA calls. The local reference cache is intentionally **disabled** in production, so its 32-entry bound/hit rate does not protect shared-cache misses there.

**Reproduction:** two simulated cold instances sent 120 requests in the same minute. Per-service budgeting may also exceed the aggregate consumer quota; exact credential/route quota partitioning must be confirmed with VA rather than assumed.

**Fix:** atomically reserve a consumer/credential-scoped request slot for **every attempt**, including retries, across all instances. Enforce upstream reset/remaining headers, single-flight fetches, negative/cooldown caching, and fail-closed behavior if coordination is unavailable. Add inbound abuse limits to public dynamic reference GET routes; currently the proxy's workflow limiter only covers POSTs. A shared GET/SET cache is not a global rate limiter.

### B-05 — Recommendation score depends on input order

**Priority:** P0/high claim-research correctness. **Confidence:** reproduced against synthetic and current published data.

[recommend.ts:98–208](../src/lib/engine/recommend.ts#L98-L208) interleaves direct contributions and intermediate paths per primary:

- If a chain creates the target first, it adds a chain-derived score/contributor; a later direct edge adds its weight and contributor.
- If a direct edge creates the target first, the chain branch merely appends a path then `continue`s; it adds neither score nor contributor.

For the same diagnosed set and the same two service-connected primaries, `Cushing's syndrome → Hypertension → CKD` plus `Anemia → CKD` produced target scores **2 versus 1** when primary order reversed. The published-corpus scan found **51 combinations** with this discrepancy. This is not a clinical judgment about the literature: it is noncommutative accumulation of identical inputs. UI/catalog ordering can make one result reproducible without making the algorithm order-independent.

**Fix:** collect all direct and path evidence first, then derive each target's score/provenance once under an explicit policy. If paths are informational, they must never influence direct scoring; if paths contribute, count them consistently and avoid duplicate evidence inflation. Add permutation-invariance and direct-plus-chain tests. Do not change medical classification to conceal the bug.

### B-06 — Dependency audit is red despite green functional tests

**Priority:** P0 release/CI gate. **Confidence:** npm advisory result verified against maintainer publication.

[package.json](../package.json) pins Next **16.3.4**. The maintainer's [GHSA-vcvr-r3jv-pc5j](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j), CVE-2026-94545, affects Node `next/og` ImageResponse with attacker-controlled SVG content/attributes/styles; patch starts at **16.3.6**. No ImageResponse usage was found in application source. **Do not call this checkout demonstrably RCE-exploitable.** It nevertheless contains the flagged dependency and fails the enforced audit gate.

The full audit also flags six high-severity dependency instances in brace-expansion/braces/tooling chains; `--omit=dev` leaves only the Next advisory. Development/build vulnerabilities still belong in supply-chain remediation, but runtime reachability must not be inferred from their severity alone.

**Fix:** review compatible patched Next and matching tooling versions, update lockfile deliberately, re-audit and run Node-22/full release tests. Do **not** blindly use `npm audit fix --force`: its suggestion includes an eslint-config-next downgrade to 14.2.35. Historical green CI is not current advisory clearance. [.github/workflows/ci.yml](../.github/workflows/ci.yml) correctly fails the overall job if the audit step fails.

### B-07 — Accessibility and submission evidence are incomplete

**Priority:** P0 evidence/conformance gate; not an assertion that every page fails accessibility.

Every manual result in the [Section 508 workbook](section508-manual-review-workbook.md) is `NOT TESTED`, with no human sign-off. Issue #195 is documented open. The live official [production form](https://developer.va.gov/production-access/production-access-application) asks a **required Yes/No question**: “Is your application and website Section 508 compliant?” The explanatory page says “encourage” conformance; these are different statements. A required question does not prove “No” is automatically rejected, but **there is no evidence supporting an unqualified Yes**.

Complete criterion-by-criterion assessment and full workflows on the exact build. Automated source assertions, 200 responses, and a skip link are not a conformance determination. See Section 6 for observed UI issues and Section 7 for the exact official gap matrix.

## 4. Architectural vulnerabilities and additional findings

### A-01 — Caller-controlled prefetch headers skip security proxy

**Priority:** P1/high control bypass; deployment impact partially verified.

[proxy matcher](../src/proxy.ts#L288-L297) skips any request carrying `next-router-prefetch` or `purpose: prefetch`, without a method constraint. The header is not an authorization property.

**Observed:** a normal HTML GET with `next-router-prefetch: 1` had no CSP. Next's matcher test also excluded the request. The same exclusion skips proxy-only POST rate limits. Config-level baseline headers and Next's action-origin checks remain separate protections. This is **not** proof of a victim-exploitable XSS or a universal CSRF bypass.

**Fix:** run security enforcement for all sensitive routes/mutations regardless of prefetch markers; skip only optional performance work. Add ordinary/prefetch/header-spoofed HTML and Server Action HTTP tests. Place indispensable mutation limits in the action/route boundary as well as the proxy.

### A-02 — Open redirect and free-form log injection

**Priority:** P1/medium; confirmed.

[accredited-representatives.ts:32–58](../src/lib/actions/accredited-representatives.ts#L32-L58) takes `returnTo` directly from FormData, concatenates it into redirects on success and invalid ZIP, and logs it as `route`.

A synthetic `returnTo=https://attacker.example.invalid/PHI_CANARY` was accepted; the success redirect included `?zip=12345`. A hidden field is not a trust boundary. This enables externally directed navigation and arbitrary sensitive text entering server logs under an allowed key. Exploitation is not proven as cross-origin CSRF; the same-origin action protections still apply.

**Fix:** enum/allowlist of the actual local return routes; no schemes, protocol-relative forms, backslashes, query fragments, or arbitrary user strings. Build URLSearchParams only after route validation. Fixed route identifiers in logs. Test external/protocol-relative/encoded cases and all error branches.

### A-03 — Shared-cache trust and revocation semantics are broken

**Priority:** P1/medium-high assurance/availability.

1. [Shared reads](../src/lib/va/reference-shared-cache.ts#L123-L136) cast unvalidated JSON—or even a plain string—to `T`. A generic type annotation does not run validation. The value can supply UI links and trusted source labels. A corrupted/poisoned cache can therefore cause crashes or provenance/link spoofing; no public arbitrary cache writer was demonstrated.
2. [Forms](../src/lib/va/forms-finder.ts#L50-L60), [form reference](../src/lib/va/form-reference.ts#L59), [disability](../src/lib/va/disability-reference.ts#L60-L75), [service branches](../src/lib/va/service-branches.ts#L57-L72), and [representatives](../src/lib/va/accredited-representatives.ts#L63-L77) read cache before checking whether live access is allowed. Cache keys use requested environment, not effective mode or an access epoch. A disabled/revoked integration can still return a cached production-labelled view. The reproduced result involved **public reference data**, not unauthorized Veteran PHI access; it also does not prove a disabled flag sends a fresh request to VA.
3. [Cache-clear admin](../src/app/api/admin/cache-clear/route.ts#L49) only clears the process-local map. In production that map is unused, and shared data can immediately reappear. It is not a global invalidation control.
4. [fetchWithTimeout](../src/lib/va/reference-shared-cache.ts#L79-L90) clears its timer when headers arrive, before caller `response.json()`. A slow body can outlive the advertised 750 ms deadline. Reads have no serialized-size cap; writes alone have a 256 KiB bound.
5. Fire-and-forget cache writes (`void writeVaSharedReferenceCache`) are not guaranteed to finish before serverless teardown. Shared key count/cardinality is not globally capped by the local LRU limit.

**Fix:** activation checks before any shared read; strict versioned Zod envelopes with environment, retrieval/expiry and access epoch; bounded streamed body decoding under a whole-operation deadline; approved HTTPS links; shared invalidation/version bump; awaited or lifecycle-guaranteed writes; per-key single-flight and bounded query/key policy.

### A-04 — Privacy leakage through query keys, ZIP, automatic spans, and dishonest logging claims

**Priority:** P1. **Confidence:** concrete application paths, installed framework span behavior, deployment export unknown.

[Forms Finder](../src/app/va-forms/finder/page.tsx#L36) is a GET search. Free-form `q` is truncated to 120 characters but not constrained to public form identifiers. The server sends it to VA; the raw normalized value becomes a shared cache key and the cached view contains the query. [Shared-cache warnings](../src/lib/va/reference-shared-cache.ts#L116) log that key. If a user pastes personal/medical text, it crosses the boundary despite the intended public-only use case. Public metadata being non-sensitive does not make user search text non-sensitive.

The representative action puts ZIP in results URLs. [Its loader](../src/lib/va/accredited-representatives.ts#L35-L41) embeds ZIP/radius/type in the shared key and persists `params` with results. The privacy/UI claims that ZIP is not persisted and not in application logs are too broad: shared-cache failure logs contain the ZIP key. ZIP alone is a quasi-identifier, not automatically PHI; combined with sessions/routes it still needs truthful handling.

[Default OTel registration](../src/instrumentation.ts#L1-L5) has no project privacy span processor. The installed Next fetch implementation removes URL credentials but builds both span name and `http.url` from URL `href`, including query parameters. Thus Forms search and directory ZIP are eligible to enter automatic spans. The custom logger's key redaction does **not** sanitize those spans, gateway logs, WAF logs, or exporter settings.

[Audit events](../src/lib/observability/audit.ts) and [recommendation logging](../src/lib/engine/recommend.ts#L306) now emit workflow action/status/counts and recommendation counts. They do not ordinarily log condition names or evidence, but contradict the policy/package assertion that there is no application workflow/recommendation event logging. Stdout can be retained by the host even without a bespoke database.

[logger.ts](../src/lib/observability/logger.ts) blocks known field names recursively; it cannot protect PHI stored under `route`, `key`, `message`, or any unfamiliar name. Those exact escape routes exist above. [LangSmith](../src/lib/engine/recommend.ts#L360-L382) correctly transforms ordinary inputs/outputs to counts; do not claim raw intake is automatically exported. The installed SDK serializes thrown errors using `String(error)` independently, and exporter enablement/retention is not proven from source.

**Fix:** fixed event-schema allowlists, no arbitrary route/key/error strings; avoid sensitive search fields and URLs; use keyed query fingerprints only where needed, not as a substitute for consent; sanitize span names/URL attributes/exceptions before export; suppress sensitive fetch tracing where appropriate. Inventory Vercel/Azure/OTel/KV/LangSmith processors, retention, access, geography, deletion, and vendor commitments. Verify with a synthetic canary at the actual configured collectors. No actual exported Veteran PHI was observed in this audit.

### A-05 — Retry/circuit behavior is bounded but not globally resilient

**Priority:** P1/medium availability.

- [MAX_RETRIES=2](../src/lib/va/sandbox.ts#L40-L45) means **three attempts**, not the two stated in the production package. Default worst-case attempt time is roughly 12 seconds plus 100/200 ms sleeps and overhead—not a hard end-to-end bound.
- 429 and 500 immediately fall back; 503/504, timeout and network failure retry. Immediate fallback is a legitimate safe design, not itself a VA violation. The published docs claiming one 429 retry are wrong.
- No consumer-wide cooldown from `ratelimit-reset`/remaining or Retry-After; subsequent calls can immediately pressure the same service. No jitter, total deadline, or upper cap on configured timeout.
- Circuit state is process-local. [Half-open](../src/lib/va/circuit-breaker.ts#L31-L44) admits every caller, not one probe. Concurrent requests/cold starts can surge on recovery; older in-flight successes can reset a newer failure state.
- Upstream bodies/arrays are parsed without a byte/array ceiling before bounded rendering. Syntactically invalid JSON falls into network-error retry handling.

**Fix:** distributed request budget/cooldown and leased probe; total deadline, capped per-attempt timeout, jitter for retryable idempotent calls; distinguish parse/schema/network/auth/429 errors; enforce response size and item limits. Define 500 retry behavior explicitly. Resilience recommendations here are architectural controls, not a claimed VA-mandated circuit-breaker algorithm.

### A-06 — Redirects can leave the trusted upstream origin

**Priority:** P1/medium, conditional credential-exposure risk.

[sandbox.ts](../src/lib/va/sandbox.ts#L279-L294) validates the initial VA HTTPS origin well, but the [fetch](../src/lib/va/sandbox.ts#L391-L401) omits a redirect policy. Standard fetch follows redirects. A custom `apikey` header is not the same as the specially handled Authorization header; initial-origin validation is not validation of every hop.

There is no demonstrated attacker-controlled VA redirect, and no live key leakage was tested. Treat upstream redirection/misconfiguration as the prerequisite, not an existing arbitrary-URL exploit.

**Fix:** `redirect: "error"` for these JSON APIs, or strictly validate bounded manual redirects and never forward credentials across origins. Apply the same discipline to KV credentials. Test hostile redirects with a local mock, not real secrets.

### A-07 — Server Action validation is uneven and allows overposting

**Priority:** P1/medium correctness and abuse resistance.

Anonymous workflow actions intentionally operate on the caller's own cookie. **Lack of VA login is not an authorization bypass for the current anonymous research scope.** Future account/claim operations need action-level authentication and object/consent/representation authorization.

[appendFormData](../src/lib/actions/secondary.ts#L29-L43) merges *every* supplied field into state-derived parameters. Later-stage actions therefore allow posted `diagnosed`, `serviceConnected`, and earlier ratings to replace values derived from the current session. Their schemas can validate a self-consistent but wrong-stage state. This is overposting of the caller's own state, not proven cross-user access.

For example, a ratings submission can satisfy required fields for the current primary, then provide a different explicit `serviceConnected` set and diagnosed IDs that the parser accepts. UI-disabled/hidden fields do not prevent this.

Additional gaps:

- Several parsers run outside the action's guarded persistence catch. Unknown-only diagnosed IDs, invalid years, or duplicated context fields can throw and surface generic failure rather than a useful validation transition.
- Presumptive locations are arbitrary non-empty strings with no catalog membership, array/count/string upper bound, or cookie-budget ceiling. Optional branches are bounded but not verified against allowed reference values. Duplicate/free-form service history can create unusable oversized cookies.
- [Admin bearer comparison](../src/app/api/admin/cache-clear/route.ts#L12-L19) is timing-safe for equal-length values and fails closed on missing config, which is positive. It does not enforce the documented minimum secret length or require the Bearer scheme; cache-clear and regulatory sync share privilege.

**Fix:** explicit per-action Zod DTOs and allowed keys, immutable earlier-step data from the validated session, complete friendly parse error mapping, catalog/reference enums and bounds, cookie-budget handling for presumptive state, and separately scoped strong admin credentials. Add direct action-invocation/tampered FormData tests. A Server Action identifier is not authorization.

### A-08 — Advertised extra CSRF layer is unused; documentation confuses CSP and authorization

**Priority:** P1 assurance correction; no confirmed standalone CSRF exploit.

[validateRequestOrigin](../src/lib/security/csrf.ts#L48) has no application callers. Tests exercising the helper do not make it active. Even if wired as written, it allows missing Origin/Referer and unresolved production origin; `VERCEL_URL` takes precedence over canonical `APP_URL`.

[SECURITY.md](../SECURITY.md) incorrectly treats action identifiers as secret CSRF tokens that outside clients cannot obtain. Action identifiers appear in public render output; Next's real protections include POST-only actions, Origin-versus-Host/X-Forwarded-Host checks, and cookie SameSite behavior. CSP on this site does not constrain forms/scripts served by an attacker's site. Next's official [data-security guide](https://nextjs.org/docs/app/guides/data-security) says to treat actions as public entrypoints and validate/authorize them.

**Fix:** accurately describe existing framework protections; either remove the dead extra-layer claim or implement a canonical-origin check at the appropriate mutation boundary with intentional missing-origin behavior. Test deployed proxy host trust/allowed origins; do not add broad allowed-origin wildcards.

### A-09 — CRG integrity gate has false negatives

**Priority:** P1/high integrity assurance; confirmed fixture failure.

[audit-crg-graph.js](../scripts/audit-crg-graph.js#L52-L94) stops searching at length 12 or 100 cycles. Those are **analysis caps**, not just display caps. The [truncation flags](../scripts/audit-crg-graph.js#L320-L323) check `cycles.length > 100` after enumeration has already capped it at 100, so the flag cannot signal that cap. Longer pure-causation cycles escape hard enforcement; the 13-node fixture passed strict analysis. Reporting count bounds also do not bound combinatorial search through dense acyclic paths.

The separate [adjacency audit](../scripts/audit-crg.ts#L86-L92) processes `nodeId/outgoingEdges`, while live data uses `id/suggestions`. It truthfully warns that it is vacuous but exits success; valid JSON with all nodes failing that schema also looks like “not migrated.” JSON syntax errors can still throw, and the separate KB validator catches current authored-schema corruption—do not claim all corruption passes CI.

**Fix:** run iterative DFS/SCC on the actual authored schema; independently detect cycles in the all-DIRECT_CAUSATION subgraph without enumeration caps. If the product requires a global DAG, reject all cycles; if bidirectional association/aggravation is intentional, declare a directed relationship graph and define a separate permissible path projection. Keep full detection separate from bounded presentation and fail if analysis budget is exhausted. Require explicit migration state, not “zero nodes parsed” as success.

### A-10 — OCR resource/deletion safeguards differ from normal extraction

**Priority:** P1/medium browser availability and completeness.

[Normal extraction](../src/lib/evidence/document-extract.ts#L41) checks file size and rejects over-limit pages/text. [runLocalOcr](../src/components/evidence/LocalEvidenceAnalyzer.tsx#L398) is separately callable on each staged PDF; it checks PDF kind but does **not** check file size before reading bytes/creating the worker. Staging keeps the selected File object without validating its size. Therefore “Local OCR” bypasses the documented per-file cap even after normal analysis would reject that file.

OCR uses `Math.min(totalPages, limits.pdfPages)` and can report completion for a prefix without a clear over-page rejection. Text overflow breaks and retains earlier segments. This differs from the public statement that over-limit sources are rejected rather than silently truncated.

Resource cleanup in nested finally blocks and canvas area limits are positive. Still, there is no cancellation deadline for long OCR, and Extended mode permits 1 GiB batches/200 files/2,000 pages, which can exhaust a low-memory browser despite being numerically bounded. DOCX's preflight limits declared expansion, not a guarantee against maliciously inaccurate ZIP metadata; do not call it a proven complete bomb defense.

**Fix:** shared preflight before every parser/OCR entrypoint, explicit partial-result notices, cancellable worker execution, page/character/total-memory budgets, checkpoint invalidation on removal, and mobile/low-memory tests. Local-only crashes are not server-side DoS exploits.

### A-11 — CSP/Trusted Types and telemetry ingestion need hardening

**Priority:** P2/medium or assurance issue.

- [CSP construction](../src/proxy.ts#L148-L149) emits `'allow-duplicates'` as a separate semicolon-delimited directive rather than inside `trusted-types`. Policy-name quoting also warrants correction against the spec. This does not establish that the entire CSP is ignored: other directives remain valid.
- [TrustedTypesGate](../src/components/security/TrustedTypesGate.tsx#L47) creates the policy in `useEffect`, **after hydration**, not before hydration as comments/docs claim. It allows any same-origin http(s) script URL, not only the `/tesseract/` prefix described elsewhere. Real framework/worker behavior must be retested in production TT-enforcing browsers; this audit does not certify TT correctness.
- [CSP report handler](../src/app/api/csp-report/route.ts#L70) allocates `request.text()` before checking size; string length is UTF-16 characters, not UTF-8 bytes. No streaming cap exists. Hosting request limits may reduce attack magnitude, but the application limit is not an allocation limit. Rate limiting is process-local; the handler returns 429 contrary to “bare 204 always” wording.
- [Generic rate limiter](../src/lib/rate-limiter.ts) is fixed-window, not sliding-window as documented; its live-key map is not strictly bounded and sweeping >10,000 keys on each request can amplify cost. X-Forwarded-For trust needs deployed proxy evidence, not an assumption that arbitrary clients can spoof it on Vercel.

**Fix:** valid CSP grammar and a deliberately designed bootstrap; runtime browser assertions; streaming byte cap and safe body-read errors; bounded limiter storage and trusted forwarding sources; align documentation with fixed/sliding behavior. Keep existing strict script nonce policy and report-data redaction.

## 5. Authentication and state-management assessment

### Endpoint-specific auth matrix — based on current official VA material

| API / use case | Official model observed | Repository state |
|---|---|---|
| VA Forms | API key / Open Data | Implemented server-side public adapter; sandbox evidence recorded |
| Benefits Reference Data | API key / Open Data | Implemented public terminology/service branches; **not individual ratings** |
| Benefits Intake | **API key**, not universally PKCE | No upload/status/download submission flow; deliberately excluded |
| Benefits Claims | ACG for non-VA v1 use; CCG v2 explicitly internal VA use in official catalog | No OAuth or claims integration |
| Individual disability ratings | Current catalog exposes Veteran Service History and Eligibility, ACG/CCG, rating scopes; restricted variants have consumer restrictions | No real rating integration; exact endpoint/version and eligibility need confirmation |

The official production form and the VA site's public [catalog backing data](https://developer.va.gov/platform-backend/v0/providers/transformations/legacy.json?environment=sandbox) were inspected read-only. Some per-API docs rendered only a shell, so catalog details and search snippets were not silently treated as a complete endpoint contract. The July 15, 2025 official rating release note specifically restricts `/restricted/summary/disability_rating` to approved Federal Government consumers; that does **not** prove every ratings endpoint is restricted to federal consumers.

VA's [working-with-APIs page](https://developer.va.gov/about/working-with-va-apis) says consumers unable to securely hide a client secret use PKCE. The Benefits Claims ACG search result says the same. **There is no basis for a universal “all four APIs require PKCE” claim.** A confidential Next server and a public/mobile client can have different onboarding choices; confirm the approved model with VA.

### What a future authenticated integration must add

These are security implementation requirements/recommendations, not invented VA token-lifetime rules:

1. Approved discovery/issuer/authorization/token endpoints and least-privilege scopes for the exact API/version.
2. Single-use, expiring authorization transaction bound to the initiating browser session; random state, PKCE S256 where applicable, OIDC nonce/issuer/audience/signature validation where OIDC is used.
3. Exact registered HTTPS callback URI; no user-controlled callback host or return redirect. Keep transaction cookies narrowly scoped. A SameSite=Strict workflow cookie alone may not survive a cross-site identity-provider callback; design a separate callback transaction intentionally.
4. Server-side token vault or encrypted session store with access controls; no tokens in URL history, browser local/session storage, client props, logs, or general tracing.
5. Refresh single-flight/rotation and invalid-grant handling according to VA's actual approved contract; no guessed expiry intervals or unsupported revocation endpoints.
6. Action/route-level authorization on every Veteran/claim object; verify account linkage, consent and representative authority, not a client-supplied Veteran identifier.
7. Logout invalidation of local session/refresh access plus supported provider revocation/sign-out; clearing the research cookie is not OAuth logout.
8. Separate consent and data-flow change before transmitting medical documents. Intake/claim uploads contradict today's local-only transmission boundary and need explicit new disclosure and workflow design.

### Current data-flow inventory

| Data | Browser → application server? | Persistence / additional destinations |
|---|---|---|
| Selected diagnoses/service connection/ratings/years/context | **Yes**, via Server Actions | AES-GCM encrypted workflow cookie; server decrypts for rendering/recommendations |
| Presumptive branch/location/date selections | **Yes** | Encrypted scoped cookie; no account database observed |
| Raw selected evidence bytes/text, ordinary PDF/DOCX/text extraction | No intended app-server upload found | Browser memory; selected excerpts in sessionStorage; parser error console path is a finding |
| Scanned-document OCR | Local bundled worker | Full-text resume checkpoint as well as excerpts; incomplete deletion is a finding |
| Dictated audio | Browser speech-service dependent | Local processing not enforced; external processing possible before app form submission |
| Forms query | Yes, in GET URL | VA request, cache key/view, potential framework/hosting spans/logs |
| Directory ZIP | Yes, Server Action then GET URL | VA request if enabled, shared cache params/key, possible logs/spans |
| Recommendation/workflow events | Server-generated | stdout and configured host ingest; counts/routes normally, arbitrary values on identified paths |
| LangSmith ordinary recommendation payload | Redacted to counts by wrapper | External only if enabled; errors/metadata and actual settings still need review |

**Important distinction:** browser-local evidence parsing does not mean the entire app's health data is local-only. Form submissions are plaintext values inside TLS until the server encrypts state. HttpOnly prevents direct cookie reads by browser scripts, but health values rendered as HTML/React props are necessarily visible to scripts on the page. No credential or raw-document server/client bundling leak was demonstrated.

### RSC and performance

The design appropriately keeps filesystem loaders and credentials server-side and file parsing in client components. Lazy parser imports and client-only timeline loading reduce initial work. [Root `connection()`](../src/app/layout.tsx#L20) intentionally opts the whole layout into request-time rendering for per-request nonces; it is a performance trade-off, not an accidental misuse. Public static content could be separated later without sacrificing CSP, but do not prematurely cache personalized pages.

The build's Node-in-Edge warnings come from [instrumentation](../src/instrumentation.ts#L16) importing filesystem preload code without a `NEXT_RUNTIME === "nodejs"` gate. Scope Node warmup to Node runtime; validate Edge separately. Build success does not establish Azure fallback or all production runtime compatibility. Existing loader in-flight dedup is positive and distinct from the missing distributed VA single-flight.

## 6. Section 508 / UI findings

[Official Section508.gov](https://www.section508.gov/develop/applicability-conformance/) identifies Revised 508's WCAG **2.0 A/AA** baseline and full-process conformance. WCAG 2.1/2.2 AA is a worthwhile additional target but must not be mislabeled as the universal incorporated 508 baseline.

Observed positives: `lang="en"`, focusable skip target, main landmarks, many native labels/fieldsets, status/alert regions, route-title layouts, forced-colors/reduced-motion contracts, and keyboard handling on interactive timeline controls. These are supporting evidence only.

Specific source issues to resolve/test:

1. [LocalEvidenceAnalyzer file input](../src/components/evidence/LocalEvidenceAnalyzer.tsx#L702-L719) has adjacent span text but no associated label, `aria-label`, or `aria-labelledby`. “Choose files” is not a sufficiently descriptive programmatic name for evidence selection. Test WCAG 1.3.1/3.3.2/4.1.2.
2. [VoiceInputTextarea](../src/components/secondary/VoiceInputTextarea.tsx#L170) sets `aria-label={id}`, overriding the visible label. `treatments` replaces “Treatments, procedures, or devices”; `history` replaces “Relevant history or risk factors.” Remove the override or pass the actual descriptive label; evaluate with assistive technology. Label-in-name is additionally a WCAG 2.1 concern, not silently a 2.0 criterion.
3. [SecondarySuggestionsTabs](../src/components/secondary/SecondarySuggestionsTabs.tsx#L46-L106) uses tab roles but has no Arrow/Home/End navigation or roving tabIndex. Both buttons remain in the tab order. Native Tab/Enter still works, so this is an ARIA pattern deficiency—not automatically proof of keyboard inoperability. Implement and test the expected tab pattern or use simpler semantics.
4. Error handling gaps in actions can produce generic failure without retained context or programmatically associated field errors. Verify announcement/focus after direct invalid submissions, not just UI-valid flows.
5. Source/filename truncation, long condition names, large result panels, timeline alternatives, keyboard-only exports and forced-colors/zoom behavior need full human testing. No screenshot/contrast tool or actual screen-reader result was produced in this audit.
6. For future ACG policy review, Terms/Privacy contain Tailwind `text-xs` (normally 12px), below VA's documented **14px policy-text minimum**. Verify computed styles after global CSS and repair. This is a policy-review rule in the ACG section, not a blanket WCAG minimum-font-size rule.

**Exit gate:** record exact deployed commit, tester, browser/OS/AT versions; map every applicable WCAG criterion, test complete flows and error states with synthetic documents; remediate/retest; publish only the conformance status actually supported. A brief workbook checklist must not stand in for all applicable criteria.

## 7. VA production checklist gap analysis — official requirements vs project gates

Sources were read on October 3, 2026; requirements can change and VA's review remains authoritative. The application form was **viewed only**; no application data was entered, agreement accepted, or request submitted.

| Requirement / question | Official source and applicability | Exact gap / evidence needed |
|---|---|---|
| Develop/test in sandbox before production review | [Production process](https://developer.va.gov/production-access) | Public APIs: [external gate record](external-manual-gates-status.md) records Forms/Reference HTTP 200 request IDs and run 33997305230. Not independently authenticated here; retain sanitized original artifact. Claims/Intake/rating sandbox flows absent. |
| US-based consumer/company | [Request instructions](https://developer.va.gov/production-access/request-prod-access), required form confirmation | Applicant attestation missing; cannot infer citizenship/business location from source. |
| VA employment / active ATO relationship | [Production form](https://developer.va.gov/production-access/production-access-application) asks a required Yes/No and labels restricted APIs | Applicant facts and eligibility for selected restricted endpoints missing. Do not assert every consumer needs an ATO. |
| Section 508 status | Required form Yes/No; instructions encourage compliance | #195/workbook untested. No basis for unqualified Yes; complete human assessment or answer limitations truthfully. |
| API selection and OAuth scopes | Request instructions/form, per-API catalog | Current package only Forms/Reference. Wider scope, exact rating endpoint and scopes not selected/reviewed. Directory feature is also outside the initial named API request; verify its actual published contract/grant before enabling. |
| Company contacts, notification email, app/use cases, Veteran value, business/revenue model | Request instructions | Truthful owner-provided facts missing. Do not invent a business model. |
| No monetizing or selling Veteran data | Explicit request instruction | Confirm actual business/vendor practices and public statement; source intent alone is not an organizational attestation. |
| App directory information for Veteran-primary apps | Request instructions | Final product/about/privacy/terms URLs, description and compatible browsers/devices must match measured deployment evidence. |
| Secure storage of API key/client ID/secret | Request instructions | Code is server-side; sanitized hosting access/secret separation/rotation evidence needed. No secrets should be shared in this audit. |
| Explain PII/PHI storage/exposure | Request instructions | Correct speech, logs, cookie deletion, OCR checkpoint, query/ZIP cache/trace contradictions; provide complete diagrams and retention/deletion evidence. |
| Safeguards against unauthorized/duplicate requests | Request instructions | Shared consumer quota, mutation enforcement, future object authorization, deduplication/idempotency absent or incomplete. This does not mandate a specific Redis product or breaker algorithm. |
| Breach response, vulnerability/patch processes | Request instructions | Runbook exists but contains stale sandbox claims; owner/on-call/vendor notification channels and current advisory remediation evidence need completion. Do not invent a universal VA breach-notification deadline. |
| Terms/privacy URLs | Request instructions | Exist in source; recheck public build, content accuracy and ownership facts. |
| ACG policy readability | **ACG-specific** policy-review section in request instructions | If adopting ACG: grade reading level ≤12; text ≥14px, readable formatting, 4.5:1 text contrast, mobile readability. No completed measurements; `text-xs` is an identified issue to verify. |
| ACG retention/permanent deletion | **ACG-specific** review section | State retention including dormant/non-VA data, easy permanent-deletion request, 100% deletion including non-VA data, and timing **within 45 days**. Current research policy has no complete future account/deletion process and present clear controls are defective. Map logs/traces/caches/backups, not just cookies. |
| ACG data practices/vendor commitments | Same ACG section | Specific collected data/use; named sharing entities and purposes; no sale/monetary transactions; consent for third-party use even de-identified data; vendor commitments; family/genetic-sharing impacts; breach notice/actions; ownership transfer/end-of-business choices and notices; notices of policy/TOS changes. Current policy is incomplete for that scope. |
| Intake source-field naming and centralized backend submission-log information | **Benefits Intake-specific**, request instructions | No Intake implementation or operating model. Answer whether a centralized log exists; do not claim the question itself mandates logging full PHI. |
| Intake sandbox demo | [Demo instructions](https://developer.va.gov/production-access/prepare-for-and-complete-a-demo) | Must demonstrate multiple attachments reaching **received**, and `/download` verification that server payload matches the upload in entirety. Not implemented. Future logs should contain minimal submission/status metadata, not documents. |
| General demo: user flows, data-flow diagrams, open issues; address follow-ups | Demo instructions | Final 30–60 minute rehearsal and reviewed diagrams pending; use synthetic data and disclose findings. Successful demo plus requested changes precedes access. |
| 60/minute per consumer; rate-limit headers | [Working with APIs](https://developer.va.gov/about/working-with-va-apis) | Current per-process/per-service 60 budget cannot guarantee the published limit. Confirm actual issued quota partition and test shared control. |
| Production grant and credentials | Production process / API-specific onboarding | #287 documented open. No grant inspected. Keep VA production traffic disabled until authorized; use sanitized verification after grant. |

**Not universal current requirements:** FHIR-specific MyHealthApplication/CARIN listing and health disclaimer, internal-system VASI name, Facilities PatientWaitTime message, restricted API agreements, and ACG-specific 45-day policy review apply only where their documented scope is selected. Nothing reviewed establishes a blanket “Vercel forbidden,” “Azure required,” “HIPAA certification required,” or “all consumers must obtain FedRAMP/ATO” rule.

### Repository-specific release gates — not invented VA mandates

- #189 public-reference sandbox success is recorded complete, whereas the [production package](phase3-production-access-package.md), [security operations](security-operations.md), and portions of [SECURITY.md](../SECURITY.md) still call it pending/future. Reconcile from the actual artifact.
- #195 manual accessibility evidence remains open.
- #287 grant/live-production connectivity remains open; an environment acknowledgement is not evidence of approval.
- Exact selected merged `main` SHA → CI → READY deployment → canonical alias → Runtime Readiness → human review must align. The package's old `193f2603...` checkpoint is not evidence for this `76e7868f...` branch tip.
- The local dependency audit is currently failing, so no “all release gates green” claim is supportable today.
- Documented runtime secret verification #213 is recorded complete, not a newly invented missing-secret blocker. Actual deployment settings were not inspected here.
- CI's `continue-on-error` steps collect diagnostics; its final failure step enforces outcomes. The audit does **not** claim these steps silently make CI green.

## 8. Ordered remediation plan and acceptance criteria

### Phase 0 — Keep scope and production boundary truthful

1. Maintain the deployment/production-access freeze and disabled VA production state. Do not deploy from this report.
2. Choose the public-reference request as the existing scope unless the owner explicitly authorizes a separate Claims/Intake/rating expansion. Record exact API versions and consumer eligibility with VA.
3. Open private remediation tracking for B-02 through B-06 and A-01/A-02; use synthetic evidence only. Do not publish exploit details in a public issue by default.
4. Review patched dependencies and advisories; reproduce release checks under Node 22. Acceptance: audit gate passes, matching Next/tooling versions, no forced downgrade, full tests/build/browser flows remain healthy.

### Phase 1 — Repair privacy/deletion and mutation controls

5. Delete cookies with exact path/domain; add browser cookie-jar tests proving absence and blank restored state after Finish/Restart. Add presumptive clear semantics.
6. Remove raw evidence console messages and arbitrary free-form logging; one typed event allowlist, with fixed error codes. Acceptance: canaries in filenames/text/queries/returnTo/errors never appear in application or configured telemetry sinks.
7. Remove or fail-close remote-capable speech. Acceptance: no recognition start unless supported on-device requirements are met, accurate copy, no cloud fallback, accessible typing fallback and recognition cleanup.
8. Inventory and clear all evidence stores/checkpoints/memory, including interrupted OCR. Acceptance: reset/clear/source removal empties checkpoint and excerpt stores; TTL/size validation fails closed; storage failure is disclosed without copying content.
9. Validate return routes and per-step FormData DTOs; reject overposting and invalid/duplicate/type-confused fields; handle parser failures without generic 500s. Add bounded catalog-validated presumptive context and cookie budget.
10. Enforce mutation rate/security controls regardless of prefetch headers. Acceptance: hostile headers cannot remove HTML CSP or bypass action/route limits; built-in Origin/Host checks are retained and tested behind the actual host.

### Phase 2 — Make VA transport/cache genuinely safe for distributed production

11. Implement an atomic consumer-wide budget for each outbound attempt and shared cooldown/probe leases. Fail closed when shared coordination fails. Test many simulated instances, shared-cache outages, unique-query miss storms, 429 reset headers, and all retry attempts.
12. Activation gates precede cache reads; strict versioned schema/epoch/provenance checks; whole-operation timeout and streaming byte caps. Add global invalidation and finite shared key/cardinality policies. Acceptance: disabled/revoked mode never presents cached data as authorized-live; invalid cache values cannot set trusted links/source labels.
13. Refuse redirects or validate every hop without cross-origin credential forwarding. Test synthetic redirects using fake keys.
14. Define retry/circuit policy: total deadline, capped per-attempt timeout, jitter for transient idempotent calls, JSON-vs-network error separation, one half-open probe. Acceptance: 429 reduces consumer pressure; 500 has an explicit policy; unavailable VA/KV never prevents core local research.
15. Review Forms/ZIP collection, URLs, KV data, automatic span names/attributes and vendor settings. Acceptance: data-flow inventory matches policy; raw query/ZIP logging is removed or explicitly justified/minimized; sink canary tests cover auto-instrumentation, not just the custom logger.

### Phase 3 — Repair CRG correctness without weakening clinical safeguards

16. Separate target evidence collection from score derivation; define direct/path contribution semantics. Acceptance: all input permutations produce equivalent target scores, consensus, contributor sets, provenance, and sorting; the 51 published combinations no longer vary. Keep association-only paths excluded and drafts unpublished.
17. Replace capped cycle enforcement with authored-schema SCC/DFS and separate presentation budgets. Acceptance: cycles of 2/12/13/817 nodes, late cycles beyond 100 reports, self-loops, duplicates, disconnected nodes and invalid/mixed schema states are correctly handled with honest truncation/budget status.
18. Define graph-vs-DAG contract and resolve/review the current four bidirectional pairs, 13 review-class findings and 29 redundancy conflicts with qualified humans. Re-pinning debt is acceptance, not proof the conflict disappeared.
19. Preserve the two-edge/ancestor guards; add total frontier/path output budgets and property tests for dense graphs. Acceptable bounded depth is not a license for unbounded breadth. Human citation verification remains separate: 1,295 unverified references across published and draft corpus are not automatically hallucinated or all runtime-visible.

### Phase 4 — Accessibility, operational evidence, and VA review

20. Fix file naming, labels, tabs and error associations; validate OCR limits/cancellation. Gate Node preload by runtime and recheck production browser CSP/Trusted Types/OCR, not merely dev journeys or isolation probes.
21. Complete full human 508 criteria/workflows on the exact deployed release once deployment is authorized; record AT/browser/OS/build, failures and retests. Never manufacture PASS rows.
22. Reconcile README/security/privacy/runbook/package/checklist from measured behavior; correct attempts/429 policy, data retention, logging, API scope and stale gate statuses.
23. Gather owner-provided company/business/location/contact/vendor facts and sanitized evidence listed below. Prepare accurate diagrams and synthetic demo; obtain VA review, perform requested changes, and receive access.
24. Only after VA grant and deployment authorization: install service-specific production credentials server-side, enable reviewed controls, perform sanctioned minimal live checks, and record exact release lineage. Nothing in this audit authorizes those operations.

**Additional expansion phase, only if authorized:** implement the approved OAuth/session/consent/claims/Intake architecture from Section 5; satisfy ACG-specific policy review and Intake multiple-attachment/received/download demo; test idempotency and safe submission status recovery. This is not solved by adding PKCE to the existing research cookie.

### Minimal reproducible integrity example

This uses the exported audit function and fabricated condition IDs; it reads no Veteran data and makes no network request:

```bash
node - <<'NODE'
const { analyzeGraph } = require('./scripts/audit-crg-graph.js');
const id = i => `node-${String(i).padStart(2, '0')}`;
const mappings = Array.from({ length: 13 }, (_, i) => ({
  id: id(i),
  suggestions: [{
    conditionId: id((i + 1) % 13),
    nexusClaim: { nexusClassification: 'DIRECT_CAUSATION' },
  }],
}));
const result = analyzeGraph(mappings, { strict: true });
console.log(result.status, result.counts.cycles, result.truncated.cycles);
// Observed: PASS 0 false — despite a complete directed causal cycle.
NODE
```

For the accumulator reproduction, construct edges `A→B→C` and `D→C`, each rank 1 with a non-association nexus, select diagnosed IDs `[A,C,D]`, and call `recommend` twice with primaries `[A,D]` and `[D,A]`. Both outputs contain the same intermediate path; scores were 2 and 1, and contributor counts were 2 and 1. In the published corpus, substitute `cushings-syndrome`, `hypertension`, `chronic-kidney-disease`, and `anemia`. Use the validated catalog/KB loaders and empty symptoms/medications/exposures; no personal information is needed.

## 8a. Remediation status (implemented after this audit pass)

This section records what changed in the working tree after the audit above. It
is a status log, not a re-audit: external grants, human 508 results, owner
facts, and production collector settings remain open, and the deployment/
production-access freeze stays in effect.

| Finding | Disposition |
| --- | --- |
| B-01 broader API scope (no implementation/approval evidence) | Not expanded: the repository retains the Forms + Benefits Reference Data scope. There is no OAuth callback/token exchange, Claims, Intake, or individual-ratings implementation or approval evidence, and the legacy rating adapter (`src/lib/va/index.ts`) has no application caller (it also refuses redirects, like the other credential transports). A wider scope requires a separate, reviewed expansion request with the exact API versions/endpoints, approved auth model, scopes, and consumer eligibility; the production grant remains external (#287). |
| B-02 privacy claims vs speech/diagnostics/retained data | Voice input is disabled in both surfaces until positively-enforced on-device processing exists; no microphone permission or recognition start remains, and copy plus `/privacy` were updated. Evidence storage parse failures log a fixed `STORE_UNREADABLE` code and a fixed message — no parser text, filename, or record preview (`src/lib/evidence/storage.ts`); logger and audit paths drop arbitrary text with canary regressions in `tests/observability-logger-privacy.test.ts`. OCR checkpoints carry a TTL and size/consistency validation on read, and every clear path (completion, source removal, Clear local evidence, Finish/Restart, depth change) removes them; disclosure updated on `/privacy` and the analyzer. |
| B-03 scoped-cookie deletion | Fixed in `secondary-workflow/session.ts` and `presumptive/session.ts` (explicit `{ name, path }` deletion); regression coverage in `tests/workflow-cookie-scope.test.ts`. |
| B-04 consumer-wide VA quota | Distributed outbound attempts require an explicit shared consumer-budget opt-in (`VA_SHARED_CONSUMER_BUDGET=true`); the budget fails closed before every attempt including retries. Fleet circuit state is coordinated through the same shared store: an instance that opens its breaker publishes a cooldown marker, and exactly one half-open probe is admitted fleet-wide via an atomic `SET … NX PX` lease; an unreachable coordinator resolves to fail-closed `unavailable` rather than assuming a closed circuit. Fleet-level verification (budget storm, cooldown/probe admission, outage, degraded store, split network, and the ratcheted CI gate) is recorded under A-03. |
| B-05 recommendation score depends on input order | Direct contributions are collected and summed after traversal; pathway estimates apply only to targets with no direct mapping. Permutation tests in `tests/recommend-order-invariance.test.ts`. |
| B-06 dependency audit | Next.js `16.3.8` (and matching `eslint-config-next`) installed deliberately; production-dependency audit gate is green (`audit:high` = `--omit=dev`). Dev-tooling advisories with no patched release (`braces <= 3.0.3`, "Patched versions: None") are inventoried non-blockingly by `audit:high:all` and documented in SECURITY.md; `npm audit fix --force` was not used. |
| B-07 accessibility/submission evidence | Partial accessibility fixes only: tabs implement roving tabIndex + Arrow/Home/End keys; Terms/Privacy small text raised to the 14px policy floor. Full 508 conformance remains external human review (issue #195); automated checks, 200 responses, and a skip link are not a conformance determination. |
| A-01 caller-controlled prefetch headers skip the security proxy | The matcher no longer skips requests by header; mandatory CSP/security headers apply to every mediatable request, with per-route limiters independent of the matcher. |
| A-02 open redirect + free-form log injection | `returnTo` is allowlisted to real routes; logger and audit paths now drop arbitrary text, so caller-controlled strings cannot be injected into log lines (canary regressions in `tests/observability-logger-privacy.test.ts`). |
| A-03 shared-cache trust/revocation | Activation gates now precede cache reads so a disabled integration cannot serve a cached live-labelled view; KV replies are version-enveloped and byte-bounded; writes are awaited. A read-side trust guard (`src/lib/va/cached-view-guard.ts`) re-checks every cached value against the deployment's provenance (a sandbox deployment cannot serve a `va-production-api` label), bounded labels/timestamps, item caps, and credential-free HTTPS links before a hit is served — a rejected value is a miss, not a display; VA-provided links (`url`, `website`) are validated at the payload boundary by `src/lib/va/trusted-link.ts` (`javascript:`/`data:`/`http:`/credential-bearing URLs fail the payload schema, so the loader degrades to its labelled local fallback); cache keys are restricted to an allowlisted namespace/charset policy, writes are admitted against a finite per-namespace window budget (`VA_SHARED_KEY_WRITE_WINDOW_SECONDS=300`, `VA_SHARED_KEY_WRITE_MAX_PER_WINDOW=240` → ≤480 resident keys per namespace, ≤1,920 across the four allowlisted namespaces), and entries are stored as `{envelopeVersion:2, epoch, value}` envelopes read with one atomic `MGET [cache-epoch, value]` that accepts a value only under the epoch it observes. `POST /api/admin/cache-clear` advances the store-wide invalidation epoch (`INCR va:ref:cache-epoch`; absent marker = epoch "0") so a stale shared value is discarded fleet-wide without a delete sweep — the route reports `sharedInvalidation: applied|failed|not-configured` and never claims a bump it could not confirm. Unreadable epoch markers, unreachable coordinators, and exhausted budgets fail closed (miss / skipped write), covered by `tests/va-shared-reference-cache.test.ts`. Per-key single-flight closes the last A-03 fix-list item: one instance claims a short `SET … NX PX` lease (`src/lib/va/shared-single-flight.ts`, 45 s TTL) per cache key and contenders wait a bounded 600 ms window for it to publish, so an expired or invalidated popular key is fetched once instead of once per instance. The lease deliberately fails open — an absent or unreachable coordinator is not a safety control, it just means the normal fetch path, where the shared consumer budget still gates every attempt; a lease whose holder died expires on its own, and a release never deletes a lease another instance re-claimed (`tests/va-shared-single-flight.test.ts`). The fleet invariants are exercised end-to-end by a multi-instance simulation (`tests/va-fleet-simulation.test.ts`): 40 simulated instances sharing one store storm 200 unique queries and are held to one 60-request consumer-budget window with no stranded fetch leases; a 429 flare publishes one fleet cooldown, blocks fresh instances without spending quota, and admits exactly one half-open probe across 20 instances before the cooldown clears; and 30 instances racing one cold key produce exactly one upstream fetch. The same harness proves invalidation propagation: 40 instances warmed from the shared tier serve zero-fetch hits, one `INCR` epoch bump makes every one of them discard its value and refetch with the new epoch stamped, and the stale bytes are still physically present (no delete sweep). A mid-storm shared-store outage is also simulated: the same warm keys stop being served, every request resolves to the labelled local fallback with the coordination-outage reason (never a cached value presented as live), no upstream request and no quota reservation is attempted (`INCR` count stays zero), no cache write is attempted, and after recovery live traffic resumes with the consumer-budget counter still exactly equal to the number of admitted attempts — the outage neither burned nor misreported quota. A degraded store is simulated too: with a KV that would answer in 5 s, every exchange is aborted at the 750 ms deadline and each fail-closed render costs a bounded three deadlines (~2.25 s) — no retry or poll amplification, no upstream request, no quota reservation, and the bound repeats on the next wave. A split network is also simulated: with half the fleet unable to reach the store while the reachable half bumps the invalidation epoch, the partitioned half serves only labelled local fallbacks (never the warm value it is holding, no live data, no upstream request, no quota spent), and on healing every partitioned instance refetches under the new epoch rather than resurrecting the pre-bump bytes that are still physically present. The simulation is a required CI gate with a ratcheted wall-clock budget (`npm run test:fleet` via `scripts/run-fleet-simulation.mjs`, CI step `fleet`): the enforced limit is the tighter of a committed environment cap and a budget derived from recent measured runs, so the gate tightens automatically as CI timing stabilizes and cannot silently drift looser; `--record` ratifies a measured window (and can only tighten the cap), each coordination path (budget reserve, probe admission, single-flight wait, degraded-store fail-closed) additionally carries its own committed per-scenario wall-clock bound so one path cannot silently consume the suite budget, and an overrun of either bound is killed and fails the build, so a coordination regression that becomes unbounded cannot pass as merely slower tests. |
| A-04 query keys/ZIP + automatic spans | Automatic trace export is disabled by policy (`src/lib/observability/telemetry-policy.ts`) and the unused `@vercel/otel` exporter dependency was removed; `tests/telemetry-policy.test.ts` proves no OTel SDK provider can record a canary span and fails if `registerOTel`/`@vercel/otel` reappears without the sanitization review. User-supplied cache-key segments (Forms query, locator ZIP) are SHA-256-hashed instead of stored as raw key material; privacy, retention, and observability docs were reconciled to measured behavior. Collector retention/access/geography remains an operator input (§9.4). |
| A-05 retry/timeout policy | Per-attempt timeout is capped, retry backoff carries bounded jitter, and response bodies are streamed under a byte cap instead of `response.json()`; redirects remain refused. A 429 is never retried and immediately opens the circuit for the clamped `Retry-After` window (1s–60s, default 30 s when the header is unusable), and even the single-process breaker admits only one half-open probe at a time. |
| A-06 upstream redirects | Every credential-bearing outbound request now refuses redirects (`redirect: "error"`): the VA JSON transport, the shared-store KV transport (`Authorization: Bearer` store token), the legacy sandbox VA adapter, and the regulatory preflight source fetch (`X-Api-Key`). A redirect response is a failed exchange that fails closed (read miss, skipped write, labelled fallback, or a source error), so an API key or Bearer token is never replayed to a redirected origin. Regression tests pin the request option and the fail-closed outcome in `tests/va-shared-reference-cache.test.ts`, `tests/va-adapter-resilience.test.ts`, and `tests/regulatory-preflight.test.ts`. |
| A-07 Server Action validation/overposting | Each secondary action now merges only its own step keys over session-authoritative prior values, with parse failures redirected instead of surfacing 500s; presumptive input bounds enforce location count/length caps, branch-token shape validation, and Server Action catalog membership, with a clear-history control on the results page using exact-path cookie deletion; bearer endpoints require the `Bearer` scheme with a minimum secret length (shared `bearer-auth` helper). |
| A-08 CSRF assurance + documentation | SECURITY.md now describes the protections that are actually active: Next's POST-only actions with Origin-vs-Host checks and `SameSite=Strict` cookies, plus CSP `form-action 'self'`/`frame-ancestors 'none'`/`script-src-attr 'none'`; action identifiers are public entrypoints, not secrets. The additional Origin/Referer helper (`src/lib/security/csrf.ts`) has no production callers and is documented as reviewed defense-in-depth rather than an advertised active layer; wiring it into a mutation boundary would first need testing behind the deployed host/proxy. |
| A-09 CRG integrity gate | Length/report caps that silently truncated analysis are gone: cycles of any length are enumerated, budget exhaustion is a hard failure, redundancy counts are complete with display slicing separate, and the adjacency audit distinguishes corrupt JSON / invalid adjacency files / unmigrated state. |
| A-10 OCR resource/deletion safeguards | The OCR entrypoint rejects oversized files or selections before loading a worker or allocating the document buffer; page/character/batch budgets apply, partial results are disclosed for page and character prefixes, and a dead-worker pause is handled with checkpointing. Checkpoint TTL and clear-path coverage is recorded under B-02. A user-initiated cancellation control and low-memory-device evidence remain open. |
| A-11 CSP / Trusted Types / telemetry ingestion | `'allow-duplicates'` lives inside the `trusted-types` value list (a standalone directive was ignored by browsers) and `default` is emitted as an unquoted token. The `default` policy decision now lives in `src/lib/security/trusted-types-policy.ts` and its semantics are executed by tests rather than string-matched: same-origin http(s) script URLs pass (framework `/_next/` chunks and the `/tesseract/worker.min.js` OCR worker ride the same gate), `blob:`/`data:`/`javascript:`/cross-origin URLs are refused, and `createScript`/`createHTML` refuse unconditionally. The bootstrap contract is corrected everywhere: installation happens at mount, after hydration, deliberately (the only first-party sink is the tesseract worker on an explicit user action), and SECURITY.md no longer claims before-hydration creation. The report handler streams under a byte cap (declared `Content-Length` checked first where available), treats a client-aborted or unreadable body as a content-free 204 instead of surfacing an error, and its 204/429 wording is aligned (accepted reports get 204, abuse shedding gets 429, neither is an oracle). The generic limiter is documented as fixed-window with a hard key cap in the code and SECURITY.md, and the `X-Forwarded-For` trust precondition — the deployed edge must strip inbound values — is recorded as operator input in §9.3 rather than assumed. The headless-Chrome production-build verification recorded in SECURITY.md remains the browser-level evidence; policy semantics are now also reproducible in unit tests. |

Verification executed after these changes: full Vitest suite, `tsc --noEmit`, ESLint,
`next build`, `audit:crg`, `audit:crg:graph`, the doc-lint finding/disposition
parity guard, and the production-scope dependency audit. See the repository status for exact counts rather than treating this table
as a substitute for running the gates.

## 9. Missing inputs needed for a deployment-level conclusion

No source files were unavailable for the central findings. The following evidence is outside the repository or was not independently verified; **please provide sanitized records, not credentials or Veteran records**:

1. Intended production API list, exact versions/rating endpoint, approved ACG/CCG/public-client model, and any VA eligibility/agreement or grant correspondence.
2. Company US-location/VA-relationship/business facts, responsible contacts and no-data-sale attestation.
3. Hosting/WAF and trusted forwarding rules, request body limits, deployment/alias IDs and exact commit evidence. Azure fallback settings only if actually operated.
4. OTel exporter/collector processing, captured headers/URLs/exceptions, retention/access/deletion configuration; Vercel log drains/analytics; LangSmith enabled status and policies; KV provider/region/ACL/retention. Provide key **names or redacted settings**, never values.
5. Original sanitized #189 success artifact and current release CI/runtime lineage.
6. Human Section 508 workbook and criterion matrix with findings/retests/sign-off; no real patient documents in attachments.
7. Incident ownership/escalation and applicable notification/vendor obligations; any chosen account-retention/deletion rules for future ACG scope.

Without these inputs I cannot certify actual production telemetry behavior, globally effective WAF/quota enforcement, credential management, VA authorization, legal compliance, or accessibility conformance.

## 10. Self-audit of conclusions

- **PKCE:** no implementation found; not universally required for Forms, Reference Data or Intake. Missing OAuth is a blocker for broader authenticated scope, not an auth bypass in today's anonymous scope.
- **Data privacy:** raw document upload to the app server was not found; browser console/full-text retention and speech are distinct findings. Manually submitted conditions/context do reach the server by design.
- **Cookies:** encryption/tamper detection/expiry work; path-mismatched deletion fails. Replay concern is not equivalent to compromising AES-GCM.
- **CSP:** prefetch-header omission verified locally; baseline config headers and Next action CSRF checks remain. No automatic victim-XSS conclusion.
- **Graphs:** the corpus is cyclic; runtime traversals are two-edge/ancestor bounded. The demonstrated long-cycle bug is in the integrity gate, not an infinite recursive production walk.
- **Ranking:** input-order defect corroborated in 51 current published combinations; it is software aggregation behavior, not a claim that the underlying literature is invalid.
- **Dependencies:** audit flags a critical package; specific ImageResponse exploit path not found. Tooling advisories are separated from production dependencies.
- **429/500:** immediate fallback is valid; missing consumer coordination/cooldown and stale documentation are the real problems. No fictional VA retry mandate.
- **508:** required form question and encouraged conformance are both accurately reported. Full conformance unsupported; no fabricated human results or mandatory universal certification claim.
- **VA policy:** 45-day deletion is quoted only for the inspected ACG policy-review section; no universal invented breach deadline/FedRAMP/HIPAA/Vercel prohibition.
- **CI:** final aggregator enforces failed gates. Historical deployments and sandbox claims are recorded evidence, not freshly verified approval/connectivity.
- **Legacy rating adapter:** no application caller found; no claim of reachable SSRF from an unused helper.
- **Completeness:** thorough source/boundary and targeted behavior audit, not proof all 817 medical mappings are clinically valid, all dependencies exploit-free, every UI state accessible, or deployment settings correct. The unavailable production evidence remains explicit.

### Primary references

1. [VA production-access process](https://developer.va.gov/production-access)
2. [VA production request requirements, including ACG policy review](https://developer.va.gov/production-access/request-prod-access)
3. [VA production application: required confirmations and API/auth selections](https://developer.va.gov/production-access/production-access-application)
4. [VA demo requirements](https://developer.va.gov/production-access/prepare-for-and-complete-a-demo)
5. [VA working with APIs: quota, headers, auth and operations](https://developer.va.gov/about/working-with-va-apis)
6. [Official VA public catalog backing data](https://developer.va.gov/platform-backend/v0/providers/transformations/legacy.json?environment=sandbox)
7. [Benefits Claims ACG documentation](https://developer.va.gov/explore/api/benefits-claims/authorization-code) — page body unavailable in this session; indexed snippet and catalog used with stated limits
8. [Veteran Service History and Eligibility docs](https://developer.va.gov/explore/api/veteran-service-history-and-eligibility/docs) and [release notes](https://developer.va.gov/explore/api/veteran-service-history-and-eligibility/release-notes) — catalog release-note text corroborates endpoint distinctions
9. [Section508.gov applicability and conformance](https://www.section508.gov/develop/applicability-conformance/)
10. [Next.js data-security guidance](https://nextjs.org/docs/app/guides/data-security)
11. [Next.js maintainer advisory GHSA-vcvr-r3jv-pc5j](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j)
12. [MDN SpeechRecognition processLocally](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally)
