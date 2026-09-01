# Clinical Mapping Master Resolution Citation Verification 2026 — Consolidated Implementation Ledger

**Status:** APPROVED-AND-IMPLEMENTED-LOCALLY

**Qualified-human approval:** I approve of the consolidated implementation ledger first, then use it as the fail-closed specification for the actual citation promotion.

**Source commit:** `81784b4deb88483f803e0bbd0ec422cb0e176809`
**Source manifest SHA-256:** `48f9246d06e3cc2884fca6df6652755c7637f8d3e28161383c1bc93faa573a8c`

## Approved disposition

- 39/39 source rows reviewed
- 23 approve as written
- 14 approve with exact source-specific narrowing
- 2 approved source replacements
- 0 rejected
- 0 unresolved
- 37 unique PMIDs before review → 36 unique live PMIDs after approved replacements

## Indexing safety correction

The CV-8 discussion presented `cerebral-contusion-diffuse-axonal-injury→epilepsy` as row 36 and `malaria→epilepsy` as row 38. In the committed implementation manifest those are manifest rows 38 and 36, respectively. The approved relationship-specific dispositions are unambiguous. **Implementation must key by `primaryId + targetId + current PMID`, never by conversational row number alone.**

## Row ledger

| Manifest | Review label | Relationship | Current PMID | Final PMID | Decision |
|---:|---|---|---:|---:|---|
| 1 | CV-1 review row 1 | `acne->acne-scarring` | 37357642 | 37357642 | as-written |
| 2 | CV-1 review row 2 | `lumbar-spinal-stenosis->cauda-equina-syndrome` | 36401862 | 36401862 | narrowed |
| 3 | CV-1 review row 3 | `chronic-kidney-disease->anemia` | 41485812 | 41485812 | as-written |
| 4 | CV-1 review row 4 | `kidney-stones->chronic-kidney-disease` | 27837248 | 27837248 | as-written |
| 5 | CV-1 review row 5 | `cardiac-arrhythmia->cardiomyopathy` | 38811098 | 38811098 | as-written |
| 6 | CV-2 review row 6 | `prostate-cancer->urinary-incontinence` | 32680820 | 32680820 | narrowed |
| 7 | CV-2 review row 7 | `prostate-cancer->erectile-dysfunction` | 32680820 | 32680820 | narrowed |
| 8 | CV-2 review row 8 | `heart-transplant-residuals->skin-cancer` | 41322122 | 41322122 | narrowed |
| 9 | CV-2 review row 9 | `lyme-disease->cranial-nerve-palsy` | 35064770 | 35064770 | narrowed |
| 10 | CV-2 review row 10 | `campylobacter-jejuni-infection->guillain-barre-syndrome` | 21261199 | 21261199 | as-written |
| 11 | CV-3 review row 11 | `campylobacter-jejuni-infection->reactive-arthritis` | 38929962 | 38929962 | as-written |
| 12 | CV-3 review row 12 | `shigella-or-salmonella->reactive-arthritis` | 38929962 | 38929962 | as-written |
| 13 | CV-3 review row 13 | `gallbladder-disease->pancreatitis` | 30249509 | 30249509 | as-written |
| 14 | CV-3 review row 14 | `knee-injury->post-traumatic-osteoarthritis` | 31072840 | 31072840 | as-written |
| 15 | CV-3 review row 15 | `short-bowel-syndrome->kidney-stones` | 35458207 | 35458207 | narrowed |
| 16 | CV-4 review row 16 | `cold-injury-residuals->peripheral-neuropathy` | 28969380 | 28969380 | as-written |
| 17 | CV-4 review row 17 | `breast-cancer->lymphedema` | 36513801 | 36513801 | as-written |
| 18 | CV-4 review row 18 | `breast-cancer->peripheral-neuropathy` | 28954296 | 28954296 | as-written |
| 19 | CV-4 review row 19 | `breast-cancer->cardiomyopathy` | 18514938 | 18514938 | narrowed |
| 20 | CV-4 review row 20 | `colorectal-cancer->peripheral-neuropathy` | 34410459 | 34410459 | as-written |
| 21 | CV-5 review row 21 | `multiple-myeloma->chronic-kidney-disease` | 29661050 | 24288486 | replacement |
| 22 | CV-5 review row 22 | `cerebral-palsy->scoliosis` | 29705176 | 29705176 | as-written |
| 23 | CV-5 review row 23 | `polycystic-ovary-syndrome->endometrial-cancer` | 36960190 | 36960190 | as-written |
| 24 | CV-5 review row 24 | `uterine-fibroids->anemia` | 38723935 | 38723935 | as-written |
| 25 | CV-5 review row 25 | `kidney-cancer->chronic-kidney-disease` | 27614693 | 27614693 | narrowed |
| 26 | CV-6 review row 26 | `amebiasis->amebic-liver-abscess` | 38577528 | 38577528 | as-written |
| 27 | CV-6 review row 27 | `diabetic-retinopathy->retinal-detachment` | 34477996 | 34477996 | as-written |
| 28 | CV-6 review row 28 | `cardiac-inflammatory-disease->cardiac-arrhythmia` | 30476544 | 30476544 | as-written |
| 29 | CV-6 review row 29 | `peripheral-vascular-disease->amputation-or-loss-of-use` | 31606132 | 31606132 | narrowed |
| 30 | CV-6 review row 30 | `retinal-detachment->cataracts` | 39541379 | 39541379 | narrowed |
| 31 | CV-7 review row 31 | `deep-vein-thrombosis->pulmonary-embolism` | 42134598 | 42134598 | narrowed |
| 32 | CV-7 review row 32 | `bronchiectasis->pulmonary-hypertension` | 38860405 | 38860405 | narrowed |
| 33 | CV-7 review row 33 | `myocardial-infarction->cardiac-arrhythmia` | 34953752 | 34953752 | narrowed |
| 34 | CV-7 review row 34 | `periodontal-disease->loss-of-teeth` | 28733997 | 28733997 | as-written |
| 35 | CV-7 review row 35 | `endometriosis->ovarian-cancer` | 24518590 | 24518590 | as-written |
| 36 | CV-8 review row 38 | `malaria->epilepsy` | 25631856 | 25631856 | narrowed |
| 37 | CV-8 review row 37 | `epilepsy->depressive-disorder` | 35413534 | 35413534 | as-written |
| 38 | CV-8 review row 36 | `cerebral-contusion-diffuse-axonal-injury->epilepsy` | 33687971 | 33687971 | as-written |
| 39 | CV-8 review row 39 | `skull-fracture-non-basilar-and-basal->epilepsy` | 19233461 | 33687971 | replacement |

