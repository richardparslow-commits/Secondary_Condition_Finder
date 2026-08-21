# Master Relationship & Evidence Registry 2026

## Status

The authoritative registry is at the fully qualified-human-verified Mapping Expansion Batch ME-6 state, derived from implementation commit `690163dfe606bdb515dbb6344bad99cc876044f8`.

## Current state

- 203 relationships.
- 129 explicit publication guards / 74 legacy rationale boundaries.
- 211 live relationship-source uses: 211 verified / 0 pending verification.
- 188 active source entities: 187 clinical + 1 legal authority.
- 0 pending-verification source entities.
- 7 superseded-unverified, 1 correction-only, and 1 retired-only source entity.
- 197 total source entities including lineage/history.
- 6 retired-verified relationship-source uses preserved.

## ME-6 qualified-human citation verification

Disposition:
- 4 approve-as-implemented.
- 1 approve-with-narrowing.
- 0 source replacements.
- 0 rejects/withdrawals.

The only relationship-semantic change is `chronic-pyelonephritis -> hypertension` (PMID 12411757). Its publication boundary is narrowed to require documented chronic pyelonephritis only in the presence of objectively established vesicoureteral reflux/reflux nephropathy with renal parenchymal scarring, plus separately established hypertension. The source is not generalized to chronic pyelonephritis, recurrent urinary infection, or renal scarring without documented reflux nephropathy.

The other four ME-6 relationships and publication guards remain as implemented. All five PMID/DOI identities, citation text, source URLs, ranks, prevalence values, taxonomy identities, publication states, and pathwayIntelligence state remain unchanged.

## Verification-state contract

All five ME-6 KB references are `verified:true`, and their normalized master sources are `active`. Qualified-human review decisions are recorded on the master source entities. Mapping approval and PubMed identity matching remain insufficient to authorize citation promotion without this separate review.

The narrowed PMID 12411757 relationship snapshot is updated atomically so the master relationship, KB proposition, evidence gaps, source locator, suggestion-object hash, and normalized raw-reference hash share the same approved boundary. No other relationship entity is semantically rewritten.

Verified population-level or phenotype-specific evidence still does not, by itself, establish an individual VA medical nexus.
