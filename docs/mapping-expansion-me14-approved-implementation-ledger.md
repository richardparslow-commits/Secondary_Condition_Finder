# Mapping Expansion ME-14 — Approved Implementation Ledger

**APPROVED AND APPLIED LOCALLY — CITATIONS PENDING VERIFICATION**

Required baseline: `e613997b01d91bca8a366d032dcbd914051cde81`
Commit subject: `map: mapping expansion ME-14 (5 relationships)`

## Approved scope

All five relationships are approved at rank 1. Each primary's live publication state must be read immediately before mutation and preserved unchanged. All five new clinical source references enter as `verified:false`; matching master sources enter as `pending-verification`. Citation verification remains a separate qualified-human phase. No GitHub or Vercel writes are authorized.

## 1. `hidradenitis-suppurativa` → `depressive-disorder`
- Rank: **1**
- PMID: **40737006**
- DOI: `10.1001/jamadermatol.2025.2298`
- Source: Holgersen N, Rosenø NAL, Nielsen VW, et al. Risk of New-Onset and Recurrent Depression and Anxiety Among Patients With Hidradenitis Suppurativa. JAMA Dermatol. 2025;161(10):1014-1021. PMID 40737006. doi:10.1001/jamadermatol.2025.2298.
- Claim boundary: temporal-association-risk
- Guard: Require independently established hidradenitis suppurativa before first-onset depressive disorder; do not use this proposition for depression predating hidradenitis suppurativa. Preserve obesity, smoking, substance use, socioeconomic factors, other psychiatric illness, chronic-pain burden, treatment effects, and other competing explanations. Treat this only as population-level temporal risk, not proof that hidradenitis suppurativa caused an individual depressive disorder.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 2. `varicose-veins` → `deep-vein-thrombosis`
- Rank: **1**
- PMID: **29486040**
- DOI: `10.1001/jama.2018.0246`
- Source: Chang SL, Huang YL, Lee MC, et al. Association of Varicose Veins With Incident Venous Thromboembolism and Peripheral Artery Disease. JAMA. 2018;319(8):807-817. PMID 29486040. doi:10.1001/jama.2018.0246.
- Claim boundary: temporal-association-risk
- Guard: Require varicose veins preceding a newly established deep-vein thrombosis and exclude preexisting deep-vein thrombosis. Explicitly assess recent venous surgery or endovenous procedures, prior venous thromboembolism, thrombophilia, malignancy, immobilization, pregnancy or estrogen exposure, trauma or surgery, age, obesity, and other thrombotic risks. Do not publish or present this relationship as proof that varicose veins caused the deep-vein thrombosis.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 3. `maxillofacial-fracture` → `mandibular-nonunion`
- Rank: **1**
- PMID: **34314633**
- DOI: `10.1089/fpsam.2020.0607`
- Source: Lander DP, Lee JJ, Kallogjeri D, et al. The Impact of Treatment Delay on Malunion and Nonunion After Open Reduction of Mandible Fractures. Facial Plast Surg Aesthet Med. 2021;23(6):460-466. PMID 34314633. doi:10.1089/fpsam.2020.0607.
- Claim boundary: mandibular-fracture-healing-complication
- Guard: Apply the broader maxillofacial-fracture identity only when the documented fracture specifically involves the mandible. Require separately established mandibular nonunion after that fracture. Do not infer mandibular nonunion from another facial fracture or from uncomplicated fracture healing. Preserve open-fracture status, infection, diabetes, alcohol use, treatment delay or fixation problems, osteonecrosis, metabolic bone disease, and other causes as competing explanations.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 4. `nontoxic-thyroid-enlargement` → `hypoparathyroidism`
- Rank: **1**
- PMID: **27256349**
- DOI: `10.1159/000444644`
- Source: Li Y, Li Y, Zhou X. Total Thyroidectomy versus Bilateral Subtotal Thyroidectomy for Bilateral Multinodular Nontoxic Goiter: A Meta-Analysis. ORL J Otorhinolaryngol Relat Spec. 2016;78(3):167-175. PMID 27256349. doi:10.1159/000444644.
- Claim boundary: treatment-mediated transient postoperative hypoparathyroidism
- Guard: Require multinodular nontoxic thyroid enlargement plus documented total or near-total thyroid surgery followed by separately documented postoperative hypoparathyroidism. The supported proposition is transient postoperative hypoparathyroidism; do not infer permanent hypoparathyroidism, and do not infer hypoparathyroidism from the thyroid enlargement itself. Preserve other neck surgery, autoimmune or genetic parathyroid disease, magnesium disorders, and other etiologies as competing explanations.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 5. `rem-sleep-disorder` → `parkinsons-disease`
- Rank: **1**
- PMID: **20083800**
- DOI: `10.1212/WNL.0b013e3181ca0166`
- Source: Postuma RB, Gagnon JF, Rompré S, Montplaisir JY. Severity of REM atonia loss in idiopathic REM sleep behavior disorder predicts Parkinson disease. Neurology. 2010;74(3):239-244. PMID 20083800. doi:10.1212/WNL.0b013e3181ca0166.
- Claim boundary: prodromal-temporal-risk
- Guard: Require polysomnography-confirmed isolated or idiopathic REM sleep behavior disorder before Parkinson disease, with no Parkinsonism or dementia at the REM sleep behavior disorder baseline and a later independently established Parkinson disease diagnosis. State explicitly that REM sleep behavior disorder is a prodromal marker or risk state, not a cause of Parkinson disease, that many patients do not convert during observed follow-up, and that dementia with Lewy bodies and multiple system atrophy are alternative phenoconversion outcomes.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## Projected non-publication counts
- Relationships: 238 → **243**
- Registered primaries: 150 → **155**
- Remaining primaries: 161 → **156**
- Remaining target-only: 38 → **39**
- Remaining never-used: 123 → **117**
- References: 246 → **251**; verified remains **246**; unverified 0 → **5**
- Master sources: 223 active / 0 pending / 232 total → **223 active / 5 pending / 237 total**
- Clinical sources: 222 active / 0 pending → **222 active / 5 pending**
- Explicit publication guards: 164 → **169**
- P1/D1 counts are resolved from the read-before-write publication-state proof.

## Local implementation result

- 5/5 approved relationships added at rank 1.
- Publication state preserved from the read-before-write proof: `{"hidradenitis-suppurativa": "draft", "maxillofacial-fracture": "draft", "nontoxic-thyroid-enlargement": "draft", "rem-sleep-disorder": "draft", "varicose-veins": "draft"}`.
- 5/5 new source references remain `verified:false`; matching master sources are `pending-verification`.
- Registered-primary coverage is 155/311; 156 primaries remain, partitioned 39 target-only / 117 never-used.
- Citation verification remains separately gated.
- No GitHub/Vercel write was performed.
