# Knowledge Base Coverage & Body System Planning Tracker

| Batch # | Body System / Category | Priority | Target Conditions | Status | Reviewer Sign-off |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Batch 1** | Musculoskeletal & Spine | High | lumbar-strain, cervical-strain, hip-strain, ankle-strain, intervertebral-disc-syndrome, radiculopathy | In Review | Pending |
| **Batch 2** | Mental Health & Neurological | High | ptsd, anxiety-disorder, depressive-disorder, migraine-headaches, insomnia, traumatic-brain-injury | In Review | Pending |
| **Batch 3** | Respiratory & ENT | Medium | sleep-apnea, asthma, chronic-sinusitis, chronic-rhinitis, copd, noise-induced-hearing-loss | Drafted | Pending |
| **Batch 4** | Gastrointestinal & Metabolic | Medium | gerd, irritable-bowel-syndrome, diabetes-mellitus-type-2, gastritis, inflammatory-bowel-disease | Drafted | Pending |
| **Batch 5** | Cardiovascular & Systemic | Low | hypertension, ischemic-heart-disease, tinnitus, fibromyalgia, peripheral-neuropathy | Drafted | Pending |

## Post-v2 controlled promotion

### Clinical Evidence Promotion Batch 1
- `cardiomyopathy` → `congestive-heart-failure`; `urethral-stricture` → `hydronephrosis`.
- `ankle-strain` returned to draft; `fibromyalgia` physically normalized.

### Clinical Evidence Promotion Batch 2
- `hypertensive-heart-disease` → `congestive-heart-failure`; `chronic-pyelonephritis` → `chronic-kidney-disease`.
- `knee-injury` and `osteoarthritis` returned to draft; `diabetic-retinopathy` physically normalized.
- Citation ratchet: 141 total / 127 unverified / 125 review / ≥29 clinical URLs; 103/107 expansion mappings remained draft.

### Clinical Evidence Promotion Batch 3
- `chronic-liver-disease` → `cirrhosis-of-the-liver`; amputation/depression repaired with clinical evidence.
- `ageusia` returned to draft; `insomnia` physically normalized.
- Citation ratchet: 140 total / 126 unverified / 124 review / ≥31 clinical URLs; **102/107** expansion mappings remained draft.

### Clinical Evidence Promotion Batch 4
- `acl-injury` and `pcl-injury` → `osteoarthritis`: promoted using injury-specific systematic-review evidence with affected-knee/chronology safeguards.
- `anosmia` and `alopecia-areata` → `depressive-disorder`: legal-only support replaced with condition-specific systematic review/meta-analysis evidence; both remain association-focused rather than automatic nexus claims.
- `agranulocytosis`: returned to draft because its depression and GERD suggestions used only legal framework and generic chronic-condition/treatment language.
- `hip-strain` and `ankle-strain`: stable identities physically moved from `carried-over.json` into musculoskeletal maintenance.
- Citation debt ceilings remain 140 total / 126 unverified / 124 review findings while the clinical-URL floor rises to **35**.
- The 300/300 contract remains fixed. ACL and PCL are the sixth and seventh promoted expansion mappings, so **100 of 107 Wave 1-7 expansion mappings remain drafts**.
- New source checks remain `verified: false` pending qualified-human verification.
- See `docs/clinical-evidence-promotion-batch-4.md`.

