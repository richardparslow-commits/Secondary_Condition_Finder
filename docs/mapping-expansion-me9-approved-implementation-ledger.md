# Mapping Expansion ME-9 — Approved Implementation Ledger

**Status:** APPROVED-AND-IMPLEMENTED-LOCALLY — CITATIONS PENDING VERIFICATION

Required baseline: `ba0fe8490a81c20e94f4bc1f8ea5efbeb6fae083`

## Approved five

### 1. `discoid-lupus -> systemic-lupus-erythematosus`
- Current P1: `scarring-alopecia`
- Rank: 2
- PMID 41178896 / DOI `10.25122/jml-2025-0141`
- Source action from research: retain-screening-source
- Source: Alharbi A, Alamri O, Afandi A, Arbaeen A, Mirza A, Alahmari A, Alshomrani S, Qashqari M, Alahmadi M, Alharthy S, Kokandi A. Discoid lupus erythematosus and its progression to systemic lupus erythematosus across age groups: a systematic review. J Med Life. 2025;18(9):830-836. PMID 41178896. doi:10.25122/jml-2025-0141.
- Phenotype restriction: established discoid lupus erythematosus with separately established systemic lupus erythematosus meeting appropriate classification/diagnostic criteria
- Proposition: Discoid lupus erythematosus can progress to systemic lupus erythematosus in a clinically meaningful subset of patients.
- Publication guard: Require established discoid lupus erythematosus and separately established systemic lupus erythematosus meeting appropriate classification or diagnostic criteria. Do not infer SLE from DLE alone. Preserve ANA and other autoantibody findings, hematologic abnormalities, systemic manifestations, family history, and other classification criteria as independent diagnostic evidence.

### 2. `colorectal-cancer -> fecal-incontinence`
- Current P1: `peripheral-neuropathy`
- Rank: 2
- PMID 33277056 / DOI `10.1016/j.ejso.2020.11.136`
- Source action from research: replace-screening-source
- Source: Verkuijl SJ, Jonker JE, Trzpis M, Burgerhof JGM, Broens PMA, Furnée EJB. Functional outcomes of surgery for colon cancer: A systematic review and meta-analysis. Eur J Surg Oncol. 2021;47(5):960-969. PMID 33277056. doi:10.1016/j.ejso.2020.11.136.
- Phenotype restriction: colon cancer within the colorectal-cancer identity, actual bowel resection/colectomy, and separately documented fecal incontinence with compatible postoperative chronology
- Proposition: Fecal incontinence is a recognized long-term bowel-function complication after surgical treatment for colon cancer.
- Publication guard: Require established colon cancer within the colorectal-cancer identity, actual colectomy or other bowel resection, and separately documented fecal incontinence with compatible postoperative chronology. Do not infer fecal incontinence from colorectal-cancer diagnosis alone, and do not generalize this colon-cancer surgical source to nonsurgical disease or rectal-cancer treatment without separate evidence. Preserve pre-existing continence disorders, neurologic disease, pelvic-floor dysfunction, inflammatory bowel disease, obstetric injury, medications, and other anorectal causes.

### 3. `hypogonadism -> erectile-dysfunction`
- Current P1: `osteoporosis`
- Rank: 2
- PMID 34856556 / DOI `10.1159/000520135`
- Source action from research: replace-screening-source
- Source: Taniguchi H, Shimada S, Kinoshita H. Testosterone Therapy for Late-Onset Hypogonadism Improves Erectile Function: A Systematic Review and Meta-Analysis. Urol Int. 2022;106(6):539-552. PMID 34856556. doi:10.1159/000520135.
- Phenotype restriction: adult male androgen-deficiency hypogonadism consistent with the late-onset hypogonadism evidence and separately documented erectile dysfunction
- Proposition: Androgen-deficiency hypogonadism is clinically linked to impaired erectile function, and testosterone treatment in late-onset hypogonadism improves erectile-function scores at the population level.
- Publication guard: Require established androgen-deficiency hypogonadism consistent with the source population, including late-onset hypogonadism when relying on this citation, and separately documented erectile dysfunction. Do not attribute every erectile-dysfunction case to hypogonadism. Preserve vascular and metabolic disease, diabetes, medication effects, neurologic disease, pelvic surgery, psychogenic factors, other endocrine disorders, and structural or urologic causes.

