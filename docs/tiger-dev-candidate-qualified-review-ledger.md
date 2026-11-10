# Tiger Cloud DEV: immutable candidate research and qualified-reviewer receipt ledger

**Scope: development research only.** Extends PR #677's 21 original published pathways and 244 official PubMed IDs (249 links in the verified November 9 run). It never changes medical mappings, VA nexus logic, or Production.

## Stored data and provenance

Existing protected Tiger DEV service: m8vrpmo6ec. New isolated schema: scf_candidate_review_dev. Each research snapshot is keyed to the SHA-256 of the current checked candidate-metadata.json and the original 21-pathway source ledger.

- runs: snapshot SHA, source search SHA, exact publication/link counts, approval state permanently NOT_GRANTED.
- publications: one immutable official PubMed record per PMID per run; bibliographic metadata, correction flags, and no clinical approvals.
- case_candidates: original source, target, candidate PMID, original cited PMID, rank and operational P1/P2/P3 document-review priority. The state always remains PENDING_QUALIFIED_REVIEW and NOT_ASSESSED.
- qualified_human_reviews: a **private append-only receipt ledger** reserved for a separately authorized clinical reviewer. It has fields for reviewer identifier and qualifications, credential attestation, review date, full-text access, study design, populations, causal-direction limits, confounders and medication/procedure mediation, supporting evidence array, unresolved contradictions array, rationale, and preliminary potential clinical disposition.

Permitted human dispositions in DEV are NEEDS_MORE_EVIDENCE, INSUFFICIENT_EVIDENCE, POTENTIAL_SUPPORT, POTENTIAL_CONTRADICTION and MIXED_OR_CONFLICTED. These are preliminary review dispositions, NOT medical verification or permission to publish, and not individual VA service-connection determinations.

There is no automated reviewer decision submission. The existing GitHub Actions role scf_evidence_ci_writer has SELECT and INSERT only on the first three research tables, **no permission to SELECT or INSERT into qualified_human_reviews**. No reviewer credentials or private review receipts are put into public GitHub artifacts. A separate DBA-authorized, verified qualified-reviewer login would be required for human evidence submission later. The receipt table also has a trigger that prohibits UPDATE/DELETE.

Research inserts are additive, transaction-scoped and idempotent. Independent verification uses BEGIN READ ONLY and verifies every expected exact row, not merely counts. Changed, missing, extra or unauthorized rows cause a failure.

## Isolated DEV bootstrap — authorized operator only

1. Use an authorized Mac with the existing approved DEV-only Tiger connection. Do not paste or print any credentials.
2. Obtain the current verified candidate-metadata.json from a successful main-branch clinical research artifact.
3. With the repository checked out, execute the one-time DEV-only command:

    SCF_CANDIDATE_METADATA_FILE=/absolute/path/to/candidate-metadata.json node scripts/automation/candidate-review-tiger-dev.mjs setup --dev-write

The setup mode requires the pinned existing DEV service/host/port/database, and existing DEV tsdbadmin rights solely for the schema/grants. There is NO administrator fallback in the weekly automated apply/verify modes. Run those with the protected TIGER_AUTOMATION_DEV_URL secret on the GitHub Actions DEV environment. Never put a database connection string into the PR, logs, or chat.

The protected main-only weekly workflow runs apply --dev-write using the existing least-privilege writer, then verifies every official PubMed record and original pathway-to-PMID link in an independent read-only transaction. If the schema or role is missing or changed, the workflow fails closed and does not publish any clinical content.

Expected result fields: reviewReceiptWrites = 0, clinicalApprovals = 0, productionChanges = 0.

## Human clinical decision gate (separate, future approval)

A qualified reviewer must inspect full text and corrections, establish professional authorization, document causal direction and competing explanations, examine study design, population and medication/procedure mediation, and explicitly record unresolved contradicting studies. The DBA must independently authorize any restricted reviewer role and human evidence intake.

A separate clinical governance review and separate Production PR would still be required before any published medical mapping correction. Research indexing or a preliminary human receipt is not a medical diagnosis, individual causation determination, VA nexus opinion or approval to publish.

No new paid service, no production database connection, no private medical records, and no abstracts or full texts in the snapshot.
