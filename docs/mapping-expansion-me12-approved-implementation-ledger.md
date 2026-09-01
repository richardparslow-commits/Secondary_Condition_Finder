# Mapping Expansion ME-12 — Approved Local Implementation Ledger

**APPROVED AND APPLIED LOCALLY — CITATIONS PENDING VERIFICATION**

- Required exact HEAD: `dc9502a81c93740b7c9cbd5f0ef9c1f44fc88898`
- Five additions, all **rank 1** under the user-approved ME-12 rank-resolution amendment.
- All five primaries remain **draft**; publication status must not change.
- All five new clinical references enter `verified:false` / master `pending-verification`.
- Citation verification is separately gated.
- GitHub/Vercel writes remain forbidden.

## Approved rows

### 1. `pulmonary-embolism -> pulmonary-hypertension`
- PMID **35081846**
- DOI `10.1080/14779072.2022.2034499`
- Source: *Chronic thromboembolic pulmonary hypertension: a review of risk factors, management and current challenges*
- Evidence type: clinical review
- Guard: Restrict the broad pulmonary-hypertension target to separately established chronic thromboembolic pulmonary hypertension after a documented pulmonary embolism. Require persistent mismatched perfusion or chronic thromboembolic/fibrotic obstruction after an appropriate post-PE anticoagulation interval and hemodynamically confirmed pulmonary hypertension under accepted criteria. Do not infer CTEPH from acute PE, persistent dyspnea, hypoxemia, or an echocardiographic estimate alone. Preserve left-heart disease, other lung disease or hypoxia, chronic thromboembolic disease without pulmonary hypertension, drugs/toxins, and other pulmonary-hypertension etiologies as competing explanations.

### 2. `subdural-hematoma -> seizure-disorder`
- PMID **27914224**
- DOI `10.1016/j.seizure.2016.11.017`
- Source: *A systematic review of epileptic seizures in adults with subdural haematomas*
- Evidence type: systematic review
- Guard: Require objectively documented subdural hematoma and separately established epileptic seizures or a seizure disorder with compatible chronology. Do not infer a chronic seizure disorder from prophylactic antiseizure medication, transient altered mental status, or an unconfirmed spell. Distinguish an isolated acute symptomatic seizure from recurrent unprovoked seizures or epilepsy when the target diagnosis requires that distinction. Preserve pre-existing epilepsy, additional traumatic brain injury, stroke, infection, metabolic or toxic disturbance, medication or substance effects, and other seizure etiologies.

### 3. `multiple-sclerosis -> optic-neuritis`
- PMID **36135184**
- DOI `10.3390/cimb44090272`
- Source: *Optic Neuritis in Multiple Sclerosis-A Review of Molecular Mechanisms Involved in the Degenerative Process*
- Evidence type: clinical/pathophysiologic review
- Guard: Require established multiple sclerosis and a separately diagnosed optic-neuritis phenotype compatible with inflammatory demyelinating optic neuropathy. Do not infer optic neuritis from nonspecific visual loss, eye pain, abnormal imaging, or multiple-sclerosis diagnosis alone. Preserve neuromyelitis optica spectrum disorder, MOG-antibody disease, ischemic, infectious, compressive, toxic/nutritional, hereditary, and other optic-neuropathy causes.

### 4. `hodgkins-lymphoma -> hypothyroidism`
- PMID **29681481**
- DOI `10.1016/j.ijrobp.2018.03.003`
- Source: *Predictors of Hypothyroidism in Hodgkin Lymphoma Survivors After Intensity Modulated Versus 3-Dimensional Radiation Therapy*
- Evidence type: radiation-treatment cohort with external validation dataset
- Guard: Require documented Hodgkin lymphoma, documented thyroid-exposing neck or supradiaphragmatic radiation treatment consistent with the source phenotype, and separately established hypothyroidism after treatment with compatible chronology. Do not infer hypothyroidism from Hodgkin lymphoma or chemotherapy alone. Preserve autoimmune thyroid disease, thyroid surgery or radioiodine, medications, pituitary or hypothalamic disease, congenital thyroid disease, and other causes of hypothyroidism.

### 5. `reactive-arthritis -> uveitis`
- PMID **34528623**
- DOI `10.4997/JRCPE.2021.319`
- Source: *Reactive arthritis: a clinical review*
- Evidence type: clinical review
- Guard: Require established reactive arthritis and separately documented anterior uveitis by appropriate ophthalmic evaluation. Do not infer uveitis from reactive arthritis, conjunctivitis, red eye, ocular irritation, or photophobia alone. Preserve infectious uveitis, HLA-B27-associated uveitis from another spondyloarthritis, sarcoidosis, inflammatory bowel disease, medication-related disease, trauma, and other ocular inflammatory causes.

## Projected post-implementation pending state

- 311 KB identities / **233** relationships.
- Published matrix unchanged: **P1 66 / P2+ 73**.
- Draft one-edge primaries: **D1 6** (1 -> 6).
- Registered primaries: **145**; remaining unregistered primaries: **166**.
- Citation state: **241 refs / 236 verified / 5 unverified / 0 review / 0 hard**.
- Verified provenance remains **242**.
- Master sources: **213 active / 5 pending / 227 total**.
- Explicit publication guards: **159**; legacy rationale boundaries remain **74**.

No citation promotion, taxonomy change, publication-status change, pathway-intelligence change, semantic broadening, source replacement after precheck, push, GitHub write, or Vercel action is authorized.

## Non-semantic audit projection correction

ME-12 preserves all five new primaries as draft. The citation audit counts the five new `verified:false` references as unverified, but its review findings are restricted to published mappings. Therefore the correct pending state is **241 refs / 236 verified / 5 unverified / 0 review / 0 hard**. This correction changes no medical proposition, source identity, publication guard, rank, publication status, or citation-verification state.


## ME-12 rank-resolution amendment — user approved 2026-08-22

The original ME-12 approval assigned rank 2 to five draft D0 → D1 relationships. The repository's standing mapping invariant requires every nonempty suggestion list to use unique, gapless ranks starting at 1. Because each of these five draft primaries has exactly one suggestion, `[2]` is invalid and `[1]` is the only schema-valid ordinal without adding an unapproved relationship or weakening the global validator.

The amendment therefore changes **only** the five ME-12 relationship ranks from **2 → 1**. It preserves every primary/target identity, relationship direction, PMID, DOI, citation, source URL, rationale, evidence gap, publication guard, `sometimes-explored` prevalence, draft status, `verified:false` state, pending-verification state, and aggregate count. Citation promotion, publication changes, taxonomy changes, pathway-intelligence changes, semantic broadening, source replacement, and GitHub/Vercel writes remain forbidden.

## Local implementation result after rank-resolution amendment

- 5/5 approved relationships are present at rank 1, the only valid ordinal for each single-suggestion draft D1 mapping.
- All five primary KB identities remain draft; no publication status changed.
- 5/5 new source references remain `verified:false`; matching master sources are `pending-verification`.
- Citation verification remains separately gated.
- No GitHub/Vercel write was performed.
