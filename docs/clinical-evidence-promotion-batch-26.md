# Clinical Evidence Promotion Batch 26 — Wave 3 Rescreen

Status: implementation candidate pending exact-head validation, immutable-head review, protected merge, independent `main` CI, and production runtime closure.

## Production-validated base

Batch 26 branches from exact `main` SHA `daef29ca44e498a9b375fe868c813866f82ffd37` (`Promote evidence-led Wave 2 FAI mapping (#349)`). That SHA passed independent `main` CI #984 and Production Runtime Readiness #343 before this branch was created.

## Scope and governance

Batch 26 re-screens the Wave 3 identities that remained `safe-draft` after prior evidence batches. The frozen catalog/knowledge-base universe remains **300 / 300**, and the Wave 1–7 disposition universe remains **107 identities**.

Publication remains evidence-led:

- rating-schedule authority is not medical nexus evidence;
- association, complication, treatment, and intermediate-chain language is kept narrower than the source permits;
- no relationship is published merely to reduce the draft count;
- each newly authored clinical source remains `verified: false` pending qualified-human review; and
- the citation audit is treated as a hard review-debt ratchet rather than a target to reset.

## Evidence-led Wave 3 promotions

### `hyperpituitarism` → `hypogonadism`

The catalog identity is explicitly scoped to **prolactin-secreting pituitary dysfunction**, not generic hyperpituitarism. In men with prolactinoma, sustained prolactin elevation can suppress the hypothalamic-pituitary-gonadal axis, while larger tumors can additionally impair gonadotroph function through mass effect. The mapping therefore requires a documented prolactin-secreting phenotype, clinically and biochemically confirmed hypogonadism, compatible pituitary/gonadal laboratory findings, chronology, and review of alternative causes.

Clinical source: Rudman & Shimon, *Vitam Horm.* 2025; PMID 40812946. The review describes hypogonadism in men with prolactinoma and identifies both prolactin-mediated HPG-axis suppression and tumor mass effect as mechanisms. The source remains `verified: false`.

### `pituitary-neoplasm` → `visual-impairment`

Pituitary macroadenomas or other pituitary neoplasms with suprasellar extension can compress the optic chiasm or other optic-pathway structures and produce visual-field or visual-acuity impairment. The mapping is explicitly anatomy-specific and does not imply that a small or incidental pituitary lesion without optic-pathway involvement causes visual impairment.

Clinical source: Pelsma et al., *Pituitary* 2020; PMID 32419072. The systematic review/cohort work addresses nonfunctioning pituitary macroadenomas with chiasmal compression, visual dysfunction, and visual outcomes after decompression. The source remains `verified: false`.

### `heart-valve-replacement-residuals` → `anemia`

The relationship is limited to a documented prosthetic-valve **paravalvular leak → mechanical hemolysis → hemolytic anemia** chain. Prosthetic-valve status alone is insufficient. The mapping requires imaging evidence of the leak, laboratory characterization of hemolysis/anemia, compatible chronology, and evaluation of competing anemia causes.

Current clinical source: Alkhouli et al., *Clin Cardiol.* 2019; PMID 31039274 (PMCID PMC6605004). The review addresses cardiac-prosthesis-related hemolytic anemia and includes paravalvular-leak-associated hemolysis after valve replacement. Citation Verification Batch 05 replaced the prior source one-for-one and records qualified-human verification on 2026-08-18; the live mapping remains limited to documented prosthetic dysfunction/leak → objective hemolysis → hemolytic anemia rather than valve-replacement status alone.

### `implantable-cardiac-pacemaker` → `heart-valve-disorders`

The relationship is limited to **transvenous lead-associated tricuspid regurgitation**. The mapping requires a lead crossing the tricuspid valve, objective post-implant valve worsening, and individual review of lead interference, chronology, and competing causes. It is not generalized to leadless or epicardial systems without applicable evidence.

