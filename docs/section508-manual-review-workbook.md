# Section 508 Manual Review Workbook

## Purpose

Use this workbook to record the human accessibility evidence required by issue #195 before the project answers the VA API Platform Section 508 question or claims complete conformance.

This workbook is an evidence-recording aid, not a certification. Automated CI, browser E2E, production runtime checks, and source-level accessibility assertions are supporting evidence only and must not be copied into the manual-result columns as substitutes for human testing.

## Test-data rule

Use synthetic/sample conditions and synthetic PDF, DOCX, and text evidence only. Do **not** use a real Veteran's medical records, PII, PHI, service history, claim number, credentials, or other sensitive production data.

## Session identity

Complete this block before testing begins.

| Field | Recorded value |
|---|---|
| Tester | |
| Review date/time | |
| Production URL | `https://secondary-condition-finder.vercel.app` |
| Deployed `main` commit SHA | |
| Vercel production deployment ID | |
| Vercel commit status | |
| Main CI run | |
| Production Runtime Readiness run | |
| Operating system + version | |
| Browser + version | |
| Assistive technology + version | |
| Display/zoom configuration | |
| Forced-colors/high-contrast configuration | |

### Resolve the build identity at session start — do not reuse a committed value

The build-identity rows above are intentionally **blank**. The tester must fill them in at the moment the session begins, because `main` advances and any committed identifier goes stale. A stale identifier silently points the review at a superseded build, which issue #195 prohibits.

Run this immediately before testing and paste the resolved rows into the table:

```bash
node scripts/resolve-review-build-identity.mjs
```

The script emits the deployed `main` SHA, the Vercel production deployment id, the Vercel commit status, the main CI run, the Production Runtime Readiness run, and an HTTP reachability probe. Add `--json` for machine-readable output, or `--sha=<sha>` to resolve a specific commit instead of `origin/main`.

Before recording any pass/fail result, verify that the canonical production alias is serving the exact `main` commit you resolved. If `main` advances during the review, either finish against the recorded exact deployment or start a new session record; do not merge evidence from different builds without identifying them separately.

> **Scope limit.** The resolved identifiers are *supporting evidence only*. They establish which build was reviewed. They are not human test results, findings, retest results, or sign-off, and an HTTP 200 from the reachability probe is not an accessibility PASS. Every result cell in this workbook must come from a human tester.

### Superseded build identifiers

These values were previously pinned in this workbook as a starter template. They are retained **only** so that any earlier partial session can be attributed to the correct build. They no longer match `main` and must not be used for a new session:

| Field | Superseded value | Status |
|---|---|---|
| Deployed `main` commit SHA | `bbe2935274e1e00b235ac69f6ef1e8ddc4b8bdab` | Superseded — not current `main` |
| Deployed `main` commit SHA | `6293f002a00a614b86c508ad4fa452dcaa87317e` | Superseded — build frozen for manual review in issue #195 (main CI #807, Production Runtime Readiness #166, Vercel deployment `dpl_6GJrwnr7ToGVFHL4RUeGoFTt3YyC`, READY on the canonical alias); superseded by later `main` advances |
| Vercel production deployment ID | `6287296680` | Superseded |
| Main CI run | `34000588157` | Superseded |
| Production Runtime Readiness run | `34000588157` | Superseded — this duplicated the CI run id and was never an independent readiness identifier |

No human accessibility evidence was recorded against these builds. Every result table below remains `NOT TESTED`.

## Remediation state of the build under review

Recorded so a tester does not spend a scarce session on a build that is about to change underneath them.

`VA_Lighthouse_Readiness_Report.md` §7 imposes an ordering constraint: the manual session must happen **after** remediation tasks R-02 and R-07 land, because testing the pre-fix build produces evidence that the fix then invalidates.

| Task | What it changed | State |
|---|---|---|
| R-02 | Exposed the `--muted` design token and swept 65 off-token `text-slate-500` call sites that failed WCAG 1.4.3 on `slate-100`/`slate-200`. Guarded by `tests/design-token-contrast.test.ts`. | **Merged** — PR #520, commit `4112e719` |
| R-07 | Raised 20 legal, privacy, safety, and verification notices from 12px to 14px, plus the `.ui-kicker` eyebrow class used at 24 call sites. Removed all-caps styling from every multi-word label: components went from 41 `uppercase` occurrences to 1 (a header row whose six columns are single short words), and stylesheets from 1 `text-transform: uppercase` to 0. Guarded by `tests/legal-notice-legibility.test.ts`. | **Merged** |
| R-05 | Real-browser axe run with `color-contrast` **enabled** across the key routes. | **NOT IMPLEMENTED** — `e2e/` contains no axe reference |

**The ordering constraint is therefore satisfied.** A session run against current `main` will not be invalidated by R-02 or R-07. If `main` advances again before the session, re-resolve the build identity at session start as described above.

