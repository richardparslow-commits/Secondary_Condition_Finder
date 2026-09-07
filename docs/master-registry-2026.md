# Master Relationship & Evidence Registry 2026

## Status

The authoritative registry is rebaselined at commit `ea005e50` (ME-35 lineage): `currentState` is `ME-39-CITATION-VERIFIED` in both `data/evidence/master-relationships.json` and `data/evidence/master-sources.json`. Run `node scripts/audit-master-registry.js` to confirm registry/data parity at any time. The all-94 citation-verification approval was applied on 2026-09-04, ME-36/ME-37/ME-38 added sixteen published PTSD relationships on 2026-09-06, and ME-39 published `rem-sleep-disorder → parkinsons-disease` on 2026-09-06; the current registry therefore has no pending live citation references. Numbered batch sections below retain their historical verification snapshots and intermediate counts.

## Current state

The authoritative current state is the ME-39 citation-verified registry:

- 363 relationships across 813 mapping files: 140 published / 673 draft.
- 289 explicit publication guards / 74 legacy rationale boundaries.
- 379 live relationship-source uses: **379 verified / 0 pending verification**.
- 346 active source entities: **345 clinical + 1 legal authority**.
- 0 pending-verification clinical source entities.
- 7 superseded-unverified, 1 correction-only, and 1 retired-only source entity.
- 355 total source entities including lineage/history.
- 6 retired-verified relationship-source uses preserved.

ME-36, ME-37, and ME-38 (all 2026-09-06) expanded the published `ptsd` mapping with sixteen bounded, `ASSOCIATION_ONLY`, `NOT_ESTABLISHED` relationships. ME-39 (2026-09-06) published `rem-sleep-disorder → parkinsons-disease` as the first published outgoing relationship from `rem-sleep-disorder` — an ASSOCIATION_ONLY prodromal temporal-risk marker (ME-14, Postuma 2020, PMID 20083800) guarded as prediction/prodrome, not causation. ME-39 also added the `governanceNotes` schema field for published-mapping governance records and updated the `rem-sleep-disorder` disposition from `FINAL-CLOSE-DIRECTION` to `PUBLISHED-PRODROMAL-OUTGOING`. The numbered ME-6 through ME-35 sections below are immutable historical implementation and verification snapshots; their intermediate counts are not current totals.

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

## ME-10 implementation pending citation verification

The approved ME-10 implementation adds exactly five rank-2 relationships while preserving all existing rank-1 mappings, identities, publication states, and pathwayIntelligence state:

- `bronchiectasis -> sleep-apnea` / PMID 41905893, association-only with separate OSA diagnosis and conventional OSA confounders preserved.
- `thyroiditis -> urticaria` / PMID 42511690, restricted to autoimmune thyroiditis plus chronic urticaria and explicitly association-only.
- `charcot-arthropathy -> osteomyelitis` / replacement PMID 42141385, restricted to Charcot foot with documented ulceration/soft-tissue breakdown/wound infection or compatible deep-infection chronology.
- `lyme-disease -> uveitis` / PMID 41546697, a bounded ocular-manifestation relationship requiring both diagnoses and competing ophthalmic etiologies to be preserved.
- `narcolepsy -> hypertension` / PMID 41747645, association-only with separate hypertension diagnosis and cardiometabolic/medication confounders preserved.

All five new KB references remain `verified:false`; their normalized master sources remain `pending-verification`. Mapping approval and PubMed identity matching do not authorize citation promotion.

No new identity, publication-state change, rank-1 change, semantic broadening beyond the approved guards, or pathwayIntelligence change is part of ME-10 implementation. A later separate qualified-human ME-10 citation-verification gate is required before any of these five references may become `verified:true`.

## ME-10 qualified-human citation verification

The five ME-10 clinical references have been promoted exactly as implemented following explicit human source-level approval.

- `bronchiectasis -> sleep-apnea` / PMID 41905893 — approve-as-implemented.
- `thyroiditis -> urticaria` / PMID 42511690 — approve-as-implemented.
- `charcot-arthropathy -> osteomyelitis` / PMID 42141385 — approve-as-implemented.
- `lyme-disease -> uveitis` / PMID 41546697 — approve-as-implemented.
- `narcolepsy -> hypertension` / PMID 41747645 — approve-as-implemented.

No relationship semantic, phenotype restriction, publication guard, citation text, PMID/DOI, source identity, rank, taxonomy, publication state, or pathwayIntelligence value changed during citation verification.

## ME-11 implementation pending citation verification

