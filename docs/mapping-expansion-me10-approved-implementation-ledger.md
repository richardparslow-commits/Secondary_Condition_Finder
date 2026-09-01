# Mapping Expansion Batch ME-10 — Approved Implementation Ledger

**Status:** APPROVED-AND-IMPLEMENTED-LOCALLY — CITATIONS PENDING VERIFICATION

Required baseline: `70aa43bb88bfb2334ce32442b3d51e87c58419ab`

Target local commit subject: `map: mapping expansion ME-10 (5 relationships)`

## Approved rows

### 1. `bronchiectasis -> sleep-apnea`
- Current rank-1: `pulmonary-hypertension`
- Rank: 2 / prevalence: `sometimes-explored`
- PMID 41905893 / DOI `10.1111/jsr.70333`
- Source: Obstructive Sleep Apnea in Bronchiectasis: Prevalence, Risk Factors and Clinical Implications-A Systematic Review and Meta-Analysis
- Research source action: **retain-screening-source**
- Proposition: In adults with established bronchiectasis, polysomnography-confirmed obstructive sleep apnea is substantially more prevalent than in the general population; this supports screening and a population-level association only.
- Phenotype restriction: established bronchiectasis with separately diagnosed obstructive sleep apnea
- Publication guard: Do not infer obstructive sleep apnea from bronchiectasis alone. Require a separate obstructive sleep apnea diagnosis. Preserve obesity, craniofacial or anatomic upper-airway factors, age, sex, medication exposure, other sleep-disordered-breathing causes, and conventional obstructive sleep apnea risk factors. Association evidence must not be presented as individual causation.

### 2. `thyroiditis -> urticaria`
- Current rank-1: `hypothyroidism`
- Rank: 2 / prevalence: `sometimes-explored`
- PMID 42511690 / DOI `10.3390/ijms27146348`
- Source: Effects of Treatment with L-Thyroxine on Chronic Urticaria in Subjects with Autoimmune Thyroiditis: A Systematic Review and Meta-Analysis
- Research source action: **retain-screening-source-with-phenotype-narrowing**
- Proposition: Chronic urticaria is frequently associated with autoimmune thyroiditis, while pathogenesis and the benefit of thyroid-directed treatment remain uncertain; this evidence supports association only.
- Phenotype restriction: autoimmune thyroiditis only, with separately established chronic urticaria
- Publication guard: Require autoimmune thyroiditis and chronic urticaria to be independently established. Do not generalize from nonspecific thyroiditis, do not infer that autoimmune thyroiditis individually causes urticaria, and do not use levothyroxine response as proof of causation.

### 3. `charcot-arthropathy -> osteomyelitis`
- Current rank-1: `amputation-or-loss-of-use`
- Rank: 2 / prevalence: `sometimes-explored`
- PMID 42141385 / DOI `10.1186/s12891-026-09965-w`
- Source: Pharmacological treatment for Charcot neuroarthropathy: a systematic review
- Research source action: **replace-screening-source** (replaces screening PMID 29844940)
- Proposition: Charcot neuroarthropathy can progress to foot deformity and ulceration, creating a clinically recognized pathway to deep infection and osteomyelitis; use of this relationship requires documented wound or infection chronology.
- Phenotype restriction: Charcot neuroarthropathy of the foot, especially neuropathic or diabetic Charcot foot, with a separately established osteomyelitis diagnosis
- Publication guard: Require established Charcot neuroarthropathy of the foot plus documented deformity with ulceration, soft-tissue breakdown, wound infection, or compatible deep-infection chronology before using the osteomyelitis pathway. Osteomyelitis must be separately diagnosed. Preserve diabetes, neuropathy, peripheral vascular disease, trauma or surgery, wound-care history, and other infection risk factors.

### 4. `lyme-disease -> uveitis`
- Current rank-1: `cranial-nerve-palsy`
- Rank: 2 / prevalence: `sometimes-explored`
- PMID 41546697 / DOI `10.1007/s00417-025-07110-2`
- Source: Ocular findings in patients with lyme disease: a systematic review and meta-analysis
- Research source action: **retain-screening-source**
- Proposition: Uveitis, including anterior, intermediate and posterior forms, is among documented ocular manifestations reported in patients with Lyme disease.
- Phenotype restriction: established Lyme disease or Lyme borreliosis context with separately diagnosed uveitis
- Publication guard: Require Lyme disease or Lyme borreliosis and uveitis to be independently established. Preserve other infectious, autoimmune, medication-related, traumatic, and ophthalmic etiologies. Population-level manifestation evidence does not by itself establish an individual nexus.

### 5. `narcolepsy -> hypertension`
- Current rank-1: `depressive-disorder`
- Rank: 2 / prevalence: `sometimes-explored`
- PMID 41747645 / DOI `10.1016/j.smrv.2026.102264`
- Source: Narcolepsy and metabolic disease: A meta-analytic synthesis
- Research source action: **retain-screening-source**
- Proposition: Hypertension is among the cardiometabolic comorbidities reported in narcolepsy, with greater cardiometabolic burden particularly in narcolepsy type 1; this supports association and screening relevance only.
- Phenotype restriction: established narcolepsy with separately diagnosed hypertension; association appears strongest in narcolepsy type 1
- Publication guard: Require separately diagnosed hypertension. Preserve obesity, obstructive sleep apnea, metabolic syndrome, stimulant or other medication exposure, age, sex, renal or endocrine causes, and other conventional hypertension risk factors. Do not state or imply individual causation from the meta-analysis alone.

## Fail-closed implementation boundary

- Precheck must prove exact clean HEAD and exact closed ME-9 counts.
- All five new relationship identities, PMIDs, and DOIs must be absent before mutation.
- All five new references enter as `verified:false`.
- All five corresponding normalized master sources enter as `pending-verification`.
- No citation promotion, rank-1 change, taxonomy/publication-state change, pathwayIntelligence change, GitHub write, or Vercel action is authorized.

## Local implementation result

- 5/5 relationships installed at rank 2.
- 5/5 new clinical sources remain `verified:false`.
- 5/5 normalized master sources are `pending-verification`.
- No citation promotion, semantic broadening, identity/catalog change, publication-state change, rank-1 change, pathwayIntelligence change, GitHub write, or Vercel action.
