# Mapping Expansion ME-10 — Citation Verification Approved Ledger

**APPROVED-AND-APPLIED-LOCALLY**

Required implementation HEAD: `d1886af67a891d4bd34387538fe5d6f6ffdabf82`

## Approved source-level dispositions

### 1. `bronchiectasis -> sleep-apnea`
- PMID 41905893 / DOI `10.1111/jsr.70333`
- Decision: **approve-as-implemented**
- Additional narrowing: none
- Bibliographic correction: none
- Source replacement: none
- Semantic change: none
- Guard remains immutable: Do not infer obstructive sleep apnea from bronchiectasis alone. Require a separate obstructive sleep apnea diagnosis. Preserve obesity, craniofacial or anatomic upper-airway factors, age, sex, medication exposure, other sleep-disordered-breathing causes, and conventional obstructive sleep apnea risk factors. Association evidence must not be presented as individual causation.

### 2. `thyroiditis -> urticaria`
- PMID 42511690 / DOI `10.3390/ijms27146348`
- Decision: **approve-as-implemented**
- Additional narrowing: none
- Bibliographic correction: none
- Source replacement: none
- Semantic change: none
- Guard remains immutable: Require autoimmune thyroiditis and chronic urticaria to be independently established. Do not generalize from nonspecific thyroiditis, do not infer that autoimmune thyroiditis individually causes urticaria, and do not use levothyroxine response as proof of causation.

### 3. `charcot-arthropathy -> osteomyelitis`
- PMID 42141385 / DOI `10.1186/s12891-026-09965-w`
- Decision: **approve-as-implemented**
- Additional narrowing: none
- Bibliographic correction: none
- Source replacement: none
- Semantic change: none
- Guard remains immutable: Require established Charcot neuroarthropathy of the foot plus documented deformity with ulceration, soft-tissue breakdown, wound infection, or compatible deep-infection chronology before using the osteomyelitis pathway. Osteomyelitis must be separately diagnosed. Preserve diabetes, neuropathy, peripheral vascular disease, trauma or surgery, wound-care history, and other infection risk factors.

### 4. `lyme-disease -> uveitis`
- PMID 41546697 / DOI `10.1007/s00417-025-07110-2`
- Decision: **approve-as-implemented**
- Additional narrowing: none
- Bibliographic correction: none
- Source replacement: none
- Semantic change: none
- Guard remains immutable: Require Lyme disease or Lyme borreliosis and uveitis to be independently established. Preserve other infectious, autoimmune, medication-related, traumatic, and ophthalmic etiologies. Population-level manifestation evidence does not by itself establish an individual nexus.

### 5. `narcolepsy -> hypertension`
- PMID 41747645 / DOI `10.1016/j.smrv.2026.102264`
- Decision: **approve-as-implemented**
- Additional narrowing: none
- Bibliographic correction: none
- Source replacement: none
- Semantic change: none
- Guard remains immutable: Require separately diagnosed hypertension. Preserve obesity, obstructive sleep apnea, metabolic syndrome, stimulant or other medication exposure, age, sex, renal or endocrine causes, and other conventional hypertension risk factors. Do not state or imply individual causation from the meta-analysis alone.

## Authorized transform

- Five KB source references: `verified:false -> true` only.
- Five normalized master sources: `pending-verification -> active`, `verified:false -> true`.
- Add qualified-human review decision/date metadata to only those five source entities.
- Relationship entities, propositions, guards, citation text, PMIDs/DOIs, identities, ranks, taxonomy, publication states, and pathwayIntelligence remain immutable.
- No GitHub or Vercel write is authorized.

## Local citation-verification result

- 5/5 ME-10 clinical references promoted to `verified:true`.
- 5/5 normalized master sources promoted to `active`.
- 5/5 decisions recorded as `approve-as-implemented`.
- 0 semantic changes, 0 guard changes, 0 citation corrections, 0 source replacements, 0 source identity changes, 0 remote writes.
