# Clinical Evidence Promotion Batch 12

Batch 12 preserves the exact **300 catalog / 300 knowledge-base** integrity contract while clinically repairing two legacy upper-airway relationships, removing two unsupported arrhythmia claims, and completing the final bounded thyroid relocation from the historical neurological catalog.

## Chronic rhinitis → sleep apnea

- `chronic-rhinitis` retains only its `sleep-apnea` relationship.
- The supporting 2025 systematic review/meta-analysis included 12 adult studies and 19,203 participants and found higher polysomnography-diagnosed OSA frequency among patients with allergic rhinitis.
- Because the catalog identity `chronic-rhinitis` is broader than allergic rhinitis, the published relationship is expressly limited to a **documented allergic-rhinitis phenotype**.
- The relationship remains association-focused and has no `pathwayIntelligence`; population-level association does not establish individual causation or aggravation.
- The prior `chronic-rhinitis` → `cardiac-arrhythmia` edge is removed because its only support was legal/rating authority.

## Chronic sinusitis → sleep apnea

- `chronic-sinusitis` retains only its `sleep-apnea` relationship.
- The supporting 2026 CRS systematic review/meta-analysis and Mendelian-randomization study included 14 observational studies and 30,509 participants, finding 20% OSA prevalence among CRS patients and a modest higher OSA risk.
- The repository deliberately keeps the relationship association-focused even though the MR analysis supports a directional CRS-to-OSA signal; population/genetic evidence is not converted into an automatic individual medical nexus.
- The prior `chronic-sinusitis` → `cardiac-arrhythmia` edge is removed because its only support was legal/rating authority.

## Bounded identity/modeling cleanup

- `hypothyroidism` is physically moved from the historical `neurological.json` placement into `endocrine.json` while preserving its stable ID and Batch-11 published depression relationship.
- The display name is normalized to **Hypothyroidism** and the 38 CFR 4.119 / DC 7903 endocrine rating framework is recorded with `verified: false` preserved.
- This completes the bounded sequence that moved Cushing's syndrome, Type 1 diabetes, hyperthyroidism, hyperparathyroidism, hypoparathyroidism, and hypothyroidism out of the historical neurological placement without changing the 300-condition universe.

## Citation position

Batch 12 tightens the automated non-regression ratchet to:

- total references: **128**;
- verified: **14**;
- unverified: **114**;
- published-unverified review findings: **112**;
- clinical-evidence references with canonical URLs: **at least 51**.

Four legacy legal/rating references are retired across chronic rhinitis and chronic sinusitis and two condition-specific clinical references are added. No source is automatically promoted to `verified: true`.

## Expansion state

All Batch-12 relationships are legacy catalog mappings rather than Wave 1-7 additions. The expansion-promotion ledger therefore remains **12 Wave 1-7 mappings individually promoted / 95 of 107 expansion mappings still draft**. The overall catalog and knowledge-base universe remains frozen at 300/300.
