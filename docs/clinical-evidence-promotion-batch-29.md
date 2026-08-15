# Clinical Evidence Promotion Batch 29 — Wave 6 Rescreen

Status: implementation candidate pending exact-head validation, immutable-head review, protected merge, independent `main` CI, and production runtime closure.

## Production-validated base

Batch 29 branches from exact `main` SHA `c8ad197e8df420034579ba644e60f9cec0168a8d` (`Promote evidence-led Wave 5 mappings (#352)`). That SHA passed independent `main` CI #1021 and Production Runtime Readiness #380 before this branch was created.

## Scope and governance

Batch 29 re-screens all 14 Wave-6 identities while preserving the frozen **300 / 300** catalog/knowledge-base universe and the **107-identity** Wave 1–7 disposition universe.

Publication remains evidence-led: rating authority is not medical nexus evidence; symptom overlap and diagnostic comorbidity do not become directional secondary relationships by default; manifestations are not converted into separate downstream diagnoses without a distinct supported phenotype; catalog targets must fit the source phenotype; and every newly authored clinical source remains `verified: false` pending qualified-human review.

## Evidence-led Wave 6 promotion

### `discoid-lupus` → `scarring-alopecia`

The publication is limited to **scalp discoid lupus erythematosus** with a distinct clinical or dermatopathologic diagnosis of cicatricial/scarring alopecia. The source directly studies scarring damage in DLE and reports perifollicular inflammatory infiltration in DLE scarring-alopecia lesions. Repository wording therefore preserves the anatomic and phenotype boundary: non-scalp DLE, nonscarring lupus-associated hair loss, alopecia areata, and systemic lupus erythematosus are not treated as interchangeable.

Clinical source: Li et al., *Lupus* 2022, PMID 35817588. The source remains `verified: false`.

## Evidence-quality withdrawal

### `adjustment-disorder` → `gerd`

The prior live source, PMID 35362447, is a systematic review/meta-analysis of psychosocial disorders and GERD whose reported psychiatric categories and subgroup analyses are centered on **anxiety and depression**. It does not provide adjustment-disorder-specific exposure evidence. The edge is therefore returned to draft rather than widening anxiety/depression evidence to a different diagnosis.

The removed source was `verified: false`, so no verified-source retirement record is created.

## Wave 6 safe-draft dispositions retained

The remaining 13 Wave-6 identities stay intentionally draft:

- `specific-phobia`: screened downstream psychiatric candidates remain dominated by overlap/comorbidity rather than a clean phobia-primary directional relationship.
- `dissociative-disorder`: psychiatric comorbidity and trauma-linked evidence does not establish a distinct downstream catalog diagnosis from the scoped dissociative-amnesia/dissociative-identity phenotype.
- `depersonalization-derealization-disorder`: available psychiatric overlap evidence does not support a clean downstream secondary diagnosis with stable direction.
- `functional-neurological-symptom-disorder`: depression, anxiety, trauma, pain, and neurologic comorbidity are clinically important but do not provide a sufficiently clean FND-primary downstream diagnosis for publication.
- `illness-anxiety-disorder`: anxiety/depressive and somatic overlap does not establish a separate directional downstream catalog relationship.
- `body-dysmorphic-disorder`: OCD/depression/anxiety comorbidity is not converted into an individual directional secondary diagnosis.
- `hoarding-disorder`: OCD-spectrum, depressive, and anxiety comorbidity remains nondirectional for this purpose.
- `delusional-disorder`: mood/anxiety and other psychiatric comorbidity does not meet the condition-specific directional threshold.
- `essential-thrombocythemia`: thrombotic complications are well established, but screened studies commonly combine arterial events, conventional venous thromboembolism, and splanchnic thrombosis or focus on high-risk ET. The current catalog target `deep-vein-thrombosis` is narrower than that evidence set, so no DVT-specific edge is forced.
- `primary-myelofibrosis`: anemia/cytopenias are core disease manifestations, while leukemic transformation evidence is primarily AML-specific. The generic catalog target `leukemia` spans acute and chronic disease and is too broad for an AML-only progression claim.
- `myelodysplastic-syndrome`: cytopenias are core manifestations and transformation evidence is specifically to secondary AML; the generic acute/chronic `leukemia` target is not substituted for AML.
- `scarring-alopecia`: psychosocial burden and psychiatric comorbidity are clinically relevant but do not establish a clean alopecia-primary directional secondary diagnosis.
- `hyperhidrosis`: anxiety/depression associations and autonomic symptom overlap are insufficiently directional for a bounded hyperhidrosis-primary secondary diagnosis.

A safe draft is a completed reviewed disposition, not a defect.

## Citation-debt position

Batch 29 performs a one-for-one evidence-quality replacement: one phenotype-mismatched unverified published source is removed and one condition-specific unverified clinical source is added. The expected citation position therefore remains:

- live references: **69**;
- live verified: **8**;
- retired verified: **6**;
- verified provenance: **14**;
- live unverified: **61**;
- published-unverified review findings: **59**;
- live clinical-evidence references with canonical URLs: **64**;
- retired clinical-evidence URLs: **4**;
- clinical-URL provenance: **68**.

The Wave disposition totals become **31 published-evidence-led / 0 promotion-candidate / 76 safe-draft**.

## Verification boundary

Automated retrieval and source screening are preparation activities only. The new DLE source remains `verified: false`; only a qualified human reviewer may record `verified: true` under repository policy.

## Closure requirement

The exact final branch head must pass citation audit, knowledge-base validation, lint, typecheck, critical-module composition, the one-shot test suite, production build, real-browser journeys, diagnostics, and aggregate fail-safe. The exact validated head must then complete immutable-head review and protected merge, followed by independent `main` CI and Production Runtime Readiness on the resulting merge SHA before Wave 7 advances.
