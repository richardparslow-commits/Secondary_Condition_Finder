# VA Production-Readiness & Systems Audit — 2026-10-03

Auditor role: Principal Security & Systems Architect / VA Lighthouse API compliance review.
Repository: `Secondary_Condition_Finder`, branch `catalog-v2-movement-identities`.
This is an audit artifact. It makes no code changes and grants no production authority.

## How this audit was performed

- Static, exhaustive review of the four pillars requested: VA production access, PII/PHI boundaries,
  CRG integrity, and Next.js App Router / Server Action / state boundaries.
- Every claim below cites a repository path or a public VA source. Where evidence could not be
  obtained, the limitation is stated in §5 rather than assumed away.
- Counts are as-of the audit date (see §5 for the brief-vs-repo discrepancy note).
- No repository change was made by this audit other than adding this document.

---

## 1. Critical Blockers (show-stoppers for VA production access)

### C-1 — Live production VA traffic is architecturally disabled until a shared-state coordinator is verified

`docs/va-api-runtime-configuration.md` defines the production gate: production mode requires
`VA_API_ENV=production` + `VA_API_ENABLED=true` + `VA_PRODUCTION_ACCESS_GRANTED=true` + both
service-specific production credentials, and the distributed-runtime guard in
`src/lib/va/sandbox.ts` refuses live fetches in production/serverless unless a shared KV coordinator
is configured and verified. The deployed production state has VA disabled and serves the labelled
local fallback.

Consequence: setting `VA_PRODUCTION_ACCESS_GRANTED=true` and staging keys does **not** by itself
enable production traffic. The remaining engineering work is:

1. provision and configure the shared KV (`VA_REFERENCE_SHARED_CACHE_URL`/`_TOKEN`) in production;
2. exercise the distributed-mode path (the repository already has a VA fleet simulation and a
   production-runtime readiness workflow);
3. verify the fleet-wide cooldown/probe behavior of `src/lib/va/outbound-circuit.ts` /
   `src/lib/va/shared-circuit.ts` against the deployed coordinator;
4. only then set `VA_PRODUCTION_ACCESS_GRANTED=true` after VA grants access and live connectivity is
   objectively verified (the #287 gate rule is explicit that this is unset until then).

This is a deployment-readiness blocker, not a code vulnerability — but it is the difference between
"production access granted" and "production access actually used".

### C-2 — Compliance documentation contradicts itself about a closed gate (#189)

Three living documents disagree:

| Document | Statement |
|---|---|
| `docs/external-manual-gates-status.md` | Issue #189 **COMPLETE/CLOSED**; run 33997305230; Forms HTTP 200 request id `4e806cfd-…`; Reference Data HTTP 200 `1785c029-…` |
| `docs/phase3-submission-checklist.md` (line 7) | `[x] Issue #189 is closed` |
| `SECURITY.md` (line 57) | "credentialed sandbox verification remains a separately governed future gate" |
| `docs/phase3-production-access-package.md` (lines 9 and 219) | still lists "Credentialed live sandbox proof in issue #189" as a blocking item |

For a federal review package this is a material inconsistency: the reviewer's primary trust signal is
that the applicant's own statements agree. One canonical machine-readable status source (for example
`docs/external-manual-gates-status.json`) with a parity test in the style of the existing doc-lint
guards is the correct repair. Until then, no document should be submitted as-is.

### C-3 — Section 508 human review is incomplete, so the production form's compliance question cannot be answered "yes"

`docs/accessibility-audit.md` states the status honestly: PARTIAL EVIDENCE — MANUAL CONFORMANCE
REVIEW PENDING. `docs/section508-manual-review-workbook.md` still carries `NOT TESTED` entries
against the manual checks. The VA production-access form directly asks whether the application and
website are Section 508 compliant; the repository's own audit document quotes that question. A
"yes" answer is not supportable yet, and a "no" answer must come with a remediation statement.
Automated component tests are not conformance evidence.

### C-4 — The requested scope in the audit brief includes authenticated APIs that the product does not implement

