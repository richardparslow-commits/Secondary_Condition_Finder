# Clinical Evidence Program Status

Status: **Targeted Clinical Mapping Batch 31 is implemented on a production-validated base and awaits exact-head CI, Vercel Agent immutable-head review, protected merge, and production closure. External/human gates remain separate.**

## Production-validated base

Batch 31 branches from production-validated `main` SHA `a15dd22ccc2f080343814e25c445a6f61282c5af` (`Promote evidence-led Wave 7 mappings (#354)`). That SHA passed independent `main` CI #1043 and Production Runtime Readiness #402 after Batch 30 merged.

The workflow remains: exact-head PR CI → genuine Vercel Agent immutable-head code review → expected-head protected squash merge → independent merge-SHA `main` CI → Production Runtime Readiness. A Vercel preview/deployment `Ready` status is not the review gate, and any head change requires fresh exact-head CI and Vercel Agent review.

## Frozen universe

- Catalog identities: **300**.
- Knowledge-base mappings: **300**.
- Target-v2 Wave 1–7 expansion identities: **107**.
- Batch 31 does not add, delete, rename, or merge condition identities.

## Wave program state

`data/expansion-dispositions.json` remains:

- **30 published-evidence-led** Wave identities;
- **0 promotion-candidate** Wave identities;
- **77 safe-draft** Wave identities.

Batch 31 is a targeted rescreen across 14 existing catalog identities and does not change that Wave ledger.

## Batch 31 targeted mapping state

Two new relationships are published in the branch candidate:

- `insomnia` → `depressive-disorder`, bounded to an independently established insomnia diagnosis preceding a separately diagnosed depressive disorder and supported by prospective incident-depression evidence (PMID 38833937);
- `migraine-headaches` → `depressive-disorder`, modeled as a bounded somatopsychic pathway using prospective incident-depression evidence (PMID 23588795).

`mild-tbi` keeps its existing published `mild-tbi` → `migraine-headaches` relationship (PMID 38568491).

The remaining targeted identities stay safe draft after exact-target review: `carpal-tunnel-syndrome`, `chronic-fatigue-syndrome`, `hypothyroidism`, `illness-anxiety-disorder`, `median-neuropathy`, `micro-tbi`, `narcolepsy`, `peripheral-neuropathy`, `radial-neuropathy`, `rem-sleep-disorder`, and `social-anxiety-disorder`.

Key negative-modeling protections include rejecting CTS/median-neuropathy taxonomy overlap as a secondary condition, preserving the nonstandardized micro-TBI boundary, and treating REM sleep behavior disorder as a prodromal synucleinopathy marker rather than a cause of Parkinson disease.

## Citation position

After qualified-human Citation Verification Batches 01 through 09, the current local position is:

- live references: **69**;
- live verified: **47**;
- retired verified: **6**;
- verified provenance: **53**;
- live unverified: **22**;
- published-unverified review findings: **20**;
- live clinical-evidence references with canonical URLs: **64**;
- retired clinical-evidence URLs: **4**;
- combined clinical-URL provenance observation: **68**.

Batch 08 lowers the debt ratchet from 26/24 to 22/20 while preserving 69 total live references and zero hard findings. Three relationships were verified as written; migraine→depressive disorder was narrowed to temporal-association-only evidence before verification; and mild-TBI→`migraine-headaches` was narrowed but deliberately held unverified because the cited review establishes post-traumatic headache with migraine-like phenotype rather than the current migraine target itself.

## Human citation verification

Automation may retrieve sources, record canonical URLs/check dates/locators, and prepare the review queue. It may not independently authorize `verified: true`. Citation Verification Batches 01 through 09 record explicit qualified-human approval resulting in thirty-nine newly verified live sources across the verification series; the remaining 22 live unverified references remain `verified: false` until separately reviewed. Batch 08 demonstrates that human review may intentionally retain `verified: false` when source-to-target taxonomy is insufficient.

