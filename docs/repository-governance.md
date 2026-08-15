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

Production changes continue to use:

bounded branch from production-validated `main` → exact-head pull-request CI → immutable-head review → protected merge → independent `main` CI → exact Vercel deployment/canonical-alias verification → Production Runtime Readiness.

The post-push provenance check remains useful even after branch protection is enabled because it independently records that the production commit came through the reviewed-PR path.

## Verification

After any repository-governance change, verify all of the following before considering the gate closed:

- GitHub reports `main` as protected.
- The active rules for `main` include the four required controls above.
- `verify` is the required status-check context.
- No direct-push bypass defeats the pull-request requirement.
- A normal pull request still runs CI successfully.
- Independent `main` CI passes after merge, including both governance checks.
