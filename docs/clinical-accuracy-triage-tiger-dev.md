# Tiger Cloud DEV — clinical evidence and ontology-identity triage

**Research triage implemented, NOT clinical verification.** This stage follows the successful 875/875 autonomous PubMed metadata-collection campaign and the 875 full source-to-claim reviewer packets from PR #671. It does not change clinical content, citation verification flags, condition IDs, ranking, diagnosis claims or Production behavior.

## Scope

### 21 published high-priority claim reviews

- Each case is derived from the immutable, previously generated, 875-pathway source-to-claim reviewer packets and retains its **authored** nexus classification/probability wording and exact cited PMID(s).
- Live official NCBI ESummary retrieves bibliographic metadata for the **20 distinct original PubMed records** cited by the 21 selected published pathways. EFetch XML independently checks whether abstract metadata is present and whether PubMed lists correction/retraction/concern relations. Full abstract text and full articles are **not stored or redistributed**.
- A missing PMID, provider outage, publication-status alert or mismatched source data remains a flagged **human source-review** item; none causes a medical conclusion to be granted. A clean publication status only means *no such signal in the bounded metadata check*.
- Every case stays `QUALIFIED_HUMAN_REVIEW_REQUIRED` and `NOT_ASSESSED` for causal validity, aggravation, source-to-exact-claim support and individual VA nexus probability. The code issues no clinical reinterpretation or redline as an accepted fact.

### 375 unresolved ontology term identities

- Verified baseline: **819** total authored conditions; **444** unique lexical candidates remain review-required, **51 ambiguous exact lexical candidate sets**, and **324 without an exact MONDO label/synonym match**.
- The prior MONDO v2026-10-06 official release SHA-256 and all four staging CSV digests are validated before generating a versioned 375-row review fixture.
- The 51 ambiguous records preserve existing candidates and their ontology status, including obsolete/replacement flags.
- The 324 without exact matches receive up to three conservative **lexical hints** found only among active MONDO labels and scoped EXACT synonyms, with deterministic token/sequence similarity and a minimum threshold. **Fuzzy lexical resemblance is NOT evidence of medical equivalence, causal linkage or a valid SNOMED/UMLS crosswalk.**
- Ambiguous, composite, symptom/rating-only and weak-match terms must be reviewed by appropriate domain experts; do not coerce them into a disease identity. A missing lexical hint does not prove absence from an ontology.
- All 375 have `humanIdentityReviewState: NOT_ASSESSED` and `catalogChangeAuthorized: false`. No candidate is auto-promoted.

## Verified DEV research snapshot (November 9, 2026)

One tested live official-source triage retrieved **20/20** PubMed bibliographic entries and **20/20** EFetch publication-correction records for the high-priority subset. No PubMed retraction or expression-of-concern metadata flag was detected during this bounded check. **This is not proof of source-to-claim support.**

The 375 ontology exceptions included 195 with at least one lexical review suggestion, and 180 with no suggestion meeting the lexical heuristic. These are queueing statistics, not medical evidence quality scores.

The new immutable DEV-only schema `scf_clinical_triage_dev` contains:
- `runs`: content-addressed snapshot ID and provenance, zero approval state;
- `cases`: 21 exact full authored-priority review rows;
- `publications`: 20 PubMed bibliographic/correction metadata records;
- `identities`: 375 unresolved identity-review entries.

The ingestion uses TLS verification and a strict exact host/service/port/database guard for existing DEV service `m8vrpmo6ec`. Only explicit operator setup uses the existing DEV admin through the guarded Tiger CLI; continuous GitHub Actions uses the existing encrypted **least-privilege** login `scf_evidence_ci_writer`, granted only SELECT/INSERT to this separate schema, not UPDATE/DELETE/CREATE. SQL parameterization, immutable run hashes, FK/PK constraints, transactional ingestion, and exact full-field independent `BEGIN READ ONLY` verification are implemented. A missing/new catalog or invalid digest fails closed. The PROD-tagged Tiger service is never accessed.

## Autonomous screening

Workflow: `.github/workflows/tiger-dev-clinical-accuracy-triage.yml`.

Runs **weekly Monday at 04:41 UTC**, plus manual dispatch:
1. Reconstruct pinned 819/875 original clinical review ledger and 875 complete source-to-claim review packets.
2. Verify the 375-term immutable MONDO reconciliation fixture against current authored condition labels.
3. Refresh current NCBI bibliographic and correction flags for the 20 cited PMIDs and generate 21-case/375-term human-review dossiers.
4. Run offline tests, append an immutable research-only snapshot to Tiger Cloud DEV with the existing protected CI secret, and independently verify every one of the **416** stored review rows.
5. Expose source outages/retraction flags as open engineering/source-status GitHub issues, not clinical conclusions.
6. Retain public-only source reports as GitHub artifacts for 30 days.

The two previously deployed autonomous research-monitoring workflows remain active. The new weekly triage does not give itself permission to create/merge PRs, update published mappings or approve medical sources.

## Review outputs

- `triage-run.json`: content-digested snapshot of 21 priority pathways, 20 official PubMed metadata entries and source-status flags
- `clinical-accuracy-review.md`: linked 21-case reviewer dossier
- `bibliographic-review.csv`: PubMed metadata and publication-correction status
- `ontology-review.csv`: all 375 unresolved labels and lexical *review candidates*
- `clinical-case-decisions-EMPTY.csv`: 21 blank qualified-review decisions
- `ontology-human-decisions-EMPTY.csv`: 375 blank qualified-identity-review decisions
- `identity-review-candidates.json`: MONDO versioned immutable fixture, including provenance, row SHA-256 and no-approval guards
- `SHA256SUMS.txt` in user's Mac archival copy

## Reproduce

```sh
python3 scripts/automation/stage_pinned_ontology.py
python3 scripts/lib/build-clinical-review-ledger.py
python3 scripts/automation/build_claim_review_packets.py
python3 scripts/automation/ontology_identity_triage.py
python3 scripts/automation/clinical_accuracy_triage.py

python3 -m unittest discover -s tests -p 'test_clinical_accuracy_triage.py'
node --test tests/clinical-accuracy-triage.test.mjs

# Only on the authorized DEV workstation: one-time schema+grants setup
node scripts/automation/clinical-accuracy-tiger-dev.mjs setup --dev-write
# Existing protected Actions env uses the least-privilege encrypted DEV secret:
node scripts/automation/clinical-accuracy-tiger-dev.mjs apply --dev-write
node scripts/automation/clinical-accuracy-tiger-dev.mjs verify
```

Clinical source-to-claim adjudication, condition-identity approval, and published app changes remain **separate explicit qualified-human review gates**. Automated review datasets are only proposed evidence leads. Even complete research coverage does not guarantee all medical relationships are correct.