## External/manual gates

See `docs/external-manual-gates-status.md`. Repository automation does not fabricate human verification, credentials, accessibility observations, or external-provider success.

## What “complete” means

Repository automation is complete for Batch 31 only when the repository contains a safe explicit state, tests/audits enforce it, exact-head CI passes, the Vercel Agent immutable-head review is clean on the same SHA, and production closure proves the merge SHA.

<!-- citation-verification-master-current:start -->
## Current citation-verification position

Master-approved implementation is complete through **Batch 9**.
- Live verified references: **52**
- Retired verified references: **6**
- Verified provenance: **58**
- Live unverified references: **17**
- Published unverified review findings: **15**
- Hard findings: **0**
- Live clinical source URL coverage: **64/64**

Current unresolved published queue:
- `mild-tbi.json` → `migraine-headaches`: Schwedt TJ. Posttraumatic Headache. Continuum (Minneap Minn). 2024;30(2):411-424. PMID 38568491
- `ptsd.json` → `erectile-dysfunction`: Brugi et al., Journal of Sexual Medicine (2026), PMID 42466890
- `pulmonary-hypertension.json` → `congestive-heart-failure`: Humbert M, Kovacs G, Hoeper MM, et al. 2022 ESC/ERS Guidelines for the diagnosis and treatment of pulmonary hypertension. Eur Heart J. 2022;43(38):3618-3731. PMID 36017548
- `rectal-prolapse.json` → `fecal-incontinence`: Long-term impact of full-thickness rectal prolapse treatment on fecal incontinence. PMID 25869649
- `retinal-dystrophy.json` → `visual-impairment`: Sharon D et al. Prog Retin Eye Res. 2022. PMID 34839010
- `rheumatoid-arthritis.json` → `gerd`: Ruszniewski et al., Aliment Pharmacol Ther (2008), PMID 18671778
- `sleep-apnea.json` → `hypertension`: Battisha et al., Journal of Clinical Medicine (2025), PMID 40364148
- `sleep-apnea.json` → `depressive-disorder`: Zhao et al., Sleep and Breathing (2024), PMID 38888794
- `sleep-apnea.json` → `anxiety-disorder`: Garbarino et al., Behavioral Sleep Medicine (2020), PMID 30453780
- `syringomyelia.json` → `charcot-arthropathy`: Parida MK, Pattanaik SS, Panda AK, Das BK, Tripathy SR. Charcot arthropathy of elbow due to syringomyelia: a case series and systematic review of literature. Clin Rheumatol. 2023;42(1):261-268. PMID 35994178
- `testicular-cancer.json` → `hypogonadism`: Bandak M, Jørgensen N, Juul A, et al. Testosterone deficiency in testicular cancer survivors - a systematic review and meta-analysis. Andrology. 2016;4(3):382-388. PMID 27009402
- `thyroiditis.json` → `hypothyroidism`: Feng X, Lyu X, Gao Y, Gao X, Gao R. Analysis of risk factors for hypothyroidism in initially euthyroid patients with positive thyroid autoantibodies: a multicenter retrospective cohort study. Front Endocrinol (Lausanne). 2026;17:1827517. PMID 42232752
- `trigeminal-neuralgia.json` → `depressive-disorder`: Martinelli R, Vannuccini S, Burattini B, et al. Psychological assessment in patients affected by trigeminal neuralgia. A systematic review. Neurosurg Rev. 2025;48(1):414. PMID 40355578
- `urethral-stricture.json` → `hydronephrosis`: Renal and ureteral complications of urethral stenosis, PMID 8571802
- `uveitis.json` → `glaucoma`: Kesav N, Palestine AG, Kahook MY, Pantcheva MB. Current management of uveitis-associated ocular hypertension and glaucoma. Surv Ophthalmol. 2020;65(4):397-407. PMID 31816329
<!-- citation-verification-master-current:end -->
