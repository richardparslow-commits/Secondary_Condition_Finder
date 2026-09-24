# Condition Catalog Expansion Roadmap

Status: target catalog v2 implemented
Baseline: 193 catalog conditions at `c24b45800b2fd936d0b1721cad5bfb54c4bf15e0`
Target v2: 300 catalog conditions — implemented through Wave 7

## Purpose

This roadmap records the controlled expansion of the user-facing condition catalog without weakening the repository's medical-evidence or citation safeguards. The 300-condition target is a versioned product-coverage milestone, not a claim that 300 conditions exhaust medicine or the VA rating schedule.

The comparison backbone is the current 38 CFR Part 4 rating schedule, including Appendix C's alphabetical index where current, together with VA's public Disability Benefits Questionnaires (DBQ) inventory. Those sources establish condition/rating identity and exam groupings. They do **not** establish secondary medical causation or aggravation.

Clinical secondary-condition relationships must be researched separately and remain draft until condition-specific evidence satisfies the knowledge-base publication rules.

## Expansion rules

1. Keep condition identity, secondary mappings, and presumptives separate.
2. Every new catalog `id` receives exactly one matching `data/knowledge-base/<id>.json` file in the same change.
3. New mappings start `draft: true` with no suggestions unless condition-specific clinical research is already sufficient for publication.
4. A rating-schedule citation describes how VA evaluates a disability. It is never medical nexus evidence.
5. Population-level association is not an individual nexus. Causation and aggravation language must stay conservative.
6. Medication/treatment and intermediate-factor theories require link-by-link evidence; they are not inferred from a medication name or a regulatory citation.
7. New source references remain `verified: false` until qualified human review under repository policy.
8. Process roughly 10-20 conditions per batch and run structural validation, citation audit, lint, typecheck, tests, production build, and real-browser E2E before merge.
9. When the rating schedule has no single diagnosis-specific diagnostic code, record the applicable rating framework and a review note rather than inventing a code.
10. Product-wave grouping does not override the actual Part 4 rating authority; when a condition is rated in another body-system schedule, record that schedule explicitly.
11. When a broader regulatory umbrella overlaps an existing narrower user-facing diagnosis, keep names and aliases non-overlapping and document the relationship rather than silently collapsing or duplicating condition identity.
12. When one roadmap identity intentionally groups related diagnoses for discovery, keep the user-facing grouping explicit but require later clinical authoring to evaluate diagnosis-specific etiologies and pathways separately.
13. When distinct diagnoses share one rating code, preserve separate catalog identities where useful and never infer shared etiology, causation, aggravation, or secondary pathways from the common code.
14. Recheck regulatory currency before authoring. A historical diagnostic code removed or replaced by a later rule must not be carried forward as current authority, and a code limited by disease site, severity, treatment state, or residual must not be generalized to every presentation.

## Coverage target

| State | Conditions |
|---|---:|
| Baseline before expansion | 193 |
| Wave 1 implemented | +20 |
| Catalog after Wave 1 | 213 |
| Wave 2 implemented | +18 |
| Catalog after Wave 2 | 231 |
| Wave 3 implemented | +15 |
| Catalog after Wave 3 | 246 |
| Wave 4 implemented | +15 |
| Catalog after Wave 4 | 261 |
| Wave 5 implemented | +15 |
| Catalog after Wave 5 | 276 |
| Wave 6 implemented | +14 |
| Catalog after Wave 6 | 290 |
| Wave 7 implemented | +10 |
| **Target catalog v2 achieved** | **300** |

The candidate list deliberately consolidates obvious synonyms and avoids creating separate user-facing entries for every residual, laterality variant, or diagnostic-code phrasing. Laterality should eventually be modeled as an attribute rather than by multiplying diagnoses.

## Wave 1 — musculoskeletal and neurological (20) — implemented

Wave 1 established the controlled expansion pattern and added 12 musculoskeletal plus 8 neurological identities.

### Musculoskeletal (12)

