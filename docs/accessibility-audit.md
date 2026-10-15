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
- safeguards that keep the manual Section 508 result pending until human evidence exists;
- since 2026-10-15, the WCAG 1.4.1 contract that a link inside a block of text is underlined at rest (in `src/app/globals.css`, including under forced colours) while button-styled links keep their `text-decoration: none` opt-out; and
- since 2026-10-15, the landmark contract that the four layout cross-link strips are labelled `<nav>` landmarks, the six workflow-progress strips are named `role="group"` containers rather than unlabelled `div`s, and every two-column step's `aside` landmarks carry distinguishing names.

The real-browser CI journey additionally exercises the six-step Secondary workflow at a phone-sized viewport, horizontal-overflow checks, app-owned validation transitions, and partial-answer preservation. Other route-specific tests cover selected form-label, source-label, privacy, evidence-processing, and workflow behaviors.

Two further suites guard properties jsdom cannot compute, by scanning source analytically instead of rendering:

- `tests/design-token-contrast.test.ts` (16 tests) reads the real hex values out of `src/app/globals.css`, asserts the WCAG relative-luminance ratio for every text/background pair the application can produce, and scans `src/` so the off-token `text-slate-500` class that caused finding H-01 cannot be reintroduced. This is remediation task **R-02**.
- `tests/legal-notice-legibility.test.ts` (20 tests) enforces remediation task **R-07**: no legal, privacy, safety, or verification notice may render at 12px; `uppercase` may appear only on the one allowlisted table-header row whose columns are single short words; no stylesheet may declare `text-transform: uppercase`; and the `.ui-kicker` eyebrow class must stay at ≥ 14px with no wide letter-spacing. It scans components **and** stylesheets, because a CSS class reaches the rendered page exactly as a Tailwind utility does.

Both run in the normal suite and therefore gate inside the existing CI `verify` job with no additional wiring. Neither observes a rendered pixel — they are source-level contracts, not measurements. The rendered pixel **is** now measured by remediation task **R-05** (`e2e/a11y-contrast.mjs`, implemented 2026-10-11): a separate real-browser spec runs the rendering-dependent axe rules — `color-contrast` **enabled**, plus `link-in-text-block` (WCAG 1.4.1, added 2026-10-15: the first run with that rule enabled flagged `/secondary` and `/privacy/request`, see the 2026-10-15 section below) — in live headless Chrome across every reviewed shipped route — 26 of them, and the route list is derived from `scripts/lib/public-routes.mjs` rather than kept in the spec, so a new page is scanned by existing — plus a Tab-walk that asserts visible focus on every focused element. It gates in the same CI job (`a11y_contrast` step, re-failed by the aggregator) and uploads per-route axe reports as artifacts. The gate was proven by seeding a sub-AA token (fails) and restoring it (passes). Since 2026-10-15 each run also publishes a per-run route inventory report (`a11y-evidence/route-inventory-report.md`, mirrored into the CI step summary) that reconciles every declared route's surfaces against the evidence that run actually recorded, and fails the run when a declared route has none, when evidence appears for a route the manifest does not declare, or when a summary row claims an evidence file that is not on disk — so a route the walk stops covering is a named row in a failing run rather than a quietly shorter audit. That report describes coverage, not conformance, and it does not attest any rendered state this table leaves to the manual pass.

These assertions are regression evidence only. They do not test every applicable accessibility requirement and do not replace human browser/assistive-technology testing.

## R-09 — the runbook's remaining findings (2026-10-14)

The Lighthouse remediation runbook's remaining task after R-01…R-08 is its "remaining findings" list (`M-03`, `L-02`–`L-05`). Each item below is either fixed and held by a committed guard, or recorded as an explicit, dated residual — silent deferral is what turns a Low finding into a review objection. Everything here is repository-side evidence: no human accessibility review is claimed, and issue #195 is unchanged by it.

| Item | Disposition (2026-10-14) | Held by |
|---|---|---|
| M-03 | Fixed — privacy §6 now carries one idea per sentence | `tests/privacy-policy-readability.test.ts` |
| L-02 | Fixed — a disabled control both looks disabled and renders 6.15:1 at full opacity, with no low-contrast frame between states | `src/app/globals.css`, `tests/design-token-contrast.test.ts` |
| L-03 | Fixed — the decorative border token carries its warning and a closed usage inventory | `src/app/globals.css`, `tests/design-token-contrast.test.ts` |
| L-04 | Fixed — the timeline tooltip renders at 14px | `tests/canvas-rendered-surface.test.ts` |
| L-05 | Residual, recorded — canvas content has no automated pixel evidence | `tests/canvas-rendered-surface.test.ts` and this section |

