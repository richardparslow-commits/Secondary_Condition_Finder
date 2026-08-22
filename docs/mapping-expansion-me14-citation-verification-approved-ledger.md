# Mapping Expansion ME-14 — Qualified-Human Citation Verification Ledger

**APPROVED-AND-APPLIED-LOCALLY — 5/5 VERIFIED**

Required implementation commit: `518524024a8cafeaaca9ebc452138123f816872c`

Approved scope: all five ME-14 citation-verification rows exactly as implemented; no narrowing, source replacement, bibliographic correction, source-identity change, guard change, rank change, publication change, taxonomy change, or pathway change.

## `hidradenitis-suppurativa → depressive-disorder`
- PMID: 40737006
- DOI: 10.1001/jamadermatol.2025.2298
- Title: Risk of New-Onset and Recurrent Depression and Anxiety Among Patients With Hidradenitis Suppurativa
- Citation: Holgersen N, Rosenø NAL, Nielsen VW, et al. Risk of New-Onset and Recurrent Depression and Anxiety Among Patients With Hidradenitis Suppurativa. JAMA Dermatol. 2025;161(10):1014-1021. PMID 40737006. doi:10.1001/jamadermatol.2025.2298.
- Source URL: https://pubmed.ncbi.nlm.nih.gov/40737006/
- Guard: Require independently established hidradenitis suppurativa before first-onset depressive disorder; do not use this proposition for depression predating hidradenitis suppurativa. Preserve obesity, smoking, substance use, socioeconomic factors, other psychiatric illness, chronic-pain burden, treatment effects, and other competing explanations. Treat this only as population-level temporal risk, not proof that hidradenitis suppurativa caused an individual depressive disorder.
- Decision: `approve-as-implemented`

## `varicose-veins → deep-vein-thrombosis`
- PMID: 29486040
- DOI: 10.1001/jama.2018.0246
- Title: Association of Varicose Veins With Incident Venous Thromboembolism and Peripheral Artery Disease
- Citation: Chang SL, Huang YL, Lee MC, et al. Association of Varicose Veins With Incident Venous Thromboembolism and Peripheral Artery Disease. JAMA. 2018;319(8):807-817. PMID 29486040. doi:10.1001/jama.2018.0246.
- Source URL: https://pubmed.ncbi.nlm.nih.gov/29486040/
- Guard: Require varicose veins preceding a newly established deep-vein thrombosis and exclude preexisting deep-vein thrombosis. Explicitly assess recent venous surgery or endovenous procedures, prior venous thromboembolism, thrombophilia, malignancy, immobilization, pregnancy or estrogen exposure, trauma or surgery, age, obesity, and other thrombotic risks. Do not publish or present this relationship as proof that varicose veins caused the deep-vein thrombosis.
- Decision: `approve-as-implemented`

## `maxillofacial-fracture → mandibular-nonunion`
- PMID: 34314633
- DOI: 10.1089/fpsam.2020.0607
- Title: The Impact of Treatment Delay on Malunion and Nonunion After Open Reduction of Mandible Fractures
- Citation: Lander DP, Lee JJ, Kallogjeri D, et al. The Impact of Treatment Delay on Malunion and Nonunion After Open Reduction of Mandible Fractures. Facial Plast Surg Aesthet Med. 2021;23(6):460-466. PMID 34314633. doi:10.1089/fpsam.2020.0607.
- Source URL: https://pubmed.ncbi.nlm.nih.gov/34314633/
- Guard: Apply the broader maxillofacial-fracture identity only when the documented fracture specifically involves the mandible. Require separately established mandibular nonunion after that fracture. Do not infer mandibular nonunion from another facial fracture or from uncomplicated fracture healing. Preserve open-fracture status, infection, diabetes, alcohol use, treatment delay or fixation problems, osteonecrosis, metabolic bone disease, and other causes as competing explanations.
- Decision: `approve-as-implemented`

## `nontoxic-thyroid-enlargement → hypoparathyroidism`
- PMID: 27256349
- DOI: 10.1159/000444644
- Title: Total Thyroidectomy versus Bilateral Subtotal Thyroidectomy for Bilateral Multinodular Nontoxic Goiter: A Meta-Analysis
- Citation: Li Y, Li Y, Zhou X. Total Thyroidectomy versus Bilateral Subtotal Thyroidectomy for Bilateral Multinodular Nontoxic Goiter: A Meta-Analysis. ORL J Otorhinolaryngol Relat Spec. 2016;78(3):167-175. PMID 27256349. doi:10.1159/000444644.
- Source URL: https://pubmed.ncbi.nlm.nih.gov/27256349/
- Guard: Require multinodular nontoxic thyroid enlargement plus documented total or near-total thyroid surgery followed by separately documented postoperative hypoparathyroidism. The supported proposition is transient postoperative hypoparathyroidism; do not infer permanent hypoparathyroidism, and do not infer hypoparathyroidism from the thyroid enlargement itself. Preserve other neck surgery, autoimmune or genetic parathyroid disease, magnesium disorders, and other etiologies as competing explanations.
- Decision: `approve-as-implemented`

## `rem-sleep-disorder → parkinsons-disease`
- PMID: 20083800
- DOI: 10.1212/WNL.0b013e3181ca0166
- Title: Severity of REM atonia loss in idiopathic REM sleep behavior disorder predicts Parkinson disease
- Citation: Postuma RB, Gagnon JF, Rompré S, Montplaisir JY. Severity of REM atonia loss in idiopathic REM sleep behavior disorder predicts Parkinson disease. Neurology. 2010;74(3):239-244. PMID 20083800. doi:10.1212/WNL.0b013e3181ca0166.
- Source URL: https://pubmed.ncbi.nlm.nih.gov/20083800/
- Guard: Require polysomnography-confirmed isolated or idiopathic REM sleep behavior disorder before Parkinson disease, with no Parkinsonism or dementia at the REM sleep behavior disorder baseline and a later independently established Parkinson disease diagnosis. State explicitly that REM sleep behavior disorder is a prodromal marker or risk state, not a cause of Parkinson disease, that many patients do not convert during observed follow-up, and that dementia with Lewy bodies and multiple system atrophy are alternative phenoconversion outcomes.
- Decision: `approve-as-implemented`

## Local verification result

- 5/5 selected ME-14 KB references promoted to `verified:true`.
- 5/5 matching master sources promoted from `pending-verification` to `active` and `verified:true`.
- All five were approved exactly as implemented; no narrowing, bibliographic correction, source replacement, source-identity, semantic, rank, guard, publication, taxonomy, or pathway change.
- No GitHub/Vercel write was performed.
