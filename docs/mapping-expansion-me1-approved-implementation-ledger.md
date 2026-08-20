# Mapping Expansion Batch ME-1 — Approved Implementation Ledger

- **Approval:** I approve ME-1 approval scope
- **Approval date:** 2026-08-20
- **Required baseline commit:** `f4bdd8ed93de2f18fae6305fb98b7d9f1ca22ecc`
- **Mode:** local-only
- **Implementation authorized by this ledger:** **No** — this file is the fail-closed specification for the next implementation checkpoint.
- **Citation promotion authorized:** **No**
- **Source verification state at insertion:** all five must be `verified:false`.
- **Taxonomy changes:** none.
- **Publication-status changes:** none.
- **Pathway intelligence:** none.

## Expected state transition

| Metric | Pre-state | Post-implementation / pre-verification |
|---|---:|---:|
| KB identities | 311 | 311 |
| Published / draft | 139 / 172 | 139 / 172 |
| Relationship edges | 173 | 178 |
| P1 published primaries | 120 | 116 |
| P2+ published primaries | 19 | 23 |
| References | 181 | 186 |
| Live verified | 181 | 181 |
| Unverified | 0 | 5 |
| Review findings | 0 | 5 |
| Hard findings | 0 | 0 |
| Verified provenance | 187 | 187 |
| Live clinical URLs | 176 | 181 |
| Combined clinical provenance URLs | 180 | 185 |

## Approved rows

### ME-1.1 — `diabetes-mellitus-type-2 → chronic-kidney-disease`

- **Disposition:** `approved-with-narrowing`
- **PMID:** `41358881`
- **DOI:** `10.2337/dc26-S011`
- **Title:** 11. Chronic Kidney Disease and Risk Management: Standards of Care in Diabetes-2026
- **Source URL:** https://pubmed.ncbi.nlm.nih.gov/41358881/
- **Initial verification state:** `verified:false`
- **Citation:** American Diabetes Association Professional Practice Committee for Diabetes. 11. Chronic Kidney Disease and Risk Management: Standards of Care in Diabetes-2026. Diabetes Care. 2026;49(Suppl 1):S246-S260. PMID 41358881. doi:10.2337/dc26-S011.

**Approved publication guard**

> Require documented type 2 diabetes mellitus and separately documented chronic kidney disease satisfying accepted chronicity criteria. Where the relationship is represented as diabetes-related CKD, use clinical findings compatible with diabetic kidney disease, including the albuminuria/eGFR pattern and longitudinal course, while evaluating alternative or additional kidney disease when atypical features are present. In the absence of definitive etiologic evidence, describe the phenotype as CKD in a person with type 2 diabetes or presumed diabetic kidney disease, rather than asserting individual causation. Do not relabel transient AKI, an isolated creatinine abnormality, or every CKD diagnosis in a patient with diabetes as diabetic kidney disease.

### ME-1.2 — `diabetes-mellitus-type-2 → diabetic-retinopathy`

- **Disposition:** `approved-as-written`
- **PMID:** `41358886`
- **DOI:** `10.2337/dc26-S012`
- **Title:** 12. Retinopathy, Neuropathy, and Foot Care: Standards of Care in Diabetes-2026
- **Source URL:** https://pubmed.ncbi.nlm.nih.gov/41358886/
- **Initial verification state:** `verified:false`
- **Citation:** American Diabetes Association Professional Practice Committee for Diabetes. 12. Retinopathy, Neuropathy, and Foot Care: Standards of Care in Diabetes-2026. Diabetes Care. 2026;49(Suppl 1):S261-S276. PMID 41358886. doi:10.2337/dc26-S012.

**Approved publication guard**

> Require documented type 2 diabetes mellitus and separately diagnosed diabetic retinopathy using appropriate ophthalmologic evidence. Do not infer retinopathy from diabetes alone, and do not use this relationship for unrelated retinal disease or visual impairment without a diabetic-retinopathy diagnosis.

### ME-1.3 — `tuberculosis → bronchiectasis`