The brief names Disability Rating, Benefits Claims, Intake, and Forms. The submitted scope
(`docs/phase3-production-access-package.md`, "APIs deliberately not requested") is intentionally
limited to the public API-key APIs: VA Forms and Benefits Reference Data. There is **no OAuth 2.0
authorization-code / PKCE / token-refresh implementation anywhere in `src/`** — verified by search:
the only `va.gov` OAuth reference is the external walkthrough link in
`src/lib/secondary-workflow/va-gov-record-walkthrough.ts`. No redirect-URI registry, no token
storage, no refresh lifecycle, no consent screen.

Consequences:

- For the *current* request: this is correct scope discipline. The production-access form states
  that apps which cannot securely hide a client secret must use the PKCE flow; this app is a
  confidential server-side client that keeps keys server-only, so PKCE is not applicable to the
  APIs it requests. (PKCE remains the right requirement for any future public/native client — do
  not read "not applicable today" as "never needed".)
- For the *stated goal* of upgrading to authenticated APIs: that is a new feature and a new review,
  not a configuration change. It requires client registration, redirect-URI registration, state
  and PKCE verification, token storage and refresh/rotation, session invalidation, rate-limit and
  outage UX, and a fresh privacy/security review. It must not be implied in the current submission.

### C-5 — Production access itself is externally blocked

`docs/external-manual-gates-status.md` records issue #287 as OPEN and externally blocked. No
repository change can close it. The remediation plan below therefore distinguishes "ready to
submit" from "access granted".

---

## 2. Architectural Vulnerabilities

### 2.1 CRG integrity: bounds exist, but the multi-hop DAG is not what the runtime executes

**What is actually enforced:**

- `src/lib/engine/pathway-generator.ts` is a depth-bounded (hard cap `MAX_PATHWAY_HOPS = 2`),
  branch-set cycle-guarded DFS. The branch set is deliberately *not* a global visited set, so the
  lawful convergent pathways A→B→D and A→C→D both survive while A→B→A cannot be constructed. Every
  emitted pathway is re-parsed through `ClaimPathwaySchema` as a final integrity gate. The
  reasoning in the module comment is sound; the traversal is linear in the depth-2 frontier.
- `src/lib/engine/pathways.ts` `findIntermediatePathways()` is a bounded two-edge composition over
  published suggestions with explicit exclusions (self, recognized, association-only) and
  `dedupePathways()`.
- `src/lib/kb/utils.ts` `deriveCompositeNexus()` fail-fast validates hop contiguity and chain
  connectivity; a mislabeled chain throws rather than rendering.
- `scripts/audit-crg.ts` runs a 3-color DFS over `KbNodeMapping` adjacency files and exits non-zero
  on a detected cycle.
- `src/lib/kb/load.ts` fails loud on malformed mapping files, id/file mismatches, catalog drift, and
  forbidden diagnostic phrasing.

**Vulnerabilities / weaknesses found:**

1. **`generateClaimPathways()` had zero production call sites at audit time.** A repository-wide
   search found only its definition — not even a test imported it; unit coverage was added later
   the same day, and the generator now has a production entry point
   (`src/lib/engine/graph-pathways.ts`) backed by a validated adjacency loader
   (`src/lib/kb/graph.ts`) over `data/knowledge-base/graph/` (see "Post-audit updates" below). The
   on-disk graph is 817 `ConditionMapping` suggestion files (140 published, 677 drafts at audit
   date) and, at audit time, **zero `KbNodeMapping` adjacency files**, so `scripts/audit-crg.ts`
   entered its self-declared VACUOUS PASS. The "multi-hop DAG" remains a validated data contract
   plus a provably bounded generator with no edges authored yet; the live engine composes at most
   two research-aid edges. Any external description that presents the DAG traversal as live
   functionality would still be an overstatement (see the brief's own "manages 813 conditions and
   673 drafts as a multi-hop DAG" framing — the true figures at audit time are 817 catalog
   conditions / 817 KB files, 140 published / 677 drafts, and the graph layer is still
   unpopulated).
