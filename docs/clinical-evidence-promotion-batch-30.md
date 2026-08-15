# Clinical Evidence Promotion Batch 30 — Wave 7 Rescreen

Status: implementation candidate pending exact-head validation, Vercel Agent immutable-head review, expected-head protected merge, independent `main` CI, and Production Runtime Readiness.

## Production-validated base

Batch 30 branches from exact production-validated `main` SHA `b7624571d31de6ce3fa2c7efae5e5e1c18ba194f` (`Promote evidence-led Wave 6 mapping (#353)`). That SHA passed independent `main` CI #1031 and Production Runtime Readiness #390 before Wave 7 began.

## Scope and evidence boundary

Batch 30 re-screens all 10 Wave-7 identities while preserving the frozen **300 / 300** catalog/knowledge-base universe and the **107-identity** Wave 1–7 disposition universe.

Publication remains evidence-led: rating authority is not medical nexus evidence; manifestations are not widened into unrelated catalog diagnoses; grouped infectious rating identities are not treated as evidence of shared clinical pathways; treatment complications require the relevant treatment exposure; and every newly authored clinical source remains `verified: false` pending qualified-human review.

## Evidence-led Wave 7 publications

### `histoplasmosis` → `addisons-disease`

Published only for documented adrenal or disseminated histoplasmosis with adrenal involvement and biochemically confirmed primary adrenal insufficiency. Pulmonary-only histoplasmosis is not sufficient. Singh et al. followed 40 adults with adrenal histoplasmosis; 73% had primary adrenal insufficiency at presentation and additional initially eucortisolemic patients developed adrenal insufficiency on follow-up.

Clinical source: Singh et al., *Clin Endocrinol (Oxf)* 2019, PMID 30656706. Source remains `verified: false`.

### `ovarian-cancer` → `peripheral-neuropathy`

Published only as a treatment-complication pathway when paclitaxel-containing ovarian-cancer chemotherapy is documented. The MITO-7 randomized phase 3 trial reported grade 2 or worse neuropathy with both carboplatin/paclitaxel schedules, with lower neuropathy frequency in the weekly schedule. Ovarian cancer itself, surgery alone, or treatment without a supported neurotoxic exposure is not sufficient.

Clinical source: Pignata et al., *Lancet Oncol* 2014, PMID 24582486. Source remains `verified: false`.

### `testicular-cancer` → `hypogonadism`

Published only as a treatment-specific pathway. A systematic review/meta-analysis found increased testosterone-deficiency risk after standard chemotherapy, non-conventional treatment, and infradiaphragmatic radiotherapy compared with orchiectomy alone. The mapping therefore requires actual treatment history plus clinical/biochemical hypogonadism and does not infer the relationship from the cancer diagnosis or unilateral orchiectomy alone.

Clinical source: Bandak et al., *Andrology* 2016, PMID 27009402. Source remains `verified: false`.

### `laryngeal-cancer` → `aphonia`

Published only when total laryngectomy is documented. Total laryngectomy removes the natural laryngeal voice source and requires alaryngeal speech rehabilitation. The mapping does not generalize aphonia to all laryngeal cancer, partial laryngectomy, radiation-only treatment, or organ-preservation treatment.

Clinical source: van Sluis et al., *Eur Arch Otorhinolaryngol* 2018, PMID 29086803. Source remains `verified: false`.

## Wave 7 safe-draft dispositions retained

The other six Wave-7 identities remain intentionally draft:

- `amebiasis`: amoebic liver abscess is well recognized, but the current catalog lacks a matching liver-abscess target and the evidence is not widened into generic chronic liver disease.
- `actinomycosis`: thoracic/pulmonary actinomycosis has heterogeneous complications and bidirectional associations; no exact downstream catalog diagnosis met the directional threshold.
- `nocardiosis`: CNS nocardiosis frequently presents with brain abscess, but the current catalog lacks an exact brain-abscess target; the finding is not widened into a different neurologic identity.
- `strongyloidiasis`: hyperinfection/disseminated disease can produce severe systemic complications, but the current catalog lacks a sufficiently exact sepsis/ARDS-type target and the rating identity's severe-disease scope is not generalized to uncomplicated infection.
- `rickettsial-ehrlichial-anaplasma-infection`: the grouped rating identity spans clinically distinct infections; pathogen-specific complications are not generalized across the entire group.
- `mandibular-nonunion`: available literature is stronger for predictors, fracture-management complications, and functional sequelae than for a distinct nonunion-primary downstream catalog diagnosis.

A safe draft is a completed reviewed disposition, not a defect.

## Evidence-quality withdrawals and narrowing

Four lower-directionality unverified published source rows are removed so the stronger Wave-7 publications do not increase citation-review debt:

1. `parkinsons-disease` → `depressive-disorder` is withdrawn because PMID 27358339 is a depression-detection/prevalence meta-analysis, not evidence that Parkinson disease caused or aggravated depression.
2. `seizure-disorder` → `depressive-disorder` is withdrawn because PMID 41967683 pools cross-sectional screening-based psychiatric-comorbidity prevalence and associated variables rather than a seizure-primary causal/aggravation pathway.
3. `psoriatic-arthritis` → `depressive-disorder` is withdrawn because the retained PMID 38797775 source is an overview of prevalence/incidence and psychological comorbidity reviews, not directional PsA-primary evidence.
4. `trigeminal-neuralgia` → `anxiety-disorder` is removed because PMID 29526561 reports psychometric anxiety burden in trigeminal-neuralgia populations without establishing the directional pathway required for publication. The separate `trigeminal-neuralgia` → `depressive-disorder` mapping remains live because its source contains stronger condition-specific treatment-response/chronology information.

All four removed source records were `verified: false`; no verified-source retirement record is created.

## Citation-debt position

Batch 30 is a four-for-four evidence-quality exchange. Four unverified published source rows are removed and four stronger unverified clinical source rows are added. Expected citation position therefore remains:

- live references: **69**;
- live verified: **8**;
- retired verified: **6**;
- verified provenance: **14**;
- live unverified: **61**;
- published-unverified review findings: **59**;
- live clinical-evidence references with canonical URLs: **64**;
- retired clinical-evidence URLs: **4**;
- clinical-URL provenance: **68**.

The Wave disposition totals become **32 published-evidence-led / 0 promotion-candidate / 75 safe-draft**.

## Verification boundary

Automated retrieval and source screening are preparation activities only. All four new source records remain `verified: false`; only a qualified human reviewer may record `verified: true` under repository policy.

## Closure requirement

The exact final branch head must pass citation audit, knowledge-base validation, lint, typecheck, critical-module composition, the one-shot test suite, production build, real-browser journeys, diagnostics, and aggregate fail-safe. The exact validated head must then receive a genuine Vercel Agent immutable-head code review. A Vercel preview/deployment `Ready` status does not satisfy that review gate. Any head change invalidates both exact-head CI and review. Only after expected-head protected merge, independent `main` CI, and Production Runtime Readiness on the merge SHA is Wave 7 production-closed.
