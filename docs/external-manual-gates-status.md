# External and Manual Gates Status

This record separates repository-complete work from evidence that cannot legitimately be manufactured by repository automation.

## Issue #189 — credentialed VA sandbox smoke test

**Status: COMPLETE / CLOSED.**

**Accountable owner: Richard Parslow (`richardparslow-commits`)**, historical evidence custodian. This closed gate has no new work assignment; preserve its credentialed success record.

The repository-side VA Forms and Benefits Reference Data sandbox adapters/workflow are implemented. Closing the gate requires a real non-production run with issued server-only credentials configured in GitHub Actions secrets `VAFORMSSANDBOXAPIKEY` and `VABENEFITSREFERENCESANDBOXAPIKEY`; the workflow maps those values to the internal `VA_FORMS_SANDBOX_API_KEY` and `VA_BENEFITS_REFERENCE_SANDBOX_API_KEY` variables before execution, followed by objective non-sensitive success evidence.

This gate was closed by a credentialed dispatch of the existing `VA Sandbox Smoke Test` workflow on `main` after the workflow was corrected to read the configured secret names. The recorded sanitized evidence is:

- VA Forms: HTTP 200; request ID `4e806cfd-36e6-4aea-b3b8-8765f2f9a828`; validated result count 1.
- Benefits Reference Data: HTTP 200; request ID `1785c029-bb9b-4384-bd3f-b61d41f363dd`; validated result count 9.
- Workflow run: [33997305230](https://github.com/richardparslow-commits/Secondary_Condition_Finder/actions/runs/33997305230)
- No API key or raw response payload was recorded in the evidence.

Repository automation did not invent this evidence; it was produced by a successful external credentialed workflow run from `main` and recorded only as sanitized timestamp/service/HTTP-success/request-ID/high-level validation evidence.

## Issue #195 — manual Section 508 accessibility review

**Status: OPEN / HUMAN-ONLY.**

**Ownership and tracking (R-04, verified 2026-10-12).** Accountable owner and GitHub assignee: Richard Parslow (`richardparslow-commits`), who commissions the session and coordinates evidence; the independent tester must be named in the workbook when engaged — that engagement remains outstanding. Tracking requested date: **2026-10-12**. Target: engage the tester before final rehearsal and run the session on the exact final submission build, resolving identity at session start; no session date is confirmed. Completion criterion: the four numbered conditions at the end of this section plus tester/reviewer workbook sign-off. The issue's old frozen-build block is historical, not a current session assignment; the current workbook defines route coverage and build resolution. The issue was briefly closed on 2026-10-11 (16:51 UTC) after the repo-side preparation checkpoint merged; it was reopened the same day because a preparation checkpoint is not this gate's threshold — no human test result, tester, session date, assistive-technology matrix, or sign-off exists, and repository automation must not close #195.

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

**Accountable owner: Richard Parslow (`richardparslow-commits`)**, historical evidence custodian. This closed gate has no new work assignment; preserve its exact-deployment runtime-verification record.

The production `WORKFLOW_SESSION_SECRET` runtime gate has already been objectively verified through the real server-side crypto path, exact deployment lineage, successful production Runtime Readiness, and non-sensitive evidence. It is not an outstanding blocker.

## Issue #287 — VA public-reference production transition

**Status: OPEN / EXTERNALLY BLOCKED on VA production access.**

**Ownership and tracking (R-04, verified 2026-10-12).** Accountable owner and GitHub assignee: Richard Parslow (`richardparslow-commits`) for VA request coordination and all operator-controlled steps (environment protection, credential installation, check dispatch, enablement); the VA production-access reviewer supplies grant evidence. Tracking requested date: **2026-10-12**, for ownership/scheduling only — not a production-access application submitted to VA. Target: record the actual application/request date and VA response estimate when available; check connectivity only after a real grant, then activate only after successful verification. No named VA contact or response date is recorded. Completion criterion: the five numbered operator steps below, ending with live production reference checks on the exact deployed SHA. The issue's original repository implementation checklist is historical; external/operator evidence remains outstanding. The issue was briefly closed on 2026-10-11 (19:53 UTC) after the repo-side transition groundwork merged; it was reopened the same day because closure requires those five steps with objective recorded evidence, and no grant, credential, or connectivity evidence exists.

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

Issue #189's credentialed sandbox evidence is complete and recorded at the top of this file; #287 remains the open VA public-reference production transition. The other outstanding human/operator gates are listed below.

## Issue #537 — hosting log retention and access-control review (H-02 gate A)

**Status: OPEN / EXTERNALLY OPERATED.** Accountable owner and GitHub assignee: **Richard Parslow (`richardparslow-commits`)**. Tracking requested date: **2026-10-12**. Target: next operator review session, before the production-access submission; no session date is confirmed.

Completion requires a dated inventory of every production request/runtime/edge log sink and drain destination, its retention period and policy date, read/export access controls, and redaction/data-handling terms. Record sanitized policy/sink identifiers and review outcomes in [#537](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/537) and this document, not sensitive log content. Operator scheduling is still pending; assignment is not review evidence.

**Repository-side inventory (2026-10-13).** The code-side half of the sink inventory is now recorded in [hosting log and callback inventory](hosting-log-and-callback-inventory.md): the reviewed application sink set is enumerated and pinned by `tests/logging-sink-inventory.test.ts`, and the repository declares **no** log drain or custom collector configuration (no `vercel.json`, no drain config in the tree). The sinks that can therefore receive application records are the hosting provider's own request/runtime/edge logs — which is precisely the half only the operator can inspect. This is not the retention/access review and does not close #537: the per-sink retention period and policy date, read/export access controls, and redaction/data-handling terms remain unrecorded, and the review procedure is the four numbered steps in that document's Part 4.

## Issue #538 — OAuth callback-URL log scrubbing review (H-02 gate B)

**Status: OPEN / EXTERNALLY OPERATED.** Accountable owner and GitHub assignee: **Richard Parslow (`richardparslow-commits`)**. Tracking requested date: **2026-10-12**. Target: next operator review session, before the production-access submission, coordinated with #537; no session date is confirmed.

Completion requires an inventory of the actual callback routes and relevant log sinks, verification that authorization codes/state are scrubbed or not retained in each sink, and sanitized dated outcomes in [#538](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/538) and this document. Any finding must be remediated and retested before closure. Do not retain codes, state, query-bearing URLs, or account identifiers as evidence. Historical `api/auth/callback` references in the original issue are not proof of a currently shipped route; inventory current source and hosting configuration. Operator scheduling and live scrubbing verification remain pending.

**Repository-side inventory and code-side conclusion (2026-10-13).** The callback-surface question is now answered from source rather than assumed, and recorded in [hosting log and callback inventory](hosting-log-and-callback-inventory.md) Part 2: `GET /api/auth/callback` **does** ship as the adapter callback, alongside the canonical `GET /va-account/oauth/{service}/callback` registered as the `redirect_uri`, with two login initiators (`POST /va-account/oauth/{service}/start`, `GET /api/auth/login`) and one disconnect surface. The code-side scrubbing conclusion is that no application sink can receive a code or state: the callback-path modules contain no logging sink at all, no `src/` file passes a request URL, query string or `code`/`state` read into any sink (falsified with planted violations), the only error the exchange raises is a fixed-message `AccountUnavailable`, every callback outcome is a pinned fixed notice code, and every callback response is `no-store` with `Referrer-Policy: no-referrer`. All of this is pinned by `tests/oauth-callback-surface-inventory.test.ts`. This does not close #538: the hosting provider's own request/access logs may still retain the callback request line, and whether the platform scrubs `code`/`state` — and for how long the logs are retained — is a hosting-account fact. Gate B's outstanding evidence is unchanged and external.

## Issue #539 — privacy-policy deletion-right language approval

**Status: OPEN / HUMAN-APPROVAL.** Accountable owner and GitHub assignee: **Richard Parslow (`richardparslow-commits`)**, coordinating operator/privacy approval and monitored-contact verification. Tracking requested date: **2026-10-12**. Target: before the production-access submission; no approval date is confirmed. Identify any separate legal approver when engaged; assignment is not legal sign-off.

Completion requires the approver's full name, date, affiliation, and decision on the deletion right and 45-day commitment; a verified live monitored contact channel with a named handler, sanitized send/receive-test outcome, and fulfillment procedure; and a record of any changes. Record the decision in [#539](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/539), update the [report sign-off matrix](../VA_Lighthouse_Readiness_Report.md#9-approval), and update the production-access package as applicable. No affiliation, mailbox operation, or approval has been established by this ownership record; approval and contact-channel verification remain pending.

**Repository-side sign-off readiness (2026-10-13).** The surfaces this gate closes on now exist, and the language the approver must read has been corrected to what the application actually operates. Four changes: (1) the policy's access-and-correction paragraph no longer claims the contact channels accept requests "by email and by phone" — no phone intake channel exists, and the only published number is VA's benefits line, which the same paragraph labels as not an intake channel, so the claim promised a channel that could not receive a request; (2) the 45-day commitment is single-sourced on the intake page (it renders the intake module's constant instead of also hardcoding the number), so the two statements on that page cannot diverge; (3) [data retention policy](data-retention-policy.md) now names the published channel, the `/privacy/request` intake route, the 45-day completion commitment and the statutory exceptions, instead of routing privacy requests to `SECURITY.md` (which remains the security-report channel only); and (4) the sign-off surfaces can now carry the criterion's facts — the [report §9 matrix](../VA_Lighthouse_Readiness_Report.md#9-approval) has full-name, affiliation, decision and date columns with the R-01 decision split from H-02 review ownership, and the [production-access package](phase3-production-access-package.md) has a "Privacy approval and monitored contact" section whose fields are recorded as unset. These are repository-side readiness only: no approver, affiliation, decision, mailbox liveness, named handler, or send/receive result is recorded anywhere, and the matrix states that no approval is recorded. What remains to close is unchanged and human: the approver's full name, affiliation, decision and date; the monitored mailbox confirmed live with a named handler; and a sanitized send/receive test with the fulfillment procedure recorded.

**Repository-side state (2026-10-13).** The policy language and a working intake path are now in the tree, and neither is an approval. The deletion right, the 45-day completion commitment and the statutory exceptions are published in privacy-policy section 8 (`src/app/privacy/page.tsx`) and mirrored in Terms section 7; the intake is the `/privacy/request` page (`src/app/privacy/request/page.tsx`), which prepares a deletion, access, correction, or question message for the visitor's own mail client, already addressed to the monitored mailbox, and offers the same text to copy when no mail client opens. That page submits nothing to the application, so no request content and no identifier is stored here — it is the reason the intake needed no exception to the PHI-free Server Action boundary. What remains for this gate is unchanged and human: the approver's name, date, affiliation and decision; a named handler for the mailbox; and a sanitized send/receive test against that live mailbox with the fulfillment procedure recorded.

## R-04 ownership register — every external/manual gate (verified 2026-10-12)

The Lighthouse report §5.4 requires that no gate lack a named owner, a requested date, and an explicit completion criterion, and that anything without one be escalated rather than left implicit. The existing R-04 work created #537/#538/#539 on 2026-10-11 and recorded ownership on all five open trackers on 2026-10-12. A live GitHub recheck on **2026-10-12** confirms that all seven gates already have tracking issues and that #195/#287/#537/#538/#539 are open and assigned to **Richard Parslow (`richardparslow-commits`)**. Each open issue body carries the dated R-04 ownership record with responsibility, target/trigger, completion criterion, and pending-dependency escalation. No duplicate issue or additional assignment was needed during this reconciliation. #189 and #213 remain closed, with their historical evidence preserved; the corrected report §5.4 table uses those actual issue purposes and states.

| # | Gate | Status | Accountable owner | Tracking issue | Tracking requested date / historical closure | Target / trigger | Completion criterion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | #189 — credentialed VA sandbox smoke test | COMPLETE / CLOSED | Richard Parslow (`richardparslow-commits`), historical evidence owner | [#189](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/189) | Closed 2026-09-05; no new request | Complete | Credentialed sandbox run 33997305230, recorded above |
| 2 | #195 — manual Section 508 accessibility review | OPEN / HUMAN-ONLY | Richard Parslow (`richardparslow-commits`), assigned commissioning/evidence owner; independent tester pending | [#195](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/195) | 2026-10-12 | Engage tester before final rehearsal; test exact final build; session date pending | Workbook fully completed on an identified build: human results, tester, session date, AT matrix, retests, sign-off; audit/checklist updated |
| 3 | #213 — production `WORKFLOW_SESSION_SECRET` | COMPLETE / CLOSED | Richard Parslow (`richardparslow-commits`), historical evidence owner | [#213](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/213) | Closed 2026-08-13; no new request | Complete | Runtime crypto-path verification on the exact deployment, recorded above |
| 4 | #287 — VA public-reference production transition | OPEN / EXTERNALLY BLOCKED on VA grant | Richard Parslow (`richardparslow-commits`), assigned VA request/operator owner; VA reviewer supplies grant | [#287](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/287) | 2026-10-12 | Record actual VA request date/response estimate when available; check after grant, activate after verification | Grant + credentials + authorized controlled check + deliberate enablement + full CI/exact-build readiness and live production reference checks |
| 5 | H-02 gate A — hosting log retention and access-control review | OPEN / EXTERNALLY OPERATED | Richard Parslow (`richardparslow-commits`), assigned hosting-review owner | [#537](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/537) | 2026-10-12 | Next operator session, before submission; session date pending | Retention period/policy date, read/export access, and redaction terms reviewed and recorded for every production log sink |
| 6 | H-02 gate B — OAuth callback-URL log scrubbing review | OPEN / EXTERNALLY OPERATED | Richard Parslow (`richardparslow-commits`), assigned scrubbing-review owner | [#538](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/538) | 2026-10-12 | Next operator session, before submission; coordinate with #537; session date pending | Actual callback surfaces enumerated; codes/state confirmed scrubbed or not retained in every sink; dated outcome, remediation and retest |
| 7 | Privacy-policy deletion-right language — operator/legal sign-off | OPEN / HUMAN-APPROVAL | Richard Parslow (`richardparslow-commits`), assigned approval/contact-verification owner | [#539](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/539) | 2026-10-12 | Before submission; approval date pending | Approver name/date/affiliation and decision; deletion right/45-day commitment reviewed; monitored contact/handler/send-receive test/procedure verified; report sign-off and package updated |

Notes on this register:

- **Accountability is not approval or performance.** Richard Parslow is the named accountable owner and actual GitHub assignee on all five open trackers. An independent tester and any separate legal approver must be identified when engaged; the VA reviewer must supply grant evidence. None is invented or substituted by repository automation. Closed #189/#213 retain historical evidence ownership rather than receiving new work assignments.
- **Stale-state correction.** #195 and #287 were manually closed on 2026-10-11 after their respective repo-side preparation work merged, in both cases described in the closing updates as repository-side checkpoints rather than gate closure. Both were reopened the same day under R-04 because neither gate's completion criterion was met; their sections above record the events.
- **Dates and escalation.** The **2026-10-12 tracking requested date** records the ownership/scheduling request persisted in GitHub, not a confirmed completion deadline, VA application date, review session, or approval. Targets/triggers are separate; unconfirmed session dates, tester engagement, VA response timing, operator reviews, and privacy approval are explicitly pending in their assigned issues. The owner must record confirmed dates and any overdue/escalated dependency when available; this register does not promise another party's delivery date.

## P0 account integration and approval boundary

A separate disabled-by-default sandbox account phase implements veteran-self-service OAuth/PKCE, read-only rating summaries and existing claim statuses. See [sandbox account setup](va-account-sandbox.md). Synthetic provider tests establish code behavior only; real registered-client connectivity is still required before calling it live. No production account endpoints, representative access, claim mutations or Intake upload are included.

The public-reference #287 gate requires two distinct events: first an explicit VA grant for the requested services, then a controlled authorized connectivity check. The acknowledgement flag may be set for that approved check after the grant; it does not itself prove connectivity or close the issue. This avoids requiring live verification before there is an authorized way to perform it. No grant, credentials, or deployment evidence was manufactured by the sandbox implementation.

## Completion boundary

The repository records #189 and #213 as complete; verify their evidence lineage rather than reopening them as missing. #195 remains open for identified-build human accessibility evidence, and #287 remains open for the external grant plus live production verification; both were briefly closed on 2026-10-11 as repo-side preparation checkpoints and reopened the same day under R-04 because their completion criteria are not met — see their sections above. All seven R-04 gates are issue-tracked with named accountable owners and historical closure dates or explicit tracking requested dates; all five open trackers are assigned to Richard Parslow and match the register above. This satisfies administrative ownership/tracking only. #537/#538/#539 remain open until actual operator/human evidence lands; H-02, confirmed review dates, tester engagement, VA approval, and privacy sign-off remain pending. Application fixes, source tests, HTTP fallback success and mock account data cannot close any of these gates. The broader clinical/evidence program is not certified by these process records.
