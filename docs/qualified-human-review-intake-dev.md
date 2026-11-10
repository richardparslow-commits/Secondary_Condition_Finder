# Qualified-human clinical study review intake — Tiger Cloud DEV only

**Implementation scope:** authenticated preliminary study-screening receipts only, never an automated medical finding, individual VA nexus opinion or Production publication grant. The 21 published-condition pathways and their 244 distinct PubMed candidates (249 source-to-claim study links at the November 9 run) remain NOT_ASSESSED until independently reviewed.

## Trust boundaries

- A candidate study match from PubMed does not prove support, contradiction, causation, aggravation, clinical validity or veteran-specific nexus.
- The repository's weekly research automation does **not** acquire reviewer credentials. Its existing scf_evidence_ci_writer role has no access to private reviewer registry, receipts or submission function.
- Qualified reviewers are **not** created automatically. A DBA independently validates a real person's qualifications, identity and approval scope before provisioning a distinct named PostgreSQL login. The login is tied to an ACTIVE private qualified_reviewers row, verified attestor, verification timestamp, credential expiry and an attestation reference. The login must be enrolled in the isolated NOLOGIN scf_dev_qualified_reviewers role. No shared reviewer accounts.
- The security-definer database function derives review author, qualifications and qualification attestor exclusively from the database registry and the authenticated session_user. Review-file claims of identity, medical license, authority, individual VA nexus or Production approval are rejected by the local input allowlist.
- The reviewer role is allowed schema USAGE plus EXECUTE on one narrowly scoped intake function. It has no direct SELECT/INSERT/UPDATE/DELETE on qualified_human_reviews, qualified_review_receipt_audit or qualified_reviewers. All accepted reviews and their submission-hash attestations are append-only; the function never changes medical mappings.
- Source-to-claim links and incoming evidence are checked against the immutable research run. The function rejects missing sources, a reviewer who is not independently activated, expired credentials, malformed supporting/conflicting study references and unsupported dispositions. No automated reviewer records or fake clinical approvals are generated.

## One-time DEV-only gate bootstrap (already tested)

Use the approved Tiger DEV service m8vrpmo6ec and the existing authorized administrator's local Tiger CLI. From the repository root:

    node scripts/automation/reviewer-intake-dev.mjs setup-gates --dev-write
    node scripts/automation/reviewer-intake-dev.mjs audit-gates

Bootstrap runs in one DEV database transaction and creates the private reviewer registry, append-only receipt audit, NOLOGIN execution group and protected function. It creates **no individual reviewer login or qualification entry**. PostgreSQL may automatically add the creating database administrator as a group manager; that administrator still cannot submit as a reviewer because the function requires a distinct named reviewer login and verified registry identity. The audit fails if any other group member lacks a currently active, independently verified registry entry. The audit returns counts only, not reviewer names or medical opinions. It fails if the automated research writer can read private review data or invoke the submission function. No Production credentials are accepted.

## Qualification and credential onboarding — explicit human action still required

Before allowing any real reviewer submission, a designated organization administrator must independently check the individual's professional identity, credentials, applicable clinical scope, conflicts and permitted evidence-review role. Record the name/identifier, qualifications, verification authority/time, attestation reference, expiry and ACTIVE status in the **private** Tiger DEV registry. Provision one individual, unique PostgreSQL LOGIN whose name starts with scf_review_ and assign membership only in the NOLOGIN scf_dev_qualified_reviewers group. Set a strong credential using a password manager or interactive secure administration, never through pasted chat, GitHub, a PR, CI logs, public artifacts or a command-history literal. Do not grant administrator or research-writer roles to that login. The database rejects any reviewer login with superuser, role-creation, database-creation, replication or RLS-bypass privileges, even if mistakenly added to the reviewer group.

Do not enroll a reviewer until those manual qualification checks are completed. The current bootstrapped installation has **zero** reviewer accounts, **zero** active qualified reviewers and **zero** clinical receipts. It is correctly fail-closed without a qualified individual.

For immediate revocation, the DBA should disable the reviewer's login and mark their private registry row REVOKED with a revocation timestamp. Historical receipts are retained for audit and are not silently rewritten. Any later change in clinical assessment must be submitted as a new, separately attributable receipt.

## Local, private receipt format and validation

The intake document has exactly these fields: schemaVersion (1), scope (QUALIFIED_HUMAN_STUDY_SCREENING_DEV_ONLY), runId (research SHA-256), sourceId, targetId, candidatePmid, reviewedAt (UTC ISO 8601), clinicalDisposition, studyDesignPopulation, causalDirectionLimits, confoundersAndMediation, supportingEvidence, unresolvedContradictions, fullTextAccessBasis, reviewerRationale and submissionSha256.

Evidence arrays contain at most 12 entries each. Each entry has only PMID and a 12–2000 character assessment; never copy original abstracts, copyrighted full texts, patient-specific data or medical records. The evidence options are NEEDS_MORE_EVIDENCE, INSUFFICIENT_EVIDENCE, POTENTIAL_SUPPORT, POTENTIAL_CONTRADICTION and MIXED_OR_CONFLICTED. Potential support requires a supporting source; potential contradiction requires a contradictory source; mixed requires both. These are preliminary **screening dispositions** and remain separated from validated clinical mapping changes.

The submissionSha256 is an integrity checksum over the canonical receipt minus the checksum field. It is **not** a digital signature and cannot itself establish reviewer identity or expertise. A reviewer should create it locally using the canonical sha helper on their unsigned JSON, then validate using:

    node scripts/automation/reviewer-intake-dev.mjs validate /private/path/review.json

Only after a named, verified reviewer has been provisioned should they connect using a separately protected DEV connection string supplied as TIGER_QUALIFIED_REVIEW_DEV_URL. The reviewer runs:

    node scripts/automation/reviewer-intake-dev.mjs submit /private/path/review.json --dev-write

The submit path verifies the pinned DEV host, port, database, TLS, and named reviewer login. The database function checks that the independently verified registry entry is ACTIVE and not expired; it binds evidence parameters rather than interpolating user content into SQL. It returns only a private review receipt ID and checksum, NOT a clinical approval. Do not retry a submission after an ambiguous connection failure without a secure administrative audit; the DB may have committed.

## Operations and separation of duties

The weekly protected GitHub Actions workflow continues collecting research **without** reviewer credentials or direct receipt writes. CI runs synthetic negative-access and receipt-validation tests only. The reviewer login cannot modify research snapshots or Production. The qualified review function cannot change Production or even mark a DEV mapping as VERIFIED; a separate human clinical adjudication and separate reviewed Production PR are still required.

Current state is development infrastructure **ready for onboarding only**, not an operational claim of a qualified medical reviewer having examined the 249 candidate-study entries.
