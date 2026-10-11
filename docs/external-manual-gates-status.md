# External and Manual Gates Status

This record separates repository-complete work from evidence that cannot legitimately be manufactured by repository automation.

## Issue #189 — credentialed VA sandbox smoke test

**Status: COMPLETE / CLOSED.**

The repository-side VA Forms and Benefits Reference Data sandbox adapters/workflow are implemented. Closing the gate requires a real non-production run with issued server-only credentials configured in GitHub Actions secrets `VAFORMSSANDBOXAPIKEY` and `VABENEFITSREFERENCESANDBOXAPIKEY`; the workflow maps those values to the internal `VA_FORMS_SANDBOX_API_KEY` and `VA_BENEFITS_REFERENCE_SANDBOX_API_KEY` variables before execution, followed by objective non-sensitive success evidence.

This gate was closed by a credentialed dispatch of the existing `VA Sandbox Smoke Test` workflow on `main` after the workflow was corrected to read the configured secret names. The recorded sanitized evidence is:

- VA Forms: HTTP 200; request ID `4e806cfd-36e6-4aea-b3b8-8765f2f9a828`; validated result count 1.
- Benefits Reference Data: HTTP 200; request ID `1785c029-bb9b-4384-bd3f-b61d41f363dd`; validated result count 9.
- Workflow run: [33997305230](https://github.com/richardparslow-commits/Secondary_Condition_Finder/actions/runs/33997305230)
- No API key or raw response payload was recorded in the evidence.

Repository automation did not invent this evidence; it was produced by a successful external credentialed workflow run from `main` and recorded only as sanitized timestamp/service/HTTP-success/request-ID/high-level validation evidence.

## Issue #195 — manual Section 508 accessibility review

**Status: OPEN / HUMAN-ONLY.**

Repository CI, Chrome E2E, source-level accessibility contracts, deployment reachability, and Runtime Readiness are supporting evidence only. The issue explicitly requires human keyboard, assistive-technology, zoom/reflow, contrast, and forced-colors testing with synthetic/non-sensitive data plus reviewer sign-off.

Automation can keep the workbook, routes, and supporting evidence ready, and it can reflect the current gate context in downstream documents, but it cannot truthfully record PASS for an unperformed human test. The canonical manual evidence record remains `docs/section508-manual-review-workbook.md`, and every required row still carries the default state of `NOT TESTED` until a human completes the workbook against the exact identified production build.

The workbook no longer pins hardcoded build identifiers, because a committed SHA or deployment id goes stale as soon as `main` advances and would silently point the tester at a superseded build. The tester resolves live identity at session start with:

```bash
node scripts/resolve-review-build-identity.mjs
```

That script emits build identity and an HTTP reachability probe only. It emits no accessibility result, and an HTTP 200 is not an accessibility PASS.

**Readiness update (2026-10-11).** Two automation-side blockers on *scheduling* the session have been cleared. Neither is accessibility evidence and neither moves #195 toward closure.

1. **Ordering constraint satisfied.** `VA_Lighthouse_Readiness_Report.md` §7 requires the session to happen *after* remediation tasks R-02 and R-07 land, or its evidence is invalidated. R-02 merged in PR #520 (`4112e719`); R-07 merged in the follow-up type-scale and label-casing change, which raised 20 legal, privacy, safety, and verification notices from 12px to 14px plus the `.ui-kicker` eyebrow class used at 24 call sites, and removed all-caps styling from every multi-word label — components went from 41 `uppercase` occurrences to 1 (a header row whose six columns are single short words) and stylesheets from 1 `text-transform: uppercase` to 0. Both halves are locked by committed tests: `tests/design-token-contrast.test.ts` and `tests/legal-notice-legibility.test.ts`.
2. **Workbook route matrix completed.** The matrix listed 14 route entries while the application ships 26 routes. Seven live production routes were absent — `/get-records`, `/scenarios`, `/runtime-readiness`, `/secondary/condition-caused-by`, `/secondary/condition-aggravation`, `/secondary/legal`, and `/presumptive/results` — so a tester following the workbook would have under-covered the surface #195 requires evidence for. The matrix now enumerates every shipped route, records `/results` in an explicit exclusion table as an HTTP 307 redirect shim rather than leaving it silently unlisted, and requires a route added later to be added to the matrix in the same change.

**Still missing: R-05.** There is no automated real-browser contrast evidence. `e2e/` contains no axe reference, and jsdom computes no layout, so axe's `color-contrast` rule stays disabled in `tests/setup/accessibility.ts`. The manual contrast, 200%-zoom/reflow, and forced-colours checks therefore remain the project's only contrast evidence and cannot be inferred from a green automated suite.

Issue #195 remains open. It may stay open until:

1. every required manual item has recorded human evidence on an identified production build;
2. every material finding has a remediation issue/PR and a recorded retest;
3. `docs/accessibility-audit.md` is updated with the completed review date, tester/environment evidence, known limitations, and supportable final status; and
4. `docs/phase3-submission-checklist.md` is updated from objective evidence.

Repository automation must not close #195 or claim Section 508 conformance until the human evidence matrix, retests for any material findings, and final sign-off are complete.

## Issue #213 — production workflow-session secret

**Status: COMPLETE / CLOSED.**

The production `WORKFLOW_SESSION_SECRET` runtime gate has already been objectively verified through the real server-side crypto path, exact deployment lineage, successful production Runtime Readiness, and non-sensitive evidence. It is not an outstanding blocker.

## Issue #287 — VA public-reference production transition

**Status: OPEN / EXTERNALLY BLOCKED on VA production access.**

The issue's own gate rule is decisive: *"Do not switch the application to VA production endpoints or label data as production-sourced until VA production access is granted and live production connectivity is objectively verified."* Its final remaining item requires **live production reference checks** before closure. VA has not granted production access, so no repository change can close this issue.

Repository-side runtime implementation is present. The 2026-10-11 follow-up adds a controlled connectivity procedure and corrects ambiguous flag handling; neither constitutes external VA approval or live production evidence:

- **Deliberate tri-state runtime mode.** `resolveVaReferenceMode()` in `src/lib/va/runtime-state.ts` is the single decision point and resolves exactly one of `disabled` / `sandbox` / `production`. `disabled` is the fail-closed default and also the outcome for any ambiguous or incomplete production selection.
- **Production access acknowledgement.** Production mode requires `VA_PRODUCTION_ACCESS_GRANTED=true`, separate from `VA_API_ENABLED`. The acknowledgement represents a real VA grant, not connectivity proof. No production grant or production credential is established by this change.
- **Ambiguous configuration fails closed.** An explicit invalid/blank generic enable flag cannot fall through to the legacy sandbox flag; unknown nonblank environment values are refused.
- **Controlled verification before activation.** The manual, main-only [production check workflow](../.github/workflows/va-production-reference-check.yml) and [operator CLI](../scripts/verify-va-production-reference.mts) require an explicit grant and both production keys, keep application access disabled, use fixed endpoints and shared payload schemas, and emit sanitized evidence only. Required environment reviewers/protection must be configured by the operator. The check cannot close #287; see the [transition procedure and rollback](va-api-runtime-configuration.md#controlled-production-connectivity-check-issue-287).
- **No production material on a failed-closed selection.** When production fails closed, the loaded configuration carries sandbox endpoints and no production keys, so a caller that neglected to check `enabled` still cannot reach production. The `environment` field still reports the *requested* environment so a refused production selection stays visible.
- **Bounded caching and source-status reporting** cover Forms, disabilities, service branches and the optional locator. Process-local caching remains disabled in production/distributed runtimes; the implemented shared tier does not by itself enable live access. Distributed attempts require the explicit shared consumer-budget opt-in and successful shared circuit/budget admission. Actual deployment verification remains required.
- **Forms Finder usage guidance** shipped in PR #288.

External/operator work still required (repository automation must not fabricate it):

1. VA grants production API access;
2. production service-specific credentials are installed server-side;
3. the authorized controlled check succeeds while application access remains disabled;
4. production mode is deliberately enabled with verified shared coordination;
5. full CI, exact-build deployment readiness, and **live production reference checks** verify the actual deployed path before closure.

Last recorded production state: `https://secondary-condition-finder.vercel.app/va-reference` returned HTTP 200 with **Local catalog fallback** and VA access **disabled**. This historical fallback check is not live VA production evidence. Recheck the exact deployment during the transition.

Issue #189's credentialed sandbox evidence is complete and recorded at the top of this file; only #287's production transition remains externally open.

## P0 account integration and approval boundary

A separate disabled-by-default sandbox account phase implements veteran-self-service OAuth/PKCE, read-only rating summaries and existing claim statuses. See [sandbox account setup](va-account-sandbox.md). Synthetic provider tests establish code behavior only; real registered-client connectivity is still required before calling it live. No production account endpoints, representative access, claim mutations or Intake upload are included.

The public-reference #287 gate requires two distinct events: first an explicit VA grant for the requested services, then a controlled authorized connectivity check. The acknowledgement flag may be set for that approved check after the grant; it does not itself prove connectivity or close the issue. This avoids requiring live verification before there is an authorized way to perform it. No grant, credentials, or deployment evidence was manufactured by the sandbox implementation.

## Completion boundary

The repository records #189 and #213 as complete; verify their evidence lineage rather than reopening them as missing. #195 remains open for identified-build human accessibility evidence, and #287 remains open for the external grant plus live production verification. Application fixes, source tests, HTTP fallback success and mock account data cannot close either gate. The broader clinical/evidence program is not certified by these process records.