2. **Dual depth implementations (remediated same day).** At audit time `MAX_PATHWAY_HOPS` lived
   only in `pathway-generator.ts`; the depth-2 nature of `findIntermediatePathways()` and the
   recommendation pipeline was encoded structurally. Nothing kept those two notions of "2" in sync
   when the adjacency migration landed — a correctness and performance risk, not a theoretical one.
   See "Post-audit updates" for the single-source fix.
3. **No cyclic-graph test against the real loader.** `tests/audit-crg-script.test.ts` covers the CI
   script with synthetic fixtures, but at audit time the generator itself had no test at all (unit
   coverage added same day), and no integration test proves that a cycle present in *data* fails
   closed through `loadKnowledgeBase()` → recommendation. The strongest guarantee today is the
   module comment plus schema re-parse.
4. **Edge-cycle prevention is schema-local; multi-hop cycle prevention is CI-only.** The schema
   refuses self-edges and per-node duplicate targets, and CI refuses cycles among adjacency files.
   That is adequate *if* the migration lands with those gates enforced; the acceptance criteria for
   "first adjacency file" should be written down now, including removing the vacuous-pass branch.

**Post-audit updates (same day).** Several remediation items were completed while this report was
being finalized:

- The pathway-depth cap is single-sourced in dependency-free `src/lib/kb/pathway-depth.ts`
  (`MAX_PATHWAY_HOPS` + `isWithinPathwayDepth`) and consumed by the schema bound, the generator,
  the two-edge composer, and both composite-nexus reducers. The composer now emits no intermediate
  chains if the cap ever drops below two edges, and `deriveCompositeNexus` /
  `deriveCompositeNexusFromClassifications` fail fast on an over-depth chain instead of mislabeling
  it.
- `tests/pathway-generator.test.ts` adds contract tests: cyclic termination (schema-valid
  A→B→A), unvalidated self-edge isolation, convergent-pathway survival (A→B→D / A→C→D),
  association-only chain breaking, rank determinism, cap enforcement across the schema and both
  reducers, and endpoint/contiguity fidelity. `tests/pathway-generator-fuzz.test.ts` adds a
  fixed-seed fuzz corpus (no new dependency) of cyclic and deep-chain graphs asserting bounded
  output, cap compliance, ancestor-free chains, structural fidelity, and determinism, plus
  targeted deep-chain, cycle-ring, and hub-convergence shapes. Fixtures come from
  `tests/helpers/pathway-fixtures.ts`, which parses every edge/node through the schemas (the one
  deliberate exception — the unvalidated self-edge probe — is labelled in-test), so traversal
  tests exercise graph shapes the loader would accept.
- The adjacency layer is now wired and gated: `src/lib/kb/graph-layout.ts` fixes the graph
  directory, `src/lib/kb/graph.ts` validates and loads it (fail-loud on schema, filename identity,
  duplicates, catalog membership), `src/lib/engine/graph-pathways.ts` is the generator's product
  entry point, and the first node (`liver-cancer`, edge-free) migrated; later the same day the
  graph gained its first real authored edge (`liver-cancer` → `sarcopenia` at ASSOCIATION_ONLY,
  on preflight-cleared PMIDs, with the `sarcopenia` identity added as staged Leg A of the signed
  2026-09-29 migration design). `npm run audit:crg:graph`
  now runs hard over live graph data, and `/api/health` reports validated graph migration state
  (`nodes`/`edges`) and degrades on invalid graph data. No user-facing surface renders graph
  pathways yet — `docs/crg-adjacency-migration-checklist.md`
  records the per-node acceptance bar and the open narrative-preservation decision.

Remaining from these findings: no UI consumer renders graph pathways (the graph now carries its
first authored edge but has no user-facing surface), the edge narrative-preservation decision is
open, and the loader-level cycle integration test is still
absent; all three are tracked in `docs/crg-adjacency-migration-checklist.md`.

### 2.2 Server/Client boundary: clean today, drift-prone tomorrow

- 37 `"use client"` components; 30 modules import `server-only`. No client component imports a
  server-only module (three apparent hits are comments explaining the boundary, not imports).
