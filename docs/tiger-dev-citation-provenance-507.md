# Tiger DEV — citation provenance reconciliation for 507 draft pathways

This stage extends the weekly clinical accuracy triage from merged PRs #672 and #673. It provides research metadata crosschecks, **not clinical approval**.

## Audited cohort

The pinned 819-condition / 875-pathway ledger flags **507 draft pathways** for source-registry and clinical-reference verification-status review. These have **1,311 reference links** and **1,128 distinct cited PubMed IDs**.

The read-only Tiger Cloud DEV research archive contains bibliographic metadata for **all 1,128 distinct cited PubMed IDs** in the flagged cohort. This is only a metadata-coverage finding; it does NOT prove that any publication supports its linked medical claim, correct direction of causation, aggravation or a claimant's individual VA nexus.

## Implementation and review boundaries

- A pinned, least-privilege DEV connection runs a read-only PubMed metadata export, storing only identifier and metadata status—no abstracts, private health records or secrets.
- The Python reconciliation checks original signed-off condition/pathway ledgers, all 875 source-to-claim packets, and current registry dispositions. It produces 507 immutable per-pathway reviews showing previously declared verification, registry active/pending state, bibliographic metadata coverage, and the exact original references.
- Every row is marked as requiring qualified-human source-to-claim review; all newly verified medical facts, clinical approvals, and Production changes remain **zero**.
- The weekly clinical accuracy workflow runs the exporter and verifier, then uploads the results as public-only research artifacts with SHA-256 manifests.
- A study title, citation match or previous verified flag is insufficient to establish that the study supports the exact proposition. A clinician/research reviewer must assess original study methods, population, limitations, directionality, alternative etiologies and claim wording.

## Reproduce

    python3 scripts/automation/stage_pinned_ontology.py
    python3 scripts/lib/build-clinical-review-ledger.py
    python3 scripts/automation/build_claim_review_packets.py
    node scripts/automation/citation-research-dev.mjs
    python3 scripts/automation/citation_provenance_reconcile.py --metadata-json /tmp/scf-clinical-accuracy-triage/citation-research-metadata.json
    python3 scripts/automation/citation_provenance_reconcile.py --verify
    python3 -m unittest discover -s tests -p 'test_citation_provenance_reconcile.py'

The Node command must execute in the authorized DEV environment using the existing encrypted database connection; never paste the credential or upload personal medical data. Output is under /tmp/scf-clinical-accuracy-triage/citation-review. Trial-credit spending should be tied to validation quality, not idle compute.
