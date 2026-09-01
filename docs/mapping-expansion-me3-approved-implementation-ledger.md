# Mapping Expansion Batch ME-3 — Formal Implementation Approval Scope (Proposed)

- Authoritative baseline: `61f9bc5e28b5907a854eb1f38ba7a787dee4375a`
- Status: **APPROVED-AND-IMPLEMENTED-LOCALLY — CITATION VERIFICATION PENDING**
- Relationship candidates: **5**
- New taxonomy identities: **0**
- Source rows initially `verified:false`: **5**
- Remote writes authorized: **no**

## Registry revalidation

All five primaries remain published P1 primaries; all targets already exist; no proposed relationship ID duplicates a live relationship.

| Primary | Current edge | Proposed edge | PMID | Decision |
|---|---|---|---:|---|
| `acromegaly` | `hypertension` | `sleep-apnea` | 31722411 | retain |
| `ankylosing-spondylitis` | `osteoporosis` | `uveitis` | 23999006 | retain |
| `hyperparathyroidism` | `kidney-stones` | `osteoporosis` | 41329412 | retain |
| `cushings-syndrome` | `hypertension` | `osteoporosis` | 39689783 | refine source |
| `hyperthyroidism` | `hypothyroidism` | `cardiac-arrhythmia` | 38377675 | retain |

### Source refinement

`cushings-syndrome → osteoporosis` keeps the same relationship direction and target, but the proposed source is refined from PMID 37745145 to **PMID 39689783**, a systematic review/meta-analysis limited to endogenous Cushing syndrome.

## Required master-registry two-phase evidence state

The installed registry currently assumes every live source is already verified. ME-3 must preserve the established mapping-then-human-verification workflow. Therefore the implementation must add a fail-closed `pending-verification` source state:

- live `verified:true` reference → master source `active`
- live `verified:false` reference → master source `pending-verification`
- qualified-human promotion → atomic `verified:false → true` and `pending-verification → active`
- PubMed identity lookup alone never promotes verification

## Expected post-implementation / pre-verification state

```text
311 identities
139 published / 172 draft
188 relationships
P1 106 / P2+ 33

196 references
191 live verified
5 unverified
5 review
0 hard
197 verified provenance

Master registry:
188 relationships
114 explicit guards / 74 legacy-rationale-boundary
168 active sources
5 pending-verification sources
182 total source entities including lineage/history
```

## Five approved-guard candidates

### 1. `acromegaly → sleep-apnea`
- PMID **31722411**; DOI `10.1210/clinem/dgz116`
- Source: *Obstructive Sleep Apnea in Acromegaly and the Effect of Treatment: A Systematic Review and Meta-Analysis*
- Proposition: Obstructive sleep apnea is a recognized comorbidity of acromegaly; the meta-analysis evaluates OSA prevalence and AHI in acromegaly and reports improvement in AHI after acromegaly treatment.
- Guard: Require documented acromegaly and separately established obstructive sleep apnea by appropriate sleep-study/clinical diagnostic criteria. The broad sleep-apnea target is used only for the obstructive phenotype supported by PMID 31722411; do not extend this edge to central sleep apnea. Do not infer OSA from acromegaly, obesity, snoring, macroglossia, daytime sleepiness, or upper-airway anatomy alone, and consider other OSA contributors when evaluating an individual nexus. Population-level prevalence and treatment response do not by themselves establish individual causation.

### 2. `ankylosing-spondylitis → uveitis`
- PMID **23999006**; DOI `10.1136/annrheumdis-2013-203582`
- Source: *Prevalence of extra-articular manifestations in patients with ankylosing spondylitis: a systematic review and meta-analysis*
- Proposition: Uveitis is a common extra-articular manifestation in ankylosing spondylitis populations; the meta-analysis reports a pooled uveitis prevalence of 25.8%.
- Guard: Require established ankylosing spondylitis and separately diagnosed uveitis by appropriate ophthalmic evaluation. Do not infer uveitis from HLA-B27 positivity, red eye, ocular pain, or photophobia alone. Preserve alternative infectious, inflammatory, traumatic, and medication-related causes. PMID 23999006 supports uveitis as a common extra-articular manifestation/association in AS populations; it does not by itself establish individual causation.

