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
| Deployed `main` commit SHA | `bbe2935274e1e00b235ac69f6ef1e8ddc4b8bdab` |
| Vercel production deployment ID | `6287296680` |
| Main CI run | `34000588157` |
| Production Runtime Readiness run | `34000588157` |
| Operating system + version | |
| Browser + version | |
| Assistive technology + version | |
| Display/zoom configuration | |
| Forced-colors/high-contrast configuration | |

Before recording any pass/fail result, verify that the canonical production alias is serving the exact `main` commit named above. If `main` advances during the review, either finish against the recorded exact deployment or start a new session record; do not merge evidence from different builds without identifying them separately.

> The build identifiers above are a blank starter template for the human tester. They identify the target build only. They are not human test results, findings, retest results, or sign-off.

## Required route and workflow coverage

Record each route/workflow as it is exercised. A route being reachable is not itself an accessibility pass.

| Route / workflow | Tested | Notes / synthetic data used |
|---|---|---|
| `/` | [ ] | |
| `/about` | [ ] | |
| `/secondary` | [ ] | |
| Secondary Step 1 — diagnosed conditions | [ ] | |
| Secondary Step 2 — service-connected answers | [ ] | |
| Secondary Step 3 — ratings | [ ] | |
| Secondary Step 4 — supporting documents / evidence | [ ] | |
| Secondary Step 5 — suggestions | [ ] | |
| Secondary Step 6 — evidence/results | [ ] | |
| Priority 1/1B local evidence upload/review with synthetic PDF | [ ] | |
| Priority 1/1B local evidence upload/review with synthetic DOCX | [ ] | |
| Priority 1/1B local evidence upload/review with synthetic text | [ ] | |
| `/presumptive` | [ ] | |
| `/va-forms` | [ ] | |
| `/va-forms/finder` | [ ] | |
| `/va-reference` | [ ] | |
| `/va-reference/service-branches` | [ ] | |
| `/privacy` | [ ] | |
| `/terms` | [ ] | |

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
