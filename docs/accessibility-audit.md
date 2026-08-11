# Accessibility / Section 508 Evidence Report

## Purpose

This document records what the repository currently proves about accessibility and what still requires manual verification before answering the VA API Platform production-access question, **“Is your application and website Section 508 compliant?”**

It is an evidence report, not a certification.

## Applicable baseline

The project uses the Revised Section 508 web-content baseline as the production-review reference point. Section508.gov states that the Revised Section 508 Standards incorporate WCAG 2.0 Level AA success criteria for web content.

The product may pursue newer WCAG guidance as an additional quality target, but the repository must not claim Section 508 conformance solely because individual automated checks pass.

## Current status

**Status: PARTIAL EVIDENCE — MANUAL CONFORMANCE REVIEW PENDING**

The current automated suite proves a limited set of structural and content contracts. It does **not** prove complete Section 508 or WCAG conformance. Until the manual checks below are completed and recorded, the production-access package must not represent the application as verified Section 508 compliant.

## Automated evidence currently enforced

`tests/accessibility-ux-reliability.test.ts` verifies selected primary routes for:

- exactly one `<main>` landmark;
- a top-level `<h1>`;
- no immediate heading-level skip from no `<h2>` to an `<h3>`;
- discoverability of the public privacy and terms routes;
- explicit non-diagnostic and privacy-scope language;
- the public `/about` route's main landmark, heading structure, audience/scope language, and legal-route navigation.

Other route-specific tests cover selected form-label, source-label, and privacy behaviors where those components are exercised.

These assertions are regression evidence only. They do not test every WCAG success criterion and do not replace browser/assistive-technology testing.

## Evidence matrix

| Area | Evidence method | Current status | Submission interpretation |
|---|---|---|---|
| Main landmark / top-level headings on tested routes | Automated Vitest server-render assertions | Verified for tested routes | Positive evidence, limited scope |
| Heading-order sanity on tested routes | Automated Vitest assertion | Verified for tested routes | Positive evidence, limited scope |
| Privacy / terms discoverability | Automated Vitest assertion | Verified on home/about paths under test | Positive evidence, limited scope |
| Accessible names / labels for interactive workflow controls | Route/component regression tests where implemented | Partial | Must be reviewed across deployed flows |
| Keyboard-only traversal and focus order | Manual deployed-app test | **Pending** | Blocking manual evidence |
| Visible keyboard focus | Manual deployed-app test | **Pending** | Blocking manual evidence |
| Keyboard traps / modal or disclosure behavior | Manual deployed-app test | **Pending** | Blocking manual evidence |
| Screen-reader announcements and reading order | NVDA and/or VoiceOver manual test | **Pending** | Blocking manual evidence |
| Error identification and instructions | Manual deployed workflow test | **Pending** | Blocking manual evidence |
| Zoom/reflow at 200% and narrow viewport | Browser manual test | **Pending** | Blocking manual evidence |
| Color contrast across rendered states | Contrast tooling/manual review | **Pending** | Blocking manual evidence |
| Windows high-contrast / forced-colors behavior | Manual OS/browser test | **Pending** | Blocking manual evidence |
| Complete Section 508 / WCAG 2.0 AA conformance determination | Evidence review | **Pending** | Do not answer “Yes” until supportable |

## Manual deployed-app protocol

Run against the exact deployed `main` commit intended for the VA review.

### Keyboard

1. Navigate the home page, `/about`, `/secondary`, `/presumptive`, `/va-forms`, `/va-reference`, `/privacy`, and `/terms` using only Tab, Shift+Tab, Enter, Space, and arrow keys where applicable.
2. Confirm focus order follows the visual/logical reading order.
3. Confirm every interactive control has a visible focus indicator.
4. Confirm no keyboard trap occurs.
5. Confirm validation errors can be reached and understood without a pointer device.

### Screen reader

Use at least one representative desktop screen reader (NVDA on Windows or VoiceOver on macOS) and record the tool/version.

1. Confirm page title/top-level heading context is understandable.
2. Confirm landmarks and navigation regions are announced sensibly.
3. Confirm form controls announce their labels, state, and required/error information.
4. Confirm dynamic result/source labels are understandable in reading order.
5. Confirm links have meaningful accessible names out of surrounding visual context.

### Zoom, reflow, and contrast

1. Test browser zoom at 200% on the primary review routes.
2. Test a narrow/mobile viewport for horizontal scrolling or clipped essential content.
3. Review text, controls, focus indicators, alerts, badges, and error states for required contrast.
4. Test Windows forced-colors/high-contrast behavior if available.

## Recording manual evidence

For each run record only non-sensitive evidence:

- date/time;
- deployed commit SHA;
- browser and version;
- operating system;
- assistive technology and version, if used;
- routes tested;
- pass/fail by checklist item;
- issue links for any defects.

Do not use real Veteran medical, claim, or identifying data during accessibility testing. Use synthetic/sample inputs only.

## Privacy statement for accessibility testing

Accessibility testing does not change the application's data-handling model. Testers should use synthetic/sample data. The current privacy architecture keeps health/disability workflow selections and presumptive service-history state out of URLs, uses short-lived encrypted/authenticated workflow cookies, limits recommendation-event persistence to aggregate metrics, and excludes VA API credentials and raw response bodies from intentional operational logging.

## Gate rule

The Phase 3 submission checklist remains blocked on accessibility until:

1. the manual deployed-app protocol has been completed on the intended production-review commit;
2. discovered accessibility defects that affect the VA review path are fixed or explicitly documented;
3. the evidence is reviewed; and
4. the yes/no Section 508 answer is supported by that evidence rather than project intent.