- **Disposition:** `approved-as-written`
- **PMID:** `36855043`
- **DOI:** `10.5588/ijtld.22.0566`
- **Title:** Post-TB bronchiectasis: from pathogenesis to rehabilitation
- **Source URL:** https://pubmed.ncbi.nlm.nih.gov/36855043/
- **Initial verification state:** `verified:false`
- **Citation:** Martinez-Garcia MA, Guan WJ, de-la-Rosa D, et al. Post-TB bronchiectasis: from pathogenesis to rehabilitation. Int J Tuberc Lung Dis. 2023;27(3):175-181. PMID 36855043. doi:10.5588/ijtld.22.0566.

**Approved publication guard**

> Require documented pulmonary tuberculosis preceding separately documented bronchiectasis, with imaging and clinical context consistent with post-tuberculosis structural lung disease. Do not infer bronchiectasis from tuberculosis history alone, and do not generalize this pulmonary-sequela pathway to isolated extrapulmonary tuberculosis.

### ME-1.4 — `inflammatory-bowel-disease → anemia`

- **Disposition:** `approved-as-written`
- **PMID:** `39954228`
- **DOI:** `10.1007/s12664-024-01735-7`
- **Title:** Anemia in inflammatory bowel disease-A comprehensive review
- **Source URL:** https://pubmed.ncbi.nlm.nih.gov/39954228/
- **Initial verification state:** `verified:false`
- **Citation:** Dutta AK, Chinthala H, George JT, Thomas DM, Joseph AJ. Anemia in inflammatory bowel disease-A comprehensive review. Indian J Gastroenterol. 2025;44(4):430-442. PMID 39954228. doi:10.1007/s12664-024-01735-7.

**Approved publication guard**

> Require documented Crohn disease, ulcerative colitis, or otherwise clinically established inflammatory bowel disease and separately documented anemia. Where anemia is attributed to IBD, require clinical evidence supporting an IBD-related mechanism such as chronic gastrointestinal blood loss/iron deficiency, inflammatory anemia, malabsorption, or another established IBD-related pathway. Do not assume every anemia in a person with IBD is caused by IBD.

### ME-1.5 — `cardiomyopathy → cardiac-arrhythmia`

- **Disposition:** `approved-as-written`
- **PMID:** `37622657`
- **DOI:** `10.1093/eurheartj/ehad194`
- **Title:** 2023 ESC Guidelines for the management of cardiomyopathies
- **Source URL:** https://pubmed.ncbi.nlm.nih.gov/37622657/
- **Initial verification state:** `verified:false`
- **Citation:** Arbelo E, Protonotarios A, Gimeno JR, et al. 2023 ESC Guidelines for the management of cardiomyopathies. Eur Heart J. 2023;44(37):3503-3626. PMID 37622657. doi:10.1093/eurheartj/ehad194.

**Approved publication guard**

> Require documented cardiomyopathy and separately documented clinically significant ventricular arrhythmia, such as ventricular tachycardia or ventricular fibrillation, arising in a clinically compatible structural-cardiomyopathy context. PMID 37622657 supports ventricular-arrhythmia risk and management across cardiomyopathy phenotypes; do not infer arrhythmia from cardiomyopathy alone and do not generalize the source to every nonspecific rhythm abnormality.

## Fail-closed implementation rules

1. Require exact HEAD at the baseline commit above and a clean worktree/index before editing.
2. Resolve each row by `primaryId + targetId`; never by conversational row number alone.
3. Refuse to add a duplicate existing target relationship.
4. Add exactly five relationships and exactly five new clinical source rows.
5. Each added source must use the approved PMID/DOI/URL/citation and must remain `verified:false`.
6. Preserve the approved guard text; do not broaden phenotype, treatment, timing, or etiologic claims.
7. Do not add taxonomy identities, change `draft`, add `pathwayIntelligence`, or alter unrelated verified sources.
8. Citation verification/promotion is a separate later checkpoint requiring new qualified-human approval.
9. No git push, GitHub write, Vercel deploy/promotion/configuration change, or other remote write is authorized.

## Local implementation checkpoint

- **Implementation authorization:** `I approve`
- **Implementation date:** `2026-08-20`
- **Parent local HEAD:** `f4bdd8ed93de2f18fae6305fb98b7d9f1ca22ecc`
- **Edges added:** 5
- **New source rows:** 5
- **New source verification state:** all `verified:false`
- **Citation promotion performed:** no
- **Taxonomy identities added:** 0
- **Publication-status changes:** 0
- **Remote writes performed:** no
