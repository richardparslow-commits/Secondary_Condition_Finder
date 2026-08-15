# Clinical Evidence Promotion Batch 28 — Wave 5 Rescreen

Status: implementation candidate pending exact-head validation, immutable-head review, protected merge, independent `main` CI, and production runtime closure.

## Production-validated base

Batch 28 branches from exact `main` SHA `f07b11e1df647269e6922701610dec7d18c47f77` (`Promote evidence-led Wave 4 mappings (#351)`). That SHA passed independent `main` CI #1001 and Production Runtime Readiness #360 before this branch was created.

## Scope and governance

Batch 28 re-screens Wave 5 while preserving the frozen **300 / 300** catalog/knowledge-base universe and the **107-identity** Wave 1–7 disposition universe.

Publication remains evidence-led: rating authority is not medical nexus evidence; manifestations are not converted into downstream diagnoses merely because they are clinically related; relationship direction, phenotype, procedure, anatomy, and mechanism are kept narrower than the source permits; and every newly authored source remains `verified: false` pending qualified-human review.

## Evidence-led Wave 5 promotions

### `rectal-prolapse` → `fecal-incontinence`

Fecal incontinence is frequently associated with full-thickness rectal prolapse. Prospective cohort evidence directly measuring continence before and after prolapse treatment found that continence improvement was associated with ventral rectopexy compared with other operative or medical management. The mapping requires clinically documented fecal incontinence with compatible prolapse anatomy/chronology and explicitly addresses competing sphincter, pelvic-floor, neurologic, stool-consistency, and surgical causes; the treatment-response evidence does not justify sole-cause attribution.

Clinical source: *Long-term impact of full-thickness rectal prolapse treatment on fecal incontinence*, PMID 25869649. The source remains `verified: false`.

### `anal-fistula` → `fecal-incontinence`

This is not a generic fistula-primary relationship. It is limited to a **treatment-complication** pathway after documented sphincter-cutting or sphincter-involving fistula treatment, such as fistulotomy when applicable, followed by new or materially worsened continence impairment. The source's generally low study quality is preserved as an explicit development limitation.

Clinical source: Litta et al., *Techniques in Coloproctology* 2021; PMID 33387100. The source remains `verified: false`.

### `hydronephrosis` → `chronic-kidney-disease`

Hydronephrosis is an imaging finding and is not synonymous with obstruction or obstructive nephropathy. The published pathway therefore requires a separately documented urinary obstruction producing hydronephrosis plus persistent renal dysfunction compatible with the obstruction's severity, duration, laterality, chronology, and response to decompression. Hydronephrosis alone is insufficient to infer CKD.

Clinical source: Yaxley & Yaxley, *World Journal of Nephrology* 2023; PMID 36704657. The review identifies obstructive uropathy as an important cause of both acute and chronic kidney disease. The source remains `verified: false`.

## Wave 5 safe-draft dispositions retained

The remaining unpublished Wave 5 identities stay intentionally draft:

- `esophageal-stricture`: the most established direction is upstream reflux/injury causing stricture rather than a clean downstream catalog relationship from stricture.
- `gastroparesis`: GERD/motility overlap and mechanistic plausibility did not meet the threshold for a clean directional gastroparesis-primary publication.
- `peritoneal-adhesions`: bowel obstruction is a classic complication, but the catalog has no sufficiently specific bowel-obstruction target to publish without target substitution.
- `short-bowel-syndrome`: malabsorption and micronutrient deficiencies are well established, but screening did not identify a sufficiently target-specific anemia relationship for this batch without overgeneralizing heterogeneous deficiency states.
- `fecal-incontinence`: retained as a target identity; no separate downstream relationship met the threshold.
- `varicocele-hydrocele`: infertility would be a natural development domain, but the catalog lacks an infertility target and the batch does not substitute erectile dysfunction or another diagnosis.
- `epididymitis-orchitis`: likewise, fertility complications do not justify substituting an unsupported downstream catalog diagnosis.

`achalasia`, `barretts-esophagus`, `chronic-liver-disease`, `chronic-pyelonephritis`, and `urethral-stricture` were already published before Batch 28 and are unchanged.

## Evidence-quality withdrawals used for the citation-debt exchange

Three unverified Wave 1 depression edges are returned to safe-draft:

1. `gout` → `depressive-disorder`: the evidence supports a modest population association and incident-depression signal but does not establish individual causation or aggravation; the systematic-review literature calls for further work on causal direction/onset.
2. `myasthenia-gravis` → `depressive-disorder`: the attached systematic review/meta-analysis is prevalence-focused and supports psychiatric screening/comorbidity awareness rather than a directional MG-primary secondary-condition pathway.
3. `multiple-sclerosis` → `depressive-disorder`: the attached systematic review/meta-analysis estimates prevalence with substantial unexplained heterogeneity and does not establish an MS-to-depression causal or aggravation pathway.

`seizure-disorder` → `depressive-disorder` is intentionally retained because separate meta-analytic evidence includes cohort risk estimates and is stronger than a prevalence-only signal.

All three withdrawn source rows were `verified: false`, so no verified-source retirement record is created.

## Citation-debt and disposition position

The three new clinical references are exchanged one-for-one with the three withdrawn unverified published references. Expected citation ceilings therefore remain unchanged pending exact-head audit:

- live references: **70**;
- live verified: **8**;
- retired verified: **6**;
- verified provenance: **14**;
- live unverified: **62**;
- published-unverified review findings: **60**;
- live clinical-evidence references with canonical URLs: **65**;
- retired clinical-evidence URLs: **4**;
- clinical-URL provenance: **69**.

The Wave disposition totals also remain **31 published-evidence-led / 0 promotion-candidate / 76 safe-draft** because three publications are added and three lower-value publications are withdrawn.

## Verification boundary

Automated retrieval, source metadata checking, and evidence screening are preparation activities only. Every newly authored Batch 28 source remains `verified: false`; only a qualified human reviewer may make and record a `verified: true` decision under repository policy.

## Closure requirement

The exact final branch head must pass citation audit, knowledge-base validation, lint, typecheck, critical-module composition, the one-shot test suite, production build, real-browser journeys, diagnostics, and aggregate fail-safe. The exact validated head must then complete immutable-head review and protected merge, followed by independent `main` CI and Production Runtime Readiness on the resulting merge SHA before Wave 6 advances.
