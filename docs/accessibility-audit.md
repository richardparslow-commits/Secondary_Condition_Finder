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

Both run in the normal suite and therefore gate inside the existing CI `verify` job with no additional wiring. Neither observes a rendered pixel — they are source-level contracts, not measurements, and they are **not** real-browser contrast evidence (remediation task **R-05**, still not implemented).

These assertions are regression evidence only. They do not test every applicable accessibility requirement and do not replace human browser/assistive-technology testing.

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
| Design-token contrast ratios | Analytical source scan (`tests/design-token-contrast.test.ts`, R-02) | Verified structurally | Positive evidence for token pairs only; **not** a substitute for real-browser contrast (R-05 still missing) |
| Keyboard-only traversal and focus order | Human deployed-app test | **Pending** | Blocking manual evidence |
| Keyboard traps / disclosure/file-input behavior | Human deployed-app test | **Pending** | Blocking manual evidence |
| Screen-reader announcements and reading order | NVDA and VoiceOver human test | **Pending** | Blocking manual evidence |
| Error identification and instructions | Human deployed workflow test | **Pending** | Blocking manual evidence |
| Zoom/reflow at 200% | Human browser test | **Pending** | Blocking manual evidence |
| Color contrast across rendered states | Contrast tooling/manual review | **Pending** | Blocking manual evidence |
| Windows high-contrast / forced-colors behavior | Human OS/browser test | **Pending** | Blocking manual evidence |
| Complete Section 508 / WCAG 2.0 A+AA conformance determination | Evidence review | **Pending** | Do not answer “Yes” until supportable |

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
