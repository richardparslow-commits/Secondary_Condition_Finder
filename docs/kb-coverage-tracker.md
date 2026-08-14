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

- `cardiomyopathy` → `congestive-heart-failure` and `urethral-stricture` → `hydronephrosis` were individually promoted with condition-specific clinical evidence.
- `ankle-strain` returned to draft after unsupported biomechanical publication was withdrawn.
- `fibromyalgia` was physically normalized into musculoskeletal catalog maintenance.
- See `docs/clinical-evidence-promotion-batch-1.md`.

### Clinical Evidence Promotion Batch 2

- `hypertensive-heart-disease` → `congestive-heart-failure` and `chronic-pyelonephritis` → `chronic-kidney-disease` were individually promoted.
- `knee-injury` and `osteoarthritis` returned to draft after legal/rating-only medical claims were withdrawn.
- `diabetic-retinopathy` was physically normalized into the ophthalmologic catalog file.
- The citation-debt ratchet tightened to 141 total / 127 unverified / 125 review findings / at least 29 clinical URLs.
- After four post-v2 expansion promotions, 103 of 107 expansion mappings remained drafts.
- See `docs/clinical-evidence-promotion-batch-2.md`.

### Clinical Evidence Promotion Batch 3

- `chronic-liver-disease` → `cirrhosis-of-the-liver`: promoted only as documented hepatic-fibrosis progression with etiology and competing-cause safeguards.
- `amputation-or-loss-of-use` → `depressive-disorder`: retained only after replacing legal-only support with amputation-specific systematic-review evidence and a bounded somatopsychic pathway.
- `ageusia`: returned to draft because its depression and GERD suggestions were supported only by legal framework.
- `insomnia`: stable identity physically relocated from the carried-over file into the mental-disorders catalog.
- The citation-debt ratchet tightens again to 140 total / 126 unverified / 124 review findings / at least 31 clinical URLs.
- The 300/300 identity contract remains fixed. After five post-v2 expansion promotions, **102 of the 107 Wave 1-7 expansion mappings remain drafts**.
- All newly source-checked clinical references remain `verified: false` pending qualified-human verification.
- See `docs/clinical-evidence-promotion-batch-3.md`.

## Repeatable Authoring & Publishing Workflow
1. **Draft Completion:** Ensure schema contains unique gapless ranks (`1, 2, 3...`), no self-references, and valid structure.
2. **Citation Insertion:** Clinical claims require condition-specific clinical-evidence references with canonical URLs and source provenance. Regulatory/legal references must remain role-labeled and must not substitute for clinical causation evidence.
3. **Source Check:** Record `sourceCheckedOn` and `sourceLocator` after checking applicability. Keep `verified: false` unless a qualified human reviewer completes the Citation Verification SOP.
4. **Quality Review:** Audit rationale strings for clinical accuracy, distinguish association from individual causation/aggravation, and ensure evidence gaps identify the case-specific proof still needed.
5. **Publish & Test:** Run `npm run kb:validate`, `npm run citations:audit`, `npm run test:composition`, `npm test`, and `npm run build`, then require exact-head real-browser CI before merge.