**Known limitation the tester must not assume away.** Because R-05 is absent there is still **no automated real-browser contrast evidence**. jsdom computes no layout, so axe's `color-contrast` rule is disabled in `tests/setup/accessibility.ts` and can only report "incomplete". The manual contrast, 200%-zoom/reflow, and forced-colours checks in this workbook are consequently the *only* contrast evidence the project holds. They cannot be skipped, and they cannot be inferred from a green automated suite.

This section records remediation state only. It is **not** a test result, it is not sign-off, and it does not close issue #195.

## Required route and workflow coverage

Record each route/workflow as it is exercised. A route being reachable is not itself an accessibility pass.

The route list below is the complete set of routes the application ships (`src/app/**/page.tsx`, 26 routes at the time of writing), each confirmed to return HTTP 200 on the canonical production alias. Every shipped route must either be exercised or be recorded in the exclusion table below with a reason. The automated suites are **not** a substitute for this coverage: they reference 18 of these route paths, but only three full page components — `/secondary`, `/pathways`, `/presumptive` — are actually mounted in jsdom, alongside one component-level suite, and the rest of the route inventory comes from Node-based source scans and server-render assertions. jsdom computes no layout, so none of that evidence says anything about zoom, reflow, contrast, or forced colours.

| Route / workflow | Tested | Notes / synthetic data used |
|---|---|---|
| `/` | [ ] | |
| `/about` | [ ] | |
| `/secondary` | [ ] | |
| Secondary Step 1 — diagnosed conditions (`/secondary/diagnosed`) | [ ] | |
| Secondary Step 2 — service-connected answers (`/secondary/service-connected`) | [ ] | |
| Secondary Step 3 — ratings (`/secondary/ratings`) | [ ] | |
| Secondary Step 4 — supporting documents / evidence (`/secondary/upload`) | [ ] | |
| Secondary Step 5 — suggestions (`/secondary/suggestions`) | [ ] | |
| Secondary Step 6 — evidence/results (`/secondary/evidence`) | [ ] | |
| `/secondary/condition-caused-by` — direct-causation theory intake | [ ] | |
| `/secondary/condition-aggravation` — aggravation theory intake | [ ] | |
| `/secondary/legal` — 38 CFR § 3.310 authority reference | [ ] | |
| Priority 1/1B local evidence upload/review with synthetic PDF | [ ] | |
| Priority 1/1B local evidence upload/review with synthetic DOCX | [ ] | |
| Priority 1/1B local evidence upload/review with synthetic text | [ ] | |
| `/presumptive` | [ ] | |
| `/presumptive/results` — results view after a presumptive lookup | [ ] | |
| `/presumptive` — DD-214 upload + browser-local OCR (image) | [ ] | |
| `/presumptive` — DD-214 upload + browser-local OCR (scanned/mixed PDF) | [ ] | |
| `/presumptive` — DD-214 extracted-field verification and confirm controls | [ ] | |
| `/presumptive` — masked-SSN block: Show/Hide control and redaction-limit notice | [ ] | |
| `/presumptive` — "Show extracted text" disclosure and scrollable raw-text region | [ ] | |
| `/pathways` | [ ] | |
| `/va-account` — sandbox read-only account (disabled state and consent copy) | [ ] | |
| Workflow completion controls (confirm, clear, download, finish/restart) | [ ] | |
| `/va-forms` | [ ] | |
| `/va-forms/finder` | [ ] | |
| `/va-reference` | [ ] | |
| `/va-reference` — filter privacy notice and filtered-result count announcement | [ ] | |
| `/va-reference/service-branches` | [ ] | |
| `/get-records` — how to obtain VA medical records | [ ] | |
| `/scenarios` — demo-scenario launcher and synthetic-data notice | [ ] | |
| `/privacy` | [ ] | |
| `/terms` | [ ] | |
| `/runtime-readiness` — operational readiness status page | [ ] | |
| Global footer legal disclaimer on every route that renders it | [ ] | |

### Routes excluded from manual review

Record an exclusion only when the route genuinely presents no reviewable surface. An unlisted route is an unreviewed route.

| Route | Reason for exclusion |
|---|---|
| `/results` | Redirect shim only. Returns HTTP 307 to `/secondary` and renders no content of its own, so there is nothing to test. Confirm the redirect lands on an accessible page; do not record it as a reviewed route. |

### Keeping this matrix current

When a route is added to or removed from `src/app`, update this matrix in the same change. A route that ships without appearing here will be silently missed by the manual review, and issue #195 requires evidence for **every** required manual item on the identified production build.

## Result vocabulary

Use only these result values in the evidence tables:

- **PASS** — the tester completed the stated check on the recorded build and observed no failure.
- **FAIL** — the tester observed a material accessibility problem; record a remediation issue/PR.
- **N/A** — the check is not applicable to the tested surface; explain why.
- **BLOCKED** — the test could not be completed because the required environment/tool was unavailable or the product state could not be reached; explain the blocker.
- **NOT TESTED** — default state before human execution.

