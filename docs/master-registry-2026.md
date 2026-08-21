# Master Relationship & Evidence Registry 2026

## Status

The authoritative registry is at the Mapping Expansion Batch ME-5 **pre-qualified-human-citation-verification** state derived from the formally closed ME-4 baseline `16dbdc93bd4f2650829d46f64d567845f50c81d5`.

## Current state

- 198 relationships.
- 124 explicit publication guards / 74 legacy rationale boundaries.
- 206 live relationship-source uses: 201 verified / 5 pending verification.
- 178 active source entities plus 5 pending-verification clinical source entities.
- 177 active clinical sources + 5 pending clinical sources + 1 active legal authority.
- 192 total source entities including lineage/history.
- 6 retired-verified relationship-source uses preserved.

## ME-5 implementation boundary

ME-5 adds exactly five rank-2, `sometimes-explored` relationships:
- `celiac-disease -> osteoporosis`
- `diabetes-mellitus-type-1 -> diabetic-retinopathy`
- `pulmonary-fibrosis -> pulmonary-hypertension`
- `polycystic-ovary-syndrome -> depressive-disorder`
- `multiple-myeloma -> anemia`

All five new sources remain `verified:false` in the KB and `pending-verification` in the normalized master-source registry. PubMed PMID/DOI identity confirmation does not authorize citation promotion.

No new taxonomy identity, publication-status change, diagnostic/rating code, or `pathwayIntelligence` field was introduced. The approved publication guards remain the live semantic boundaries and population-level association/prevalence evidence is not converted into an individual causation claim.

## Verification-state contract

A later qualified-human citation review must explicitly disposition each of the five ME-5 sources before any `verified:false -> true` / `pending-verification -> active` transition occurs. Such promotion must atomically update the KB and master-source state and remain subject to the authoritative parity audit.
