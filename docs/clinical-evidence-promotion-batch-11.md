# Clinical Evidence Promotion Batch 11

Batch 11 preserves the exact **300 catalog / 300 knowledge-base** integrity contract while adding two legacy endocrine evidence promotions, repairing one respiratory edge, withdrawing unsafe unsupported respiratory claims, and completing one bounded endocrine catalog relocation.

## Association-focused promotion: hypothyroidism → depressive disorder

- `hypothyroidism` → `depressive-disorder` is published only as population-level association-focused research.
- The supporting systematic review/meta-analysis included 25 studies and 348,014 participants and found a modest overall association, stronger for overt than subclinical hypothyroidism, with important subgroup uncertainty.
- No causal pathway metadata is authored. Individual development still requires thyroid phenotype/status, chronology, treatment response, psychiatric history, medication, sleep, pain, substance-use, and psychosocial review.
- The source remains `verified: false`; source checking does not constitute qualified-human citation verification.

## Bounded progression promotion: hypogonadism → osteoporosis

- `hypogonadism` → `osteoporosis` is published only for confirmed clinical hypogonadism/testosterone deficiency rather than an isolated or transient low testosterone value.
- The European Academy of Andrology bone-health guideline supports formal bone-health assessment and DXA in men with confirmed hypogonadism and recognizes testosterone-deficiency-associated bone loss/frailty.
- The pathway expressly preserves competing osteoporosis causes and records the guideline's uncertainty that testosterone replacement prevents fractures.
- Individual development includes repeated biochemical confirmation, DXA/fracture-risk assessment, chronology, competing endocrine/medication/lifestyle causes, and treatment trajectory.

## Respiratory repair: interstitial lung disease → sleep apnea

- `interstitial-lung-disease` → `sleep-apnea` replaces its prior legal-only support with a systematic review/meta-analysis of 10 studies and 569 ILD patients that found obstructive sleep apnea in 61%.
- The mapping remains association/prevalence-focused because the meta-analysis does not establish that ILD causes or aggravates OSA in an individual.
- The old `interstitial-lung-disease` → `cardiac-arrhythmia` edge is removed because its only support was a rating citation and the repository did not identify condition-specific evidence sufficient to preserve that proposition in this batch.

## Safety withdrawal: pulmonary fibrosis

- `pulmonary-fibrosis` is returned to draft and both prior sleep-apnea and cardiac-arrhythmia suggestions are removed because they were supported only by legal/rating authority.
- Strong OSA evidence identified during review was specific to idiopathic pulmonary fibrosis. The repository does not generalize IPF-specific evidence to the broader `pulmonary-fibrosis` identity without a subtype-bounded representation.

## Bounded identity/modeling cleanup

- `hypoparathyroidism` is physically moved from the historical `neurological.json` placement into `endocrine.json` while preserving its stable ID and the Batch-10 published KB relationship.
- The display name is normalized to **Hypoparathyroidism**, and the 38 CFR 4.119 / DC 7905 endocrine rating framework is recorded with `verified: false` preserved.
- `hypothyroidism` intentionally remains in the historical neurological file for a later bounded maintenance batch rather than being mass-moved together.

## Citation position

Batch 11 tightens the automated non-regression ratchet to:

- total references: **130**;
- verified: **14**;
- unverified: **116**;
- published-unverified review findings: **114**;
- clinical-evidence references with canonical URLs: **at least 49**.

Four legacy legal/rating references are retired across pulmonary fibrosis and ILD, while three condition-specific clinical references are added. No source is automatically promoted to `verified: true`.

## Expansion state

Hypothyroidism, hypogonadism, interstitial lung disease, pulmonary fibrosis, and hypoparathyroidism are legacy catalog identities rather than Wave 1-7 additions. Batch 11 therefore does not change the expansion-promotion ledger: **12 Wave 1-7 mappings remain individually promoted and 95 of the 107 expansion mappings remain safe drafts**. The overall catalog and KB universe remains frozen at 300/300.
