# Citation Verification Batch 08

Review date: **2026-08-18**

Reviewer role: **Repository owner / qualified human reviewer**

Human decision recorded in the project review workflow: **batch 8 is approved**

This approval applies to the five Batch 08 dispositions presented immediately before approval: three verify-as-written decisions, one narrow-then-verify decision, and one narrow-and-hold-unverified decision.

## Scope

| Mapping | Relationship / evidentiary link | Source | Decision |
| --- | --- | --- | --- |
| `interstitial-lung-disease.json` | ILD ↔ OSA prevalence/association | Cheng et al., PMID 33403599 | VERIFY AS WRITTEN |
| `migraine-headaches.json` | migraine preceding incident depression | Rist et al., PMID 23588795 | NARROW TO TEMPORAL ASSOCIATION, THEN VERIFY |
| `mild-tbi.json` | mTBI → post-traumatic headache with migraine-like phenotype under current migraine target | Schwedt, PMID 38568491 | NARROW TAXONOMY, HOLD UNVERIFIED |
| `osteitis-deformans.json` | Paget disease → anatomically related secondary osteoarthritis | Belgian Bone Club consensus, PMID 18504638 | VERIFY AS WRITTEN |
| `ovarian-cancer.json` | paclitaxel-containing treatment → peripheral neuropathy | MITO-7, PMID 24582486 | VERIFY AS WRITTEN |

## Decision boundaries

### ILD → OSA

This remains prevalence/association evidence only. The mapping explicitly does not claim that ILD causes or aggravates OSA in an individual and preserves sleep-study confirmation, ILD phenotype/severity, chronology, body-habitus/upper-airway risk, medication context, and specialist review.

### Migraine → depressive disorder

The prospective cohort supports temporal association with incident depression but does not establish the repository's prior `somatopsychic` causal mechanism. Batch 08 removes the entire `pathwayIntelligence` object and changes “focused somatopsychic research” to “focused temporal-association research” before verification. The individual-causation disclaimer and competing psychiatric, pain, sleep, treatment, and psychosocial contributors remain.

### Mild TBI → migraine target

PMID 38568491 supports post-traumatic headache attributed to mild TBI and overlap with migraine-like phenotypes. It does not independently establish that mTBI caused a primary or secondary migraine diagnosis. Because the current target identity is `migraine-headaches` rather than post-traumatic headache, Batch 08 narrows this entry to a phenotype-oriented research flag, refreshes the source-review date, and intentionally leaves `verified: false`.

### Paget disease → osteoarthritis

The site-specific biomechanical/disease-progression pathway is preserved. Verification applies only to osteoarthritis anatomically related to documented Paget involvement, with chronology and competing age, trauma, alignment, obesity, occupational, inflammatory, and other risks reviewed.

### Ovarian-cancer treatment → peripheral neuropathy

The treatment-complication pathway is preserved and remains specific to documented paclitaxel-containing or otherwise clinically supported neurotoxic treatment exposure. Ovarian cancer itself or surgery alone is not treated as sufficient evidence.

## Ratchet movement

- live references: **69**
- live verified: **47** (43 → 47)
- retired verified: **6**
- verified provenance: **53** (49 → 53)
- live unverified: **22** (26 → 22)
- published-unverified review findings: **20** (24 → 20)
- hard findings: **0**
- live clinical-evidence references with canonical URLs: **64**
- retired clinical-evidence references with canonical URLs: **4**
- combined clinical-URL provenance observation: **68**

Batch 08 is intentionally a four-verification batch despite five reviewed rows. No source is automatically verified; `verified: true` records only the qualified-human-approved dispositions.
