# Mapping Expansion ME-13 — Approved Implementation Ledger

**APPROVED AND APPLIED LOCALLY — CITATIONS PENDING VERIFICATION**

Required exact HEAD: `e1bf62a6e5fde1da4f1938ce3322257662060bff`
Local commit subject: `map: mapping expansion ME-13 (5 relationships)`

## Approval boundary

- Exactly five new relationships.
- All five relationship ranks are **1**.
- All five primary KB identities must remain **draft**; publication status must not change.
- Each approved source must enter the KB as `verified:false` and the master source registry as `pending-verification`.
- Citation verification/promotion is a separate later phase and is not authorized here.
- No taxonomy, pathway-intelligence, semantic-broadening, GitHub, push, or Vercel action is authorized.

## Exact queue baseline

- Canonical 166-primary queue SHA-256: `56575a981d021b5417cc6179f4394c5061e4e90706ffe38e683a05ecfaea0041`
- Before implementation: 145 registered / 166 remaining / 38 already-used-as-target / 128 never-used-in-master.
- Approved batch composition: 2 from the already-used-as-target pool and 3 from the never-used pool.
- If all five prechecks pass: 150 registered / 161 remaining / 38 target-only / 123 never-used. Two newly targeted remaining primaries (`dermatitis` and `radiculopathy`) move from the never-used pool into the target-only pool.

## Approved rows

### 1. `endometrial-cancer → lymphedema`

- Rank: **1**
- PMID: **33396373**
- DOI: `10.3390/jcm10010120`
- Source: Helgers RJA, Winkens B, Slangen BFM, Werner HMJ. Lymphedema and Post-Operative Complications after Sentinel Lymph Node Biopsy versus Lymphadenectomy in Endometrial Carcinomas-A Systematic Review and Meta-Analysis. J Clin Med. 2020;10(1):120. PMID 33396373. doi:10.3390/jcm10010120.
- Proposition: In endometrial carcinoma, pelvic or para-aortic lymph-node dissection is associated with lower-extremity lymphedema; the approved mapping is restricted to treatment-mediated lymphedema after lymphatic-disrupting nodal treatment.
- Guard: Require documented endometrial cancer, pelvic or para-aortic lymphatic-disrupting nodal treatment, and separately established lower-extremity lymphedema afterward. Do not infer lymphedema from endometrial cancer alone or from isolated edema. Preserve deep-vein thrombosis or other venous disease, cardiac or renal edema, primary lymphedema, infection, and other unrelated causes as competing explanations.
- Primary state required before and after: `draft`
- Current suggestion count required before mutation: `0`

### 2. `bladder-cancer → urinary-incontinence`

- Rank: **1**
- PMID: **39896758**
- DOI: `10.1016/j.apjon.2024.100647`
- Source: Xu M, Chen S, Liu X, et al. Best evidence for rehabilitation management of urinary incontinence in patients with bladder cancer following orthotopic neobladder reconstruction. Asia Pac J Oncol Nurs. 2024;12:100647. PMID 39896758. doi:10.1016/j.apjon.2024.100647.
- Proposition: The evidence synthesis addresses urinary incontinence after radical cystectomy with orthotopic neobladder reconstruction for bladder cancer; the approved mapping is restricted to that postoperative treatment pathway.
- Guard: Require documented bladder cancer, radical cystectomy with orthotopic neobladder reconstruction, and persistent separately established postoperative urinary incontinence. Do not infer urinary incontinence from bladder cancer alone, from an ileal conduit without the phenotype, or from transient early postoperative leakage. Preserve urinary tract infection, retention or overflow, neurologic or pelvic-floor disease, preexisting urinary incontinence, and other etiologies as competing explanations.
- Primary state required before and after: `draft`
- Current suggestion count required before mutation: `0`

### 3. `non-hodgkins-lymphoma → peripheral-neuropathy`

- Rank: **1**
- PMID: **31214762**
- DOI: `10.1007/s00280-019-03884-5`
- Source: Madsen ML, Due H, Ejskjaer N, et al. Aspects of vincristine-induced neuropathy in hematologic malignancies: a systematic review. Cancer Chemother Pharmacol. 2019;84(3):471-485. PMID 31214762. doi:10.1007/s00280-019-03884-5.
- Proposition: Vincristine used for hematologic malignancies, including non-Hodgkin lymphoma, can cause progressive peripheral sensory and motor neuropathy; the approved mapping is restricted to a documented neurotoxic treatment exposure with compatible chronology.
- Guard: Require documented non-Hodgkin lymphoma, a documented vincristine-containing or otherwise specifically neurotoxic lymphoma regimen, compatible chronology, and separately established peripheral neuropathy. Do not infer peripheral neuropathy from non-Hodgkin lymphoma itself. Preserve diabetic, nutritional, alcohol-related, compressive, paraproteinemic, infectious, hereditary, and other neuropathy etiologies as competing explanations.
- Primary state required before and after: `draft`
- Current suggestion count required before mutation: `0`

