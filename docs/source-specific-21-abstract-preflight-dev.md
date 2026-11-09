# Clinical accuracy phase — 21 original cited sources, abstract-scope preflight

**Status:** Preliminary source-context research and bounded metadata screening on **Tiger Cloud DEV**, not clinical verification, individual VA nexus evaluation, or authorization to modify published recommendations.

## Why this phase exists

PRs #664–#674 established a versioned audit of 819 condition IDs, 875 authored pathways, 1,704 cited source links, full PubMed metadata collection and clinical review queues. Among them, **21 published pathways** use language or metadata that triggers a high-priority contradiction signal. Those 21 paths cite **20 unique PubMed records** (the 2025 hypertension guideline is shared by two claims).

Prior reviews checked bibliographic source existence and correction metadata. This stage goes further: it checks the *actual available PubMed abstract context* against each authored relationship, identifies exposure/phenotype/directionality limitations, and prepares a qualified-human full-text review dossier.

All 21 source-context notes in `scripts/automation/fixtures/clinical-source-21-preflight-notes.json` are manually prepared, conservative preliminary abstract-level research notes. They are **not independently verified full-text clinical judgments**. They contain no personal patient or claimant records.

## Specific concerns surfaced from the cited abstracts

| Published mapping | Cited PMID | Key scope question for human reviewer |
|---|---|---|
| Anal fistula → fecal incontinence | 33387100 | Studied **sphincter-cutting procedures**, not every untreated fistula |
| Cauda equina syndrome → erectile dysfunction | 40380123 | Selected surgical lumbar-disc/CES population, heterogeneous sexual outcomes |
| Chronic liver disease → cirrhosis | 32108989 | Conditional fibrosis progression, not inevitable cirrhosis |
| Chronic pyelonephritis → chronic kidney disease | 11110586 | Patients with preserved renal function often remained stable |
| Chronic sinusitis → OSA | 41969980 | Modest observational association and MR signal; individual causation not proven |
| Cushing syndrome → hypertension | 35950979 | Endocrine syndrome/biochemical confirmation and temporal course |
| Depressive disorder → erectile dysfunction | 34247952 | **Antidepressant medication** exposure rather than diagnosis directly |
| Hyperparathyroidism → kidney stones | 36245251 | **Primary** hyperparathyroidism guideline, broader catalog label |
| Hypertension → CKD | 40811497 | Guideline **abstract does not establish precise claim**; full sections and linked corrections |
| Hypertension → heart failure | 40811497 | Same guideline source, separate heart-failure direction and corrections review |
| Hypertensive heart disease → heart failure | 36082670 | Conceptual mechanistic review, other HF etiologies |
| Hypogonadism → osteoporosis | 29499097 | Men with **confirmed** testosterone deficiency; not universal osteoporosis |
| Pacemaker → valve disorders | 34389210 | **Transvenous lead-associated tricuspid regurgitation**, not every valve disorder |
| Ovarian cancer → peripheral neuropathy | 24582486 | **Paclitaxel-containing chemotherapy** toxicity rather than cancer alone |
| Pituitary neoplasm → visual impairment | 32419072 | **Optic-chiasm compression from macroadenoma** and linked correction |
| PTSD → erectile dysfunction | 19473282 | **SSRI exposure** in men presenting with sexual dysfunction, not PTSD-specific causal evidence |
| Pulmonary hypertension → heart failure | 36017548 | No PubMed abstract; read corrected ESC/ERS guideline for subtype-specific right-heart failure |
| OSA → anxiety disorder | 30453780 | Meta-analysis describes **probable bidirectional association**, not unidirectional causation |
| OSA → depressive disorder | 38888794 | Cross-sectional severity association **does not show aggravation** of an existing disorder |
| Testicular cancer → hypogonadism | 27009402 | Treatment-specific late effect in survivors, rather than universal cancer effect |
| Urethral stricture → hydronephrosis | 8571802 | Prolonged obstruction and upper-tract complications in a selected cohort |

