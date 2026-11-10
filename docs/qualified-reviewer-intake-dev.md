# DEV-qualified medical evidence reviewer intake — authentication gate

**Scope: DEV only; no clinical verification or Production publication.** This workflow adds the ability to receive a qualified human's preliminary bibliographic source-screening receipt under a *separately authenticated* database identity. It does **not** submit any receipt automatically, create an individual reviewer login, grant a user access, adjudicate medical causation/aggravation, or modify the public application.

## Two independent actors

The existing `scf_evidence_ci_writer` continues periodic official PubMed research indexing and parity checks. It has no read or write rights to the private human-review records.

A distinct `scf_qualified_review_submitter` **NOLOGIN** PostgreSQL role is reserved for review receipts. A DEV DBA must independently verify each professional's identity, relevant qualifications, clinical source-screening scope, and attesting officer, then provision a dedicated `scf_reviewer_...` login with a privately delivered strong credential and **explicit SET ROLE membership**. No accounts or member grants are created by this PR. The DBA independently inserts the verified matching registry entry into `scf_candidate_review_dev.reviewer_authorizations`, with an explicit finite `valid_until` and `is_active=true` only after verification. Account registration is **not** equivalent to clinical approval.

The review INSERT trigger derives the original PostgreSQL authenticated `session_user`, checks the named group-role membership, checks active and unexpired DBA-only credential registry, and requires receipt identity, qualifications, and qualification attestor to match that registry. The reviewer role cannot directly SELECT private receipts or authorizations; it may INSERT a preliminary receipt only. Every receipt must refer to an existing exact research source→target→candidate PMID and immutable research snapshot through an existing foreign key. No arbitrary claim can be introduced. Any incorrect user, inactive registry, expired credential, missing permission, unsupported study key, or malformed receipt **fails closed**.

## DEV one-time bootstrap

After PR review/CI passes, an authorized DEV administrator executes this exact command, from a checked-out verified branch or merged `main`:

```sh
node scripts/automation/qualified-reviewer-intake-dev.mjs setup --dev-write
```

The command verifies the existing pinned DEV service and database only. It creates the group role as **NOLOGIN**, a private DBA-controlled authorization registry, a SHA-256 unique digest/append-only receipt guard, and the authenticated INSERT trigger. It grants group role INSERT but creates **no login**, enrolls **no reviewer**, and submits **no receipt**. It verifies the existing receipt count is zero before changing the schema. It does not create new Tiger Cloud services or interact with Production.

The assigned DBA must independently handle enrollment and revocation; do not paste connection strings, passwords, personal identity records, or private credential data into ChatGPT, GitHub, Actions artifacts, CI, or issues. Do **not** reuse the automation writer login or `tsdbadmin` for a human receipt.

## Private reviewer draft and human submission

Human reviewers inspect the original study, full text, corrections/retractions, causal direction, population, study design, confounders, medication/procedure mediation, alternative explanations, and conflicting evidence. The workflow records **preliminary** `POTENTIAL_SUPPORT`, `POTENTIAL_CONTRADICTION`, `MIXED_OR_CONFLICTED`, `INSUFFICIENT_EVIDENCE`, or `NEEDS_MORE_EVIDENCE`, not a final medical finding.

The review document uses exactly these fields: `schemaVersion=1`, `runId`, `sourceId`, `targetId`, `candidatePmid`, `reviewerIdentifier`, `reviewerQualification`, `qualificationVerifiedBy`, `reviewedAt` (timezone-aware), `clinicalDisposition`, `studyDesignPopulation`, `causalDirectionLimits`, `confoundersAndMediation`, `supportingEvidence`, `unresolvedContradictions`, `fullTextAccessBasis`, `reviewerRationale`, and `productionPublicationState="NOT_GRANTED"`. Each evidence item is `{"pmid":"12345678","note":"Non-identifying source-specific reasoning"}`; no claimant identifier, sensitive health records, medication list specific to a person, copied abstract, or full-text material belongs in this workflow.

The reviewer creates the unsigned JSON draft **locally**, then performs:

```sh
node scripts/automation/qualified-reviewer-intake-dev.mjs seal draft.json receipt.json
node scripts/automation/qualified-reviewer-intake-dev.mjs validate receipt.json
```

The `seal` command creates a **new** 0600-permission local output with its deterministic receipt SHA-256; it refuses to overwrite existing files. The digest is an integrity identifier **not a cryptographic proof of reviewer identity**; identity is authenticated separately by PostgreSQL and the DBA-only registry.

Only after the DBA has provisioned and attested the reviewer's dedicated role, the reviewer privately installs their DEV-only connection URL into local `SCF_QUALIFIED_REVIEW_DEV_URL` (never in shell history or shared messages). The URL is pinned to the approved Tiger Cloud DEV hostname/port/database and must require TLS. The reviewer explicitly submits the sealed record:

```sh
node scripts/automation/qualified-reviewer-intake-dev.mjs submit --dev-write receipt.json
```

The server authenticates the person's original login, requires an explicit SET ROLE and verified unexpired enrollment, and records a single append-only private receipt. It does not publish or change the `case_candidates` research rows. Attempted replay of an identical receipt fails its unique SHA constraint. Revisions require a **new** reviewed, justified receipt; existing records cannot be edited or deleted via the trigger. The CLI intentionally returns only receipt digest/status, not private reviewer names or narratives, and suppresses raw DB errors.

## Separate clinical adjudication and Production gate

A qualified person's preliminary receipt is **not** automatically a medical truth determination, individual service-connection nexus opinion, or approval for Production publication. The existing 21 high-priority source paths and 249 alternative study links still require medically appropriate review of source content, exact support/contradiction, directionality, study quality and patient-specific applicability. A different authorized adjudicator, clinical governance sign-off, source reconciliation, and separate reviewed Production PR are required before any mapping status change.

**Security boundaries:** no patient data, no automated review submissions, no registered users in this phase, no review exports to GitHub, no database admin credentials in the new intake path, no permission to update research row states, no Production credentials or writes. Additional legal/compliance privacy assessment is required before ever introducing patient-specific clinical records.
