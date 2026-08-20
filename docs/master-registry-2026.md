# Master Relationship & Evidence Registry 2026

## Status

The authoritative registry is at Mapping Expansion Batch ME-4 implementation state, derived from closed baseline `20485862319f6a79ecdfce73778c84a3300e5bc0`. The five ME-4 citations remain pending separate qualified-human citation verification.

## Current state

- 193 relationships.
- 119 explicit publication guards / 74 legacy rationale boundaries.
- 201 live relationship-source uses: 196 verified / 5 pending verification.
- 173 active source entities: 172 clinical + 1 legal authority.
- 5 pending-verification clinical source entities.
- 7 superseded-unverified, 1 correction-only, and 1 retired-only source entity.
- 187 total source entities including lineage/history.
- 6 retired-verified relationship-source uses preserved.

## Verification-state contract

Live `verified:true` KB sources map to master status `active`. Live `verified:false` clinical sources map to `pending-verification`. Mapping approval and PubMed identity matching never authorize citation promotion. Promotion requires a separate qualified-human citation-verification decision and an atomic KB/master-source state transition.

## ME-4 implementation

The five ME-4 relationships are installed at rank 2 with `sometimes-explored` prevalence and one clinical source each. All five new sources remain `verified:false` / `pending-verification`.

The approved source refinement for `endometriosis -> depressive-disorder` uses PMID 41308609 instead of discovery PMID 34077695.

No new taxonomy identity, publication-status change, rating code, or `pathwayIntelligence` was introduced. The publication guards preserve phenotype limits, competing causes, and population-level association/risk boundaries. A pending source does not establish an individual VA medical nexus.