### M-03 — §6 of the privacy policy reads one idea at a time

The audit measured a single **163-word** sentence in §6 ("VA API and claim-submission boundary"). That sentence was split during the R-01 privacy work, but later additions to the same section reintroduced a **73-word** and a **39-word** sentence, so the finding's subject had regressed. Both are now split, with no technical claim changed — only sentence structure. The target is stated in the guard as **no sentence in §6 above 35 words**, and the guard prints its measurement into the test log (currently **34 sentences, longest 32 words**).

§8's clauses are deliberately excluded. They are the operator/legal sentences pinned *verbatim* in `tests/privacy-rights-contact.test.ts` as the text an approver is asked to accept, and two of them run 63 and 45 words; shortening approved legal text is a re-approval, not a readability fix. The guard asserts that exemption is a real pin rather than a hole someone widened. No reading-grade figure is claimed, because the audit declined to assert one it had not reliably measured.

### L-02 — a disabled control has to look disabled, not only be dark enough

The audit recorded this as `text-white` on `disabled:bg-slate-300` = **1.49:1**, measured from the class list. Measured in headless Chrome against the shipped stylesheet, that pair is not what the page renders. The legacy palette normalization in `src/app/globals.css` matches `button[class*="bg-slate-9"]` and forces `background: var(--primary)`, `color: #fff` and the border with `!important`, so the component's `disabled:bg-slate-300` never applied. The disabled submit on `/presumptive` computed to `rgb(29, 78, 216)` on `#fff` — byte-identical to the enabled control, at `opacity: 1`. The defect the user could actually experience was therefore that **a disabled control had no visual affordance at all**.

The disabled state is now declared where it wins on specificity: `--muted` on slate-200, **6.15:1**, with `opacity: 1` pinned. The pin is load-bearing, not decorative. The components still ship Tailwind's own `disabled:opacity-60`, and a rule that merely declined to declare an opacity would have left the control translucent — measured through axe, that rendering composites to **2.64:1** (`fg #8d96a3` on `bg #eef1f6`), less than half the ratio the rule exists for. The utility stays in those components: the pin states the invariant once, in the stylesheet, rather than relying on five call sites staying clean. The dead `disabled:bg-*` utility is gone from the component, so the source stops reading as though the state were styled there. The guard checks both directions and refuses if the normalization rule disappears — at which point the state can legitimately move back into the component.

The pull request for this item then failed the **R-05 real-browser contrast gate** on `/scenarios`: `white on #ced8ee` = **1.43:1** on the three "Run scenario" buttons. That report was accurate and reproducible, and the cause was the second half of L-02 rather than anything in the page. The shared button rule eases `background` over 160ms, while a control's text colour switches between `#fff` and `--muted` atomically; a CSS transition animates each property on its own clock, so the enabled⇄disabled flip paints white text over a surface that is still mostly slate-200. Frozen mid-transition in the shipped browser, the button computes `rgb(207, 217, 238)` behind `#ffffff` at 16ms into the 160ms ease — the same frame the gate named, and a real low-contrast rendering rather than a measurement artifact. Both endpoints of that transition pass on their own; only the frames between them fail, so the surface is no longer transitioned (border-colour and transform still ease). `tests/design-token-contrast.test.ts` recomputes that frame's ratio from the stylesheet's own values (1.42:1 against the gate's 1.43:1 for the frame one tick earlier), fails if `background` returns to the transition list, fails if the `:disabled` rule stops pinning opacity, and prints what the component's own `disabled:opacity-60` would render.

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

## Automated real-browser findings and remediation (2026-10-15)

Everything in this section is automated evidence. It fills no row of `docs/section508-manual-review-workbook.md`, answers no conformance question, and leaves issue #195 exactly where it was for human evidence.

The R-05 real-browser gate measured colour contrast only. Three rendering-dependent properties were therefore outside every automated surface: whether a link inside a block of text is distinguishable **without colour** (WCAG 1.4.1, Level A), and two structural rules that need a real DOM — `region` and `landmark-unique` — plus one ARIA-in-HTML defect that axe can only flag as `incomplete` in a headless pass (`aria-prohibited-attr`). The gate now runs `link-in-text-block` alongside `color-contrast`, and a local real-browser sweep with axe's wider rule set surveyed all 26 shipped routes for the rest. All four findings below came from those measurements, not from a code review.