Do not infer PASS from automated tests.

## Keyboard-only evidence

| Check | Result | Route / step | Evidence notes | Remediation issue/PR | Retest result |
|---|---|---|---|---|---|
| Skip-to-main link appears on keyboard focus and moves focus to the application content | NOT TESTED | | | | |
| Tab / Shift+Tab order is logical | NOT TESTED | | | | |
| Focus indicator is clearly visible on every actionable element | NOT TESTED | | | | |
| No keyboard traps occur | NOT TESTED | | | | |
| Buttons, links, form controls, file inputs, and disclosures operate without a pointer | NOT TESTED | | | | |
| Focus placement after navigation is reasonable | NOT TESTED | | | | |
| Focus placement after validation transitions is reasonable | NOT TESTED | | | | |

## Forms, validation, and status evidence

| Check | Result | Route / step | Evidence notes | Remediation issue/PR | Retest result |
|---|---|---|---|---|---|
| Every input/control has an accurate accessible name | NOT TESTED | | | | |
| Required state and instructions are understandable without color/placement alone | NOT TESTED | | | | |
| Validation errors are programmatically associated with the affected control | NOT TESTED | | | | |
| Error/status changes are announced appropriately by assistive technology | NOT TESTED | | | | |
| Incomplete Secondary answers retain understandable context after validation | NOT TESTED | | | | |
| Local evidence extraction success/warning/error states are understandable without color/placement alone | NOT TESTED | | | | |
| VA reference source/environment/cache/fallback status is understandable | NOT TESTED | | | | |

## Screen-reader evidence

Record at least the required desktop coverage from issue #195. Keep NVDA and VoiceOver observations separate when both are run.

| Check | NVDA + current Chrome/Edge | VoiceOver + current Safari | Evidence notes | Remediation issue/PR | Retest result |
|---|---|---|---|---|---|
| Page titles and top-level heading context are understandable | NOT TESTED | NOT TESTED | | | |
| Landmarks and navigation regions are understandable | NOT TESTED | NOT TESTED | | | |
| Form controls announce label, state, and required/error information | NOT TESTED | NOT TESTED | | | |
| Dynamic validation/error/status content is announced appropriately | NOT TESTED | NOT TESTED | | | |
| Evidence excerpts, source names, provenance, extraction warnings, and nexus/support labels have understandable reading order | NOT TESTED | NOT TESTED | | | |
| VA reference filtered-result count and source/fallback status are understandable | NOT TESTED | NOT TESTED | | | |
| No essential meaning is conveyed only visually | NOT TESTED | NOT TESTED | | | |

If iOS Safari + VoiceOver is exercised, record the device/iOS version and observations in the notes or an appended table; do not imply it was tested if it was not.

## Zoom, reflow, contrast, and display-mode evidence

| Check | Result | Route / step | Evidence notes | Remediation issue/PR | Retest result |
|---|---|---|---|---|---|
| Browser zoom at 200% retains readable content and operable controls | NOT TESTED | | | | |
| No essential content is clipped/overlapped or requires unexpected two-dimensional scrolling | NOT TESTED | | | | |
| Long condition names wrap without losing essential content | NOT TESTED | | | | |
| Evidence excerpts, source labels, citations, and form controls wrap correctly | NOT TESTED | | | | |
| Text contrast is manually checked where automated evidence is insufficient | NOT TESTED | | | | |
| Essential UI component/focus/state contrast is manually checked | NOT TESTED | | | | |
| Windows forced-colors/high-contrast mode retains focus, controls, selected states, status, and essential meaning | NOT TESTED | | | | |
| Information is not conveyed by color alone | NOT TESTED | | | | |

## Finding log

Create one row per distinct material finding.

| Finding ID | Severity / user impact | Route / step | Environment | Description | Reproduction steps | Remediation issue/PR | Retest build | Retest result |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

Screenshots or recordings may be referenced only when they contain synthetic/non-sensitive data.

## Session conclusion

Do not complete this section until all required checks have human evidence.

| Question | Recorded answer |
|---|---|
| Were all required issue #195 manual checks completed? | NO — pending human review |
| Were all material FAIL findings remediated and retested? | NOT YET DETERMINED |
| Are any BLOCKED items still material to the VA submission path? | NOT YET DETERMINED |
| Is the evidence sufficient to support a Section 508 conformance answer? | NOT YET DETERMINED |
| Reviewer/tester sign-off | |
| Evidence-review date | |

## Exit procedure

Issue #195 must remain open until:

1. every required manual item has recorded human evidence on an identified production build;
2. every material finding has a remediation issue/PR and a recorded retest;
3. `docs/accessibility-audit.md` is updated with the completed review date, tester/environment evidence, known limitations, and supportable final status;
4. `docs/phase3-submission-checklist.md` is updated from objective evidence; and
5. the final Section 508 answer is based on the completed record rather than automated-test success or project intent.
