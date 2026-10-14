# Accessibility / Section 508 Evidence Report

## Purpose

This document records what the repository currently proves about accessibility and what still requires manual verification before answering the VA API Platform production-access question, **“Is your application and website Section 508 compliant?”**

It is an evidence report, not a certification.

The executable human evidence record is `docs/section508-manual-review-workbook.md`, tracked by issue #195.

## Applicable baseline

The project uses the Revised Section 508 web-content baseline as the production-review reference point. Current Section508.gov guidance states that the Revised Section 508 Standards incorporate WCAG 2.0 Level A and AA success criteria and conformance requirements for web content.

The product may pursue newer WCAG guidance as an additional quality target, but the repository must not claim Section 508 conformance solely because individual automated checks pass.

## Current status

**Status: PARTIAL EVIDENCE — MANUAL CONFORMANCE REVIEW PENDING**

The current automated suite proves structural, content, keyboard-entry, focus-style, reflow-safeguard, forced-colors, reduced-motion, validation, mobile-workflow, and selected live-status announcement contracts. It still does **not** prove complete Section 508 or WCAG conformance. Until the human checks in issue #195 and the manual-review workbook are completed and recorded, the production-access package must not represent the application as verified Section 508 compliant.

### Production target rule

Manual review is performed against the canonical Vercel production application at `https://secondary-condition-finder.vercel.app`.

At the start of every manual review session, record in `docs/section508-manual-review-workbook.md`:

- exact deployed `main` commit;
- Vercel production deployment identifier;
- successful `main` CI run;
- successful Production Runtime Readiness run;
- tester, date/time, OS, browser/version, assistive technology/version, zoom/display configuration, and forced-colors/high-contrast configuration.

Do not assume a historical checkpoint is still current. If `main` advances during the review, either finish against the already recorded exact deployment or begin a separate session record for the newer build.

The current repository/hosting lineage has objective Vercel production and runtime-readiness automation. Those checks establish reachability and exact-commit deployment lineage only; they are **not** accessibility evidence.

## Automated and browser evidence currently enforced

`tests/accessibility-ux-reliability.test.ts` verifies selected primary routes and global application contracts for:

- exactly one `<main>` landmark on tested primary routes;
- a top-level `<h1>` and basic heading-order sanity on tested primary routes;
- discoverability of public privacy and terms routes;
- explicit non-diagnostic and privacy-scope language;
- the public `/about` route's main landmark, heading structure, audience/scope language, and legal-route navigation;
- a keyboard-visible **Skip to main content** link targeting the application content container;
- a global `:focus-visible` indicator contract;
- wrapping/min-width safeguards intended to reduce clipping and horizontal-overflow risk at narrow widths and browser zoom;
- a dedicated `forced-colors: active` ruleset that preserves borders/focus/control affordances rather than relying on the normal palette alone;
- a reduced-motion ruleset for users who request reduced motion;
- a polite atomic live-status contract for the browser-local `/va-reference` filter count;
- polite atomic live-status contracts for local evidence extraction notices and excerpt-summary changes;
- safeguards that keep the manual Section 508 result pending until human evidence exists.

The real-browser CI journey additionally exercises the six-step Secondary workflow at a phone-sized viewport, horizontal-overflow checks, app-owned validation transitions, and partial-answer preservation. Other route-specific tests cover selected form-label, source-label, privacy, evidence-processing, and workflow behaviors.

Two further suites guard properties jsdom cannot compute, by scanning source analytically instead of rendering:

- `tests/design-token-contrast.test.ts` (8 tests) reads the real hex values out of `src/app/globals.css`, asserts the WCAG relative-luminance ratio for every text/background pair the application can produce, and scans `src/` so the off-token `text-slate-500` class that caused finding H-01 cannot be reintroduced. This is remediation task **R-02**.
- `tests/legal-notice-legibility.test.ts` (20 tests) enforces remediation task **R-07**: no legal, privacy, safety, or verification notice may render at 12px; `uppercase` may appear only on the one allowlisted table-header row whose columns are single short words; no stylesheet may declare `text-transform: uppercase`; and the `.ui-kicker` eyebrow class must stay at ≥ 14px with no wide letter-spacing. It scans components **and** stylesheets, because a CSS class reaches the rendered page exactly as a Tailwind utility does.

