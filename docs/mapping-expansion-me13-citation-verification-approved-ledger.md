# Mapping Expansion ME-13 — Qualified-Human Citation Verification Ledger

**APPROVED-AND-APPLIED-LOCALLY — 5/5 VERIFIED**

Required implementation baseline: `fbae4f44d8570fecb1d7e8e489bcf97ad9d8346a`

I approve all five ME-13 citation-verification rows exactly as implemented, with no narrowing, replacement, bibliographic correction, source-identity change, guard change, rank change, or publication change.

## Approved rows

### 1. `endometrial-cancer->lymphedema`
- Rank: **1**; primary remains **draft**
- PMID: `33396373`
- DOI: `10.3390/jcm10010120`
- Source: Lymphedema and Post-Operative Complications after Sentinel Lymph Node Biopsy versus Lymphadenectomy in Endometrial Carcinomas-A Systematic Review and Meta-Analysis
- Disposition: **approve-as-implemented**
- Guard: Require documented endometrial cancer, pelvic or para-aortic lymphatic-disrupting nodal treatment, and separately established lower-extremity lymphedema afterward. Do not infer lymphedema from endometrial cancer alone or from isolated edema. Preserve deep-vein thrombosis or other venous disease, cardiac or renal edema, primary lymphedema, infection, and other unrelated causes as competing explanations.

### 2. `bladder-cancer->urinary-incontinence`
- Rank: **1**; primary remains **draft**
- PMID: `39896758`
- DOI: `10.1016/j.apjon.2024.100647`
- Source: Best evidence for rehabilitation management of urinary incontinence in patients with bladder cancer following orthotopic neobladder reconstruction
- Disposition: **approve-as-implemented**
- Guard: Require documented bladder cancer, radical cystectomy with orthotopic neobladder reconstruction, and persistent separately established postoperative urinary incontinence. Do not infer urinary incontinence from bladder cancer alone, from an ileal conduit without the phenotype, or from transient early postoperative leakage. Preserve urinary tract infection, retention or overflow, neurologic or pelvic-floor disease, preexisting urinary incontinence, and other etiologies as competing explanations.

### 3. `non-hodgkins-lymphoma->peripheral-neuropathy`
- Rank: **1**; primary remains **draft**
- PMID: `31214762`
- DOI: `10.1007/s00280-019-03884-5`
- Source: Aspects of vincristine-induced neuropathy in hematologic malignancies: a systematic review
- Disposition: **approve-as-implemented**
- Guard: Require documented non-Hodgkin lymphoma, a documented vincristine-containing or otherwise specifically neurotoxic lymphoma regimen, compatible chronology, and separately established peripheral neuropathy. Do not infer peripheral neuropathy from non-Hodgkin lymphoma itself. Preserve diabetic, nutritional, alcohol-related, compressive, paraproteinemic, infectious, hereditary, and other neuropathy etiologies as competing explanations.

### 4. `fecal-incontinence->dermatitis`
- Rank: **1**; primary remains **draft**
- PMID: `39836004`
- DOI: `10.1097/WON.0000000000001146`
- Source: Risk Factors for Incontinence-Associated Dermatitis in Adults: A Systematic Review and Meta-Analysis
- Disposition: **approve-as-implemented**
- Guard: Require fecal incontinence with repeated or prolonged perineal skin exposure and separately diagnosed moisture-associated or incontinence-associated dermatitis in the exposed distribution. Do not generalize this relationship to eczema, fungal disease, allergic or irritant dermatitis from unrelated agents, pressure injury, cellulitis, or a nonspecific rash. Preserve those alternative skin diagnoses and other causes as competing explanations.

### 5. `degenerative-disc-disease->radiculopathy`
- Rank: **1**; primary remains **draft**
- PMID: `34402323`
- DOI: `10.1177/21925682211037270`
- Source: Outcome of Anterior and Posterior Endoscopic Procedures for Cervical Radiculopathy Due to Degenerative Disk Disease: A Systematic Review and Meta-Analysis
- Disposition: **approve-as-implemented**
- Guard: Require cervical degenerative disc pathology capable of nerve-root compromise and separately established anatomically concordant cervical radiculopathy. Do not infer radiculopathy from degenerative imaging, axial neck pain, nonspecific paresthesias, myelopathy, or peripheral entrapment neuropathy alone. Preserve peripheral neuropathy, plexopathy, entrapment neuropathy, spinal cord disease, nondegenerative structural lesions, and other causes as competing explanations.

## Authorized transition

- 5 KB source references: `verified:false → true`
- 5 master sources: `pending-verification / verified:false → active / verified:true`

## Projected final state

- 238 relationships / P1 66 / P2+ 73 / draft D1 11
- 246 references / 246 verified / 0 unverified / 0 review / 0 hard
- Verified provenance: 252
- 223 active / 0 pending / 232 total master sources
- 222 active / 0 pending clinical master sources
- Publication guards 164 explicit / 74 legacy
- No remote writes

## Local verification result

- 5/5 selected ME-13 KB references promoted to `verified:true`.
- 5/5 matching master sources promoted from `pending-verification` to `active` and `verified:true`.
- All five were approved exactly as implemented; no narrowing, bibliographic correction, source replacement, semantic change, rank change, guard change, publication change, taxonomy change, or pathway-intelligence change.
- No GitHub/Vercel write was performed.
