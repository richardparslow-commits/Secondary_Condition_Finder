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

## Causal Relational Graph (CRG) Migration Strategy

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
