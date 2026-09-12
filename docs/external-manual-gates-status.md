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

Repository-side work that is *not* blocked is complete:

- **Deliberate tri-state runtime mode.** `resolveVaReferenceMode()` in `src/lib/va/runtime-state.ts` is the single decision point and resolves exactly one of `disabled` / `sandbox` / `production`. `disabled` is the fail-closed default and also the outcome for any ambiguous or incomplete production selection.
- **Production access acknowledgement.** Production mode now additionally requires `VA_PRODUCTION_ACCESS_GRANTED=true`, separate from `VA_API_ENABLED`. This encodes the gate rule in code: no single mis-set variable can repoint the public reference surfaces at production or cause data to be labelled production-sourced. The variable is intentionally unset in every current environment.
- **No production material on a failed-closed selection.** When production fails closed, the loaded configuration carries sandbox endpoints and no production keys, so a caller that neglected to check `enabled` still cannot reach production. The `environment` field still reports the *requested* environment so a refused production selection stays visible.
- **Bounded caching and source-status reporting** are shared across the Forms, Benefits Reference Data (disability), service-branch, and accredited-representative datasets through `src/lib/va/reference-cache.ts`, with process-local state refused in production/distributed runtimes.
- **Forms Finder usage guidance** shipped in PR #288.

What remains, and cannot be done from the repository:

1. VA grants production API access;
2. production service-specific credentials are installed server-side;
3. production mode is deliberately enabled via the acknowledgement flag;
4. live production connectivity is objectively verified;
5. full CI, deployment readiness, and **live production reference checks** are run against that state.

Current objective production state: `https://secondary-condition-finder.vercel.app/va-reference` returns HTTP 200 and reports **Local catalog fallback** with VA access **disabled**. That is the correct, expected state until VA grants access.

Issue #189 remains a separate prerequisite gate for credentialed sandbox connectivity evidence.

## Completion boundary

The clinical evidence/remediation program can be repository-complete while #189, #195, and #287 remain externally pending. Those gates require evidence or an access grant outside the authority of an automated repository agent: #189 and #287 need real credentialed VA connectivity (sandbox and, for #287, a VA production access grant plus live production verification), and #195 needs human keyboard, assistive-technology, zoom/reflow, contrast, and forced-colors testing with reviewer sign-off. Keeping them open is the correct completed automation state until the required external/human actions occur.