Both run in the normal suite and therefore gate inside the existing CI `verify` job with no additional wiring. Neither observes a rendered pixel — they are source-level contracts, not measurements. The rendered pixel **is** now measured by remediation task **R-05** (`e2e/a11y-contrast.mjs`, implemented 2026-10-11): a separate real-browser spec runs axe's `color-contrast` rule **enabled** in live headless Chrome across 22 shipped routes, plus a Tab-walk that asserts visible focus on every focused element. It gates in the same CI job (`a11y_contrast` step, re-failed by the aggregator) and uploads per-route axe reports as artifacts. The gate was proven by seeding a sub-AA token (fails) and restoring it (passes).

These assertions are regression evidence only. They do not test every applicable accessibility requirement and do not replace human browser/assistive-technology testing.

## R-09 — the runbook's remaining findings (2026-10-14)

The Lighthouse remediation runbook's remaining task after R-01…R-08 is its "remaining findings" list (`M-03`, `L-02`–`L-05`). Each item below is either fixed and held by a committed guard, or recorded as an explicit, dated residual — silent deferral is what turns a Low finding into a review objection. Everything here is repository-side evidence: no human accessibility review is claimed, and issue #195 is unchanged by it.

| Item | Disposition (2026-10-14) | Held by |
|---|---|---|
| M-03 | Fixed — privacy §6 now carries one idea per sentence | `tests/privacy-policy-readability.test.ts` |
| L-02 | Fixed — a disabled control both looks disabled and measures 6.15:1 | `src/app/globals.css`, `tests/design-token-contrast.test.ts` |
| L-03 | Fixed — the decorative border token carries its warning and a closed usage inventory | `src/app/globals.css`, `tests/design-token-contrast.test.ts` |
| L-04 | Fixed — the timeline tooltip renders at 14px | `tests/canvas-rendered-surface.test.ts` |
| L-05 | Residual, recorded — canvas content has no automated pixel evidence | `tests/canvas-rendered-surface.test.ts` and this section |

### M-03 — §6 of the privacy policy reads one idea at a time

The audit measured a single **163-word** sentence in §6 ("VA API and claim-submission boundary"). That sentence was split during the R-01 privacy work, but later additions to the same section reintroduced a **73-word** and a **39-word** sentence, so the finding's subject had regressed. Both are now split, with no technical claim changed — only sentence structure. The target is stated in the guard as **no sentence in §6 above 35 words**, and the guard prints its measurement into the test log (currently **34 sentences, longest 32 words**).

§8's clauses are deliberately excluded. They are the operator/legal sentences pinned *verbatim* in `tests/privacy-rights-contact.test.ts` as the text an approver is asked to accept, and two of them run 63 and 45 words; shortening approved legal text is a re-approval, not a readability fix. The guard asserts that exemption is a real pin rather than a hole someone widened. No reading-grade figure is claimed, because the audit declined to assert one it had not reliably measured.

### L-02 — a disabled control has to look disabled, not only be dark enough

The audit recorded this as `text-white` on `disabled:bg-slate-300` = **1.49:1**, measured from the class list. Measured in headless Chrome against the shipped stylesheet, that pair is not what the page renders. The legacy palette normalization in `src/app/globals.css` matches `button[class*="bg-slate-9"]` and forces `background: var(--primary)`, `color: #fff` and the border with `!important`, so the component's `disabled:bg-slate-300` never applied. The disabled submit on `/presumptive` computed to `rgb(29, 78, 216)` on `#fff` — byte-identical to the enabled control, at `opacity: 1`. The defect the user could actually experience was therefore that **a disabled control had no visual affordance at all**.

The disabled state is now declared where it wins on specificity: `--muted` on slate-200, **6.15:1**, and no opacity, because translucency would lower exactly the contrast the rule exists to keep. The dead `disabled:bg-*` utility is gone from the component, so the source stops reading as though the state were styled there. The guard checks both directions and refuses if the normalization rule disappears — at which point the state can legitimately move back into the component.

### L-03 — the decorative border token cannot become a control boundary

`--border-strong` (`#93c5fd`) measures **1.80:1** on white: correct for the callout and footer-note edges it is used on, and a SC 1.4.11 (3:1) failure the moment it is reused as a form-field or control boundary. The definition now carries the warning the audit asked for, and the guard verifies more than the presence of a comment: the warning's quoted ratio is compared against the token's real value so it cannot drift, the token's usages are a closed inventory (its definition plus `.ui-callout` / `[role="note"]` and `.ui-footer-note`, all in the stylesheet, so no component can reach for it), and each usage is checked not to sit on a control boundary while the shared input rule keeps the compliant `--border`. A comment on its own would rot; these numbers are recomputed on every run.

