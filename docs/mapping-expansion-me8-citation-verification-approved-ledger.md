# Mapping Expansion ME-8 — Qualified-Human Citation Verification

**APPROVED-AND-APPLIED-LOCALLY**

Required implementation baseline: `92ca42e1484ecbec939cacf21301b7afc1ffd577`

## Independent review disposition

- 5 approve-as-implemented
- 0 approve-with-narrowing
- 0 bibliographic corrections
- 0 source replacements
- 0 rejects/withdrawals

### 1. `malaria -> anemia`
- PMID 30340592 / DOI `10.1186/s12936-018-2509-9`
- Design: clinical review
- Decision: **approve-as-implemented**
- Scope finding: The review directly identifies malaria as a major cause of anemia and describes hemolysis of infected and uninfected erythrocytes plus marrow dyserythropoiesis. The implemented chronology and competing-cause guard is appropriately narrower than the population-level review.
- Final proposition: Malaria can produce clinically significant anemia through hemolysis of infected and uninfected erythrocytes and impaired erythropoiesis; the relationship is strongest when anemia is temporally linked to active or recent malaria.
- Final guard: Require established malaria and a separately documented anemia phenotype with compatible timing. Do not infer chronic anemia from remote resolved malaria. Preserve nutritional deficiency, blood loss, hemoglobinopathy, chronic kidney disease, marrow disease, hemolysis from other causes, and other competing etiologies.
- Citation: White NJ. Anaemia and malaria. Malar J. 2018;17(1):371. PMID 30340592. doi:10.1186/s12936-018-2509-9.

### 2. `hiv-aids -> peripheral-neuropathy`
- PMID 33226721 / DOI `10.1111/ene.14656`
- Design: systematic review and meta-analysis (94 articles)
- Decision: **approve-as-implemented**
- Scope finding: The systematic review directly supports HIV-related peripheral neuropathy, identifies distal predominantly sensory polyneuropathy as the commonest phenotype, and recognizes primary HIV, opportunistic/inflammatory mechanisms, and ART adverse effects. The implementation correctly separates disease and treatment mechanisms and preserves competing causes.
- Final proposition: HIV/AIDS is associated with a distinct spectrum of peripheral neuropathies, especially distal predominantly sensory polyneuropathy, through HIV disease mechanisms and, in some patients, treatment-related neurotoxicity.
- Final guard: Require established HIV/AIDS and a separately diagnosed peripheral-neuropathy phenotype. Distinguish HIV-related disease mechanisms from antiretroviral neurotoxicity and preserve diabetes, alcohol, nutritional deficiency, chemotherapy, compressive neuropathy, opportunistic infection, and other neurologic causes.
- Citation: Julian T, Rekatsina M, Shafique F, Zis P. Human immunodeficiency virus-related peripheral neuropathy: A systematic review and meta-analysis. Eur J Neurol. 2021;28(4):1420-1431. PMID 33226721. doi:10.1111/ene.14656.

### 3. `myelodysplastic-syndrome -> anemia`
- PMID 26404446 / DOI `10.1053/j.seminhematol.2015.06.002`
- Design: clinical review
- Decision: **approve-as-implemented**
- Scope finding: The review states that MDS shares anemia in the great majority of cases and explains ineffective erythropoiesis as a central mechanism. The implementation remains appropriately diagnosis-specific and requires independent documentation of anemia and competing-cause review.
- Final proposition: Anemia is a major clinical manifestation of myelodysplastic syndromes and may arise from ineffective/dysplastic erythropoiesis.
- Final guard: Require established myelodysplastic syndrome and separately documented anemia. Do not attribute every anemia automatically to MDS; preserve bleeding, iron/B12/folate deficiency, chronic kidney disease, hemolysis, treatment effects, inflammatory disease, and other marrow disorders.
- Citation: Santini V. Anemia as the Main Manifestation of Myelodysplastic Syndromes. Semin Hematol. 2015;52(4):348-356. PMID 26404446. doi:10.1053/j.seminhematol.2015.06.002.

