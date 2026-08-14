# Condition Catalog Expansion Roadmap

Status: active catalog-expansion plan
Baseline: 193 catalog conditions at `c24b45800b2fd936d0b1721cad5bfb54c4bf15e0`
Target v2: 300 catalog conditions

## Purpose

This roadmap expands the user-facing condition catalog in controlled, reviewable batches without weakening the repository's medical-evidence or citation safeguards. The target is a versioned product-coverage goal, not a claim that 300 conditions exhaust medicine or the VA rating schedule.

The comparison backbone is the current 38 CFR Part 4 rating schedule, including Appendix C's alphabetical index, together with VA's public Disability Benefits Questionnaires (DBQ) inventory. Those sources establish condition/rating identity and exam groupings. They do **not** establish secondary medical causation or aggravation.

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
| Waves 4-7 planned | +54 |
| Target catalog v2 | 300 |

The candidate list deliberately consolidates obvious synonyms and avoids creating separate user-facing entries for every residual, laterality variant, or diagnostic-code phrasing. Laterality should eventually be modeled as an attribute rather than by multiplying diagnoses.

## Wave 1 — musculoskeletal and neurological (20) — implemented

These are the highest-density expansion areas because the VA DBQ inventory and Part 4 rating schedule contain many distinct joint, bone, peripheral-nerve, and central-neurological diagnoses that were not represented by stable catalog identities at the 193-condition baseline.

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

Wave 2 deepens joint, ligament, foot, peripheral-nerve, pain-syndrome, cauda-equina, and cranial-nerve coverage. Specific diagnostic codes are recorded only where the current rating schedule provides a defensible condition- or nerve-specific identity. Framework-only diagnoses retain an explicit review note rather than an invented code.

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

All 18 entered Wave 2 with draft KB files and no published suggestions. Rating identity remains separate from medical-causation evidence.

## Wave 3 — endocrine and cardiovascular depth (15) — implemented

Wave 3 adds endocrine disease, endocrine-neoplasm, heart-disease/procedure, vascular, and pulmonary-vascular identities. The product batch grouping does not override the rating schedule: pulmonary hypertension is retained in the approved Wave 3 group but points to the respiratory schedule where VA actually evaluates pulmonary vascular disease.

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
| `pulmonary-hypertension` | Pulmonary Hypertension | 38 CFR 4.97 / DC 6817 (pulmonary vascular disease); respiratory rating authority despite Wave 3 product grouping |

All 15 enter Wave 3 with draft KB files and no published suggestions. Pituitary neoplasm retains behavior-dependent coding rather than an invented single code, and pulmonary hypertension retains its actual respiratory rating authority.

## Wave 4 — respiratory, sleep, eye, and cranial-sense depth (15)

`bronchiectasis`, `chronic-laryngitis`, `vocal-cord-paralysis`, `aphonia`, `granulomatous-rhinitis`, `bacterial-rhinitis`, `pulmonary-vascular-disease`, `diaphragm-paralysis`, `narcolepsy`, `uveitis`, `keratitis`, `dry-eye-syndrome`, `retinal-dystrophy`, `nystagmus`, `ptosis`.

## Wave 5 — digestive and genitourinary depth (15)

`esophageal-stricture`, `achalasia`, `barretts-esophagus`, `gastroparesis`, `peritoneal-adhesions`, `short-bowel-syndrome`, `fecal-incontinence`, `rectal-prolapse`, `anal-fistula`, `chronic-liver-disease`, `chronic-pyelonephritis`, `hydronephrosis`, `urethral-stricture`, `varicocele-hydrocele`, `epididymitis-orchitis`.

## Wave 6 — mental, hematologic, autoimmune, and skin depth (14)

`specific-phobia`, `dissociative-disorder`, `depersonalization-derealization-disorder`, `functional-neurological-symptom-disorder`, `illness-anxiety-disorder`, `body-dysmorphic-disorder`, `hoarding-disorder`, `delusional-disorder`, `essential-thrombocythemia`, `primary-myelofibrosis`, `myelodysplastic-syndrome`, `discoid-lupus`, `scarring-alopecia`, `hyperhidrosis`.

## Wave 7 — infectious, oncological, and oral/maxillofacial depth (10)

`amebiasis`, `actinomycosis`, `nocardiosis`, `histoplasmosis`, `strongyloidiasis`, `rickettsial-ehrlichial-anaplasma-infection`, `ovarian-cancer`, `testicular-cancer`, `laryngeal-cancer`, `mandibular-nonunion`.

## Batch exit criteria

A batch is complete only when:

- every new condition validates under the catalog schema;
- no ID, display name, or alias collision is introduced;
- every new condition has exactly one matching published-or-draft KB file;
- draft entries remain excluded from recommendations;
- no rating authority is presented as clinical nexus evidence;
- the citation audit does not regress;
- lint, typecheck, unit tests, production build, and real-browser journeys pass on the exact branch head;
- documentation counts match the implemented catalog.

## After Wave 3

The catalog-expansion program now has 246 recognized conditions. The next catalog batch is Wave 4, while medical-authoring work for Waves 1 through 3 remains a separate evidence task: promote only individual relationships with adequate condition-specific clinical support and leave unsupported theories draft.