### 3. `hyperparathyroidism → osteoporosis`
- PMID **41329412**; DOI `10.1007/s00508-025-02670-z`
- Source: *Bone metabolism in primary hyperparathyroidism*
- Proposition: Primary hyperparathyroidism increases bone remodeling and bone resorption, with declining bone mineral density, compromised bone quality, and increased fracture risk, supporting a bounded osteoporosis complication pathway.
- Guard: Require biochemically documented primary hyperparathyroidism and separately established osteoporosis under accepted bone-density and/or fragility-fracture criteria. The broader hyperparathyroidism identity must not extend this edge to secondary or tertiary hyperparathyroidism. Do not infer osteoporosis from elevated PTH, hypercalcemia, osteopenia, bone pain, or fracture risk alone; consider age, menopause or hypogonadism, renal disease, glucocorticoid exposure, vitamin D status, and other skeletal causes in an individual nexus.

### 4. `cushings-syndrome → osteoporosis`
- PMID **39689783**; DOI `10.1016/j.eprac.2024.12.009`
- Source: *Bone Mineral Density Improvement After Resolution of Endogenous Cushing Syndrome: A Systematic Review and Meta-Analysis*
- Proposition: Endogenous Cushing syndrome is associated with impaired bone mineral density/osteoporosis; pooled evidence shows bone mineral density improves after resolution of endogenous Cushing syndrome.
- Guard: Require documented endogenous Cushing syndrome/hypercortisolism and separately established osteoporosis under accepted bone-density and/or fragility-fracture criteria. PMID 39689783 is limited to endogenous Cushing syndrome; do not use this edge to represent osteoporosis from exogenous glucocorticoid therapy in the absence of endogenous Cushing syndrome. Do not infer osteoporosis from cortisol excess alone, and preserve competing skeletal risk factors when evaluating an individual nexus.

### 5. `hyperthyroidism → cardiac-arrhythmia`
- PMID **38377675**; DOI `10.1530/ETJ-23-0254`
- Source: *Epidemiology, prognosis, and challenges in the management of hyperthyroidism-related atrial fibrillation*
- Proposition: Atrial fibrillation is the most common cardiac complication of hyperthyroidism and occurs in a clinically meaningful subset of overtly hyperthyroid patients; thyroid normalization is central to management and many patients revert to sinus rhythm.
- Guard: Require documented hyperthyroidism/thyrotoxicosis and separately documented atrial fibrillation. The broad cardiac-arrhythmia target is used only for the atrial-fibrillation phenotype supported by PMID 38377675; do not extend this edge to sinus tachycardia, ventricular arrhythmias, other supraventricular rhythms, palpitations, or an abnormal pulse without AF documentation. Preserve temporal thyroid status, restoration of euthyroidism, structural heart disease, age, and other AF risk factors when evaluating individual attribution.

## Implementation boundary

- Update each of the five KB rows and both master registries atomically.
- Add no taxonomy identity and change no publication status.
- Add no `pathwayIntelligence`.
- Use rank `2` and `prevalence: "sometimes-explored"` for all five.
- Add five unique clinical source entities as `pending-verification`, not `active`.
- Do not promote citations until separate qualified-human review.
- Maintain the Vercel freeze; local commit only after every approved validation gate passes.


## Qualified-human implementation approval

Approved on **2026-08-20** for local-only implementation from exact baseline:

`61f9bc5e28b5907a854eb1f38ba7a787dee4375a`

The approval includes:
- all five ME-3 relationships and explicit guards;
- Cushing syndrome → osteoporosis using refined source PMID **39689783**;
- five new clinical sources entering as `verified:false`;
- five master-source entities entering as `pending-verification`;
- atomic KB/master-registry parity;
- no citation promotion during mapping implementation;
- no taxonomy, publication-status, or `pathwayIntelligence` changes;
- no remote writes.

Intended local commit subject:

`map: mapping expansion ME-3 (5 relationships)`

## Local implementation result

- 5/5 approved relationships added.
- 5/5 source rows enter as `verified:false`.
- 5/5 corresponding master sources enter as `pending-verification`.
- No citation promotion occurred.
- No taxonomy, publication-status, or `pathwayIntelligence` change occurred.
- No remote writes occurred.