- `actinomycosis -> osteomyelitis` / PMID 41871568: Require clinically established cervicofacial/oral actinomycosis plus a separately diagnosed mandibular osteomyelitis phenotype. Do not generalize to all actinomycosis or all osteomyelitis. Preserve odontogenic infection, trauma, surgery, malignancy and other infectious causes. The source is rare-disease/case-plus-review evidence and must not be presented as population-level causal proof.
- `insomnia -> hypertension` / PMID 33360604: Treat as population-level association/risk only, not individual causation. Evidence was stronger for difficulty maintaining sleep and early-morning awakening than for sleep-onset difficulty. Preserve obstructive sleep apnea, obesity, age, sex, renal/endocrine disease, medications/substances, sleep duration and other conventional hypertension risks.
- `periodontal-disease -> osteoporosis` / PMID 36377800: Require periodontitis as the primary phenotype and separately diagnosed osteoporosis. Treat as longitudinal population-level risk/association only. Preserve age, sex/menopause, smoking, glucocorticoid exposure, nutritional status, endocrine disease, immobility, medications and other osteoporosis risks.
- `uterine-fibroids -> endometriosis` / PMID 31006843: Treat strictly as co-occurrence/association and screening relevance, not fibroids causing endometriosis. Preserve shared estrogen-related biology, age, infertility/nulliparity, referral and surgical-selection bias, and other endometriosis risk factors.
- `bronchiolitis -> pulmonary-hypertension` / PMID 42444963: Use only for bronchiolitis obliterans syndrome/chronic lung allograft dysfunction after lung transplantation, with separately diagnosed pulmonary hypertension. Do not generalize to ordinary acute bronchiolitis. Preserve vascular/anastomotic complications, recurrent idiopathic pulmonary arterial hypertension, recurrent thromboembolic disease, left-heart/diastolic dysfunction, underlying transplant indication and other pulmonary-hypertension causes. The review calls for prospective longitudinal studies; do not state individual causation.

All five ME-11 KB references remain `verified:false`, and their normalized master sources remain `pending-verification`. The three approved retrieval-source replacements are already resolved to the final PMIDs above; no additional source substitution is authorized. Mapping approval and PubMed identity matching do not authorize citation promotion. No identity, rank-1, taxonomy, publication-state, or pathwayIntelligence change is part of ME-11 implementation.

## Mapping Expansion ME-12 — local citation-verified state

Five approved relationships were added to draft D0 primaries without changing publication status; the user-approved ME-12 rank-resolution amendment sets each single-suggestion draft D1 relationship to rank 1 to satisfy the standing gapless-rank invariant. Current state: 233 relationships; published P1 66 / P2+ 73; draft D1 6; 241 live references with 241 verified and 0 unverified; 218 active and 0 pending source entities (227 total); 159 explicit publication guards and 74 legacy rationale boundaries. All five ME-12 citations are qualified-human verified exactly as implemented.

## Mapping Expansion ME-13 — local citation-verified state

Five approved rank-1 relationships were added to draft D0 primaries without changing publication status. Current state: 238 relationships; published P1 66 / P2+ 73; draft D1 11; 246 live references with 246 verified and 0 unverified; 223 active and 0 pending source entities (232 total); 164 explicit publication guards and 74 legacy rationale boundaries. Registered-primary coverage is 150/311, leaving 161 primaries; among the remaining primaries, 38 are already used as targets and 123 have never been used in the master registry. All five ME-13 citations are qualified-human verified exactly as implemented.

## Mapping Expansion ME-14 — local citation-verified state

Five approved rank-1 relationships were added to D0 primaries while preserving each primary's existing publication state. Current state: 243 relationships; published P1 66 / P2+ 73; draft D1 16; 251 live references with 251 verified and 0 unverified; 228 active and 0 pending source entities (237 total); 169 explicit publication guards and 74 legacy rationale boundaries. Registered-primary coverage is 155/311, leaving 156 primaries; among the remaining primaries, 39 are already used as targets and 117 have never been used in the master registry. Read-before-write publication states preserved exactly: hidradenitis-suppurativa=draft, maxillofacial-fracture=draft, nontoxic-thyroid-enlargement=draft, rem-sleep-disorder=draft, varicose-veins=draft. All five ME-14 citations are qualified-human verified exactly as implemented.

## Mapping Expansion ME-15 — Mental Disorders wave batch 1 (local citation-verified state)

Five approved bounded Mental Disorders relationships were added to draft primaries while preserving each primary's existing publication state: `anxiety-disorder -> depressive-disorder` (rank 1, PMID 17548747), `panic-disorder -> agoraphobia` (rank 1, PMID 16585471), `ocd -> depressive-disorder` (rank 2, PMID 18725912), `binge-eating-disorder -> depressive-disorder` (rank 1, PMID 16815322), `bipolar-disorder -> anxiety-disorder` (rank 1, PMID 17485606). Current state: 248 relationships; published P1 66 / P2+ 73; draft D1 19; 256 live references with 256 verified and 0 unverified; 233 active and 0 pending source entities (242 total); 174 explicit publication guards and 74 legacy rationale boundaries. Registered-primary coverage is 159/311, leaving 152 primaries; among the remaining primaries, 37 are already used as targets and 115 have never been used in the master registry. Read-before-write publication states preserved exactly: anxiety-disorder=draft, panic-disorder=draft, ocd=draft, binge-eating-disorder=draft, bipolar-disorder=draft. All five ME-15 citations are qualified-human verified exactly as implemented.

