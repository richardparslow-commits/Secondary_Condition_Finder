# Mapping Expansion Batch ME-35 — Proposed Research Ledger

## Status and approval boundary

**Status: APPROVED-AND-IMPLEMENTED-LOCALLY — RESEARCH RECORD RETAINED**

This ledger records the five candidate relationships identified after screening the unmapped `b*` identities. The user approved the batch for local implementation; the resulting KB, registry, ledger, and regression updates are recorded in the approved implementation ledger. Each source remains `verified: false` until the separate qualified-human citation-verification gate.

## Proposed scope

| Rank | Primary | Target | PMID | Evidence type | Proposal confidence |
|---:|---|---|---:|---|---|
| 1 | `brown-s-quard-syndrome` | `urinary-incontinence` | 11746547 | Syndrome-specific urodynamic study | Moderate, narrow phenotype |
| 2 | `brain-tumors` | `seizure-disorder` | 26332282 | Longitudinal pediatric brain-tumor survivor cohort | Moderate, pediatric/site-limited |
| 3 | `brugada-syndrome` | `cardiac-arrhythmia` | 27378596 | Brugada cohort examining ventricular arrhythmia and sudden-death risk | Moderate, ventricular-arrhythmia-specific |
| 4 | `bell-s-palsy` | `keratitis` | 28319442 | 23-year retrospective facial-palsy ophthalmic-sequelae review | Moderate, exposure-keratopathy phenotype only |
| 5 | `bowen-s-disease` | `squamous-cell-carcinoma` | 7804989 | Skin-cancer precursor review | Moderate, in-situ-to-invasive progression only |

## Candidate research boundaries

### 1. Brown-Séquard syndrome → urinary incontinence

- **Source:** Sakakibara R, Hattori T, Uchiyama T, et al. *Urinary dysfunction in Brown-Séquard syndrome.* Neurourology and Urodynamics. 2001;20(6):661-667. PMID 11746547. DOI: `10.1002/nau.1017`.
- **Source URL:** https://pubmed.ncbi.nlm.nih.gov/11746547/
- **Proposed guard:** Require independently documented Brown-Séquard syndrome by compatible spinal-cord lesion and neurologic examination, separately documented urinary incontinence or neurogenic lower-urinary-tract dysfunction by validated assessment/urodynamics, compatible chronology, and neurologic or urologic review. Do not infer incontinence from spinal pain, weakness, or a nonspecific spinal-cord diagnosis alone. Preserve urinary retention/overflow, infection, prostate or pelvic disease, medication effects, prior incontinence, and other neurogenic-bladder causes.
- **CRG posture:** `ASSOCIATION_ONLY` / `NOT_ESTABLISHED` / `NOT_ASSERTED`; `MECHANICAL_OR_COMPRESSIVE`; hypothesized only.
- **Scope note:** The study is syndrome-specific but small and addresses urinary dysfunction broadly. The proposed target must be limited to objectively documented incontinence or a clearly compatible lower-urinary-tract phenotype, not every urinary symptom.

### 2. Brain tumors → seizure disorder

- **Source:** Ullrich NJ, Pomeroy SL, Kapur K, Manley PE, Goumnerova L, Smith ER, et al. *Incidence, risk factors, and longitudinal outcome of seizures in long-term survivors of pediatric brain tumors.* Epilepsia. 2015;56(10):1599-1604. PMID 26332282. DOI: `10.1111/epi.13112`.
- **Source URL:** https://pubmed.ncbi.nlm.nih.gov/26332282/
- **Proposed guard:** Require independently documented brain tumor with location, pathology, treatment, and chronology, plus a separately established seizure disorder/epilepsy diagnosis supported by neurologic assessment and appropriate EEG or imaging when indicated. Distinguish acute symptomatic seizures during tumor treatment from later unprovoked seizures. Preserve cortical location, surgery, radiation, recurrence, stroke, medication effects, prior epilepsy, metabolic triggers, and other seizure causes.
- **CRG posture:** `ASSOCIATION_ONLY` / `NOT_ESTABLISHED` / `NOT_ASSERTED`; `NEUROLOGICAL_DEGENERATION`; hypothesized only.
- **Scope note:** The source is pediatric and survivor-focused. The broad `brain-tumors` identity must not be treated as equivalent to every adult tumor type or every seizure during acute illness; implementation should explicitly retain the pediatric/survivor evidence limitation.

### 3. Brugada syndrome → cardiac arrhythmia

- **Source:** Rivard L, Roux A, Nault I, Champagne J, Roux JF, Tadros R, et al. *Predictors of Ventricular Arrhythmias and Sudden Death in a Québec Cohort With Brugada Syndrome.* Canadian Journal of Cardiology. 2016;32(11):1355.e1-1355.e7. PMID 27378596. DOI: `10.1016/j.cjca.2016.03.012`.
- **Source URL:** https://pubmed.ncbi.nlm.nih.gov/27378596/
- **Proposed guard:** Require independently diagnosed Brugada syndrome with documented type-1 ECG phenotype or specialist electrophysiology confirmation, and separately documented ventricular arrhythmia or qualifying arrhythmic event with compatible chronology. Do not infer arrhythmia from a Brugada pattern alone, palpitations, syncope without evaluation, or family history. Preserve structural heart disease, ischemia, channelopathy overlap, electrolyte disturbance, fever/drug triggers, and other arrhythmia causes.
- **CRG posture:** `ASSOCIATION_ONLY` / `NOT_ESTABLISHED` / `NOT_ASSERTED`; `THROMBOTIC_OR_VASCULAR`; hypothesized only.
- **Scope note:** The evidence concerns ventricular arrhythmia and sudden-death risk, not generic benign ectopy or every `cardiac-arrhythmia` presentation. The implementation guard must keep the target phenotype narrow.