### L-04 — the timeline tooltip renders at 14px

`ConditionTimelineVisualization`'s tooltip — the one place two drawn values can be read together — shipped at 12px. It is now 14px. Its contrast was never the problem and is unchanged: measured against the surface it actually paints (`bg-slate-900` resolves to `#0f172b` in this stylesheet), `text-white` is **17.83:1** and the body's `text-slate-200` is **14.46:1**. The year table below the graphic remains the DOM alternative for the same data. This is a usability fix and is not described as a WCAG violation: WCAG 2.1 AA sets no minimum font size, and the audit explicitly declined to call it one.

### L-05 — Canvas-rendered surfaces (L-05): a recorded residual

jsdom has no rasterizer, so the accessibility run emits `Not implemented: HTMLCanvasElement's getContext()` and canvas content has no automated pixel evidence. Three surfaces use a bitmap canvas; they are now a closed, classified inventory in `tests/canvas-rendered-surface.test.ts`:

| Surface | Classification | What covers it |
|---|---|---|
| `src/components/evidence/LocalEvidenceAnalyzer.tsx` | decode-only — pdf.js page raster before local OCR | the mounted extraction suites drive the real path with a stubbed 2D context; the raster is an input, never an output |
| `src/components/presumptive/Dd214LocalAnalyzer.tsx` | decode-only — image downscale before local OCR | the mounted DD-214 decode suite asserts the bounded canvas handed to the worker |
| `src/components/secondary/ConditionTimelineVisualization.tsx` | drawn content, plus a user-initiated PNG export | the `<details>`-wrapped year table carries the same data as DOM text, and the mounted axe suite renders the component |

**Residual, not waived:** no automated check in this repository inspects rasterized pixels, so a defect that changed only the drawing would still pass CI. The drawn surface's meaning stays reachable without the bitmap (the table fallback) and its raster export is user-initiated, which is why this is recorded rather than engineered around: installing a native `canvas` package would put a rasterizer into a node-environment suite for evidence that still could not certify what the graphic looks like. Verifying the drawing itself belongs to the human review in `docs/section508-manual-review-workbook.md` (#195), with the other manual items. The jsdom `Not implemented` line is expected under this disposition and is not a failure.

## Required manual route and workflow scope

Issue #195 and the workbook require at minimum every route the application ships. `docs/section508-manual-review-workbook.md` holds the authoritative, complete matrix; this list is the summary:

- `/`;
- `/about`;
- `/secondary`;
- Secondary Steps 1–6: diagnosed conditions (`/secondary/diagnosed`), service-connected answers (`/secondary/service-connected`), ratings (`/secondary/ratings`), supporting documents/evidence (`/secondary/upload`, `/secondary/evidence`), suggestions (`/secondary/suggestions`), and evidence/results;
- the theory-specific intake routes `/secondary/condition-caused-by`, `/secondary/condition-aggravation`, and the `/secondary/legal` authority reference;
- Priority 1/1B local evidence upload/review using synthetic PDF, DOCX, and text documents;
- `/presumptive` and `/presumptive/results`, including DD-214 browser-local OCR, extracted-field verification, the masked-SSN block, and the extracted-text disclosure;
- `/pathways`;
- `/va-account` (disabled sandbox state and consent copy);
- `/va-forms`;
- `/va-forms/finder`;
- `/va-reference`;
- `/va-reference/service-branches`;
- `/get-records`;
- `/scenarios`;
- `/privacy`;
- `/terms`;
- `/runtime-readiness`.

`/results` is excluded: it is an HTTP 307 redirect shim to `/secondary` and renders no content of its own. The exclusion is recorded in the workbook rather than left implicit, so an unlisted route is never mistaken for a reviewed one.

A route returning HTTP 200 is only reachability evidence. It does not establish an accessibility pass.

## Evidence matrix