- Three client components deliberately duplicate KB type shapes to avoid importing server modules
  (`src/components/evidence/PathwayEvidenceTable.tsx`,
  `src/components/secondary/CitationDeepDiveExplorer.tsx`,
  `src/components/secondary/ConditionTimelineVisualization.tsx`). This is safe for confidentiality
  but creates silent type drift between client rendering and server contracts. A server-free shared
  `types.ts` (types only, no Zod data, no fs) is the maintainable resolution.
- `src/lib/engine/recommend.ts` is a server-side engine with no `import "server-only"` guard. It is
  imported only by server pages today; the guard is cheap insurance against a future client import.

### 2.3 Server Actions: validated and allowlisted, but the authorization story is "session possession"

- All four action modules are `"use server"` (`secondary`, `presumptive`, `scenarios`,
  `accredited-representatives`). `src/lib/actions/secondary.ts` applies per-step field allowlists
  (`appendFormData`) and Zod parsing via `parseOrRedirect` before writing session state.
- The workflow is anonymous by design. Authorization is therefore possession of the encrypted
  session cookie — there are no per-user accounts to authorize against. This is defensible for a
  pre-submission research tool, but it must be stated plainly in the VA package: there is no
  authenticated user, no VA account linkage, and no server-side per-user data store.
- No custom CSRF token is issued; `src/lib/security/csrf.ts` has no production callers. The
  control stack is POST-only Server Actions + the framework's origin validation +
  `SameSite=Strict` cookies + edge rate limiting. That stack is reasonable; it should be documented
  as such and re-reviewed if custom POST endpoints are ever added.

### 2.4 Session state and the PHI-adjacent boundary

- `src/lib/workflow-session-crypto.ts` seals cookies with AES-256-GCM, a SHA-256-derived key from a
  32+ character secret that **throws in production when absent** (fail-closed), versioned AAD, and
  envelope expiry validation on read.
- `src/lib/secondary-workflow/session.ts` stores condition IDs, ratings, timeline, plus free-text
  `medications`, `treatments`, and `history` (bounded counts/length, 3800-byte cookie budget,
  HttpOnly, `SameSite=Strict`, Secure in production, `path=/secondary`, 30-minute TTL).
- Residual risks to record:
  1. the ciphertext resides client-side; confidentiality rests on the secret's strength and on the
     absence of a chosen-ciphertext oracle (GCM + caught failures provide that);
  2. key rotation policy is undocumented — rotating `WORKFLOW_SESSION_SECRET` invalidates all live
     sessions, which is acceptable but should be written in the runbook;
  3. the free-text fields are the only server-visible health context in the product; a short
     privacy note and a retention statement belong in the VA package.

### 2.5 Evidence processing: local by construction

- Browser-local OCR/parsing (`src/components/evidence/LocalEvidenceAnalyzer.tsx`,
  `src/lib/evidence/*`) enforces file/page/character budgets before worker work, checkpoints with a
  15-minute TTL, and explicit partial-result notices. No upload path exists: the Server Actions
  never accept multipart file bodies — only metadata booleans and context strings.
- `src/lib/observability/telemetry-policy.ts` keeps automatic trace export disabled
  (`disabled-pending-review`); `src/lib/observability/logger.ts` recursively suppresses prohibited
  fields to depth 8 with allowlists; `src/lib/evidence/storage.ts` logs fixed content-free codes.
- No analytics/error-reporting SDK is present in `package.json` or imported in `src/`. The residual
  exposure is platform-level (Vercel/Azure request logs outside application control) — see §3.
- Open usability/abuse gap: there is no user-initiated cancellation control for an in-flight OCR
  job (the previously recorded A-10 finding). A dead-worker abort path exists; a user cancel button
  does not.

### 2.6 Outbound VA transport: well-bounded

- `src/lib/va/sandbox.ts`: 2 MiB bounded JSON reads, `redirect: "error"`, retries only 503/504 with
  bounded exponential backoff (100→400 ms, 20% jitter), 429 never retried and opens the circuit.
- `src/lib/va/circuit-breaker.ts`: 5 failures → open; 60 s half-open; single in-flight probe;
  Retry-After clamped 1–60 s.
