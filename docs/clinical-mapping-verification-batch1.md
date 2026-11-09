# Clinical Mapping Verification — Batch 1 (Tiger Cloud DEV)

**Status:** Complete initial automated contradiction screening and versioned full-review ledger. **No condition identity, secondary pathway, citation verification flag, or production recommendation was changed.** Batch 1 records potential issues for qualified-human review; it does **not** clinically verify mapping accuracy.

## Exact scope and inputs

- Repository main reference: merge of PR #663, commit `30e630ff4206a7282ab8207dc20703b22442ea21`.
- Existing authored catalog: 819 distinct condition IDs, each with a corresponding `data/knowledge-base/*.json` entry.
- Existing secondary-condition mapping: 875 directed ranked authored edges; 248 from published mappings, rest from draft mappings.
- Existing cited source-reference links: 1,704. Source metadata is *declared*, not independently checked here.
- Ontology import: pinned full MONDO v2026-10-06 audit, SHA256 snapshot `a165dc2fc61761f5e5413b6395dd4afb14c89d78783af213a9b8f1d0a3f2a8c7`. The builder checks release manifest and candidate/audit CSV content digests before doing any work. 444 unique lexical candidates, 51 ambiguous, 324 without exact lexical candidate.
- The program consumes only public authored repository condition metadata and fixed ontology audit files. It never sends patient/claim data to external systems and contains no medical records.

## Batch 1 workflow

```sh
npm ci
npm run ontology:fetch:dev
npm run ontology:prepare:dev

# Deterministic, content-addressed, local-only public review snapshot
npm run clinical-review:build:dev

# Explicit schema/row writes to the preexisting Tiger Cloud DEV service only
npm run clinical-review:apply:dev

# Independent BEGIN READ ONLY, full-field comparison and provenance checks
npm run clinical-review:verify:dev

# Read-only Tiger Cloud dashboard and 30-item priority queue
npm run clinical-review:report:dev

# Fail-closed rule tests (not clinical validity tests)
npm run test:clinical-review:dev
```

If `ontology:fetch:dev` detects a hash mismatch, STOP. This pipeline requires the exact signed-off release. The source catalog or KB changing creates a different snapshot digest and must trigger a new review.

## Tiger Cloud isolation and exact validation

Service `secondary-condition-finder-test`, ID `m8vrpmo6ec`, is the only permitted DEV destination. The existing Tiger Cloud lab helper verifies READY, service ID/name, environment=DEV, endpoint and TLS. This module independently pins direct port 30902, host `m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com`, and database `tsdb`. The Tiger CLI safeguard `read_only: prod` remains in place.

Schema `scf_clinical_review_dev`:
- `runs`: immutable SHA256 review snapshot, ontology release, source catalog/KB/registry digests, frozen counts, compulsory `UNREVIEWED_ONLY` state.
- `conditions`: all condition IDs, titles, publication state, outgoing count, lexical ontology status/candidate IDs, per-row SHA256 and `HUMAN_IDENTITY_REVIEW_REQUIRED`.
- `pathways`: every directed edge, rank, publication state, authored classification/probability metadata, declared citation counts, source-review flags, per-row SHA256 and `HUMAN_CLINICAL_REVIEW_REQUIRED`.

This is entirely separate from the earlier ontology schema and public medical-reference schema. SQL uses bounded batches, parameterized values, TLS with certificate verification, advisory transaction locks, primary and foreign key constraints, immutability-by-content-addressed-run IDs and transaction rollback. Repeat applying an identical run is idempotent. All 819 and 875 stored rows are compared field-by-field with the staged source in a separate READ ONLY transaction. There is no automatic SQL retry after uncertain state and no medical-approval write path.

## Conservative contradiction rules

These are **signals for review**, *not clinical error determinations*:

| Rule | Trigger |
| --- | --- |
| `CAUSAL_CLASSIFICATION_WITH_LIMITING_EVIDENCE_LANGUAGE` | The authored edge says DIRECT_CAUSATION or AGGRAVATION, while its rationale/trigger/citation notes use specific association-only, bidirectional, or no-causation-proof language |
| `INDIVIDUAL_PROBABILITY_ALIGNMENT_REVIEW` | Generic knowledge base assigns the VA-style `AT_LEAST_AS_LIKELY_AS_NOT` probability alignment without individual case facts |
| `INDIVIDUAL_NEXUS_ASSERTION_IN_GENERIC_KNOWLEDGE_BASE` | Generic narrative asserts a conclusion for "this individual's presentation" |
| `CAUSAL_CLASSIFICATION_WITH_HYPOTHESIZED_MECHANISM` | Authored directed causation label paired with explicit `hypothesizedOnly=true` |
| `LEGAL_AUTHORITY_MISUSED_AS_CLINICAL_EVIDENCE` | Authority metadata classifies a law/regulation/guidance as a clinical-evidence source |
| `DIRECTIONAL_RELATIONSHIP_REVIEW` | Existing causation/aggravation claim requires directionality review before clinical adjudication |
| `CLINICAL_REFERENCE_STATUS_REVIEW` | One or more clinical source rows lacks previous verification status |
| `SOURCE_REGISTRY_REVIEW` | A citation PMID is absent from the active source registry (does not mean the publication is invalid) |
| `ONTOLOGY_ENDPOINT_IDENTITY_REVIEW` | Either endpoint is unmatched/ambiguous as a lexical ontology candidate |

The code never changes `verified`, never selects a diagnosis from a drug, never modifies authored ranking or turns literature association into causation. All statuses remain NOT_GRANTED/UNREVIEWED until a separate qualified-human approval workflow.

### Illustrative current published review item

The repository's `sleep-apnea → anxiety-disorder` mapping is authored as `DIRECT_CAUSATION` with an individual-nexus probability alignment, while its own rationale discusses bidirectional association and states individual causation is not established automatically. This generates multiple high-priority review signals. The code does **not** decide what the clinically correct replacement should be; that requires assessing the actual paper, other literature, target specificity, alternative etiologies, individual case evidence, legal context and publication governance.

## Verified results — November 8, 2026 Central

Review run: `dcd6681315b0b36c4a0a8270405f5446f0bd75d01465fefae1114f2206bcd7aa`.

| Review metric | Result |
| --- | ---: |
| Conditions inventoried | 819 |
| Published condition mappings | 140 |
| Directed pathway records | 875 |
| Published-pathway records | 248 |
| Referenced source links | 1,704 |
| Paths with one or more high-priority review rules | 30 |
| Of those, published paths | 21 |
| Directionality-review flags | 48 |
| Clinically unverified source-status review flags | 507 |
| Source registry-state review flags | 507 |
| Ontology endpoint identity review flags | 592 |
| Automated clinical approvals | **0** |

Rule counts overlap, and multiple fields can trigger the same rule within one pathway. 30 refers to *distinct pathway IDs*, not a number of confirmed clinical defects.

## Dashboard and review exports

A read-only Tiger DB query generates the local HTML dashboard and high-priority CSV:
- `/tmp/scf-clinical-review-batch1/review-dashboard.html`
- `/tmp/scf-clinical-review-batch1/high-priority-review.csv`
- `/tmp/scf-clinical-review-batch1/condition-review-queue.csv`
- `/tmp/scf-clinical-review-batch1/pathway-contradiction-queue.csv`
- `/tmp/scf-clinical-review-batch1/dashboard-summary.json`
- `/tmp/scf-clinical-review-batch1/clinical-review-ledger.json`

These are exported public-research review artifacts, not a public web feature. The HTML is static and has no external scripts or trackers. Keep a versioned archival copy outside `/tmp` before expiry of Tiger Cloud credits.

## Checks and next review gates

- Python tests for synthetic causation-language contradictions, association-only guards, probability wording, hypothetical mechanism, source verification, legal-source misuse, fail-closed classification.
- Node tests for DEV-only database connection, content hashes, all 819/875 rows, no medical approvals, tamper attempts and the known sample item.
- CI/typecheck, Next.js build and related KB/citation tests run before PR review.
- Independent live Tiger Cloud import and read-only full parity, then repeat idempotent import.
- No promotion from this PR. Separate qualified-human reviewer decisions are needed for **all** original pathways, not only the high-priority 30. The next controlled batch should prioritize the 21 published high-priority items, then the 375 unmatched/ambiguous identities and the 507 citation-state flags.

Production runtime and database are unchanged by this DEV work.