### 4. `primary-myelofibrosis -> anemia`
- PMID 18947294 / DOI `10.1146/annurev.med.60.041707.160528`
- Design: clinical review
- Decision: **approve-as-implemented**
- Scope finding: The review explicitly lists anemia among the clinical hallmarks of primary myelofibrosis. The existing implementation does not overstate individual causation and appropriately preserves alternative and contributing causes of anemia.
- Final proposition: Anemia is a recognized clinical hallmark of primary myelofibrosis in the setting of marrow fibrosis and disordered hematopoiesis.
- Final guard: Require established primary myelofibrosis and separately documented anemia. Preserve bleeding, nutritional deficiency, renal disease, hemolysis, treatment effects, coexisting marrow disease, and leukemic transformation as competing or contributing explanations.
- Citation: Abdel-Wahab OI, Levine RL. Primary myelofibrosis: update on definition, pathogenesis, and treatment. Annu Rev Med. 2009;60:233-245. PMID 18947294. doi:10.1146/annurev.med.60.041707.160528.

### 5. `heart-transplant-residuals -> chronic-kidney-disease`
- PMID 25134671 / DOI `10.1007/s40265-014-0274-9`
- Design: clinical review
- Decision: **approve-as-implemented**
- Scope finding: The review directly describes renal dysfunction after heart transplantation as frequent and explicitly characterizes chronic kidney disease as multifactorial, with calcineurin-inhibitor nephrotoxicity acting on a predisposed recipient. The implementation already contains the necessary actual-transplant, chronology, and competing-cause restrictions.
- Final proposition: Chronic kidney disease is a recognized post-heart-transplant complication, with calcineurin-inhibitor nephrotoxicity acting within a multifactorial post-transplant risk model.
- Final guard: Require an actual heart transplant and separately established post-transplant chronic kidney disease with compatible chronology. Do not infer CKD from transplant status alone. Preserve preexisting CKD, diabetes, hypertension, perioperative acute kidney injury, cardiorenal/hemodynamic factors, rejection-related injury, and other nephrotoxic exposures.
- Citation: González-Vílchez F, Vázquez de Prada JA. Chronic renal insufficiency in heart transplant recipients: risk factors and management options. Drugs. 2014;74(13):1481-1494. PMID 25134671. doi:10.1007/s40265-014-0274-9.

## Verification-only boundary

This gate may change only citation verification state and normalized master-source activation state for the five ME-8 sources. It does not authorize any rationale, evidence-gap, phenotype, publication-guard, citation-text, PMID/DOI identity, relationship, rank, taxonomy, publication-state, or pathwayIntelligence change.

Expected verified endpoint: 221/221 live references verified, 0 unverified, 0 review, 0 hard; 227 verified provenance; 198 active / 0 pending master sources; 197 active clinical / 0 pending clinical; 207 total source entities.

## Human source-level approval

On 2026-08-21, the five independently reviewed ME-8 source-level dispositions were explicitly approved as:

- 5 approve-as-implemented.
- 0 narrowing.
- 0 bibliographic corrections.
- 0 source replacements.
- 0 semantic changes.

Approved statement:

> I approve all five ME-8 source-level citation-verification dispositions as approve-as-implemented, with no narrowing, bibliographic correction, source replacement, or semantic change.

This approval authorizes the bounded local-only citation-state promotion described by this package. It does not authorize GitHub/Vercel writes or any medical, semantic, bibliographic, taxonomy, rank, publication-state, or source-identity change.

## Local citation-verification result

- 5/5 ME-8 clinical references promoted to `verified:true`.
- 5/5 normalized master sources promoted to `active`.
- 5/5 decisions recorded as `approve-as-implemented`.
- 0 semantic changes, 0 guard changes, 0 citation corrections, 0 source replacements, 0 source identity changes, 0 remote writes.