- `src/lib/va/shared-circuit.ts` extends cooldown/probe coordination fleet-wide via the shared KV
  (cooldown marker + atomic probe lease), failing closed when coordination is unavailable.
- Residual: the app's own outbound budget (60/min, process-local) is not evidence of VA's published
  per-API quota. The per-API documented limits must be checked against the official API pages at
  submission time (this audit could not render those pages — §5).

### 2.7 Edge abuse controls

- `src/proxy.ts` normalizes pathnames before limiter comparisons (closing trailing/double-slash
  bypasses), applies per-endpoint limiters, and deliberately does not skip prefetch requests.
- `/api/csp-report` is excluded from the proxy matcher but implements its own bounded 30/min
  in-route limiter with eviction (not `clear()`, which an attacker could have abused to reset
  counters) and content-free 204/429 responses.
- All limiters are per-instance, fixed-window, behind the edge WAF; `X-Forwarded-For` trust is an
  operator input, as documented. On horizontally scaled serverless this multiplies the effective
  limit — acceptable defense-in-depth, not a global quota.

### 2.8 Supply chain / runtime

- Node `22.x` pinned in `engines` and CI workflows; lockfile-driven installs; production build
  clean. `braces <= 3.0.3` has no upstream patch and remains a non-blocking inventory item
  (reachability is development-tooling only). Host Node 24 produces `EBADENGINE` warnings at install
  time only; Node 22 parity was previously verified.

---

## 3. VA Production Checklist Gap Analysis

Sources for the "Requirement" column: developer.va.gov production-access flow (sandbox testing →
production access request → demo/review; open APIs commonly take 1–3 months), the VA production
access request form (Section 508 question; PKCE statement), and the repository's own gate records.
Where the official per-API quotas were not retrievable, this table says so instead of inventing a
number.

