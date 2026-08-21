# Master Relationship & Evidence Registry 2026

## Status

The authoritative registry is at the fully qualified-human-verified Mapping Expansion Batch ME-4 state, derived from implementation commit `196b37b92d76827e4030da1afb25fd4165066cdb`.

## Current state

- 193 relationships.
- 119 explicit publication guards / 74 legacy rationale boundaries.
- 201 live relationship-source uses: 201 verified / 0 pending verification.
- 178 active source entities: 177 clinical + 1 legal authority.
- 0 pending-verification source entities.
- 7 superseded-unverified, 1 correction-only, and 1 retired-only source entity.
- 187 total source entities including lineage/history.
- 6 retired-verified relationship-source uses preserved.

## ME-4 qualified-human citation verification

The five ME-4 sources have been reviewed and promoted:
- 4 approve-as-implemented.
- 1 approve-with-narrowing.
- 0 source replacements.
- 0 rejects/withdrawals.

The narrowed relationship is `uveitis -> cataracts` using PMID 37414328. Its publication guard is restricted to documented noninfectious anterior uveitis plus separately established cataract in the affected eye. The broader phrase “or a clinically comparable anterior-inflammatory phenotype” is no longer part of the live verified proposition.

The source identity for PMID 37414328 is unchanged. The narrowed relationship snapshot and raw-reference snapshot are updated to the qualified-human-approved proposition; all other ME-4 source identities and relationship semantics are unchanged.

## Verification-state contract

Live `verified:true` KB sources map to master status `active`. Mapping approval and PubMed identity matching do not authorize citation promotion. Qualified-human approval is recorded in each promoted master source's `verificationState`, and the audit permits only the documented verification transition (plus the single approved uveitis narrowing).

No new taxonomy identity, publication-status change, rating code, or `pathwayIntelligence` was introduced. A verified source still does not, by itself, establish an individual VA medical nexus.
