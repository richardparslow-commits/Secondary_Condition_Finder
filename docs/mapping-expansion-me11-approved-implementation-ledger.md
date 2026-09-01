# Mapping Expansion ME-11 — Approved Implementation Ledger

**Status:** APPROVED-AND-IMPLEMENTED-LOCALLY — CITATIONS PENDING VERIFICATION

Required baseline: `adf648abbff619d7546373e0084a1fdc9d09d7e7`

## Approved five

### 1. `actinomycosis -> osteomyelitis`
- Current rank-1: `cardiac-inflammatory-disease`
- Rank: 2
- Final PMID 41871568 / DOI `10.24953/turkjpediatr.2026.6451`
- Source action: **retain-first-pass-source-with-phenotype-narrowing**
- Citation: Yildirim Arslan S, Tigrak S, Yucel E, Demirci M, Ekici O. Pediatric cervicofacial actinomycosis presenting with mandibular osteomyelitis: a diagnostic and therapeutic challenge and literature review. Turk J Pediatr. 2026. PMID 41871568. doi:10.24953/turkjpediatr.2026.6451.
- Proposition: Actinomycotic osteomyelitis is a rare chronic infection caused by Actinomyces species; mandibular involvement can occur in cervicofacial/oral actinomycosis.
- Phenotype restriction: cervicofacial/oral actinomycosis with compatible mandibular involvement; target is mandibular osteomyelitis
- Relationship class: `rare-infectious-complication`
- Publication guard: Require clinically established cervicofacial/oral actinomycosis plus a separately diagnosed mandibular osteomyelitis phenotype. Do not generalize to all actinomycosis or all osteomyelitis. Preserve odontogenic infection, trauma, surgery, malignancy and other infectious causes. The source is rare-disease/case-plus-review evidence and must not be presented as population-level causal proof.
- Implementation source state: `verified:false` / master `pending-verification`

### 2. `insomnia -> hypertension`
- Current rank-1: `depressive-disorder`
- Rank: 2
- Final PMID 33360604 / DOI `10.1016/j.smrv.2020.101403`
- Source action: **replace-first-pass-retrieval-source**
- Citation: Li L, Gan Y, Zhou X, et al. Insomnia and the risk of hypertension: A meta-analysis of prospective cohort studies. Sleep Med Rev. 2021;56:101403. PMID 33360604. doi:10.1016/j.smrv.2020.101403.
- Proposition: Across 14 prospective cohorts involving 395,641 participants, insomnia was associated with increased incident hypertension risk (pooled RR 1.21, 95% CI 1.10-1.33).
- Phenotype restriction: independently established insomnia and separately diagnosed hypertension
- Relationship class: `population-level-risk-association-only`
- Publication guard: Treat as population-level association/risk only, not individual causation. Evidence was stronger for difficulty maintaining sleep and early-morning awakening than for sleep-onset difficulty. Preserve obstructive sleep apnea, obesity, age, sex, renal/endocrine disease, medications/substances, sleep duration and other conventional hypertension risks.
- Implementation source state: `verified:false` / master `pending-verification`

### 3. `periodontal-disease -> osteoporosis`
- Current rank-1: `loss-of-teeth`
- Rank: 2
- Final PMID 36377800 / DOI `10.1111/cdoe.12812`
- Source action: **replace-first-pass-retrieval-source-and-narrow-to-periodontitis**
- Citation: Larvin H, Kang J, Aggarwal VR, Pavitt S, Wu J. Periodontitis and risk of immune-mediated systemic conditions: A systematic review and meta-analysis. Community Dent Oral Epidemiol. 2023;51(5):705-717. PMID 36377800. doi:10.1111/cdoe.12812.
- Proposition: Longitudinal evidence found increased incident osteoporosis risk among people with periodontitis versus controls (RR 1.40, 95% CI 1.12-1.75).
- Phenotype restriction: clinically established periodontitis rather than nonspecific periodontal disease; osteoporosis separately diagnosed
- Relationship class: `population-level-risk-association-only`
- Publication guard: Require periodontitis as the primary phenotype and separately diagnosed osteoporosis. Treat as longitudinal population-level risk/association only. Preserve age, sex/menopause, smoking, glucocorticoid exposure, nutritional status, endocrine disease, immobility, medications and other osteoporosis risks.
- Implementation source state: `verified:false` / master `pending-verification`

