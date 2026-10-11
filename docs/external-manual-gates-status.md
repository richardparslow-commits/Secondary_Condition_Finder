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

**Ownership and tracking (R-04, 2026-10-11).** Owner: the repository owner (`richardparslow-commits`), who commissions the session and is the accountable reviewer for scheduling; the independent tester who performs the manual session is named in the workbook when engaged — that engagement is the outstanding action. Requested date: as soon as the final submission build is pinned (the session must run on the exact build submitted, per the workbook's build-identity rule). Completion criterion: the four numbered conditions at the end of this section plus workbook sign-off. The issue was briefly closed on 2026-10-11 (16:51 UTC) after the repo-side preparation checkpoint merged; it was reopened the same day because a preparation checkpoint is not this gate's threshold — no human test result, tester, session date, assistive-technology matrix, or sign-off exists, and repository automation must not close #195.

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

**Automated contrast evidence (R-05, landed 2026-10-11).** Real-browser contrast evidence now exists: `e2e/a11y-contrast.mjs` runs axe-core's `color-contrast` rule enabled in live Chrome over 22 routes in CI, with per-route JSON evidence artifacts and a seeded-violation failure proof; it is pinned by `tests/a11y-contrast-gate.test.ts`. This corroborates but does not replace the manual rows: the manual contrast, 200%-zoom/reflow, and forced-colours checks remain required for interaction-dependent rendered states and forced-colors modes, and jsdom still computes no layout, so the jsdom axe gate stays disabled for `color-contrast`.

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

**Ownership and tracking (R-04, 2026-10-11).** Owner: the repository owner (`richardparslow-commits`) for all operator-controlled steps (environment protection, credential installation, check dispatch, enablement); the VA production-access reviewer is the external counterparty for the grant itself. Requested date: unfixable by this repository until VA responds — tracked as the outstanding external action rather than left implicit. Completion criterion: the five numbered operator steps below, ending with live production reference checks on the exact deployed SHA. The issue was briefly closed on 2026-10-11 (19:53 UTC) after the repo-side transition groundwork merged; it was reopened the same day because closure requires those five steps with objective recorded evidence, and no grant, credential, or connectivity evidence exists.

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

## R-04 ownership register — every external/manual gate (2026-10-11)

The Lighthouse report §5.4 requires that no gate lack a named owner, a requested date, and an explicit completion criterion, and that anything without one be escalated rather than left implicit. This register is that record; each entry's detail lives in its section above or in its tracking issue.

| # | Gate | Status | Owner | Tracking issue | Requested date | Completion criterion |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | #189 — credentialed VA sandbox smoke test | COMPLETE / CLOSED | Repository owner (`richardparslow-commits`) — closed with recorded evidence | #189 | Closed 2026-09-05 | Credentialed sandbox run 33997305230, recorded above |
| 2 | #195 — manual Section 508 accessibility review | OPEN / HUMAN-ONLY | Repository owner (commissioning) + independent tester (named when engaged) | #195 | Final submission build pinned | Workbook fully completed on an identified build: human results, tester, session date, AT matrix, retests, sign-off |
| 3 | #213 — production `WORKFLOW_SESSION_SECRET` | COMPLETE / CLOSED | Repository owner — closed with recorded evidence | #213 | Closed 2026-08-13 | Runtime crypto-path verification on the exact deployment, recorded above |
| 4 | #287 — VA public-reference production transition | OPEN / EXTERNALLY BLOCKED on VA grant | Repository owner (operator steps); VA production-access reviewer (grant) | #287 | Unfixable until VA responds | Grant + credentials + authorized controlled check + deliberate enablement + live production reference checks on the exact deployed SHA |
| 5 | H-02 gate A — hosting log retention and access-control review | OPEN / EXTERNALLY OPERATED | Repository owner (operator review of the hosting account) | [#537](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/537) | Operator scheduling; next operator session | Retention period, read access, and redaction terms reviewed and recorded for every production log sink, with dates |
| 6 | H-02 gate B — OAuth callback-URL log scrubbing review | OPEN / EXTERNALLY OPERATED | Repository owner (operator review + code inspection cross-check) | [#538](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/538) | Operator scheduling; next operator session | Callback surfaces enumerated; codes/state confirmed scrubbed or not retained in every sink; any finding remediated and retested |
| 7 | Privacy-policy deletion-right language — operator/legal sign-off | OPEN / HUMAN-APPROVAL | Repository owner, acting as operator/privacy approver | [#539](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/539) | Before the production-access submission | Approver records name, date, and affiliation; deletion right, 45-day commitment, and a verified live contact channel confirmed; phase3 package sign-off matrix updated |

Notes on this register:

- **Ownership is recorded where it is real.** Every human gate in this repository has to date been executed by the repository owner, so the register names that owner rather than an uninvolved third party; for gates whose evidence must come from outside the repository (the VA grant, the independent tester's manual results), the external counterparty is named as the source of evidence and cannot be substituted by repository automation.
- **Stale-state correction.** #195 and #287 were manually closed on 2026-10-11 after their respective repo-side preparation work merged, in both cases described in the closing updates as repository-side checkpoints rather than gate closure. Both were reopened the same day under R-04 because neither gate's completion criterion was met; their sections above record the events.
- **Dates.** "Requested date" is the target by which the gate's unblocking action should occur. For external-counterparty gates (#287, #195's tester engagement), the date is stated as the condition that triggers it, because this repository cannot set a calendar date for another party.

## P0 account integration and approval boundary

A separate disabled-by-default sandbox account phase implements veteran-self-service OAuth/PKCE, read-only rating summaries and existing claim statuses. See [sandbox account setup](va-account-sandbox.md). Synthetic provider tests establish code behavior only; real registered-client connectivity is still required before calling it live. No production account endpoints, representative access, claim mutations or Intake upload are included.

The public-reference #287 gate requires two distinct events: first an explicit VA grant for the requested services, then a controlled authorized connectivity check. The acknowledgement flag may be set for that approved check after the grant; it does not itself prove connectivity or close the issue. This avoids requiring live verification before there is an authorized way to perform it. No grant, credentials, or deployment evidence was manufactured by the sandbox implementation.

## Completion boundary

The repository records #189 and #213 as complete; verify their evidence lineage rather than reopening them as missing. #195 remains open for identified-build human accessibility evidence, and #287 remains open for the external grant plus live production verification; both were briefly closed on 2026-10-11 as repo-side preparation checkpoints and reopened the same day under R-04 because their completion criteria are not met — see their sections above. The three previously untracked gates (both H-02 operator reviews and the privacy-language sign-off) are now tracked in issues #537/#538/#539 and the R-04 ownership register above; until their operator evidence lands they remain open, and the Lighthouse close-out criteria "All seven gates in §5.4 have a named owner and a date" and H-02 stay qualified accordingly. Application fixes, source tests, HTTP fallback success and mock account data cannot close any of these gates. The broader clinical/evidence program is not certified by these process records.