## Mapping Expansion ME-16 — Mental Disorders wave batch 2 (pre-qualified-human-citation-verification state)

Five approved bounded Mental Disorders relationships were added to draft primaries while preserving each primary's existing publication state: `bulimia-nervosa -> depressive-disorder` (rank 1, PMID 21383252), `specific-phobia -> depressive-disorder` (rank 1, PMID 28222820), `hoarding-disorder -> depressive-disorder` (rank 1, PMID 24158881), `body-dysmorphic-disorder -> depressive-disorder` (rank 1, PMID 16893571), `agoraphobia -> depressive-disorder` (rank 1, PMID 27775828). Current state: 253 relationships; published P1 66 / P2+ 73; draft D1 24; 261 live references with 256 verified and 5 pending qualified-human citation verification; 233 active and 5 pending source entities (247 total); 179 explicit publication guards and 74 legacy rationale boundaries. Registered-primary coverage is 164/311, leaving 147 primaries; among the remaining primaries, 37 are already used as targets and 110 have never been used in the master registry. Read-before-write publication states preserved exactly: bulimia-nervosa=draft, specific-phobia=draft, hoarding-disorder=draft, body-dysmorphic-disorder=draft, agoraphobia=draft. The five ME-16 citations remain pending separate qualified-human citation verification.

## Mapping Expansion ME-17 — batch 3 (pre-qualified-human-citation-verification state)

Five approved bounded relationships were added to draft primaries while preserving each primary's existing publication state: `persistent-depressive-disorder -> depressive-disorder` (rank 1, PMID 16648329), `somatic-symptom-disorder -> depressive-disorder` (rank 1, PMID 18433651), `fibromyalgia -> depressive-disorder` (rank 1, PMID 16908799), `irritable-bowel-syndrome -> depressive-disorder` (rank 1, PMID 11910364), `tinnitus -> depressive-disorder` (rank 1, PMID 30909841). Current state: 258 relationships; published P1 66 / P2+ 73; draft D1 29; 266 live references with 256 verified and 10 pending qualified-human citation verification; 233 active and 10 pending source entities (252 total); 184 explicit publication guards and 74 legacy rationale boundaries. Registered-primary coverage is 169/311, leaving 142 primaries; among the remaining primaries, 37 are already used as targets and 105 have never been used in the master registry. Read-before-write publication states preserved exactly: persistent-depressive-disorder=draft, somatic-symptom-disorder=draft, fibromyalgia=draft, irritable-bowel-syndrome=draft, tinnitus=draft. The ten ME-16/ME-17 citations remain pending separate qualified-human citation verification.

## Mapping Expansion ME-18 — batch 4 (pre-qualified-human-citation-verification state)

Five approved bounded relationships were added to draft primaries while preserving each primary's existing publication state: `chronic-fatigue-syndrome -> depressive-disorder` (rank 1, PMID 12562565), `illness-anxiety-disorder -> depressive-disorder` (rank 1, PMID 8039697), `cyclothymic-disorder -> bipolar-disorder` (rank 1, PMID 22459786), `alopecia-areata -> depressive-disorder` (rank 1, PMID 31163237), `vitiligo -> depressive-disorder` (rank 1, PMID 27878819). Current state: 263 relationships; published P1 66 / P2+ 73; draft D1 34; 271 live references with 256 verified and 15 pending qualified-human citation verification; 233 active and 15 pending source entities (257 total); 189 explicit publication guards and 74 legacy rationale boundaries. Registered-primary coverage is 174/311, leaving 137 primaries; among the remaining primaries, 37 are already used as targets and 100 have never been used in the master registry. Read-before-write publication states preserved exactly: chronic-fatigue-syndrome=draft, illness-anxiety-disorder=draft, cyclothymic-disorder=draft, alopecia-areata=draft, vitiligo=draft. The fifteen ME-16/ME-17/ME-18 citations remain pending separate qualified-human citation verification.

## Mapping Expansion ME-19 — batch 5 (pre-qualified-human-citation-verification state)

