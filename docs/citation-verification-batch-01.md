# Citation Verification Batch 01

Review date: **2026-08-18**

Reviewer role: **Repository owner / qualified human reviewer**

Human decision recorded in the project review workflow: **Approved Batch 1 — all 5.**

## Scope

This batch contains exactly five previously unverified live clinical-evidence references, processed in the deterministic order emitted by `scripts/audit-citation-verification.js`.

| Mapping | Relationship | Source | Decision |
| --- | --- | --- | --- |
| `achalasia.json` | achalasia → esophageal cancer | Low et al., *Am J Gastroenterol.* 2024, PMID 37975607 | VERIFY AS WRITTEN |
| `acl-injury.json` | ACL injury → knee osteoarthritis | Webster & Hewett, *Clin J Sport Med.* 2022, PMID 33852440 | VERIFY AS WRITTEN |
| `acromegaly.json` | acromegaly → hypertension | Giustina et al., *Pituitary* 2026, PMID 42050227 | VERIFY AS WRITTEN |
| `amputation-or-loss-of-use.json` | traumatic limb amputation → depressive disorder | Mckechnie & John, *Injury* 2014, PMID 25294119 | VERIFY AS WRITTEN |
| `anal-fistula.json` | sphincter-cutting anal-fistula treatment → fecal incontinence | Litta et al., *Tech Coloproctol.* 2021, PMID 33387100 | VERIFY AS WRITTEN |

## Verification rationale and limitations

### Achalasia → esophageal cancer — PMID 37975607

The nationwide matched U.S. Veterans cohort directly supports higher esophageal-cancer incidence in patients with achalasia and reports predominantly squamous-cell histology among cancers arising in the achalasia cohort. The live mapping already limits this to risk-focused review and explicitly avoids treating the cohort association as an automatic individual causal conclusion. The mapping also requires pathology, chronology, treatment history, and competing-risk review.

### ACL injury → knee osteoarthritis — PMID 33852440

The umbrella systematic review/meta-analysis directly supports a substantially increased long-term risk of knee osteoarthritis after ACL injury. The live mapping remains appropriately bounded by requiring the osteoarthritis to be documented in the injured knee and by requiring review of meniscal/cartilage injury, instability, treatment, alignment, age, activity, and other competing osteoarthritis risk factors.

### Acromegaly → hypertension — PMID 42050227

The international consensus update supports hypertension as a major acromegaly comorbidity and describes disease-specific mechanisms including GH-related renal sodium/water retention and extracellular-volume expansion, while also discussing blood-pressure improvement with successful biochemical control. The live mapping preserves the important limitation that hypertension is multifactorial and may persist after biochemical remission, so disease presence alone is not treated as an individual nexus.

### Traumatic limb amputation → depressive disorder — PMID 25294119

The systematic review supports a substantial post-traumatic-amputation burden of depression and anxiety while reporting meaningful study heterogeneity and limited long-term prospective evidence. The live mapping is narrower than a causal claim: it requires individual symptom chronology, rehabilitation/pain/functional context, competing psychiatric or psychosocial contributors, and a case-specific mental-health assessment.

### Anal-fistula treatment → fecal incontinence — PMID 33387100

The systematic review supports postoperative continence impairment after sphincter-cutting procedures, predominantly fistulotomy, while reporting generally low study quality. The live mapping correctly restricts the proposition to documented sphincter-cutting or sphincter-involving treatment and explicitly does not generalize the evidence to anal fistula itself or to sphincter-sparing procedures without a compatible complication.

## Ratchet movement

Expected post-batch audit position:

- live references: **69** (unchanged)
- live verified: **13** (8 → 13)
- retired verified: **6** (unchanged)
- verified provenance: **19** (14 → 19)
- live unverified: **56** (61 → 56)
- published-unverified review findings: **54** (59 → 54)
- hard findings: **0**

The citation-debt ratchet is advanced only to the post-review values. No source is added, removed, replaced, or substantively rewritten in this batch.

## Review boundary

`verified: true` in this batch records the repository owner's explicit qualified-human approval after source-to-proposition review. Automated retrieval and analysis prepared the review materials but did not independently authorize verification.
