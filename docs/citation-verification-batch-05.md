# Citation Verification Batch 05

Review date: **2026-08-18**

Reviewer role: **Repository owner / qualified human reviewer**

Human decision recorded in the project review workflow: **Approved Batch 5 — all 5, including the ED pathway narrowing and valve-source replacement with PMID 31039274.**

## Scope

This batch contains exactly five previously unverified live clinical-evidence references in deterministic post-Batch-4 audit order.

| Mapping | Relationship / evidentiary link | Source | Decision |
| --- | --- | --- | --- |
| `erectile-dysfunction.json` | erectile dysfunction ↔ depressive disorder association | Liu et al., PMID 29960891 | NARROW, THEN VERIFY |
| `femoroacetabular-impingement.json` | FAI → hip osteoarthritis | Kowalczuk et al., PMID 26524551 | VERIFY AS WRITTEN |
| `heart-valve-replacement-residuals.json` | prosthetic-valve dysfunction/leak → hemolysis → hemolytic anemia | Alkhouli et al., PMID 31039274 | REPLACE SOURCE ONE-FOR-ONE, THEN VERIFY |
| `hyperaldosteronism.json` | confirmed primary aldosteronism → hypertension | Endocrine Society guideline, JCEM 2025 | VERIFY AS WRITTEN |
| `hyperparathyroidism.json` | confirmed primary hyperparathyroidism → kidney stones | Fifth International Workshop, PMID 36245251 | VERIFY AS WRITTEN |

## Verification rationale and limitations

### Erectile dysfunction ↔ depressive disorder

PMID 29960891 supports a clinically important bidirectional population-level association but does not determine the causal direction for an individual patient. The prior `pathwayIntelligence` object assigned a `somatopsychic` pathway and an explicit ED→depression causal chain, which was stronger than the evidence. Batch 05 therefore removes the entire directional pathway-intelligence object while preserving the existing bidirectional association rationale, evidence gaps, rank, prevalence, and source. Verification applies to the bounded association evidence, not a direct-secondary causal proposition.

### FAI → hip osteoarthritis

PMID 26524551 supports the existing morphology-specific hip-OA pathway, with stronger evidence for cam-type morphology and explicit limits against generalizing to every FAI phenotype. Same-hip imaging, chronology, competing OA causes, and individual orthopedic review remain required.

### Heart-valve-replacement residuals → hemolytic anemia

The prior source (PMID 40103841) is replaced one-for-one with Alkhouli et al., PMID 31039274 (PMCID PMC6605004), a directly relevant review of cardiac-prosthesis-related hemolytic anemia. The live mapping remains limited to documented prosthetic dysfunction/paravalvular leak, objective hemolysis, compatible anemia phenotype and chronology, and competing-cause review. Prosthetic-valve status alone is not treated as sufficient.

### Confirmed primary aldosteronism → hypertension

The existing pathway is verified as written because it already limits the proposition to objectively established primary aldosteronism with autonomous aldosterone excess/suppressed-renin physiology and preserves alternative-hypertension review. The broader catalog identity is not used to infer the primary-aldosteronism mechanism without phenotype confirmation.

### Confirmed primary hyperparathyroidism → kidney stones

PMID 36245251 is verified as written. The mapping remains explicitly limited to confirmed primary hyperparathyroidism, preserves biochemical and renal evaluation requirements, and requires review of alternative metabolic, medication, infectious, dietary, and structural stone causes.

## Ratchet movement

- live references: **69**
- live verified: **33** (28 → 33)
- retired verified: **6**
- verified provenance: **39** (34 → 39)
- live unverified: **36** (41 → 36)
- published-unverified review findings: **34** (39 → 34)
- hard findings: **0**

The valve source is replaced one-for-one, so the live-reference denominator and clinical-URL denominator do not change.

## Review boundary

`verified: true` records explicit qualified-human approval. Automated retrieval and analysis prepared the review materials but did not independently authorize verification.