## Exact narrowed / replacement specifications

### Manifest row 2 — `lumbar-spinal-stenosis->cauda-equina-syndrome` — narrowed

- Current PMID: `36401862`
- Final PMID: `36401862`
- Exact approved final publication guard:

> Require documented degenerative lumbar spinal stenosis and separately diagnosed cauda equina syndrome with correlating compressive/anatomic evidence. PMID 36401862 specifically studied an elderly surgical cohort (>60 years); do not use it to estimate general incidence or generalize its population findings beyond that setting. Radiculopathy, neurogenic claudication, bowel/bladder symptoms, or stenosis on imaging alone do not establish CES.

### Manifest row 6 — `prostate-cancer->urinary-incontinence` — narrowed

- Current PMID: `32680820`
- Final PMID: `32680820`
- Exact approved final publication guard:

> Require documented radical prostatectomy for prostate cancer and separately documented urinary incontinence developing or materially worsening after surgery. Establish pre-treatment urinary status when available. Do not infer urinary incontinence from prostate cancer itself, and do not use PMID 32680820 alone to generalize this treatment-complication proposition to all prostate-cancer therapies.

### Manifest row 7 — `prostate-cancer->erectile-dysfunction` — narrowed

- Current PMID: `32680820`
- Final PMID: `32680820`
- Exact approved final publication guard:

> Require documented radical prostatectomy for prostate cancer, separately documented erectile dysfunction developing or materially worsening after treatment, and consideration of pre-treatment erectile function. Do not infer ED from prostate cancer alone. PMID 32680820 does not by itself establish radiotherapy as the cause of an individual patient's ED.

### Manifest row 8 — `heart-transplant-residuals->skin-cancer` — narrowed

- Current PMID: `41322122`
- Final PMID: `41322122`
- Exact approved final publication guard:

> Require documented heart transplantation, chronic post-transplant immunosuppressive exposure, and a separately histologically diagnosed skin malignancy arising after transplantation. PMID 41322122 provides particularly strong evidence for CNI + azathioprine exposure and SCC risk; do not treat all immunosuppressive regimens as equivalent or infer that transplant status alone establishes individual causation.

### Manifest row 9 — `lyme-disease->cranial-nerve-palsy` — narrowed

- Current PMID: `35064770`
- Final PMID: `35064770`
- Exact approved final publication guard:

> Require documented Lyme neuroborreliosis or clinically attributable neurologic Lyme disease and separately documented facial nerve (cranial nerve VII) palsy. PMID 35064770 should not be generalized to other cranial neuropathies. Uncomplicated Lyme disease without neurologic involvement does not satisfy this relationship.

### Manifest row 15 — `short-bowel-syndrome->kidney-stones` — narrowed

- Current PMID: `35458207`
- Final PMID: `35458207`
- Exact approved final publication guard:

> Require documented short-bowel/short-gut syndrome with a malabsorptive enteric-hyperoxaluria phenotype, particularly colon in continuity after substantial small-bowel resection, and separately documented calcium oxalate nephrolithiasis or stone disease clinically attributable to enteric hyperoxaluria. Do not infer this pathway from short-bowel syndrome alone, and do not generalize PMID 35458207 to unrelated stone compositions or all short-bowel anatomical phenotypes.

### Manifest row 19 — `breast-cancer->cardiomyopathy` — narrowed

- Current PMID: `18514938`
- Final PMID: `18514938`
- Exact approved final publication guard:

> Require documented trastuzumab exposure for breast cancer and separately documented treatment-associated left-ventricular systolic dysfunction, cardiomyopathy, or heart failure arising after exposure. Prior or concurrent anthracycline exposure may be considered an important cardiotoxicity risk modifier/co-exposure, but PMID 18514938 should not by itself verify an anthracycline-only cardiomyopathy pathway. Do not infer cardiomyopathy from breast cancer or trastuzumab exposure alone without separately documented cardiac dysfunction.

### Manifest row 21 — `multiple-myeloma->chronic-kidney-disease` — replacement

- Current PMID: `29661050`
- Final PMID: `24288486`
- Final title: Multiple myeloma and kidney disease
- Final source URL: https://pubmed.ncbi.nlm.nih.gov/24288486/
- Exact approved final publication guard:

> Require documented multiple myeloma and separately documented chronic kidney disease satisfying accepted chronicity criteria. Where the relationship is represented as myeloma-related CKD, require clinical evidence linking the renal disease to myeloma-associated pathology, such as light-chain/cast nephropathy, monoclonal-protein-associated renal disease, or other appropriately established myeloma-related renal injury. Do not relabel transient AKI, an isolated creatinine elevation, or nonspecific renal impairment as CKD, and do not assume all CKD in a patient with multiple myeloma is caused by the myeloma.

### Manifest row 25 — `kidney-cancer->chronic-kidney-disease` — narrowed

- Current PMID: `27614693`
- Final PMID: `27614693`
- Exact approved final publication guard:

> Require documented renal malignancy/renal tumor treated with partial or radical nephrectomy, with separately documented new or materially worsened postoperative CKD satisfying chronicity criteria. PMID 27614693 specifically supports comparative renal outcomes in cT1b/cT2 renal-tumor cohorts, with greater postoperative renal-function loss and CKD risk after radical versus partial nephrectomy. Do not infer CKD from kidney cancer alone, do not treat transient postoperative AKI as CKD, and consider preoperative renal function and other CKD risk factors when assessing an individual case.