Five approved bounded relationships were added to previously framework-only draft primaries (first ME batch over the Wave-8 catalog expansion) while preserving each primary's existing publication state: `traumatic-brain-injury-residuals -> depressive-disorder` (rank 1, PMID 25038422), `allergic-rhinitis -> asthma` (rank 1, PMID 31660100), `diabetic-nephropathy -> chronic-kidney-disease` (rank 1, PMID 36272764), `menstrual-disorders -> anemia` (rank 1, PMID 37538011), `oral-lichen-planus-lichenoid-lesions -> oral-cancer` (rank 1, PMID 28438300). Current state: 268 relationships; published P1 66 / P2+ 73; draft D1 39; 276 live references with 256 verified and 20 pending qualified-human citation verification; 233 active and 20 pending source entities (262 total); 194 explicit publication guards and 74 legacy rationale boundaries. Registered-primary coverage is 179/813, leaving 634 primaries; among the remaining primaries, 37 are already used as targets. Read-before-write publication states preserved exactly: traumatic-brain-injury-residuals=draft, allergic-rhinitis=draft, diabetic-nephropathy=draft, menstrual-disorders=draft, oral-lichen-planus-lichenoid-lesions=draft. The twenty ME-16/ME-17/ME-18/ME-19 citations remain pending separate qualified-human citation verification.

## Mapping Expansion ME-20 — batch 6 (pre-qualified-human-citation-verification state)

Five approved bounded relationships were added to previously framework-only draft primaries (backlog rows 1-5 from the ME-19 plan, second ME batch over the Wave-8 catalog expansion) while preserving each primary's existing publication state: `pheochromocytoma -> hypertension` (rank 1, PMID 24893135), `sjogren-s-syndrome -> dry-eye-syndrome` (rank 1, PMID 41009391), `leukoplakia -> oral-cancer` (rank 1, PMID 26189354), `erythroplakia -> oral-cancer` (rank 1, PMID 35488780), `meningitis -> hearing-loss` (rank 1, PMID 24618106). Current state: 273 relationships; published P1 66 / P2+ 73; draft D1 44; 281 live references with 256 verified and 25 pending qualified-human citation verification; 233 active and 25 pending source entities (267 total); 199 explicit publication guards and 74 legacy rationale boundaries. Registered-primary coverage is 184/813, leaving 629 primaries; among the remaining primaries, 37 are already used as targets. Read-before-write publication states preserved exactly: pheochromocytoma=draft, sjogren-s-syndrome=draft, leukoplakia=draft, erythroplakia=draft, meningitis=draft. The twenty-five ME-16..ME-20 citations remain pending separate qualified-human citation verification.

## Mapping Expansion ME-21 — batch 7 (pre-qualified-human-citation-verification state)

Five approved bounded relationships were added to previously framework-only draft primaries while preserving each primary's existing publication state: `peptic-ulcer-disease -> anemia` (rank 1, PMID 7942718), `eosinophilic-esophagitis -> dysphagia` (rank 1, PMID 34609446), `cholelithiasis -> pancreatitis` (rank 1, PMID 24679420), `insulin-resistance-syndrome -> diabetes-mellitus-type-2` (rank 1, PMID 12231073), and `metabolic-syndrome -> diabetes-mellitus-type-2` (rank 1, PMID 24843675). Current state: 278 relationships; published P1 66 / P2+ 73; draft D1 49; 286 live references with 256 verified and 30 pending qualified-human citation verification; 233 active and 30 pending source entities (272 total); 204 explicit publication guards and 74 legacy rationale boundaries. Registered-primary coverage is 189/813, leaving 624 primaries; among the remaining primaries, 37 are already used as targets. Read-before-write publication states preserved exactly: peptic-ulcer-disease=draft, eosinophilic-esophagitis=draft, cholelithiasis=draft, insulin-resistance-syndrome=draft, metabolic-syndrome=draft. The thirty ME-16..ME-21 citations remain pending separate qualified-human citation verification.

## Mapping Expansion ME-22 — batch 8 (pre-qualified-human-citation-verification state)

Five approved bounded relationships were added to previously framework-only draft primaries while preserving each primary's existing publication state: `transient-ischemic-attack-residuals -> cerebrovascular-accident-stroke-residuals` (rank 1, PMID 18071162), `testicular-torsion -> testicular-atrophy` (rank 1, PMID 26509312), `lichen-sclerosus -> squamous-cell-carcinoma` (rank 1, PMID 32089333), `nasal-polyps -> asthma` (rank 1, PMID 33065369), and `diabetic-gastroparesis -> gastroparesis` (rank 1, PMID 31081877). Current state: 283 relationships; published P1 66 / P2+ 73; draft D1 54; 291 live references with 256 verified and 35 pending qualified-human citation verification; 233 active and 35 pending source entities (277 total); 209 explicit publication guards and 74 legacy rationale boundaries. Registered-primary coverage is 194/813, leaving 619 primaries; among the remaining primaries, 37 are already used as targets. Read-before-write publication states preserved exactly: transient-ischemic-attack-residuals=draft, testicular-torsion=draft, lichen-sclerosus=draft, nasal-polyps=draft, diabetic-gastroparesis=draft. The thirty-five ME-16..ME-22 citations remain pending separate qualified-human citation verification.
