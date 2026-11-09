# Independent PubMed candidate discovery — 21 high-priority published pathways

**Scope: public-source retrieval only; no clinical, VA nexus, citation-verification, or publication approval.**

The existing 21-case abstract preflight confirms the original cited 20 PMIDs and outlines preliminary source limitations. This phase uses 21 explicitly curated, condition-specific PubMed searches to collect **up to 12 relevance-ranked candidate PMIDs per pathway** (excluding the originally cited PMID). This is not a systematic review, clinical contradiction finding, study-quality assessment or evidence of absence when no candidates are returned. Existing published mappings remain unchanged.

The query fixture is pinned to the original 21-case source ledger. The generated research snapshot records exact source-case and query-file digests, original cited PMIDs, public query text, official PubMed match counts, returned candidate IDs and mandatory human review states. No abstract bodies, full text, credentials or private medical records are saved. The output manifest validates SHA-256 of JSON, CSV and reviewer dossier; approved or modified clinical cases and altered artifacts fail closed.

Reviewers must inspect each candidate publication and any linked corrections, record study inclusion/exclusion, study design, population, directionality, possible medication- or procedure-mediated mechanisms, confounders, alternative causes, and the exact source-to-claim relationship. Search hits are **not automatically supportive, contradictory, independent, or valid evidence**. All clinical and VA nexus findings, citation verification, and publication changes remain behind qualified-human review.

Run after preparing the existing prerequisite 21-case preflight:

```sh
python3 -m unittest discover -s tests -p 'test_secondary_evidence_discovery.py'
python3 scripts/automation/secondary_evidence_discovery.py
python3 scripts/automation/secondary_evidence_discovery.py --verify
```

Artifacts: `/tmp/scf-source-specific-review/secondary-evidence-discovery/`, included in the existing weekly GitHub Actions clinical triage artifact. No new paid Tiger service, schema, role, deployment, or Production write. The existing Tiger Cloud DEV snapshot continues to store the original 21 source preflight; **this supplementary candidate export is a GitHub Actions research artifact and is not claimed to be in Tiger Cloud**.
