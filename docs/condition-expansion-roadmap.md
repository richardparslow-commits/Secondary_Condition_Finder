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

## Coverage target

| State | Conditions |
|---|---:|
| Baseline before expansion | 193 |
| Wave 1 implemented in this batch | +20 |
| Catalog after Wave 1 | 213 |
| Waves 2-7 planned | +87 |
| Target catalog v2 | 300 |

The candidate list deliberately consolidates obvious synonyms and avoids creating separate user-facing entries for every residual, laterality variant, or diagnostic-code phrasing. Laterality should eventually be modeled as an attribute rather than by multiplying diagnoses.

## Wave 1 — musculoskeletal and neurological (20)

These are the highest-density expansion areas because the VA DBQ inventory and Part 4 rating schedule contain many distinct joint, bone, peripheral-nerve, and central-neurological diagnoses that are not yet represented by stable catalog identities.

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

All 20 enter Wave 1 with draft KB files. Publication of any secondary relationship is a separate evidence-authoring step.

## Wave 2 — musculoskeletal and peripheral-neurological depth (18)

`psoriatic-arthritis`, `charcot-arthropathy`, `sacroiliac-joint-dysfunction`, `femoroacetabular-impingement`, `hip-labral-tear`, `greater-trochanteric-pain-syndrome`, `patellar-instability`, `acl-injury`, `pcl-injury`, `tarsal-metatarsal-malunion-nonunion`, `radial-neuropathy`, `median-neuropathy`, `tibial-neuropathy`, `femoral-neuropathy`, `meralgia-paresthetica`, `complex-regional-pain-syndrome`, `cauda-equina-syndrome`, `cranial-nerve-palsy`.

## Wave 3 — endocrine and cardiovascular depth (15)

`thyroiditis`, `nontoxic-thyroid-enlargement`, `acromegaly`, `hyperaldosteronism`, `hyperpituitarism`, `diabetes-insipidus`, `pituitary-neoplasm`, `hypertensive-heart-disease`, `cardiomyopathy`, `heart-valve-replacement-residuals`, `coronary-bypass-residuals`, `heart-transplant-residuals`, `implantable-cardiac-pacemaker`, `thromboangiitis-obliterans`, `pulmonary-hypertension`.

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

## After Wave 1

The next medical-authoring step is not to publish all 20 automatically. It is to research the highest-value primary-to-secondary pathways inside Wave 1, promote only the relationships with adequate condition-specific clinical support, and leave unsupported theories draft. Wave 2 catalog identity expansion can proceed independently in the next controlled batch.
