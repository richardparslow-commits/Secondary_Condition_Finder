# Repository governance

## Production branch policy

`main` is the production-lineage branch. The preventive control is an **active branch ruleset** in GitHub repository settings targeting the default branch.

The ruleset must enforce:

- **Require a pull request before merging.** Direct pushes to `main` are not part of the supported production workflow.
- **Require status checks to pass before merging**, with the GitHub Actions job **`verify`** required.
- **Block force pushes.** Approved history must not be replaceable by a force update.
- **Block deletion.** The production branch must not be deletable through an ordinary branch update.
- No always-allow bypass may permit routine direct pushes to `main`. If an emergency admin bypass is retained, it should be limited to pull-request use rather than direct pushes.

A required approving review is appropriate when a genuinely independent reviewer is available. It is not a substitute for the PR and CI requirements above.

## Defense in depth

`.github/workflows/ci.yml` keeps two repository-governance checks on successful `main` lineage:

1. **Merged-PR provenance:** the `main` commit must be associated with a merged pull request targeting `main`.
2. **Active-rule drift check:** GitHub must report `main` protected and the active rules applying to it must include `pull_request`, `required_status_checks` with context `verify`, `non_fast_forward`, and `deletion`.

The CI drift check **does not replace the GitHub ruleset**. CI runs after GitHub has accepted a ref update; only repository rules can reject a noncompliant push before it changes `main`.

## Change workflow

Production changes use:

bounded branch from production-validated `main` → exact-head pull-request CI → **Vercel Agent immutable-head review** → protected merge → independent `main` CI → exact Vercel deployment/canonical-alias verification → Production Runtime Readiness.

The Vercel Agent review is a distinct governance gate from deployment. A Vercel preview/deployment reporting `Ready` or a generic Vercel commit status does **not** satisfy the review gate. The pull request must contain an actual Vercel Agent code-review result for the exact head being merged, whether generated automatically or requested with `@vercel run a review`.

All actionable Vercel Agent findings must be resolved before merge. If resolving a finding changes the pull-request head, the prior exact-head CI and Vercel Agent review are stale; the new head must pass CI and receive a new Vercel Agent review before protected merge. Expected-head protection remains mandatory so the reviewed SHA is the SHA that is merged.

The post-push provenance check remains useful even after branch protection is enabled because it independently records that the production commit came through the reviewed-PR path.

## Local checkout placement

The working copy **must not** live inside a folder-sync root — iCloud Drive's `Desktop` and `Documents`, Dropbox, OneDrive, or Google Drive. Those clients upload the whole tree, and a client that materializes a second copy of a file it sees mid-write leaves `<name> 2.<ext>` beside the original.

Those copies are not cosmetic. They are real files: TypeScript typechecks them, ESLint lints them, and any test that derives its expectations from the tree treats a copy as a new module. Inside `.git` the same fork is corruption rather than duplication — a forked `.git/index` is invisible to every verification step, because git never reads it, so `git fsck` and `git status` both report a clean checkout that nonetheless carries index snapshots from earlier states.

Two rules follow:

1. **Keep the checkout outside every sync root.** Relocating a synced checkout may require copying out and then deleting the original: a same-volume rename *out* of an iCloud-managed folder can fail outright (`Operation timed out`, then `Stale NFS file handle`) while unlink succeeds. Verify the destination before retiring the source — every tracked file byte-for-byte, plus the untracked and git-ignored payload a clone would not carry, such as `.env.local` and `public/`.
2. **Treat a forked path name as a defect to remove, not noise to route around.** `tests/checkout-fork-hygiene.test.ts` fails on any path carrying a forking suffix, naming each one, and scans `.git` as well as source.

## Verification

After any repository-governance change, verify all of the following before considering the gate closed:

- GitHub reports `main` as protected.
- The active rules for `main` include the four required controls above.
- `verify` is the required status-check context.
- No direct-push bypass defeats the pull-request requirement.
- A normal pull request still runs CI successfully.
- The exact PR head receives a real Vercel Agent code-review result; deployment readiness alone is insufficient.
- Any head change after review triggers fresh exact-head CI and a fresh Vercel Agent review.
- Independent `main` CI passes after merge, including both governance checks.

## CI failure escalation

`.github/workflows/ci-to-clickup.yml` turns a genuine CI failure into a tracked ClickUp task. All escalation policy lives in `scripts/ci-failure-report.js`, covered by `tests/ci-failure-report.test.ts`; the workflow itself only collects run metadata and calls `npm run ci:failure-report`. Policy changes belong in the script and its tests, not in inline shell — an untestable notifier that only runs when something else has already broken is how this workflow previously went its whole life without ever succeeding.

Escalation rules:

- **Escalated:** `failure`, `timed_out`, `startup_failure`, and any conclusion this repository does not recognize. An unknown conclusion is escalated rather than assumed benign, because a lost alert is worse than a duplicate task.
- **Not escalated:** `cancelled`. `.github/workflows/ci.yml` sets `cancel-in-progress: true` per ref, so a superseding push routinely cancels the run already in flight. That is branch hygiene, not a broken build, and the superseding run escalates itself if it genuinely fails. Filing tasks for superseded runs points humans at good code and trains the queue to be ignored. A cancelled run still reaches the reporter so the skip is logged with its reason instead of passing silently. `tests/ci-failure-report.test.ts` pins this exemption to the `cancel-in-progress` setting that justifies it, so removing that setting forces the exemption to be re-examined.
- **Not escalated:** `success`, `skipped`, `neutral`, `stale`, `action_required`.

Outcome semantics keep a configuration gap distinguishable from a lost alert:

| Situation | Outcome |
| --- | --- |
| Required secrets absent | Warns, records the gap in the job summary, exits successfully — a misconfigured notifier must not masquerade as a CI failure |
| Same commit, conclusion and failed jobs already escalated | Suppressed as a duplicate; the existing task tracks it |
| Duplicate lookup errors | Fails open and creates the task anyway |
| Transport error, `429`, or `5xx` | Retried with backoff, up to a bounded attempt cap |
| Configured notifier cannot deliver | Exits non-zero, because a real alert was lost |

Task bodies are metadata-only. Diagnostic logs and error excerpts stay in GitHub Actions and are not copied into a third-party tracker.

### Required configuration

Escalation is **disabled** until both repository secrets exist:

- `CLICKUP_API_TOKEN`
- `CLICKUP_LIST_ID`

Until they are set, CI failures are not posted anywhere and the notifier job emits a warning saying so. Supplying them is a human action in repository settings; no code change can do it.

### Security constraint

The workflow runs on `workflow_run`, so it can read repository secrets. It must check out the default branch and must **never** check out `github.event.workflow_run.head_sha` or `head_branch`: doing so would execute code from an untrusted pull request with `CLICKUP_API_TOKEN` in its environment. The triggering head SHA is consumed as task metadata only. `tests/ci-failure-report.test.ts` pins this.