### Clinical Evidence Promotion Batch 5
- `barretts-esophagus` → `esophageal-cancer`: promoted only as an adenocarcinoma-specific progression pathway with guideline evidence and histology/chronology safeguards.
- `achalasia` → `esophageal-cancer`: promoted as a histology-aware cancer-risk pathway using the nationwide Veterans Affairs matched cohort, with explicit limits on generalizing the observed squamous-cell predominance.
- `al-amyloidosis`: returned to draft because its depression and GERD suggestions were supported only by 38 CFR 3.310 plus generic medical propositions.
- `substance-use-disorder`: stable identity physically moved from `carried-over.json` into `mental-disorders.json`; `carried-over.json` now contains only the quarantined `contralateral-knee-condition` placeholder.
- Citation debt ceilings remain 140 total / 126 unverified / 124 review findings while the clinical-URL floor rises to **37**.
- The 300/300 contract remains fixed. Barrett's esophagus and achalasia are the eighth and ninth promoted expansion mappings, so **98 of 107 Wave 1-7 expansion mappings remain drafts**.
- New source checks remain `verified: false` pending qualified-human verification.
- See `docs/clinical-evidence-promotion-batch-5.md`.

### Clinical Evidence Promotion Batch 6
- `hyperaldosteronism` → `hypertension`: promoted only for a confirmed primary-aldosteronism phenotype using the 2025 Endocrine Society guideline's direct aldosterone → sodium-retention/volume-expansion → elevated-BP mechanism.
- `addisons-disease`: returned to draft because its peripheral-neuropathy, diabetic-retinopathy, and chronic-kidney-disease suggestions relied only on rating-schedule sources plus generic endocrine/metabolic language.
- `hyperpituitarism`: display identity narrowed to `Hyperpituitarism (Prolactin-Secreting Pituitary Dysfunction)` to match DC 7916 while preserving stable ID, aliases, and `verified: false` rating state.
- Citation debt tightens to **138 total / 14 verified / 124 unverified / 122 review findings**, while the clinical-URL floor rises to **38**.
- The 300/300 contract remains fixed. Hyperaldosteronism is the tenth promoted expansion mapping, so **97 of 107 Wave 1-7 expansion mappings remain drafts**.
- The new clinical source remains `verified: false` pending qualified-human verification.
- See `docs/clinical-evidence-promotion-batch-6.md`.

### Clinical Evidence Promotion Batch 7
- `acromegaly` → `hypertension`: promoted as a direct-secondary research pathway using the 2026 international acromegaly complications consensus, with GH/IGF-I activity, sodium/water-retention mechanism, blood-pressure chronology, treatment response, and competing-cause safeguards.
- `anorexia-nervosa`: returned to draft because its depression suggestion relied only on 38 CFR 3.310 plus generic chronic-condition language without condition-specific direction or mechanism evidence.
- `cushings-syndrome`: stable identity physically moved from the historical neurological file into the endocrine catalog, normalized to `Cushing's Syndrome`, and assigned the express 38 CFR 4.119 / DC 7907 framework with `verified: false` preserved.
- Citation debt ceilings remain **138 total / 14 verified / 124 unverified / 122 review findings**, while the clinical-URL floor rises to **39**.
- The 300/300 contract remains fixed. Acromegaly is the eleventh promoted expansion mapping, so **96 of 107 Wave 1-7 expansion mappings remain drafts**.
- The new clinical source remains `verified: false` pending qualified-human verification.
- See `docs/clinical-evidence-promotion-batch-7.md`.

## Repeatable Authoring & Publishing Workflow
1. **Draft Completion:** Ensure schema contains unique gapless ranks (`1, 2, 3...`), no self-references, and valid structure.
2. **Citation Insertion:** Clinical claims require condition-specific clinical-evidence references with canonical URLs and source provenance. Regulatory/legal references must remain role-labeled and must not substitute for clinical causation evidence.
3. **Source Check:** Record `sourceCheckedOn` and `sourceLocator` after checking applicability. Keep `verified: false` unless a qualified human reviewer completes the Citation Verification SOP.
4. **Quality Review:** Audit rationale strings for clinical accuracy, distinguish association from individual causation/aggravation, and ensure evidence gaps identify the case-specific proof still needed.
5. **Publish & Test:** Run `npm run kb:validate`, `npm run citations:audit`, `npm run test:composition`, `npm test`, and `npm run build`, then require exact-head real-browser CI before merge.