| Requirement | Current evidence | Gap / action | Owner |
|---|---|---|---|
| Sandbox integration proven with credentials | #189 recorded COMPLETE in `docs/external-manual-gates-status.md` (run 33997305230; both APIs HTTP 200 with request IDs) | Reconcile the contradicting documents (C-2); make one status source canonical | Repo |
| Production access request submitted with truthful applicant/organization data | `docs/phase3-production-access-package.md` is a draft, explicitly "do not submit yet" | Complete business facts; finalize the form including the 508 answer | Human/owner |
| Live demo of the application | Rehearsal defined in the package (30–60 min) | Execute against the exact deployed commit; record outcome | Human/owner |
| Section 508 / accessibility answer | Automated partial evidence only; manual workbook incomplete (#195) | Complete the manual review; do not claim conformance before it is recorded | Human/owner |
| OAuth/PKCE + redirect-URI registration (only if user-authorized APIs are requested) | Not implemented; not in current scope | Keep out of scope for this submission; treat authenticated APIs as a future reviewed feature (C-4) | Repo/owner |
| PII/PHI minimization and data handling answers | Browser-local evidence; no upload; sanitized logs; disabled auto-telemetry; VA-bound requests carry no veteran payloads | Document platform-log retention and the session-cookie free-text fields; define incident contact | Repo/owner |
| Resilient handling of 429/5xx/outages | Circuit breaking, bounded retries, jitter, fail-closed local fallback | Confirm against VA's published per-API rate limits at submission time | Repo |
| Production runtime coordination (rate limits/caches across instances) | Shared KV + shared circuit designed and unit-verified | Provision and verify in the deployed environment; ratify the `ci` fleet-budget window | Repo/owner |
| Credential handling | Server-only env vars; no `NEXT_PUBLIC_*`; fail-closed resolver; `VA_PRODUCTION_ACCESS_GRANTED` unset until grant | Rotation/runbook documentation | Repo |
| Final deployment verification | Canonical alias verified previously; readiness workflow exists | Re-verify exact commit + alias convergence immediately before submission | Repo/owner |

### What is *not* a gap (to avoid over-claiming in the submission)

- The app correctly requests only open APIs, so the production form's PKCE/redirect-URI questions do
  not apply to the current scope. State this explicitly rather than leaving the reviewer to infer.
- The recommendation engine, evidence review, and presumptive workflows function without VA
  availability; VA reference data is an administrative enrichment, never decision logic.

---

## 4. Actionable Remediation Plan

Ordered; each item is PR-sized and has observable acceptance criteria. Nothing here is committed or
deployed by this audit.

1. **Reconcile the gate documentation (C-2).**
   Correct `SECURITY.md` and `docs/phase3-production-access-package.md` to match
   `docs/external-manual-gates-status.md`; add a machine-readable status file plus a parity test in
   the existing doc-lint style so the contradiction cannot recur.
   *Acceptance:* the doc-lint suite fails if any living doc contradicts the status file.

2. **Decide the fate of `generateClaimPathways()` (2.1).**
   Either (a) mark it explicitly experimental and add unit tests for cyclic (A→B→A), self-edge, and
   convergent (A→B→D / A→C→D) graphs, or (b) ship it: add the `KbNodeMapping` adjacency loader,
   wire it behind a flag, and write the first-adjacency-migration acceptance checklist (including
   flipping `scripts/audit-crg.ts` off its vacuous pass).
   *Acceptance:* no exported engine function has zero callers and zero tests; a synthetic cycle in
   data fails closed through the real loader.
   *Status:* the unit-test and loader halves landed same-day (contract tests, seeded fuzz corpus,
   validated adjacency loader + generator entry point, first edge-free node migrated, and the
   first real authored edge authored later the same day — `liver-cancer` → `sarcopenia` at
   ASSOCIATION_ONLY on preflight-cleared PMIDs; audit gate flipped hard). Open: no UI consumer,
   the narrative-preservation decision for
   edge migration, and the loader-level cycle integration test
   (`docs/crg-adjacency-migration-checklist.md`).

3. **Single source of truth for traversal depth (2.1).**
   Export the pathway-depth constant from one module and consume it in both the generator and the
   two-edge composer; add a property-style test asserting bounded output on synthetic graphs with
   cycles and deep chains.
   *Acceptance:* changing the bound in one place changes both traversals; fuzz fixtures cannot
   exceed it.
   *Status:* completed 2026-10-03 — `src/lib/kb/pathway-depth.ts` is the single definition,
   consumed by the schema, generator, composer, and both reducers; cyclic and deep-chain behavior
   is pinned by contract tests and by a fixed-seed fuzz corpus (no new dependency).

4. **Make server-only boundaries explicit (2.2).**
   Add `import "server-only"` to `src/lib/engine/recommend.ts` (and any future server engine), and
   replace the three duplicated client type shapes with `import type` from a server-free shared type
   module.
   *Acceptance:* `grep` shows no client component within one hop of a server-only module; types are
   single-sourced.

5. **Close the OCR cancellation gap (2.5 / A-10).**
   Add a user cancel control that terminates the worker, checkpoints, and clears partial state.
   *Acceptance:* cancelling mid-file leaves no checkpoint and surfaces a clear, non-destructive
   status; existing abort/restart tests extended.

6. **Finish the 508 evidence trail (C-3).**
   Execute the manual workbook against the deployed commit, record per-page results, and add an
   automated axe smoke check in CI as a *complement* to—not a substitute for—the manual review.
   *Acceptance:* no `NOT TESTED` rows remain for the reviewed pages; the accessibility report links
   raw results by commit SHA.

7. **Verify the production coordinator end-to-end (C-1).**
   Provision the shared KV in production, run the fleet simulation and production-runtime readiness
   workflow against it, and ratify a `ci` budget window.
   *Acceptance:* production-mode requests either succeed within budget or fail closed to the
   labelled local fallback; evidence is attached to the package.

8. **Document the health-context data boundary (2.4).**
   Add the platform-log retention statement, cookie field inventory, and secret-rotation runbook to
   the privacy/operations docs.
   *Acceptance:* a reviewer can answer "what veteran data exists server-side, where, and for how
   long" from one document.

9. **Submission freeze checklist.**
   Freeze on the exact commit: CI green, production deployment READY, alias converged, Production
   Runtime Readiness green, demo rehearsed, #195 recorded, and this audit's actions 1–8 closed.
   *Acceptance:* the package's blocker list contains only items that genuinely remain.

---

## 5. Self-Audit

**Claims verified in the repository (not assumed):**

- No OAuth/PKCE/token code exists anywhere in `src/` (exhaustive search for
  `pkce`, `oauth`, `access_token`, `refresh_token`, `authorization_code`).
- At audit time `generateClaimPathways` had no production call sites and the on-disk KB contained
  no `KbNodeMapping` adjacency files, so `scripts/audit-crg.ts` reported a vacuous pass; same-day
  remediation added contract/fuzz coverage, a validated loader and generator entry point, one
  migrated edge-free node, and a hard audit gate (later the same day: the first real authored
  edge and the `sarcopenia` identity, contract 818/818) (see the post-audit updates above).
- Depth bounds and cycle guards are exactly as described in §2.1 (read directly from
  `pathway-generator.ts`, `pathways.ts`, `kb/utils.ts`, `kb/schema.ts`).
- Cookie cryptography, flags, TTL, and budget are as described (read directly).
- No analytics/error SDK in `package.json`; telemetry auto-export disabled; logger suppression is
  recursive with a depth cap.
- Rate-limit and matcher behavior read directly from `src/proxy.ts` and the CSP report route.

**Explicit contradictions resolved in this report (they were real, not rhetorical):**

1. `SECURITY.md` (sandbox verification still a future gate) vs.
   `docs/external-manual-gates-status.md` (#189 COMPLETE), plus the stale blocker in
   `docs/phase3-production-access-package.md`. Reported as C-2.
2. The brief's "813 conditions and 673 drafts as a multi-hop DAG" vs. the repository's 817
   conditions / 817 KB files (140 published, 677 drafts) with an unpopulated adjacency layer.
   Reported as overstatement risk in §2.1 and corrected here.

**What this audit could not verify — stated rather than assumed:**

- The rendered text of developer.va.gov pages could not be extracted (the site is client-rendered);
  only indexed snippets and the official production-access request form could be quoted. The
  process requirements quoted (sandbox → request → demo/review; 1–3 months for open APIs;
  PKCE-for-public-clients; the Section 508 question) come from those official sources, and none of
  the report invents a VA numeric quota. Verify per-API rate limits on the live API pages before
  enabling production traffic.
- Platform-side configuration (Vercel/Azure WAF rules, log retention, edge caching) and production
  environment values (whether the shared KV is provisioned, exact secret contents, grant status)
  are outside the repository and were not asserted.
- No live app, browser session, or production endpoint was exercised in this audit beyond prior
  verified runs recorded elsewhere in the docs; this report is a static, source-anchored review.
- Section 508 conformance is explicitly *not* claimed; only the repository's partial automated
  evidence was reviewed.

**Hallucination check for framework/API claims:** every Next.js assertion maps to a repository
artifact (`next.config.ts` keys `headers()`, `outputFileTracingIncludes`, `poweredByHeader`,
standalone output; `src/proxy.ts` as the middleware/edge entry; `"use server"` action modules; the
`server-only` import guard). The report does not rely on undocumented framework behavior for
security; where framework protections exist (Server Action origin checks), they are treated as
defense-in-depth alongside `SameSite=Strict` cookies and rate limiting, not as the sole control.

---

## Bottom line

The application's engineering hygiene is genuinely strong: browser-local evidence handling, no
tracking SDKs, fail-closed VA activation, bounded traversal, sanitized logs, and honest partial-508
documentation. The path to VA production access is blocked by **process and scope**, not by an
unpatched appsec hole: reconcile the contradictory gate records, keep the submission scoped to the
public APIs, finish the human 508 review, and prove the production coordinator before flipping
`VA_PRODUCTION_ACCESS_GRANTED`. If the goal shifts to authenticated VA APIs, budget a full OAuth
authorization-code + PKCE feature and a fresh review — the current codebase contains none of it.