### 4. Bell's palsy → keratitis

- **Source:** Joseph SS, Joseph AW, Smith JI, Niziol LM, Musch DC, Nelson CC. *Evaluation of Patients with Facial Palsy and Ophthalmic Sequelae: A 23-Year Retrospective Review.* Ophthalmic Epidemiology. 2017;24(5):341-345. PMID 28319442. DOI: `10.1080/09286586.2017.1294186`.
- **Source URL:** https://pubmed.ncbi.nlm.nih.gov/28319442/
- **Proposed guard:** Require independently documented Bell's palsy or facial-nerve palsy with incomplete eyelid closure or other documented ocular-surface exposure, and separately documented exposure keratopathy, corneal epithelial defect, ulcer, or a clinically defined keratitis phenotype with compatible chronology. Do not infer generic keratitis from Bell's palsy, facial weakness, eye discomfort, or redness alone. Preserve infectious, contact-lens, autoimmune, traumatic, postoperative, neurotrophic, medication-related, and other corneal causes.
- **CRG posture:** `ASSOCIATION_ONLY` / `NOT_ESTABLISHED` / `NOT_ASSERTED`; `MECHANICAL_OR_COMPRESSIVE`; hypothesized only.
- **Scope note:** The source is facial-palsy ophthalmic-sequelae evidence, not a Bell's-palsy-only randomized or prospective etiologic study. The broad `keratitis` target must be constrained to exposure-related ocular-surface injury and must not generalize to infectious keratitis.

### 5. Bowen's disease → squamous-cell carcinoma

- **Source:** Sober AJ, Burstein JM. *Precursors to skin cancer.* Cancer. 1995;75(2 Suppl):645-650. PMID 7804989. DOI: `10.1002/1097-0142(19950115)75:2+<645::AID-CNCR2820751405>3.0.CO;2-1`.
- **Source URL:** https://pubmed.ncbi.nlm.nih.gov/7804989/
- **Proposed guard:** Require biopsy-confirmed Bowen's disease/cutaneous squamous-cell carcinoma in situ and separately established invasive cutaneous squamous-cell carcinoma at a compatible site and chronology. Do not infer invasion from clinical morphology, dysplasia alone, recurrence, or an untreated lesion without histopathologic confirmation. Preserve field cancerization, ultraviolet exposure, immunosuppression, HPV, treatment effects, and other skin-cancer risk factors.
- **CRG posture:** `ASSOCIATION_ONLY` / `NOT_ESTABLISHED` / `NOT_ASSERTED`; `MALIGNANT_TRANSFORMATION`; hypothesized only.
- **Scope note:** The proposed target is invasive cutaneous squamous-cell carcinoma, not visceral cancer or generic `skin-cancer`. The source is a review and should not be represented as a deterministic individual progression claim.

## Implementation requirements if approved

1. Confirm mapping approval for all five rows and the exact guards above.
2. Reconfirm each citation identity and full bibliographic metadata during implementation; PubMed pages were search-verified but direct page extraction was cookie-gated in this environment.
3. Add one rank-1 suggestion to each existing draft primary without changing its `draft: true` state.
4. Add CRG-compliant `ASSOCIATION_ONLY` metadata, one `clinical-evidence` source reference per row, `verified: false`, and bounded competing-cause evidence gaps.
5. Add exact relationship and source-registry rows using repository canonicalization and recomputed hashes.
6. Create the approved implementation ledger and regression contract only after approval; update aggregate counts from the actual registry output rather than estimates.
7. Run KB validation, ME compliance, master-registry audit, citation audit, typecheck, lint, focused tests, and the full test suite.

## Explicit exclusions from ME-35 screening

- `baker-s-cyst → deep-vein-thrombosis`: excluded because the strongest evidence describes a diagnostic mimic and a 2022 study reports popliteal cysts are not a DVT risk factor.
- `bullous-pemphigoid → Parkinson's disease/dementia`: excluded because the evidence is an association in the reverse/unclear direction and does not support a downstream causal mapping from bullous pemphigoid.
- `bronchitis → pneumonia`: excluded from this batch because available results were acute-care or ventilator-associated contexts and did not establish a durable generic bronchitis-primary target identity.
- `byssinosis → COPD`: excluded pending a source that distinguishes occupational byssinosis from generic organic-dust exposure and supplies a target-specific longitudinal proposition.
- `basal-cell-carcinoma → squamous-cell-carcinoma`: excluded because available evidence supports shared risk and multiple-primary skin-cancer risk, not a defensible direct progression edge.
- `bell-s-palsy → generic visual impairment`: excluded because the available evidence supports a specific exposure-keratopathy/corneal-injury phenotype rather than an unrestricted visual-loss target.

## Approval decision requested

The five rows were approved as a single ME-35 implementation batch. Approval covers relationship direction, target phenotype, guard text, and mapping posture only; citation verification remains a separate human-controlled gate.

## Safety boundary

These records are evidence-navigation aids only. They do not diagnose a condition, establish a VA medical nexus, determine service connection, or replace qualified clinical and accredited-representative review. The batch is implemented locally but remains draft-only and fail-closed pending validation and citation review.
