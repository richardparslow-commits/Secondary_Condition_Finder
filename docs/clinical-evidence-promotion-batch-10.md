# Clinical Evidence Promotion Batch 10

Batch 10 preserves the exact **300 catalog / 300 knowledge-base** integrity contract while promoting two legacy endocrine mappings with condition-specific clinical evidence, withdrawing two unsafe respiratory mappings, and completing one bounded endocrine catalog relocation.

## Promotion: primary hyperparathyroidism → kidney stones

- `hyperparathyroidism` → `kidney-stones` is published only for a **confirmed primary-hyperparathyroidism phenotype**.
- The Fifth International Workshop guideline is used as condition-specific clinical evidence for renal stone involvement in primary hyperparathyroidism.
- The broader catalog identity is not treated as proof that secondary or tertiary hyperparathyroidism has the same relationship.
- Development requires calcium/PTH biochemistry, renal imaging and stone chronology, urinary calcium/metabolic-stone evaluation when available, and review of competing stone causes.
- The source remains `verified: false`; source checking is not qualified-human citation verification.

## Promotion: chronic hypoparathyroidism → kidney stones

- `hypoparathyroidism` → `kidney-stones` is published as an **association-focused** research relationship rather than a causal pathway.
- The supporting 2022 systematic review included 93 studies and 18,973 patients and identified nephrocalcinosis/nephrolithiasis among complications probably associated with chronic hypoparathyroidism.
- Individual review must distinguish the underlying calcium-phosphate disorder, conventional calcium/active-vitamin-D treatment context, urine-calcium findings, renal function, stone chronology, and other stone etiologies.
- No `pathwayIntelligence` is authored for this edge because the available evidence does not justify collapsing disease and treatment contributions into one causal chain.

## Safety withdrawals: emphysema and chronic bronchitis

- `emphysema` is returned to draft. Its sleep-apnea and cardiac-arrhythmia propositions used only 38 CFR 3.310 / 38 CFR 4.104 while asserting medical mechanisms.
- `chronic-bronchitis` is returned to draft for the same reason: the two published medical propositions were supported only by legal/rating authority.
- These relationships may be rebuilt later only with condition-specific clinical evidence; the batch does not preserve them merely to avoid reducing published coverage.

## Bounded identity/modeling cleanup

- `hyperparathyroidism` is physically moved from the historical `neurological.json` placement into `endocrine.json` while preserving its stable ID.
- The display name is normalized to **Hyperparathyroidism**, and the 38 CFR 4.119 / DC 7904 endocrine rating framework is recorded with `verified: false` preserved.
- `hypoparathyroidism` and `hypothyroidism` remain in the historical neurological file for later bounded maintenance rather than being mass-moved in this batch.

## Citation position

Batch 10 tightens the automated non-regression ratchet to:

- total references: **131**;
- verified: **14**;
- unverified: **117**;
- published-unverified review findings: **115**;
- clinical-evidence references with canonical URLs: **at least 46**.

Four unsafe unverified respiratory references are retired and two new clinical references are added. No source is automatically promoted to `verified: true`.

## Expansion state

Hyperparathyroidism and hypoparathyroidism are legacy catalog identities rather than Wave 1-7 additions, so Batch 10 does not change the expansion-promotion ledger: **12 Wave 1-7 mappings remain individually promoted and 95 of the 107 expansion mappings remain safe drafts**. The overall catalog and KB universe remains frozen at 300/300.
