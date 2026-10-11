# VA Lighthouse Production-Readiness Report

**Project:** Secondary Condition Finder
**Report date:** 2026-10-10
**Audited revision:** `main` @ `ecca75741313eeaa4e26b3251fad8018ca766078` (merge of PR #523, 2026-10-10 17:01 -0500)
**Deployed reference:** `https://secondary-condition-finder.vercel.app`
**Disposition:** **NO-GO** for a VA Lighthouse production-access submission today. Four Blockers remain. Two are closable from code in this repository; two are external/human gates that no commit can satisfy.

> **Release constraint in force.** The project's own freeze rule — *"nothing ships before 2026-10-11"* (`docs/catalog-identity-migration-design-2026-09-29.md:5`, `docs/condition-expansion-roadmap.md:5459`) — is active on the audit date. Every Phase 2 item below is therefore **local code/documentation work only**. No commit, push, PR, deployment, or enablement-flag flip is authorized by this report.

---

## 1. Scope and method

This is a production-readiness assessment of the current working tree against the requirements VA Lighthouse applies when reviewing a production-access request: authentication/authorization correctness, privacy and data-deletion policy, Section 508 / WCAG 2.1 AA conformance, security gating in CI, and evidence sufficiency.

**What was done:**

| Activity | Result |
| --- | --- |
| Source review of OAuth surface (`/api/auth/login`, `/api/auth/callback`, `src/lib/va/account/*`) | Complete |
| Source review of VA API client, proxy, route policies, runtime mode resolution | Complete |
| Review of `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `SECURITY.md` | Complete |
| Review of CI workflows (`.github/workflows/*`, 13 files) | Complete |
| `npm audit --omit=dev` | **3 moderate**, 0 high, 0 critical |
| PHI logging audit (`node scripts/audit-phi-logging.mjs`) | **254 files scanned, 0 violations** |
| Accessibility gate (`pr-508-compliance.yml:43-52` — 6 named files, run verbatim) | **6 files, 36 tests, all passing** |
| WCAG 1.4.3 / 1.4.11 contrast computation over real color pairs in source | 21 pairs evaluated; **5 below the applicable threshold** — 2 real text-contrast violations, 3 WCAG-exempt (see §3.2) |
| Reconciliation against prior audits (`docs/security-va-production-audit-2026-10-04.md`, `docs/audit-issue-list-ordered-by-priority.md`) | Complete |

**What was NOT done.** No code was modified. No real Veteran record, credential, VA business transaction, or production mutation was used. No penetration test. No human screen-reader, keyboard, zoom/reflow, or forced-colors session was performed — that is Issue **#195**, a human-only gate that remains open.

**Severity convention** (matches the project's existing audit vocabulary):

- **Blocker (P0)** — an access, scope, or compliance gate. Submission must not proceed. Not necessarily a remotely exploitable vulnerability.
- **High (P1)** — a high-impact correctness, availability, privacy-assurance, or usability defect.
- **Medium (P2)** — a lower-impact assurance or coverage gap; usually disclosed rather than silently fixed.
- **Low (P3)** — polish, defense-in-depth, or documentation hygiene.

---

## 2. Executive summary

The engineering quality of this repository is **substantially higher than typical** for a pre-production Lighthouse applicant. The OAuth/PKCE implementation is genuinely well built, the fail-closed posture is deliberate and tested, the PHI logging boundary is enforced by an automated scanner that currently reports zero violations across 254 files, and the accessibility automation is a real merge-blocking gate rather than a decorative check.

The blockers are therefore **not** "the code is insecure." They are:

1. **VA has not granted production access, and the account integration is architecturally sandbox-only.** `src/lib/va/account/config.ts:33` hardcodes `ACCOUNT_ORIGIN = "https://sandbox-api.va.gov"`, the issuers at lines 15 and 23 are both `deptva-eval.okta.com`, and line 10 states plainly: *"No production endpoint override exists in this phase."* `loadVaAccountConfig()` returns `null` unless **both** `VA_ACCOUNT_SANDBOX_ENABLED === "true"` **and** `VA_ACCOUNT_ENV === "sandbox"` (config.ts:74). There is no production origin, issuer, or config path anywhere in the codebase. This is correct and intentional for the current phase — but it means no amount of remediation makes the app production-capable for veteran-specific data. Issue **#287** (*VA public-reference production transition*) is OPEN and requires two distinct external events: an explicit VA grant, then a controlled authorized connectivity check.

2. **The Privacy Policy has no data-deletion right, no 45-day deletion commitment, and no contact channel.** This is the single most actionable finding in this report. VA Lighthouse production review asks applicants to identify their privacy policy and data-handling practices. `src/app/privacy/page.tsx` (137 lines) has twelve `<h2>` sections — numbered 1–8 plus sub-sections 1a, 5a, 5b and a "Privacy by design" header; §7 "Retention summary" (lines 115–122) describes only *automatic expiry* behavior. A regex search for any contact email address across `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/app/about/page.tsx`, and `SECURITY.md` returned **zero matches**. A user currently has no documented way to request deletion, and the project has made no deletion-timeline commitment. **Closable from code.**

3. **Section 508 conformance cannot be truthfully claimed.** `docs/section508-manual-review-workbook.md` (191 lines) has every result row at `NOT TESTED` and no tester, date, assistive-technology, or sign-off recorded. Issue **#195** is OPEN and human-only. Compounding this, **color contrast is explicitly excluded from all automated checking**: `tests/accessibility-automation.test.tsx:212` pins `AXE_JSOM_SKIPPED_RULES` to exactly `["color-contrast"]`, because jsdom cannot compute layout. So the 36 passing a11y tests prove structure, labels, keyboard entry, focus styles, reflow safeguards, and announcements — but **prove nothing about contrast**. Independent computation found real failures (§3.2, H-01). **Partially closable from code.**

4. **The restricted-API client is dead code — but note what *is* wired.** `src/lib/va/api-client.ts` is 546 lines of carefully engineered single-flight-refresh, bounded-backoff, zero-logging HTTP client, and grep confirms its only importers are `tests/va-restricted-api-client.test.ts:11` and `tests/phi-logging-boundary.test.ts:338`. No production caller exists. The distinction that matters for the submission: **read-only claim status *is* wired** through the VA Account OAuth path (`loadVaAccountConfig("claims")` at `src/app/api/auth/login/route.ts:56` and `callback/route.ts:58`, scope `claim.read`, endpoint `/services/claims/v1/claims`), sandbox-only. What is absent is the *restricted* Claims/Intake surface — bulk claim reads and document upload — for which `api-client.ts` was built and never connected. `src/app/privacy/page.tsx:103` already states this correctly: *"Production account access, representatives, submissions and uploads remain disabled."*

**Bottom line:** submit for the **narrow public Forms / Benefits Reference Data scope only**, and only after Blockers B-03/B-04 are closed and the external gates resolve. Do not describe the application as veteran-account-capable, and do not answer "Yes" to the Section 508 question until #195 has human evidence on an identified build.

---

## 3. Phase 1 — Severity assessment

### 3.0 Readiness scorecard

| Requirement area | Status | Severity | Closable from this repo? |
| --- | --- | --- | --- |
| VA production grant / access | Not granted; `VA_PRODUCTION_ACCESS_GRANTED` unset in every environment | **Blocker** | No — external |
| Veteran-specific OAuth (ratings/claims) production path | Absent by design; sandbox-only | **Blocker** | No — needs VA registration |
| Privacy policy — deletion right & 45-day commitment | **Missing** | **Blocker** | **Yes** |
| Privacy/security contact channel | **Missing** | **Blocker** (with above) | **Yes** |
| Section 508 human attestation (#195) | NOT TESTED, no sign-off | **Blocker** | No — human |
| WCAG 1.4.3 contrast — measured failures | 2 real failures + 2 fragile margins | **High** | **Yes** |
| CI dependency-vulnerability gate | **Wired and enforced** — `npm run audit:high` at `ci.yml:176`, re-failed by the aggregator | Pass | n/a |
| Scheduled dependency re-audit (no commit needed) | Absent — audit only runs on push/PR/dispatch | **Medium** | **Yes** |
| OAuth/PKCE correctness (sandbox) | Strong — S256, one-use, state+binding, nonce, origin check | Pass | n/a |
| PHI logging boundary | 254 files, 0 violations | Pass | n/a |
| Fail-closed runtime mode selection | Tri-state, deliberate, tested | Pass | n/a |
| Privacy statement vs. actual telemetry | Reconciled in text; two operator reviews open and **untracked** | **High** | Partial — needs operator action |
| Small-text / uppercase density | 286 `text-xs`, 41 `uppercase` | **Medium** | **Yes** |
| Restricted-API client wiring | Unwired (test-only importers) — evidence for B-04 | **Blocker** (see B-04) | Yes, when scope approved |
| Dependency vulnerabilities | 3 moderate, transitive, `--omit=dev` | **Low** | **Yes** |

### 3.1 BLOCKER (P0) — submission must not proceed

#### B-01 — No VA production access; account integration is architecturally sandbox-only

**Closable from repo:** No — external gate (#287 OPEN).

**Evidence.**
- `src/lib/va/account/config.ts` sets `ACCOUNT_ORIGIN = "https://sandbox-api.va.gov"` as a constant. No production origin exists anywhere in `src/`.
- `loadVaAccountConfig(service)` returns `null` unless `VA_ACCOUNT_ENV === "sandbox"`. There is no `production` branch.
- `docs/phase3-production-access-package.md` states its own status: **"Draft for VA production-access review. Do not submit yet."**
- `docs/external-manual-gates-status.md`: *"#287 — VA public-reference production transition. **Status: OPEN / EXTERNALLY BLOCKED on VA production access.**"*
- `.env.example:45` ships `VA_PRODUCTION_ACCESS_GRANTED=false`, and the gates register confirms *"The variable is intentionally unset in every current environment."*

**Positive control worth stating.** This is fail-closed *by construction*, not by convention. `src/lib/va/runtime-state.ts` requires production intent **and** `VA_PRODUCTION_ACCESS_GRANTED` **and** both service-specific production keys; any ambiguity resolves to `disabled`. A single mis-set variable cannot repoint public reference surfaces at production or relabel data as production-sourced. Preserve this design exactly as-is.

**Why it still blocks.** VA's production review requires an approved grant, registered redirect URIs, and an approved API/version/scope list. None exist. Current live state is correctly `https://secondary-condition-finder.vercel.app/va-reference` → HTTP 200 with **"Local catalog fallback"** and VA access **disabled**. That is the expected state, not evidence of connectivity.

**Impact if ignored.** Submitting a request that claims veteran-account capability would be a false statement on a federal access request. The `/va-account` page already says the right thing — *"Production account access is unavailable in this phase"* — and the submission must match it.

---

#### B-02 — Privacy Policy has no data-deletion right, no deletion timeline, and no contact channel

**Closable from repo:** **Yes — the highest-value code fix available.**

**Evidence.** `src/app/privacy/page.tsx` (137 lines) is organized as:

| § | Heading | Line |
| --- | --- | --- |
| 1 | Workflow session state | 25 |
| 1a | Voice input | 44 |
| 2 | URLs and browser history | 47 |
| 3 | Browser telemetry and server-side operational tracing | 52 |
| 4 | Optional browser-local evidence review | 63 |
| 5 | Evidence and context classification limits | 81 |
| 5a | Accredited-representative directory search | 89 |
| 5b | DD-214 upload (browser-local) | 93 |
| 6 | VA API and claim-submission boundary | 98 |
| 7 | **Retention summary** | 115 |
| 8 | Policy changes | 124 |

§7 (lines 115–122) lists five bullets. Every one describes **automatic expiry or in-app clearing by the user's own hand**: workflow records in tab-scoped session storage "can be cleared with the workflow controls"; evidence excerpts and checkmarks "can be cleared from the workflow"; the evidence feature "does not create a server-side medical-record store or user account"; operational events "may be retained by the hosting platform"; sandbox sessions "expire after 30 minutes and can be disconnected".

**What is absent — verified by search, not by impression:**

1. **No user right to request deletion** of anything the platform or host retains: operational event logs, hosting request logs, sandbox account session records.
2. **No deletion timeline.** There is no 45-day — or any other — permanent-deletion commitment anywhere in the policy.
3. **No contact channel.** A regex search for email addresses across `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/app/about/page.tsx`, and `SECURITY.md` returned **zero matches**. No email, no request form, no postal address, no "contact us" route for a privacy request.
4. `src/app/terms/page.tsx` §7 (lines 92–94) merely cross-references the Privacy Policy and adds no deletion right.

**Why this is a Blocker, not a nit.** The policy itself concedes that retained data exists. §3 (line 60) and §7 (line 120) state that operational events *"may be retained by the hosting platform"* and that *"deployed retention and exception export settings require review."* §6 (line 103) states that *"Callback URLs necessarily contain temporary OAuth code/state: hosting request-log scrubbing and retention must be reviewed before any credentialed hosted use."* The document therefore **acknowledges retention** while giving the user **no mechanism to request removal and no timeline for destruction**. That is an internally inconsistent privacy posture, and precisely the gap a Lighthouse privacy review is designed to catch.

**Mitigating context (state it, do not overclaim).** The app genuinely minimizes collection: workflow state is browser-local and tab-scoped, the core product has no user account, the local evidence feature never uploads document content to the server, and the PHI scanner reports zero violations across 254 files. The deletion gap is a **policy and documentation defect**, not evidence of hoarded sensitive data. It is nonetheless disqualifying on the submission form until fixed.

---

#### B-03 — Section 508 conformance cannot be truthfully claimed (#195)

**Closable from repo:** Partially — the contrast defects yes; the attestation no.

**Evidence.**
- `docs/section508-manual-review-workbook.md` (191 lines): the Session Identity table is blank for Tester, Review date/time, Deployed `main` SHA, Vercel deployment ID, Vercel commit status, Main CI run, Production Runtime Readiness run, OS, browser, assistive technology, and display/zoom configuration. The workbook states: *"No human accessibility evidence was recorded against these builds. Every result table below remains `NOT TESTED`."*
- `docs/external-manual-gates-status.md`: *"#195 — **Status: OPEN / HUMAN-ONLY**… it cannot truthfully record PASS for an unperformed human test."*
- **Contrast is structurally unverified by automation.** `tests/accessibility-automation.test.tsx:212` asserts that `Object.keys(AXE_JSOM_SKIPPED_RULES)` equals exactly `["color-contrast"]`. jsdom performs no layout or paint, so axe's contrast rule is disabled rather than allowed to fail. `.github/workflows/pr-508-compliance.yml` runs those same jsdom suites. **No workflow runs a real-browser axe or Lighthouse contrast check.**
- Consequence: the merge-blocking a11y gate (6 files, 36 tests, all passing) covers structural, label, keyboard-entry, focus-style, reflow-safeguard, forced-colors, reduced-motion, validation, mobile-workflow, and live-status contracts — and is silent on the one WCAG success criterion most likely to fail in this codebase. Measured failures are documented at **H-01**.

**Why it blocks.** VA's production request asks a Section 508 question. The project's own gate rule forbids answering it affirmatively without human evidence on an identified build. Answering "Yes" today is unsupportable; answering "No" without remediation invites rejection. The correct sequence is: fix the measured contrast defects, complete the workbook against an identified build, then answer truthfully with the evidence attached.

---

#### B-04 — The restricted Claims/Intake client is unwired, so that scope cannot be demonstrated

**Closable from repo:** Only once scope is approved by VA.

**Be precise about what exists.** Read-only *claim status* is genuinely implemented and wired: `VA_ACCOUNT_SERVICES = ["ratings", "claims"]` (config.ts:5), scope `claim.read` (config.ts:24), endpoint `/services/claims/v1/claims` (config.ts:25), with `loadVaAccountConfig("claims")` called from both `src/app/api/auth/login/route.ts:56` and `src/app/api/auth/callback/route.ts:58`, and results typed at `src/lib/va/account/data.ts:42,101`. That path is real, tested, and sandbox-only. **It is not what this finding is about.**

**Evidence for the finding.** `src/lib/va/api-client.ts` is 546 lines of `import "server-only"` code implementing 401 single-flight refresh-and-replay, `Retry-After`-exact backoff capped by `MAX_RETRY_AFTER_WAIT_MS`, `MAX_RESPONSE_BYTES`-bounded reads, zod schema validation, and a deliberate zero-logging contract (*"this module imports no logger and touches no console"*). Its complete importer list:

```
tests/va-restricted-api-client.test.ts:11
tests/phi-logging-boundary.test.ts:338
```

**No production caller.** `tests/phi-logging-boundary.test.ts:330` describes it accurately as *"the restricted-API (Claims/Intake) counterpart"*. The Intake surface is not merely unwired — it is entirely unimplemented: a grep for the VA **Benefits Intake API** identifiers across `src/` returns **zero matches**:

```
grep -rn 'upload_documents\|benefitsIntake\|benefits_intake\|intake\.vets\|BenefitsIntake' src   # → no matches
```

A bare case-insensitive grep for `intake` is **not** valid evidence here and must not be cited: it returns ~14 matches, all for the unrelated recommendation-engine `Intake` type (`src/lib/secondary-workflow/recommendation-intake.ts`, `matchedIntakeContext`, `recommend(catalog, kb, intake)`). `api-client.ts:173` documents its own path shape as Claims (`/services/claims/v1/claims`), confirming the client targets Claims, not Intake. This matches the 2026-10-10 addendum at `docs/audit-issue-list-ordered-by-priority.md:21`: *"…an unwired restricted-API HTTP client."*

Per the prior audit's API contract matrix, Benefits Intake also has non-obvious mechanics that are entirely unimplemented: `POST /uploads` returns a GUID plus a signed location valid **15 minutes**; the multipart PUT to that signed location must carry **no `apikey` header**; PDF ≤ 100 MB and ≤ 78 × 101 inches; and a successful PUT does **not** establish VA date of receipt. Benefits Claims v2 is marked *"Internal VA Use Only"* while v1 is *"Non-VA Use"* — version eligibility must be confirmed with VA, never inferred from a "Current Version" label.

**Why it blocks.** If the submission requests restricted Claims or Intake scope, it must demonstrate them. It cannot. Conversely, the read-only `claim.read` account path *can* be demonstrated in sandbox and should be described accurately rather than lumped in with the missing capability.

**Recommendation.** Do **not** request restricted Claims or Intake scope in this submission. Keep the request to public Forms + Benefits Reference Data, which *are* implemented with real adapters and fail-closed selection, plus the VA Account read-only rating/claim-status scopes that are genuinely wired. Retain `api-client.ts` as pre-built groundwork for a separately designed future phase — the code is good and its test coverage is real — but do not present it as a delivered integration.

---

### 3.2 HIGH (P1)

#### H-01 — Measured WCAG 1.4.3 contrast failures, and no automated contrast gate to catch regressions

> **STATUS: REMEDIATED and MERGED (task R-02)** — landed in PR #520, merge
> commit `4112e719` on `main`. The wording below ("pending review/commit") was
> accurate when this assessment was written and is retained for provenance.
> `--color-muted` is now exposed in `@theme inline`, all **65** `text-slate-500`
> call sites across **27** files were swept to `text-muted`, and a new
> `tests/design-token-contrast.test.ts` (8 tests) guards the token *and* scans
> `src/` so the off-token class cannot be reintroduced. Post-fix, an audit of
> all **130** co-occurring text/background colour pairs in `src/` found **0**
> below threshold (1 remaining sub-threshold pair is the WCAG-exempt disabled
> state, L-02). The 508 gate is unchanged at 6 files / 36 tests.
>
> **Correction (2026-02-10):** the ratios originally published below used the
> Tailwind **v3** slate/blue/amber hex values. This project ships Tailwind
> **4.3.3**, which re-tuned the palette. Every palette-derived number has been
> recomputed from the values actually emitted in the production bundle
> (`.next/static/chunks/*.css`). **No conclusion changes and no previously-passing
> pair regressed** — every delta is ≤ 0.12. See Appendix B correction 13 in the
> remediation runbook.

Ratios below are computed from the actual Tailwind 4.3.3 palette values emitted in the production bundle and the project literals in `src/app/globals.css`, using the WCAG 2.1 relative-luminance formula. Thresholds: **4.5:1** normal text, **3:1** large text and non-text UI (1.4.11). Note that Tailwind 4.3.x ships `slate-500` as `#62748e` (not v3's `#64748b`) and `slate-600` as `#45556c` (not `#475569`) — so the project's `--muted: #475569` is a literal in `globals.css` and is **not** the same value as Tailwind's `slate-600` in v4. That is an advantage: the token is immune to upstream palette re-tuning.

**Real violations — FIXED by R-02 (ratios shown are pre-fix, under the real Tailwind 4.3.3 palette):**

| Ratio | Needed | Pair | Location | After R-02 |
| --- | --- | --- | --- | --- |
| **4.35:1** | 4.5:1 | `text-slate-500` `#62748e` on `bg-slate-100` `#f1f5f9` | systemic — 14 `bg-slate-100` containers vs 65 `text-slate-500` instances | **6.92:1** ✅ |
| **3.86:1** | 4.5:1 | `text-slate-500` `#62748e` on `bg-slate-200` `#e2e8f0` | hover/active states, e.g. `SecondarySuggestionsTabs.tsx:81` (`hover:bg-slate-200`) | **6.15:1** ✅ |

**Fragile margins — passed before, now carry large headroom:**

| Ratio (pre-fix) | Pair | Note | After R-02 |
| --- | --- | --- | --- |
| **4.55:1** | `text-slate-500` on `bg-slate-50` `#f8fafc` | `EvidenceGapCoverage.tsx:66` — only **0.05** above the AA floor | **7.24:1** ✅ |
| **4.76:1** | `text-slate-500` on white | 0.26 above the floor; 65 occurrences | **7.58:1** ✅ |

**Exempt — recorded so they are not mistaken for violations:**

| Ratio | Pair | Why exempt |
| --- | --- | --- |
| 1.49:1 | `text-white` on `disabled:bg-slate-300` `#cad5e2` (`ServiceHistoryForm.tsx:200`) | WCAG 1.4.3 *inactive user interface component* exception. Still a low-vision usability concern; see L-02. Deliberately untouched by the R-02 sweep. |
| 2.07:1 | `text-amber-500` `#f99c00` icon on `bg-amber-50` (`CoverageNotice.tsx:19`) | The SVG is `aria-hidden="true"` and purely decorative; identical meaning is carried by the adjacent `text-amber-800` heading (6.88:1) and `text-amber-700` body (4.87:1). Not required to identify a component, so 1.4.11 does not apply. |
| 1.80:1 | `--border-strong` `#93c5fd` on white (`globals.css:9,81,96`) | Decorative callout/footer-note border, not the sole means of identifying a control. **Would fail 1.4.11 if reused as a form-field boundary** — worth a lint rule. |

**Confirmed-passing pairs** (recomputed against Tailwind 4.3.3): `--muted` on surface **7.58:1**; `--muted` on page background **7.24:1**; `--primary` on white **6.70:1**; `text-blue-700` `#1447e6` on `bg-blue-50` **6.28:1**; `text-blue-600` `#155dfc` on white **5.25:1**; `text-blue-800` `#193cb8` on `bg-blue-50` **8.11:1**; `text-slate-600` `#45556c` on `bg-slate-100` **6.92:1**; `text-amber-900` `#7b3306` on `bg-amber-50` **8.73:1**; timeline tooltip `text-white` **17.83:1** and `text-slate-200` **14.46:1** on `bg-slate-900` `#0f172b`.

**The process defect matters more than the two failing pairs.** Because `color-contrast` is the single rule axe skips in jsdom, and no real-browser contrast check exists in any of the 13 workflows, **any future commit can introduce a contrast regression and CI will stay green.** With 286 `text-xs` instances the failure surface is broad rather than isolated. *R-02 closes the token half of this gap analytically (`tests/design-token-contrast.test.ts`, which runs in the main `npm test` suite); R-05 closes the real-browser half.*

**Fix direction — verified candidate tokens.** Measured against the four backgrounds in play, Tailwind's `slate-500` (`#62748e` in 4.3.3) fails on the two darker ones. Candidate replacements, computed with the same formula:

| Token | white | `slate-50` | `slate-100` | `slate-200` | Verdict |
| --- | --- | --- | --- | --- | --- |
| `#62748e` (Tailwind 4.3.3 `slate-500`, the pre-fix value) | 4.76 | 4.55 | **4.35** | **3.86** | fails 2 of 4 |
| `#5b6b7f` | 5.45 | 5.21 | 4.97 | **4.42** | still fails on `slate-200` |
| `#556377` | 6.11 | 5.84 | 5.58 | 4.96 | **passes all 4** |
| `#52616f` | 6.37 | 6.09 | 5.81 | 5.16 | **passes all 4, more headroom** |
| **`#475569` (`--muted`) — CHOSEN** | **7.58** | **7.24** | **6.92** | **6.15** | passes all 4, largest margin |

All four candidates from `#556377` downward clear AA on every background including `slate-200` hover states. **Decision (implemented):** no new hex was introduced — the codebase already shipped `#475569` as `--muted` (`globals.css:7`), which passes all four backgrounds with the largest margin. The real defect was that `text-muted` had **0 usages** because `@theme inline` never exposed it, so 65 call sites hardcoded Tailwind's lighter `slate-500` instead. R-02 exposed the existing token and swept those call sites — a smaller, lower-risk change than choosing a new colour. `#52616f` remains the fallback if the design owner wants to preserve the pre-fix visual weight more closely.

> **Note on the `slate-600` label.** `#475569` is Tailwind **v3**'s `slate-600`. Under Tailwind 4.3.3 `slate-600` is `#45556c`, a hair darker. The two are **1.00:1** apart — visually identical — so the 65 swept sites and the 161 existing `text-slate-600` sites now render as one coherent muted grey. That is a consistency gain, and because WCAG needs **3:1** for two elements to read as distinct, the pre-fix `slate-500`→`slate-600` step (**1.59:1**) was never carrying perceptible hierarchy in the first place. This is why the hierarchy-collapse risk flagged for Option A did not materialise. Keeping `--muted` as a literal also makes it immune to any future upstream palette re-tuning.

**Remaining for H-01:** add a real-browser contrast gate so the fix cannot silently regress in ways the token test cannot see (**R-05, §5.5**).

---

#### H-02 — Two operator privacy reviews are acknowledged as pending but have no owner or tracking issue

The privacy policy defers two reviews that must complete before credentialed hosted use:

1. **Hosting log retention and access controls** — §3 line 60: *"deployed tracing configuration and hosting retention/access controls still require operator review."* §7 line 120 repeats it.
2. **Callback-URL log scrubbing** — §6 line 103: *"Callback URLs necessarily contain temporary OAuth code/state: hosting request-log scrubbing and retention must be reviewed before any credentialed hosted use."*

Item 2 is concrete and material. `GET /api/auth/callback?code=…&state=…` places a live authorization code in the query string. **The application handles this correctly**: `src/app/api/auth/callback/route.ts` consumes the transaction single-use, responds with a 303 carrying only a notice code, and never writes a token, code, or upstream document to a response body or log; `src/lib/va/account/oauth.ts:124-125` enforces one-use consumption via `store.consume(key)` plus an exact-payload comparison, so a replayed or altered callback fails closed.

**But Vercel's platform request logs sit outside the application's redaction layer.** Until retention and scrubbing are reviewed, a one-time-use code is present in host logs. Single-use consumption makes exploitation impractical — hence High, not Blocker — but the review must be *recorded as done*, not merely acknowledged as pending.

Neither item appears in `docs/external-manual-gates-status.md` alongside #189/#195/#213/#287, so neither has an owner, an issue number, or a completion criterion.

---

### 3.3 MEDIUM (P2)

#### M-01 — Small-text and uppercase density create low-vision and screen-reader risk

> **STATUS (2026-10-11): uppercase half REMEDIATED and MERGED (task R-07); the raw `text-xs` count is intentionally left open.**
>
> **Uppercase — closed.** All 37 multi-word eyebrow labels, sentence-like headings, and nexus-classification badges (including "Association only — chain broken" and the composite `{category} · {sourceName} · {locator}` evidence labels) were returned to sentence-case across 13 files, removing the `tracking-wide`/`tracking-wider` letter-spacing that existed only to keep all-caps legible. `uppercase` now survives in exactly **3** places, all genuinely short single-word table-header rows that R-07 explicitly preserves: `PathwayEvidenceTable.tsx:176`, `PathwayEvidenceMapper.tsx:203`, `ConditionComparisonTool.tsx:114`. The current count is **3**, not 41.
>
> **`text-xs` count — deliberately open.** 286 → **261**. Only the 20 elements carrying legal, privacy, safety, or verification meaning were raised to 14px (see M-02). Blanket-upscaling every remaining decorative label would be a visual redesign rather than an accessibility fix, so it was not attempted.
>
> **Correction (2026-10-11)** to the `uppercase` row below: CSS `text-transform: uppercase` does **not** alter the DOM text node, so NVDA, JAWS, and VoiceOver announce the underlying sentence-case source and do *not* spell it letter-by-letter. Letter-by-letter announcement is real but applies to text typed in literal ALL CAPS in markup. The genuine defect here is the low-vision one the same row already names — capitalising every word destroys word-shape cues — compounded by letter-spacing on 12px text. The remediation and its rationale are unchanged; only the screen-reader mechanism is corrected.
>
> Both halves are locked against regression by `tests/legal-notice-legibility.test.ts` (17 tests), proven to gate by deliberate mutation in both directions.

Counts over `src/**/*.tsx`:

| Pattern | Count | Concern |
| --- | --- | --- |
| `text-xs` (0.75rem = **12px**) | **286** | Below the 14px floor VA style guidance recommends for body content, and used on substantive text — not just metadata. `Disclaimer.tsx:20` renders the entire legal disclaimer at `text-xs`; `Dd214LocalAnalyzer.tsx:379` uses it for *"Full SSN is never stored. This preview is in-memory only."* |
| `uppercase` | **41** | CSS `text-transform: uppercase` on small labels. Some AT/browser combinations announce all-caps text letter-by-letter, and uppercase removes word-shape cues for low-vision and dyslexic readers. |
| `uppercase tracking-wide text-xs` combined | ≥ 8 | Concentrated in `thead` and eyebrow labels: `PathwayEvidenceTable.tsx:176`, `PathwayEvidenceMapper.tsx:203`, `SecondarySuggestionItem.tsx:60,149,205,217`, `NonServiceConnectedConditionResult.tsx:59`, `PresumptiveResults.tsx:295,322,345`. |

This is **not** a WCAG violation — no success criterion mandates a minimum font size or forbids uppercase. It is a usability and plain-language concern that VA reviewers do read for. The H-01 contrast fix mitigates part of it (darker muted text helps small text legibility), but 12px on a legal disclaimer is worth changing regardless.

#### M-02 — Legal disclaimer and critical safety notices sit at the smallest text size

> **STATUS (2026-10-11): REMEDIATED and MERGED (task R-07).** The size half is now closed as well as the colour half. Both elements this finding names by line number were raised to `text-sm` (14px): the `Disclaimer.tsx:20` footer legal disclaimer and the `Dd214LocalAnalyzer.tsx:379` SSN notice. The sweep was then extended past the two named sites to every other element in `src/` carrying legal, privacy, safety, or verification meaning — **20 elements across 11 files** in total — because a floor applied only to the two audited examples would have left the identical defect standing in the export, checklist, record-walkthrough, and reference-filter notices. Full inventory in `docs/accessibility-audit.md`.

Separately actionable from M-01 because of the content's importance. `src/components/Disclaimer.tsx:20` wrapped the whole footer disclaimer in `text-xs leading-relaxed text-slate-500` — 12px text in a colour that **bypassed the app's own design token**. Note the distinction: the project's `--muted` token is `#475569` (`globals.css:7`), which measures a comfortable **7.58:1** on white and **6.92:1** on `slate-100`. The disclaimer instead hardcoded Tailwind's lighter `text-slate-500` (`#62748e` under Tailwind 4.3.3; `#475569` is *not* Tailwind 4's `slate-600`, which is `#45556c` — see the note in §3.2), measuring **4.76:1** on white and **4.35:1** on `slate-100` — the latter a real AA failure. So this is not "the muted token is too weak"; it is "65 call sites reach around a perfectly good token." This is the text telling users the tool is not legal or medical advice. `CoverageNotice.tsx` correctly uses `text-sm` for its equivalent warning; the disclaimer should match. **The colour half is fixed by R-02 (`text-muted`, now 7.58:1 / 7.24:1 on this footer's backgrounds); the `text-xs` → `text-sm` size half remains open under R-07.**

#### M-03 — Reading level of legal copy was not machine-verified for this report

§6 line 103 of the privacy policy is a single **163-word sentence** covering sign-in, scopes, token storage, cookie attributes, session expiry, display filtering, disconnect semantics, and callback logging; its longest single sentence runs 26 words. The rest of the document is comparatively readable — the §1 summary sentences average about 16 words. That one paragraph is far above a plain-language target for a public-facing policy, and it is the paragraph a Veteran must understand before authorizing account access. Flagged for a dedicated readability pass; this report does not assert a grade-level number it did not reliably measure.

#### M-04 — Prior audit's architectural items A01–A10 were not independently re-verified here

`docs/security-va-production-audit-2026-10-04.md` §3 records ten architectural findings (reference-search text exposure path, inbound rate-limit route coverage gaps, fixed-minute budget burst, cached-view schema validation, cache revocation on feature disable, DD-214 parser integrity parity, OCR cancellation fence, graph/DAG representation duplication, deployment tracing over-expansion, legacy adapter debt). §9 records B04–B07 as fixed locally with regression suites.

**One change is confirmed:** the legacy adapter at `src/lib/va/index.ts` cited in A10 no longer exists — `src/lib/va/` now holds 23 modules plus the `account/` package, and no `index.ts`. The remaining A-items should be re-verified against current `main` before submission rather than assumed closed or assumed open.

#### M-05 — Dependency audit is enforced on commit but never re-runs on a schedule, and there is no SAST

**What already works — credit where due.** `ci.yml:176` runs `npm run audit:high` as an *enforced* gate. It carries `continue-on-error: true`, which looks like a loophole but is not: the aggregator step at `ci.yml:372` ("Fail the job if any gate failed") explicitly re-fails the job when `steps.audit.outcome == "failure"`, alongside 15 other gates. The intent is documented in a comment at lines 170–175, including why the dev-tree advisory is inventoried separately rather than weakening the prod gate. A second step (`ci.yml:187`) runs `audit:high:all` as a deliberately non-blocking full-tree inventory. This is a well-reasoned control, and it is **not** a finding.

**The residual gap is cadence, not existence.** `ci.yml` triggers only on `push` to `main`, `pull_request`, and `workflow_dispatch`. Only two workflows carry a `schedule:` block — `citation-decay-watch.yml` (Mon 06:07) and `va-gov-walkthrough-probe.yml` (Thu 06:23). Consequently **a newly-published advisory is invisible until someone opens a PR.** For an application awaiting a VA production grant — where the review may take weeks with no commits in between — that is a real, if modest, blind spot. Current exposure: **3 moderate, 0 high, 0 critical**, all transitive via `mammoth → argparse → sprintf-js`.

**Also absent:** any static analysis. No `codeql`, `semgrep`, `trivy`, `snyk`, or `actions/dependency-review-action` appears in any of the 13 workflows. The test suite and lint carry much of that load, but a SAST pass is a standard expectation in a federal security review and is cheap to add.

**Fix direction.** Add a weekly `schedule:` trigger to the audit (or a small dedicated workflow running `npm run audit:high`), and add `actions/dependency-review-action` on `pull_request` for manifest-diff visibility. Optionally add CodeQL for JavaScript/TypeScript.


---

### 3.4 LOW (P3)

| ID | Finding | Detail |
| --- | --- | --- |
| L-01 | 3 moderate transitive advisories | `mammoth → argparse → sprintf-js`. Remediation is upstream; `npm audit fix --force` would be a breaking change. Track and revisit. |
| L-02 | Disabled-button contrast | `ServiceHistoryForm.tsx:200` `text-white` on `disabled:bg-slate-300` `#cad5e2` = 1.49:1. WCAG-exempt (inactive component) but visually poor; `disabled:text-muted` on `disabled:bg-slate-200` reads better. Use `text-muted`, not `text-slate-500` — the latter is now forbidden by `tests/design-token-contrast.test.ts`. |
| L-03 | Decorative border token below 3:1 | `--border-strong` `#93c5fd` = 1.80:1 on white. Fine as a decorative callout border; add a comment in `globals.css` so nobody reuses it for an input boundary. |
| L-04 | Tooltip body at 12px | `ConditionTimelineVisualization.tsx:727` uses `text-xs text-slate-200`. Contrast is excellent (14.48:1); only the size is small, and a table fallback exists below the graphic. |
| L-05 | jsdom canvas not installed | The a11y run emits `Not implemented: HTMLCanvasElement's getContext()`. Harmless today, but canvas-rendered content is untested in jsdom. |

---

## 4. Controls verified as working — do not regress these

Recording what passes matters as much as what fails. Each item below was verified against source during this audit, not copied from documentation.

**OAuth 2.0 Authorization Code + PKCE** (`src/lib/va/account/oauth.ts`, `src/app/api/auth/{login,callback}/route.ts`) — a genuinely careful implementation:

- **S256 PKCE.** `code_challenge: digest(verifier)` with `code_challenge_method: "S256"` (oauth.ts:112). No `plain` path exists.
- **Cryptographic randomness.** `state`, `binding`, `verifier`, and `nonce` all come from `random()` (oauth.ts:98). The verifier is stored server-side; only its digest travels in the transaction record, and it never leaves the server (login/route.ts:20).
- **CSRF binding that survives login-session fixation.** The *binding* — not the state — is set as an HttpOnly cookie, so an attacker who plants a state value on a victim's browser still cannot complete the transaction. The login route documents this reasoning explicitly (login/route.ts:35-43).
- **One-use transactions.** `store.consume(key)` is atomic and the consumed payload is compared exactly against the observed record (oauth.ts:124-125); a replayed or altered callback fails closed with `AccountUnavailable`.
- **Single-valued, format-validated state.** `params.getAll("state").length !== 1` rejects parameter pollution; both `state` and `binding` pass `handleSchema.safeParse` before use (oauth.ts:119).
- **ID-token verification.** `verifyIdentity()` enforces `algorithms: ["RS256"]`, exact `issuer`, exact `audience === clientId`, and nonce match, rejecting on any mismatch (oauth.ts:83-87). Algorithm-confusion and audience-substitution attacks are closed.
- **Origin pinning.** Both routes reject unless `new URL(request.url).origin === config.appOrigin` (login/route.ts:58, callback/route.ts:60).
- **Correct cookie attributes.** Session cookie: `httpOnly`, `Secure`, `SameSite=Strict`, `maxAge: ACCOUNT_SESSION_SECONDS` (30 min). Transaction cookie: `SameSite=Lax` for the top-level round-trip, five-minute life, and cleared on **every** path including failures (callback/route.ts:74-89).
- **No error leakage.** Every outcome is a 303 redirect carrying a notice code; raw server errors never reach a response body. `/va-account` maps those codes to user-safe strings, including honest `cleanup-unconfirmed` and `revocation-unconfirmed` states that tell the user when server-side cleanup could not be verified rather than pretending it succeeded.
- **Minimal scopes.** `openid offline_access <service scope>`, one service per connection, no scope creep.
- **Tokens stay server-side.** Encrypted in an isolated session store; the browser holds only an opaque handle. `refresh` moves atomically to an unreadable refreshing state so a second reader fails rather than double-refreshing (oauth.ts:160).

**Fail-closed VA runtime selection** (`src/lib/va/runtime-state.ts`). Deliberate tri-state `disabled`/`sandbox`/`production`; production requires intent **and** the acknowledgement flag **and** both service-specific keys. `VA_ACCOUNT_LOCAL_ONLY` and `VA_ACCOUNT_DEMO_FIXTURES` are both *refused* on hosted/production runtimes, so a demo fixture cannot silently answer production calls.

**PHI logging boundary.** `node scripts/audit-phi-logging.mjs` → **254 files scanned, no violations.** `src/lib/va/api-client.ts` imports no logger and touches no console by design; error bodies are cancelled unread; success bodies are read under a byte cap and schema-validated before being typed.

**Accessibility automation as a real gate.** `.github/workflows/pr-508-compliance.yml` uses no `continue-on-error`, triggers on `pull_request` to `main`, pins `contents: read`, and fails the required check on any axe violation — vitest exits non-zero on the first failing file, so no aggregator is needed (lines 39-52). The gate names six files explicitly: `tests/accessibility-automation.test.tsx`, `tests/accessibility-form-page.test.tsx`, `tests/accessibility-ux-reliability.test.ts`, `tests/workflow-validation-accessibility.test.ts`, `src/components/__tests__/accessibility.test.tsx`, and `src/app/secondary/__tests__/page.accessibility.test.tsx`. Running that exact list locally: **6 files, 36 tests, all passing.** Note this gate lives in its own workflow, *not* in `ci.yml` — `ci.yml` contains no accessibility step at all.

**Dependency-vulnerability gating is enforced, not decorative.** `ci.yml:176` runs `npm run audit:high` (`--audit-level=high --omit=dev`). The step carries `continue-on-error: true`, which would be a loophole except that the aggregator at `ci.yml:372` re-fails the whole job when `steps.audit.outcome == "failure"`. The reasoning is written down at lines 170–175, including why the dev-tree advisory is inventoried separately at `ci.yml:187` rather than allowed to weaken the production gate. This is a considered control and should be preserved as-is; the only gap is cadence (M-05).

**Real-browser E2E already exists.** `e2e/` (repo root) drives headless Chrome over the raw WebDriver HTTP protocol via `chromedriver` — five specs: `secondary-workflow.mjs`, `validation-errors.mjs`, `coi-isolation.mjs`, `pathways-smoke.mjs`, `presumptive-workflow.mjs`. CI invokes them directly (`ci.yml:299`, `id: e2e` at line 305), gated by `steps.build.outcome == 'success'` and re-failed by the aggregator. There is **no** `npm run e2e` script in `package.json` — the specs are run as `node e2e/*.mjs`. This matters for R-05: the infrastructure for a true contrast check is already in the pipeline, so no new browser-automation stack is required. Note that `e2e/` contains **no axe reference at all** — real-browser accessibility checking is genuinely absent.

**Honest self-reporting culture.** The repository consistently records gaps as open rather than relabeling them closed: `docs/external-manual-gates-status.md` refuses to close #195 or #287 from automation; the 508 workbook pins superseded build IDs as unusable rather than letting a tester reuse them; `docs/phase3-production-access-package.md` opens with "Do not submit yet." This is the behavior a federal reviewer wants to see. Preserve it.

---

## 5. Phase 2 — Prioritized remediation plan

Ordered by *what unblocks the most*. R-01 and R-04 are independent of each other and should start in parallel immediately; everything else is either cheap or gated on human availability.

| # | Workstream | Closes | Type | Est. effort | Blocks submission? |
| --- | --- | --- | --- | --- | --- |
| **R-01** | Privacy policy: add deletion right, 45-day commitment, and a contact channel | B-02 | Code + legal review | 0.5 day | **Yes** |
| **R-02** | ~~Fix measured contrast failures via one design-token change~~ **DONE, merged** (PR #520, `4112e719`) — token exposed, 65 sites swept, contrast test added | H-01 | Code | 0.5 day | **Yes** (508 evidence depends on it) |
| **R-03** | Add scheduled dependency re-audit + dependency-review + SAST | M-05 | CI | 0.5 day | Recommended |
| **R-04** | Assign owners and tracking issues to all manual/human gates | B-01, B-03, H-02 | Project management | 1 day | **Yes** |
| **R-05** | Add real-browser contrast + keyboard coverage to the existing WebDriver E2E job | H-01, B-03 | CI | 1 day | No, but strongly recommended |
| **R-06** | Correct the scope narrative and `api-client.ts` positioning | B-04 | Docs | 0.5 day | **Yes** |
| **R-07** | ~~Bump disclaimer/notice text from 12px to 14px; reduce uppercase density~~ **DONE, merged** — 20 legal/safety notices raised to 14px, 37 uppercase labels returned to sentence-case (3 short `thead` labels preserved), `tests/legal-notice-legibility.test.ts` added | M-01, M-02 | Code | 1 day | No |
| **R-08** | Re-verify prior audit A01–A10 against current `main` | M-04 | Review | 1–2 days | Recommended |

### Sequencing

```
Week 1 (parallel tracks)
├── R-01  privacy deletion + contact     ← legal/operator sign-off needed
├── R-02  contrast token change          ← unblocks R-05
├── R-03  scheduled audit + SAST         ← independent of R-02
├── R-04  owners for #189 #195 #213 #287 + H-02 items
└── R-06  scope narrative correction

Week 2
├── R-05  real-browser contrast/keyboard in the E2E job
├── R-07  font-size and uppercase cleanup
└── R-08  re-verify A01–A10

Gated on external availability (start requesting in Week 1, may land later)
├── B-01  VA production approval + production keys
├── B-03  Section 508 manual testing + VA review
└── H-02  hosting log retention / callback scrubbing review
```

R-01, R-02, R-03, and R-06 are entirely within team control and total roughly two days of work. B-01 and B-03 are not — they depend on VA and an independent accessibility tester, which is why R-04 (getting those requests formally opened and owned) belongs in Week 1 despite being pure project management.

### 5.1 R-01 — Privacy policy deletion right and contact channel

**Change.** In `src/app/privacy/page.tsx`, extend the data-rights section (line 78) with an explicit deletion right and a 45-day commitment, and add a contact channel. Suggested structure — a new "Your rights" list item plus a contact block near the footer:

- *Request deletion.* Add a sixth right alongside review/correct/port: a Veteran may request deletion of data held in association with their account. State the **45-day** completion commitment and note the narrow legal exceptions (records VA must retain under 36 CFR 1236 and 38 U.S.C. recordkeeping obligations), with a reason given on any partial or refused deletion.
- *Contact channel.* Provide a real reachable address — the operator's privacy contact email, a mailing address, a link to VA's privacy program (`https://www.va.gov/privacy/`), and the VA 1-800 number for Veterans who prefer phone.
- *Mirror in Terms.* Add a one-line pointer in `src/app/terms/page.tsx` §7 **"Privacy and Local Evidence Handling"** (line 92) so the contact route is discoverable from both pages. Note: §1 is *"Regulatory Path Distinction"* — the wrong home for a privacy contact pointer; earlier drafts cited §1 in error.

**Validation.**
1. `npm run build`, then check the rendered output contains the new language:
   `curl -s http://localhost:3000/privacy | grep -Eo '(45 days|deletion|privacy@|va.gov/privacy)' | sort -u`
2. Confirm the page still passes the axe gate: `npx vitest run src/app/privacy`
3. Legal/operator sign-off recorded — this is a policy commitment, not just copy, so it needs a named approver and a date before it ships.
4. Confirm the deletion request route is **actually operational**, not merely promised. If no intake mechanism exists yet, either build a minimal one (form → operator queue) or state plainly in the policy that requests arrive by email or post with a human handling them. **Publishing a 45-day commitment with no way to receive a request is worse than the current omission.**

**Acceptance.** Deletion right + 45-day commitment + at least one working contact channel present in rendered HTML, approved by a named operator, with a verified intake path.

### 5.2 R-02 — Contrast token fix

**Change — simpler than first drafted.** The project *already has* a passing muted-text token: `--muted: #475569` (`globals.css:7`), which measures **7.58:1** on white, **7.24:1** on `slate-50`, **6.92:1** on `slate-100`, and **6.15:1** on `slate-200`. It clears AA on all four backgrounds in play with large headroom. The defect is that components reach around it: `text-muted` has **0 usages** in `src/**/*.tsx`, because the `@theme inline` block (`globals.css:20-25`) maps only `--color-background` and `--color-foreground`, so no `text-muted` utility is generated.

Therefore the fix is **one line plus a sweep**, not a new colour decision:

1. In `globals.css`, inside `@theme inline`, add `--color-muted: var(--muted);` alongside the existing two mappings. This generates the `text-muted` utility from a token that already passes.
2. Sweep the **65** `text-slate-500` instances to `text-muted`.
3. Do **not** globally override Tailwind's `slate-500` — it is also used for borders and non-text affordances where the lighter value is intended.

**Trade-off — DECIDED and measured.** `#475569` is one step darker than Tailwind 4.3.3's `slate-500` (`#62748e`), so muted text reads slightly heavier across the app. `#52616f` remains the verified middle option — **6.37:1** white, **6.09:1** `slate-50`, **5.81:1** `slate-100`, **5.16:1** `slate-200`, all four passing — and would be set as `--muted: #52616f` instead. **Option A (`--muted`) was implemented**, because it introduces no new design token, needs no fresh approval, and matches the value already used by `.page-hero p` and `.ui-callout` copy via `color: var(--muted)`. The hierarchy concern this trade-off raises was then retired by measurement rather than left to visual judgement: the `slate-500`→`slate-600` step being collapsed is only **1.59:1**, and `--muted` vs Tailwind 4's `slate-600` is **1.00:1** — both far below the **3:1** WCAG needs for two elements to read as distinct. The pre-fix greys were therefore never carrying perceptible hierarchy (that comes from weight, size, and uppercase casing, all untouched), and 25 of the 27 swept files also use `text-slate-600`, so the sweep makes the grey scale *more* coherent, not less. Switch to `#52616f` only if the design owner specifically wants the lighter weight back.

**Validation.**
1. Re-run the luminance calculation as a **committed test**, not an ad-hoc script — add a unit test asserting every text/background token pair used in the app meets 4.5:1 (3:1 for large text and UI borders). Parse the hex values straight out of `globals.css` so the test cannot drift from the source of truth. This makes the fix self-policing.
2. The a11y gate from §7 → still **36 passing** (6 files), plus the new contrast token test green.
3. Zero remaining `text-slate-500`:
   `grep -ro "text-slate-500" src --include='*.tsx' | wc -l` should reach **0** (currently 65), or only occur where a verified ≥4.5:1 pair is documented.
4. Confirm the utility actually generated: `grep -ro "text-muted" src --include='*.tsx' | wc -l` should equal the number of migrated call sites, and a built-page spot check should show `color: #475569` (or `#52616f`) in computed styles.
5. Visual regression check on the three densest screens — Results, Pathway Evidence, and the DD-214 local analyzer — to confirm the darker muted text did not flatten the type hierarchy.

**Acceptance.** No computed text/background pair below 4.5:1 (3:1 large/UI) anywhere in `src/`, enforced by a committed test.

### 5.3 R-03 — Scheduled dependency re-audit, dependency-review, and SAST

**Change.** Three additions. **Do not** add a basic `npm audit` gate — `ci.yml:176` already enforces `npm run audit:high`, and its aggregator step at line 372 re-fails the job on that outcome. Duplicating it would create two sources of truth.

1. **Scheduled re-audit.** Add a `schedule:` block so a newly-published advisory surfaces without a commit. Either add it to the existing job:
   ```yaml
   on:
     schedule:
       - cron: "17 6 * * 1"   # Monday 06:17 UTC, offset from the other scheduled workflows
   ```
   or, cleaner, add a small dedicated workflow running `npm run audit:high` that opens an issue on failure. Preserve the existing `continue-on-error` + aggregator pattern rather than introducing a second enforcement style.
2. **Manifest-diff visibility.** Add `actions/dependency-review-action` on `pull_request` so a reviewer sees *which* dependencies changed, not just whether the tree is clean.
3. **SAST.** Add CodeQL for JavaScript/TypeScript, or Semgrep with a TypeScript ruleset. Absent today; standard expectation in a federal security review.

**Contrast gate.** The token-pair unit test from R-02 §5.2 lands in the normal test suite and therefore runs inside the existing `verify` job automatically — no new CI wiring needed.

**Validation.**
1. Trigger the schedule manually via `workflow_dispatch` and confirm the audit step executes, and that the aggregator still fails the job on a seeded high-severity advisory.
2. Open a test PR that bumps a dependency and confirm the `dependency-review-action` comment appears.
3. Confirm the SAST job runs and reports on a PR touching `src/`.
4. Open a deliberately failing PR that introduces `slate-400` text on `slate-100` and confirm the `verify` job goes red and the PR cannot merge — this proves the R-02 contrast test is genuinely gating.
5. Confirm branch protection lists the `verify` job as **required** in GitHub settings — a red job nobody enforces is decoration.
6. Record the first green scheduled run as evidence.

**Acceptance.** A high-severity prod advisory and a contrast regression each fail a required check, demonstrated with real failing runs; advisories surface on a schedule without a commit.

### 5.4 R-04 — Owners for every manual gate

**Change.** Create or update tracking issues so each of the following has a named owner, a requested date, and an explicit completion criterion:

| Gate | Current status | Needed |
| --- | --- | --- |
| #189 Production keys | Open | Request submitted to Lighthouse; owner; expected date |
| #195 Independent 508 review | Open | Tester identified; build ID and deploy URL pinned |
| #213 VA security review | Open | Package submitted; owner tracking |
| #287 VA public-reference production transition | Open | VA grant received; authorized connectivity check scheduled |
| Hosting log retention / access controls | **Untracked** (H-02) | New issue; operator review |
| Callback-URL log scrubbing | **Untracked** (H-02) | New issue; operator review |
| Privacy-policy legal sign-off (R-01) | **Untracked** | New issue; named approver |

**Validation.** `docs/external-manual-gates-status.md` lists every gate with an owner and a date; `npm run test:doc-lint` still passes after the edit.

**Acceptance.** No gate in this report lacks an owner. Anything without one is escalated rather than left implicit.

### 5.5 R-05 — Real-browser contrast and keyboard pass

**Change.** The jsdom gap is structural: axe's `color-contrast` rule always returns "incomplete" in jsdom because there is no layout engine, which is why `tests/setup/accessibility.ts:49` adds it to `ignoredRules` with the comment *"jsdom has no layout engine; axe returns incomplete for color-contrast"*. The right fix is **not** a new Playwright install — the project already has a real-browser harness: `e2e/` at the repo root drives headless Chrome over the raw WebDriver protocol via `chromedriver`, and `ci.yml:299` already gates on it (`id: e2e`, re-failed by the aggregator).

So: extend the existing E2E harness to run axe-core in the live Chrome page with `color-contrast` **enabled**, across the key routes (`/`, `/results`, `/dd214`, `/privacy`, `/terms`, `/va-account`). Add an automated keyboard walk asserting visible focus on every interactive element. This reuses proven infrastructure, keeps one browser-automation stack, and adds real contrast evidence to a job that already blocks merges.

**Implementation constraint — read this before writing the code.** The production CSP enforces `require-trusted-types-for 'script'` (`src/components/security/TrustedTypesGate.tsx:13`), and the app's policy accepts **same-origin script URLs only**, refusing `blob:`, `data:`, and cross-origin URLs, with `createScript` and `createHTML` refused outright (lines 27–29). The existing E2E suite already works around this deliberately: `e2e/coi-isolation.mjs:228-232` loads its probe from the same-origin path `/tesseract/coi-probe.js` precisely because *"A same-origin path is required by the app's Trusted Types default policy, which refuses blob:/data: script URLs by design (see src/components/security/TrustedTypesGate.tsx) — the same constraint tesseract.js itself satisfies."*

Therefore **do not inject axe via a blob/data URL or a CDN `<script>` tag** — it will be refused by the app's own security gate, and "fixing" that by loosening Trusted Types would be a far worse trade than the missing contrast check. Two viable approaches:

1. **Preferred — serve axe as a same-origin static asset.** Copy `axe.min.js` into `public/a11y/` and inject `<script src="/a11y/axe.min.js">`, mirroring the existing `/tesseract/coi-probe.js` pattern. Exclude it from any production build shipping concern by documenting it as a test-only asset, or gate it behind the existing runtime-mode logic.
2. **Alternative — pass the axe source as the WebDriver `script` body.** `execute/sync` and `execute/async` are already used this way in `e2e/coi-isolation.mjs:208,241`. WebDriver script evaluation is not a DOM injection sink, so Trusted Types does not gate it. Read `node_modules/axe-core/axe.min.js` at spec startup and evaluate it inline. This keeps axe out of the deployed bundle entirely.

Approach 2 avoids shipping test tooling in the production artifact and is the cleaner fit for an app whose whole posture is "nothing extra reaches production."

Doing so also converts part of the `ConditionTimelineVisualization` manual-evidence burden into repeatable automation — that component's timeline is currently verified only by a human, and a real-browser pass can capture it.

**Validation.** E2E job green on `main`; a seeded contrast violation makes it red; screenshots and axe JSON retained as build artifacts and referenced in the Section 508 workbook. Confirm explicitly that the Trusted Types gate did **not** need relaxing to achieve this — a `git diff` on `TrustedTypesGate.tsx` and the CSP config should be empty.

**Acceptance.** Automated real-browser contrast evidence exists for all key routes and is reproducible from a pinned commit.

### 5.6 R-06 — Scope narrative and `api-client.ts` positioning

**Change.** Three documentation edits:

1. In `docs/phase3-production-access-package.md` §3 and the VA-API-usage narrative, restrict the requested scope to what actually shipped: **Forms API** (`va_forms`), **Benefits Reference Data** (`benefits-reference-data`, read-only), and **VA Account**. The account scopes are assembled at `src/lib/va/account/oauth.ts:111` as `` `openid offline_access ${config.scope}` ``, where `config.scope` is the *single* service scope — `disability_rating_summary.read` (`config.ts:16`) or `claim.read` (`config.ts:24`), one service per connection. **Do not write `profile`, `email`, or `benefits.claims.read` into the package** — none of those strings exists in the codebase, and earlier drafts of this report cited them in error. `oauth.ts:68` additionally hard-refuses any token carrying a `.write` scope or missing `openid`, which is worth stating in the submission as evidence of least privilege.
2. Remove or explicitly re-label the *restricted* Claims/Intake language. If retained, mark it **"future phase — not requested in this submission."** Do **not** delete the read-only `claim.read` account scope, which is genuinely wired — describe it accurately as sandbox-only pending VA production grant.
3. Add a header comment to `src/lib/va/api-client.ts` stating it is pre-built groundwork with no production caller, so a reviewer who greps for it understands its status immediately rather than inferring a broken integration.

**Validation.** `rg -n "claims|intake" docs/ src/lib/va/` returns only the account-config lines, the genuinely-wired auth-route references, and the api-client groundwork references. `npm run test:doc-lint` passes. The scope list in the package document matches `config.ts` exactly.

**Acceptance.** Every scope named in the submission maps to a real, tested, wired integration. No reviewer can find a mismatch between claimed and shipped.

### 5.7 R-07 — Font size and uppercase cleanup

> **STATUS (2026-10-11): IMPLEMENTED and MERGED.** Both halves landed.
>
> **Font size.** `src/components/Disclaimer.tsx:20` and
> `src/components/presumptive/Dd214LocalAnalyzer.tsx:379` were raised to
> `text-sm` as specified, and the sweep was then extended to every other
> element in `src/` carrying legal, privacy, safety, or verification meaning:
> **20 elements across 11 files** (`text-xs` in `src/**/*.tsx` fell 286 → 261).
> The reference component is at `src/app/components/CoverageNotice.tsx`, not the
> bare `CoverageNotice.tsx` cited below. The raw-text `<pre>` inside the DD-214
> disclosure was raised too, because its own notice instructs the user to
> "verify before sharing" and content that must be verified has to be readable.
>
> **Uppercase.** 37 instances returned to sentence-case across 13 files, with
> the compensating `tracking-wide`/`tracking-wider` removed alongside. Exactly
> **3** remain — the short single-word `thead`/header-row labels this section
> says to keep.
>
> **Regression guard.** `tests/legal-notice-legibility.test.ts` (17 tests) now
> enforces both halves analytically: no named notice may carry `text-xs`, and no
> `uppercase` may appear outside the allowlisted header rows. It runs in the
> normal suite, so it gates inside the existing `verify` job with no new CI
> wiring — the same approach §5.2 took for the contrast test. It was proven to
> fail by deliberate mutation in both directions.
>
> **Validation results.** `grep -n "text-xs" src/components/Disclaimer.tsx` → no
> matches. The 508 gate is unchanged at **6 files / 36 tests**. Full suite
> **336 files / 2843 tests** green; lint 0 errors; typecheck clean; build green;
> doc-lint green. The screen-reader spot check in the Validation paragraph below
> is a **human** step and was **not** performed — it folds into issue #195.

**Change.** Bump `src/components/Disclaimer.tsx:20` from `text-xs` to `text-sm`, matching `CoverageNotice.tsx`. Do the same for safety-critical copy — notably `Dd214LocalAnalyzer.tsx:379` ("Full SSN is never stored"). Then review the 41 `uppercase` instances: keep it for genuinely short `thead` labels where it aids scannability; remove it from multi-word eyebrow labels and anything a screen reader must parse as a sentence.

**Validation.** `rg -n "text-xs" src/components/Disclaimer.tsx` → no matches. The a11y gate from §7 still green at 36 tests (6 files). A screen-reader spot check (NVDA + Chrome, VoiceOver + Safari) on the disclaimer and one `thead` confirms labels announce as words, not letters.

**Acceptance.** Legal disclaimers and safety notices render at ≥14px; uppercase restricted to short structural labels.

### 5.8 R-08 — Re-verify prior audit A01–A10

**Change.** Walk each architectural finding in `docs/security-va-production-audit-2026-10-04.md` §3 against current `main` and record one of *closed / still open / no longer applicable*, with commit or file evidence. A10 is already confirmed resolved (no `src/lib/va/index.ts`). Prioritise A01 (reference-search text exposure), A02 (inbound rate-limit route coverage), and A05 (cache revocation on feature disable) — those three touch PHI-adjacent paths.

**Validation.** A short dated addendum in `docs/` recording per-item disposition; `npm run test:doc-lint` passes.

**Acceptance.** No A-item left in an unknown state going into submission.

---

## 6. Evidence inventory

What a Lighthouse reviewer can be handed today, and what is still missing.

| Evidence | Artifact | State |
| --- | --- | --- |
| OAuth/PKCE design and security reasoning | `src/lib/va/account/oauth.ts`, `src/app/api/auth/{login,callback}/route.ts` (inline rationale comments) | **Available** |
| Fail-closed runtime configuration | `src/lib/va/runtime-state.ts`, `src/lib/va/account/config.ts` | **Available** |
| PHI non-logging proof | `scripts/audit-phi-logging.mjs` output — 254 files, 0 violations | **Available** |
| Automated accessibility results | `pr-508-compliance.yml:43-52` — 6 named files, 36 tests passing | **Available, contrast excluded** |
| Dependency posture | `npm audit --omit=dev` — 3 moderate, 0 high/critical | **Available, and gated in CI (`ci.yml:176`)** |
| Prior security audit | `docs/security-va-production-audit-2026-10-04.md` | **Available; A-items need re-verification (R-08)** |
| Manual-gate register | `docs/external-manual-gates-status.md` (#189/#195/#213/#287) | **Available; 3 further gates untracked (R-04)** |
| Production-access package draft | `docs/phase3-production-access-package.md` | **Available; scope narrative wrong (R-06)** |
| **Section 508 manual test results** | `docs/section508-manual-review-workbook.md` | **MISSING — all rows `NOT TESTED`, no tester/date/AT/sign-off** |
| **Real-browser contrast evidence** | none | **MISSING (R-05)** |
| **VA production approval / keys** | none | **MISSING — external (B-01)** |
| **Data-deletion policy + contact route** | none | **MISSING (R-01)** |
| **Hosting log retention / callback scrubbing review** | none | **MISSING (H-02, R-04)** |

---

## 7. Re-test requirements after remediation

Any fix invalidates the evidence produced before it. After Phase 2 work lands, re-run and re-record **all** of the following against the new commit, and pin the commit SHA in every artifact:

1. `npm ci && npm run build` — clean, from the pinned revision.
2. The CI `verify` job green; locally the equivalent is `npm run lint && npm run typecheck && npm test` (there is no single `npm run verify` script — `verify` is a CI *job* name, not an npm script). The separate **Production Runtime Readiness** gate is likewise a workflow, not a script: `.github/workflows/production-runtime-readiness.yml` asserts it inline via `curl` against the live deployment (route matrix at line 157, readiness verification at line 229, health probe at line 283), triggered on `workflow_run`. There is **no** `npm run verify:runtime-readiness` — earlier drafts cited it in error. It is also narrower in scope and does not substitute for the `verify` job.
3. The accessibility gate, run exactly as CI runs it (`.github/workflows/pr-508-compliance.yml:43-52`) — green; report the file and test count (currently **6 files, 36 tests**) so a drop is visible:
   `npx vitest run tests/accessibility-automation.test.tsx tests/accessibility-form-page.test.tsx tests/accessibility-ux-reliability.test.ts tests/workflow-validation-accessibility.test.ts src/components/__tests__/accessibility.test.tsx src/app/secondary/__tests__/page.accessibility.test.tsx`
4. `npm run audit:phi-logging` — 0 violations.
5. `npm run audit:high` — 0 high/critical; record the moderate count and the disposition decision for each.
6. New contrast token-pair unit test — green, with the computed ratios printed into the CI log as evidence.
7. Real-browser axe run via the extended E2E harness (`node e2e/*.mjs`, as `ci.yml:299` invokes it) with `color-contrast` **enabled** — green across all key routes; screenshots and JSON retained.
8. `npm run test:doc-lint` — green after the privacy/terms/package document edits.
9. Section 508 manual workbook — filled in by a named tester against the **post-fix** build ID. The superseded build must be marked unusable, exactly as the existing workbook convention requires.

**Critical ordering constraint:** the manual 508 session (**#195**) must happen **after** R-02 and R-07 land. Testing contrast on the current build produces evidence that is invalidated the moment the token changes, wasting the tester's time and the queue slot. #287 (production transition) is a *separate* gate and is not closed by 508 testing.

> **STATUS (2026-10-11): precondition SATISFIED — both prerequisites have landed.**
> R-02 merged in PR #520 (`4112e719`); R-07 merged in the follow-up type-scale and
> label-casing change. The manual session may now be scheduled against current
> `main` without its evidence being invalidated by these two remediations.
> Two caveats remain: (a) item 7 above (real-browser axe with `color-contrast`
> enabled, **R-05**) is still **not implemented** — `e2e/` contains no axe
> reference — so automated real-browser contrast evidence is still absent and the
> manual contrast/reflow/forced-colours checks carry that burden alone; and (b) if
> `main` advances again before the session, re-resolve the build identity with
> `node scripts/resolve-review-build-identity.mjs` at session start, as the
> workbook requires. **Issue #195 itself remains open and human-only.**

---

## 8. Close-out criteria — what "GO" requires

The disposition flips from NO-GO to GO only when **every** line below is true:

- [ ] **B-01** — VA has granted production access and production keys are provisioned in the target environment. *(External.)*
- [ ] **B-02** — Privacy policy states a deletion right, a 45-day commitment, and at least one verified contact channel; a named operator has approved the text; a working intake path exists. *(R-01.)*
- [ ] **B-03** — Section 508 manual workbook complete with tester name, date, AT/browser matrix, and sign-off, against the post-fix build; **#195** closed with that evidence attached. *(External + R-02/R-07 first.)*
- [ ] **B-04** — Submission scope matches shipped integrations exactly; restricted Claims/Intake either removed from the request or explicitly labelled future-phase; `api-client.ts` status documented in-file. *(R-06.)*
- [ ] **H-01** — No text/background pair below 4.5:1 (3:1 large/UI) in `src/`, enforced by a committed test. *(R-02. **Committed and merged on `main`** — PR #520, merge commit `4112e719`. Verified at landing: 130 co-occurring pairs audited, 0 below threshold; `tests/design-token-contrast.test.ts` (8 tests) added and proven to gate via three deliberate mutations; 508 gate unchanged at 6 files / 36 tests; build/lint/typecheck/full suite/PHI/doc-lint all green. This box still ticks only against the final submission SHA, so it stays unchecked until §7 is re-run on that pinned commit.)*
- [ ] **H-02** — Hosting log retention/access and callback-URL scrubbing both reviewed, recorded, and issue-tracked. *(R-04 + operator.)*
- [ ] **M-05** — Scheduled dependency re-audit (CodeQL + dependency-review on a timer) added to CI. *(R-03. Note: dependency auditing itself is already enforced via `audit:high`; this line covers only the scheduled re-audit/SAST gap.)*
- [ ] All seven gates in §5.4 have a named owner and a date. *(R-04.)*
- [ ] §7 re-test suite green on a single pinned SHA, with every artifact referencing that same SHA.

M-05 is the only Medium listed above as GO-blocking, and only because it is a CI change the team fully controls. The remaining Medium and Low items (M-01…M-04, L-01…L-05) do **not** block GO, but each needs either a fix or a written, dated acceptance of the risk. Silent deferral is what turns a Medium into a finding at review time.

---

## 9. Approval

This report is an assessment only. **No code, configuration, documentation, or CI change has been applied.** The Phase 2 plan in §5 is a proposal awaiting approval.

Per the release constraint quoted at the top of this document, all remediation is scoped as local work; no commit, push, PR, deployment, or feature-flag enablement is authorized by this report.

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Auditor | *(this assessment)* | NO-GO — 4 Blockers, 3 High | 2026-10-10 |
| Engineering owner | | ☐ Approve Phase 2 as scoped ☐ Approve with changes ☐ Reject | |
| Operator / privacy approver | | ☐ Accept R-01 language ☐ Accept H-02 review ownership | |
| Accessibility owner | | ☐ Commission #195 manual session on post-fix build | |

**Recommended next action:** approve §5 and begin R-01, R-02, R-03, R-04, and R-06 in parallel. Those five are entirely within team control, total roughly three days of work, and close two Blockers plus two High findings. R-02 must land before the manual 508 session is scheduled.











