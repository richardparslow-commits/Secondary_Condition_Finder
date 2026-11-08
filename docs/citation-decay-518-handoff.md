# Citation decay #518 — local continuation and review handoff

Date: 2026-10-11. Base revision: `b9ae48be` on `fix/citation-decay-518-digest-exemptions`.
Status: **code repair complete locally; #518 remains open pending qualified-human decisions**.
No commit, push, PR, workflow dispatch, deployment, enablement change, or issue mutation was performed.

## Where Cline stopped

The screenshot shows Cline reading the counter/retirement boundary in
`scripts/audit-citation-verification.js`. On disk it had added imports and digest
counters, but no classification, findings, or report fields in that offline CLI.
It had also drafted a digest-exemption register/helper, modified the decay probe,
and added three test suites plus fixtures. Those changes were retained and reviewed.

The read-only GitHub issue lookup confirmed #518 reported **398/398** verified
references without digests against a **383** ratchet, with no detected link rot,
content drift, or stale references. It was an observability/structural failure,
not proof that 398 citations had changed. The workflow omitted structural reasons
from the issue, which made its all-zero decay metrics misleading.

## Repair delivered

- Both `npm run citations:audit` (offline, existing PR gate) and
  `npm run citations:decay` enforce the same actionable digest-debt ratchet.
- Register validation rejects invalid reasons/patterns, impossible sample counts,
  invalid/mismatched sample URLs, duplicate identifiers, invalid HTTP samples,
  and invalid approval metadata. Unsupported register versions grant no exemptions.
- Invalid, rejected, pending, future-dated, or expired entries do **not** waive debt.
  Active exemptions need a named qualified-human reviewer and a real approval date.
- HTTP 203/challenge responses are unverifiable, not healthy sources or drift.
  GET redirects are followed within the existing redirect budget. Missing/truncated
  bodies are not compared as if they were complete. Existing timeout, concurrency,
  per-host spacing, retry, download, and redirect limits remain bounded.
- The workflow publishes structural reasons, actionable worklists, approved and
  pending exemption populations, and observed-live probe coverage. Its failure
  branch now reaches the summary under GitHub's `bash -e -o pipefail` while
  preserving the probe's exit status. Fixture execution tests exercise both the
  summary and tracking-issue command without contacting/mutating GitHub.

## Current data posture — intentionally not green

The three register entries carried from Cline remain
`pending-qualified-human`; their measurements have **not** been independently
re-collected in this continuation and are not treated as accepted policy.

| Population | References |
| --- | ---: |
| Live verified references | 398 |
| Recorded content digests / real drift coverage | 0 / 0% |
| Approved exemptions | 0 |
| Proposed exemption matches, still debt | 394 |
| Debt without a proposed exemption (Cornell CFR) | 4 |
| Total undigested actionable debt until approval | 398 |
| Proposed actionable-debt ratchet | 4 |

The proposed change from a 383 total-undigested pin to a 4 actionable-undigested
pin is a **denominator/policy change**, not retirement of 394 digests or improved
coverage. Both audits deliberately fail until that policy is approved; raising
the old ceiling or silently applying pending exemptions would hide the problem.

## Qualified-human work required

Prepared review materials: [unsigned #518 review packet](citation-decay-518-review-packet.md)
and [source-bound input snapshot](citation-decay-518-review-inputs.json). They contain
three exemption worksheets, four exact Cornell reference-use worksheets, and a
separate ratchet-policy question. No approvals or new source checks are recorded.

1. Review/reproduce the three transport measurements in
   [the proposed register](../data/citation-digest-exemptions.json). Decide whether
   their patterns are sufficiently narrow and whether the exemption policy is
   acceptable. A bot-blocked automated client does not establish that a human
   can never capture a stable source. Record genuine approval metadata only after
   this decision. Do not bulk-approve the file merely to turn CI green.
2. Re-verify the four Cornell CFR uses under [the SOP](citation-verification-sop.md),
   then capture digests with new genuine check dates, or document a supported
   withdrawal. The offline report's `actionableUndigested` array identifies their
   exact mappings/targets. No digest or source date was backfilled here.
3. Consider a separately reviewed PubMed XML anchor for future human verification.
   The existing probe hashes `sourceUrl`: attaching an E-utilities XML hash to a
   PubMed HTML URL would be wrong. The register's alternative is a lead, not an
   implemented alternate-anchor schema or verified citation.
4. After approval/remediation, lower the actionable pin as appropriate and run the
   full live probe on the reviewed tree. Retain its JSON, inspect blocked-source
   coverage, and obtain maintainer review before closing #518. A green structural
   audit still does not mean automated clinical verification or Section 508/VA
   production approval.

## Local verification evidence

The executable tests include temporary-corpus CLI runs proving that:

- the actual pending register fails (exit 1, 398 debt / 394 pending);
- synthetic approved exemptions **only in a disposable test copy** reduce debt
  to four and pass the offline audit;
- one added actionable verified source raises debt to five and fails;
- an unsupported register version grants no waiver;
- actual loopback HTTP challenge/redirect/dead/oversized response behavior is correct;
- the workflow writes structural reasons on a probe failure under `bash -e` and
  produces the tracking issue body with a fake `gh`, never a real write.

Checks on the final edited code: 124 focused citation/workflow tests, typecheck,
touched-file ESLint, 153 documentation tests, KB validation, and PHI audit
(254 files / zero violations) passed. The full suite returned exit 1:
2,903 passed / 11 failed. Nine failures invoke the now-failing citation CLI and
remain blocked by the explicit human approval gate; their assertions were not
weakened. Two failures identified that adding the register changed the pending
catalog-admission data fingerprint. The existing pending review was regenerated
through `prepareAdmission`, retaining its unchanged proposal, pending outcome,
and no candidate/publication/verification approval; its 12-test suite then passed.

The full 1,487-URL `citations:decay` network scan was not run in this continuation;
HTTP behavior was tested against a real loopback fixture server. No independent
live re-measurement or qualified-human citation review is claimed. The corpus,
source verification states/check dates, and retirement provenance were not changed.

## 2026-11-08 integration update

The PR is refreshed onto current main. Its measured-class register, five-use
eligible ratchet, throttling/retry handling and issue-close path are preserved
independently of the proposed approval-gated exemptions. The unsigned input
bindings now include the measured-class register; no approval, live measurement,
source-check date, digest or reference-use inventory was changed.

The publishing token cannot modify GitHub Actions workflows. The scheduled
workflow failure-reporting additions and their execution regression are therefore
excluded from the published commit and supplied as a separate patch for a
maintainer to apply. Until that patch lands, the CLI JSON exposes the added debt
and structural-reason fields, but the scheduled workflow does not yet display
those new fields or preserve its step summary after an exit-1 probe. Required
PR checks retain current main's workflow definitions and names.

Qualified-human review remains mandatory; this integration is not approval and
must not be used to bypass the failing citation audit.