### 4. `fecal-incontinence → dermatitis`

- Rank: **1**
- PMID: **39836004**
- DOI: `10.1097/WON.0000000000001146`
- Source: Jiang T, Zhang X, Wu J, Gao L, Tung TH. Risk Factors for Incontinence-Associated Dermatitis in Adults: A Systematic Review and Meta-Analysis. J Wound Ostomy Continence Nurs. 2025;52(1):66-75. PMID 39836004. doi:10.1097/WON.0000000000001146.
- Proposition: A systematic review and meta-analysis identifies fecal incontinence as an etiologic risk factor for incontinence-associated dermatitis; the approved mapping is restricted to moisture-associated skin damage in the exposed distribution.
- Guard: Require fecal incontinence with repeated or prolonged perineal skin exposure and separately diagnosed moisture-associated or incontinence-associated dermatitis in the exposed distribution. Do not generalize this relationship to eczema, fungal disease, allergic or irritant dermatitis from unrelated agents, pressure injury, cellulitis, or a nonspecific rash. Preserve those alternative skin diagnoses and other causes as competing explanations.
- Primary state required before and after: `draft`
- Current suggestion count required before mutation: `0`

### 5. `degenerative-disc-disease → radiculopathy`

- Rank: **1**
- PMID: **34402323**
- DOI: `10.1177/21925682211037270`
- Source: Alomar SA, Maghrabi Y, Baeesa SS, Alves OL. Outcome of Anterior and Posterior Endoscopic Procedures for Cervical Radiculopathy Due to Degenerative Disk Disease: A Systematic Review and Meta-Analysis. Global Spine J. 2022;12(7):1546-1560. PMID 34402323. doi:10.1177/21925682211037270.
- Proposition: The systematic review and meta-analysis explicitly addresses cervical radiculopathy due to degenerative disc disease; the approved mapping is restricted to anatomically concordant cervical nerve-root disease.
- Guard: Require cervical degenerative disc pathology capable of nerve-root compromise and separately established anatomically concordant cervical radiculopathy. Do not infer radiculopathy from degenerative imaging, axial neck pain, nonspecific paresthesias, myelopathy, or peripheral entrapment neuropathy alone. Preserve peripheral neuropathy, plexopathy, entrapment neuropathy, spinal cord disease, nondegenerative structural lesions, and other causes as competing explanations.
- Primary state required before and after: `draft`
- Current suggestion count required before mutation: `0`

## Pre-mutation fail-closed gates

The implementation runner must complete all of these before its first repository write:

1. Resolve Node 22 and prove the exact clean HEAD.
2. Prove the closed ME-12 citation-verified citation/master-registry baseline.
3. Verify the bundled exact 166-primary queue and its canonical digest.
4. Prove all five approved primaries still belong to that remaining queue and remain draft D0 identities.
5. Prove all five relationship pairs/IDs are absent.
6. Prove all five PMIDs and DOIs are absent from local master-source entities and all live KB reference text/URLs.
7. Live-recheck each PMID/DOI/title against PubMed.
8. Reconcile the exact post-implementation counts. Any source collision invalidates the 232-source projection and must stop before mutation.

## Expected post-implementation state if all five sources are new

- 311 KB files; 139 published / 172 draft.
- **238 relationships**; published P1 66 / P2+ 73 / draft D1 **11**.
- **246 references**: 241 verified / 5 unverified / 0 review / 0 hard.
- Verified provenance remains 247.
- Clinical references/URLs: 241; clinical provenance with URLs: 245.
- Master sources: 218 active / 5 pending / **232 total**.
- Active clinical 217 / pending clinical 5 / active legal 1.
- Explicit publication guards: **164**; legacy rationale boundaries: 74.
- Registry state: `ME13-PRE-QUALIFIED-HUMAN-CITATION-VERIFICATION`.

## Failure policy

Fail closed. If any exact baseline, queue, edge, source identity, projection, PubMed identity, validation, or freeze-guard requirement fails, stop. If any repository write has already occurred, preserve the exact dirty state; do not reset, restore, stash, or clean.

## Local implementation result

- 5/5 approved relationships added at rank 1.
- All five primary KB identities remain draft; no publication status changed.
- 5/5 new source references remain `verified:false`; matching master sources are `pending-verification`.
- Registered-primary coverage is 150/311; 161 primaries remain, partitioned 38 target-only / 123 never-used.
- Citation verification remains separately gated.
- No GitHub/Vercel write was performed.