### 4. `uterine-fibroids -> endometriosis`
- Current rank-1: `anemia`
- Rank: 2
- Final PMID 31006843 / DOI `10.1007/s00404-019-05153-5`
- Source action: **replace-first-pass-retrieval-source**
- Citation: Nicolaus K, Bräuer D, Sczesny R, Lehmann T, Diebolder H, Runnebaum IB. Unexpected coexistent endometriosis in women with symptomatic uterine leiomyomas is independently associated with infertility, nulliparity and minor myoma size. Arch Gynecol Obstet. 2019;300(1):103-108. PMID 31006843. doi:10.1007/s00404-019-05153-5.
- Proposition: Among women undergoing laparoscopic myomectomy for symptomatic leiomyomas, 25.6% had unexpected histologically confirmed endometriosis, supporting clinically relevant co-occurrence.
- Phenotype restriction: symptomatic uterine leiomyomas/fibroids with separately diagnosed endometriosis
- Relationship class: `cooccurrence-association-only`
- Publication guard: Treat strictly as co-occurrence/association and screening relevance, not fibroids causing endometriosis. Preserve shared estrogen-related biology, age, infertility/nulliparity, referral and surgical-selection bias, and other endometriosis risk factors.
- Implementation source state: `verified:false` / master `pending-verification`

### 5. `bronchiolitis -> pulmonary-hypertension`
- Current rank-1: `asthma`
- Rank: 2
- Final PMID 42444963 / DOI `10.21037/jtd-2026-0713`
- Source action: **retain-second-pass-source-with-transplant-bos-phenotype-narrowing**
- Citation: Bachar R, Tager D, Berro J, Nero N, Sehgal S, Mehta AC. Pulmonary hypertension following lung transplant: a systematic review. J Thorac Dis. 2026;18(6):685. PMID 42444963. doi:10.21037/jtd-2026-0713.
- Proposition: In lung-transplant recipients with post-transplant pulmonary hypertension, chronic lung allograft dysfunction—particularly bronchiolitis obliterans syndrome—was the most frequently reported etiology/association, accounting for 63% of included cases.
- Phenotype restriction: post-lung-transplant bronchiolitis obliterans syndrome/chronic lung allograft dysfunction; pulmonary hypertension separately diagnosed
- Relationship class: `transplant-context-complication-association`
- Publication guard: Use only for bronchiolitis obliterans syndrome/chronic lung allograft dysfunction after lung transplantation, with separately diagnosed pulmonary hypertension. Do not generalize to ordinary acute bronchiolitis. Preserve vascular/anastomotic complications, recurrent idiopathic pulmonary arterial hypertension, recurrent thromboembolic disease, left-heart/diastolic dysfunction, underlying transplant indication and other pulmonary-hypertension causes. The review calls for prospective longitudinal studies; do not state individual causation.
- Implementation source state: `verified:false` / master `pending-verification`

## Approval boundary

- Exactly five new rank-2 relationships.
- No new identities.
- No rank-1, taxonomy, publication-state, or pathwayIntelligence changes.
- The three approved retrieval-source replacements are already resolved in this ledger; no further replacement is authorized.
- Citation promotion is not authorized.
- No GitHub or Vercel write is authorized.

## Exact approval text

I approve the ME-11 five-candidate proposal exactly as written: actinomycosis -> osteomyelitis restricted to cervicofacial/oral actinomycosis with mandibular osteomyelitis (PMID 41871568); insomnia -> hypertension as population-level risk/association only with source replacement to PMID 33360604; periodontal-disease -> osteoporosis narrowed to periodontitis and association/risk only with source replacement to PMID 36377800; uterine-fibroids -> endometriosis as co-occurrence/association only with source replacement to PMID 31006843; and bronchiolitis -> pulmonary-hypertension restricted to post-lung-transplant bronchiolitis obliterans syndrome/chronic lung allograft dysfunction with separately diagnosed pulmonary hypertension (PMID 42444963). I approve all stated phenotype restrictions, confounder protections, treatment/transplant-context requirements, chronology boundaries, and publication guards. I authorize creation of a separate fail-closed local-only ME-11 implementation package for exactly these five relationships, with all five new references remaining verified:false and all five new master sources pending-verification. I do not authorize citation promotion or any GitHub/Vercel write.

## Local implementation result

- 5/5 relationships installed at rank 2.
- 5/5 final approved clinical sources remain `verified:false`.
- 5/5 normalized master sources are `pending-verification`.
- 0 citation promotions, 0 semantic broadenings, 0 post-precheck source replacements, 0 identity changes, and 0 remote writes.
