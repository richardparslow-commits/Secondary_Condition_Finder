# Tiger Cloud DEV — ontology expansion and mapping validation

**Status, November 8, 2026 (America/Chicago): MONDO full-release import, exact-row parity, six-source enrichment, citation review audit, review queue export and read-only benchmark completed.** This is public research content, not a medical opinion, clinical approval, patient-record store, diagnosis generator, or production migration.

## Design: two separate graphs

- **Medical terminology graph:** stable disease identifiers, labels, scoped synonyms (EXACT/BROAD/NARROW/RELATED), is-a hierarchy, obsolete/replacement identifiers and cross-references. A lexical match is a review candidate, *not* an approved identity. Broad/related synonyms and cross-references cannot silently become equivalence links.
- **Evidence-review graph:** existing authored directed pathway edges, nexus classification, source-citation metadata, text-mined articles, disease-phenotype/gene associations, and human-review flags. *Neither a shared phenotype nor a literature mention establishes clinical causation, aggravation, or a veteran's individual nexus.*

The application continues to use the committed authored catalog (819 conditions, 875 directed/ranked pathways). No users receive diagnoses inferred from this data; no new clinical relationships are automatically published.

## Official sources

- **MONDO** `v2026-10-06` OBO release, CC BY 4.0, by the Monarch Initiative. URL: https://github.com/monarch-initiative/mondo/releases/tag/v2026-10-06. Official release asset SHA256 `2631e8e165d41def1a46749adb1ce0a336c8aba7f6bc0978729592cee8fed60b` (verified via GitHub release metadata). Exact release, hash and manifest are pinned. Data are cached locally in /tmp, not committed.
- **EMBL-EBI OLS4** MONDO concept search: https://www.ebi.ac.uk/ols4/api-docs
- **NLM ICD-10-CM Clinical Tables** code/label candidate search, provider reports 2027 edition: https://clinicaltables.nlm.nih.gov/apidoc/icd10cm/v3/doc.html
- **Monarch v3** disease-associated KG predicates, including taxonomy and phenotypes, without inferred causation: https://api.monarchinitiative.org/v3/docs
- **NCBI PubTator3** text-mined PMID/title research cues; not independent evidence verification: https://www.ncbi.nlm.nih.gov/research/pubtator3/
- **HPO** phenotype vocabulary lookup via OLS4; no automatic disease-to-phenotype assertion: https://www.ebi.ac.uk/ols4/ontologies/hp
- **Open Targets** public GraphQL disease-identity search, not nexus verification: https://platform-docs.opentargets.org/data-access/graphql-api

PubMed, RxNorm and openFDA research are covered separately in draft PR #662 and the DEV schema `scf_medical_reference_dev`. We did not add a redundant source service. SNOMED CT/UMLS bulk vocabularies were **not** imported: access/redistribution require separate licensing and registration review. Reactome molecular-pathway research may be evaluated separately, but a molecular mechanism is not evidence of individual VA medical causation.

## Tiger Cloud isolation

Designated pre-existing READY/DEV service: `secondary-condition-finder-test`, ID `m8vrpmo6ec`, direct port `30902`. Service-ID, DEV tag, host, database and TLS certificate are verified before every DB command. Tiger CLI protection `read_only: prod` remains enabled. Production-tagged `db-41579` is not used. No new billable database was created.

Dedicated new DEV schema `scf_medical_ontology_dev` contains:

| Tables | Purpose |
| --- | --- |
| releases, concepts, synonyms, parents, xrefs | Pinned versioned ontology concepts and taxonomy, no clinical interpretation |
| app_audits, app_candidates, app_pathways | Review-only lexical matches and original 875 edges |
| research_batches, research_candidates | Bounded OLS4, ICD-10-CM, Monarch, PubTator3, HPO and Open Targets metadata |
| pathway_citation_batches, pathway_citation_audits | 875 existing mapping citation/provenance analyses with mandatory human-review flags |

Parameterized SQL, explicit transactions, advisory locks, idempotent inserts, SHA256 manifests and verified TLS are used. **All saved rows were compared against staged inputs in read-only transactions**, not merely counted. SQL writes are never silently retried after an uncertain disconnect.

## Verified full-release MONDO import

Pinned ontology snapshot: `a165dc2fc61761f5e5413b6395dd4afb14c89d78783af213a9b8f1d0a3f2a8c7`.

| Category | Exact-row verified |
| --- | ---: |
| MONDO concepts | 36,055 |
| Active / obsolete concepts | 32,134 / 3,921 |
| Scoped synonym rows | 94,313 |
| Classification is-a rows | 46,732 |
| Cross-reference rows | 148,013 |
| Current app condition audits | 819 |
| Lexical identity candidates | 565 |
| Current authored pathway audits | 875 |