Clinical source: *Incidence, Risk Factors, and Prognosis of Tricuspid Regurgitation After Cardiac Implantable Electronic Device Implantation: A Systematic Review and Meta-analysis*, PMID 34389210. The review reports tricuspid-regurgitation deterioration after CIED implantation and identifies lead interference as an important risk factor. The source remains `verified: false`.

## Wave 3 safe-draft dispositions retained

The other five previously unpublished Wave 3 identities remain intentionally draft after the bounded re-screen:

- `nontoxic-thyroid-enlargement`: benign thyroid enlargement can cause compressive symptoms, but the current catalog does not provide a clean disease-level downstream target that can be published without converting manifestations such as dysphagia/dyspnea into unsupported secondary diagnoses.
- `diabetes-insipidus`: current screening did not identify a sufficiently specific downstream catalog disease relationship that meets the publication threshold.
- `coronary-bypass-residuals`: postoperative complications and graft-related outcomes are clinically important, but no current target was supported at the required specificity as a routine secondary-condition suggestion.
- `heart-transplant-residuals`: chronic kidney disease after nonrenal transplantation is well described, but the pathophysiology is multifactorial and current evidence does not justify a clean heart-transplant-primary causal mapping without over-attributing calcineurin-inhibitor nephrotoxicity or other post-transplant factors.
- `thromboangiitis-obliterans`: ulceration, ischemia, and amputation are disease outcomes, but the current catalog lacks a sufficiently specific downstream disease target for a new general secondary mapping.

## Evidence-quality withdrawals used for the citation-debt exchange

Four unverified published source rows are removed while the underlying repository becomes more conservative:

1. `adjustment-disorder` → `sleep-apnea` is withdrawn. Its psychiatric/OSA systematic review did not establish an adjustment-disorder-specific relationship and the prior mapping over-generalized beyond the studied psychiatric phenotypes.
2. `asthma` → `cardiac-arrhythmia` is withdrawn. The attached asthma/atrial-fibrillation meta-analysis reported high heterogeneity, serious risk of bias, and very-low confidence; that signal is not retained as a routine secondary-condition suggestion.
3. `copd` → `cardiac-arrhythmia` is withdrawn. The attached 1990 physiologic cohort was small and supported only a possible nocturnal desaturation/arrhythmia mechanism, not a sufficiently robust COPD-primary disease relationship for routine publication.
4. `post-concussion-syndrome` → `migraine-headaches` is withdrawn and returned to draft. Its source supported persistent post-traumatic headache and phenotype-guided treatment; it did not establish that migraine-like post-traumatic headache should be reclassified as primary migraine, so the catalog target and source phenotype were mismatched.

All four removed references were `verified: false`; therefore no verified-source retirement record is created.

## Citation-debt position

The four new clinical references are exchanged one-for-one with the four withdrawn unverified published references. Expected Batch 26 citation position remains:

- live references: **70**;
- live verified: **8**;
- retired verified: **6**;
- verified provenance: **14**;
- live unverified: **62**;
- published-unverified review findings: **60**;
- live clinical-evidence references with canonical URLs: **65**;
- retired clinical-evidence URLs: **4**;
- clinical-URL provenance: **69**.

The exact counts remain subject to the repository citation audit on the immutable branch head. No count is treated as closed until that audit passes.

## Disposition impact

After the Batch 26 candidate changes:

- published-evidence-led Wave 1–7 identities: **28**;
- promotion candidates: **0**;
- safe drafts: **79**.

No catalog identity is added, removed, renamed, or merged.

## Verification boundary

Automated source retrieval, metadata checking, and evidence screening are preparation activities only. Every newly authored source in this batch remains `verified: false`; only a qualified human reviewer may make and record a `verified: true` decision under repository policy.

## Closure requirement

Batch 26 is not production-closed by documentation or branch implementation. The exact final branch head must pass citation audit, knowledge-base validation, lint, typecheck, critical-module composition, the one-shot test suite, production build, real-browser journeys, diagnostics, and aggregate fail-safe. The exact validated head must then complete immutable-head review and protected merge, followed by independent `main` CI and production runtime readiness on the resulting merge SHA before Wave 4 work advances.