| Area | Evidence method | Current status | Submission interpretation |
|---|---|---|---|
| Main landmark / top-level headings on tested routes | Automated Vitest server-render assertions | Verified for tested routes | Positive evidence, limited scope |
| Heading-order sanity on tested routes | Automated Vitest assertion | Verified for tested routes | Positive evidence, limited scope |
| Privacy / terms discoverability | Automated Vitest assertion | Verified on home/about paths under test | Positive evidence, limited scope |
| Keyboard bypass mechanism | Root-layout + CSS regression contract | Verified structurally | Must still be manually operated on deployed app |
| Visible focus styling | Global CSS regression contract | Verified structurally | Must still be visually reviewed across rendered controls |
| Reflow/overflow safeguards | Global CSS + phone-sized browser regression contracts | Verified structurally/browser-automated | 200% zoom and human visual review still pending |
| Forced-colors support | Global CSS regression contract | Verified structurally | Windows forced-colors/high-contrast still requires deployed OS/browser testing |
| Reduced-motion support | Global CSS regression contract | Verified structurally | Positive evidence, limited scope |
| Selected dynamic status announcements | Source-level regression contracts for VA reference filtering and local evidence status surfaces | Verified structurally | Must still be confirmed with screen reader on deployed app |
| Accessible validation transitions | Real-browser/source regression coverage | Partial positive evidence | Must still be confirmed with keyboard and assistive technology |
| Accessible names / labels for interactive workflow controls | Route/component regression tests where implemented | Partial | Must be reviewed across deployed flows |
| Legal/safety notice text size (≥14px) and label casing | Analytical source scan (`tests/legal-notice-legibility.test.ts`, R-07) | Verified structurally | Positive low-vision evidence; rendered size at 200% zoom still needs human review |
| Design-token contrast ratios | Analytical source scan (`tests/design-token-contrast.test.ts`, R-02) | Verified structurally | Positive evidence for token pairs only |
| **Real-browser color contrast** | Axe `color-contrast` (enabled) in live headless Chrome over 22 shipped routes, in CI (`e2e/a11y-contrast.mjs`, R-05, 2026-10-11) | **Verified (automated)** | Positive evidence on the dev-rendered build per CI run; specific *rendered states behind user input* on the deployed app still benefit from the manual workbook pass |
| **Keyboard focus visibility (automated walk)** | Tab-walk asserting visible client rects on every focused element (same spec, R-05) | **Verified (automated)** | Focus *order* and trap behavior remain manual; see rows below |
| Keyboard-only traversal and focus order | Human deployed-app test | **Pending** | Blocking manual evidence |
| Keyboard traps / disclosure/file-input behavior | Human deployed-app test | **Pending** | Blocking manual evidence |
| Screen-reader announcements and reading order | NVDA and VoiceOver human test | **Pending** | Blocking manual evidence |
| Error identification and instructions | Human deployed workflow test | **Pending** | Blocking manual evidence |
| Zoom/reflow at 200% | Human browser test | **Pending** | Blocking manual evidence |
| Color contrast across rendered states | Automated real-browser axe pass (R-05) + manual review of input-dependent states | Automated base verified; rendered-state edge cases pending | Automated pass covers static render of 22 routes; the workbook's manual check adds states that only appear during user interaction |
| Windows high-contrast / forced-colors behavior | Human OS/browser test | **Pending** | Blocking manual evidence |
| Complete Section 508 / WCAG 2.0 A+AA conformance determination | Evidence review | **Pending** | Do not answer “Yes” until supportable |
| Disabled-control affordance and its text contrast | Analytical source scan plus a real-browser computed-style measurement (`tests/design-token-contrast.test.ts`, R-09/L-02) | Verified structurally and measured | Positive evidence for this control; other disabled states remain a manual review item |
| Decorative border token kept off control boundaries | Analytical source scan with a closed usage inventory (`tests/design-token-contrast.test.ts`, R-09/L-03) | Verified structurally | Positive evidence, limited to the token and the surfaces it is used on |
| Timeline tooltip text size and contrast | Analytical scan plus the painted surface measured from the stylesheet (`tests/canvas-rendered-surface.test.ts`, R-09/L-04) | Verified structurally | Positive evidence for two text pairs on one surface |
| Canvas-rendered content (the drawing itself) | No automated pixel evidence; the DOM alternative is asserted instead (`tests/canvas-rendered-surface.test.ts`, R-09/L-05) | **Residual — manual** | The graphic's data is reachable as text; what it looks like is unverified by automation |

## Manual deployed-app protocol

Run against the exact production build recorded in `docs/section508-manual-review-workbook.md`.

### Keyboard-only

