# Knowledge Base Coverage & Body System Planning Tracker

| Batch # | Body System / Category | Priority | Target Conditions | Status | Reviewer Sign-off |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Batch 1** | Musculoskeletal & Spine | High | lumbar-strain, cervical-strain, hip-strain, ankle-strain, intervertebral-disc-syndrome, radiculopathy | In Review | Pending |
| **Batch 2** | Mental Health & Neurological | High | ptsd, anxiety-disorder, depressive-disorder, migraine-headaches, insomnia, traumatic-brain-injury | In Review | Pending |
| **Batch 3** | Respiratory & ENT | Medium | sleep-apnea, asthma, chronic-sinusitis, chronic-rhinitis, copd, noise-induced-hearing-loss | Drafted | Pending |
| **Batch 4** | Gastrointestinal & Metabolic | Medium | gerd, irritable-bowel-syndrome, diabetes-mellitus-type-2, gastritis, inflammatory-bowel-disease | Drafted | Pending |
| **Batch 5** | Cardiovascular & Systemic | Low | hypertension, ischemic-heart-disease, tinnitus, fibromyalgia, peripheral-neuropathy | Drafted | Pending |

## Post-v2 controlled promotion

Clinical Evidence Promotion Batch 1 is the first relationship-level promotion pass after the 300-condition catalog target was completed.

- `cardiomyopathy` → `congestive-heart-failure`: promoted with condition-specific ESC cardiomyopathy evidence, conservative disease-progression framing, source provenance, and individual-nexus evidence gaps.
- `urethral-stricture` → `hydronephrosis`: promoted with condition-specific clinical evidence documenting upper-tract complications of urethral stenosis and explicit alternative-cause review.
- `ankle-strain`: returned to draft because the previously published relationship claims were stronger than the available condition-specific clinical evidence.
- `fibromyalgia`: catalog identity preserved but physically relocated to musculoskeletal catalog maintenance.
- The 300/300 identity contract remains fixed. After these two promotions, **105 of the 107 Wave 1-7 expansion mappings remain drafts**.
- Source records in this batch are source-checked and retain `verified: false` pending qualified-human verification under `docs/citation-verification-sop.md`.

See `docs/clinical-evidence-promotion-batch-1.md` for the evidence and regression scope.

## Repeatable Authoring & Publishing Workflow
1. **Draft Completion:** Ensure schema contains unique gapless ranks (`1, 2, 3...`), no self-references, and valid structure.
2. **Citation Insertion:** Clinical claims require condition-specific clinical-evidence references with canonical URLs and source provenance. Regulatory/legal references must remain role-labeled and must not substitute for clinical causation evidence.
3. **Source Check:** Record `sourceCheckedOn` and `sourceLocator` after checking applicability. Keep `verified: false` unless a qualified human reviewer completes the Citation Verification SOP.
4. **Quality Review:** Audit rationale strings for clinical accuracy, distinguish association from individual causation/aggravation, and ensure evidence gaps identify the case-specific proof still needed.
5. **Publish & Test:** Run `npm run kb:validate`, `npm run citations:audit`, `npm run test:composition`, `npm test`, and `npm run build`, then require exact-head real-browser CI before merge.
