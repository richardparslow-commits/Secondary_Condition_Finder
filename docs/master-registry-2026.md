# Master Relationship & Evidence Registry 2026

## Status

The authoritative registry is at the fully qualified-human-verified Mapping Expansion Batch ME-5 state, derived from implementation commit `cae78395cb18b2fe7b581950d6024bba9a2b0e29`.

## Current state

- 198 relationships.
- 124 explicit publication guards / 74 legacy rationale boundaries.
- 206 live relationship-source uses: 206 verified / 0 pending verification.
- 183 active source entities: 182 clinical + 1 legal authority.
- 0 pending-verification source entities.
- 7 superseded-unverified, 1 correction-only, and 1 retired-only source entity.
- 192 total source entities including lineage/history.
- 6 retired-verified relationship-source uses preserved.

## ME-5 qualified-human citation verification

All five ME-5 sources were approved as implemented:
- 5 approve-as-implemented.
- 0 approve-with-narrowing.
- 0 source replacements.
- 0 rejects/withdrawals.

The five relationship entities and all five publication guards are unchanged from implementation. PMID, DOI, citation text, source URL, rank, prevalence, taxonomy, publication status, and pathwayIntelligence state are unchanged.

## Verification-state contract

Live `verified:true` KB sources map to master status `active`. Mapping approval and PubMed identity matching do not authorize citation promotion. Qualified-human approval is recorded in each promoted source's `verificationState`, and the registry parity audit permits the documented verification-only transition by normalizing `verified:true` back to the stored `verified:false` snapshot for hash comparison.

No source in ME-5 was narrowed, replaced, or rejected. A verified population-level source still does not, by itself, establish an individual VA medical nexus.