### Manifest row 29 — `peripheral-vascular-disease->amputation-or-loss-of-use` — narrowed

- Current PMID: `31606132`
- Final PMID: `31606132`
- Exact approved final publication guard:

> Require documented atherosclerotic lower-extremity peripheral artery disease, particularly advanced disease/critical limb-threatening ischemia where applicable, and separately documented major lower-extremity amputation occurring in the PAD clinical course. PMID 31606132 supports major amputation as a complication/outcome of atherosclerotic PAD; it does not independently verify non-amputation functional "loss of use." Do not generalize this evidence to venous disease, nonspecific vascular diagnoses, or assume that PAD establishes the cause of every individual amputation without appropriate clinical attribution.

### Manifest row 30 — `retinal-detachment->cataracts` — narrowed

- Current PMID: `39541379`
- Final PMID: `39541379`
- Exact approved final publication guard:

> Require documented rhegmatogenous retinal detachment treated with pars plana vitrectomy, with or without scleral buckle as applicable, in an eye that was phakic at the relevant surgical exposure, followed by separately documented postoperative cataract development or progression. PMID 39541379 supports increased cataract progression after PPV-based RRD surgery compared with certain alternative surgical approaches; do not infer cataract from untreated retinal detachment, do not generalize this source to unrelated retinal-detachment phenotypes, and do not apply a cataract-progression pathway to an eye already pseudophakic before the relevant surgery.

### Manifest row 31 — `deep-vein-thrombosis->pulmonary-embolism` — narrowed

- Current PMID: `42134598`
- Final PMID: `42134598`
- Exact approved final publication guard:

> Require documented isolated distal deep-vein thrombosis preceding separately documented symptomatic pulmonary embolism. PMID 42134598 specifically studied iDDVT and should not by itself be used to quantify or characterize PE risk across all proximal or other DVT phenotypes. Do not infer pulmonary embolism from DVT alone, and do not treat population-level complication rates as proof that an individual's PE arose from a particular DVT without appropriate clinical attribution.

### Manifest row 32 — `bronchiectasis->pulmonary-hypertension` — narrowed

- Current PMID: `38860405`
- Final PMID: `38860405`
- Exact approved final publication guard:

> Require documented bronchiectasis and separately established bronchiectasis-associated pulmonary hypertension, preferably with appropriate hemodynamic evidence such as right-heart catheterization when clinically available, and evaluation sufficient to distinguish major alternative causes of pulmonary hypertension. PMID 38860405 supports the established bronchiectasis-associated PH phenotype and its prognostic hemodynamics; it should not be used to estimate PH incidence in unselected bronchiectasis or to infer PH from bronchiectasis severity alone.

### Manifest row 33 — `myocardial-infarction->cardiac-arrhythmia` — narrowed

- Current PMID: `34953752`
- Final PMID: `34953752`
- Exact approved final publication guard:

> Require documented acute ST-segment elevation myocardial infarction (STEMI) and separately documented ventricular arrhythmia, such as clinically established ventricular tachycardia or ventricular fibrillation, arising in the relevant acute/post-infarction period. PMID 34953752 specifically evaluates early and late ventricular arrhythmias complicating STEMI; do not use it to verify atrial fibrillation, nonspecific ectopy, bradyarrhythmias, every myocardial-infarction subtype, or an arrhythmia arising only remotely from the infarction.

### Manifest row 36 — `malaria->epilepsy` — narrowed

- Current PMID: `25631856`
- Final PMID: `25631856`
- Exact approved final publication guard:

> Require documented cerebral malaria, rather than uncomplicated malaria, with subsequent separately diagnosed epilepsy after the acute cerebral-malaria episode. PMID 25631856 principally represents survivors of cerebral malaria, most of whom were children in malaria-endemic settings, and supports a population-level association with long-term neurologic sequelae. Do not infer epilepsy from uncomplicated malaria, malaria exposure alone, an acute febrile seizure, or an isolated seizure occurring only during the acute cerebral-malaria illness.