1. Use only Tab, Shift+Tab, Enter, Space, and arrow keys where applicable.
2. Confirm the **Skip to main content** link appears on keyboard focus and moves focus past repeated/global content to the application content container.
3. Confirm focus order follows the visual/logical reading order across the required route/workflow matrix.
4. Confirm every interactive control has a visible focus indicator.
5. Confirm no keyboard trap occurs.
6. Confirm buttons, links, form controls, file inputs, and disclosures work without a pointer.
7. Confirm validation errors can be reached and understood without a pointer device.
8. Confirm focus placement after navigation and validation transitions is reasonable.

### Forms, validation, and status

1. Confirm every input/control has an accurate accessible name.
2. Confirm required state and instructions are understandable without relying only on color or visual placement.
3. Confirm validation errors are programmatically associated with the affected control.
4. Confirm error/status changes are announced appropriately by assistive technology.
5. Confirm incomplete Secondary answers retain understandable context after validation.
6. Confirm local evidence extraction success/warning/error states are understandable without relying only on color or placement.
7. Confirm VA reference source/environment/cache/fallback information is understandable and clearly separate from medical/evidence scoring.

### Screen reader

Issue #195 requires recorded desktop evidence with NVDA + current Chrome or Edge on Windows and VoiceOver + current Safari on macOS; iOS Safari may be added where practical.

1. Confirm page title/top-level heading context is understandable.
2. Confirm landmarks and navigation regions are announced sensibly.
3. Confirm form controls announce their labels, state, and required/error information.
4. Confirm dynamic validation/result/source status is understandable in reading order.
5. Confirm evidence excerpts, source names, page/paragraph provenance, extraction warnings, and nexus/supporting labels have an understandable reading order.
6. Confirm `/va-reference` filtering and source/fallback status are understandable.
7. Confirm no essential meaning is conveyed only visually.

### Zoom, reflow, contrast, and display modes

1. Test browser zoom at 200% on the required routes/workflows.
2. Confirm no essential content is clipped, overlaps, or requires unexpected two-dimensional scrolling where reflow is expected.
3. Review long condition names, evidence excerpts, source labels, citations, and form controls for wrapping/clipping.
4. Manually review text, controls, focus indicators, alerts, badges, and error states where automated contrast evidence is insufficient.
5. Test Windows forced-colors/high-contrast mode and verify controls, focus, selected states, status, and essential boundaries remain distinguishable.
6. Confirm information is not conveyed by color alone.

## Recording manual evidence

Use `docs/section508-manual-review-workbook.md` as the canonical human evidence record. For each finding record only non-sensitive evidence:

- tester;
- date/time;
- deployed commit SHA;
- Vercel production deployment identifier;
- browser and version;
- operating system;
- assistive technology and version, if used;
- route/workflow step;
- PASS / FAIL / N/A / BLOCKED / NOT TESTED;
- remediation issue/PR for material findings;
- exact retest build and retest result.

Do not infer PASS from automated tests. Screenshots or recordings must contain synthetic/non-sensitive data only.

## Privacy statement for accessibility testing

Accessibility testing does not change the application's data-handling model. Testers must use synthetic/sample data.

Current implemented privacy boundaries include:

- health/disability workflow selections and presumptive service-history state are kept out of page URLs;
- workflow state uses versioned, schema-bounded, tab-scoped browser records; retired cookies are tombstoned if a stale copy is presented;
- optional evidence ingestion is browser-local and raw selected document bytes/text are not intentionally sent to application server state;
- the current application has no per-user workflow/recommendation event-history database; it does emit allowlisted operational workflow/recommendation events to platform logs, and those are event logging;
- client error boundaries emit only fixed content-free events; exception text/digests are withheld from those sinks;
- LangSmith recommendation failures are replaced with a fixed message before SDK trace recording; deployed tracing configuration remains an operator verification item;
- VA adapter observations omit credentials, query values, response bodies, and workflow selections;
- VA public-reference response bodies are not intentionally persisted;
- public disability filtering is browser-local after the reference list is loaded.

Do not use real medical records, PII, PHI, claim data, service history, or credentials during accessibility review.

## Gate rule

The Phase 3 submission checklist remains blocked on accessibility until:

1. every required issue #195 manual item has human evidence on an identified production build;
2. material accessibility defects affecting the VA review path are remediated and retested or explicitly documented as unresolved;
3. the completed workbook is reviewed;
4. this evidence report is updated with the review date, tester/environment evidence, known limitations, and supportable final status;
5. the Phase 3 submission checklist is updated from objective evidence; and
6. the yes/no Section 508 answer is supported by the completed record rather than project intent or automated-test success.
