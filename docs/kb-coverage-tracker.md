# Knowledge Base Coverage & Body System Planning Tracker

| Batch # | Body System / Category | Priority | Target Conditions | Status | Reviewer Sign-off |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Batch 1** | Musculoskeletal & Spine | High | lumbar-strain, cervical-strain, hip-strain, ankle-strain, intervertebral-disc-syndrome, radiculopathy | Published | Pending |
| **Batch 2** | Mental Health & Neurological | High | ptsd, anxiety-disorder, depressive-disorder, migraine-headaches, insomnia, traumatic-brain-injury | Published | Pending |
| **Batch 3** | Respiratory & ENT | Medium | sleep-apnea, asthma, chronic-sinusitis, chronic-rhinitis, copd, noise-induced-hearing-loss | Published | Pending |
| **Batch 4** | Gastrointestinal & Metabolic | Medium | gerd, irritable-bowel-syndrome, diabetes-mellitus-type-2, gastritis, inflammatory-bowel-disease | Published | Pending |
| **Batch 5** | Cardiovascular & Systemic | Low | hypertension, ischemic-heart-disease, tinnitus, fibromyalgia, peripheral-neuropathy | Published | Pending |

> Status reflects whether each batch's knowledge-base mappings ship in the
> app (every catalog condition currently has a published mapping, and the
> authoring backlog is empty). Reviewer sign-off remains pending by design
> because citations are locked to `"verified": false` until a qualified human
> confirms them.

## Repeatable Authoring & Publishing Workflow
1. **Draft Completion:** Ensure schema contains unique gapless ranks (`1, 2, 3...`), no self-references, and valid structure.
2. **Citation Insertion:** All regulatory references must include 38 CFR citations with **`"verified": false`** to prevent unvalidated claims.
3. **Quality Review:** Audit rationale strings for clinical accuracy and verify that evidence gaps match VA DBQ (Disability Benefits Questionnaire) criteria.
4. **Publish & Test:** Run `npm test` and `npm run build` to ensure zero Zod schema regression, then commit and push in reviewable batches.