| ID | Display name | Part 4 identity |
|---|---|---|
| `gout` | Gout | 38 CFR 4.71a / DC 5017 |
| `osteoporosis` | Osteoporosis, Residuals of | 38 CFR 4.71a / DC 5013 |
| `osteomalacia` | Osteomalacia, Residuals of | 38 CFR 4.71a / DC 5014 |
| `osteitis-deformans` | Osteitis Deformans (Paget Disease of Bone) | 38 CFR 4.71a / DC 5016 |
| `bursitis` | Bursitis | 38 CFR 4.71a / DC 5019 |
| `myositis` | Myositis | 38 CFR 4.71a / DC 5021 |
| `heterotopic-ossification` | Heterotopic Ossification | 38 CFR 4.71a / DC 5023 |
| `tendinopathy` | Tendinitis / Tendinosis / Tendinopathy | 38 CFR 4.71a / DC 5024 |
| `pes-cavus` | Acquired Pes Cavus (Claw Foot) | 38 CFR 4.71a / DC 5278 |
| `metatarsalgia` | Anterior Metatarsalgia (Morton's Disease) | 38 CFR 4.71a / DC 5279 |
| `hallux-rigidus` | Hallux Rigidus | 38 CFR 4.71a / DC 5281 |
| `hammertoe` | Hammer Toe | 38 CFR 4.71a / DC 5282 |

### Neurological (8)

| ID | Display name | Part 4 identity |
|---|---|---|
| `parkinsons-disease` | Parkinson's Disease | 38 CFR 4.124a / DC 8004 |
| `multiple-sclerosis` | Multiple Sclerosis | 38 CFR 4.124a / DC 8018 |
| `myasthenia-gravis` | Myasthenia Gravis | 38 CFR 4.124a / DC 8025 |
| `syringomyelia` | Syringomyelia | 38 CFR 4.124a / DC 8024 |
| `seizure-disorder` | Seizure Disorder / Epilepsy | 38 CFR 4.124a / DCs 8910-8914 |
| `trigeminal-neuralgia` | Trigeminal Neuralgia (Tic Douloureux) | 38 CFR 4.124a / DC 8405; 38 CFR 4.124 |
| `ulnar-neuropathy` | Ulnar Neuropathy | 38 CFR 4.124a / DCs 8516, 8616, 8716 |
| `common-peroneal-neuropathy` | Common Peroneal (Fibular) Neuropathy | 38 CFR 4.124a / DCs 8521, 8621, 8721 |

All 20 entered Wave 1 with draft KB files. Publication of any secondary relationship is a separate evidence-authoring step.

## Wave 2 — musculoskeletal and peripheral-neurological depth (18) — implemented

Wave 2 deepened joint, ligament, foot, peripheral-nerve, pain-syndrome, cauda-equina, and cranial-nerve coverage. Specific diagnostic codes were recorded only where the rating schedule supplied a defensible condition- or nerve-specific identity.

### Musculoskeletal (10)

| ID | Display name | Part 4 identity |
|---|---|---|
| `psoriatic-arthritis` | Psoriatic Arthritis | 38 CFR 4.71a / DC 5002; chronic residuals under DC 5003 |
| `charcot-arthropathy` | Charcot Neuropathic Arthropathy | 38 CFR 4.71a / DC 5009; acute phase under DC 5002, chronic residuals under DC 5003 |
| `sacroiliac-joint-dysfunction` | Sacroiliac Joint Dysfunction | 38 CFR 4.71a / DC 5236 |
| `femoroacetabular-impingement` | Femoroacetabular Impingement | 38 CFR 4.71a / applicable hip-thigh criteria; no single diagnosis-specific DC assigned |
| `hip-labral-tear` | Hip Labral Tear | 38 CFR 4.71a / applicable hip-thigh criteria; no single diagnosis-specific DC assigned |
| `greater-trochanteric-pain-syndrome` | Greater Trochanteric Pain Syndrome | 38 CFR 4.71a / applicable hip-thigh criteria; no single diagnosis-specific DC assigned |
| `patellar-instability` | Patellar Instability | 38 CFR 4.71a / DC 5257 |
| `acl-injury` | Anterior Cruciate Ligament (ACL) Injury | 38 CFR 4.71a / DC 5257 for qualifying persistent instability; other knee residuals as documented |
| `pcl-injury` | Posterior Cruciate Ligament (PCL) Injury | 38 CFR 4.71a / DC 5257 for qualifying persistent instability; other knee residuals as documented |
| `tarsal-metatarsal-malunion-nonunion` | Tarsal or Metatarsal Malunion / Nonunion | 38 CFR 4.71a / DC 5283 |

### Neurological (8)

| ID | Display name | Part 4 identity |
|---|---|---|
| `radial-neuropathy` | Radial Neuropathy | 38 CFR 4.124a / DCs 8514, 8614, 8714 |
| `median-neuropathy` | Median Neuropathy | 38 CFR 4.124a / DCs 8515, 8615, 8715 |
| `tibial-neuropathy` | Tibial Neuropathy | 38 CFR 4.124a / DCs 8524-8724 or 8525-8725 according to lesion location |
| `femoral-neuropathy` | Femoral Neuropathy | 38 CFR 4.124a / DCs 8526, 8626, 8726 |
| `meralgia-paresthetica` | Meralgia Paresthetica | 38 CFR 4.124a / external cutaneous nerve of thigh DCs 8529, 8629, 8729 |
| `complex-regional-pain-syndrome` | Complex Regional Pain Syndrome | 38 CFR 4.124a and 4.124 / affected-nerve framework; no single CRPS DC assigned |
| `cauda-equina-syndrome` | Cauda Equina Syndrome | 38 CFR 4.124a plus applicable spine/residual criteria; no single diagnosis-specific DC assigned |
| `cranial-nerve-palsy` | Cranial Nerve Palsy | 38 CFR 4.124a / nerve-specific or special-sense criteria according to nerve involved |

All 18 entered Wave 2 with draft KB files and no published suggestions.

## Wave 3 — endocrine and cardiovascular depth (15) — implemented

### Endocrine (7)

| ID | Display name | Part 4 identity |
|---|---|---|
| `thyroiditis` | Thyroiditis | 38 CFR 4.119 / DC 7906 |
| `nontoxic-thyroid-enlargement` | Nontoxic Thyroid Enlargement | 38 CFR 4.119 / DC 7902 |
| `acromegaly` | Acromegaly | 38 CFR 4.119 / DC 7908 |
| `hyperaldosteronism` | Hyperaldosteronism | 38 CFR 4.119 / DC 7917; evaluate as benign or malignant neoplasm as appropriate |
| `hyperpituitarism` | Hyperpituitarism | 38 CFR 4.119 / DC 7916; evaluate as benign or malignant neoplasm as appropriate |
| `diabetes-insipidus` | Diabetes Insipidus | 38 CFR 4.119 / DC 7909 |
| `pituitary-neoplasm` | Pituitary Neoplasm | 38 CFR 4.119 / DC 7914 if malignant or DC 7915 if benign; behavior must be documented |

### Cardiovascular and pulmonary-vascular (8)

| ID | Display name | Part 4 identity |
|---|---|---|
| `hypertensive-heart-disease` | Hypertensive Heart Disease | 38 CFR 4.104 / DC 7007 |
| `cardiomyopathy` | Cardiomyopathy | 38 CFR 4.104 / DC 7020 |
| `heart-valve-replacement-residuals` | Heart Valve Replacement Residuals | 38 CFR 4.104 / DC 7016 |
| `coronary-bypass-residuals` | Coronary Bypass Surgery Residuals | 38 CFR 4.104 / DC 7017 |
| `heart-transplant-residuals` | Heart Transplant Residuals | 38 CFR 4.104 / DC 7019 |
| `implantable-cardiac-pacemaker` | Implantable Cardiac Pacemaker | 38 CFR 4.104 / DC 7018 |
| `thromboangiitis-obliterans` | Thromboangiitis Obliterans (Buerger's Disease) | 38 CFR 4.104 / DC 7115 |
| `pulmonary-hypertension` | Pulmonary Hypertension | 38 CFR 4.97 / DC 6817; respiratory authority despite Wave 3 product grouping |

All 15 entered Wave 3 with draft KB files and no published suggestions. Pituitary neoplasm retains behavior-dependent coding, and pulmonary hypertension retains its actual respiratory authority.

## Wave 4 — respiratory, sleep, eye, and cranial-sense depth (15) — implemented

### Respiratory and ENT (8)

| ID | Display name | Part 4 identity |
|---|---|---|
| `bronchiectasis` | Bronchiectasis | 38 CFR 4.97 / DC 6601 |
| `chronic-laryngitis` | Chronic Laryngitis | 38 CFR 4.97 / DC 6516 |
| `vocal-cord-paralysis` | Vocal Cord Paralysis | 38 CFR 4.97 / laryngeal residual framework; no single diagnosis-specific DC assigned |
| `aphonia` | Aphonia | 38 CFR 4.97 / DC 6519 for complete organic aphonia; incomplete aphonia under DC 6516 |
| `granulomatous-rhinitis` | Granulomatous Rhinitis | 38 CFR 4.97 / DC 6524 |
| `bacterial-rhinitis` | Bacterial Rhinitis | 38 CFR 4.97 / DC 6523 |
| `pulmonary-vascular-disease` | Pulmonary Vascular Disease | 38 CFR 4.97 / DC 6817; kept distinct from narrower pulmonary hypertension |
| `diaphragm-paralysis` | Diaphragm Paralysis / Paresis | 38 CFR 4.97 / DC 6840 |

### Neurological sleep-wake (1)

| ID | Display name | Part 4 identity |
|---|---|---|
| `narcolepsy` | Narcolepsy | 38 CFR 4.124a / DC 8108 |

### Ophthalmologic and special sense (6)

| ID | Display name | Part 4 identity |
|---|---|---|
| `uveitis` | Uveitis | 38 CFR 4.79 / DC 6000 |
| `keratitis` | Keratitis | 38 CFR 4.79 / DC 6001 current keratopathy framework |
| `dry-eye-syndrome` | Dry Eye Syndrome | 38 CFR 4.79 / lacrimal-apparatus or other applicable eye criteria; no single dry-eye DC assigned |
| `retinal-dystrophy` | Retinal Dystrophy | 38 CFR 4.79 / DC 6042; kept distinct from macular degeneration |
| `nystagmus` | Nystagmus | 38 CFR 4.79 / DC 6016 expressly covers central nystagmus; other types require review |
| `ptosis` | Ptosis | 38 CFR 4.79 / DC 6019 |

All 15 entered Wave 4 with draft KB files and no published suggestions.

## Wave 5 — digestive and genitourinary depth (15) — implemented

### Digestive (10)

| ID | Display name | Part 4 identity |
|---|---|---|
| `esophageal-stricture` | Esophageal Stricture | 38 CFR 4.114 / DC 7203 |
| `achalasia` | Achalasia (Esophageal Motility Disorder) | 38 CFR 4.114 / DC 7204 framework |
| `barretts-esophagus` | Barrett's Esophagus | 38 CFR 4.114 / DC 7207 |
| `gastroparesis` | Gastroparesis | 38 CFR 4.114 framework; no single diagnosis-specific DC assigned |
| `peritoneal-adhesions` | Peritoneal Adhesions | 38 CFR 4.114 / DC 7301 |
| `short-bowel-syndrome` | Short Bowel Syndrome | 38 CFR 4.114 / small-intestine resection and short-bowel residual framework |
| `fecal-incontinence` | Fecal Incontinence / Impairment of Sphincter Control | 38 CFR 4.114 / DC 7332 |
| `rectal-prolapse` | Rectal Prolapse | 38 CFR 4.114 / DC 7334 |
| `anal-fistula` | Anal Fistula (Fistula in Ano) | 38 CFR 4.114 / DC 7335 and applicable sphincter-control criteria |
| `chronic-liver-disease` | Chronic Liver Disease Without Cirrhosis | 38 CFR 4.114 / DC 7345; distinct from hepatitis/cirrhosis identities |

### Genitourinary (5)

| ID | Display name | Part 4 identity |
|---|---|---|
| `chronic-pyelonephritis` | Chronic Pyelonephritis | 38 CFR 4.115b / DC 7504 |
| `hydronephrosis` | Hydronephrosis | 38 CFR 4.115b / DC 7509 |
| `urethral-stricture` | Urethral Stricture | 38 CFR 4.115b / DC 7518 |
| `varicocele-hydrocele` | Varicocele / Hydrocele | 38 CFR 4.115b framework; no single diagnosis-specific DC assigned |
| `epididymitis-orchitis` | Chronic Epididymitis / Orchitis | 38 CFR 4.115b / DC 7525 infection framework |

All 15 entered Wave 5 with draft KB files and no published suggestions.

## Wave 6 — mental, hematologic, autoimmune, and skin depth (14) — implemented

### Mental disorders (8)

| ID | Display name | Part 4 identity |
|---|---|---|
| `specific-phobia` | Specific Phobia | 38 CFR 4.130 / DC 9403; distinct from social anxiety despite shared code |
| `dissociative-disorder` | Dissociative Amnesia / Dissociative Identity Disorder | 38 CFR 4.130 / DC 9416 |
| `depersonalization-derealization-disorder` | Depersonalization / Derealization Disorder | 38 CFR 4.130 / DC 9417 |
| `functional-neurological-symptom-disorder` | Functional Neurological Symptom Disorder (Conversion Disorder) | 38 CFR 4.130 / DC 9424 |
| `illness-anxiety-disorder` | Illness Anxiety Disorder | 38 CFR 4.130 / DC 9425 |
| `body-dysmorphic-disorder` | Body Dysmorphic Disorder | 38 CFR 4.130 framework; no single diagnosis-specific DC assigned |
| `hoarding-disorder` | Hoarding Disorder | 38 CFR 4.130 framework; no single diagnosis-specific DC assigned |
| `delusional-disorder` | Delusional Disorder | 38 CFR 4.130 / DC 9208 |

### Hematologic (3)

| ID | Display name | Part 4 identity |
|---|---|---|
| `essential-thrombocythemia` | Essential Thrombocythemia | 38 CFR 4.117 / DC 7718 |
| `primary-myelofibrosis` | Primary Myelofibrosis | 38 CFR 4.117 / DC 7718 |
| `myelodysplastic-syndrome` | Myelodysplastic Syndromes | 38 CFR 4.117 / DC 7725 |

### Skin and cutaneous autoimmune (3)

| ID | Display name | Part 4 identity |
|---|---|---|
| `discoid-lupus` | Discoid Lupus Erythematosus | 38 CFR 4.118 / DC 7809 |
| `scarring-alopecia` | Scarring Alopecia | 38 CFR 4.118 / DC 7830 |
| `hyperhidrosis` | Hyperhidrosis | 38 CFR 4.118 / DC 7832 |

All 14 entered Wave 6 with draft KB files and no published suggestions. Framework-only and shared-code safeguards remain regression-tested.

## Wave 7 — infectious, oncological, and oral/maxillofacial depth (10) — implemented

Wave 7 completes target catalog v2. It adds six infectious/tropical identities, three malignancy identities, and one dental/oral residual identity. The batch includes explicit regulatory-currency and scope safeguards because several candidate labels do not map cleanly to a timeless diagnosis-specific code.

### Infectious and tropical (6)

| ID | Display name | Part 4 identity |
|---|---|---|
| `amebiasis` | Amebiasis | 38 CFR 4.88b / current parasitic-disease framework including DC 6320; former digestive DC 7321 was removed effective May 19, 2024 and is not used as current authority |
| `actinomycosis` | Actinomycosis | 38 CFR 4.97 / DC 6822 under Bacterial Infections of the Lung; extra-pulmonary disease requires body-system review |
| `nocardiosis` | Nocardiosis | 38 CFR 4.97 / DC 6823 under Bacterial Infections of the Lung; extra-pulmonary disease requires body-system review |
| `histoplasmosis` | Histoplasmosis of Lung | 38 CFR 4.97 / DC 6834; stable discovery id retained but the code is specifically pulmonary |
| `strongyloidiasis` | Strongyloidiasis | 38 CFR 4.88b / DC 6325 only for hyperinfection syndrome or disseminated strongyloidiasis; other presentations require broader parasitic/residual review |
| `rickettsial-ehrlichial-anaplasma-infection` | Rickettsial, Ehrlichia, and Anaplasma Infections | 38 CFR 4.88b / DC 6317; regulatory grouping does not imply one etiology or secondary pathway |

### Oncological (3)

| ID | Display name | Part 4 identity |
|---|---|---|
| `ovarian-cancer` | Ovarian Cancer | 38 CFR 4.116 / DC 7627 malignant neoplasms of the gynecological system; broader system code, not an ovary-specific code |
| `testicular-cancer` | Testicular Cancer | 38 CFR 4.115b / DC 7528 malignant neoplasms of the genitourinary system; broader system code, not a testis-specific cancer code |
| `laryngeal-cancer` | Laryngeal Cancer | 38 CFR 4.97 / DC 6819 malignant neoplasms of the respiratory system; distinct from existing lung/tracheal/bronchial `respiratory-cancer` identity |

### Dental and oral (1)

| ID | Display name | Part 4 identity |
|---|---|---|
| `mandibular-nonunion` | Mandibular Nonunion (Nonunion of Mandible) | 38 CFR 4.150 / DC 9903; nonunion must be documented and is distinct from a generic mandibular fracture history |

All 10 enter Wave 7 with draft KB files and no published suggestions. Rating authorities remain `verified: false` under automated authoring policy. The amebiasis historical-code correction, site/severity limits for infectious codes, broad-system cancer-code disclosures, and mandibular-fracture/nonunion distinction are enforced in the Wave 7 regression contract.

## Batch exit criteria

A batch is complete only when:

- every new condition validates under the catalog schema;
- no ID, display name, or alias collision is introduced;
- every new condition has exactly one matching published-or-draft KB file;
- draft entries remain excluded from recommendations;
- no rating authority is presented as clinical nexus evidence;
- obsolete or scope-limited diagnostic codes are not generalized into false current authority;
- the citation audit does not regress;
- lint, typecheck, unit tests, production build, and real-browser journeys pass on the exact branch head;
- documentation counts match the implemented catalog.

## After Wave 7

Target catalog v2 is complete at **300 recognized conditions**, with **107 expansion identities** added across Waves 1-7. Catalog completion does not publish the 107 draft secondary mappings and does not imply that all possible medical or VA diagnostic identities have been enumerated.

The next controlled workstream is no longer another numbered catalog wave. It is evidence and quality work: promote only individual secondary relationships with adequate condition-specific clinical support, verify eligible citations through the repository's approved verification workflow, and separately address documented catalog-modeling debt without weakening the 300/300 referential-integrity contract.

Mapping Expansion ME-21 (2026-09-02) added five draft-safe relationships over the Wave-8 identities: `peptic-ulcer-disease -> anemia`, `eosinophilic-esophagitis -> dysphagia`, `cholelithiasis -> pancreatitis`, `insulin-resistance-syndrome -> diabetes-mellitus-type-2`, and `metabolic-syndrome -> diabetes-mellitus-type-2`. Each remains `ASSOCIATION_ONLY`, `NOT_ESTABLISHED`, and pending qualified-human citation verification; no primary publication state changed.

Mapping Expansion ME-22 (2026-09-02) added five additional draft-safe relationships: `transient-ischemic-attack-residuals -> cerebrovascular-accident-stroke-residuals`, `testicular-torsion -> testicular-atrophy`, `lichen-sclerosus -> squamous-cell-carcinoma`, `nasal-polyps -> asthma`, and `diabetic-gastroparesis -> gastroparesis`. Each remains `ASSOCIATION_ONLY`, `NOT_ESTABLISHED`, and pending qualified-human citation verification; no primary publication state changed.

## 2026-09 Master-List Expansion (Wave 8: identity expansion)

**Status: implemented.** The 2026-09 master condition list (14 body-system categories) expanded the catalog from **311 to 813 conditions**, keeping the 813/813 one-to-one catalog-to-knowledge-base coverage contract intact.

- Added **502 framework-only draft identities** — each is a catalog entry plus a draft mapping file whose `todo` records the authoring checklist and whose `suggestions` are empty. No clinical source, relationship, or consensus claim was invented; rating-schedule citations on new identities are framework-level (`38 CFR 4.xxx`) with `verified: false` pending qualified-human verification, and no identity was published.
- Consolidated **13 duplicate identities** into pre-existing catalog entries after an alias/name/id collision audit: retired generic `arthritis` (in favor of `osteoarthritis` / `rheumatoid-arthritis` / `gout`, with compensating aliases), and folded duplicates for HIV/AIDS, gigantism, osteomalacia, epicondylitis, hammertoe, Paget's disease (`osteitis-deformans`), CRPS, meralgia paresthetica, colon cancer, lung/respiratory cancers, frostbite residuals, and prostatitis/prostatodynia into their pre-existing identities with aliases so free-text inputs still resolve.
- Renamed the ambiguous `aneurysms` umbrella to `peripheral-aneurysm` (keeping `aortic-aneurysm` as its own identity) and removed junk parenthetical aliases (e.g., bare `upper`/`lower`/`all joints`/`plantar`/`Type 1`) plus `Gulf War` duplication from non-umbrella identities.
- Governance maintained: the full collision scan (duplicate names, alias-alias, alias-vs-name/id, id-vs-name) runs clean; `kb:validate`, `audit:me-compliance`, `audit-master-registry`, typecheck, lint, and the full Vitest suite (now covering the 813-condition state) all pass; the master-resolution current-state contract and the 139-published/674-draft publication-state pins were updated to the new totals.

Mapping Expansion ME-28 (2026-09-02) added five draft-safe relationships over the Wave-8 identities: `scleroderma -> interstitial-lung-disease`, `hypertrophic-obstructive-cardiomyopathy -> congestive-heart-failure`, `superior-semicircular-canal-dehiscence -> conductive-hearing-loss`, `dysphagia -> malnutrition-residuals`, and `mixed-connective-tissue-disease -> pulmonary-hypertension`. Each remains `ASSOCIATION_ONLY`, `NOT_ESTABLISHED`, and pending qualified-human citation verification; no primary publication state changed.

Mapping Expansion ME-29 (2026-09-02) added five additional draft-safe relationships over previously-unmapped Wave-8 identities: `abscesses -> cellulitis`, `achilles-tendinopathy-rupture -> deep-vein-thrombosis`, `acne-scarring -> depressive-disorder`, `addisons-disease -> depressive-disorder`, and `ageusia -> malnutrition-residuals`. Each remains `ASSOCIATION_ONLY`, `NOT_ESTABLISHED`, and pending qualified-human citation verification; no primary publication state changed. The broader `alopecia` identity was deliberately left unmapped because the narrower `alopecia-areata` identity already carries the depressive-disorder edge, avoiding a duplicate-identity violation of expansion rule 11.

Mapping Expansion ME-30 (2026-09-03) added five more draft-safe relationships over previously-unmapped identities: `alice-in-wonderland-syndrome -> migraine-headaches` (migraine-variant spectrum), `agranulocytosis -> cellulitis` (neutropenic infection complications, Strasbourg cohort), `als -> dysphagia` (bulbar dysfunction, 31.7% prevalence in 23,997 NIS cases), `alzheimer-s-disease -> insomnia` (stage-stratified sleep-abnormality synthesis), and `amputation-of-arm -> phantom-limb-pain` (nationwide survey of 3,374 amputees). Each remains `ASSOCIATION_ONLY`, `NOT_ESTABLISHED`, and pending qualified-human citation verification; no primary publication state changed. `adjustment-disorder` was deliberately left unmapped because its `FINAL-CLOSE-DIRECTION` resolution remains in force: the only defensible review evidence for a depression progression edge is the same broad psychosocial category that caused the original withdrawal. The plural synonym `adjustment-disorders` and the target-less `acquired-syndactyly` and `acrocyanosis` were also deferred.

Mapping Expansion ME-31 (2026-09-03) added five more draft-safe relationships over previously-unmapped identities: `amebic-liver-abscess -> pleural-effusion` (intrathoracic rupture literature), `amputation-of-foot -> phantom-limb-pain`, `amputation-of-hand -> phantom-limb-pain`, `amputation-of-leg -> phantom-limb-pain` (all reusing the ME-30 nationwide amputee-survey source, now carrying four live uses), and `anismus-pelvic-floor-dyssynergia -> fecal-incontinence` (AGA anorectal-disorders criteria). Each remains `ASSOCIATION_ONLY`, `NOT_ESTABLISHED`, and pending qualified-human citation verification; no primary publication state changed. `anhedonia` was deferred as a transdiagnostic symptom rather than a condition (a `-> depressive-disorder` edge would assert the wrong direction), `amputation-of-thumb-fingers-toes` as outside the limb-level evidence scope, and `anal-fissure` and `ankle-disarticulation` to the next batch pending credible targets.

Mapping Expansion ME-32 (2026-09-03) added five more draft-safe relationships over previously-unmapped identities: `ankle-strain -> osteoarthritis` (International Ankle Consortium long-term-consequences review, strictly same-ankle), `ankylosis -> osteoarthritis` (post-traumatic ankle-degeneration literature), `anorgasmia -> depressive-disorder` (sexual-functioning impairment during depression), `anterior-cord-syndrome -> urinary-incontinence` (neurogenic bladder after spinal cord infarction), and `anorectal-stricture -> fecal-incontinence` (impaction with overflow-incontinence mechanism). Each remains `ASSOCIATION_ONLY`, `NOT_ESTABLISHED`, and pending qualified-human citation verification; no primary publication state changed. `anosmia` was deliberately left unmapped because its `FINAL-CLOSE-PROPOSITION-MISMATCH` resolution rests on the withdrawal of a depression meta-analysis whose objective-olfactory-impairment finding did not survive publication-bias adjustment; `acrocyanosis`, `ankyloglossia`, `amputation-of-thumb-fingers-toes`, and `ankle-disarticulation` were deferred for lack of credible in-scope targets.

Mapping Expansion ME-33 (2026-09-03) added five more draft-safe relationships: `anal-fissure -> fecal-incontinence` (chronic-fissure continence study), `ankle-disarticulation -> phantom-limb-pain` (lower-limb amputation-level study), `ankyloglossia -> dysphagia` (posterior tongue-tie swallowing case evidence), `apraxia -> dysphagia` (oral-apraxia subacute-stroke study), and `anterior-interosseous-nerve-syndrome -> peripheral-nerve-paralysis` (AIN motor-palsy series). Each remains `ASSOCIATION_ONLY`, `NOT_ESTABLISHED`, and pending qualified-human citation verification; no primary publication state changed.

Mapping Expansion ME-34 (2026-09-03) added five more draft-safe relationships: `appendicitis -> female-infertility` (appendectomy/tubal-fertility systematic review), `arnold-chiari-malformation -> sleep-apnea` (Chiari-associated pediatric sleep-apnea case), `atrial-flutter -> cerebrovascular-accident-stroke-residuals` (comparative ischemic-stroke-risk cohort), `burns -> contractures` (prospective burn-scar contracture cohort), and `benign-prostatic-hyperplasia -> urinary-incontinence` (BPH-management incontinence analysis). Each remains `ASSOCIATION_ONLY`, `NOT_ESTABLISHED`, and pending qualified-human citation verification; no primary publication state changed. The originally considered `bruxism-awake-sleep -> tmj-dysfunction` row was rejected because the reviewed longitudinal source concluded juvenile bruxism appeared unrelated to TMJ symptoms.

Mapping Expansion ME-35 (2026-09-03) added five more draft-safe relationships: `brown-s-quard-syndrome -> urinary-incontinence` (syndrome-specific urodynamic study), `brain-tumors -> seizure-disorder` (pediatric brain-tumor survivor cohort), `brugada-syndrome -> cardiac-arrhythmia` (ventricular-arrhythmia risk cohort), `bell-s-palsy -> keratitis` (facial-palsy ophthalmic-sequelae review), and `bowen-s-disease -> squamous-cell-carcinoma` (in-situ-to-invasive skin-cancer precursor review). Each remains `ASSOCIATION_ONLY`, `NOT_ESTABLISHED`, and pending qualified-human citation verification; no primary publication state changed. The target phenotypes remain explicitly bounded by each relationship guard.

Mapping Expansion ME-36 (2026-09-06) added six **published** PTSD secondary relationships over existing catalog identities, each `ASSOCIATION_ONLY`, `NOT_ESTABLISHED`, and `NOT_ASSERTED` with a qualified-human-verified clinical reference entered `verified: true` at implementation: `ptsd -> ischemic-heart-disease` (Edmondson CHD meta-analysis, PMID 24176435), `ptsd -> hypertension` (Burg veteran incident-hypertension cohort, PMID 27490852), `ptsd -> diabetes-mellitus-type-2` (Vancampfort T2DM meta-analysis, PMID 26867081), `ptsd -> depressive-disorder` (Rytwinski MDD co-occurrence meta-analysis, PMID 23696449), `ptsd -> insomnia` (Chinoy bidirectional military cohort, PMID 36163136), and `ptsd -> substance-use-disorder` (Jacobsen PTSD-SUD co-occurrence review, PMID 11481147). Because `ptsd` is published (`draft: false`) and published mappings may carry only verified sources, the six sources were approved by the qualified human in-session on 2026-09-06 and entered `verified: true` directly; registry counts ratcheted to 353 relationships / 361 live verified uses / 335 active source entities (344 including lineage), and the registry state advanced to `ME-36-CITATION-VERIFIED`. The independent synthesis `PTSD and Secondary Medical Conditions.pdf` corroborates the two shared anchors (PMID 24176435, PMID 26867081) and supports the remaining edges' condition literature; its other references seed the ME-37 candidate pipeline.

Mapping Expansion ME-37 (2026-09-06) added nine more **published** PTSD secondary relationships sourced from that same synthesis, each `ASSOCIATION_ONLY`, `NOT_ESTABLISHED`, and `NOT_ASSERTED`: `ptsd -> metabolic-syndrome` (Bartoli PMID 23758060 + Rosenbaum PMID 25982700), `ptsd -> systemic-lupus-erythematosus`, `ptsd -> rheumatoid-arthritis`, `ptsd -> inflammatory-bowel-disease`, and `ptsd -> thyroiditis` (Mandagere 2025 autoimmune meta-analysis PMID 40051767 + Hsu 2024 Taiwan cohort PMID 37322294, reused across the autoimmune family), `ptsd -> multiple-sclerosis` (PMID 40051767), `ptsd -> irritable-bowel-syndrome` (Ng SR/MA PMID 30144372), `ptsd -> gerd` (Malhotra GWI-veteran cohort PMID 36942766, narrower bound), and `ptsd -> copd` (Bourassa PMID 41350112 + Vyas PMID 40402632, with a smoking/exposure-dominated guard). Eight distinct qualified-human-verified sources (15 citation uses) entered `verified: true` at implementation; registry counts ratcheted to 362 relationships / 376 live verified uses / 343 active source entities (352 including lineage), and the registry state advanced to `ME-37-CITATION-VERIFIED`. The synthesis's documented no-edge boundary is recorded in the ME-37 ledger: Bourassa's primary analyses found no incident PTSD associations with cancer, renal disease, dementia, or liver disease, so no PTSD edge for those categories is added without disease-specific literature.

Mapping Expansion ME-38 (2026-09-06) added one **published** PTSD secondary relationship over the existing `rem-sleep-disorder` catalog identity, driven by qualified-human medical-literature supplied in-session for REM sleep behavior disorder: `ptsd -> rem-sleep-disorder` (Elliott 2020 video-polysomnography veteran cohort PMID 31587047 + Baldini 2026 systematic review PMID 41616415 + Barone 2020 clinical review PMID 32804070). The edge is `ASSOCIATION_ONLY`, `NOT_ESTABLISHED`, and `NOT_ASSERTED` with a hypothesized-only mechanism and a mandatory diagnostic-boundary guard (confirmed RBD requires polysomnographic REM sleep without atonia; dream enactment alone is insufficient, with TBI, PTSD nightmares/trauma-associated sleep disorder, OSA, periodic limb movements, medications, and alcohol or substance use preserved as alternatives). Three distinct qualified-human-verified sources entered `verified: true` at implementation; registry counts ratcheted to 363 relationships / 379 live verified uses / 346 active source entities (355 including lineage), and the registry state advanced to `ME-38-CITATION-VERIFIED`. `rem-sleep-disorder` itself remains `draft: true` and safe-draft as a primary; ME-38 adds only the incoming published edge from `ptsd`. Husain 2001 (PMID 11435805) and the non-peer-reviewed Shahkhali 2025 preprint were considered but not entered as verified sources, and the preprint's Mendelian-randomization finding (no causal support) is recorded as no-causation guard evidence in the ME-38 ledger.

Mapping Expansion ME-39 (2026-09-06) published the existing draft `rem-sleep-disorder → parkinsons-disease` prodromal edge (ME-14, Postuma 2020 PMID 20083800) as the first published outgoing relationship from `rem-sleep-disorder`. The edge is `ASSOCIATION_ONLY` with a mandatory prodromal-temporal-risk guard: REM sleep behavior disorder is a marker or risk state for later synucleinopathy (primarily Parkinson disease), not a cause; many patients do not convert; dementia with Lewy bodies and multiple system atrophy remain alternative phenoconversion outcomes. ME-39 also introduced the `governanceNotes` schema field to allow published mappings (`draft: false`) to preserve governance decision records without blocking the `todo`-empty validation rule, and updated the `rem-sleep-disorder` approved disposition from `FINAL-CLOSE-DIRECTION` to `PUBLISHED-PRODROMAL-OUTGOING`. Registry counts ratcheted to 363 relationships / 379 live verified uses / 346 active source entities (355 including lineage) / 140 published / 673 draft, and the registry state advanced to `ME-39-CITATION-VERIFIED`. Deferred items documented in the ME-39 ledger: REM → DLB and REM → MSA (catalog gaps), mTBI → RBD (insufficient isolated evidence), Husain 2001 and Shahkhali preprint (not entered).

Mapping Expansion ME-41 (2026-09-12) added **zero relationships**. It is a documentation-only batch that closes the residual scope of issue #360 (Mapping Expansion Wave: Mental Disorders) by recording evidence-grounded safe-draft dispositions for the six Mental Disorders primaries left on HOLD during ME-16 planning: `adjustment-disorder`, `delusional-disorder`, `depersonalization-derealization-disorder`, `dissociative-disorder`, `functional-neurological-symptom-disorder`, and `schizoaffective-disorder`. Each was re-tested against live PubMed evidence via NCBI E-utilities on 2026-09-12, and the examined records plus the reason each fails are now recorded in the primary's KB `todo` in the `chronic-fatigue-syndrome` (ME-18) precedent shape, and in `docs/mapping-expansion-me41-safe-draft-disposition-ledger.md`. The failure modes are distinct and specific: `adjustment-disorder` — Casey 2009 (PMID 19845414) frames the depression relationship as a *differential-diagnosis* boundary rather than comorbidity, and Mitchell 2011 (PMID 21251875) reports the two prevalences separately in oncology populations, so the ME-30 `FINAL-CLOSE-DIRECTION` resolution stands; `delusional-disorder` — the targeted comorbidity query returned zero records, leaving only case reports and antipsychotic-treatment reviews; `depersonalization-derealization-disorder` — Yang 2023 (PMID 35699456) reports ~50% DDD prevalence *within* depression, i.e. P(DDD | depression), so using it would invert the registry direction; `dissociative-disorder` — Spiegel 2011/2013 (PMIDs 21910187, 23394228) are DSM-5 criteria-recommendation papers whose only comorbidity statement concerns conversion disorder, not a mood outcome; `functional-neurological-symptom-disorder` — Tsui 2017 (PMID 28434123) is titled for comorbidity but examines overlap with *chronic pain*, the wrong comparator; and `schizoaffective-disorder` — Miller and Black 2019 (PMID 30699217) establish that a major mood episode is *constitutive* of the depressive subtype, so a `-> depressive-disorder` edge would restate a diagnostic criterion as an empirical relationship (a phenotype-identity barrier, not an evidence gap). `schizoaffective-disorder` was previously the one issue #360 primary with no disposition record anywhere; ME-41 supplies it. Registry counts are unchanged at 363 relationships / 379 live verified uses / 346 active source entities (355 including lineage) and the registry state remains `ME-39-CITATION-VERIFIED`; all six primaries remain `draft: true` with `suggestions: []`, no `pathwayIntelligence` was added, and the historical Wave 1-7 `expansion-dispositions.json` snapshot was left untouched. Because ME-41 creates no relationship and no citation, it asserts no mapping approval and no qualified-human citation verification. Issue #360's 20 primaries are now fully accounted for: 14 mapped (ME-15 through ME-18) and 6 safe drafts with documented rationale.


**Status: implemented (breaking migration).** The knowledge base was previously a ranked *association registry with a qualitative `prevalence` label*. Under 38 CFR § 3.310 a secondary condition must be either *caused by* or *aggravated by* the service-connected primary, so the associative `prevalence` model was deprecated and removed. Every suggestion now carries a mandatory CRG trio, enforced by the Zod schema:

1. **`nexusClaim`** — a discriminated union with three arms:
   - `DIRECT_CAUSATION` — requires `etiologicalTrigger`; forbids aggravation fields.
   - `AGGRAVATION` — requires `baselineProgression` (natural non-SC course) and `aggravatingFactor` (biomechanical/systemic force from the SC primary); forbids causation fields.
   - `ASSOCIATION_ONLY` — an honest third arm required by the data: many guards explicitly disclaim that the population-level association establishes an individual nexus. These edges must say so, and must mark `causalMechanism.hypothesizedOnly: true`. Forcing an association into a causation arm would fabricate VA claims.
2. **`causalMechanism`** — categorized physiological/biomechanical cascade (`BIOMECHANICAL_ALTERATION`, `PHARMACOLOGICAL_IATROGENIC`, `PSYCHOPHYSIOLOGICAL`, `SYSTEMIC_INFLAMMATORY`, etc.) with a `primaryVector` and an iatrogenic/hypothesis flag.
3. **`evidentiaryProfile`** — replaces `prevalence` with `etiologicalConsensus` mapped to the VA "at least as likely as not" (≥ 50%) standard (`WELL_ESTABLISHED`, `PROBABLE`, `CONTESTED_REQUIRES_SPECIFIC_EVIDENCE`, `IATROGENIC_TREATMENT_EFFECT`, `NOT_ESTABLISHED`), plus `vaNexusProbabilityAlignment`, `conservativeRationale`, `evidenceGaps`, `alternativeEtiologiesToRuleOut`, and `requiresSpecificDbqEvidence`.

**Enforcement:**

- `src/lib/kb/schema.ts` — `nexusClaimSchema`/`causalMechanismSchema`/`evidentiaryProfileSchema` are required on every suggestion; `superRefine` rejects an `ASSOCIATION_ONLY` edge that is not `hypothesizedOnly` or claims a `WELL_ESTABLISHED` consensus, mirrors the source-reference legal-vs-clinical separation, and enforces the CONTESTED ≥ 2 alternative-etiologies requirement.
- `scripts/validate-knowledge-base.js` (`npm run kb:validate`) — quarantines any suggestion whose references are > 30% unverified (downgraded/excluded) and any mapping that relies on a single unverified citation; reports CRG-field violations.
- `scripts/audit-citation-decay.js` (`npm run citations:decay`) — link-rot and temporal-staleness audit (flags 4xx/5xx probes and stale `sourceCheckedOn`); enforces a `CITATION_CEILING` of 10 unverified-or-decayed live references.
- `scripts/audit-master-registry.js` — fails on any drift between KB suggestions and `master-relationships.json` rows, including the recomputed `suggestionObjectHash` over the full CRG objects, so the parity contract now covers the trio, not just rank/rationale/references.
- Engine (`src/lib/engine/recommend.ts`) — ranking is now consensus-weighted through `CONSENSUS_ORDER` instead of prevalence, and `Recommendation.etiologicalConsensus` is surfaced to the UI as a qualitative tier.

**Migration notes for future contributors:** the migration grandfathers all 263 pre-existing suggestions from their guards. Rows whose guards explicitly disclaim individual causation were classified `ASSOCIATION_ONLY` / `NOT_ESTABLISHED`; rows with bounded causal claims (treatment-effect, device-complication, phenotype-limited chains) kept `DIRECT_CAUSATION` / `AGGRAVATION`. The `prevalence` field must not be reintroduced. Promote an `ASSOCIATION_ONLY` edge to a causal arm only with new condition-specific evidence and a qualified-human citation review.

## D1 draft-authoring batch (2026-09-22)

**Status: draft-quarantined authoring — pending qualified-human citation verification.** The D1 batch authored the first five backlog drafts that carry no prior qualified-human disposition (the alphabetically-first zero-edge drafts — `acquired-syndactyly`, `acrocyanosis`, `adjustment-disorder`, `adjustment-disorders`, `alopecia` — are deliberately closed or deferred by ME-29/ME-30/ME-32/ME-33/ME-41 and were left untouched). Each new edge is `ASSOCIATION_ONLY` / `NOT_ESTABLISHED` with `hypothesizedOnly: true`, a full CRG trio, and NCBI-bibliography-confirmed clinical sources entered with `verified: false`; mapping approval is not citation verification.

1. `apathy -> depressive-disorder` (Marin PMIDs 2403472, 10320433) — distinct-syndrome co-occurrence; identity-overlap caution recorded.
2. `aphasia-dysphasia -> depressive-disorder` (Kauhanen PMIDs 11070376, 10471439) — poststroke cohort co-occurrence and deficit-burden correlation.
3. `arteriosclerosis -> cerebrovascular-accident-stroke-residuals` (Sacco PMID 14794445) — umbrella-identity population association; vessel-specific evidence required.
4. `arteriovenous-fistula -> congestive-heart-failure` (Stern & Klemmer PMID 21223485) — case-report-based high-output failure pathway; kept at association strength for lack of controlled denominators.
5. `astigmatism -> tension-type-headache` (Wajuihian PMID 38187096, Khoo PMID 38337384) — observational refractive-error headache association with a contested mechanism.

**Batch 2 (2026-09-22):** 4 additional `ASSOCIATION_ONLY` drafts: `atypical-odontalgia -> trigeminal-neuralgia` (Patel PMID 23097829, Melis PMID 14629241 — classification proximity, diagnosis-of-exclusion caution), `auriculotemporal-neuralgia -> trigeminal-neuralgia` (Speciali PMID 16004845 — sibling neuralgia diagnoses, no directional pathway), `bagassosis -> interstitial-lung-disease` (Pereira PMID 27703382, Buechner PMID 5609030 — syndrome-level fibrotic HP, historic bagassosis evidence base), and `balanitis-balanoposthitis -> phimosis` (Morris & Krieger PMID 28567234 — bidirectional inflammation-scarring cycle, not unidirectional). `baker-s-cyst` was deliberately deferred with a governance record: the ME-35 screening already excluded the only candidate edge (`baker-s-cyst -> deep-vein-thrombosis`, diagnostic-mimic evidence and a 2022 study finding popliteal cysts are not a DVT risk factor), and no defensible target-specific evidence base exists for other targets.

Registry state after batch 2: 372 relationships (298 explicit guards / 74 legacy boundaries); 393 live references with 379 verified and 14 pending qualified-human verification; 346 active and 14 pending source entities (369 total).

**Batch 3 (2026-09-22):** 3 additional `ASSOCIATION_ONLY` drafts: `bankart-lesion -> post-traumatic-osteoarthritis` (Weisberg PMID 38709911 — untreated-course instability/bone-loss association, arthropathy attribution requires competing-cause exclusion), `benign-migratory-glossitis -> psoriasis` (González-Álvarez PMID 30739339, Tarakji PMID 25584342 — meta-analytic prevalence association, shared inflammatory diathesis), and `benign-paroxysmal-positional-vertigo -> anxiety-disorder` (Yeo PMID 37560919, Kim PMID 40815545 — meta-analytic anxiety comorbidity with acknowledged bidirectionality). `balint-s-syndrome` was deferred (no honest catalog target for its visuomotor sequelae; acuity-preserving phenotype would be misrepresented by the visual-impairment target; case-series evidence base) and `basal-cell-carcinoma` was deferred per the ME-35 exclusion (shared UV risk explains multiple-primary skin cancers; BCC does not progress to SCC).

Registry state after batch 3: 375 relationships (301 explicit guards / 74 legacy boundaries); 398 live references with 379 verified and 19 pending qualified-human verification; 346 active and 19 pending source entities (374 total). The remaining genuine backlog is approximately 449 undispositioned zero-edge drafts.

**Batch 4 (2026-09-22):** 5 additional `ASSOCIATION_ONLY` drafts: `bicipital-tendinitis -> rotator-cuff-injury` (Braun PMID 21335355, Sethi PMID 10633904 — arthroscopic-cohort co-prevalence with shared degenerative loading; direction unresolvable), `bile-reflux-gastritis -> esophagitis` (Nath & Warshaw PMID 6372664, Gowen PMID 3970596 — alkaline-reflux syndrome co-occurrence with the postsurgical confound preserved), `biliary-tract-cancer -> malnutrition-residuals` (Titapun PMID 37822625, Miyata PMID 28887635 — CONUT-defined malnutrition prevalence in cholangiocarcinoma cohorts; etiologic attribution requires treatment and hepatic-driver exclusion), `bladder-contracture -> urinary-frequency-retention` (Jhang PMID 26087832, Khalaf PMID 21909645 — contracted-bladder phenotype of chronic inflammatory cystitis; urodynamic confirmation required), and `bladder-pain-syndrome-interstitial-cystitis -> depressive-disorder` (McKernan PMID 28990698, Chuang PMID 25577231 — systematic-review and population-cohort comorbidity with acknowledged bidirectionality). No deferrals this batch.

Registry state after batch 4: 380 relationships (306 explicit guards / 74 legacy boundaries); 408 live references with 379 verified and 29 pending qualified-human verification; 346 active and 29 pending source entities (384 total). Remaining backlog by the reproducible zero-edge/undispositioned filter: 461 drafts. Next batch: `blindness`, `bone-cysts`, `bone-tumors`, `boutonniere-deformity`, `brain-cancer`.

**Batch 5 (2026-09-22):** 4 additional drafts, including the batches' first `DIRECT_CAUSATION`: `brain-cancer -> seizure-disorder` (Scheffel PMID 40576825, Towlson PMID 26478444 — tumor-associated seizures as a symptomatic manifestation of glial-tumor biology, PROBABLE consensus, with preexisting-epilepsy and provocation exclusion required), plus `blindness -> depressive-disorder` (Ribeiro PMID 26222114, Brunes PMID 28039061 — systematic-review and cross-sectional comorbidity with acknowledged bidirectionality), `bone-cysts -> malunion-nonunion-of-fractures` (Zhao PMID 34134687 — lesion-population co-occurrence; individual healing-complication attribution requires fixation and metabolic-cause exclusion), and `bone-tumors -> malunion-nonunion-of-fractures` (same shared source under a separate identity-specific scope). `boutonniere-deformity` was deferred: the documented direction is upstream (rheumatoid synovitis and trauma producing the deformity), and the PIP degenerative-outcome question returned zero target-specific PubMed hits.

Registry state after batch 5: 384 relationships (310 explicit guards / 74 legacy boundaries); 416 live references with 379 verified and 37 pending qualified-human verification; 346 active and 36 pending source entities (391 total). Remaining backlog by the reproducible zero-edge/undispositioned filter: 456 drafts.

**Batch 6 (2026-09-22):** 2 additional `ASSOCIATION_ONLY` drafts: `bronchitis -> copd` (Bui PMID 29628376, Dey PMID 40751209, with Marossy PMID 17023728 recorded as the competing null — early-life infection trajectory association; chronic-bronchitis remains a separate identity with its own edge) and `broncho-alveolar-carcinoma -> pleural-effusion` (Hommeyer PMID 1871256, Akhtar PMID 35578218 — pneumonic-type lepidic spread with cytology-proven malignant effusion at case-report level; no cohort denominators). Three deferrals: a drafted `bruxism-awake-sleep -> tmj-disorder` edge was withdrawn before landing because ME-34 had already rejected the bruxism-to-TMJ relationship on evidence grounds (PMID 9758394) and re-adjudicating a recorded human rejection is not an automation decision (its relationship and two source entities were removed in lockstep); `bronchomalacia` was deferred (the documented direction is upstream, COPD producing tracheobronchomalacia); `bullosis-diabeticorum` was deferred (no catalog target identity exists for the blister-rupture/foot-cascade sequelae, and the literature base is case reports only).

Registry state after batch 6: 386 relationships (312 explicit guards / 74 legacy boundaries); 421 live references with 379 verified and 42 pending qualified-human verification; 346 active and 41 pending source entities (396 total). Remaining backlog by the reproducible zero-edge/undispositioned filter: 454 drafts. Next batch: `bullous-pemphigoid`, `bundle-branch-block`, `burning-mouth-syndrome`, `bursitis`, `byssinosis`.

**Batch 7 (2026-09-22):** 2 additional `ASSOCIATION_ONLY` drafts: `bundle-branch-block -> implantable-cardiac-pacemaker` (Kusumoto PMID 24745858 matched-cohort progression association with Nijenhuis PMID 28340150 recorded as the deliberately excluded post-TAVI procedural contrast; block-as-marker versus block-as-driver preserved as competing) and `burning-mouth-syndrome -> depressive-disorder` (Lee PMID 36834086, Drage PMID 12622276, Canfora PMID 41436103 — comorbidity documented with the reverse-direction cohort dominance explicitly recorded; no directional claim). Three deferrals honoring prior dispositions: `bullous-pemphigoid` (ME-35 directionality exclusion — neurologic disease precedes the pemphigoid), `byssinosis` (ME-35 exclusion pending a source separating occupational byssinosis from generic organic-dust exposure), and `bursitis` (promotion-batch-24 safe-draft disposition — phenotype heterogeneity prevents any single in-scope edge).

Registry state after batch 7: 388 relationships (314 explicit guards / 74 legacy boundaries); 426 live references with 379 verified and 47 pending qualified-human verification; 346 active and 46 pending source entities (401 total). Remaining backlog by the reproducible zero-edge/undispositioned filter: 449 drafts. Next batch: `camptodactyly`, `cannabinoid-hyperemesis-syndrome`, `capgras-syndrome`, `carcinoid-syndrome`, `carotid-sinus-hypersensitivity`.

## D1 draft-authoring batch 8 (2026-09-22)

Mapping Expansion D1 batch 8 authored three draft-quarantined relationships over previously-unmapped identities: `cannabinoid-hyperemesis-syndrome -> esophagitis` (repetitive-emesis mechanical injury, case-report class with no denominators), `capgras-syndrome -> depressive-disorder` (dementia-population cross-sectional comorbidity, CATIE-AD re-analysis), and `carcinoid-syndrome -> malnutrition-residuals` (trial-observation weight-loss burden with the tumor-burden confounder recorded as a competing driver). Each remains `ASSOCIATION_ONLY`, `NOT_ESTABLISHED`, and pending qualified-human citation verification; no primary publication state changed. `camptodactyly` was deferred on evidence-ground zero-record screening (the single target-specific PubMed record is a surgical-indications list with no comorbidity content) and no catalog identity exists for the adaptive-use or skin-integrity sequelae; `carotid-sinus-hypersensitivity` was deferred on the ME-41 phenotype-identity barrier (the cardioinhibitory response is the diagnostic finding of the syndrome itself, the falls/syncope outcome has no distinct catalog identity, and vasovagal-syncope is a distinct diagnostic entity that would misclassify identity). Composition was re-derived after the disposition screen vetoed the alphabetically-next five: `acquired-syndactyly`, `acrocyanosis`, `adjustment-disorder`, `adjustment-disorders`, and `alopecia` all carry prior qualified-human dispositions (ME-30, ME-32, ME-29, and the ME-30 `FINAL-CLOSE-DIRECTION` closure re-tested by ME-41) and were left untouched, as were `amputation-of-thumb-fingers-toes`, `anhedonia`, and `anosmia` (ME-31/ME-32/promotion-batch closures). Registry state after batch 8: 391 relationships (317 explicit guards / 74 legacy boundaries); 433 live references with 379 verified and 54 pending qualified-human verification; 346 active and 53 pending source entities (408 total). Remaining backlog by the reproducible zero-edge/undispositioned filter: 515 drafts, of which the next undispositioned five after the full disposition screen (which additionally closes `carpal-tunnel-syndrome` as a promotion-batch-31 safe draft with an explicit CTS/median-neuropathy taxonomy rejection) are `cellulitis`, `central-cord-syndrome`, `cerebral-contusion`, `cerebrovascular-accident-stroke-residuals`, and `cervical-strain`.

## D1 draft-authoring batch 9 (2026-09-22)

Mapping Expansion D1 batch 9 authored five draft-quarantined relationships over previously-unmapped identities: `cellulitis -> osteomyelitis` (contiguous-spread infection pathway at case-report and imaging-anatomic class), `central-cord-syndrome -> urinary-incontinence` (22-man VA-registry video-urodynamic cohort, tiered consistently with the ME-32 sibling edge), `cerebral-contusion -> seizure-disorder` (the batches' second DIRECT_CAUSATION draft: meta-analytic RR 2.35 plus a 3,093-patient prospective cohort identifying frontal-temporal contusion as an independent multivariate predictor, PROBABLE consensus with the early-versus-late-seizure chronology boundary enforced), `cerebrovascular-accident-stroke-residuals -> depressive-disorder` (meta-analytic 25-50 percent comorbidity with pre-stroke depression pooled OR 3.0 deliberately entered as the competing-evidence anchor), and `cervical-strain -> post-traumatic-headache` (symptomatic-cohort association with the Schrader 1996 matched-control null deliberately recorded as competing evidence). The direct edge mirrors the brain-cancer precedent and rests entirely on its cited meta-analysis and cohorts surviving qualified-human review; all five remain pending qualified-human citation verification and no primary publication state changed. Registry state after batch 9: 396 relationships (322 explicit guards / 74 legacy boundaries); 447 live references with 379 verified and 68 pending qualified-human verification; 346 active and 67 pending source entities (422 total). Remaining backlog by the reproducible zero-edge/undispositioned filter: 510 drafts, of which the next five after the disposition screen are `chalazion`, `charles-bonnet-syndrome`, `chemical-pneumonitis`, `chilblains`, and `chloracne`.

## D1 Batch 10 (2026-09-22): chalazion, charles-bonnet-syndrome, chemical-pneumonitis, chilblains, chloracne

Draft-authored under the D1 program. Three association-only edges (9 pending-verification
NCBI-verified clinical sources) and two documented deferrals. All refs verified:false pending
qualified-human verification under docs/citation-verification-sop.md.

- chalazion -> visual-impairment (ASSOCIATION_ONLY, MECHANICAL_OR_COMPRESSIVE, hypothesized):
  excision-reversal trials (Bagheri 2009, PMID 19551663) demonstrate the mechanical
  astigmatism pathway; lasting visual impairment is not reported in general chalazion
  populations, so no directional claim is drafted.
- charles-bonnet-syndrome -> anxiety-disorder (ASSOCIATION_ONLY, PSYCHOPHYSIOLOGICAL,
  hypothesized): cross-sectional distress comorbidity (Walker 2025 PMID 41771640; Higgins
  2021 PMID 34377938; Jones 2021 PMID 39351142) without control groups or onset ordering.
- chemical-pneumonitis -> interstitial-lung-disease (ASSOCIATION_ONLY,
  SYSTEMIC_INFLAMMATORY, hypothesized): chronic aspiration/injury-to-fibrosis progression
  (Hu 2015 PMID 25762348; Mukhopadhyay 2015 PMID 25732447; Komiya 2015 PMID 34349846),
  review-and-series class only.
- chilblains: DEFERRED — the prospective cohort documents ulceration (54.5%) and pernio
  progression to lupus, but no catalog identity exists for skin ulceration or chilblain
  arthropathy; revisit on identity addition.
- chloracne: DEFERRED — zero target-specific records; 38 CFR 3.309 presumptive authority
  cannot substitute for clinical-evidence mapping.

Registry state after batch 10: 399 relationships (325 explicit guards / 74 legacy),
456 live reference uses (379 verified + 77 pending), 431 source entities (346 active / 76
pending / 9 lineage).
Next batch (screened undispositioned): chondromalacia-patellae, choroiditis,
chronic-intestinal-pseudo-obstruction, chronic-pelvic-pain-syndrome, churg-strauss-syndrome.

## D1 Batch 11 (2026-09-22): chondromalacia-patellae, choroiditis, chronic-intestinal-pseudo-obstruction, chronic-pelvic-pain-syndrome, churg-strauss-syndrome

Draft-authored under the D1 program. Four association-only edges (12 pending-verification
NCBI-verified clinical sources) and one documented deferral. All refs verified:false pending
qualified-human verification under docs/citation-verification-sop.md.

- choroiditis -> retinal-detachment (ASSOCIATION_ONLY, IMMUNE_MEDIATED, hypothesized):
  blood-retinal-barrier failure is the review-established mechanism of exudative detachment
  (Amer 2017, PMID 28506603), and serous detachments define VKH (Bonnet 2017 PMID 28579215;
  Baltmr 2016 PMID 27932857); VKH's detachments are part of the syndrome picture itself, so
  the edge records co-occurrence without directional claims.
- chronic-intestinal-pseudo-obstruction -> malnutrition-residuals (ASSOCIATION_ONLY,
  METABOLIC_OR_NUTRITIONAL, hypothesized): malnutrition is a management-defining complication
  of CIPO (Downes 2018 PMID 29877952; Billiauws 2014 PMID 25023191; ESPEN 2021 PMID
  34479179); review-and-guideline class without prevalence denominators.
- chronic-pelvic-pain-syndrome -> endometriosis (ASSOCIATION_ONLY, PSYCHOPHYSIOLOGICAL,
  hypothesized): comorbidity documented across sensitization reviews (Sieberg 2020 PMID
  31862211; Yong 2017 PMID 28778699; Yong 2022 PMID 35107234) with REVERSE CAUSALITY
  deliberately recorded — endometriosis is itself a leading cause of CPP (the BMS->depression
  precedent).
- churg-strauss-syndrome -> asthma (ASSOCIATION_ONLY, IMMUNE_MEDIATED, hypothesized):
  asthma is part of EGPA's defining prodrome (McBrien 2018 PMID 29637936; Gendelman 2013
  PMID 23637321; Fijolek 2023 PMID 36658715); a causal claim would restate the diagnostic
  criteria (ME-41 phenotype-identity barrier).
- chondromalacia-patellae: DEFERRED — the only viable target (patellofemoral-pain-syndrome)
  overlaps CMP's own defining presentation, and the progression literature is contradictory
  (Zheng 2021 asserts progression to PFOA; Bentley 1984 found none and called PFOA probably
  a different entity); a 37-year evidentiary contradiction requires qualified-human
  adjudication, and the catalog lacks a PFOA identity in any case.

Registry state after batch 11: 403 relationships (329 explicit guards / 74 legacy),
468 live reference uses (379 verified + 89 pending), 443 source entities (346 active / 88
pending / 9 lineage).
Next batch (screened undispositioned): cicatricial-pemphigoid,
circadian-rhythm-sleep-wake-phase-disorders, cleft-lip-palate-residuals, clinodactyly,
cluster-headache.

## D1 Batch 12 (2026-09-22): cicatricial-pemphigoid, circadian-rhythm-sleep-wake-phase-disorders, cleft-lip-palate-residuals, clinodactyly, cluster-headache

Draft-authored under the D1 program. Four association-only edges (12 pending-verification
NCBI-verified clinical sources) and one documented deferral. All refs verified:false pending
qualified-human verification under docs/citation-verification-sop.md.

- cicatricial-pemphigoid -> corneal-scarring (ASSOCIATION_ONLY, MECHANICAL_OR_COMPRESSIVE,
  hypothesized): the mechanical cascade (dry eye, entropion, trichiasis -> abrasion,
  ulceration, scarring) is consistently documented (Stan 2020 PMID 32685792; Holsclaw 1998
  PMID 10200078; Brydak-Godowska 2005 PMID 16619831); case-series class without denominators.
- circadian-rhythm-sleep-wake-phase-disorders -> depressive-disorder (ASSOCIATION_ONLY,
  NEUROENDOCRINE_CASCADE, hypothesized): chronotype and circadian-disruption associations
  with depression documented across reviews (Zou 2022 PMID 36033630; Bruni 2025 PMID
  39779841; Meyer 2022 Lancet Series PMID 36115370, which itself cautions against
  circadian-only attribution); cross-sectional, bidirectional-plausible.
- cleft-lip-palate-residuals -> otitis-media (ASSOCIATION_ONLY, MECHANICAL_OR_COMPRESSIVE,
  hypothesized): eustachian-tube-dysfunction pathway with GeneReviews surveillance mandate
  and cohort quantification (Schutte 2021 PMID 20301581; Godinho 2018 PMID 30368389; Lou
  2021 PMID 33705003); modern early repair changes the adult natural history.
- cluster-headache -> depressive-disorder (ASSOCIATION_ONLY, PSYCHOPHYSIOLOGICAL,
  hypothesized): the best-controlled psychiatric edge of the D1 program — LUCA cohort OR 2.77
  for lifetime depression (Louter 2016 PMID 27694264) — but the effect attenuated after
  sleep-disturbance correction, and parallel-hypothalamic biology is a live alternative
  (Robbins 2013 PMID 23296640; Karnieg 2026 PMID 41335330).
- clinodactyly: DEFERRED — a congenital anatomic variant (<10 degrees is a normal variant by
  definition) whose literature is syndrome-association class; no catalog identity exists for
  finger-deviation dysfunction, and drafting an edge would map an anomaly marker as if it
  were a disease pathway.

Registry state after batch 12: 407 relationships (333 explicit guards / 74 legacy),
480 live reference uses (379 verified + 101 pending), 455 source entities (346 active / 100
pending / 9 lineage).
Next batch (screened undispositioned): coccydynia, cognitive-disorder, color-blindness,
contact-dermatitis, conus-medullaris-syndrome.

## D1 Batch 13 (2026-09-22): coccydynia, cognitive-disorder, color-blindness, contact-dermatitis, conus-medullaris-syndrome

All five sources NCBI-verified on 2026-09-22. Four association-only edges authored; one documented deferral.

| Primary | Target | Tier & mechanism category | Evidence notes |
|---|---|---|---|
| coccydynia | depressive-disorder | ASSOCIATION_ONLY / PSYCHOPHYSIOLOGICAL (hypothesized) | Severe, persistent, sitting-exacerbated burden documented condition-specifically (NRS 8.4-8.5 refractory series; "substantially decreases quality of life"; diagnostic-dismissal burden), but the depression link is imported from the general chronic-pain literature with no coccydynia-specific controlled data; population skew (77-92% female cohorts vs male-skewed claimant population) recorded in the guard. |
| cognitive-disorder | depressive-disorder | ASSOCIATION_ONLY / PSYCHOPHYSIOLOGICAL (hypothesized) | Depression is part of the recorded MCI phenomenology (Anderson 2019) and dementia-comorbidity literature (Jones 2024 umbrella), with **reverse causality deliberately recorded**: depressive disorder is a reversible cognitive mimic (pseudodementia), and the OSA meta-evidence (Bucks 2013; Wang 2020 folded into note) anchors the sleep-confounder guard. |
| conus-medullaris-syndrome | urinary-incontinence | ASSOCIATION_ONLY / NEUROLOGICAL_DEGENERATION (hypothesized) | Bladder dysfunction is a presenting sign of the syndrome itself (8-patient urodynamic pure-conus cohort, 4 overactive/4 underactive; half regained normal voiding); S2-S4 micturition-center mechanism anatomically direct but case-series class without denominators; tiered with the ME-32 anterior-cord and batch-9 central-cord precedents. |
| conus-medullaris-syndrome | fecal-incontinence | ASSOCIATION_ONLY / NEUROLOGICAL_DEGENERATION (hypothesized) | Bowel dysfunction in the syndrome's defining picture (Storch case; DAVF case presenting frank fecal incontinence); no anorectal-manometry quantification exists; shares the conus etiologic-heterogeneity guard. |
| contact-dermatitis | cellulitis | ASSOCIATION_ONLY / INFECTIOUS_SPREAD (hypothesized) | Superinfected dermatitis is a treatment-recognized complication (topical-antibiotic indications) with a coherent barrier-failure-and-contiguous-spread pathway anchored in the eczema-superinfection literature (reduced antimicrobial peptides, Staph aureus dysbiosis); the deeper-invasion step to cellulitis is not quantified in contact-dermatitis cohorts. |
| color-blindness | — | **Deferral** | The acquired-dyschromatopsia literature positions color-vision deficiency as a diagnostic *marker* of underlying optic-nerve/retinal disease (Hart 1987; DON uses color vision as a diagnostic criterion), i.e., the causal arrow runs INTO the identity; congenital CVD is a static phenotype; no catalog identity exists for the underlying optic neuropathies an edge would run through. |

Governance notes for this batch:

- **Schema cap caught twice**: the strict loader's `sourceReferences` max-3 constraint rejected two authored files (coccydynia with 4 refs; cognitive-disorder with 4 refs). Rather than weakening the schema, the fourth references (Mulpuri 2022; Wang 2020) were folded into governance notes and the retained references' note text, with the schema-cap reason recorded in the data. The registry lockstep and packet were regenerated to match.
- **Reference-variant hash lesson**: the fecal-incontinence edge reuses the urinary edge's three PMIDs with suggestion-specific note text; the lockstep now appends per-suggestion `rawReferenceHashes` variants for reused sources, and the master-registry audit's drift detection validated the fix.
- Citation-debt ratchet advanced honestly: 495 live references (379 verified + 116 pending), 490 clinical with full URL coverage; 412 relationships (338 explicit guards / 74 legacy); 469 source entities (345 active clinical + 114 pending clinical + 1 active legal + lineage).
- Verification packet regenerated: 49 worksheets / 116 rows, matching the live debt exactly.
Mapping Expansion D1 batch 14 re-screened the five alphabetically-first zero-edge drafts that earlier batches had deliberately left untouched and confirmed every prior qualified-human disposition, authoring no new edges: `acquired-syndactyly` remains deferred (ME-30's no-defensible-target deferral stands, and the ME-41 phenotype-identity barrier independently blocks the only catalog-fit target — acquired syndactyly is itself cicatricial webbing, so a painful-or-unstable-scar edge would largely restate the diagnostic presentation; the postburn release-reconstruction literature is surgical-series class without denominators); `alopecia` remains deferred with a sharpened evidence-grounded basis (the 2026-09-22 NCBI re-screen found the entire psychiatric hair-loss comorbidity evidence base is alopecia-areata-scoped — Toussi 2021 systematic review PMID 32561373, Villasante Fricke 2015 burden review PMID 26244028, Drake 2023 PTSD survey PMID 37900780 — so any broad-identity edge would recycle the narrower areata identity's evidence contrary to expansion rule 11 and ME-29's scope decision); `acrocyanosis` (ME-30/ME-32), `adjustment-disorder` (ME-30 FINAL-CLOSE-DIRECTION, re-tested by ME-41), and the plural synonym `adjustment-disorders` (ME-30 duplicate-identity closure) were left untouched. Both re-screened identities carry deferral records in their knowledge-base governance notes so future batches inherit the closure automatically. No relationships, live references, or source entities changed; registry and verification-debt state are identical to the batch-13 close. Remaining backlog by the reproducible zero-edge/undispositioned filter: 377 drafts after applying all batch-1-14 deferral markers and the full disposition ledger, of which the next five are `aortic-aneurysm`, `balint-s-syndrome`, `boutonniere-deformity`, `bronchomalacia`, and `bullosis-diabeticorum` (each pre-screened clean against every ledger).
Mapping Expansion D1 batch 15 authored three association-only edges and recorded two new deferrals: `aortic-aneurysm -> valvular-heart-disease` (shared bicuspid-aortic-valve aortopathy literature documents media-disease co-expression, not a population causal arrow, with the reverse regurgitation-dilates-root arrow recorded; Siu 2010 PMID 20579534, Verma 2022 PMID 36718616), `aortic-aneurysm -> hydronephrosis` (inflammatory-AAA perianeurysmal-fibrosis encasement in case-series class with post-repair regression documented; Siebenmann 1988 PMID 3393898, Babic 2012 PMID 22462354, Hodgson 1986 PMID 3511305), and `bronchomalacia -> bronchiectasis` (the Thomas 2022 pediatric case-control's ORadj 13.2-24.4 with causality explicitly disclaimed, the Bascom 2021 Ehlers-Danlos parallel-manifestation guard, and the Boonjindasup 2022 case-finding context; PMIDs 34649867, 34811894, 36335911 — authored under an explicit supersession of the batch-6 automation deferral whose stated reopening condition, collapse-specific bronchoscopy-verified evidence, the Thomas study satisfies). `balint-s-syndrome` was deferred under the ME-41 phenotype-identity barrier (the syndrome is defined by the visuomotor triad a downstream edge would restate; Rizzo 1992 PMID 1529165 anchors the phenotype-not-cause reading), and `boutonniere-deformity` was deferred on zero PubMed records for boutonniere-to-swan-neck progression plus identity restatement against the contractures identity. Registry grew to 416 relationships (342 explicit guards / 74 legacy) and 480 source entities (346 active / 125 pending-verification); the citation-debt ratchet moved to 506 live references (379 verified + 127 pending) and the verification packet was regenerated to 53 worksheets / 127 rows, matching live debt exactly. Remaining backlog by the reproducible dual-marker zero-edge/undispositioned filter: 370 drafts, of which the next five are `corneal-scarring`, `cotard-s-syndrome`, `cracked-tooth-syndrome`, `cryptogenic-organizing-pneumonia`, and `cubital-tunnel-syndrome` (each pre-screened clean against every ledger). The uncommitted tree now holds fifteen batches of D1 work — landing the PR through the CI gate is the standing recommendation before continuing.

## D1 batch 16 (2026-09-22) — 5 edges across 4 identities + 1 identity deferral

- Authored: `corneal-scarring -> visual-impairment` (global-burden + myofibroblast-opacity pathway, visual-significance guard); `cracked-tooth-syndrome -> loss-of-teeth` (crack-propagation pathway anchored by Ferracane Registry natural history: 3% fracture / 12% progression in 3 years, >98% survival, treatment-stratified risk) and `-> abscesses` (pulpal-exposure infection pathway, no abscess-incidence denominator); `cryptogenic-organizing-pneumonia -> pulmonary-fibrosis` (repair-overshoot subset pathway with the Yousem 89%-vs-10% background-scarring predictor and the UIP-misclassification confound stated in the source); `cotard-s-syndrome -> depressive-disorder` (co-occurrence per Berrios 100-case series, psychotic-depression factor, capgras-precedent bidirectionality guard).
- Deferred: `cubital-tunnel-syndrome` — ME-41 phenotype-identity barrier (the identity IS ulnar compression neuropathy; no distinct catalog outcome identity exists for claw-hand/intrinsic atrophy; surgical-outcome literature is treatment class).
- All five edges ASSOCIATION_ONLY / NOT_ESTABLISHED / hypothesizedOnly with per-pair structured publication guards; 13 new NCBI-verified-shape pending-verification sources (verified:false, sourceCheckedOn 2026-09-22).
- Lockstep ground truth after batch: 421 relationships (347 explicit / 74 legacy), 493 source entities (346 active / 138 pending, 345 active clinical), 521 live uses (379 verified / 142 pending). Packet regenerated: 58 worksheets / 142 rows. Ratchet baselines and test pins updated in-script and in-suite (166->169 single-suggestion-draft pin; 254 files / 1,728 tests green).
- Process notes: evidenceGaps dual-shape rule re-confirmed (top-level array, evidentiaryProfile string) — a mid-batch normalization drifted the five lockstep suggestionObjectHashes and was corrected by re-hashing the final schema-valid files, the system of record.

## D1 batch 17 (2026-09-22) — 6 edges across 4 identities + 1 identity deferral

- Authored: `aphonia -> depressive-disorder` and `-> anxiety-disorder` (All of Us dysphonia cross-sectional co-occurrence, exposure ICD-10 R49.0 with the severity-span and reverse-causation guards recorded); `bacterial-rhinitis -> sinusitis` (rhinosinusitis continuum with the viral-majority guard: few ARS episodes become bacterial); `chronic-laryngitis -> vocal-cord-nodules-polyps-cysts-paralysis` (edematous-polypoid spectrum only, 8.5% form share, Reinke's-edema taxonomy overlap, paralysis explicitly excluded); `complex-regional-pain-syndrome -> osteoporosis` (DXA-quantified regional deficit -8.4%/-8.9% with the disuse, systemic-bilateral, and reverse-direction guards) and `-> contractures` (review-class chronic sequelae, PT prevention standard-of-care, no incidence denominators).
- Deferred: `common-peroneal-neuropathy` — ME-41 phenotype-identity barrier (foot drop IS the identity; no distinct catalog outcome identity for gait deviation, falls, or AFO dependence).
- All six edges ASSOCIATION_ONLY / NOT_ESTABLISHED / hypothesizedOnly with per-pair structured publication guards; 15 new pending-verification clinical sources (verified:false, sourceCheckedOn 2026-09-22).
- Lockstep ground truth after batch: 427 relationships (353 explicit / 74 legacy), 508 source entities (346 active / 153 pending, 345 active clinical), 539 live uses (379 verified / 160 pending). Packet regenerated: 64 worksheets / 160 rows. Registry-audit message strings synced with conditions (a stale batch-15 message token surfaced). Ratchet baselines and test pins updated in-script and in-suite (single-suggestion-draft pin 169->171; 254 files / 1,728 tests green).
- Process notes: the helper's `verifiedBaseline` static array pins VERIFIED baseline rows at 142 and coincidentally collided with the pending-refs token during the sweep; the mis-bumped pin plus a mistaken 18-row append were reverted after the verified:true loop assertion exposed them. Token sweeps must continue to be checked against per-pin semantics, not magnitudes alone.

### D1 draft-authoring batch 18 (2026-09-23)

- Zero-edge drafts dispositioned (5): conductive-hearing-loss, conjunctivitis, coronary-bypass-residuals, contralateral-knee-condition, cranial-nerve-palsy.
- Edges authored (4; ASSOCIATION_ONLY, NOT_ESTABLISHED, hypothesizedOnly mechanisms, verified:false pending qualified-human citation verification):
  - conductive-hearing-loss → tinnitus (otosclerosis-anchored 68-73% co-occurrence; severity-decoupling guard; shared-outer-hair-cell alternative etiology).
  - conjunctivitis → corneal-scarring (adenoviral SEI → subepithelial fibrosis pathway; majority-subclinical guard; other-keratitis alternative; trimmed to the schema's 3-reference cap).
  - coronary-bypass-residuals → cardiac-arrhythmia (IATROGENIC_TREATMENT_EFFECT, DIRECT_CAUSATION, hypothesizedOnly:false; POAF 23% isolated-CABG cohorts with 5-year excess stroke/HF; treatment-mediation scoping per repo iatrogenic convention).
  - coronary-bypass-residuals → cognitive-disorder (IATROGENIC_TREATMENT_EFFECT, DIRECT_CAUSATION, hypothesizedOnly:false; POCD 80-90% at discharge / ~42% at 5 years; alternative-etiology and normal-recovery guards).
- Deferrals (2): contralateral-knee-condition (identity barrier: the cohort literature's contralateral outcome is the ACL injury itself); cranial-nerve-palsy (manifestation barrier, Balint's precedent: diplopia/pd-tropia define the palsy presentation; downstream candidates lack catalog identities).
- Registries: master-relationships +4 rel (431 total, 357 explicit guards); master-sources +13 entities (520 total, 346 active, 165 pending); citations baseline 551 refs / 172 pending / 546 clinical-with-URLs / 550 provenance-with-URLs.
- Packet regenerated: 68 worksheets / 172 rows, matching live debt exactly.
- Standing sweep rule reaffirmed: token ratchets must be checked against per-pin semantics (the verifiedBaseline array in the master-resolution helper is a verified-source list and must not follow pending-count tokens), and every sweep rule is validated against its failing context before replacement (double-comma and extra-paren corruption classes were introduced and repaired this batch; typecheck + full battery confirm final integrity).
- Progress: 63 edges mapped across 56 identities + 18 documented deferrals + 1 withdrawn edge through 18 batches.

### D1 draft-authoring batch 19 (2026-09-23)

- Zero-edge drafts dispositioned (5): cyclic-vomiting-syndrome, cystitis-or-neurogenic-bladder, dandy-walker-syndrome, de-quervain-s-tenosynovitis, decubitus-ulcers.
- Edges authored (8 across 5 identities; zero deferrals this batch):
  - cyclic-vomiting-syndrome → migraine-headaches / depressive-disorder / esophagitis (all ASSOCIATION_ONLY, NOT_ESTABLISHED, hypothesizedOnly; guards: shared-trigeminal-autonomic substrate vs directional causation, reverse-direction stress-trigger, Mallory-Weiss acute-tear vs chronic-esophagitis distinction, cannabinoid-hyperemesis exclusion).
  - cystitis-or-neurogenic-bladder → hydronephrosis (DIRECT_CAUSATION, PROBABLE, hypothesizedOnly:false — the repo's second obstruction-mechanical edge after urethral stricture; UVJ overwhelm/VUR pathway; independent obstruction excluded) and → kidney-stones (ASSOCIATION_ONLY; SCI-cohort-specific quantified risk, catheter-encrustation and metabolic confounds).
  - dandy-walker-syndrome → hydrocephalus (DIRECT_CAUSATION, PROBABLE, hypothesizedOnly:false; CSF-flow obstruction; penetrance guard — not every phenotype progresses; imaging chronology required).
  - de-quervain-s-tenosynovitis → carpal-tunnel-syndrome (ASSOCIATION_ONLY; single cross-sectional co-occurrence cohort 9.9% of CTS hands, referred-population ascertainment guard, shared-substrate guard).
  - decubitus-ulcers → osteomyelitis (ASSOCIATION_ONLY despite standard contiguous-spread biology; controlling guard is the Wong 2019 biopsy denominator — many exposed-bone stage IV patients lack biopsy-confirmed osteomyelitis and MRI cannot distinguish infection from remodeling; biopsy/culture confirmation required).
- Registries: master-relationships +8 rel (439 total, 365 explicit guards); master-sources +19 entities (539 total, 346 active, 184 pending); citations baseline 575 refs / 196 pending / 570 clinical-with-URLs / 574 provenance-with-URLs.
- Authoring-schema lesson recorded: evidentiaryProfile.requiresSpecificDbqEvidence is a boolean flag; itemized DBQ evidence belongs in the top-level suggestion evidenceGaps array (26 items merged and corrected in-place before the registry hash correction, which was recomputed against the final authored state per the batch-16 procedure).
- Packet regenerated: 76 worksheets / 196 rows, matching live debt exactly.
- Progress: 71 edges mapped across 61 identities + 18 documented deferrals + 1 withdrawn edge through 19 batches.
- D1 batch 20 (2026-09-23): 7 edges across 3 identities + 2 identity deferrals. dermatitis -> insomnia (itch-arousal sleep fragmentation, 33-90% adult-AD band, ISI flare-delta 8.7->16), -> cellulitis (barrier-failure entry with the eczema-mimics misdiagnosis guard), -> impetigo (scratch autoinoculation with carrier-state/exposure confounds), -> depressive-disorder and -> anxiety-disorder (HADS sleep-mediated burden, cross-sectional with documented reverse direction) over 7 sources; delayed-ejaculation -> depressive-disorder (claims n=11,602 + nationwide n=5,331 associations with the dominant psychotropic reverse-direction guard) over 3 sources; dental-abrasion-erosion-abfraction -> dentin-hypersensitivity (hydrodynamic substrate, NCCL-DH co-occurrence n=157, independent habit drivers) over 3 sources; dermatitis-herpetiformis deferred (cutaneous manifestation of celiac disease - outgoing edge would restate the identity; celiac->DH belongs to the celiac-disease mapping); dentin-hypersensitivity deferred (no downstream catalog identity; the anxiety association is a shared-upstream-driver confound already recorded on the dental-abrasion file). All ASSOCIATION_ONLY / NOT_ESTABLISHED / hypothesizedOnly:true / vaNexusProbabilityAlignment NOT_ASSERTED; 13 new sources pending-verification (verified:false, checked 2026-09-23). Registry 446 relationships / 552 sources; refs 594 / 215 unverified; packet 83 worksheets / 215 rows.
- D1 batch 21 (2026-09-23): 5 edges across 3 identities + 2 identity deferrals. dermatomyositis -> interstitial-lung-disease (scleroderma->ILD precedent; ILD in 43.8% of amyopathic DM vs 15.9% classic, HR 3.57 mortality predictor; subtype-stratified with paraneoplastic and drug-pneumonitis guards) and -> dysphagia (inflammatory striated-muscle pathway; dysphagia flags malignancy-associated myositis at RR 2.09 so paraneoplastic exclusion required; steroid-myopathy and cricopharyngeal competing mechanisms) over 5 sources; deviated-nasal-septum -> sinusitis (ostiomeatal drainage obstruction; CT-referral OR 2.74 with ascertainment guard; normal-variant spectrum excluded) and -> sleep-apnea (PSG-confirmed occurrence/severity association; craniofacial shared-driver confound; nasal obstruction a minor contributor; obesity phenotype excluded) over 6 sources; diabetes-insipidus -> hydronephrosis (DIRECT_CAUSATION, PROBABLE, hypothesizedOnly:false - the third obstruction/dilatation-family edge after urethral stricture and neurogenic bladder, here volume-overload rather than outflow obstruction; GeneReviews surveillance guidance plus a 26-patient urodynamics cohort; adherence guard: pathway documented for untreated/undertreated polyuria, management chronology mandatory) over 3 sources; dermatofibroma deferred (benign lesion; DF-DFSP relationship is diagnostic-mimic confusion, no catalog target; malignant transformation is debated case-report territory only) and dermatofibrosarcoma-protuberans deferred (cutaneous sarcoma outside the catalog skin-cancer identity's melanoma/NMSC scope; recurrence and fibrosarcomatous transformation lack catalog identities). Registry 451 relationships / 566 sources; refs 609 / 230 unverified; packet 88 worksheets / 230 rows.
- D1 batch 22 (2026-09-23): 2 edges across 2 identities + 3 identity deferrals. diaphragm-paralysis -> sleep-apnea (ASSOCIATION_ONLY; REM-hypoventilation ventilatory-pump pathway quantified in PSG cohorts - RDI 26.0 events/h in REM vs 0.7 controls in hemidiaphragm paralysis, mean AHI 26.6 across 66 referred dysfunction patients with CPAP control in only 37.9%; guards: referred-population ascertainment, REM-hypoventilation vs obstructive phenotype mismatch with the target identity, bilateral 6.8-fold CPAP-failure gradient, obesity-phenotype exclusion) over 3 sources; diffuse-axonal-injury -> cognitive-disorder (DIRECT_CAUSATION, PROBABLE, hypothesizedOnly:false following the cerebral-contusion structural-lesion precedent; connectivity-disruption pathway - axonal shearing at corpus callosum/parasagittal white matter/brainstem with Wallerian degeneration producing the processing-speed, memory, attention, and executive deficit syndrome; scoped to documented DAI with neuropsychological confirmation 6-12 months post-injury; hypoxic-ischemic injury, hydrocephalus, medication, and hypopituitarism competing causes excluded; hypopituitarism mimic recorded from the Pituitary sequelae review) over 3 sources; diabetes-mellitus deferred on duplicate-scope - the published typed identities diabetes-mellitus-type-1/2 already carry the complication edges (CKD, retinopathy, gerd), so generic-DM authoring would create parallel pathways (consolidation or inheritance is a governance decision); diabetic-amyotrophy deferred on the ME-41 manifestation barrier (LSRPN atrophy/weakness/pain define the syndrome); diabetic-dermopathy deferred (benign co-marker of microvascular disease; any complication edge would be confounded by the shared diabetic driver). Registry 453 relationships / 572 sources; refs 615 / 236 unverified; packet 90 worksheets / 236 rows.

### D1 batch 23 (2026-09-23) — diffuse-esophageal-spasm, diplopia, diverticulitis, diverticulosis, dizziness

Authored 4 edges across 4 identities; 1 deferral (diplopia: symptom-identity — the outgoing
literature is unquantified ("debilitating for most patients", Glisson 2019, no outcome cohort)
and manifestation coverage belongs to the causative source conditions; recorded for the human
verifier with the three screened-but-uncited sources). All edges ASSOCIATION_ONLY pending
qualified-human verification:
- diffuse-esophageal-spasm -> gerd (co-occurrence 46.3% but the source cohort found no
  GERD-related DES phenotype and challenges the historical GERD-causation emphasis; bidirectional;
  Seltzer 2024 PMID 39341683, Roman & Kahrilas 2012 PMID 22215281, Frieling 2018 PMID 29888236)
- diverticulosis -> diverticulitis (identity-progression guard per the Barrett's-to-cancer
  precedent; 1-4% lifetime (JAMA 2025 PMID 40705318); Hawkins 2020 PMID 33077029, Piscopo 2020
  PMID 33093692)
- diverticulitis -> irritable-bowel-syndrome (de novo post-infectious-type pathway has
  epidemiological support but the SUDD/IBS diagnostic-overlap confound controls; Alamo & Quigley
  2019 PMID 30407258, Calini 2023 PMID 37013200, Hanna & Kaiser 2021 PMID 33727769). Colorectal
  cancer screened and rejected: Mortensen 2022 meta-analysis (38,621 patients, PMID 36042030)
  found long-term colon-cancer risk NOT increased.
- dizziness -> anxiety-disorder (79.3% of chronic subjective dizziness / 88% of PPPD psychiatric
  comorbidity, but anxiety is a documented predisposing factor — bidirectionality controls;
  Odman & Maire 2008 PMID 18607990, Dieterich & Staab 2017 PMID 28002123, Kothari 2026 PMID 42268441)

Registry lockstep: 457 relationships (383 explicit); 584 sources (229 pending-verification).
Citations ground truth: 627 refs / 248 unverified / 622 clinical-with-URLs / 626
provenance-with-URLs. Packet regenerated: 94 worksheets / 248 rows, matching live debt exactly.

Per-line ledger filter (standing screen): drafts with >=1 authored suggestion or an in-file
deferral note are dispositioned; remaining candidates are screened against every prior batch.
Mapping Expansion D1 batch 24 re-screened five previously-dispositioned identities and reaffirmed every prior qualified-human disposition, authoring no new edges: `acrocyanosis` (ME-30/ME-32 — no Raynaud's identity exists, erythromelalgia/pernio are distinct entities under the ME-41 barrier, and the benign/secondary split defeats generic vascular edges), `alopecia` (ME-29/batch-14 — the psychiatric hair-loss evidence remains alopecia-areata-scoped, verified live on the areata file), `anhedonia` (ME-31 — transdiagnostic symptom, Rizvi 2016/Husain & Roiser 2018 confirm cross-disorder reward-circuit involvement, so `-> depressive-disorder` asserts the wrong direction), `anosmia` (ME-32 FINAL-CLOSE-PROPOSITION-MISMATCH — the withdrawn depression meta-analysis stands, no hyposmia/parosmia identity, and manifestation coverage already lives on covid-19-residuals and head-injury), and `bursitis` (batch-7/promotion-batch-24 — phenotype heterogeneity, no tendinitis or septic-arthritis identity, and the RA/gout relationships are upstream causes). Each file now carries a batch-24 governance record so future batches inherit the closure automatically. No relationships, live references, or source entities changed; registry and verification-debt state are identical to the batch-23 close. The batch-23 closing screen had wrongly listed all five as undispositioned — the disposition filter now also checks per-file governanceNotes, not only ledger lines. Registry state after batch 24: 457 relationships (383 explicit guards / 74 legacy boundaries); 627 live references with 379 verified and 248 pending qualified-human verification; 584 source entities (365 active / 219 pending).
Mapping Expansion D1 batch 25 authored five draft-quarantined relationships across four identities: `cystitis -> overactive-bladder` (UTI-inflammation sensory-sensitization pathway, ASSOCIATION_ONLY — the OAB definition itself excludes active infection and the reverse direction is documented in the same literature, with the Liao NHIRD cohort cited as the treatment-direction null guard); `dementia -> anxiety-disorder` (neurodegenerative network-disintegration pathway, ASSOCIATION_ONLY — anxiety is measured as an NPI symptom at 39% pooled AD prevalence per Zhao 2016 and 65% in mild AD per Spalletta 2010, so independent-disorder attribution stays a clinician determination; the batch-14 duplicate-scope pattern was avoided by authoring no dementia-insomnia edge while alzheimer-s-disease already carries one); `dementia -> urinary-incontinence` (frontal-micturition-disinhibition pathway, ASSOCIATION_ONLY — 50.1% prevalence and adjusted HR 1.4 in the interRAI cohort per Burholt 2024 and 39.7% pooled per the 2026 meta-analysis, with the Cannistraro CNS-small-vessel-disease review cited as the documented shared-cause confound); `dry-eye-syndrome -> insomnia` (ocular-pain-arousal pathway, ASSOCIATION_ONLY — the fully adjusted Lifelines OR 1.20 across n=71,761 per Magno 2021 and the Miami-VA-clinic OSDI-PSQI r=0.49 per Ayoubi 2024, with the Yu 2019 Hangzhou dose-response cited as the reverse-direction guard); and `dry-eye-syndrome -> depressive-disorder` (chronic-symptom-burden pathway, ASSOCIATION_ONLY — the Chang 2025 multimodal meta-analysis OR 1.83 and Wan 2016 OR 2.92, with Chang's own Mendelian-randomization bidirectionality recorded as the one-direction preclusion). `contractures` was deferred on identity screening: the only quantified contracture-incontinence literature is bladder-neck contracture after prostatectomy (Besarani 2004, Cormio 2014, Brede 2014) — a distinct urologic surgical identity under the ME-41 barrier — and musculoskeletal contracture outcomes lack catalog identities. Registry state after batch 25: 462 relationships (388 explicit guards / 74 legacy boundaries); 640 live references with 379 verified and 261 pending qualified-human verification; 597 source entities (346 active / 242 pending). Remaining backlog by the corrected zero-edge/undispositioned filter: 429 drafts.
Mapping Expansion D1 batch 26 authored four draft-quarantined relationships across four identities: `dumping-syndrome -> malnutrition-residuals` (avoidance-malnutrition pathway, ASSOCIATION_ONLY — dietary adjustment is the consensus first-line step per the Scarpellini Delphi consensus and refractory cases require enteral support per van Beek, but the D'hoedt systematic review documents subtype-heterogeneous direction (early-dumping food avoidance versus late-dumping higher caloric intake) and no significant dumping-to-weight-loss relationship, and the intended bariatric effect confounds attribution); `dupuytren-s-contracture -> trigger-finger` (shared myofibroblast-proliferation pathway, ASSOCIATION_ONLY — 43/238 same-hand co-occurrence with trigger finger significant in the Yang multivariate model, but the source itself concludes bidirectionality and the Chammas diabetic cluster is the shared-substrate confound; the Van Nuffel frozen-shoulder association was screened and rejected as not statistically significant); `dwarfism -> sleep-apnea` (craniofacial-narrowing pathway, ASSOCIATION_ONLY — 59% PSG-confirmed OSA in the Tenconi reference-center cohort with CLARITY infant-database surgical-response evidence and GeneReviews surveillance guidance, with pediatric-achondroplasia-to-generic-adult transfer and mixed obstructive-central physiology as the guards); and `dwarfism -> spinal-stenosis` (congenital canal-diameter pathway, ASSOCIATION_ONLY — GeneReviews lists foramen-magnum and spinal stenosis among complications common to achondroplasia, but the identity-overlap guard applies because canal narrowing partly defines the dysplasia and hypochondroplasia is less frequently affected). `carpal-tunnel-syndrome` reaffirmed its promotion-batch-31 safe-draft disposition with a file-level record (the Hidaka matched-cohort remains association-only with unresolved mediation), and `dyspareunia` was deferred: the DSM-5 merger into genito-pelvic pain/penetration disorder followed the Lahaie experimental finding of large dyspareunia-vaginismus overlap (genital pain did not differ between groups), so a directional edge would assert what DSM-5 declined to draw, and the outgoing depression evidence is descriptive-only below the repo's authoring bar. Registry state after batch 26: 466 relationships (392 explicit guards / 74 legacy boundaries); 650 live references with 379 verified and 271 pending qualified-human verification; 605 source entities (346 active / 250 pending). Remaining backlog by the corrected zero-edge/undispositioned filter: 424 drafts.
Mapping Expansion D1 batch 27 authored four draft-quarantined relationships across four identities: `dysplastic-nevus-syndrome -> skin-cancer` (nevus-burden melanoma-risk-marker pathway, ASSOCIATION_ONLY — Gandini 2005 pooled 46-study meta-analysis atypical-nevi RR 6.36 and common-naevi dose-response RR 6.89, Duffy 2019 Brisbane cohort MC1R R/R with >=20 naevi OR 25.1 and 23.3% absolute risk to age 75; guards: risk-marker-not-progression, umbrella-target non-melanoma share outside the melanoma-specific evidence, de novo melanoma alternative), `early-onset-peripheral-neuropathy -> pes-cavus` (denervation-imbalance foot-deformity pathway, ASSOCIATION_ONLY — Laura 2018 Inherited Neuropathies Consortium 71% CMT foot-deformity prevalence with 30% surgery, Okhovat 2026 genetically confirmed CMT4C early-onset pes-cavus series; guards: CMT-population anchor on a broader identity, congenital/traumatic/spastic alternatives, hypothesis-class mechanism), `elbow-disarticulation -> phantom-limb-pain` (transection-reorganization pathway, ASSOCIATION_ONLY — Balakhanlou 2021 national survey of 776 upper-limb-amputee veterans with 73% PLP prevalence, mean intensity 4.2/10, and the proximal-level odds gradient transhumeral OR 1.76 / shoulder OR 3.78, plus the reused human-verified Diers 2022 nationwide 3,374-amputee survey now carrying five live uses; guards: elbow disarticulation not separately stratified in the survey, residual-limb and neuroma pain mimics), and `empty-nose-syndrome -> depressive-disorder` (chronic-airflow-symptom-burden pathway, ASSOCIATION_ONLY — Huang 2023 prospective 40-vs-40 matched case-control with BDI-II/BAI elevation persisting after reconstruction in 22.5%, Huang 2022 suicidal-thoughts 23/62 case series, Hussain 2025 systematic review of 957 patients recording evidence paucity; guards: reverse direction, single-center referral selection, scale elevation versus structured diagnosis). The direct ENS-to-insomnia search returned zero PubMed records and the only sleep-related hit is an abstract-less brief, so the sleep pathway is recorded as an in-file negative screen rather than an edge. `eczema` was deferred on duplicate-scope under the diabetes-mellitus-typed-identities and atopic-march precedents: the published atopic-dermatitis evidence base is already carried by the batch-20 dermatitis -> insomnia/cellulitis/impetigo/depressive-disorder/anxiety-disorder edges and the atopic-dermatitis-eczema -> asthma edge, so any eczema edge would create parallel pathways restating the same disease process under a synonym identity; the in-file negative screen records the Ni 2025 insomnia-to-AD Mendelian-randomization direction as incompatible with an outgoing edge. Each new edge remains ASSOCIATION_ONLY, NOT_ESTABLISHED, hypothesizedOnly:true, and pending qualified-human citation verification; no primary publication state changed. Registry state after batch 27: 470 relationships (396 explicit guards / 74 legacy boundaries); 659 live references with 380 verified and 279 pending qualified-human verification; 613 source entities (346 active / 258 pending). Packet regenerated to 107 worksheets / 279 rows, matching live debt exactly. Remaining backlog by the reproducible dual-marker zero-edge/undispositioned filter: 419 drafts, of which the next five are `encephalitis`, `encopresis`, `enophthalmos`, `eosinophilic-bronchitis`, and `eosinophilic-gastroenteritis` (each pre-screened clean against every ledger). The uncommitted tree now holds twenty-seven batches of D1 work — landing the PR through the CI gate remains the standing recommendation before continuing.
Mapping Expansion D1 batch 28 authored six draft-quarantined relationships across four identities, including the batch program's first seizure-disorder target: `encephalitis -> seizure-disorder` (DIRECT_CAUSATION, PROBABLE, hypothesizedOnly:false under the cerebral-contusion and diffuse-axonal-injury structural-lesion precedents; cortical-scar epileptogenesis pathway — Wang 2026 longitudinal cohort of 56 confirmed pediatric HSE patients documents post-encephalitic epilepsy in 53.6% with 63.3% drug-refractory, with cortical/limbic destruction as the accepted epileptogenic substrate; ENCEIF 322-survivor multicenter cohort and the severe West Nile neuroinvasive-disease follow-up anchor the injury burden; guards: etiologic heterogeneity — autoimmune and mild systemic presentations lack the necrotizing lesion mechanism — chronic epilepsy distinguished from acute symptomatic seizures, and the generic seizure-disorder identity used rather than epilepsy under the target-independence rule), `encephalitis -> cognitive-disorder` (ASSOCIATION_ONLY; parenchymal-injury pathway held at association because the ENCEIF and anti-LGI1 cohort designs document outcome association without individual lesion-to-deficit linkage; a future promotion would require documented parenchymal injury with neuropsychological confirmation), `enophthalmos -> diplopia` (ASSOCIATION_ONLY; Yasar 2026 109-patient orbital-floor-fracture series quantifies diplopia in 56.3% of patients with enophthalmos versus 8.6% without, Hassan 2024 254-patient repair cohort reports postoperative diplopia up to 52%; central guard: both findings are consequences of the same orbital injury — a shared-trauma-driver confound that defeats directionality; the target is the batch-23-closed diplopia symptom-identity, authored as a different-nexus edge by a condition identity, and the enophthalmos-to-dry-eye search returned zero PubMed records, recorded as an in-file negative screen), `eosinophilic-bronchitis -> asthma` (ASSOCIATION_ONLY; shared eosinophilic-airway-inflammation pathway with the distinct-entity literature recorded as a live counter-evidence guard — Lai 2017/2018 long-term follow-up treats NAEB as distinct rather than an early stage of asthma, and Siddiqui 2009 CT geometry shows no wall thickening in NAEB; Zhan 2022 eosinophil-progenitor case-control anchors the shared biology; the asthma target carries six prior incoming edges from distinct mechanisms and this adds a separate pathway), `eosinophilic-gastroenteritis -> malnutrition-residuals` and `-> anemia` (both ASSOCIATION_ONLY; mucosal-malabsorption and mucosal-occult-blood-loss pathways limited to the mucosal-dominant Klein phenotype — Goel 2026 review, Chehade 2006 EGE-PLE pediatric series, and the Hui 2018 prospective 2,469-patient cohort with 64 EGE cases; guards: case-series-class evidence without denominators in a rare disease, elimination-diet and corticosteroid treatment effects as competing nutritional drivers). `encopresis` was deferred on duplicate-scope and manifestation-identity grounds: fecal soiling with retention overflow is defined by fecal incontinence against a constipation background, so an encopresis -> fecal-incontinence edge would restate the identity (ME-41 barrier), the straining-outcome targets already carry edges from the underlying constipation driver, the literature arrow is inverted (constipation causes the soiling), and the targeted encopresis complication search returned zero records — recorded in-file. All six new edges carry the full CRG trio; the five association edges remain NOT_ESTABLISHED with hypothesizedOnly:true, and no primary publication state changed. Registry state after batch 28: 476 relationships (402 explicit guards / 74 legacy boundaries); 676 live references with 380 verified and 296 pending qualified-human verification; 625 source entities (346 active / 270 pending). Packet regenerated to 113 worksheets / 296 rows, matching live debt exactly. Remaining backlog by the reproducible dual-marker zero-edge/undispositioned filter (windowed-verb ledger reading): 414 drafts, of which the next five are `eosinophilic-myocarditis`, `epicondylitis`, `epidermolysis-bullosa-acquired`, `epididymal-cyst`, and `epididymitis-orchitis` (each pre-screened clean against every ledger). The uncommitted tree now holds twenty-eight batches of D1 work — landing the PR through the CI gate remains the standing recommendation before continuing.
Mapping Expansion D1 batch 29 authored four draft-quarantined relationships across four identities, including the batch program's second heart-failure DIRECT_CAUSATION edge: `eosinophilic-myocarditis -> congestive-heart-failure` (DIRECT_CAUSATION, PROBABLE, hypothesizedOnly:false under the acute-myocarditis structural-injury convention; eosinophil-mediated myocardial-destruction pathway — Ammirati 2026 international 53-center natural-history cohort of 156 biopsy-proven patients documents median LVEF 32% at presentation with high in-hospital and midterm mortality or transplantation and peripheral eosinophilia absent in 42.6%, the Ammirati 2026 myocarditis sex-and-etiology review and the Aljudaibi 2026 dobutamine-hypersensitivity case anchor the mechanism and the reversibility guard; scope: biopsy-proven disease with documented dysfunction, etiologic heterogeneity preserved), `epicondylitis -> ulnar-neuropathy` (ASSOCIATION_ONLY; adjacent-structure cubital-tunnel compression pathway with the shared-mechanical-environment confound — Kim 2021 shear-wave elastography documents nerve mechanical abnormality at the tunnel, Zanesco 2025 847-patient elbow epidemiology and Khouja 2024 431-case occupational-disease series document both conditions among the dominant elbow diagnoses with 92.8% shared repetitive exposure; anatomic concordance limited to the medial side and electrodiagnostic localization required), `epidermolysis-bullosa-acquired -> esophageal-stricture` (ASSOCIATION_ONLY; blister-scar stenosis pathway — Figueredo 2021 and Moura 2011 case reports document EBA esophageal stricture requiring endoscopic management, Lambert 2026 subepidermal-blistering review anchors the antibody-class mucosal-scarring mechanism; case-class guard plus competing-etiologies guard; the SCC-risk literature is recessive-dystrophic-EB scoped and is recorded as an out-of-scope negative screen), and `epididymitis-orchitis -> testicular-atrophy` (ASSOCIATION_ONLY; pressure-and-autoimmune tissue-loss pathway — Choi 2020 ultrasonographic series documents 23-55% volume loss 25-230 days post-orchitis, Yapanoglu 2010 follow-up documents impaired sperm parameters with elevated gonadotropins in atrophy groups, Ramachandran 2021 imaging review documents post-infectious atrophy and fibrosis; guards: quantified evidence is mumps-scoped, sonographic atrophy does not establish endocrine failure, no male-infertility catalog identity exists so the fertility pathway is an evidence gap). `epididymal-cyst` was deferred: the management literature characterizes epididymal cysts and spermatoceles as benign incidental findings with no documented downstream morbidity (aspiration-sclerotherapy series treat incidentally detected lesions), so no catalog target has association evidence, a post-surgical pain edge would attribute to the cyst identity what the literature attributes to the procedure (wrong-identity guard), and the targeted outcome search returned no association data — recorded in-file. All four new edges carry the full CRG trio; the three association edges remain NOT_ESTABLISHED with hypothesizedOnly:true, and no primary publication state changed. The lockstep tooling correctly rejected a fifth spec pair whose KB edge had not been authored, catching a composition mismatch before any registry write (assertion failure, zero registry mutation; the spec was corrected to the four authored pairs). Registry state after batch 29: 480 relationships (406 explicit guards / 74 legacy boundaries); 688 live references with 380 verified and 308 pending qualified-human verification; 637 source entities (346 active / 282 pending). Packet regenerated to 117 worksheets / 308 rows, matching live debt exactly. Remaining backlog by the reproducible dual-marker zero-edge/undispositioned filter (windowed-verb ledger reading): 409 drafts, of which the next five are `episcleritis`, `erythema-induratum`, `erythema-multiforme`, `erythema-nodosum`, and `erythromelalgia` (each pre-screened clean against every ledger). The uncommitted tree now holds twenty-nine batches of D1 work — landing the PR through the CI gate remains the standing recommendation before continuing.
Mapping Expansion D1 batch 30 authored four draft-quarantined relationships across two identities: `episcleritis -> insomnia` and `erythromelalgia -> insomnia` (nocturnal-pain sleep-fragmentation pathway, ASSOCIATION_ONLY — Schaefer 2014 burden survey of 100 painful idiopathic small-fiber-neuropathy patients documents sleep disturbance/insomnia as the most common comorbidity at 37.0% with the sleep index and pain interference worsening with pain severity, Mantyh 2017 Mayo Clinic 52-patient cohort documents small-fiber structural pathology in erythromelalgia, and the Caldito 2024 JAAD reviews document burning episodes with sleep disruption and treatment-refractory course; guards: comorbidity quantification is SFN-population scoped rather than condition-specific, reverse direction is live, and erythromelalgia-specific sleep data remain narrative), and `episcleritis -> unexplained-chronic-pain` and `erythromelalgia -> unexplained-chronic-pain` (small-fiber central-sensitization pathway, ASSOCIATION_ONLY — the pain is constitutive of the identities rather than a downstream outcome, so the edges serve case-matching only, with competing pain generators excluded per the target's own criteria). `erythema-nodosum` and `erythema-induratum` were deferred on manifestation-identity grounds: EN is a reactive panniculitis whose arthritis co-occurrence is Löfgren-syndrome scoped and shared-driver confounded with the sarcoidosis and inflammatory-bowel-disease identities already carrying edges, and EI's ulceration and scarring are part of the lesion's own natural course with the tuberculosis association running tuberculosis -> EI (both recorded in-file with negative screens). `erythema-multiforme` was deferred after its candidate hyperpigmentation edge was WITHDRAWN in self-audit: the three drafted citations failed NCBI verification (the PMIDs first written resolved to unrelated papers) and the manifestation-identity barrier independently blocks the edge; the incident is recorded in-file, and no registry record, packet row, or ledger count ever carried the unverifiable citations. The SJS/TEN distinction is recorded as a nosology negative screen (modern classification separates rather than progresses these identities). All four new edges remain ASSOCIATION_ONLY, NOT_ESTABLISHED, hypothesizedOnly:true, and pending qualified-human citation verification; no primary publication state changed. Registry state after batch 30: 484 relationships (410 explicit guards / 74 legacy boundaries); 700 live references with 380 verified and 320 pending qualified-human verification; 641 source entities (346 active / 286 pending). Packet regenerated to 121 worksheets / 320 rows, matching live debt exactly. Remaining backlog by the reproducible dual-marker zero-edge/undispositioned filter (windowed-verb ledger reading): 404 drafts, of which the next five are `erythroplasia-of-queyrat`, `erythropoietic-protoporphyria`, `esophageal-stricture`, `esophagitis`, and `euthyroid-sick-syndrome` (each pre-screened clean against every ledger; note `esophageal-stricture` now carries an incoming edge from epidermolysis-bullosa-acquired but its own outgoing file remains zero-edge). The uncommitted tree now holds thirty batches of D1 work — landing the PR through the CI gate remains the standing recommendation before continuing.
Mapping Expansion D1 batch 31 authored five draft-quarantined relationships across four identities, including two DIRECT_CAUSATION edges: `erythroplasia-of-queyrat -> squamous-cell-carcinoma` (ASSOCIATION_ONLY under the bowen-s-disease and actinic-keratosis pre-malignant precedents; in-situ-to-invasive identity transition — the Kravvas 2022 345-patient PeIN series documents concomitant invasive penile SCC at presentation in 8.7% and progression in 2.6%, the Proietti 2021 series confirms EQ as SCC in situ; guards: in-situ identity, PeIN-population scope, HPV and lichen-sclerosus co-drivers documented), `erythropoietic-protoporphyria -> cholelithiasis` (ASSOCIATION_ONLY; protoporphyrin-pigment-stone pathway — Minder 1993 review documents early-age gallstones as a recognized complication, Lock 1996 documents 20+ years of symptomatic stones with porphyrin physiology; guard: no precise EPP-population prevalence denominator), `erythropoietic-protoporphyria -> chronic-liver-disease` (ASSOCIATION_ONLY; protoporphyrin-cholestasis fibrosis pathway — the Levy 2025 national longitudinal registry of 322 EPP/XLP patients documents 56.2% with liver-chemistry abnormalities tied to protoporphyrin levels, 3.4% with advanced protoporphyric hepatopathy mostly transplant-requiring, and 62.5% of deaths liver-attributable, with the Meerman 2000 overview anchoring the deposition mechanism; guards: EPP/XLP pooling, mild-majority distribution), `esophageal-stricture -> dysphagia` (DIRECT_CAUSATION, PROBABLE, hypothesizedOnly:false under the urethral-stricture and cystitis-or-neurogenic-bladder obstruction-mechanical precedents; fixed-luminal-narrowing pathway — Pregun 2009 documents dilation as the mechanical treatment of peptic stricture, Cohen 2021 documents stricture as the principal chronic sequela of esophageal ulcers, Pearson 2010 documents 30 years of stricture dysphagia in 114 children; scope: endoscopically documented strictures with malignancy excluded and motility disorders ruled out by manometry), and `esophagitis -> esophageal-stricture` (DIRECT_CAUSATION, PROBABLE, hypothesizedOnly:false; injury-fibrosis-stricture pathway — Pregun 2009 demonstrates the inflammation-dependency through treatment response (healing esophagitis reduces repeated dilations), Cohen 2021 and Pearson 2010 document reflux esophagitis progressing to stricture; the gerd duplicate-scope note is recorded: gerd carries no stricture edge, so this esophagitis-mediated pathway is not parallel). `euthyroid-sick-syndrome` was deferred on manifestation-identity grounds: non-thyroidal illness syndrome is an adaptive laboratory phenotype of severe systemic illness rather than an independent disease process, the literature direction is inverted (illness -> ESS), and outcome causation is confounded by the driving illness — recorded in-file with reopening conditions. Process notes: every citation was NCBI-verified via efetch BEFORE file authoring, institutionalizing the batch-30 lesson (that batch withdrew an edge whose citations failed verification; this batch's verification-first order prevented a repeat); a test-pin correction sweep accidentally rewrote four HTTP-status pins (toBe(200)) in three unrelated server tests, caught by the battery and reverted exactly, leaving zero collateral pins; the draft single-suggestion ground truth is 201 (198 + EQ, stricture, esophagitis; EPP went 0->2 adding no singles). All five new edges carry the full CRG trio; the three association edges remain NOT_ESTABLISHED with hypothesizedOnly:true, and no primary publication state changed. Registry state after batch 31: 489 relationships (415 explicit guards / 74 legacy boundaries); 714 live references with 380 verified and 334 pending qualified-human verification; 650 source entities (346 active / 295 pending). Packet regenerated to 126 worksheets / 334 rows, matching live debt exactly. Remaining backlog by the reproducible dual-marker zero-edge/undispositioned filter (windowed-verb ledger reading): 399 drafts, of which the next five are `excoriation-disorder`, `exophthalmos`, `exploding-head-syndrome`, `extensor-digitorum-brevis-strain`, and `factitious-disorder` (each pre-screened clean against every ledger). The uncommitted tree now holds thirty-one batches of D1 work — landing the PR through the CI gate remains the standing recommendation before continuing.
Mapping Expansion D1 batch 32 authored four draft-quarantined relationships across four identities: `excoriation-disorder -> scars` (ASSOCIATION_ONLY; behavioral-self-injury wound-repair pathway — the Bowes 2004 report documents compulsive picking producing linear and stellate facial ulcers with hypertrophic and erythematous scarring, the Ekore 2021 study documents excoriation disorder among adolescents and young adults with acne-induced postinflammatory hyperpigmentation and scars, and the Grant 2012 review documents repetitive picking causing tissue damage; guards: coexisting acne and primary dermatologic disease independently scar, postinflammatory hyperpigmentation mimics scar, and individual claims require documented picking preceding documented scars with primary-disease exclusion), `factitious-disorder -> scars` (ASSOCIATION_ONLY; deliberate-self-injury wound-repair pathway on the dermatitis-artefacta literature — the Alcolado 1993 case documents four decades of persistent self-excoriation of a scar site producing an enlarged disfiguring lesion and death from Marjolin-type malignant transformation, the Rodriguez Pichardo 2013 review of 201 patients documents chronic self-inflicted lesions including ulcers, and the Choudhary 2009 case documents keloids and foreign-body granuloma from self-inflicted injury; guards: diagnosis by exclusion, organic disease and self-harm from other psychiatric conditions as confounders, duplicate-scope note that excoriation-disorder carries the compulsive-picking scars edge while this identity carries the conscious-self-injury pathway), `exophthalmos -> keratitis` (ASSOCIATION_ONLY; incomplete-eyelid-closure exposure-keratopathy pathway on the bell-s-palsy ME-35 mechanism family — the Rodriguez-Garcia 2025 Surv Ophthalmol review names ocular globe protrusion among the causes of eyelid insufficiency producing exposure keratopathy with progression from superficial punctate keratitis to epithelial defects, stromal melting, and vision loss, and the Gheorghe 2007 review identifies exophthalmos/proptosis among the most frequent causes of lagophthalmos; guards: exposure-pattern corneal findings and objective lagophthalmos required, thyroid eye disease contributes independent ocular-surface disease, and the infectious, contact-lens, autoimmune, neurotrophic, traumatic, and medication-related alternative causes the ME-35 guard preserves remain excluded per case), and `exploding-head-syndrome -> insomnia` (ASSOCIATION_ONLY with a reverse-direction guard; sleep-wake transition dysregulation co-occurrence pathway — the Kirwan 2021 135-participant young-adult study documents lifetime EHS in 20.0% with participants experiencing EHS reporting poorer PSQI sleep quality and more anxiety symptoms and parasomnia co-occurrence at OR 1.62, the Sharpless 2014 review documents the parasomnia identity with five unresolved etiological theories, and the Mars 2025 StatPearls entry anchors the transition-timing diagnostic criteria; guards: the association is cross-sectional and univariate, causal direction is unresolved because arousal instability may precipitate episodes as well as result from them, and polysomnographic exclusion of seizure, hypnic-headache, and sleep-apnea mimics is required). `extensor-digitorum-brevis-strain` was deferred on evidence-ground zero-record screening under the camptodactyly precedent: targeted PubMed queries returned only anatomy, surgical-flap (Chattar-Cora 2006, del Pinal 2000), and anatomic-variant (Coskey 2022 EDB manus) literature with no clinical cohort or case series of EDB strain outcomes, and the chronic-ankle-pain and gait outcomes the strain plausibly threatens are documented for the peroneal and ligamentous identities rather than the EDB identity, so an edge would force a causal claim the evidence does not carry. Process notes: all eleven citations were NCBI-verified via efetch BEFORE file authoring (batch-30 lesson institutionalized, second consecutive clean verification cycle); two write-tool file writes were emitted with corrupted placeholder fragments and non-canonical URL domains, both were caught by the post-write structural self-audit, restored with targeted string replacements, and re-verified — the final files parse with the exact reference shape (citation, note, verificationScope, authorityCategory, sourceUrl, verified, sourceCheckedOn, sourceLocator) and a repo-wide scan confirmed zero residual contamination. All four new edges remain ASSOCIATION_ONLY, NOT_ESTABLISHED, hypothesizedOnly:true, and pending qualified-human citation verification; no primary publication state changed. Registry state after batch 32: 493 relationships (419 explicit guards / 74 legacy boundaries); 725 live references with 380 verified and 345 pending qualified-human verification; 661 source entities (346 active / 306 pending). Packet regenerated to 130 worksheets / 345 rows, matching live debt exactly. Remaining backlog by the reproducible dual-marker zero-edge/undispositioned filter (windowed-verb ledger reading): 394 drafts, of which the next five are `farmer-s-lung`, `fasciitis`, `fecal-impaction`, `female-infertility`, and `female-reproductive-disorders` (each pre-screened clean against every ledger). The uncommitted tree now holds thirty-two batches of D1 work — landing the PR through the CI gate remains the standing recommendation before continuing.
Mapping Expansion D1 batch 33 authored four draft-quarantined relationships across four identities, including one obstruction-mechanical DIRECT_CAUSATION edge: `farmer-s-lung -> pulmonary-fibrosis` (ASSOCIATION_ONLY on the bird-fancier-s-lung and bagassosis HP-family precedents; immune-complex alveolitis-to-fibrosis pathway — the Braun 1979 141-patient FL cohort with mean 14.8 years of follow-up documents radiographic interstitial changes in 39% of survivors, the Lalancette 1993 33-patient long-term outcome study with HRCT and BAL fibrosing markers characterizes persistent fibrotic change, and the Soumagne 2017 paper records fibrosis as the most frequent finding in chronic FL while documenting emphysema across three cohort studies as the alternative chronic outcome; guards: acute FL frequently resolves without fibrosis, progression is exposure- and recurrence-dependent, alternative-ILD causes excluded, and the three HP-family edges are sibling exposure identities with distinct antigen literatures rather than synonym restatements), `fasciitis -> amputation-or-loss-of-use` (ASSOCIATION_ONLY; necrotizing-fasciitis fascial-plane destruction pathway under the identity's alias — the White 2026 Bone Joint J review documents incidence 0.63 per 100,000 with limbs affected in 40% of cases and 22% 30-day mortality, the Itsiopoulos 2020 case report with literature review is dedicated to the amputation decision in NF, and the Momtaz 2024 cohort documents amputation and mortality as the composite unfavorable outcome with rates varying by socioeconomic status; guards: the amputation decision is care-pathway- and comorbidity-mediated, matching the ASSOCIATION_ONLY convention of the target's three existing vascular and neuroarthropathic edges, with vascular, diabetic, and traumatic amputation etiologies excluded), `fecal-impaction -> fecal-incontinence` (DIRECT_CAUSATION, PROBABLE, hypothesizedOnly:false under the obstruction-mechanical precedents — urethral-stricture -> hydronephrosis and esophageal-stricture -> dysphagia; mechanical-overflow pathway — the Wald 2008 management review lists fecal incontinence among the clinical manifestations of impaction, the Wald 2005 review documents impaction-with-overflow-incontinence as identifiable and appropriately treatable (the disimpaction-response dependency, the Pregun treatment-response pattern), and the Fox 1988 geriatric series documents the impaction-with-incontinence presentation; scope: documented retained stool mass with overflow leakage resolving on disimpaction, sphincter-insufficiency, neurogenic, prolapse, and diarrheal incontinence excluded; the target's seven incoming edges all sit on other mechanisms so this is no parallel pathway), and `female-infertility -> depressive-disorder` (ASSOCIATION_ONLY with reverse-direction guard; infertility-burden psychological pathway — the Crawford 2017 prospective cohort of 416 infertile women records depression and anxiety screening positivity in approximately 40% (twice fertile controls) with depressed screeners less likely to initiate treatment, the Kucur Suna 2016 BDI study documents depression across infertility etiologies in 142 women, and the Yang 2024 analysis is cited as live counter-evidence documenting the opposite arrow (depression to infertility risk); guards: screening-based rather than structured-diagnosis quantification, documented reverse arrow, and a duplicate-scope note distinguishing this state-burden pathway from the endometriosis and PCOS disease-symptom depressive-disorder edges). `female-reproductive-disorders` was deferred on duplicate-scope class-identity grounds under the diabetes-mellitus (batch 22) and eczema (batch 27) precedents: the alias 'gynecologic disorders' is a class label rather than a disease entity, the catalog carries six typed gynecologic children (endometriosis, ovarian-cysts, pelvic-inflammatory-disease, polycystic-ovary-syndrome, uterine-fibroids, vaginismus) plus ovarian-cancer with four of the six already carrying published outgoing edges, any umbrella edge would restate a typed child's pathway under the class identity, and a class has no condition-specific literature of its own — recorded in-file with reopening conditions. Process notes: all twelve citations were NCBI-verified via efetch BEFORE file authoring (batch-30 lesson institutionalized, third consecutive clean verification cycle); two candidate PMIDs resolved to off-topic papers during screening (a rituximab case for the farmer's-lung fibrosis query and a spinal-dysraphism chapter for the impaction query) and were replaced before any file write; the post-write structural self-audit passed on the first attempt for all five files with zero contamination. All four new edges carry the full CRG trio; the three association edges remain NOT_ESTABLISHED with hypothesizedOnly:true, and no primary publication state changed. Registry state after batch 33: 497 relationships (423 explicit guards / 74 legacy boundaries); 737 live references with 380 verified and 357 pending qualified-human verification; 673 source entities (346 active / 318 pending). Packet regenerated to 134 worksheets / 357 rows, matching live debt exactly. Remaining backlog by the reproducible dual-marker zero-edge/undispositioned filter (windowed-verb ledger reading): 389 drafts, of which the next five are `female-sexual-arousal-disorder`, `femoral-neuropathy`, `fissured-tongue`, `fitz-hugh-curtis-syndrome`, and `flatfoot` (each pre-screened clean against every ledger). The uncommitted tree now holds thirty-three batches of D1 work — landing the PR through the CI gate remains the standing recommendation before continuing.
Mapping Expansion D1 batch 34 authored three draft-quarantined relationships across three identities: `femoral-neuropathy -> unexplained-chronic-pain` (ASSOCIATION_ONLY as a case-matching edge under the batch-30 episcleritis and erythromelalgia pain-constitutive precedent; peripheral-nerve-injury central-sensitization pathway — the Santilli 2024 Mayo Clinic review of 159 isolated femoral neuropathy patients documents pain as a presenting feature in 53% with weakness in 96% and only 48% achieving nearly complete recovery over a mean 14.8-month course, the Martinoli 2013 review documents that hip-region neuropathies may cause chronic pain and disability, and the Malik 2023 case documents severe neuropathic pain with femoral nerve palsy; guards: pain is presenting rather than a proven downstream outcome, the documented nerve lesion is itself a generator under the target's competing-generator criteria, and electrodiagnostic confirmation with lumbar, vascular, hip, CRPS, and centralized generators excluded — with two in-file negative screens: falls/knee-injury outcomes returned only case-level records (a five-patient immobilizer series and the Kromoser recurrent-falls case) with no cohort and no catalog falls identity, and the knee-hit set is dominated by deficit descriptions), `fitz-hugh-curtis-syndrome -> female-infertility` (ASSOCIATION_ONLY on the shared-driver pattern; shared-infection dissemination pathway — the Kobayashi 2006 pathological study of 3,568 laparoscopies with 108 FHCS cases stratified 104 chronic cases by hydrosalpinx status documenting fallopian-tube damage, the Sharma 2002 320-woman study finding incidental FHCS across infertility-workup laparoscopies, and the Onoh 2016 case documenting FHCS with bilateral tubal blockage in a four-year infertility workup; guards: the same chlamydial or gonococcal episode produces both perihepatitis and tubal scarring so attribution runs through documented tubal factor, with microbiologic confirmation and male-factor, ovulatory, endometriosis, and prior-surgery exclusion; the peritoneal-adhesions alternative target was rejected under ME-41 because violin-string adhesions are constitutive of FHCS itself), and `flatfoot -> osteoarthritis` (ASSOCIATION_ONLY consistent with the osteoarthritis target's seven incoming edges; altered-load-axis biomechanical pathway — the Liang 2025 population epidemiological analysis of knee OA and flatfoot, the Zhang 2022 study of 95 knee-OA patients reporting strong flatfoot-severity-to-knee-symptom correlation, and the Patil 2024 study associating pes planus with medial-compartment knee OA through altered lower-limb biomechanics; guards: cross-sectional designs without temporal ordering, age and BMI shared drivers, live reverse gait-compensation arrow, adult symptomatic scope — pediatric flatfoot is physiologic per the Carr 2016 review context, with an in-file note recording that the Wearing 2006 pathomechanics review was screened and rejected for a plantar-fasciitis alternative edge because it explicitly records histological evidence failing the tensile-strain doctrine). `female-sexual-arousal-disorder` was deferred on evidence-gap and nosology-stability grounds: the targeted FSAD-specific mood query returned ZERO records and all seven top broader-query hits fail the condition-specific outcome bar (identity review, distress-instrument validation, prevalence study without mood figures, ISSM review without outcome quantification, three sildenafil RCTs), DSM-5 merged FSAD with HSDD into Female Sexual Interest/Arousal Disorder while the catalog carries the DSM-IV-era identity, and the batch-26 GPPPD-merger precedent governs this identity family. `fissured-tongue` was deferred on zero-record and directionality grounds: the dedicated identity paper (PMID 34447218) documents only benignity, the sole quantified association (Cetin 2025, PMID 41121042) is direction-reversed (fissured tongue as a symptom-burden correlate inside a geographic-tongue-recruited sample), no Melkersson-Rosenthal identity exists in the catalog, and a static benign developmental variant with no outcome cohort fails the camptodactyly evidence bar. Process notes: all nine citations were NCBI-verified via efetch BEFORE file authoring (batch-30 lesson institutionalized, fourth consecutive clean verification cycle); the meralgia-paresthetica and squat-posture candidates resolved to wrong-nerve and wrong-meaning papers during screening and were replaced pre-write; the post-write structural self-audit passed on the first attempt for all five files with zero contamination. All three new edges are ASSOCIATION_ONLY, NOT_ESTABLISHED, hypothesizedOnly:true, and pending qualified-human citation verification; no primary publication state changed. Registry state after batch 34: 500 relationships (426 explicit guards / 74 legacy boundaries); 746 live references with 380 verified and 366 pending qualified-human verification; 682 source entities (346 active / 327 pending). Packet regenerated to 137 worksheets / 366 rows, matching live debt exactly. Remaining backlog by the reproducible dual-marker zero-edge/undispositioned filter (windowed-verb ledger reading): 384 drafts, of which the next five are `flexor-hallucis-longus-tendinitis`, `fournier-s-gangrene`, `fregoli-syndrome`, `freiberg-s-infraction`, and `frontal-fibrosizing-alopecia` (each pre-screened clean against every ledger). The uncommitted tree now holds thirty-four batches of D1 work — landing the PR through the CI gate remains the standing recommendation before continuing.

Mapping Expansion D1 batch 35 authored five draft-quarantined relationships across four identities: `flexor-hallucis-longus-tendinitis -> unexplained-chronic-pain` (ASSOCIATION_ONLY as a case-matching edge under the batch-30 episcleritis and erythromelalgia and batch-34 femoral-neuropathy pain-constitutive precedent; overuse-nociception pathway - the Rietveld 2018 systematic review of posterior ankle impingement and FHL tendinopathy treatment in dancers (27 studies, 324 dancers) documents pain-directed outcomes with good-to-excellent results in 89% and mean 11-week return to dance, the Baillie 2022 case-control study of 82 elite participants documents posterior ankle pain as the clinical feature set evaluated against FHL imaging findings, and the Ivanova 2023 review documents plantarflexion overload producing FHL tendonitis; guards: pain is constitutive/presenting rather than a proven downstream outcome, the documented tendon pathology is itself a generator under the target's competing-generator criteria, and osteochondral, tarsal, entrapment, inflammatory, and referred lumbar generators are excluded per case), `fournier-s-gangrene -> scars` (ASSOCIATION_ONLY; destruction-and-reconstruction fibrosis pathway - the Crane 2026 penile-resurfacing series of 36 patients names Fournier's gangrene among the scar-contracture indications, the Tremblay 2026 rehabilitation evaluation documents genital graft complications after necrotizing fasciitis and Fournier's gangrene including pain, contractures, and hypertrophic scars that impair walking, sitting, voiding, bowel elimination, and sexual function, and the Griffin 2016 case documents intractable scar discomfort after Fournier's debridement and grafting requiring laser resurfacing; guards: scar burden is defect-size, healing-path, and graft-take mediated with burn, traumatic, unrelated surgical, hidradenitis, and keloid-prone perineal scarring excluded; two in-file negative screens: the 2026 survivor systematic review (PMID 41982033) fecal-incontinence and urinary findings are procedure-mediation confounded (diversionary colostomy and catheter histories, wrong-identity guard) so no incontinence edge was authored, and the seven-center survivor study (PMID 39837294) self-esteem and quality-of-life findings are screening-level with 18 of 44 responders so no depressive edge was authored; amputation deliberately avoided under duplicate-scope with the fasciitis identity's batch-33 necrotizing-fasciitis edge), `freiberg-s-infraction -> osteoarthritis` (ASSOCIATION_ONLY following the avascular-necrosis osteoarthritis precedent - osteonecrotic-collapse incongruity pathway; the Kilmartin 2020 hemiarthroplasty series of 23 consecutive patients treats second-MTP osteoarthrosis and Freiberg disease as one surgical pathology continuum, the Lee 2013 operative series reports Smillie-staged Freiberg surgery with joint debridement, and the Carro 2004 case documents a Smillie stage IV late-stage lesion treated as established secondary degeneration; guards: no natural-history cohort quantifies progression, early-stage Smillie I-II arrest is documented behavior, primary idiopathic second-MTP degenerative arthritis with a long second metatarsal variant (PMID 23892518 screened in-file) is an independent etiology, and the osteoarthritis target's eight incoming edges include the femoral-head-scoped avascular-necrosis collapse precedent this metatarsal-head pathway extends), and `frontal-fibrosizing-alopecia -> loss-of-eyebrow` and `frontal-fibrosizing-alopecia -> depressive-disorder` (two bounded associations - brow edge on the Doche 2025 dedicated clinical and histopathological study of 25 patients, the Kerkemeyer 2021 classic-phenotype review (bilateral eyebrow loss with symmetrical frontotemporal recession), and the Melián-Olivera 2025 review quantifying eyebrow alopecia at 43-94.9% in male FFA, with guards: temporal order not asserted because brow loss may precede scalp recognition and alopecia areata, trichotillomania, dermatitis, thyroid disease, medications, and age-related thinning are excluded madarosis causes; depressive edge on the Melián-Olivera 2026 multicenter study of 81 men documenting moderate-to-severe emotional impairment in 39.5% with HADS distress, the Saceda-Corralo 2018 FFA health-related quality-of-life cohort, and the Chiang 2015 study of 105 primary cicatricial alopecia patients, with guards: screening-level cross-sectional instruments rather than structured diagnosis, absent temporality with premorbid mood uncontrolled, and the live reverse arrow; FFA-to-alopecia and FFA-to-scarring-alopecia edges rejected as constitutive under the wrong-identity guard). `fregoli-syndrome` was deferred on directionality and evidence-ground grounds: the located literature documents primary psychiatric, neurodegenerative, and brain-injury conditions producing Fregoli episodes (PMID 30183352 acquired-brain-pathology review, PMID 22922811 DMS in severe OCD, PMID 29754115 DMS spectrum review, PMID 42436607 post-ABI scoping review that is Capgras-dominated and almost entirely single-case) while the targeted outcome and treatment queries returned only that scoping review and zero records respectively, with no Fregoli-specific comorbidity quantification available, so mirroring the capgras and cotard depressive edges would import another identity's evidence base and force the documented reverse direction (reverse-arrow guard, batch-33 pattern; euthyroid-sick-syndrome direction-inverted precedent). Process notes: all twenty candidate citations were NCBI-verified via efetch BEFORE file authoring with a 20/20 title match (batch-30 lesson institutionalized, fifth consecutive clean verification cycle); the batch's opening disposition screen initially computed the backlog as 377 because it matched unbackticked id mentions and read a batch-34 adjacency false positive where an unbackticked mention of the plantar fasciitis identity sat inside the 160-character window of the disposition wording that belonged to female-sexual-arousal-disorder - the documented rule is the backticked-id window, which reproduces the batch-34 figure of 384 exactly, and the backtick-anchored filter is what the closing count uses; the post-write structural self-audit passed on the first attempt for all five files with zero contamination. All five new edges are ASSOCIATION_ONLY, NOT_ESTABLISHED, hypothesizedOnly:true, and pending qualified-human citation verification; no primary publication state changed. Registry state after batch 35: 505 relationships (431 explicit guards / 74 legacy boundaries); 761 live references with 380 verified and 381 pending qualified-human verification; 697 source entities (346 active / 342 pending). Packet regenerated to 142 worksheets / 381 rows, matching live debt exactly. Remaining backlog by the reproducible dual-marker zero-edge/undispositioned filter (windowed-verb ledger reading on backticked ids): 379 drafts, of which the next five are `fungal-skin-infection`, `gamekeeper-s-thumb`, `ganglion-cysts`, `gastrinoma`, and `gastritis` (each pre-screened clean against every ledger). The tree now holds thirty-five batches of D1 work, of which batches 1-34 are landed on origin/main via PR #469 - landing batch 35 through the CI gate is the immediate next step before batch 36.

Mapping Expansion D1 batch 36 authored six draft-quarantined relationships across five identities, including two DIRECT_CAUSATION edges: `fungal-skin-infection -> cellulitis` (ASSOCIATION_ONLY; fungal-maceration barrier-break portal-of-entry pathway - the Björnsdóttir 2005 prospective case-control study of 100 cellulitis cases and 200 matched controls places particular emphasis on dermatophytic foot infection and toe-web bacterial colonization as predisposing factors, the Bristow 2009 structured review of 16 studies evaluates fungal foot infection as a cellulitis risk factor while recording that only two case-controls used microbiological diagnosis, and the Solomon 2021 cohort of 200 toe-web infections documents that most are secondary to chronic dermatophytosis; guards: no eradication-response trial exists, venous, edema, obesity, diabetes, and non-fungal portals are excluded per case, duplicate-scope noted against the dermatitis and contact-dermatitis cellulitis edges), `gamekeeper-s-thumb -> osteoarthritis` (ASSOCIATION_ONLY on the acl-injury and ankle-strain post-traumatic precedent; chronic-instability contact-stress pathway - the Christensen 2016 long-term follow-up of chronic thumb UCL repairs at mean 24.5 years documents some degree of osteoarthritis in 88% of evaluated patients with radiographic grade correlations, the Daley 2020 review characterizes chronic collateral ligament insufficiency as a distinct entity, and the Fairhurst 2002 series documents reconstruction of chronic gamekeeper's laxity in 22 thumbs with two having ongoing MCP pain; guards: the 88% derives from a 12-patient surgically-treated subset, primary first-carpometacarpal basal-thumb osteoarthritis at a different joint is the dominant alternative, and the skier-s-thumb acute sibling retains its own pathway), `ganglion-cysts -> carpal-tunnel-syndrome` (ASSOCIATION_ONLY on the de-quervain carpal-tunnel precedent; space-occupying mass-effect pathway - the Yalcinkaya 2014 report documents two unilateral carpal-tunnel cases caused by occult ganglia, the Kang 2009 series documents 11 patients operated for space-occupying-lesion carpal tunnel syndrome (pathology including ganglion) with symptom alleviation in all cases, and the Alsharif 2026 case documents a histopathology-confirmed flexor-sheath ganglion compressing the median nerve with complete resolution after excision; guards: idiopathic carpal tunnel is the dominant etiology, ganglia are common incidental findings, imaging and electrodiagnostic confirmation with alternative masses excluded is required), `gastrinoma -> peptic-ulcer-disease` (DIRECT_CAUSATION, PROBABLE, hypothesizedOnly:false under the obstruction-mechanical and structural-lesion precedents; gastrin-hypersecretion acid-injury cascade - the Norton 2005 review defines Zollinger-Ellison syndrome as severe peptic ulcer disease caused by gastric acid hypersecretion secondary to the gastrin-secreting tumor, the Wilcox 2011 prospective 20-year trial of 72 patients documents stereotypical ulcer presentation with median nine-year symptom delay and sustained lansoprazole response, and the Guarnotta 2018 review documents proton pump inhibition as the cornerstone controlling acid hypersecretion; scope: biochemically confirmed syndrome with endoscopic ulcer, chronology dating the tumor's biological presence rather than diagnosis, Helicobacter, NSAID, and stress etiologies excluded per case), and `gastritis -> peptic-ulcer-disease` (DIRECT_CAUSATION, PROBABLE, hypothesizedOnly:false on the esophagitis-to-stricture mucosal-injury pattern; inflammation-to-defense-failure-to-ulceration chain - the Naito 2002 mechanisms review documents antral-type gastritis with excessive acid secretion and high duodenal-ulcer risk, the Ford 2016 Cochrane review documents 95% of duodenal and 70% of gastric ulcers as Helicobacter-associated with eradication reducing relapse, and the Tomtitchong 2012 meta-analysis documents 5.2% one-year recurrence after eradication; scope: documented gastritis predating endoscopically confirmed ulcer with erosion-versus-ulcer depth distinction and NSAID-only, stress, gastrinoma, and idiopathic etiologies excluded) plus `gastritis -> anemia` (ASSOCIATION_ONLY; iron-restriction pathway with shared-driver attribution guard - the Hudak 2017 updated meta-analysis documents pooled OR 1.72 for iron-deficiency anemia in infected persons across 14 observational studies, the Zhang 2010 meta-analysis of eight randomized trials documents accelerated ferritin improvement after eradication (mean difference 7.74 microg/L), and the Qu 2010 meta-analysis documents pooled OR 2.22 with heterogeneous trial results; guards: no Helicobacter identity exists so attribution runs through the gastritis mucosal mediator, iron-study-confirmed iron-deficiency phenotype required, and menstrual, renal, nutritional, inflammatory-bowel, other bleeding, malignancy, and hemoglobinopathy causes excluded; in-file negative screens reserve the gastric-cancer and vitamin-B12 pathways to the autoimmune-metaplastic-atrophic-gastritis identity, which already carries the atrophic-to-stomach-cancer edge). No deferrals in this batch. Process notes: all eighteen citations were NCBI-verified via efetch BEFORE file authoring with an 18/18 title match (batch-30 lesson institutionalized, sixth consecutive clean verification cycle); the post-write structural self-audit caught one dual-shape evidenceGaps divergence in the gamekeeper's-thumb file caused by a carpometacarpal spelling variant between the profile string and the top-level array, fixed with a targeted replacement and re-audited to zero errors. All six new edges carry the full CRG trio (two DIRECT at PROBABLE with hypothesizedOnly:false, four ASSOCIATION_ONLY with NOT_ESTABLISHED and hypothesizedOnly:true) and remain pending qualified-human citation verification; no primary publication state changed. Registry state after batch 36: 511 relationships (437 explicit guards / 74 legacy boundaries); 779 live references with 380 verified and 399 pending qualified-human verification; 715 source entities (346 active / 360 pending). Packet regenerated to 148 worksheets / 399 rows, matching live debt exactly. Remaining backlog by the reproducible dual-marker zero-edge/undispositioned filter (windowed-verb ledger reading on backticked ids): 374 drafts, of which the next five are `gastrointestinal-cancers`, `gastrointestinal-stromal-tumors`, `genitofemoral-nerve-neuralgia`, `geographic-tongue`, and `gerstmann-s-syndrome` (each pre-screened clean against every ledger; note the gastrointestinal-cancers identity is a class-label candidate for the duplicate-scope screen and geographic-tongue was already referenced in the fissured-tongue deferral). The tree now holds thirty-six batches of D1 work, of which batches 1-34 are landed on origin/main via PR #469 while batches 35-36 await the CI gate - landing both through CI is the immediate next step before batch 37.

Mapping Expansion D1 batch 37 authored four draft-quarantined ASSOCIATION_ONLY relationships across two identities, with three deferrals: `gastrointestinal-stromal-tumors -> anemia` (bleeding-lesion iron-loss pathway matching the peptic-ulcer anemia edge's category - the Askarova 2026 case report documents a giant jejunal GIST presenting with four months of melena and hemoglobin 60 g/L requiring transfusion with chronic mucosal ulceration as the stated iron-loss mechanism, the Yacob 2015 single-centre review of 150 GIST cases documents intestinal bleeding (40%) among the commonest presentations, and the Aourarh 2026 report background documents that small-bowel GISTs usually present with gastrointestinal bleeding and anemia; guards: subset rather than universal progression, chronology confounded by the tumor predating its own diagnosis, and iron-study-confirmed phenotype with menstrual, renal, nutritional, inflammatory-bowel, other-bleeding, malignancy, hemoglobinopathy, and hemolysis etiologies excluded), `gastrointestinal-stromal-tumors -> malnutrition-residuals` (tumor-burden catabolic and intake-limiting pathway distinct from the biliary sibling's obstructive mechanism - the Ou 2025 GLIM-criteria outpatient study documents malnutrition in 27.75% and high nutritional risk in 18.50% of GIST outpatients with GLIM malnutrition significantly affecting progression-free survival, the Ding 2021 study documents 77.76% of newly diagnosed patients at nutritional risk (NRS2002) with 10.09% PG-SGA incidence, and the Gu 2025 body-composition cohort documents sarcopenia (HR 3.067) and myosteatosis (HR 6.985) as independent disease-free-survival predictors; guards: cross-sectional design without onset chronology, TKI toxicity and postoperative malabsorption as separable co-drivers, and GLIM/PG-SGA confirmation with non-tumor nutritional etiologies excluded), and `gastrointestinal-stromal-tumors -> depressive-disorder` (diagnosis-and-treatment burden pathway matching the stomach-cancer and frontal-fibrosizing-alopecia depressive edges - the van de Wal 2024 prospective study of 328 GIST patients documents 13% depression and 15% anxiety on HADS with current TKI treatment associated with depression, the van de Wal 2024 financial-difficulties study documents significantly lower global quality of life and functioning under financial toxicity, and the van de Wal 2023 coping-style study documents psychological distress and HRQoL burden; guards: screening-instrument cutoffs rather than diagnostic interviews with source-recorded norm-comparable prevalence, separable TKI and financial co-drivers, and diagnostic-standard assessment with pre-existing psychiatric history documented) plus `genitofemoral-nerve-neuralgia -> unexplained-chronic-pain` (case-matching pain edge on the femoral-neuropathy and episcleritis precedent - the Lobaina 2024 StatPearls chapter documents genitofemoral neuralgia as a chronic painful neuropathic condition with constant burning inguinal-genital pain and as a common cause of groin pain in both sexes, the Lakhiani 2026 compression-neuropathy review documents that genitofemoral among groin neuropathies requires exclusion of proximal pathology and confirmatory nerve blocks, and the Alfarawan 2025 series documents refractory neuropathic groin pain of at least six months with imaging exclusion of non-neuropathic causes and pain scores falling from 7.8 to 1.2 after neurectomy; guards: pain largely constitutive of the neuralgia so the edge records presentation-and-workup matching rather than a distinct downstream arrow, with block- or imaging-confirmed diagnosis and lumbar, urogenital, nephrolithiasis, endometriotic, hip, overlapping-ilioinguinal, and central-sensitization etiologies excluded). Deferrals: `gastrointestinal-cancers` on duplicate-scope class grounds - the catalog carries organ-specific identities (esophageal-, stomach-, colorectal-, biliary-tract-, liver-, pancreatic-, small-intestine-cancer) with their own edges so any umbrella edge would run parallel pathways to the member identities' evidence (the batch-22 diabetes-mellitus, batch-27 eczema, and batch-33 female-reproductive-disorders class bans), and the umbrella's mixed histologies and organs defeat a single mechanism; `geographic-tongue` on wrong-identity/synonym-duplicate grounds - geographic tongue and benign migratory glossitis name the same disease (the Kalra 2024 report title reads benign migratory glossitis or geographic tongue) while benign-migratory-glossitis already carries the psoriasis edge, so mapping both identities would duplicate one pathway (reopening via governance merge); `gerstmann-s-syndrome` on directionality and constitutive-component grounds - the Sanjo 2016 PML report, Tanei 2012 melanoma-metastases report, and Russell 2005 parietal-glioma series all document lesions producing Gerstmann manifestations (reverse arrow for outcome purposes), zero records quantify Gerstmann-specific downstream outcomes, and the tetrad's components are constitutive of the syndrome (ME-41 phenotype barrier) with upstream stroke/tumor identities already owning the lesion-to-deficit direction. Process notes: all twelve citations were NCBI-verified via efetch BEFORE file authoring with a 12/12 title match (seventh consecutive clean verification cycle); the post-write structural self-audit passed on the first attempt with zero contamination; the backlog screen opened at a one-count discrepancy (373 versus the batch-36 end state of 374) traced to a deviation in the author's own filter - the pre-window disposition rule checks reaffirm-verbs (reaffirmed, reaffirmation) only, and including bare "retained" created a cross-row adjacency false positive on strongyloidiasis (the retained belonged to histoplasmosis's adjacent table row); with the canonical rule restored the filter reproduced 374 exactly before any batch-37 file was written. All four new edges carry the full CRG trio at ASSOCIATION_ONLY with NOT_ESTABLISHED and hypothesizedOnly:true and remain pending qualified-human citation verification; no primary publication state changed. Registry state after batch 37: 515 relationships (441 explicit guards / 74 legacy boundaries); 791 live references with 380 verified and 411 pending qualified-human verification; 727 source entities (346 active / 372 pending). Packet regenerated to 152 worksheets / 411 rows, matching live debt exactly. Remaining backlog by the reproducible dual-marker zero-edge/undispositioned filter (windowed-verb ledger reading on backticked ids): 369 drafts, of which the next five are `giant-cell-myocarditis`, `gigantism`, `gingivitis`, `glaucoma`, and `glomus-tumor` (each pre-screened clean against every ledger; glomus-tumor should be screened against the existing vascular-tumor identities). The tree now holds thirty-seven batches of D1 work, of which batches 1-34 are landed on origin/main via PR #469 while batches 35-37 await the CI gate - landing all three through CI is the immediate next step before batch 38.

Mapping Expansion D1 batch 38 authored five draft-quarantined relationships across four identities, including one DIRECT_CAUSATION edge: `giant-cell-myocarditis -> congestive-heart-failure` (DIRECT_CAUSATION, PROBABLE, hypothesizedOnly:false under the eosinophilic-myocarditis precedent - granulomatous T-cell-mediated myocyte destruction reducing contractile mass until pump failure; the Kundnani 2026 outcomes review documents new-onset heart failure refractory to usual therapy as the characteristic clinical onset with a frequently fulminant fatal course, the Sacher 2025 biopsy-confirmed case documents giant cell myocarditis as a rare rapidly progressive inflammatory cardiomyopathy often manifesting with heart failure or ventricular arrhythmias, and the Harling 2026 report documents fatal rapidly progressing biventricular heart failure; scope: specialist- or biopsy-confirmed disease with new-onset dysfunction documented during the course, exclusion of ischemic, valvular, tachycardia-mediated, peripartum, toxic-metabolic, familial, and cardiac-sarcoidosis giant-cell-mimic etiologies per case) and `giant-cell-myocarditis -> cardiac-arrhythmia` (ASSOCIATION_ONLY matching the cardiac-inflammatory-disease and cardiomyopathy arrhythmia edges - inflammation-and-fibrotic-scar re-entry substrate; the Jaiswal 2025 propensity-score comparison documents distinct ventricular-tachycardia and conduction-block burdens versus cardiac sarcoidosis at six months, the Bartz-Overman 2024 report documents two fulminant cases with ventricular arrhythmias, and the Jakulla 2025 report documents an electrical storm with pleomorphic ventricular tachycardia confirmed on endomyocardial biopsy; guards: subset presentation without incidence cohorts, sarcoid mimic, and independent rhythm etiologies excluded) plus `gingivitis -> periodontitis` (ASSOCIATION_ONLY with an explicit shared-driver guard - subgingival biofilm drives both diseases; the Lang 2024 natural-history review of the Sri Lanka and Oslo studies documents the role of gingivitis in the pathogenesis of attachment loss with continuous gingivitis marking the progression trajectory, the LaMonte 2021 cohort of 1,016 postmenopausal women documents baseline microbiome and gingival status associated with radiographic progression five years later (the confound itself), and the Papapanou 2018 2017-World-Workshop consensus stages and grades periodontitis with case-by-case progression risk; guards: baseline staging, susceptibility modifiers, and non-plaque etiologies addressed per case), `glaucoma -> visual-impairment` (ASSOCIATION_ONLY following the eye-identity cluster norm where six-of-seven incoming visual-impairment edges are association-only; the Tham 2014 meta-analysis documents glaucoma as the leading cause of global irreversible blindness with 3.54% prevalence and 111.8 million projected by 2040, the Soh 2021 meta-analysis documents more than half of cases undetected globally, and the Salari 2025 advanced-glaucoma series carries the millions-of-impairment burden framing; guards: treated-minority progression, standardized impairment criteria with chronology, cataract/macular/corneal co-pathology excluded; no blindness edge authored because blindness has zero incoming edges catalog-wide), and `glomus-tumor -> unexplained-chronic-pain` (ASSOCIATION_ONLY case-matching on the femoral-neuropathy, episcleritis, and genitofemoral precedent - nerve-rich glomus-body excitation producing severe cold-exacerbated focal pain with years-long diagnostic delay; the Mostafa 2026 report documents chronic unexplained fingertip pain with the classic triad and Love-test guidance, the Pandey 2026 report documents a seven-year average misdiagnosis delay, and the Park 2024 report documents pain more than five times daily resolving after excision; guards: pain largely constitutive of the tumor so the edge records presentation-and-workup matching, histopath confirmation with digital-pain mimickers excluded). One deferral: `gigantism` on evidence-gap/zero-record grounds - targeted heart-failure, cardiomyopathy, and diabetes-outcome queries return only adult acromegaly records (PMID 38810595, 34795812), syndromic overgrowth cases (PMID 30592149, 35713067), Carney-complex surveillance (PMID 20301463), or unrelated records, the dedicated pediatric literature is surgical (Kumar 2026 cure rates with post-treatment hypopituitarism - treatment-mediated, reverse direction) and molecular (PMID 39904816) without comorbidity quantification, a pediatric quality-of-life query returns zero records, and the published acromegaly identity already owns the growth-hormone-excess systemic edges (hypertension, sleep-apnea) so pooled authoring would run a shared-driver parallel pathway across two identities; reopening via a gigantism-specific directional cohort or a governance merge. Process notes: all fifteen citations were NCBI-verified via efetch BEFORE file authoring with a 15/15 title match (eighth consecutive clean verification cycle); the post-write structural self-audit caught one stray empty `causationStatusNote` key in the giant-cell-myocarditis arrhythmia nexus (removed with a targeted replacement; the assertion also fixed an adjacent monitoring-documented typo) and re-audited to zero errors; the ruled-set pin sweep ran with a pre-compile guard and matched every expected context on the first attempt (57 files, zero stale, HTTP-status 1/2/1, draft-673 x7, PER_HOST 500, verified-380 all untouched). All five new edges carry the full CRG trio (one DIRECT at PROBABLE with hypothesizedOnly:false, four ASSOCIATION_ONLY with NOT_ESTABLISHED and hypothesizedOnly:true) and remain pending qualified-human citation verification; no primary publication state changed. Registry state after batch 38: 520 relationships (446 explicit guards / 74 legacy boundaries); 806 live references with 380 verified and 426 pending qualified-human verification; 742 source entities (346 active / 387 pending). Packet regenerated to 157 worksheets / 426 rows, matching live debt exactly. Remaining backlog by the reproducible dual-marker zero-edge/undispositioned filter (windowed-verb ledger reading on backticked ids): 364 drafts, of which the next five are `glossitis`, `glucagonoma`, `goiter`, `goodpasture-syndrome`, and `granuloma-annulare` (each pre-screened clean against every ledger; glossitis must be screened against the gingivitis and atrophic-glossitis oral-inflammation pathways authored nearby, and goodpasture-syndrome against the autoimmune-renal/pulmonary dual-organ scope). The tree now holds thirty-eight batches of D1 work, of which batches 1-34 are landed on origin/main via PR #469 while batches 35-38 await the CI gate - landing all four through CI is the immediate next step before batch 39.

### Batch 39 (2026-09-23) — glossitis, glucagonoma, goiter, goodpasture-syndrome, granuloma-annulare

Authored 3 new pending-verification relationships across 2 identities over 7 new
pending-verification clinical sources (all 7 PMIDs NCBI-verified via efetch before
file authoring, 7/7, ninth consecutive clean cycle), plus 3 deferrals:

- `glucagonoma` -> `diabetes-mellitus` (DIRECT_CAUSATION/PROBABLE,
  NEUROENDOCRINE_CASCADE: glucagon-driven hepatic gluconeogenesis/glycogenolysis
  overflow vs the type-2 shared-risk driver guard) and -> `malnutrition-residuals`
  (ASSOCIATION_ONLY: catabolic state, necrolytic migratory erythema losses, intake
  limitation; oncologic sibling precedent `biliary-tract-cancer->malnutrition-residuals`).
- `glossitis` deferred: oral-candidiasis plus atrophic/glossitis-tongue subtype
  identities own the space (duplicate-scope/parallel-pathway guard).
- `goiter` deferred: compressive downstream pathway lives inside the
  `nontoxic-thyroid-enlargement` nontoxic subset (synonym-scope guard).
- `granuloma-annulare` deferred: JAMA Dermatol 2021 anchor (PMID 34106218) frames
  diabetes/hyperlipidemia as risk factors FOR granuloma annulare — direction
  inverted; no quantified forward-outcome cohort (shared-driver/direction guard).
- `goodpasture-syndrome` -> `chronic-kidney-disease` (DIRECT_CAUSATION/PROBABLE,
  IMMUNE_MEDIATED: anti-GBM crescentic rapidly-progressive glomerulonephritis to
  dialysis-dependent outcomes; `granulomatosis-with-polyangiitis` recorded in-file
  as the ANCA-mimic exclusion).

Registry after lockstep: 523 relationships (449 explicit / 74 legacy), 815 reference
uses (380 verified / 435 pending-verification), 749 source entities (346 active /
394 pending). Citation packet regenerated at 160 worksheets / 435 reference rows =
live citation debt. Backlog after batch 39: **359** undispositioned zero-edge drafts.
Next-five: `granulomatosis-with-polyangiitis`, `granulomatous-disease`,
`granulomatous-rhinitis`, `greater-trochanteric-pain-syndrome`,
`guillain-barre-syndrome`. Standing recommendation unchanged: land the accumulated
uncommitted batches (35-39) through CI in one PR, as with PR #469 for batches 1-34.

### Batch 40 (2026-09-23) — granulomatosis-with-polyangiitis, guillain-barre-syndrome, greater-trochanteric-pain-syndrome, granulomatous-disease, granulomatous-rhinitis

Authored 5 new pending-verification relationships across 3 identities over 14 new
pending-verification clinical sources (14/14 PMIDs NCBI-verified via efetch before file
authoring, tenth consecutive clean cycle; PMID 39687605 is shared across both GBS edges
and deduped by lockstep, so 15 reference uses over 14 sources), plus 2 deferrals:

- `granulomatosis-with-polyangiitis` -> `chronic-kidney-disease` (DIRECT_CAUSATION/PROBABLE,
  IMMUNE_MEDIATED: PR3-ANCA pauci-immune crescentic destruction to staged CKD or
  renal-replacement dependence - Shen 2011 PMID 20394635 RPGN-induced ESRD attribution,
  James 2017 PMID 27749233 pediatric 37% past stage 2, Sattui 2024 PMID 39305914 older-adult
  cohort) and -> `hearing-loss` (ASSOCIATION_ONLY: OMAAV cohort audiometry - Tabei 2022
  PMID 34915561 all impaired 85% bilateral, Yoshida 2014 PMID 25339433 rapid-progressive
  loss review, Busch 2022 PMID 35663680 complete-loss case; effusion-mediated conductive
  component scoped to the otitis-media identity's existing hearing-loss edge).
- `guillain-barre-syndrome` -> `unexplained-chronic-pain` (ASSOCIATION_ONLY case-matching:
  Papri 2024 PMID 39687605 prospective 644-patient pain persistence 71%/38%/26% across
  weeks, Levison 2020 PMID 32192820 nationwide 70% medically treated pain, Yao 2018
  PMID 30142753 presenting pre-weakness pain) and -> `depressive-disorder`
  (ASSOCIATION_ONLY psychological burden: Walteros 2019 PMID 31369576 adjusted OR 3.89
  vs controls, Witsch 2013 PMID 23299621 ventilated survivors ~50% anxiety/depression
  impairment at mean 52.6 months, shared Papri 2024).
- `greater-trochanteric-pain-syndrome` -> `unexplained-chronic-pain` (ASSOCIATION_ONLY
  case-matching: chronic lateral-hip pain historically misattributed to bursitis,
  osteoarthritis, and spinal sources - Williams 2009 PMID 19372352, Pianka 2021
  PMID 34158938, Mary McMillan 2022 PMID 34898293; the generic bursitis and tendinopathy
  siblings remain zero-edge backlog identities with their own windows, site-specific
  identity owns this pathway).
- `granulomatous-disease` deferred: class/umbrella identity under Infectious & Tropical
  Diseases beneath member and sibling identities (tuberculosis with its own two edges,
  sarcoidosis with its own two, histoplasmosis and granuloma-annulare with recorded
  windows) - duplicate-scope parallel-pathway class ban (batch 22/27/33/37 precedents);
  no umbrella-specific quantified forward-outcome cohort exists.
- `granulomatous-rhinitis` deferred: finding-level identity with direction reversed
  (Rimmer and Lund 2023 PMID 36410993 documents granulomatous airway disease as a
  manifestation of underlying systemic or isolated disease mimicking plain rhinitis)
  plus duplicate scope against the edge-bearing chronic-rhinitis identity and a
  zero-record screen for forward outcomes attributable to the finding itself.

Registry after lockstep: 528 relationships (454 explicit / 74 legacy), 830 reference uses
(380 verified / 450 pending-verification), 763 source entities (346 active / 408 pending).
Citation packet regenerated at 165 worksheets / 450 reference rows = live citation debt.
Backlog after batch 40: **354** undispositioned zero-edge drafts. Next-five:
`guyon-s-canal-syndrome`, `hairy-cell-leukemia`, `hairy-tongue`, `halitosis`,
`hallux-rigidus`. Standing recommendation unchanged: land the accumulated uncommitted
batches (35-40) through CI in one PR, as with PR #469 for batches 1-34.

### Batch 41 (2026-09-24) — hairy-cell-leukemia, guyon-s-canal-syndrome, halitosis, hairy-tongue, hallux-rigidus

Authored 3 new pending-verification relationships across 3 identities over 9 new
pending-verification clinical sources (13/13 PMIDs NCBI-verified via efetch before file
authoring, eleventh consecutive clean cycle), plus 2 deferrals:

- `hairy-cell-leukemia` -> `anemia` (ASSOCIATION_ONLY, MULTIFACTORIAL: marrow
  infiltration plus splenic sequestration with bleeding and treatment routes -
  Sarvaria 2016 PMID 26513168 "ultimately results in cytopenias", Mackowiak 2024
  PMID 38882583, Plenderleith 1970 PMID 4939244; follows the uniform anemia family
  norm - all 18 incoming anemia edges rest at NOT_ESTABLISHED - and the
  chronic-b-cell-leukemias sibling scope is CLL-aliased autoimmune hemolysis only,
  so no parallel pathway exists; the generic leukemia umbrella stays zero-edge).
- `guyon-s-canal-syndrome` -> `muscle-atrophy` (DIRECT_CAUSATION/PROBABLE,
  MECHANICAL_OR_COMPRESSIVE: chronic ulnar-canal compression to denervation
  wasting with dechallenge reversal - Tong 2026 PMID 42065727 claw-hand series
  72.7% grade-5 recovery, Wang 2014 PMID 24774037 nine cases with 16-month
  symptom duration, Chen 2014 PMID 24559635 mimic-list review; first incoming
  edge to muscle-atrophy, site-specific identity owns the pathway while generic
  ulnar-neuropathy and peripheral-neuropathy siblings stay zero-edge).
- `halitosis` -> `depressive-disorder` (ASSOCIATION_ONLY, PSYCHOPHYSIOLOGICAL:
  odor-confirmed psychological-burden association on the burning-mouth precedent -
  Lu 2017 PMID 27516401 VSC-confirmed OHIP 15.7 vs 7.9 psych-domain dominance,
  Renvert 2020 PMID 32753975 expert consensus, Mento 2021 PMID 34204752 38-study
  review; reverse-arrow guard records that emotional state modulates odor
  self-perception and halitophobia runs distress to complaint, requiring
  objective odor confirmation per case).
- `hairy-tongue` deferred: benign self-limited finding with zero condition-specific
  forward-outcome records (targeted searches returned only driver studies), a
  smoking shared-driver guard (Just-Sarobe 2008 PMID 18358192: smoking causes both
  black hairy tongue and halitosis), and a wrong-identity guard against
  oral-hairy-leukoplakia; the oral-dorsum sibling window chain (fissured-tongue,
  geographic-tongue, glossitis, atrophic-glossitis, median-rhomboid-glossitis) is
  already dispositioned.
- `hallux-rigidus` deferred: constitutive identity-is-osteoarthritis barrier
  (ME-41; identity-to-osteoarthritis would assert the diagnosis against its own
  definition), wrong-target guard for the documented gait outcomes
  (difficulty-walking and gait-abnormality identities absent), and counter-evidence
  - Stevens 2022 PMID 35717495 found no significant plantar-pressure difference vs
  controls and de Bot 2023 PMID 38025694 found gait comparable to healthy controls
  22 years post-surgery (no fixed downstream sequela).

Registry after lockstep: 531 relationships (457 explicit / 74 legacy), 839 reference
uses (380 verified / 459 pending-verification), 772 source entities (346 active / 417
pending). Citation packet regenerated at 168 worksheets / 459 reference rows = live
citation debt. Backlog after batch 41: **349** undispositioned zero-edge drafts.
Next-five: `hallux-valgus`, `halo-nevus`, `hammertoe`,
`hashimoto-s-encephalopathy`, `head-and-neck-cancers`. Standing recommendation
unchanged: land the accumulated uncommitted batches (35-41) through CI in one PR, as
with PR #469 for batches 1-34.

### Batch 42 (2026-09-24) — hallux-valgus, halo-nevus, hammertoe, hashimoto-s-encephalopathy, head-and-neck-cancers

Authored 7 new pending-verification relationships across 4 identities over 21 new
pending-verification clinical reference uses (17 unique PMIDs, all NCBI-verified via
efetch before file authoring, twelfth consecutive clean cycle), plus 1 deferral:

- `hallux-valgus` -> `metatarsalgia` (ASSOCIATION_ONLY, BIOMECHANICAL_ALTERATION:
  first-ray load-transfer hypothesis - Murahashi 2026 PMID 41093741 n=1700 pain
  gradient 33.6% mild to 57.1% severe with pain migrating to metatarsal regions,
  Gines-Cespedosa 2013 PMID 23943654 30.8% coexisting metatarsalgia with worse
  SF-36, Chaiwanichsiri 2009 PMID 19052445 community attribution plus the
  asymptomatic-deformity guard; cross-sectional designs leave direction unproven).
- `hallux-valgus` -> `unexplained-chronic-pain` (ASSOCIATION_ONLY case-matching on
  the 8-edge family: shared Murahashi severity gradient, Bock 2015 PMID 26246258
  Scarf osteotomy 93 feet 124-month pain-as-indication with 30% recurrence,
  shared Chaiwanichsiri; independent pain generators and centralized-pain
  assessment required per case).
- `hammertoe` -> `unexplained-chronic-pain` (ASSOCIATION_ONLY case-matching:
  Matthews 2018 PMID 29413774 215 toes with ALL patients in preoperative pain
  and 96% relief post-op, Olsen 2023 PMID 38274283 degenerative substrate with
  pain relief up to 92%, Arbab 2017 PMID 28676916 pain as the operative
  objective; selection-on-outcome guard recorded - surgical series select on
  pain as the indication).
- `halo-nevus` -> `vitiligo` (ASSOCIATION_ONLY, IMMUNE_MEDIATED: shared
  melanocyte-directed CD8 T-cell autoimmunity - Ezzedine 2012 PMID 22508876
  prospective 553 with halo nevi in 130 (23.5%), Kano 2023 PMID 36966028 54-patient
  immune-microenvironment series, de Vijlder 2004 PMID 15140072 HLA case-control
  showing partially distinct pathogenic mechanisms; indeterminant-direction and
  melanoma-regression guards recorded).
- `hashimoto-s-encephalopathy` -> `seizure-disorder` (ASSOCIATION_ONLY - deliberately
  BELOW the encephalitis DIRECT precedent because HE typically shows normal MRI (no
  documented epileptogenic lesion) and no post-HE epilepsy incidence cohort exists;
  Bien 2013 PMID 23622200, Matsunaga 2021 PMID 34006687, Hilberath 2014 PMID 25084973;
  acute-symptomatic-versus-chronic-epilepsy guard).
- `hashimoto-s-encephalopathy` -> `cognitive-disorder` (ASSOCIATION_ONLY/NOT_ESTABLISHED
  by exact family-match with the encephalitis->cognitive-disorder sibling; Schenck 2025
  PMID 39154259 persistent subcortical impairment at two timepoints, Adams 2020
  PMID 32173161 17-patient domain outcomes, Valencia-Sanchez 2021 PMID 34061124 Mayo
  144-referral mimic guard - 73% alternative diagnoses).
- `hashimoto-s-encephalopathy` -> `depressive-disorder` (ASSOCIATION_ONLY on the
  64-edge incoming family norm; Schenck 2025 shared, Ellul 2020 PMID 32702227
  drug-resistant-depression presentation responsive to immunomodulation, Adams 2020
  shared; primary-psychiatric-mimic and corticosteroid-mood confounds recorded).
- `head-and-neck-cancers` **deferred**: class/umbrella identity - member
  `laryngeal-cancer` already owns an outgoing edge, `oral-cancer` and
  `salivary-gland-cancer` members are queued for their own windows, and most
  plausible targets (hearing-loss, dysphagia, xerostomia) are treatment-mediated
  site-specific pathways (parallel-pathway class ban, batch 22/27/33/37/40).

Governance highlights: shared-PMID reuse inside the batch (41093741 and 19052445
across both hallux-valgus edges; 39154259 and 32173161 across two HE edges) deduped
in the source registry; no falls/gait edge (Chaiwanichsiri counter-evidence that foot
deformities were not associated with falls, plus absent target identities); no
osteoarthritis edge from hallux-valgus (zero-record for HV-specific incident MTP-osteoarthritis,
adjacent to the hallux-rigidus constitutive barrier); no thyroiditis edge from HE
(shared-autoimmunity driver guard - HE does not cause thyroiditis, most HE patients
euthyroid, and the published thyroiditis->hypothyroidism edge owns the functional
pathway).

Backlog accounting note: the opening screen re-derived the canonical backlog rule from
primary data (in-file D1 dispositions across governanceNotes AND all todo entries,
plus ledger-only ME-closures), recalibrating the batch-41 figure of 349 to 344 because
five todo-only withdrawal/rescreen records (adjustment-disorder, hydronephrosis,
myasthenia-gravis, post-concussion-syndrome, seizure-disorder) are dispositions, not
open work. With this batch's 5 identities dispositioned, backlog after batch 42:
**339** undispositioned zero-edge drafts. Next-five: `hearing-loss`, `heart-block`,
`heart-valve-disorders`, `hemangioma`, `hemipelvectomy`.

Registry after lockstep: 538 relationships (464 explicit / 74 legacy), 860 reference
uses (380 verified / 480 pending-verification), 789 source entities (346 active / 434
pending). Citation packet regenerated at 175 worksheets / 480 reference rows = live
citation debt. Standing recommendation unchanged: land the accumulated uncommitted
batches (35-42) through CI in one PR, as with PR #469 for batches 1-34.

### Batch 43 (2026-09-24) — hearing-loss, heart-block, heart-valve-disorders, hemangioma, hemipelvectomy

Authored 8 new pending-verification relationships across 5 identities over 16 clinical
reference uses (16 unique PMIDs, all NCBI-verified via efetch before file authoring,
thirteenth consecutive clean cycle; one use is a verified-source reuse of the already
human-verified Diers 2022 phantom-limb-pain survey, carried verified:true per the
elbow-disarticulation family precedent, so the debt ratchet advances by 15
pending-verification uses):

- `hearing-loss` -> `cognitive-disorder` (ASSOCIATION_ONLY, MULTIFACTORIAL:
  Loughrey 2018 PMID 29222544 meta-analysis of prospective cohorts plus Zhang 2025
  PMID 40103444 moderator and mediator meta-analysis showing the association is robust
  across moderators while mediation stays unresolved; no intervention evidence that
  amplification prevents incident decline, shared aging/vascular/neurodegenerative
  substrate guard).
- `hearing-loss` -> `depressive-disorder` (ASSOCIATION_ONLY, PSYCHOPHYSIOLOGICAL:
  Li 2025 PMID 39752630 pooled association plus Li 2026 PMID 41275674 19-study
  social-activity mediation and moderation meta-analysis; unoriented cross-sectional
  designs and shared aging/chronic-illness guard).
- `heart-block` -> `cardiomyopathy` (ASSOCIATION_ONLY, MULTIFACTORIAL: the 2018
  ACC/AHA/HRS bradycardia and conduction-delay guideline PMID 30586772 as the
  evaluation framework plus Miric 2024 PMID 39286730 single-patient reversible
  bradycardia-induced heart failure with preserved ejection fraction; Mycinski 2025
  PMID 40067976 385-patient isolated atrioventricular block cohort reported no
  incident dilated cardiomyopathy over median ten-year follow-up and is recorded as
  screened counter-evidence rather than cited as support).
- `heart-valve-disorders` -> `congestive-heart-failure` (DIRECT_CAUSATION/PROBABLE,
  MECHANICAL_OR_COMPRESSIVE: overload-to-remodeling natural history at guideline
  consensus across two independent bodies - Otto 2020 PMID 33332150 and the ESC/EACTS
  2021 guideline PMID 34453165).
- `heart-valve-disorders` -> `cardiac-inflammatory-disease` (ASSOCIATION_ONLY,
  INFECTIOUS_SPREAD: Baddour 2015 AHA infective endocarditis statement PMID 26373316
  plus the ESC 2023 endocarditis guideline PMID 37622656; the abnormal valve is a
  substrate requiring a separate bacteremic exposure, keeping the proposition
  association-only). The FINAL-CLOSE-PROPOSITION-MISMATCH resolution of the harvested
  valvular-disease-to-osteoarthritis proposition is not reasserted and no
  osteoarthritis edge is authored.
- `hemangioma` -> `congestive-heart-failure` (ASSOCIATION_ONLY, THROMBOTIC_OR_VASCULAR
  mirroring the arteriovenous-fistula high-output window: Srinivas 2025 PMID 41116821
  congenital hepatic hemangioma with high-output failure and severe pulmonary
  hypertension, Ateeqi 2026 PMID 42499732 infantile hepatic hemangioma with cardiac
  failure improving under propranolol).
- `hemangioma` -> `hypothyroidism` (ASSOCIATION_ONLY, METABOLIC_OR_NUTRITIONAL:
  Larbi Ouassou 2026 PMID 42232014 and Corsello 2025 PMID 40597219 diffuse infantile
  hepatic hemangiomatosis with consumptive hypothyroidism via tumoral type-3
  deiodinase).
- `hemipelvectomy` -> `phantom-limb-pain` (ASSOCIATION_ONLY, NEUROLOGICAL_DEGENERATION
  following the six existing per-site limb-loss edges: Grimer 2013 PMID 23307686
  157 hindquarter amputations with phantom pain a significant problem, plus the
  reused Diers 2022 survey as the family-level anchor).

Screens recorded for this batch: no hearing-loss-to-tinnitus edge (conductive-hearing-loss
already owns that sibling window and single-lesion shared-driver adjacency applies); no
ototoxic edge authored from hearing loss (that direction runs from the medication or
oncologic exposure into hearing loss); no heart-block-to-cardiac-arrhythmia edge
(constitutive identity-is-a-member barrier); no heart-block-to-sleep-apnea edge (the
located literature runs sleep-disordered breathing to nocturnal bradyarrhythmia, the
reverse arrow); no hemangioma-to-thrombocytopenia edge (Kasabach-Merritt phenomenon is
attributed to kaposiform hemangioendothelioma and tufted angioma, an entity mismatch
against the generic hemangioma identity); no hemipelvectomy-to-depressive-disorder edge
(the published amputation container identity owns the generic post-amputation mood
window and no hemipelvectomy-specific directional data were located, with the Werenski
2026 recovery and satisfaction cohort screened and not used); the sibling amputation
identities (hip-disarticulation, knee-disarticulation, amputation-of-thumb-fingers-toes,
shoulder-disarticulation, wrist-disarticulation) keep their own unbacklogged windows.

### Batch 44 (2026-09-24) — hemorrhoids, hemothorax, hepatic-steatosis, heterotopic-ossification, hill-sachs-lesion

Authored 6 new pending-verification relationships across 5 identities over 12 clinical
reference uses (12 unique PMIDs, all NCBI-verified via efetch before file authoring,
fourteenth consecutive clean cycle; no verified-source reuse and no cross-edge sharing,
so the debt ratchet advances by 12 pending-verification uses):

- `hemorrhoids` -> `anemia` (ASSOCIATION_ONLY, THROMBOTIC_OR_VASCULAR: vascular-cushion
  bleeding-to-depletion pathway - Deng 2024 PMID 38704632 retrospective 128-patient
  hemorrhoidal severe-anemia series quantifying preoperative transfusion requirement and
  hospitalization burden, Dong 2025 PMID 41064030 mixed hemorrhoids with severe anemia
  managed by sclerotherapy; no matched-cohort incidence data and multifactorial-anemia
  guard).
- `hemothorax` -> `anemia` (ASSOCIATION_ONLY, THROMBOTIC_OR_VASCULAR: intrathoracic
  hemorrhage-to-depletion pathway - Heller 2026 PMID 40812400 multicenter pediatric
  trauma analysis of hemothorax volume thresholds for chest-tube placement, Morgan 2015
  PMID 26448354 spontaneous-hemothorax clinical review; the retained-hemothorax
  fibrothorax/empyema literature was screened against absent identities).
- `hepatic-steatosis` -> `cirrhosis-of-the-liver` (DIRECT_CAUSATION/PROBABLE,
  METABOLIC_OR_NUTRITIONAL: fatty-injury-to-fibrosis-to-cirrhosis natural history -
  Barritt 2026 PMID 42690133 systematic review and 32-study meta-analysis of histologic
  liver fibrosis in steatotic liver disease showing rising cirrhosis and
  major-adverse-liver-outcome risk by fibrosis stage, Wang 2026 PMID 42481370 MASLD
  non-invasive-test meta-analysis; the chronic-liver-disease umbrella edge is held
  non-duplicative because that identity's own pathway notes require the specific
  etiology to be documented rather than relying on the umbrella label).
- `hepatic-steatosis` -> `liver-cancer` (ASSOCIATION_ONLY, MALIGNANT_TRANSFORMATION:
  Yin 2024 PMID 39269862 12-cohort meta-analysis of 738,934 NAFLD patients with 1,480
  hepatocellular-carcinoma cases reporting within-population hazard ratios (age 1.81,
  male sex 2.51, hypertension 1.87, diabetes 2.27), Wallace 2026 PMID 42605247
  comparative cause-level liver-cancer risk meta-analysis; relative-risk-only evidence
  with fibrosis-stage and diabetes mediation guard keeps the proposition
  association-only).
- `heterotopic-ossification` -> `peripheral-neuropathy` (ASSOCIATION_ONLY,
  MECHANICAL_OR_COMPRESSIVE: perineural-compression pathway - Akhavan 2023
  PMID 36534099 heterotopic ossification with circumferential ulnar-nerve encasement at
  the elbow and electrodiagnostic confirmation, Daskalakis 2022 PMID 35368721 elbow
  heterotopic ossification presenting as median-nerve neuropathy after distal biceps
  repair; the harvested heterotopic-ossification-to-osteoarthritis proposition stays
  FINAL-CLOSED and is not reasserted).
- `hill-sachs-lesion` -> `post-traumatic-osteoarthritis` (ASSOCIATION_ONLY,
  BIOMECHANICAL_ALTERATION: humeral-head-impaction-and-chondral-injury pathway -
  Luengo-Alonso 2024 PMID 39348905 arthroscopic 140-shoulder instability cohort
  reporting Hill-Sachs lesions among the most common findings with osteoarthritis
  severity correlating with age, age at first dislocation, and dislocation number,
  Saxena 2016 PMID 27466221 T1rho MRI cartilage damage after primary shoulder
  dislocation; the humeral-side window is distinct from the sibling bankart-lesion
  glenoid-labral window).

Screens recorded for this batch: no hemorrhoids-to-epicondylitis edge (master-resolution
FINAL-CLOSE-PROPOSITION-MISMATCH stays in force); no iron-deficiency-anemia,
gastrointestinal-hemorrhage, portal-hypertension, or esophageal-varices edge (identities
absent from the catalog); no hemorrhoids-to-varicose-veins edge (shared venous-dilatation
driver, zero directional record); no hemothorax-to-pleural-effusion edge (retained
hemothorax is a blood collection rather than a pleural effusion, and the fibrothorax and
empyema complication identities are absent); no hepatic-steatosis-to-diabetes-mellitus or
obesity edge (shared metabolic driver and absent identity); no heterotopic-ossification-to-
osteoarthritis edge (prior closure) and no direction-inverted burn or traumatic-brain-
injury edge; no hill-sachs-lesion-to-instability edge (absent identity) and no
rotator-cuff or axillary-nerve direction data located.

Registry after lockstep: 552 relationships (478 explicit / 74 legacy), 888 reference
uses (381 verified / 507 pending-verification), 816 source entities (346 active / 461
pending-verification). Citation packet regenerated at 189 worksheets / 507 reference rows
= live citation debt. Backlog after batch 44: **329** undispositioned zero-edge drafts.
Next-five: `hip-disarticulation`, `hip-labral-tear`, `hip-strain`, `histoplasmosis`,
`hydrocephalus`. Standing recommendation unchanged: land the accumulated uncommitted
batches (35-44) through CI in one PR, as with PR #469 for batches 1-34.

### Batch 45 (2026-09-24) — hip-disarticulation, hip-labral-tear, hip-strain, histoplasmosis, hydrocephalus

Authored 3 new pending-verification relationships across 3 identities over 6 clinical
reference uses (6 PMIDs, all NCBI-verified via efetch before file authoring, fifteenth
consecutive clean cycle; one use is a verified-source reuse of the already human-verified
Kelle 2017 level-stratified phantom-limb study, carried verified:true per the
elbow-disarticulation and hemipelvectomy family precedent, so 5 new source entities and the
debt ratchet advances by 5 pending-verification uses), plus 2 deferrals:

- `hip-disarticulation` -> `phantom-limb-pain` (ASSOCIATION_ONLY, NEUROLOGICAL_DEGENERATION
  matching the amputation-level phantom-limb family: the Kelle 2017 cross-sectional study of
  101 lower-limb amputees stratified by level reports the highest early phantom-limb-pain
  scores in the most proximal group - hip disarticulation through knee disarticulation - and
  the Steritz 2024 case report describes refractory phantom limb pain in a hip disarticulation
  patient; competing residual-limb, stump, neuroma, and pre-amputation pain sources guard).
- `hip-labral-tear` -> `post-traumatic-osteoarthritis` (ASSOCIATION_ONLY, BIOMECHANICAL_ALTERATION
  matching the shoulder bankart-lesion and hill-sachs-lesion precedent: the Dean 2024
  minimum-eight-year hip-arthroscopy cohort associates chondrolabral junction breakdown with
  conversion to total hip arthroplasty after treatment of symptomatic labral tears, and the
  Martin 2024 randomized trial of labral-tear treatment reports arthroplasty conversion among
  its outcomes; composite-endpoint, reverse-direction, and age/morphology-confounding guards).
- `hydrocephalus` -> `visual-impairment` (ASSOCIATION_ONLY, MECHANICAL_OR_COMPRESSIVE: the Lee
  2017 pediatric study of 46 children with hydrocephalus reports papilledema in 27 with a
  strong association to higher intracranial pressure, and the AlObaisi 2022 record review of
  shunted children documents ocular-motility abnormalities and reduced visual outcomes;
  incomplete-penetrance and competing-ocular-disease guards).
- `hip-strain` **deferred** (zero-record): bibliographic searches for hip-strain-primary
  outcomes (hip muscle, flexor/iliopsoas, adductor, and gluteal strain paired with chronic
  pain, osteoarthritis, or long-term outcome terms) returned no condition-specific cohort or
  series, the nearest literature concerns pubalgia, groin, iliotibial-band, piriformis, and
  hamstring conditions in other populations, and the harvested hip-strain-to-diabetes
  proposition was already FINAL-CLOSED; the sibling ankle-strain and cervical-strain mechanisms
  do not transfer.
- `histoplasmosis` **deferred** (RESOLVED-PRIOR-SITE-SPECIFIC-TAXONOMY): the adrenal window is
  owned by the separately approved and verified adrenal-histoplasmosis identity, and the
  pulmonary identity cannot enforce the adrenal-complication restriction because the intake
  does not encode disease site; the recognized pulmonary complications (fibrosing
  mediastinitis, mediastinal granuloma, broncholithiasis) have no catalog identities.

Screens recorded for this batch: no hydrocephalus-to-cognitive-disorder edge authored - the
strongest located cognition evidence is idiopathic-normal-pressure-hydrocephalus-specific and
would be an entity mismatch against the generic raised-pressure identity, and the catalog
carries a distinct normal-pressure-hydrocephalus identity queued to author its own
NPH-specific neurocognitive windows, so a generic-hydrocephalus cognitive edge would create a
parallel pathway for the same patient (reopen only if hydrocephalus-general neurodevelopmental
evidence accrues or governance merges the NPH subtype); no hip-labral-tear-to-abdominal-hernia
edge (harvested proposition FINAL-CLOSED); no hip-labral-tear-to-generic-osteoarthritis edge
(the femoroacetabular-impingement and acl/pcl-injury windows already route there, so the
labral window stays on the post-traumatic target); no hip-disarticulation-to-depressive-disorder
edge (the amputation-or-loss-of-use container owns the generic mood window); no
hydrocephalus-to-headache, seizure, gait, or shunt-complication edge (absent or zero-record
identities).

Registry after lockstep: 555 relationships (481 explicit / 74 legacy), 894 reference uses (382
verified / 512 pending-verification), 821 source entities (346 active / 466 pending-verification).
Citation packet regenerated at 192 worksheets / 512 reference rows = live citation debt.
Backlog after batch 45: **324** undispositioned zero-edge drafts. Next-five: `hyperhidrosis`,
`hyperinsulinism`, `hyperopia`, `hyperpigmentation`, `hypertensive-retinopathy`. Standing
recommendation unchanged: land the accumulated uncommitted batches (35-45) through CI in one PR,
as with PR #469 for batches 1-34.

---

Mapping Expansion D1 batch 46 (2026-09-24) authored four draft-quarantined relationships across
four identities and recorded one deferral. `hyperinsulinism -> hypoglycemia` (rank 1) is the
batch's only direct-causation edge: DIRECT_CAUSATION with etiologicalConsensus PROBABLE,
vaNexusProbabilityAlignment AT_LEAST_AS_LIKELY_AS_NOT, hypothesizedOnly:false, and
mechanismCategory METABOLIC_OR_NUTRITIONAL - inappropriate beta-cell insulin secretion in the
presence of low plasma glucose suppresses hepatic glycogenolysis and gluconeogenesis, promotes
insulin-sensitive tissue uptake, and suppresses lipolysis, ketogenesis, and counter-regulation,
so the low glucose is not offset by alternative fuel generation (Demirbilek 2017 congenital-
hyperinsulinism diagnosis and treatment update, PMID 29280746; Giri 2021 congenital-
hyperinsulinism update, PMID 34547194). Individual claims still require documented
hyperinsulinism (insulin/glucose or C-peptide findings, genetics, or histopathology),
hypoglycaemia documentation with a compatible insulin profile, chronology, and exclusion of
insulinoma, factitious or sulfonylurea exposure, and counter-regulatory failure.
`hyperhidrosis -> anxiety-disorder` (rank 1) is association-only (NOT_ESTABLISHED,
NOT_ASSERTED, hypothesizedOnly:true, PSYCHOPHYSIOLOGICAL): the Bahar 2016 study of 2017
consecutive dermatology outpatients found anxiety in 21.3% of hyperhidrosis patients versus 7.5%
of patients without hyperhidrosis (p<0.001) in a severity-dependent pattern that persisted on
multivariable analysis, and the Kamikava 2021 observational study evaluated anxiety symptoms in
81 primary-hyperhidrosis patients before and after oxybutynin treatment (PMIDs 27567033,
34190853). `hyperopia -> glaucoma` (rank 1) is association-only (MECHANICAL_OR_COMPRESSIVE): the
Martinez-Blanco 2021 Colombian Glaucoma Study of 1749 patients identified high hyperopia as an
independent factor related to the primary angle-closure disease spectrum, and the Zhang 2015
choroidal-physiology review records the shallow-anterior-chamber, short-axial-length, thicker-
lens configuration (PMIDs 34796746, 26164737). `hypertensive-retinopathy -> visual-impairment`
(rank 1) is association-only (MICROVASCULAR_METABOLIC): the Bhargava 2012 review documents
retinal arteriolar narrowing, arteriovenous nicking, haemorrhages, microaneurysms, and in severe
cases optic-disc and macular edema, and the Cortina 2015 case report documents acute bilateral
loss of central visual acuity from hypertensive retinopathy level IV in unrecognized malignant
hypertension (PMIDs 21509040, 25868960). Every new reference remains `verified: false` and
pending qualified-human citation verification under `docs/citation-verification-sop.md`; no edge
is raised to causation or aggravation without that review.

- `hyperpigmentation` **deferred** (MANIFESTATION-IDENTITY / ENTITY-MISMATCH): the catalog
  identity is a generic dermatologic sign rather than a defined disease, and the located
  literature concerns defined pigmentary or exposure-specific entities (melasma quality-of-life
  and treatment cohorts, imipramine-induced hyperpigmentation, disease-site pigmentation), so
  applying those results to the generic identity would be an entity mismatch; the nearest
  catalog-fit psychosocial targets (depressive-disorder, anxiety-disorder) are each already
  served by their own disease-specific primaries. Revisit only if a cohort or series of a generic
  hyperpigmentation identity accrues, or if governance redefines the identity around a specific
  pigmentary disorder.

Screens recorded for this batch: no hyperhidrosis-to-depressive-disorder edge - the harvested
proposition (PMID 28881483) remains closed under FINAL-CLOSE-PROPOSITION-MISMATCH with no
approved targets, and only the anxiety window was authored on its own condition-specific
evidence (prior-closure guard); no hyperhidrosis-to-social-anxiety-disorder edge (the located
studies measure general anxiety symptoms, so a social-anxiety window would create a parallel
pathway); no hyperhidrosis-to-fungal-skin-infection or cellulitis edge (quality-of-life and
psychiatric literature rather than maceration-driven infection with denominators; zero-record
guard); no hyperinsulinism-to-diabetes-mellitus, hyperglycaemia, or insulin-resistance-syndrome
edge (direction and duplicate-scope guards - hyperinsulinism produces hypoglycaemia, and the
sibling insulin-resistance-syndrome identity authors its own diabetes-mellitus-type-2 window); no
hyperinsulinism-to-cognitive-disorder or seizure-disorder edge (hypoglycaemia is the intermediate
node and the cognition and seizure windows belong to their own primaries - intermediate-chain
guard); no hyperopia-to-visual-impairment edge (the consequences flow through the glaucoma
intermediate, and the refractive-error-to-visual-impairment proposition would need its own
corrected/unimpaired-acuity framing); no hyperopia-to-retinal-detachment edge (myopic rather than
hyperopic eyes carry the risk - direction-inversion guard); no hyperopia-to-cataract edge
(age-confounded association with no refraction-primary condition-specific data - zero-record
guard); no hypertensive-retinopathy-to-blindness edge (severe visual loss is documented but not
incident blindness - zero-record guard); no hypertensive-retinopathy-to-retinal-detachment edge
(the diabetic-retinopathy identity authors the detachment window); and no
hypertensive-retinopathy-to-stroke, ischemic-heart-disease, congestive-heart-failure, or
chronic-kidney-disease edge (those complications flow from hypertension rather than from the
retinopathy, and the hypertension identity authors them directly - direction and duplicate-scope
guards).

Registry after lockstep: 559 relationships (485 explicit / 74 legacy), 902 reference uses (382
verified / 520 pending-verification), 829 source entities (346 active / 474 pending-verification).
Citation packet regenerated at 196 worksheets / 520 reference rows = live citation debt. Backlog
after batch 46: **320** undispositioned zero-edge drafts. Next-five: `hypoglycemia`,
`hypopigmentation`, `hypopituitarism`, `hypotension`, `ichthyosis`. Standing recommendation
unchanged: land the accumulated uncommitted batches (35-46) through CI in one PR, as with PR #469
for batches 1-34.

---

Mapping Expansion D1 batch 47 (2026-09-24) authored six draft-quarantined association edges across
four identities and recorded one deferral, continuing the walked alphabet at `hypo-`/`i-`. Every
new edge is ASSOCIATION_ONLY with etiologicalConsensus NOT_ESTABLISHED, vaNexusProbabilityAlignment
NOT_ASSERTED, and hypothesizedOnly:true; the twelve new sources are unique (no reuse, no sharing)
and all remain `verified: false` pending qualified-human citation verification under
`docs/citation-verification-sop.md`.

`hypoglycemia -> dementia` (rank 1, METABOLIC_OR_NUTRITIONAL) rests on the Huang 2022 systematic
review and meta-analysis of ten cohort studies and 1,407,643 patients (pooled adjusted hazard
ratio 1.44, 95% CI 1.26-1.65, stable on subgroup and leave-one-out analysis; PMID 35164844) and on
the Han 2022 nationwide cohort of 2,032,689 participants (dementia in 23.3% with severe
hypoglycaemia versus 7.3% without, rising from HR 1.54 for one episode to 1.80 for two or more,
with the highest mortality in those carrying both exposures; PMID 35015886). `hypoglycemia ->
seizure-disorder` (rank 2, METABOLIC_OR_NUTRITIONAL) rests on the Blaabjerg 2016 review of
hypoglycaemia-induced electroencephalographic change, which places seizures among the graded
manifestations of neuroglycopenia (PMID 27464753), and on the Falip 2014 consecutive cohort of 229
adult-onset type 1 diabetes patients, in which hypoglycaemic seizures occurred in 2 patients
(0.87%) and were separated from temporal lobe epilepsy by lower anti-GAD antibody titres (18.42
versus 29.200 IU, p=0.006; PMID 25183236). Both hypoglycaemia windows are authored from the
intermediate node that batch 46 explicitly left to this identity when it published
`hyperinsulinism -> hypoglycemia`, so the pathway is counted once.

`hypopituitarism -> osteopenia` (rank 1, NEUROENDOCRINE_CASCADE) rests on the Chihaoui 2016 study
of bone mineral density in Sheehan's syndrome, which states that hypopituitarism is a known cause
of bone mineral loss and reports the frequency of low bone mass with associated factors (PMID
26993664), and on the Akirov 2024 review of hypopituitarism and bone disease, which names
osteopenia among the skeletal consequences of pituitary hormone deficiency (PMID 38709467).
`hypopituitarism -> anemia` (rank 2, METABOLIC_OR_NUTRITIONAL) rests on the Nishioka 2005
retrospective study of 68 patients with anterior pituitary deficiency, in which haemoglobin was
significantly lower (p=0.0012), haemoglobin below 12.0 g/dl occurred in 22 patients (32.4%), the
reduction related to hypocortisolism and hypothyroidism, and replacement improved haemoglobin
(PMID 16117194), and on the Aguiar 2025 pituitary adenoma cohort reporting anaemia prevalence and
its correlation with hypopituitarism (PMID 40621322).

`hypotension -> visual-impairment` (rank 1, MICROVASCULAR_METABOLIC) rests on the Donaldson 2022
case series and review of dialysis-associated non-arteritic anterior ischaemic optic neuropathy,
which describes the condition as secondary to intradialytic hypotension and reports three cases
with catastrophic visual consequences and same-eye recurrence (PMID 34974487), and on the Desai
2005 review listing nocturnal hypotension among the risk factors for a disorder presenting as
sudden painless visual loss (PMID 15722660). `ichthyosis -> dry-eye-syndrome` (rank 1,
MECHANICAL_OR_COMPRESSIVE) rests on the Palamar 2015 lamellar-ichthyosis cohort of twelve
patients, in which mean tear break-up time was 6.58 seconds in both eyes with ocular surface
staining grades of 0.36 and 0.39 and preserved mean Schirmer 1 production of 18.75 mm, concluding
that eyelid malformations with decreased tear break-up time might cause sight-threatening
complications (PMID 24397709), and on the Al-Amry 2016 series of eleven ichthyosis patients in
which bilateral ectropion was the most common ocular diagnosis and most patients required skin
grafting (PMID 26949357).

- `hypopigmentation` **deferred** (MANIFESTATION-IDENTITY / ENTITY-MISMATCH): the catalog identity
  is a generic cutaneous sign rather than a defined disease and the located literature is
  vitiligo-, post-inflammatory-, drug-, and disease-site-specific, so those results would be an
  entity mismatch and would also duplicate the catalog's dedicated vitiligo identity, which
  already authors its own depressive-disorder window; this mirrors the batch-46 hyperpigmentation
  deferral so the two generic pigmentary-sign identities are treated consistently. Revisit only if
  a generic-hypopigmentation-primary cohort with a catalog-fit outcome accrues, or if governance
  narrows the identity to a specific pigmentary disorder.

Screens recorded for this batch: no `hypoglycemia -> cognitive-disorder` edge (the located outcome
is incident dementia, and routing the same studies to the broader umbrella would double-count the
pathway - target-specificity guard); no epilepsy edge (the located evidence documents provoked
acute symptomatic seizures, and the catalog's separate epilepsy identity excludes exactly that
population by its own boundary); no `hypopituitarism -> osteoporosis` edge (the condition-specific
measurement is low bone mass, and the established hypogonadism-to-osteoporosis window owns the
gonadal-mechanism route while the pituitary literature's bone-quality-over-quantity pattern argues
against a pure BMD residual framing); no edge to hypothyroidism, hypogonadism, adrenal-
insufficiency, or diabetes-insipidus (those are the defining hormone-deficiency components of
hypopituitarism, so an edge would restate the identity - constitutive-axis guard); no dizziness,
syncope, falls, or orthostatic edge from hypotension (the orthostatic-specific literature belongs
to the catalog's distinct orthostatic-hypotension identity, which is queued to author its own
symptomatic windows, and a hypotension-to-vasovagal-syncope edge would invert the direction); no
blindness, optic-atrophy, or other optic-neuropathy edge from hypotension (zero-record and
target-specificity guards); no `ichthyosis -> visual-impairment` or `-> corneal-scarring` edge (the
condition-specific series records an excellent visual prognosis with timely eyelid surgery and
perforation in only two of eleven patients); no `ichthyosis -> hearing-loss` edge (the located
deafness evidence is specific to the separate keratitis-ichthyosis-deafness syndrome); and no
`ichthyosis -> cellulitis`/`-> impetigo` edge (barrier failure is plausible but no ichthyosis-
specific infection denominators were located - zero-record guard).

Registry after lockstep: 565 relationships (491 explicit / 74 legacy), 914 reference uses (382
verified / 532 pending-verification), 841 source entities (346 active / 486 pending-verification).
Citation packet regenerated at 202 worksheets / 532 reference rows = live citation debt. Backlog
after batch 47: **314** undispositioned zero-edge drafts, and the walked window
(`hemangioma` .. `ichthyosis`) verifies empty of unprocessed identities. Next-five:
`iliohypogastric-ilioinguinal-nerve-neuralgia`, `impetigo`, `inappropriate-sinus-tachycardia`,
`insulinoma`, `interosseous-muscle-atrophy`. Standing recommendation unchanged: land the
accumulated uncommitted batches (35-47) through CI in one PR, as with PR #469 for batches 1-34.

---

Mapping Expansion D1 batch 48 (2026-09-24) authored four draft-quarantined relationships across four
identities and recorded one deferral, continuing the walked alphabet at `i-`. Eight unique PMIDs
were used (no reuse, no sharing) and every new reference remains `verified: false` pending
qualified-human citation verification under `docs/citation-verification-sop.md`.

`iliohypogastric-ilioinguinal-nerve-neuralgia -> unexplained-chronic-pain` (rank 1) is
ASSOCIATION_ONLY with mechanismCategory MECHANICAL_OR_COMPRESSIVE: the Thomassen 2013 series of 43
patients treated with ilioinguinal/iliohypogastric nerve blocks for chronic inguinal
post-herniorrhaphy pain reported that 21 of 38 respondents (55.3%) no longer had DN4-defined
neuropathic pain and concluded the blocks can be effective before more invasive procedures (PMID
23015156), and the Deepika 2026 prospective study of 31 patients per arm reports chronic
postoperative discomfort in 0.7-36.7% of open hernioplasty patients, enumerates ilioinguinal
injury mechanisms (suture entrapment, partial division, crushing, diathermy), and finds that
prophylactic neurectomy reduced persistent pain to six months (PMID 40452294). The Hsu 2012
meta-analysis of six randomized trials with 1,286 patients, which found no reduction in chronic
groin pain with nerve division while division increased sensory loss (PMID 22644622), is recorded
as screened counter-evidence and is why the mechanism is not asserted at causation strength.

`impetigo -> nephritis` (rank 1) publishes as DIRECT_CAUSATION with etiologicalConsensus PROBABLE,
vaNexusProbabilityAlignment AT_LEAST_AS_LIKELY_AS_NOT, hypothesizedOnly:false, and
mechanismCategory IMMUNE_MEDIATED (nephritogenic group A streptococcal infection with immune-
complex deposition in the glomerulus), mirroring the existing goodpasture-syndrome and
granulomatosis-with-polyangiitis direct-causation windows onto chronic-kidney-disease: the Stevens
and Bryant streptococcal reference chapter states that impetigo can result in post-streptococcal
acute glomerulonephritis (PMID 36479753) and the Ilyas and Tolaymat comparative paediatric cohort
documents antecedent pyoderma in 66% of earlier cases before the epidemiological shift to
pharyngitis-associated disease (PMID 18373105). The target is the acute nephritis identity rather
than chronic-kidney-disease, which remains the downstream window of the nephritis node.

`inappropriate-sinus-tachycardia -> dizziness` (rank 1) is ASSOCIATION_ONLY with
mechanismCategory MULTIFACTORIAL on two review-level syndrome descriptions: the JACC 2022 review
topic of the week records that the most common symptom is palpitations but that the syndrome can
be accompanied by anxiety, dizziness, presyncope, and syncope, with pathogenesis considered
multifactorial and autonomic dysfunction central and diagnosis by exclusion (PMID 35710196), and
the Ruzieh 2018 review defines the syndrome as an inexplicable resting sinus rate above one
hundred beats per minute with symptoms such as palpitations, dyspnoea, or dizziness and enumerates
the secondary causes the diagnosis must exclude (PMID 29189171). The Shabtaie 2020 Mayo cohort of
305 patients (stable ejection fraction, no cardiomyopathy, and no excess mortality versus
atrioventricular nodal reentry tachycardia controls; depression in 25.6% and anxiety in 24.6% as
comorbidities only) is recorded as a negative-cohort screen, which is why no cardiomyopathy,
congestive-heart-failure, cardiac-arrhythmia, or psychiatric edge is authored from this identity.

`insulinoma -> hyperinsulinism` (rank 1) publishes as DIRECT_CAUSATION with etiologicalConsensus
PROBABLE, vaNexusProbabilityAlignment AT_LEAST_AS_LIKELY_AS_NOT, hypothesizedOnly:false, and
mechanismCategory NEUROENDOCRINE_CASCADE (autonomous beta-cell insulin secretion uncoupled from
glucose), matching the existing glucagonoma-to-diabetes-mellitus window: the Arya 2014 review
states that insulin secretion becomes unregulated so that it persists despite low blood glucose and
records that in adults an insulinoma is the commonest cause of hyperinsulinaemic hypoglycaemia
(PMID 24557504), and the Shah 2017 Lancet review states that insulin secretion becomes dysregulated
and uncoupled from glucose metabolism and that in adults the disorder can be due to beta-cell
tumours (insulinomas) or beta-cell hyperplasia (PMID 27915035). The direct target is the immediate
functional node rather than hypoglycaemia, because the hyperinsulinism identity already authors the
hypoglycaemia window (with dementia and seizure-disorder downstream of it) and a direct edge would
skip and double-count that pathway.

- `interosseous-muscle-atrophy` **deferred** (MANIFESTATION-IDENTITY / DIRECTION-INVERSION): the
  catalogue identity is a site-specific denervating finding rather than a disease, and the located
  literature documents it as a sign of an upstream nerve lesion (a QJM clinical-image record, and
  ultrasound/nerve-transfer, mid-palm ganglion-cyst, and neuralgic-amyotrophy series in which the
  atrophy follows the nerve injury), so an outgoing edge would invert the direction of the located
  evidence; the only catalog-fit outward target is the muscle-atrophy umbrella this identity
  instantiates, and no condition-specific evidence quantifying a downstream catalogue outcome in
  patients identified by interosseous atrophy was located. The sibling finding identity
  thenar-hypotenar-atrophy is queued under the same manifest-identity treatment. Reopening
  condition: a series in which interosseous atrophy is the index finding with a catalog-fit
  secondary outcome, or a governance decision folding this identity into the nerve lesions that
  produce it.

Screens recorded for this batch: no `impetigo -> cellulitis`/`abscesses` edge (the located
reference work classifies impetigo, erysipelas, and cellulitis as depth-defined syndromes of the
same organism rather than documenting impetigo progression, and no condition-specific progression
denominators were located); no `impetigo -> chronic-kidney-disease` edge (that progression belongs
to the nephritis node - intermediate-chain guard); no acute-rheumatic-fever, scarlet-fever, or
guttate-psoriasis edge (absent identities or non-impetigo-primary evidence); no
`inappropriate-sinus-tachycardia -> cardiac-arrhythmia` edge (the identity is itself a sinus
arrhythmia - constitutive/umbrella guard); no `inappropriate-sinus-tachycardia -> syncope`,
`presyncope`, or postural-tachycardia edge (no syncope identity, and the postural and reflex
mechanisms belong to the distinct postural-orthostatic-tachycardia-syndrome and vasovagal-syncope
identities); no `insulinoma -> hypoglycemia`, `-> cognitive-disorder`, or `-> seizure-disorder`
edge (downstream of the hyperinsulinism node - intermediate-chain guard); no `insulinoma ->
diabetes-mellitus` edge (the located literature addresses hypoglycaemia and cure rather than
post-resection glycaemic outcomes - treatment-state and zero-record guards); no
`iliohypogastric-ilioinguinal -> chronic-pelvic-pain-syndrome` edge (wrong-identity guard, matching
the genitofemoral sibling); and no psychiatric, scars, or mesh-complication edge from the inguinal
neuralgia (zero-record and duplicate-scope guards).

Registry after lockstep: 569 relationships (495 explicit / 74 legacy), 922 reference uses (382
verified / 540 pending-verification), 849 source entities (346 active / 494 pending-verification).
Citation packet regenerated at 206 worksheets / 540 reference rows = live citation debt. Backlog
after batch 48: **309** undispositioned zero-edge drafts, and the walked window
(`ichthyosis` .. `interosseous-muscle-atrophy`) verifies empty of unprocessed identities.
Next-five: `intervertebral-disc-syndrome`, `intracranial-injury-without-skull-fracture`, `iritis`,
`jersey-finger`, `joint-replacement-residuals`.

Test-pin note (durable): the numeric sweep that advances current-state pins now collides with a
frozen historical helper value - `tests/helpers/master-2026-current.ts` pins
`master.conditionDispositions.length === 245`, a master-resolution artifact property unrelated to
the draft-singles counter, and the draft-singles pin itself now also reads 245. That file is
excluded from the sweep and its value must be treated as immutable; the same collision class
(number-means-two-things) is what the batch-45 audit first surfaced. Standing recommendation
unchanged: land the accumulated uncommitted batches (35-48) through CI in one PR, as with PR #469
for batches 1-34.

---

Mapping Expansion D1 batch 49 (2026-09-24) authored four draft-quarantined relationships across
two identities and recorded three deferrals. Both edges from
`intracranial-injury-without-skull-fracture` are DIRECT_CAUSATION with etiologicalConsensus
PROBABLE, vaNexusProbabilityAlignment AT_LEAST_AS_LIKELY_AS_NOT, and hypothesizedOnly:false, and
are the batch's only direct-causation pair. `intracranial-injury-without-skull-fracture -> epilepsy`
(rank 1, NEUROLOGICAL_DEGENERATION - post-traumatic epileptogenesis) rests on the Zhong 2025
systematic review and meta-analysis of 24 studies and 505,720 patients, which found a pooled
post-traumatic epilepsy prevalence of 9% (95% CI 8-11%), rising to 15% under International League
Against Epilepsy diagnostic criteria, 16% in severe injury, and 14% in early-seizure studies
(PMID 40835018), and on the Laing 2022 registry cohort of 15,152 adults with moderate to severe
traumatic brain injury in which early post-traumatic seizures occurred in 416 patients (2.7%),
including 27 with status epilepticus, and were associated with later post-traumatic epilepsy after
confounder adjustment (PMID 35188950). The target is the catalogue's `epilepsy` identity rather
than `seizure-disorder` because the located outcome is post-traumatic epilepsy meeting diagnostic
criteria, and that identity's boundary excludes acute symptomatic or provoked seizures.
`intracranial-injury-without-skull-fracture -> hypopituitarism` (rank 2, MULTIFACTORIAL -
heterogeneous vascular, mechanical, and neuroendocrine pathogenesis) rests on the Kalas 2023 review
recording that post-traumatic hypopituitarism prevalence has been significantly underestimated and
that unrecognized disease has negative socioeconomic and quality-of-life consequences
(PMID 36693336), and on the Zaben 2013 review recording that the hypophyseal vessels are
anatomically vulnerable to shearing injury and raised intracranial pressure with pituitary
ischaemia or haemorrhage a common autopsy finding (PMID 22779906); both edges plus the
`cerebral-contusion`, `subdural-hematoma`, and `diffuse-axonal-injury` precedents keep the
head-injury family's direct-causation conventions. Both edges from `joint-replacement-residuals`
are ASSOCIATION_ONLY (NOT_ESTABLISHED, NOT_ASSERTED, hypothesizedOnly:true):
`joint-replacement-residuals -> deep-vein-thrombosis` (rank 1, THROMBOTIC_OR_VASCULAR - surgical
venous stasis, endothelial injury, and postoperative hypercoagulability) rests on the Simon 2023
claims-database cohort of 29,264 hip and knee arthroplasty patients reporting a 30-day
post-discharge venous thromboembolism incidence of 1.19% (95% CI 1.06-1.32%) alongside 3.43%
bleeding (PMID 38039005), and on the Lieberman 2021 prophylaxis review recording that American
College of Chest Physicians guidelines recommend at least 10 to 14 days of thromboprophylaxis with
risk-stratified agent selection (PMID 34133395); `joint-replacement-residuals -> contractures`
(rank 2, POST_SURGICAL_OR_TREATMENT - post-arthroplasty scar-tissue formation and soft-tissue
contracture) rests on the Ries and Badalamente revision series of six total knee arthroplasties in
which no cause of stiffness was identified other than soft-tissue contracture and the arc of
motion improved from a mean 36 degrees to 86 degrees after revision (PMID 11064989), and on the
Bong and Di Cesare stiffness review setting out the mobilization, manipulation, lysis, and
revision algorithm (PMID 15161169). No edge was raised to causation: the thromboembolic cohort is a
claims-based prophylaxis-comparison study measured in patients already anticoagulated with residual
confounding, and the stiffness evidence is a small revision series plus a treatment review.

Three deferrals were recorded without relationships. `intervertebral-disc-syndrome` is deferred on
a prior closure plus a parallel-pathway screen: the harvested proposition remains FINAL-CLOSED
under FINAL-CLOSE-NO-SUPPORTED-SECONDARY, and the located literature is
degenerative-disc-disease-specific, which is the synonym/parallel pathway for the same
disc-degeneration patient, so a generic syndrome window would double-count that route.
`iritis` is deferred as a synonym of anterior uveitis: the separately approved uveitis identity
already carries the glaucoma and cataract windows, so authoring them again on this identity would
create two catalogue entries for one clinical entity. `jersey-finger` is deferred as zero-record:
the located literature reports total active motion, QuickDASH, and Buck-Gramcko grades without a
catalog-fit secondary diagnosis, and the mallet-finger and gamekeeper's-thumb siblings do not
transfer their mechanisms.

Screens recorded for this batch: no `intracranial-injury-without-skull-fracture ->
cardiac-arrhythmia` edge (the harvested proposition remains FINAL-CLOSED under
FINAL-CLOSE-PROPOSITION-MISMATCH and is not reasserted - prior-closure guard); no `->
seizure-disorder` edge alongside the epilepsy window (target-specificity guard against
double-counting one pathway); no `-> cognitive-disorder` edge (no condition-specific
post-traumatic cognitive cohort retrieved in this window - zero-record guard); no `->
cranial-nerve-palsy`, `anosmia`, or `visual-impairment` edge (zero-record and duplicate-scope
guards); no `-> subdural-hematoma`, `epidural-hematoma`, or `cerebral-contusion` edge (those are
distinct catalogue identities, not downstream consequences - wrong-target guard); no `->
osteopenia` or `anemia` edge (those windows belong to the `hypopituitarism` intermediate node -
intermediate-chain guard); and no `joint-replacement-residuals -> pulmonary-embolism` edge (the
`deep-vein-thrombosis` identity already authors that downstream window - intermediate-chain guard),
no nerve-palsy, prosthetic-infection, or osteomyelitis edge (zero-record and wrong-target guards),
no `-> unexplained-chronic-pain` edge (the located series measures range of motion rather than
persistent pain as a distinct outcome), no `-> heterotopic-ossification` edge (heterotopic bone was
an incidental finding in the stiffness series, not a quantified post-arthroplasty outcome), and no
psychosocial edge (zero-record guard).

Registry after lockstep: 573 relationships (499 explicit / 74 legacy), 930 reference uses (382
verified / 548 pending-verification), 857 source entities (346 active / 502 pending-verification).
Citation packet regenerated at 210 worksheets / 548 reference rows = live citation debt. Backlog
after batch 49: **304** undispositioned zero-edge drafts, and the walked window
(`interosseous-muscle-atrophy` .. `joint-replacement-residuals`) verifies empty of unprocessed
identities. Next-five: `kaposi-s-sarcoma`, `katayama-fever`, `keloids`, `keratitis`,
`kienbock-s-disease`. Standing recommendation unchanged: land the accumulated uncommitted batches
(35-49) through CI in one PR, as with PR #469 for batches 1-34.

---

Mapping Expansion D1 batch 50 (2026-09-24) authored six draft-quarantined relationships across
all five screened identities and recorded no deferrals: every identity was retained with at least
one window, so the screened-out propositions were recorded on the edges and below rather than as
deferred identities. All six edges are ASSOCIATION_ONLY with etiologicalConsensus NOT_ESTABLISHED,
vaNexusProbabilityAlignment NOT_ASSERTED, and hypothesizedOnly:true. `keratitis -> corneal-scarring`
(rank 1, INFECTIOUS_SPREAD) rests on a consecutive series of 63 eyes with corneal scarring due to
Acanthamoeba (20), bacterial (35), and fungal (8) keratitis in which total-cornea higher-order
aberrations exceeded normal controls (1.15 +/- 2.06, 0.91 +/- 0.88, and 1.39 +/- 1.46 versus
0.09 +/- 0.01 micrometre; all P < .001) with visual acuity correlating with anterior, posterior,
and total-cornea aberrations (PMID 28040524), and on a 55-eye penetrating-keratoplasty series for
herpes simplex keratitis scarring (42 quiescent scars, 13 descemetocele or perforation; 61.8%
reaching 0.6 logMAR or better) (PMID 28380101); the harvested keratitis-to-visual-impairment
proposition remains FINAL-CLOSED (PMID 37802392) and is not reasserted, and the adenoviral
subepithelial-infiltrate route stays with the conjunctivitis window. `kienbock-s-disease ->
osteoarthritis` (rank 1, BIOMECHANICAL_ALTERATION) rests on a scaphocapitate-arthrodesis series for
late-stage Kienbock disease reporting radiographic radioscaphoid arthritis often beyond ten years
of follow-up (PMID 23824220) and on a treatment review documenting stage-dependent progression from
limited lunate affection through progressive collapse of a non-reconstructable lunate to loss of
all functional wrist articulations (PMID 29549407); because the arthritis was measured in
surgically realigned wrists and no natural-history cohort exists, and because Kienbock's disease IS
lunate osteonecrosis (so the generic avascular-necrosis identity is the umbrella rather than a
downstream target), the edge is bounded accordingly. `kaposi-s-sarcoma -> lymphedema` (rank 1,
MALIGNANT_TRANSFORMATION) rests on a narrative review of HHV-8 lymphatic-endothelial tropism with
multicentric endothelial proliferation occluding the lymphatic lumen and producing chronic
lymphedema that tumour treatment barely reduces (PMID 38035924), a 65-patient classic-sarcoma
series in which 60% of stockings-treated patients had limb volume reduction while all 15 untreated
patients increased (PMID 16848816), and a lymphedema classification naming Kaposi sarcoma among the
major neoplastic causes of secondary lymphedema (PMID 12162199); `kaposi-s-sarcoma -> cellulitis`
(rank 2, INFECTIOUS_SPREAD) rests on a 39-patient series of HIV-related sarcoma with chronic
lower-limb lymphedema reporting cellulitis with 46.1% first-episode hospitalization, 35.8%
recurrence, and 25.3% mortality (PMID 34965797) and on a large-cohort microbiological study of
toe web intertrigo in sarcoma patients warning of progression to cellulitis and sepsis
(PMID 29150768); the cellulitis window is authored on the sarcoma primary because the lymphedema
identity is target-only and authors no windows, so the infection risk would otherwise be
uncaptured. `keloids -> depressive-disorder` (rank 1, PSYCHOPHYSIOLOGICAL) rests on a 202-patient
keloid survey reporting mean HADS scores of 9.82 (anxiety) and 7.96 (depression) with coping
tendencies mediating 38.58% of the social-support-to-depression relationship (PMID 41169494) and on
a comparative keloid survey reporting higher SCL-90 depression, anxiety, and interpersonal-sensitivity
scores than controls, greatest for visible lesions and in women (PMID 33841685). `katayama-fever ->
urticaria` (rank 1, IMMUNE_MEDIATED) rests on a same-source cohort of 34 patients with
simultaneously acquired acute schistosomiasis mansoni in which 16 developed angioedema and/or
urticaria about 30 days post-infection independently of worm burden and eosinophilia
(PMID 7487229) and on a travel-medicine review identifying acute schistosomiasis as the most
common parasitic cause of acute urticaria in travellers (PMID 39485933).

Screens recorded for this batch: no `keratitis -> visual-impairment`, `blindness`, or
`night-blindness` edge (the harvested proposition remains FINAL-CLOSED under
FINAL-CLOSE-PROPOSITION-MISMATCH - prior-closure guard, and no condition-specific blindness
quantification was located); no `kienbock-s-disease -> avascular-necrosis` edge (constitutive - the
identity IS lunate osteonecrosis), no `-> unexplained-chronic-pain` edge (the pain is
lesion-explained and the identity is reserved for unexplained presentations), no
`-> loss-of-use-of-extremities` edge (rating-framework container without condition-specific
evidence of extremity loss), and no `-> muscle-atrophy` or `-> carpal-tunnel-syndrome` edge
(zero-record and distinct-entity guards); no `keloids -> scars` edge (constitutive - a keloid is a
scar and the scars identity is the lesion's own rating view), no `keloids -> anxiety-disorder` edge
(the located anxiety signal tracks pain, income, self-efficacy, and coping style rather than the
lesion and is deferred pending independent evidence), no `keloids -> contractures` edge (the
located contracture literature is burn, congenital-naevus, and neuromuscular-specific -
zero-record), and no `keloids -> squamous-cell-carcinoma` edge (a single case report of carcinoma
in a keloid scar, PMID 31065195, against Marjolin evidence that concentrates in burn scars -
zero-record and magnitude guards); no `kaposi-s-sarcoma -> pulmonary`, `pleural-effusion`,
`pulmonary-hypertension`, or `anemia` edge (zero-record for discrete secondary diagnoses, and the
reverse relationship in which sarcoma arises within chronic post-mastectomy lymphedema (PMID
26264753) means direction is not asserted on the lymphedema edge); and no `katayama-fever ->
pulmonary-hypertension`, `anemia`, or `malnutrition-residuals` edge (the located schistosomiasis
literature for those outcomes concerns chronic hepatosplenic disease rather than the acute
Katayama phase - disease-stage guard) and no `-> tropical-pulmonary-eosinophilia` or
`-> eosinophilic-gastroenteritis` edge (those are distinct disease identities with their own
aetiologies - wrong-target guard).

Registry after lockstep: 579 relationships (505 explicit / 74 legacy), 943 reference uses (382
verified / 561 pending-verification), 938 clinical / 5 legal uses, 870 source entities (346 active /
515 pending-verification). Citation packet regenerated at 216 worksheets / 561 reference rows =
live citation debt. Backlog after batch 50: **299** undispositioned zero-edge drafts (304 minus the
five processed identities, none of which was deferred), and the walked window (`kaposi-s-sarcoma` ..
`kienbock-s-disease`) verifies empty of unprocessed identities. Next-five: `knee-disarticulation`,
`labyrinthitis`, `laryngeal-stenosis`, `laryngitis`, `laryngocele`.

Test-pin note (durable, extended): the sweep now excludes exactly one frozen file,
`tests/helpers/master-2026-current.ts`, which pins master-resolution artifact properties
(`conditionDispositions.length === 245`, `=== 236` unverified baseline refs) that are unrelated to
the live registry counters; its similarly named sibling
`tests/helpers/master-resolution-2026-current.ts` does hold live counter pins (refs, unverified,
clinical) and must be swept. This batch also hit a genuine second collision class for the first
time - an HTTP-status list (`[425, 429, 500, 502, 503, 504]` in the citation-decay probe resilience
test) where `502` means "Bad Gateway" rather than the pending-verification source count - so the
sweep rule is now line-scoped: any line carrying a transport-status list (425/429) is skipped and
verified afterwards as an intentional residue. The draft-singles counter (draft files carrying
exactly one suggestion), which is pinned in twelve of the ME-wave test files and is not a registry
field, advanced 249 -> 253 because four of this batch's five identities hold a single edge (Kaposi
sarcoma holds two, so it is not a single); that counter lives outside both audit scripts and so must
be added to the sweep map explicitly each time a single-edge identity is authored. Standing recommendation unchanged: land the
accumulated uncommitted batches (35-50) through CI in one PR, as with PR #469 for batches 1-34.
