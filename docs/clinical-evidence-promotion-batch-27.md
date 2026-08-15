# Clinical Evidence Promotion Batch 27 — Wave 4 Rescreen

Status: implementation candidate pending exact-head validation, immutable-head review, protected merge, independent `main` CI, and production runtime closure.

## Production-validated base

Batch 27 branches from exact `main` SHA `b260bbcb8a7a8de70178d23ab023ccdea253ad8e` (`Promote evidence-led Wave 3 mappings (#350)`). That SHA passed independent `main` CI #992 and Production Runtime Readiness #351 before this branch was created.

## Scope and governance

Batch 27 re-screens all 15 Wave 4 identities. The frozen catalog/knowledge-base universe remains **300 / 300**, and the Wave 1–7 disposition universe remains **107 identities**.

Publication remains evidence-led:

- rating-schedule authority is not medical nexus evidence;
- association, complication, treatment, and functional-loss language is kept narrower than the source permits;
- no relationship is published merely to reduce the draft count;
- every newly authored clinical source remains `verified: false` pending qualified-human review; and
- the citation audit remains a hard review-debt ratchet rather than a threshold to reset.

## Evidence-led Wave 4 promotions

### `uveitis` → `glaucoma`

Uveitic glaucoma is a recognized sight-threatening complication of intraocular inflammation. The published mapping requires objective glaucoma rather than isolated ocular hypertension and preserves both inflammatory outflow-compromise and corticosteroid-treatment mechanisms. Individual development must establish uveitis phenotype, chronology, intraocular-pressure course, optic-nerve/visual-field damage, treatment exposure, and competing glaucoma causes.

Clinical source: Kesav et al., *Survey of Ophthalmology* 2020; PMID 31816329. The source remains `verified: false`.

### `retinal-dystrophy` → `visual-impairment`

Inherited retinal dystrophies are heterogeneous retinal disorders that produce visual-impairment phenotypes through retinal and photoreceptor dysfunction/degeneration. The mapping requires phenotype-specific retina documentation plus objective functional loss and does not attribute unrelated ocular or neurologic visual impairment to the broad retinal-dystrophy identity.

Clinical source: Sharon et al., *Progress in Retinal and Eye Research* 2022; PMID 34839010. The source remains `verified: false`.

### `ptosis` → `visual-impairment`

Upper-eyelid ptosis can mechanically obstruct the superior visual field. The mapping is limited to objectively documented functional field impairment attributable to eyelid position; ptosis without demonstrated functional obstruction is not treated as visual impairment by default.

Clinical source: American Society of Plastic Surgeons evidence-based guideline on eyelid surgery for upper visual-field improvement, PMID 35895522. The guideline also notes limitations in the methodological quality of much of the surgical literature, which is preserved in the mapping's development requirements. The source remains `verified: false`.

## Wave 4 safe-draft dispositions retained

The other 12 Wave 4 identities remain intentionally draft after bounded screening:

- `bronchiectasis`: pulmonary-hypertension literature exists, but the available evidence screened for this batch was observational/small and PH in bronchiectasis is sufficiently multifactorial that a routine bronchiectasis-primary publication would overstate the current evidence.
- `chronic-laryngitis`: no sufficiently specific downstream catalog disease relationship met the publication threshold.
- `vocal-cord-paralysis`: dysphonia, aspiration risk, and airway manifestations are clinically important, but the current catalog did not provide a target-specific disease relationship supportable without converting manifestations into overbroad secondary diagnoses.
- `aphonia`: primarily a manifestation/functional state; no clean downstream disease target met the threshold.
- `granulomatous-rhinitis`: etiologically heterogeneous; no generic downstream relationship met the required specificity.
- `bacterial-rhinitis`: no sufficiently durable downstream disease relationship met the threshold without overgeneralizing acute infectious complications.
- `pulmonary-vascular-disease`: intentionally broad and distinct from the narrower `pulmonary-hypertension` identity; no generic downstream relationship was approved.
- `diaphragm-paralysis`: sleep-disordered-breathing evidence does not establish obstructive sleep apnea as the appropriate downstream catalog diagnosis.
- `narcolepsy`: depression is a recognized comorbidity signal, but the screened meta-analysis is heterogeneous and does not establish a directional narcolepsy-primary depressive-disorder pathway.
- `keratitis`: infectious keratitis can cause severe visual impairment, but the current identity is broader than infectious keratitis; the batch does not publish a generic keratitis-primary visual-impairment relationship from subtype-limited evidence.
- `dry-eye-syndrome`: filamentary keratitis and other corneal complications are described, but the broad generic `keratitis` target would overgeneralize a subtype-specific ocular-surface relationship.
- `nystagmus`: visual-function literature is strongly phenotype-dependent, especially for infantile nystagmus, while the catalog identity deliberately includes other nystagmus types.

A safe draft is a reviewed product state, not a defect.

## Evidence-quality withdrawals used for the citation-debt exchange

Three unverified published association/comorbidity edges are withdrawn while three stronger direct-complication/functional-loss mappings are added:

1. `anosmia` → `depressive-disorder` is withdrawn. The cited 2026 systematic review/meta-analysis found associations between olfactory impairment and depression but called for longitudinal/mechanistic work to clarify causal pathways; the objective-olfaction signal attenuated after publication-bias adjustment in the primary pooled analysis.
2. `alopecia-areata` → `depressive-disorder` is withdrawn. The cited meta-analysis supports elevated prevalence/odds and psychiatric screening, but it is a comorbidity signal rather than directional evidence that alopecia areata causes or aggravates a depressive disorder.
3. `hypothyroidism` → `depressive-disorder` is withdrawn. The cited meta-analysis found a modest overall association, stronger in overt disease and in a post hoc female subgroup but not in men; it does not support a general directional secondary-condition pathway.

All three removed references were `verified: false`; therefore no verified-source retirement record is created.

## Citation-debt position

The three new clinical references are exchanged one-for-one with the three withdrawn unverified published references. Expected Batch 27 citation position remains:

- live references: **70**;
- live verified: **8**;
- retired verified: **6**;
- verified provenance: **14**;
- live unverified: **62**;
- published-unverified review findings: **60**;
- live clinical-evidence references with canonical URLs: **65**;
- retired clinical-evidence URLs: **4**;
- clinical-URL provenance: **69**.

The repository citation audit on the immutable branch head is authoritative; these counts are not considered closed until that audit passes.

## Disposition impact

After the Batch 27 candidate changes:

- published-evidence-led Wave 1–7 identities: **31**;
- promotion candidates: **0**;
- safe drafts: **76**.

No catalog identity is added, removed, renamed, or merged.

## Verification boundary

Automated retrieval, source metadata checks, and evidence screening are preparation activities only. Every newly authored Batch 27 source remains `verified: false`; only a qualified human reviewer may make and record a `verified: true` decision under repository policy.

## Closure requirement

The exact final branch head must pass citation audit, knowledge-base validation, lint, typecheck, critical-module composition, the one-shot test suite, production build, real-browser journeys, diagnostics, and aggregate fail-safe. The exact validated head must then complete immutable-head review and protected merge, followed by independent `main` CI and Production Runtime Readiness on the resulting merge SHA before Wave 5 advances.
