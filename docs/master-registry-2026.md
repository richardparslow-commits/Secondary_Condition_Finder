# Master Relationship & Evidence Registry 2026

## Status

The authoritative registry is at the Mapping Expansion Batch ME-6 **pre-qualified-human-citation-verification** state derived from the fully verified ME-5 baseline `3e47fae71adf4ab80e7804076c36e2c839790e17`.

## Current state

- 203 relationships.
- 129 explicit publication guards / 74 legacy rationale boundaries.
- 211 live relationship-source uses: 206 verified / 5 pending verification.
- 183 active source entities plus 5 pending-verification clinical source entities.
- 182 active clinical sources + 5 pending clinical sources + 1 active legal authority.
- 197 total source entities including lineage/history.
- 6 retired-verified relationship-source uses preserved.

## ME-6 implementation boundary

ME-6 adds exactly five rank-2, `sometimes-explored` relationships:
- `hyperaldosteronism -> cardiac-arrhythmia` restricted to separately documented atrial fibrillation and confirmed primary aldosteronism.
- `testicular-cancer -> erectile-dysfunction` restricted to actual supported treatment exposure and compatible post-treatment chronology.
- `ovarian-cancer -> lymphedema` restricted to lower-extremity lymphedema after documented lymph-node dissection/lymphadenectomy.
- `chronic-liver-disease -> anemia` restricted to advanced chronic liver disease with portal-hypertension or comparable advanced-disease features.
- `chronic-pyelonephritis -> hypertension` restricted to reflux-nephropathy / pyelonephritic renal-scarring phenotype.

All five new sources remain `verified:false` in the KB and `pending-verification` in the normalized master-source registry. PubMed PMID/DOI identity confirmation does not authorize citation promotion.

No new taxonomy identity, publication-status change, diagnostic/rating code, or `pathwayIntelligence` field is introduced. The approved publication guards remain the live semantic boundaries. Treatment-complication rows require actual treatment exposure and compatible chronology; population-level association/prevalence/risk evidence is not converted into individual causation.

## Verification-state contract

A later qualified-human citation review must explicitly disposition each of the five ME-6 sources before any `verified:false -> true` / `pending-verification -> active` transition occurs. Promotion must atomically update KB and master-source state and remain subject to authoritative parity audit.
