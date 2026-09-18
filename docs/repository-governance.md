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
