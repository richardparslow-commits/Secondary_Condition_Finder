# Master Relationship & Evidence Registry 2026

## Status

The authoritative registry is at the fully qualified-human-verified Mapping Expansion Batch ME-7 state, derived from implementation commit `68eb1eb082d43d7dcd6053746b78482e93e208a9`.

## Current state

- 208 relationships.
- 134 explicit publication guards / 74 legacy rationale boundaries.
- 216 live relationship-source uses: 216 verified / 0 pending verification.
- 193 active source entities: 192 clinical + 1 legal authority.
- 0 pending-verification source entities.
- 7 superseded-unverified, 1 correction-only, and 1 retired-only source entity.
- 202 total source entities including lineage/history.
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

## ME-7 qualified-human citation verification

Disposition:
- 2 approve-as-implemented.
- 2 approve-with-narrowing.
- 1 approve-with-narrowing-and-bibliographic-correction.
- 0 source replacements.
- 0 rejects/withdrawals.

The three approved semantic narrowings are:
- `q-fever -> hepatitis` / PMID 29543806: restricted to separately established acute hepatitis as a manifestation of acute Q fever; generic hepatic injury and isolated nonspecific enzyme elevation are not generalized from this source.
- `polycythemia-vera -> pulmonary-hypertension` / PMID 37311222: restricted to separately established precapillary pulmonary hypertension with CTEPH versus group-5 classification when applicable; the source does not support postcapillary PH from left-heart disease.
- `esophageal-cancer -> cardiomyopathy` / PMID 35289694: the source supports early treatment-related LV dysfunction/cardiotoxicity after thoracic chemoradiotherapy, while the relationship requires a separately established cardiomyopathy diagnosis with compatible chronology.

PMID 35289694 retains the same source identity and DOI while its citation is corrected to the compound surnames `Astrup Søndergaard`, `Sloth Møller`, and `Melgaard Nielsen`.

The other two ME-7 relationships remain as implemented. All five ME-7 KB references are `verified:true`, and their normalized master sources are `active`. Mapping approval and PubMed identity matching remain insufficient to authorize citation promotion without this separate qualified-human review.

No relationship count, rank, prevalence, taxonomy identity, publication state, or pathwayIntelligence state changes in this verification gate. Verified population-level or phenotype-specific evidence still does not, by itself, establish an individual VA medical nexus.