**Existing 819 conditions:** 444 have one MONDO lexical candidate, 51 have ambiguous candidates, and 324 have no matching exact preferred-name/exact-synonym candidate. These are not diagnoses, no-match medical judgments, or clinical validation scores. The next review should resolve which labels are broader/narrower, missing synonyms or obsolete terms.

## Six-source pilot enrichment

Twelve fixed, existing app conditions were used as public test queries. Supplemental versioned snapshot: `f9f6a8c742973d90ae42bde74faa055e761240241abbc418a225cc3f1a6eb6d1`.

| Provider | Exact-row verified observations |
| --- | ---: |
| OLS4/MONDO | 38 |
| ICD-10-CM | 36 |
| Monarch v3 | 29 |
| PubTator3 | 36 |
| HPO via OLS4 | 19 |
| Open Targets | 28 |
| **Total** | **186** |

Four ICD-10-CM queries had no candidate *for their exact wording*, not evidence that a condition lacks a medical code. All outputs are public-source metadata with `reviewRequired=true`; nothing was promoted to a diagnosis or nexus decision.

## Existing pathway citation review

All 875 edges were examined offline against existing mapping/source metadata, then persisted in Tiger DEV with exact parity. Digest: `c420c158e39900af777e11a233b19873c8cda08edd2e22bd6c1da88c52117704`.

There are 1,704 cited source-reference links, 398 carrying previously declared `verified:true`. The **overlapping** audit flags (not error counts) are:

| Research queue flag | Pathways |
| --- | ---: |
| Clinical proposition not independently assessed by this pipeline | 875 |
| At least one endpoint needs ontology identity review | 592 |
| PMID registry/retirement state needs review | 507 |
| Clinical reference verification state needs review | 507 |
| Direct causation/aggravation directionality needs human review | 48 |

None of these flags makes a medical/legal verdict. Even previously marked `verified:true` remains *previously declared*, not newly approved by this integration. Human review is required before changing a published relationship.

## Review exports

Read-only Tiger Cloud exports of public authored identifiers and source metadata, located at:

- `/tmp/scf-mondo-20261006/review-queue/condition-identity-review.csv` — 819 rows
- `/tmp/scf-mondo-20261006/review-queue/pathway-evidence-review.csv` — 875 rows
- `/tmp/scf-mondo-20261006/review-queue/external-research-candidates.csv` — 186 rows
- `/tmp/scf-mondo-20261006/review-queue/summary.json`

No patient names, claim facts, medical files, or private input are in these exports.

## Repeatable operator commands

From the authorized Mac, with Tiger CLI installed and the repository checked out on this DEV branch:

```sh
npm ci
npm run ontology:fetch:dev
npm run ontology:prepare:dev
npm run ontology:load:dev
npm run ontology:verify:dev
npm run ontology:collect:dev
npm run ontology:supplement:dev
npm run ontology:enrich:load:dev
npm run ontology:enrich:verify:dev
npm run ontology:citations:prepare:dev
npm run ontology:citations:load:dev
npm run ontology:citations:verify:dev
npm run ontology:benchmark:dev
npm run ontology:export-review:dev
npm run test:ontology-dev
```

The official 53 MB source and staged public files intentionally live in `/tmp`. Repeating external research requests creates a **new immutable research digest** with a new observed-at time. Inspect the new review queue before loading. No background schedule, auto-approval, or production migration exists.

## Performance and safety checks

Ten new ontology mutation/safety tests verify that unauthorized database hosts/roles, changed source hashes, forged candidate status, unapproved medical certainty, and removed human-review flags cannot pass silently. Existing PubMed, RxNorm and openFDA tests from PR #662 remain separate.

Five read-only Tiger DEV query patterns, five repetitions each, measured ~54–57 ms median *Mac-to-Tiger total latency* per indexed synonym, xref, parent, unmatched condition, and pathway count. This is an end-to-end network measurement, **not** a server-only execution-time or application SLA.

## Suggested follow-on work during credit window

1. Human-review the 324 unmatched and 51 ambiguous diagnoses, prioritizing currently published mappings and retired ontology IDs.
2. Review 48 directional-nexus candidates and 507 citation/registry flags against the actual papers, source dates, limits and independent clinical judgments. Never infer a VA rating or automatic nexus from population association.
3. Scale rate-limited public API requests to more *existing* conditions, retain full provenance and source versions, and evaluate every change as a separate immutable snapshot. Do not transmit personal medication lists or medical records.
4. Benchmark concurrency, indexes and provenance joins in DEV; plan cost controls before credits expire.
5. After separate PR #661's Preview-to-DEV configuration is validated, consider an authenticated **read-only operator** reporting endpoint. Do not connect unreviewed ontology content to user-facing clinical recommendations.

**No Production code/database changes or user-facing clinical modifications were made in this phase.**
