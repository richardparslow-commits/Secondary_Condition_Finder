# Mapping Expansion Batch ME-1 — Citation Verification Ledger

**Status:** APPROVED-AND-IMPLEMENTED-LOCALLY

- **Qualified-human approval:** I approve Recommended approval scope: approve all 5 ME-1 citations as implemented for qualified-human citation promotion, with no source replacements and no further guard changes
- **Approval date:** 2026-08-20
- **Required source commit:** `5d10b9cba70a48a4e99c8b8409c2d7937316d675`
- **Disposition:** 5/5 approve as implemented
- **Guard changes:** 0
- **Source replacements:** 0
- **Final unique PMIDs:** 5
- **Promotion rule:** citation, URL, and publication guard remain unchanged; only qualified-human verification metadata is promoted.
- **Remote writes:** not authorized.

## Expected state transition

| Metric | Pre-promotion | Post-promotion |
|---|---:|---:|
| Relationship edges | 178 | 178 |
| References | 186 | 186 |
| Live verified | 181 | 186 |
| Unverified | 5 | 0 |
| Review findings | 5 | 0 |
| Hard findings | 0 | 0 |
| Verified provenance | 187 | 192 |
| Live clinical URLs | 181 | 181 |
| Combined clinical provenance URLs | 185 | 185 |

## Approved rows

### ME-1.1 — `diabetes-mellitus-type-2 → chronic-kidney-disease`

- **Decision:** `APPROVE AS IMPLEMENTED`
- **PMID:** `41358881`
- **DOI:** `10.2337/dc26-S011`
- **Title:** 11. Chronic Kidney Disease and Risk Management: Standards of Care in Diabetes-2026
- **Source URL:** https://pubmed.ncbi.nlm.nih.gov/41358881/
- **Current state:** `verified:false`
- **Approved promoted state:** `verified:true`

**Approved guard — unchanged**

> Require documented type 2 diabetes mellitus and separately documented chronic kidney disease satisfying accepted chronicity criteria. Where the relationship is represented as diabetes-related CKD, use clinical findings compatible with diabetic kidney disease, including the albuminuria/eGFR pattern and longitudinal course, while evaluating alternative or additional kidney disease when atypical features are present. In the absence of definitive etiologic evidence, describe the phenotype as CKD in a person with type 2 diabetes or presumed diabetic kidney disease, rather than asserting individual causation. Do not relabel transient AKI, an isolated creatinine abnormality, or every CKD diagnosis in a patient with diabetes as diabetic kidney disease.

### ME-1.2 — `diabetes-mellitus-type-2 → diabetic-retinopathy`

- **Decision:** `APPROVE AS IMPLEMENTED`
- **PMID:** `41358886`
- **DOI:** `10.2337/dc26-S012`
- **Title:** 12. Retinopathy, Neuropathy, and Foot Care: Standards of Care in Diabetes-2026
- **Source URL:** https://pubmed.ncbi.nlm.nih.gov/41358886/
- **Current state:** `verified:false`
- **Approved promoted state:** `verified:true`

**Approved guard — unchanged**

> Require documented type 2 diabetes mellitus and separately diagnosed diabetic retinopathy using appropriate ophthalmologic evidence. Do not infer retinopathy from diabetes alone, and do not use this relationship for unrelated retinal disease or visual impairment without a diabetic-retinopathy diagnosis.

### ME-1.3 — `tuberculosis → bronchiectasis`

- **Decision:** `APPROVE AS IMPLEMENTED`
- **PMID:** `36855043`
- **DOI:** `10.5588/ijtld.22.0566`
- **Title:** Post-TB bronchiectasis: from pathogenesis to rehabilitation
- **Source URL:** https://pubmed.ncbi.nlm.nih.gov/36855043/
- **Current state:** `verified:false`
- **Approved promoted state:** `verified:true`

**Approved guard — unchanged**

> Require documented pulmonary tuberculosis preceding separately documented bronchiectasis, with imaging and clinical context consistent with post-tuberculosis structural lung disease. Do not infer bronchiectasis from tuberculosis history alone, and do not generalize this pulmonary-sequela pathway to isolated extrapulmonary tuberculosis.

### ME-1.4 — `inflammatory-bowel-disease → anemia`

- **Decision:** `APPROVE AS IMPLEMENTED`
- **PMID:** `39954228`
- **DOI:** `10.1007/s12664-024-01735-7`
- **Title:** Anemia in inflammatory bowel disease-A comprehensive review
- **Source URL:** https://pubmed.ncbi.nlm.nih.gov/39954228/
- **Current state:** `verified:false`
- **Approved promoted state:** `verified:true`

**Approved guard — unchanged**

> Require documented Crohn disease, ulcerative colitis, or otherwise clinically established inflammatory bowel disease and separately documented anemia. Where anemia is attributed to IBD, require clinical evidence supporting an IBD-related mechanism such as chronic gastrointestinal blood loss/iron deficiency, inflammatory anemia, malabsorption, or another established IBD-related pathway. Do not assume every anemia in a person with IBD is caused by IBD.

### ME-1.5 — `cardiomyopathy → cardiac-arrhythmia`

- **Decision:** `APPROVE AS IMPLEMENTED`
- **PMID:** `37622657`
- **DOI:** `10.1093/eurheartj/ehad194`
- **Title:** 2023 ESC Guidelines for the management of cardiomyopathies
- **Source URL:** https://pubmed.ncbi.nlm.nih.gov/37622657/
- **Current state:** `verified:false`
- **Approved promoted state:** `verified:true`

**Approved guard — unchanged**

> Require documented cardiomyopathy and separately documented clinically significant ventricular arrhythmia, such as ventricular tachycardia or ventricular fibrillation, arising in a clinically compatible structural-cardiomyopathy context. PMID 37622657 supports ventricular-arrhythmia risk and management across cardiomyopathy phenotypes; do not infer arrhythmia from cardiomyopathy alone and do not generalize the source to every nonspecific rhythm abnormality.

## Fail-closed promotion rules

1. Require exact HEAD at the source commit and a clean worktree/index.
2. Verify the committed ME-1 implementation-ledger artifacts by SHA-256 before mutation.
3. Match all five live rows by `primaryId + targetId` and require exact current citation, URL, guard, verification scope, and `verified:false`.
4. Recheck all five PMID/DOI identities against PubMed before mutation.
5. Make no source replacement and no publication-guard change.
6. Promote exactly five source rows to `verified:true` and preserve the other 181 source rows unchanged.
7. Do not change taxonomy, publication status, rank, prevalence, relationship direction, or `pathwayIntelligence`.
8. Run targeted contracts, full repository validation, and require the Vercel freeze guard to exit `2`.
9. Stage only exact runner-owned paths and create a local commit only after all gates succeed.
10. Perform no git push, GitHub write, Vercel deployment/promotion/configuration change, reset, clean, restore, or stash.

## Local promotion result

- Parent HEAD: `5d10b9cba70a48a4e99c8b8409c2d7937316d675`
- 5/5 ME-1 source rows promoted as implemented
- 0 guard changes / 0 source replacements
- Citation state: 186 verified / 0 unverified / 0 review / 0 hard
- Verified provenance: 192 (186 live + 6 retired verified)
- No individual medical nexus is established by citation verification alone
- No push, GitHub write, Vercel deploy/promotion, or Vercel configuration change