### 4. `pancreatitis -> pancreatic-cancer`
- Current P1: `cardiac-inflammatory-disease`
- Rank: 2
- PMID 35142721 / DOI `10.14309/ctg.0000000000000463`
- Source action from research: replace-screening-source-and-narrow-primary-phenotype
- Source: Gandhi S, de la Fuente J, Murad MH, Majumder S. Chronic Pancreatitis Is a Risk Factor for Pancreatic Cancer, and Incidence Increases With Duration of Disease: A Systematic Review and Meta-analysis. Clin Transl Gastroenterol. 2022;13(3):e00463. PMID 35142721. doi:10.14309/ctg.0000000000000463.
- Phenotype restriction: chronic pancreatitis with separately established pancreatic cancer developing after the chronic-pancreatitis diagnosis with chronology that reduces reverse-causation risk
- Proposition: Chronic pancreatitis is associated with a substantially increased subsequent risk of pancreatic ductal adenocarcinoma, with risk increasing with disease duration.
- Publication guard: Primary phenotype must be chronic pancreatitis, not an isolated acute-pancreatitis episode. Require separately established pancreatic cancer and chronology compatible with cancer developing after chronic pancreatitis. Do not infer cancer from pancreatitis alone. Preserve hereditary syndromes, smoking, age, diabetes, obesity, alcohol exposure, other pancreatic-cancer risk factors, and the possibility that occult pancreatic cancer initially presented as pancreatitis.

### 5. `hypoparathyroidism -> chronic-kidney-disease`
- Current P1: `kidney-stones`
- Rank: 2
- PMID 33599907 / DOI `10.1007/s11154-020-09613-1`
- Source action from research: replace-screening-source
- Source: Gosmanova EO, Houillier P, Rejnmark L, Marelli C, Bilezikian JP. Renal complications in patients with chronic hypoparathyroidism on conventional therapy: a systematic literature review: renal disease in chronic hypoparathyroidism. Rev Endocr Metab Disord. 2021;22(2):297-316. PMID 33599907. doi:10.1007/s11154-020-09613-1.
- Phenotype restriction: chronic hypoparathyroidism with separately established chronic kidney disease; when conventional calcium/active-vitamin-D therapy is relied upon, documented treatment exposure and compatible chronology are required
- Proposition: Chronic hypoparathyroidism, particularly under long-term conventional calcium and active-vitamin-D therapy, is associated with increased renal complications including chronic kidney disease or renal insufficiency.
- Publication guard: Require chronic hypoparathyroidism and separately established chronic kidney disease. Where conventional calcium and active-vitamin-D therapy is relied upon as the pathway, require documented treatment exposure and compatible chronology. Preserve pre-existing CKD, diabetes, hypertension, recurrent acute kidney injury, nephrotoxic drugs, obstruction, nephrolithiasis or nephrocalcinosis, and other renal-disease causes.

## Fail-closed identity precheck

Before any repository mutation, all five proposed relationship IDs, PMIDs, DOIs, and live PubMed identities must be absent from the authoritative local registries/current live references. Any collision stops the package before mutation for a separate disposition.

## Projected state only if all five source identities are new

- 311 identities / 139 published / 172 draft
- 218 relationships / P1 76 / P2+ 63 / D1 1
- 226 live references: 221 verified / 5 unverified / 5 review / 0 hard
- 227 verified provenance
- 221 live clinical references / 221 clinical URLs / 225 clinical provenance URLs
- 198 active / 5 pending / 212 total master sources
- 197 active clinical / 5 pending clinical / 1 active legal
- 144 explicit publication guards / 74 legacy rationale boundaries

## Authorization boundary

Citation promotion and qualified-human citation verification are not part of ME-9 implementation. No GitHub/Vercel write is authorized.

## Local implementation result

- 5/5 relationships installed at rank 2.
- 5/5 new clinical sources remain `verified:false`.
- 5/5 normalized master sources are `pending-verification`.
- No citation promotion, semantic broadening, identity/catalog change, publication-state change, rank-1 change, pathwayIntelligence change, GitHub write, or Vercel action.
