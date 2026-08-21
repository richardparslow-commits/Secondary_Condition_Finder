# Master Relationship & Evidence Registry 2026

## Status

The authoritative registry is at the fully qualified-human-verified Mapping Expansion Batch ME-9 state, derived from implementation commit `f013a939cce8398527b2619587fb985eb57100d0`.

## Current state

- 218 relationships.
- 144 explicit publication guards / 74 legacy rationale boundaries.
- 226 live relationship-source uses: 226 verified / 0 pending verification.
- 203 active source entities: 202 clinical + 1 legal authority.
- 0 pending-verification source entities.
- 7 superseded-unverified, 1 correction-only, and 1 retired-only source entity.
- 212 total source entities including lineage/history.
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

No relationship count, rank, prevalence, taxonomy identity, publication state, or pathwayIntelligence state changes in this verification gate. Verified population-level or phenotype-specific evidence still does not, by itself, establish an individual VA medical nexus.## ME-8 qualified-human citation verification

Disposition:
- 5 approve-as-implemented.
- 0 narrowing rows.
- 0 bibliographic corrections.
- 0 source replacements.
- 0 rejects/withdrawals.

The five independently reviewed sources are:
- `malaria -> anemia` / PMID 30340592.
- `hiv-aids -> peripheral-neuropathy` / PMID 33226721.
- `myelodysplastic-syndrome -> anemia` / PMID 26404446.
- `primary-myelofibrosis -> anemia` / PMID 18947294.
- `heart-transplant-residuals -> chronic-kidney-disease` / PMID 25134671.

All five PMID/DOI identities and citation strings are retained unchanged. The implemented propositions, phenotype restrictions, evidence gaps, and publication guards also remain unchanged because the independent review found them already sufficiently bounded to the cited evidence.

The heart-transplant row remains explicitly post-transplant and multifactorial: actual heart transplantation, separately established post-transplant CKD, compatible chronology, and competing-cause review remain required; transplant status alone does not establish CKD.

All five ME-8 KB references are `verified:true`, and their normalized master sources are `active`. Mapping approval and bibliographic identity matching remain insufficient to authorize citation promotion without this separate qualified-human review.

No relationship count, relationship semantics, rank, prevalence, taxonomy identity, publication state, publication guard, citation text, source identity, or pathwayIntelligence state changes in this verification gate. Verified evidence still does not, by itself, establish an individual VA medical nexus.

## ME-9 qualified-human citation verification

Disposition:
- 5 approve-as-implemented.
- 0 narrowing beyond the existing implemented guards.
- 0 bibliographic corrections.
- 0 source replacements.
- 0 rejects/withdrawals.

The five independently reviewed sources are:
- `discoid-lupus -> systemic-lupus-erythematosus` / PMID 41178896.
- `colorectal-cancer -> fecal-incontinence` / PMID 33277056, retaining the implemented colon-cancer surgery/colectomy and postoperative-chronology restriction.
- `hypogonadism -> erectile-dysfunction` / PMID 34856556, retaining the implemented androgen-deficiency/late-onset-hypogonadism evidence boundary.
- `pancreatitis -> pancreatic-cancer` / PMID 35142721, retaining the implemented chronic-pancreatitis and reverse-causation chronology guard.
- `hypoparathyroidism -> chronic-kidney-disease` / PMID 33599907, retaining the implemented chronic phenotype and conventional-treatment exposure/chronology guard when relied upon.

All five PMID/DOI identities and citation strings are retained unchanged. The implemented propositions, phenotype restrictions, evidence gaps, and publication guards also remain unchanged.

All five ME-9 KB references are `verified:true`, and their normalized master sources are `active`. Mapping approval and bibliographic identity matching remain insufficient to authorize citation promotion without this separate qualified-human source-level review.

No relationship count, relationship semantics, rank, prevalence, taxonomy identity, publication state, publication guard, citation text, source identity, or pathwayIntelligence state changes in this verification gate. Verified population-level or phenotype-specific evidence still does not, by itself, establish an individual medical nexus.