| Finding | Rule and impact | Where | Fix |
|---|---|---|---|
| Links inside a block of text were distinguished by colour alone | `link-in-text-block`, serious, WCAG 1.4.1 (Level A) | `/secondary` (`<a href="/presumptive">presumptive track</a>` in `div.ui-footer-note`), `/privacy/request` (the `/privacy` link inside a `text-gray-600` paragraph at **1.12:1**, and the VA privacy link in a list item at **2.66:1**) | `src/app/globals.css`: `p a, li a, dd a, .ui-footer-note a, .ui-callout a, .app-shell [role="note"] a { text-decoration: underline; }`, repeated inside `@media (forced-colors: active)` |
| The layout cross-link strip was page content outside any landmark | `region`, moderate (best practice) | 7 routes across `src/app/presumptive/layout.tsx`, `src/app/secondary/suggestions/layout.tsx`, `src/app/va-forms/layout.tsx`, `src/app/va-reference/layout.tsx` | each strip is now a labelled `<nav aria-label="…">`, so landmark navigation reaches it |
| Two unnamed `aside` landmarks per two-column step | `landmark-unique`, moderate | `/presumptive` and the six `src/components/secondary/steps/*Step.tsx` surfaces, once their second column renders | every `aside` now carries a distinguishing `aria-label` |
| `aria-label="Workflow progress"` on a bare `div` | `aria-prohibited-attr` (reported `incomplete`) | the six workflow step components | the strip is now `role="group" aria-label="Workflow progress"`, so the name is exposed instead of discarded |

The link rule is scoped to text blocks rather than to `a` at large because button-styled links (`.ui-button`, `.ui-button-secondary`, the normalized legacy button classes and `.skip-link`) carry a visible surface and set their own `text-decoration: none`, which outranks the type-selector rule. Under forced colours the author palette is dropped, so the underline is repeated there with `!important`: it is the one affordance that survives into a high-contrast theme.

### What guards it

- `e2e/a11y-contrast.mjs` runs `runOnly: { type: "rule", values: ["color-contrast", "link-in-text-block"] }`. The blocking bar is unchanged at critical/serious, so the 1.4.1 rule blocks rather than being recorded.
- `tests/a11y-contrast-gate.test.ts` (**7 cases**) pins which rules the real-browser gate runs, so the second rule cannot be dropped without a failing test.
- `tests/accessibility-ux-reliability.test.ts` grew **11 → 12 cases**: the stylesheet rule and its forced-colours repetition, the button opt-out, the four labelled layout navs, the six `role="group"` progress strips, and the named asides.

### Measured verification, in both directions

The extended gate was run locally from an isolated copy of the tree with **Chrome 155** and **chromedriver 155**, the same WebDriver stack CI uses: it exits **0**, records **26/26** routes, reports **axe violations 0 on every route** and **0 problems** in the per-run route inventory, with 33 *degraded* notes (the pre-existing 120-step/distinct=1 keyboard-walk note plus the recorded non-blocking `incomplete` rows). Removing **only** the stylesheet rule from that copy makes the same gate exit **1** on `/secondary` — `[serious] link-in-text-block … @ a[href$="presumptive"]` (2.66:1) — and the rule was then restored. The full suite passes: `npx vitest run` **380 files / 3722 tests**.

The wider survey was a local instrument (Playwright + axe-core **4.14** + installed Chrome 155, dev server, all 26 routes), not a committed gate. After the fixes it reports `link-in-text-block`, `region`, `landmark-unique` and `aria-prohibited-attr` clean on all 26 routes, and it also measured, on the same routes: no axe delta and a visible focus ring under forced-colours emulation; under `prefers-reduced-motion: reduce`, 0 running animations and 0 elements with a transition or animation duration above 0.15s; no horizontal overflow at **320** or **640** CSS px on any route; a skip link present and targeting the existing `#main-content` on **26/26**; and exactly one `main`, one `h1` and a `lang` on every route.

**The instrument's own limits, recorded rather than smoothed over.** It ran against the dev server, which is what the committed gate also does. Its keyboard-repeat and "invisible focus" counters were polluted by Next.js's dev-tools `nextjs-portal` (0×0, dev-only) and by re-keying repeated widgets whose tag, class and text are identical, which produced one false "focus never advanced" signal; a direct trace of that route (`/secondary/diagnosed`) shows focus advancing normally — skip link, then the condition checkboxes — so **no keyboard trap was found**, and those counters are not evidence of one. Emulated forced colours, emulated reduced motion and viewport widths are emulation: they are not a Windows high-contrast session, not a real 200% zoom pass, and not a substitute for the human rows below.

