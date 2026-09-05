# Mapping Expansion ME-20 — Approved Implementation Ledger

**APPROVED AND APPLIED LOCALLY — CITATIONS PENDING VERIFICATION**

Required baseline: `ea005e50ccbc30800dd46f3872f764f98e977c1f`
Commit subject: `map: mapping expansion ME-20 (5 relationships)`
Issue: #360 Mapping Expansion Wave (ME-15+); ME-20 continues the ME-19 backlog over Wave-8 framework-only identities (catalog 813)

## Approved scope

Five bounded relationships approved by qualified-human review on 2026-09-02 (the top five ranked rows from the `docs/mapping-expansion-me19-plan.md` backlog). All five rows enter at rank 1 on previously unregistered, framework-only draft primaries (`draft: true`, empty suggestions); each primary's live publication state is read immediately before mutation and preserved unchanged (all five remain draft). All five new clinical source references enter as `verified:false`; matching master sources (all five new) enter as `pending-verification`. Citation verification is separately gated and remains out of scope for this implementation batch.

## 1. `pheochromocytoma` → `hypertension`
- Rank: **1** — PMID: **24893135** — DOI: `10.1210/jc.2014-1498`
- Source: Lenders JW, Duh QY, Eisenhofer G, Gimenez-Roqueplo AP, Grebe SK, Murad MH, Naruse M, Pacak K, Young WF Jr; Endocrine Society. Pheochromocytoma and paraganglioma: an endocrine society clinical practice guideline. J Clin Endocrinol Metab. 2014;99(6):1915-1942. PMID 24893135. doi:10.1210/jc.2014-1498.
- Claim boundary: guideline-recognized-association
- Guard: Require a diagnosed pheochromocytoma (biochemically confirmed catecholamine excess with compatible imaging or histology) and separately established hypertension with compatible chronology; the cited Endocrine Society clinical practice guideline identifies paroxysmal or sustained hypertension as the most common clinical presentation of pheochromocytoma and paraganglioma, without establishing that pheochromocytoma caused an individual's sustained hypertension as opposed to paroxysmal episodes or unrelated essential hypertension. Preserve essential (primary) hypertension, renal and renovascular hypertension, other endocrine causes (primary aldosteronism, thyroid disease, Cushing syndrome), obstructive sleep apnea, medications and substances, and pre-existing hypertension antedating tumor development as competing explanations. Do not infer pheochromocytoma from episodic blood-pressure elevation or from hypertension alone, and do not treat this guideline-framed association as proof that pheochromocytoma caused an individual's hypertensive disease.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 2. `sjogren-s-syndrome` → `dry-eye-syndrome`
- Rank: **1** — PMID: **41009391** — DOI: `10.3390/ijms26188824`
- Source: Soyfoo M, Motulsky E, Sarrand J. Keratoconjunctivitis Sicca in Sjögren Disease: Diagnostic Challenges and Therapeutic Advances. Int J Mol Sci. 2025;26(18):8824. PMID 41009391. doi:10.3390/ijms26188824.
- Claim boundary: population-level-clinical-framing-association
- Guard: Require an established diagnosis of Sjögren's syndrome and objective evidence of dry eye disease/keratoconjunctivitis sicca (for example Schirmer testing, tear-film break-up time, or ocular surface staining) with compatible chronology; the cited review reports that keratoconjunctivitis sicca affects up to 95% of patients with Sjögren disease and is often the earliest and most persistent manifestation, driven by autoimmune-mediated lacrimal gland dysfunction, without establishing that Sjögren's syndrome caused an individual's dry eye as opposed to other causes of aqueous-deficient or evaporative dry eye. Preserve meibomian gland dysfunction, environmental and medication-related dry eye, age-related tear-film changes, contact lens wear, prior ocular surgery, and other autoimmune or ocular-surface conditions as competing explanations. Do not infer Sjögren's syndrome from dry eye symptoms alone, and do not treat this population-level association as proof that Sjögren's syndrome caused an individual's dry eye disease.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 3. `leukoplakia` → `oral-cancer`
- Rank: **1** — PMID: **26189354** — DOI: `10.1111/jop.12339`
- Source: Warnakulasuriya S, Ariyawardana A. Malignant transformation of oral leukoplakia: a systematic review of observational studies. J Oral Pathol Med. 2016;45(3):155-166. PMID 26189354. doi:10.1111/jop.12339.
- Claim boundary: population-level-malignant-transformation-association
- Guard: Require a biopsy-documented oral leukoplakia and separately established oral squamous cell carcinoma with compatible chronology; the cited systematic review of observational studies reported that a meaningful proportion of oral leukoplakias undergo malignant transformation to oral squamous cell carcinoma, without establishing that any individual's cancer arose from the leukoplakic lesion. Preserve tobacco use, alcohol use, other potentially malignant disorders (erythroplakia, oral submucous fibrosis), HPV infection, immunocompromise, and other oral-cancer risk factors as competing explanations. Do not infer cancer from clinical appearance or from dysplasia alone, and do not treat this population-level association as proof that oral leukoplakia caused an individual's oral cancer.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 4. `erythroplakia` → `oral-cancer`
- Rank: **1** — PMID: **35488780** — DOI: `10.1111/jop.13304`
- Source: Lorenzo-Pouso AI, Lafuente-Ibáñez de Mendoza I, Pérez-Sayáns M, Pérez-Jardón A, Chamorro-Petronacci CM, Blanco-Carrión A, Aguirre-Urízar JM. Critical update, systematic review, and meta-analysis of oral erythroplakia as an oral potentially malignant disorder. J Oral Pathol Med. 2022;51(7):585-593. PMID 35488780. doi:10.1111/jop.13304.
- Claim boundary: population-level-malignant-transformation-association
- Guard: Require a biopsy-documented oral erythroplakia and separately established oral squamous cell carcinoma with compatible chronology; the cited systematic review and meta-analysis reported an overall malignant development rate of oral erythroplakia of 19.9%, without establishing that any individual's cancer arose from the erythroplakic lesion. Preserve tobacco use, alcohol use, other potentially malignant disorders (leukoplakia, oral submucous fibrosis), HPV infection, immunocompromise, and other oral-cancer risk factors as competing explanations. Do not infer cancer from clinical appearance or from dysplasia alone, and do not treat this population-level association as proof that oral erythroplakia caused an individual's oral cancer.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 5. `meningitis` → `hearing-loss`
- Rank: **1** — PMID: **24618106** — DOI: `10.1186/1756-0500-7-138`
- Source: Karanja BW, Oburra HO, Masinde P, Wamalwa D. Prevalence of hearing loss in children following bacterial meningitis in a tertiary referral hospital. BMC Res Notes. 2014;7:138. PMID 24618106. doi:10.1186/1756-0500-7-138.
- Claim boundary: clinical-sample-comorbidity-association
- Guard: Require an established bacterial meningitis episode with compatible chronology and separately documented hearing loss; the cited tertiary-referral study of children treated for bacterial meningitis found sensorineural hearing loss highly prevalent following the infection, without establishing that an individual's hearing loss was meningitic in origin. Preserve ototoxic medications (including aminoglycosides used to treat the meningitis), suppurative otitis media or labyrinthitis, congenital or pre-existing hearing loss, ototoxic systemic illness, and noise exposure as competing explanations. Do not infer hearing loss from meningitis history alone, and do not treat this clinical-sample association as proof that meningitis caused an individual's hearing loss.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`## Projected non-publication counts

- Relationships: 268 → **273**
- Registered primaries: 179 → **184** (of 813)
- Remaining primaries: 634 → **629**
- Remaining target-only: 37 → **37**
- References: 276 → **281**; verified remains **256**; unverified 20 → **25**
- Master sources: 233 active / 20 pending / 262 total → **233 active / 25 pending / 267 total**
- Clinical sources: 232 active / 20 pending → **232 active / 25 pending**
- Explicit publication guards: 194 → **199**
- P1/D1 counts are resolved from the read-before-write publication-state proof.

## Current authoritative snapshot

ME-20's five rows are implemented and unchanged, but the ledger's projection note is stale relative to the registry state produced by later ME batches.

Measured from the current branch head using `node scripts/audit-master-registry.js` and the live CI gate output:

- knowledge-base files: 813
- published: 139
- draft: 674
- relationships: 347
- live source-reference uses: 355
- verified live uses: 261
- pending-verification live uses: 94
- live clinical uses: 350
- live legal uses: 5
- active source entities: 238
- pending-verification source entities: 91
- active clinical source entities: 237
- pending clinical source entities: 91
- active legal source entities: 1
- total source entities: 338
- explicit publication guards: 273
- legacy rationale boundaries: 74

The five ME-20 relationships and their five pending-verification master sources are present as implemented:

- rel-pheochromocytoma-to-hypertension (pmid-24893135)
- rel-sjogren-s-syndrome-to-dry-eye-syndrome (pmid-41009391)
- rel-leukoplakia-to-oral-cancer (pmid-26189354)
- rel-erythroplakia-to-oral-cancer (pmid-35488780)
- rel-meningitis-to-hearing-loss (pmid-24618106)

## Local implementation result
- 5/5 approved relationships added (all rank 1), continuing the ME-19 backlog over the Wave-8 framework-only identities.
- Publication state preserved from the read-before-write proof: `{"pheochromocytoma": "draft", "sjogren-s-syndrome": "draft", "leukoplakia": "draft", "erythroplakia": "draft", "meningitis": "draft"}`.
- 5/5 new source references remain `verified:false`; matching master sources are `pending-verification` (five new master source records, no reuse of active verified sources).
- Registered-primary coverage is 184/813; 629 primaries remain, with 37 target-only primaries unchanged.
- `leukoplakia -> oral-cancer` and `erythroplakia -> oral-cancer` are separate, independently guarded subtype-specific malignant-transformation propositions (distinct PMIDs, distinct guards), so no duplicate-edge or single-source conflation is introduced.
- Citation verification remains separately gated (qualified-human decision required before any of the five references may become `verified:true`).
- No GitHub/Vercel write was performed beyond the commit+push of this batch.