These are prompts for clinical reviewers, not prescribed corrections or medical error determinations. Source-to-claim validity depends on original full text, methods, context, specific diagnostic phenotype and possible counterevidence.

## Live PubMed source preflight — November 9, 2026

Official NCBI EFetch returned **all 20 referenced PMIDs**. One record has no PubMed abstract, **PMID 36017548** (2022 ESC/ERS pulmonary-hypertension guideline). Three distinct PMIDs have linked errata/correction markers requiring reviewer inspection: **32419072, 36017548, 40811497**. These markers do not automatically invalidate a paper or its claim.

The report stores official title, publication-type metadata, correction type, abstract-presence flag and an ephemeral abstract SHA-256 fingerprint—but **never stores the abstract text itself**. The source-specific interpretations are separate authored research notes clearly labeled preliminary.

- Output `source-claim-21-run.json`: exact 21-case content-addressed research snapshot
- Output `source-claim-21-review.csv`: condensed original-citation-to-claim questions, warning flags and provisional scope
- Output `source-claim-21-dossier.md`: readable 21-item dossier with PubMed links, conservative findings, limitations and reviewer questions
- Output `qualified-human-decision-EMPTY.csv`: **all 21 decisions intentionally blank**
- Output `summary.json`: summary, counts, absent abstract, corrections and per-file SHA-256 integrity hashes

The checks enforce 21 original authored edges, exactly 20 matching official PMID references and no automatic medical verification. Empty reviewer decisions cannot be filled by this automation.

## Tiger Cloud DEV architecture

Source-specific results are isolated in `scf_source_claim_preflight_dev` on the existing READY **DEV** service `m8vrpmo6ec`. Versioned tables `runs`, `cases`, and `publications` contain exactly 21 and 20 review records per immutable run.

- The existing GitHub Actions environment `tiger-dev-research` provides an encrypted `TIGER_AUTOMATION_DEV_URL`, scoped to the **least-privileged** `scf_evidence_ci_writer`.
- The writer is granted **SELECT and INSERT only** on the new isolated schema. Tiger Cloud independently confirms **no UPDATE or DELETE** access on the case records.
- DB CHECK constraints prohibit setting `medicalClaimVerification`, `publicationAuthorization`, or `humanReviewerDecision` to approved states.
- The tool verifies source content digests, then checks every stored row byte-for-byte logically against the source JSON in a separate `BEGIN READ ONLY` transaction.
- An administrator may create the DEV schema only with the explicit `setup --dev-write` CLI action after verifying the service is READY/DEV. No production-designated Tiger service is allowed.
- The weekly clinical-accuracy triage workflow regenerates the 21-case source-context report, performs a protected DEV writer import and independent read-only parity, includes it in GitHub Actions artifacts, and retains existing human approval gates.

## Reproduce on authorized machine

From the repository root after staging the pinned public ontology and source packets:

```sh
python3 scripts/automation/stage_pinned_ontology.py
python3 scripts/lib/build-clinical-review-ledger.py
python3 scripts/automation/build_claim_review_packets.py

python3 scripts/automation/source_specific_preflight.py
python3 scripts/automation/source_specific_preflight.py --verify
python3 -m unittest discover -s tests -p 'test_source_specific_preflight.py'
node --test tests/source-specific-preflight.test.mjs

# Initial Tiger schema creation on approved DEV only:
node scripts/automation/source-specific-tiger-dev.mjs setup --dev-write
node scripts/automation/source-specific-tiger-dev.mjs verify
```

Normal scheduled ingestion uses `apply --dev-write` with the existing **restricted** DEV writer from GitHub, not the administrator. No new paid Tiger Cloud service was created.

## Remaining clinical gate

For each published claim, a qualified medical reviewer must read the full relevant source (including corrections), establish what is actually supported, identify source-specific limitations and contradictory research, and propose an evidence-backed authoring change if needed. A separate clinical governance decision and reviewed PR are required before altering any published medical pathway, its causal classification, or VA-style probability language. **This phase grants zero clinical approvals and makes zero Production changes.**
