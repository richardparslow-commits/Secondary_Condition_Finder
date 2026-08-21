# Mapping Expansion ME-8 — Approved Implementation Ledger

**Status:** APPROVED-AND-IMPLEMENTED-LOCALLY — CITATIONS PENDING VERIFICATION
**Required baseline:** `b6f3cb405ed0ba8aae54349f9c85ee5ed0ee0f2e`
**Intended commit:** `map: mapping expansion ME-8 (5 relationships)`

Implementation is limited to these five revalidated rank-2 relationships. All five new references remain `verified:false` and master sources remain `pending-verification` until a separate qualified-human citation-verification gate.

## 1. `malaria -> anemia`
- Preserve current P1: `epilepsy`
- PMID 30340592 / DOI `10.1186/s12936-018-2509-9`
- Citation: White NJ. Anaemia and malaria. Malar J. 2018;17(1):371. PMID 30340592. doi:10.1186/s12936-018-2509-9.
- Proposition: Malaria can produce clinically significant anemia through hemolysis of infected and uninfected erythrocytes and impaired erythropoiesis; the relationship is strongest when anemia is temporally linked to active or recent malaria.
- Guard: Require established malaria and a separately documented anemia phenotype with compatible timing. Do not infer chronic anemia from remote resolved malaria. Preserve nutritional deficiency, blood loss, hemoglobinopathy, chronic kidney disease, marrow disease, hemolysis from other causes, and other competing etiologies.

## 2. `hiv-aids -> peripheral-neuropathy`
- Preserve current P1: `uveitis`
- PMID 33226721 / DOI `10.1111/ene.14656`
- Citation: Julian T, Rekatsina M, Shafique F, Zis P. Human immunodeficiency virus-related peripheral neuropathy: A systematic review and meta-analysis. Eur J Neurol. 2021;28(4):1420-1431. PMID 33226721. doi:10.1111/ene.14656.
- Proposition: HIV/AIDS is associated with a distinct spectrum of peripheral neuropathies, especially distal predominantly sensory polyneuropathy, through HIV disease mechanisms and, in some patients, treatment-related neurotoxicity.
- Guard: Require established HIV/AIDS and a separately diagnosed peripheral-neuropathy phenotype. Distinguish HIV-related disease mechanisms from antiretroviral neurotoxicity and preserve diabetes, alcohol, nutritional deficiency, chemotherapy, compressive neuropathy, opportunistic infection, and other neurologic causes.

## 3. `myelodysplastic-syndrome -> anemia`
- Preserve current P1: `leukemia`
- PMID 26404446 / DOI `10.1053/j.seminhematol.2015.06.002`
- Citation: Santini V. Anemia as the Main Manifestation of Myelodysplastic Syndromes. Semin Hematol. 2015;52(4):348-356. PMID 26404446. doi:10.1053/j.seminhematol.2015.06.002.
- Proposition: Anemia is a major clinical manifestation of myelodysplastic syndromes and may arise from ineffective/dysplastic erythropoiesis.
- Guard: Require established myelodysplastic syndrome and separately documented anemia. Do not attribute every anemia automatically to MDS; preserve bleeding, iron/B12/folate deficiency, chronic kidney disease, hemolysis, treatment effects, inflammatory disease, and other marrow disorders.

## 4. `primary-myelofibrosis -> anemia`
- Preserve current P1: `leukemia`
- PMID 18947294 / DOI `10.1146/annurev.med.60.041707.160528`
- Citation: Abdel-Wahab OI, Levine RL. Primary myelofibrosis: update on definition, pathogenesis, and treatment. Annu Rev Med. 2009;60:233-245. PMID 18947294. doi:10.1146/annurev.med.60.041707.160528.
- Proposition: Anemia is a recognized clinical hallmark of primary myelofibrosis in the setting of marrow fibrosis and disordered hematopoiesis.
- Guard: Require established primary myelofibrosis and separately documented anemia. Preserve bleeding, nutritional deficiency, renal disease, hemolysis, treatment effects, coexisting marrow disease, and leukemic transformation as competing or contributing explanations.

## 5. `heart-transplant-residuals -> chronic-kidney-disease`
- Preserve current P1: `skin-cancer`
- PMID 25134671 / DOI `10.1007/s40265-014-0274-9`
- Citation: González-Vílchez F, Vázquez de Prada JA. Chronic renal insufficiency in heart transplant recipients: risk factors and management options. Drugs. 2014;74(13):1481-1494. PMID 25134671. doi:10.1007/s40265-014-0274-9.
- Proposition: Chronic kidney disease is a recognized post-heart-transplant complication, with calcineurin-inhibitor nephrotoxicity acting within a multifactorial post-transplant risk model.
- Guard: Require an actual heart transplant and separately established post-transplant chronic kidney disease with compatible chronology. Do not infer CKD from transplant status alone. Preserve preexisting CKD, diabetes, hypertension, perioperative acute kidney injury, cardiorenal/hemodynamic factors, rejection-related injury, and other nephrotoxic exposures.

## Projected pending-verification state

- 311 identities / 139 published / 172 draft
- 213 relationships / P1 81 / P2+ 58 / D1 1
- 221 live refs / 216 verified / 5 pending / 5 review / 0 hard
- 193 active / 5 pending / 207 total master sources
- 139 explicit publication guards / 74 legacy boundaries

No citation promotion, taxonomy change, publication-state change, rank-1 change, pathwayIntelligence change, semantic broadening, GitHub write, or Vercel action is authorized.

## Local implementation result

- 5/5 relationships installed at rank 2.
- 5/5 new clinical sources remain `verified:false`.
- 5/5 normalized master sources are `pending-verification`.
- No citation promotion, semantic broadening, identity/catalog change, publication-state change, rank-1 change, pathwayIntelligence change, GitHub write, or Vercel action.