### What is still manual

The workbook's human rows are unchanged and still blocking: keyboard-only traversal and focus order on the deployed build, keyboard traps and disclosure/file-input behaviour, NVDA and VoiceOver announcements and reading order, error identification, a real 200% zoom/reflow pass, interaction-dependent rendered states, a real Windows forced-colors/high-contrast session, and the final conformance determination. One useful note for that session: the `incomplete` colour-contrast nodes the automated evidence retains are all `aria-hidden` decorative glyphs, so automation leaves **no** unresolved text-contrast node behind.

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
- `/privacy` — the privacy policy, including §8 (deletion right, 45-day commitment, exceptions);
- `/privacy/request` — the privacy request intake, which prepares the message in the visitor's own mail client and submits nothing to the application;
- `/terms`;
- `/runtime-readiness`.

`/results` is excluded: it is an HTTP 307 redirect shim to `/secondary` and renders no content of its own. The exclusion is recorded in the workbook rather than left implicit, so an unlisted route is never mistaken for a reviewed one.

This list is not maintained by hand. `scripts/lib/public-routes.mjs` derives the shipped route set from `src/app/**/page.tsx` and declares each route's document title and title owner, its workbook row, whether the real-browser contrast and keyboard gate scans it, and whether the production route matrix probes it; `tests/public-route-manifest.test.ts` fails if any of those consumers disagrees with what ships. A route added later therefore cannot be missing from this summary, from the workbook matrix it summarizes, or from the automated gates.

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
| **Real-browser color contrast** | Axe `color-contrast` (enabled) in live headless Chrome over 26 shipped routes, in CI (`e2e/a11y-contrast.mjs`, R-05, 2026-10-11; route list derived from `scripts/lib/public-routes.mjs`) | **Verified (automated)** | Positive evidence on the dev-rendered build per CI run; specific *rendered states behind user input* on the deployed app still benefit from the manual workbook pass |
| **Link distinguishability without colour (WCAG 1.4.1)** | Axe `link-in-text-block` in the same real-browser run, blocking at serious (`e2e/a11y-contrast.mjs`, R-05, added 2026-10-15) | **Verified (automated)** — two findings remediated 2026-10-15 | Positive evidence for the resting state of every in-text link on the 26 scanned routes; links that appear only after user interaction still belong to the manual pass |
| **Rendered landmark structure (region / landmark uniqueness)** | Axe `region`, `landmark-unique` and `aria-prohibited-attr` in a local real-browser sweep (Playwright, axe-core 4.14, Chrome 155, 26 routes, 2026-10-15; a local instrument, not a committed gate) | **Verified (local measurement)** — four findings remediated 2026-10-15 | Positive evidence for the surveyed states; moderate/best-practice rules, and the screens' post-interaction states, remain for the manual pass |
| **Keyboard focus visibility (automated walk)** | Tab-walk asserting visible client rects on every focused element (same spec, R-05) | **Verified (automated)** | Focus *order* and trap behavior remain manual; see rows below |
| Keyboard-only traversal and focus order | Human deployed-app test | **Pending** | Blocking manual evidence |
| Keyboard traps / disclosure/file-input behavior | Human deployed-app test | **Pending** | Blocking manual evidence |
| Screen-reader announcements and reading order | NVDA and VoiceOver human test | **Pending** | Blocking manual evidence |
| Error identification and instructions | Human deployed workflow test | **Pending** | Blocking manual evidence |
| Zoom/reflow at 200% | Human browser test | **Pending** | Blocking manual evidence |
| Color contrast across rendered states | Automated real-browser axe pass (R-05) + manual review of input-dependent states | Automated base verified; rendered-state edge cases pending | Automated pass covers static render of 26 routes; the workbook's manual check adds states that only appear during user interaction |
| Windows high-contrast / forced-colors behavior | Human OS/browser test | **Pending** | Blocking manual evidence |
| Complete Section 508 / WCAG 2.0 A+AA conformance determination | Evidence review | **Pending** | Do not answer “Yes” until supportable |
| Disabled-control affordance, its text contrast, and the flip between states | Analytical source scan plus real-browser computed-style measurements (`tests/design-token-contrast.test.ts`, R-09/L-02) | Verified structurally and measured | Positive evidence for the normalized buttons at their resting disabled state; other disabled states remain a manual review item |
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
