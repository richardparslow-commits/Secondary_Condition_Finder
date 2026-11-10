# Qualified-human clinical study-review intake — Tiger Cloud DEV

**Status:** DEV-only intake gate installed, with no reviewer enrolled and no human dispositions recorded. This is not a medical verification or Production publication system.

## Authenticated boundaries

The approved Tiger Cloud DEV service is `m8vrpmo6ec`, database `tsdb` on the pinned direct endpoint. The existing weekly research automation continues to access only immutable bibliography/candidate tables. It is **never** given the new reviewer connection string or permission to execute the private review procedure. The private table remains append-only.

The new intake uses the database-authenticated `SESSION_USER` identity, not user-submitted reviewer names or credentials. Each reviewer must have an individually authenticated, non-admin `scf_review_*` login and a separate, current, credential-verified enrollment in `scf_candidate_review_dev.reviewer_authorizations`. The credential verifier must be a distinct person. Expired and revoked enrollments are denied. Reviewer enrollment and revocation are independently logged in the private append-only authorization audit table.

**No reviewer accounts or authorization records are created by this code or by GitHub Actions.** A trusted database administrator must verify a professional credential independently against its issuing registry, confirm professional scope, establish the reviewer's identity, confirm current good standing, and record the reviewer authorization before any function execute permission is granted. Do not treat self-declared credentials or an unverified email address as verification.

## Database deployment (DEV only)

The admin setup is an explicit transaction. It adds `reviewer_authorizations`, `reviewer_authorization_events`, and the restricted `submit_qualified_review(jsonb)` security-definer procedure, plus a unique submission ID on the existing receipt table. No Production schemas or services are referenced.

From the checked-out repository on the authorized Mac, with the verified Tiger CLI connection:

```sh
node --test tests/qualified-review-intake-dev.test.mjs
node scripts/automation/qualified-review-intake-dev.mjs setup --dev-write
```

The expected result is `DEV_QUALIFIED_REVIEW_INTAKE_LOCKED_UNTIL_ADMIN_ENROLLMENT`. Verify that the `PUBLIC` and `scf_evidence_ci_writer` function EXECUTE privileges are both **false**, the authorization roster has zero rows until a real clinician is vetted, and the existing review receipts remain zero. Database permissions must never be expanded merely to make a demonstration pass.

## Separately authorized reviewer enrollment (future manual gate)

Only after independent identity and credential verification may the DEV database administrator (1) provision a distinct non-superuser login using approved credential handling; (2) insert its exact database login and verified professional qualification, credential issuer/reference, independent verifier, verification time and expiry into the private `reviewer_authorizations` table; (3) grant that **one login** schema `USAGE` and function `EXECUTE` for `scf_candidate_review_dev.submit_qualified_review(jsonb)`; (4) confirm it has **no** direct `SELECT`, `INSERT`, `UPDATE`, or `DELETE` permissions on private research or human-review tables. Do not grant privileges to the CI writer, PUBLIC, or a shared reviewer account.

Enrollment is intentionally not automated. Revocation must set `revoked_at` in the private roster and revoke that login's function EXECUTE privilege. The trigger rejects deletions, replacing a prior credential, or reversing a revocation. Re-verification requires a new account and independent authorization record. Rotate reviewer credentials through the approved secrets manager, never in chat, source, commits or CI logs.

## Human review intake format

An individual reviewer prepares a local JSON request with exactly these 15 fields: `submissionId` (new UUIDv4), `runId` (immutable research SHA-256), `sourceId`, `targetId`, `candidatePmid`, `reviewedAt` (timezone-aware timestamp), `clinicalDisposition`, `studyDesignPopulation`, `causalDirectionLimits`, `confoundersAndMediation`, `supportingEvidence`, `unresolvedContradictions`, `fullTextAccessBasis`, `reviewerRationale`, `correctionNoticeDisposition`.

`supportingEvidence` contains 1–20 small objects with only `pmid` and `assessment`, including the **exact candidate PMID** under examination. `assessment` is one of `POTENTIAL_SUPPORT`, `POTENTIAL_CONTRADICTION`, `CONTEXT_ONLY`, or `INSUFFICIENT_FOR_CLAIM`. `unresolvedContradictions` contains 0–20 objects with only `pmid` and `issue`; contradiction/mixed dispositions must provide at least one cited unresolved issue. `correctionNoticeDisposition` is `REVIEWED`, `REQUIRES_FOLLOW_UP` or `NOT_APPLICABLE`; a publication bearing a linked correction or retraction notice cannot be marked `NOT_APPLICABLE`.

Only preliminary study dispositions are accepted: `NEEDS_MORE_EVIDENCE`, `INSUFFICIENT_EVIDENCE`, `POTENTIAL_SUPPORT`, `POTENTIAL_CONTRADICTION`, `MIXED_OR_CONFLICTED`. There is **no** `VERIFIED`, service-connection, individual VA nexus, medical causality approval or Production-publish disposition.

Locally validate a reviewer-authored file **before** attempting a credentialed submission:

```sh
node scripts/automation/qualified-review-intake-dev.mjs validate /private/review.json
```

After their separate credentials and DBA authorization are in place, the human reviewer provides `SCF_QUALIFIED_REVIEWER_DEV_URL` through a private, local credential manager and personally invokes:

```sh
node scripts/automation/qualified-review-intake-dev.mjs submit /private/review.json --qualified-human-submit
```

The CLI rejects the research-automation user, database administrator login, missing/incorrect TLS, or any non-DEV host; the security-definer function independently checks the **real PostgreSQL login**, trusted authorization record, exact immutable study lineage, bounded evidence arrays, source correction notice, and preliminary disposition. The function stores an append-only private receipt and returns only a receipt ID. An accidental resubmission of the same UUID is rejected by a unique index; a legitimate corrected review is a new audited receipt, not an edit.

**Data minimization:** Do not include patient details, identifiers, clinical records, source article abstracts, copyrighted full texts, or confidential credentials in any reviewer narrative. Store only aggregate study-design observations and citation IDs needed to explain source-to-claim limitations. Separate qualified reviewers must still inspect the actual full text and relevant corrections. The tool does not automatically authenticate medical licensing against external registries and cannot independently decide whether evidence establishes causation or aggravation.

## Automation and release gates

GitHub Actions runs **only** offline intake security tests. It never supplies a reviewer credential or runs the `submit` mode. The existing DEV PubMed ingestion and parity checks remain research-only. Independent clinical verification, individual VA nexus decisions, ontology promotions and Production publication remain outside this phase and require separate substantive clinical review and explicit release approval.
