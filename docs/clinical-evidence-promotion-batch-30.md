# Clinical Evidence Promotion Batch 30 — Wave 7 Rescreen

Status: corrected implementation candidate pending fresh exact-head validation, fresh Vercel Agent immutable-head review, expected-head protected merge, independent `main` CI, and Production Runtime Readiness.

## Production-validated base

Batch 30 branches from exact production-validated `main` SHA `b7624571d31de6ce3fa2c7efae5e5e1c18ba194f` (`Promote evidence-led Wave 6 mapping (#353)`). That SHA passed independent `main` CI #1031 and Production Runtime Readiness #390 before Wave 7 began.

## Scope and evidence boundary

Batch 30 re-screens all 10 Wave-7 identities while preserving the frozen **300 / 300** catalog/knowledge-base universe and the **107-identity** Wave 1–7 disposition universe. Publication remains evidence-led: rating authority is not medical nexus evidence; manifestations are not widened into unrelated diagnoses; treatment complications require the treatment actually studied; and every newly authored clinical source remains `verified: false` pending qualified-human review.

## Evidence-led Wave 7 publications

### `ovarian-cancer` → `peripheral-neuropathy`

Published only when a paclitaxel-containing ovarian-cancer regimen is documented and a compatible peripheral neuropathy began or materially worsened after treatment. Ovarian cancer itself and surgery alone are insufficient. Clinical source: Pignata et al., *Lancet Oncol* 2014, PMID 24582486. Source remains `verified: false`.

### `testicular-cancer` → `hypogonadism`

Published only as a treatment-specific pathway with documented treatment exposure plus clinical and biochemical hypogonadism. The relationship is not inferred from the cancer diagnosis or unilateral orchiectomy alone. Clinical source: Bandak et al., *Andrology* 2016, PMID 27009402. Source remains `verified: false`.

## Review-driven safe drafts

Two initially screened candidates were returned to safe draft after review:

- `histoplasmosis`: PMID 30656706 supports primary adrenal insufficiency in **adrenal histoplasmosis**, but the catalog identity is Histoplasmosis of Lung and the intake has no disease-site signal capable of enforcing adrenal/disseminated disease. The pulmonary identity therefore cannot safely publish an Addison-disease recommendation.
- `laryngeal-cancer`: PMID 29086803 supports voice handicap and alaryngeal speech rehabilitation after total laryngectomy, but loss of the natural laryngeal voice source is not itself the distinct catalog diagnosis of aphonia. Publication would require aphonia-specific evidence and documented aphonia.

The other six Wave-7 identities also remain safe draft because direction, target fit, grouped-pathogen scope, or distinct downstream-diagnosis evidence is insufficient: `amebiasis`, `actinomycosis`, `nocardiosis`, `strongyloidiasis`, `rickettsial-ehrlichial-anaplasma-infection`, and `mandibular-nonunion`.

A safe draft is a completed reviewed disposition, not a defect.

## Evidence-quality withdrawals and narrowing

Four lower-directionality unverified published source rows are removed independently of the Wave-7 publications:

1. `parkinsons-disease` → `depressive-disorder`: PMID 27358339 is depression-detection/prevalence evidence, not directional Parkinson-primary evidence.
2. `seizure-disorder` → `depressive-disorder`: PMID 41967683 pools cross-sectional screening-based psychiatric-comorbidity prevalence rather than a seizure-primary causal/aggravation pathway.
3. `psoriatic-arthritis` → `depressive-disorder`: PMID 38797775 is prevalence/incidence and psychological-comorbidity evidence, not directional PsA-primary evidence.
4. `trigeminal-neuralgia` → `anxiety-disorder`: PMID 29526561 reports psychometric anxiety burden without establishing the directional pathway required for publication. The stronger `trigeminal-neuralgia` → `depressive-disorder` mapping remains live.

All removed source records were `verified: false`; no verified-source retirement record is created.

## Citation-debt position

Four unverified published source rows are removed and only two new unverified Wave-7 sources remain live. Expected position therefore improves to:

- live references: **67**;
- live verified: **8**;
- retired verified: **6**;
- verified provenance: **14**;
- live unverified: **59**;
- published-unverified review findings: **57**;
- live clinical-evidence references with canonical URLs: **62**;
- retired clinical-evidence URLs: **4**;
- clinical-URL provenance observation: **66**.

The Wave disposition totals become **30 published-evidence-led / 0 promotion-candidate / 77 safe-draft**.

## Verification boundary

Automated retrieval and source screening are preparation activities only. The two new live Batch-30 source records remain `verified: false`; only a qualified human reviewer may record `verified: true` under repository policy.

## Closure requirement

The corrected exact branch head must freshly pass citation audit, knowledge-base validation, lint, typecheck, critical-module composition, the one-shot test suite, production build, real-browser journeys, diagnostics, and aggregate fail-safe. It must then receive a fresh genuine Vercel Agent immutable-head review. A Vercel preview/deployment `Ready` status does not satisfy that review gate. Any head change invalidates both exact-head CI and review. Only after expected-head protected merge, independent `main` CI, and Production Runtime Readiness on the merge SHA is Wave 7 production-closed.