### Manifest row 39 — `skull-fracture-non-basilar-and-basal->epilepsy` — replacement

- Current PMID: `19233461`
- Final PMID: `33687971`
- Final title: Post-traumatic epilepsy in adults: a nationwide register-based study
- Final source URL: https://pubmed.ncbi.nlm.nih.gov/33687971/
- Exact approved final publication guard:

> Require a documented traumatic skull fracture, including appropriately documented skull-vault or skull-base fracture, followed by separately diagnosed post-traumatic epilepsy. PMID 33687971 supports increased epilepsy risk after the coded skull-fracture phenotype in an adult hospitalized TBI cohort. Do not equate an acute provoked seizure during the index trauma admission with later epilepsy, and do not infer epilepsy from nonspecific head trauma without a qualifying skull fracture.

## Fail-closed implementation rules

- Require repository HEAD 81784b4deb88483f803e0bbd0ec422cb0e176809 before citation-promotion edits unless a separately approved successor baseline is proven semantically equivalent for these 39 rows.
- Require all 39 current rows to match this ledger current.pmid/current.title/current.sourceUrl/current.publicationGuard/current.claimType/current.verificationScope and verified=false before mutation.
- Key mutations by primaryId + targetId + current PMID; never by conversational row number alone.
- As-written rows may change only verified false→true plus verification provenance metadata required by existing schema.
- Narrowed rows may change only the exact approved publicationGuard plus verified false→true and required verification provenance metadata.
- Replacement rows must remove the superseded unverified citation/URL from the live source, preserve the old PMID in sourceLocator supersession provenance, install the exact final approved replacement source/guard, and only then set the live source row verified=true. Do not add these unverified superseded sources to citation-retirements.json, which is reserved for previously verified references.
- Do not change claimType, pathwayIntelligence, rank, prevalence, target identity, primary identity, or unrelated relationship content.
- Do not convert population association/risk evidence into an individual-causation conclusion.
- Do not infer an individual veteran nexus from these citation verifications.
- No automatic promotion based only on PMID existence or URL liveness.
- Any mismatch in row identity, source identity, approved guard text, counts, or baseline state is a hard stop; do not partially promote.
- No git push, GitHub write, Vercel deploy/promotion, or Vercel configuration change is authorized by this ledger.

## Expected post-promotion state

- `catalogConditions`: `311`
- `knowledgeBaseFiles`: `311`
- `publishedMappings`: `139`
- `draftMappings`: `172`
- `references`: `181`
- `liveVerified`: `181`
- `retiredVerified`: `6`
- `verifiedProvenance`: `187`
- `unverified`: `0`
- `reviewFindingCount`: `0`
- `hardFindingCount`: `0`
- `clinicalEvidenceReferences`: `176`
- `clinicalEvidenceReferencesWithUrls`: `176`
- `clinicalEvidenceUrlCoverageComplete`: `true`
- `retiredClinicalEvidenceReferencesWithUrls`: `4`
- `clinicalEvidenceProvenanceWithUrls`: `180`
- `finalApprovedSourceRows`: `39`
- `finalUniquePmids`: `36`

## Replacement provenance

- `multiple-myeloma→chronic-kidney-disease`: PMID `29661050` → `24288486`
- `skull-fracture-non-basilar-and-basal→epilepsy`: PMID `19233461` → `33687971`

The two superseded unverified PMIDs must remain as explicit `sourceLocator` supersession provenance on their replacement live rows; they must not remain in the live citation/URL and must not be added to `citation-retirements.json`, which is reserved for previously verified references.

## Local implementation result

- Parent HEAD: `81784b4deb88483f803e0bbd0ec422cb0e176809`
- 39/39 source rows promoted after exact ledger matching
- 23 as-written / 14 narrowed / 2 one-for-one replacements
- 36 unique final live PMIDs
- Expected live citation state: 181 verified / 0 unverified / 0 review / 0 hard
- No individual medical nexus is established by citation verification alone
- No push, GitHub write, Vercel deploy/promotion, or Vercel configuration change
