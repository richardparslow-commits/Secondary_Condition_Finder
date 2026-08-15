# Targeted Clinical Mapping Batch 31

## Scope

Batch 31 is a focused evidence rescreen of 14 existing catalog identities requested after the Wave 1-7 program completed:

- `carpal-tunnel-syndrome`
- `chronic-fatigue-syndrome`
- `insomnia`
- `hypothyroidism`
- `illness-anxiety-disorder`
- `median-neuropathy`
- `micro-tbi`
- `migraine-headaches`
- `mild-tbi`
- `narcolepsy`
- `peripheral-neuropathy`
- `radial-neuropathy`
- `rem-sleep-disorder`
- `social-anxiety-disorder`

The batch starts from production-validated `main` SHA `a15dd22ccc2f080343814e25c445a6f61282c5af`. It does not add, rename, merge, or delete any catalog identity and does not alter the 107-identity Wave disposition ledger.

## Publication threshold

A relationship is published only where condition-specific clinical evidence supports the exact downstream diagnosis and enough directionality to make the relationship useful for individualized development. Population association is explicitly separated from an individual medical nexus. Legal/rating authority is not used as medical evidence, and every newly added clinical source remains `verified: false` pending qualified-human review.

## Published in this batch

### Insomnia → depressive disorder

Source: Solelhac G, Imler T, Strippoli MPF, et al. *Sleep disturbances and incident risk of major depressive disorder in a population-based cohort.* Psychiatry Res. 2024;338:115934. PMID 38833937.

The population-based prospective cohort excluded participants with prior major depressive disorder and found insomnia symptoms associated with incident major depressive disorder over eight years (HR 1.437, 95% CI 1.064-1.940). The mapping is limited to cases with a clinically established insomnia disorder preceding a separately diagnosed depressive disorder. It requires individual chronology and assessment of psychiatric, sleep, pain, medication, substance-use, and medical alternatives; the study is not treated as automatic causation.

### Migraine headaches → depressive disorder

Source: Rist PM, Schurks M, Buring JE, Kurth T. *Migraine, headache, and the risk of depression: Prospective cohort study.* Cephalalgia. 2013;33(12):1017-1025. PMID 23588795.

Among 36,016 women without depression at baseline followed for a mean 13.8 years, active migraine with aura, active migraine without aura, and past migraine were each associated with higher incident-depression risk, and greater attack frequency was associated with greater risk. The mapping uses a `somatopsychic` pathway and requires migraine to predate the depressive disorder with documented headache burden and individualized competing-cause review. Population risk, cohort demographics, and known bidirectionality are explicit limitations.

## Preserved published mapping

`mild-tbi` remains published through its existing bounded `mild-tbi` → `migraine-headaches` relationship using PMID 38568491. Batch 31 reviewed but does not add `mild-tbi` → `insomnia`: longitudinal post-mTBI insomnia evidence is clinically relevant, but an additional unverified published source would exceed the current citation-debt ceiling unless offset by evidence-quality cleanup elsewhere. No citation baseline is raised to bypass that control.

## Safe-draft dispositions

### Carpal tunnel syndrome

PMID 37639884 reports higher five-year depression and anxiety incidence after CTS in a large matched cohort, but it remains association evidence with unresolved mediators. No psychiatric edge is published. CTS and median neuropathy are also not mapped to one another because CTS is an anatomic median-nerve entrapment phenotype; that is taxonomy/diagnostic overlap rather than a separate secondary condition.

### Chronic fatigue syndrome / ME-CFS

Reviewed literature including PMIDs 40785390, 15184691, and 19566769 supports psychiatric comorbidity and temporal relationships but does not cleanly establish a general ME/CFS-primary pathway to a separate depressive or anxiety disorder rather than bidirectionality, shared vulnerability, or symptom overlap. Safe draft retained.

### Hypothyroidism

The prior depression edge remains withdrawn. A targeted hypothyroidism/CTS rescreen found that PMID 41002938 showed a crude CTS difference but no statistically significant overall association after age/sex adjustment (adjusted OR 1.71, 95% CI 0.89-3.28). A subgroup signal is not generalized into a published relationship.

### Illness anxiety disorder

No sufficiently condition-specific longitudinal evidence was identified for a distinct downstream diagnosis. Healthcare use, reassurance seeking, symptom concern, or shared anxiety symptoms are not converted into proof of another diagnosis.

### Median neuropathy

No distinct downstream diagnosis met the threshold. Median neuropathy → CTS is rejected as taxonomy/anatomic overlap unless a future model represents localization/phenotype rather than a secondary diagnosis.

### Micro TBI

The existing modeling disposition remains unchanged: this historical identity is reviewed separately from mild TBI, is not assumed to represent a distinct standardized clinical diagnosis, and remains draft with no suggestions.

### Narcolepsy

PMID 32671534 supports substantial depressive symptom/disorder burden in narcolepsy but with heterogeneous, largely comorbidity-oriented evidence. No directional depression edge is published.

### Peripheral neuropathy

PMID 36945108 supports higher future fall/fracture risk in older adults with peripheral neuropathy, but those outcomes do not presently map to a clean exact downstream diagnosis on this surface. Symptoms or fall risk are not converted into a separate diagnosis.

### Radial neuropathy

Clinical literature including PMID 41392533 characterizes radial mononeuropathy causes, localization, deficits, and outcomes but does not establish a distinct downstream catalog diagnosis suitable for a radial-neuropathy-primary mapping.

### REM sleep disorder

Prospective evidence including PMIDs 39177811 and 28429825 strongly supports isolated REM sleep behavior disorder as a prodromal marker for later synucleinopathy. This is not represented as RBD causing Parkinson disease or dementia with Lewy bodies. Shared/prodromal neurodegenerative biology is not converted into false secondary causation.

### Social anxiety disorder

PMID 11231832 reports that social anxiety disorder in participants without depression at baseline predicted later depressive-disorder onset (reported OR 3.5, 95% CI 2.0-6.0). This is a strong temporal candidate, but publication is held pending a dedicated psychiatric-overlap review that can distinguish a separate depressive diagnosis and individual direction from shared internalizing symptoms and comorbidity.

## Citation governance

Batch 31 adds exactly two live clinical source rows and removes none. Both remain `verified: false`.

Expected exact-head citation position:

- live references: 69
- live verified: 8
- retired verified: 6
- verified provenance: 14
- live unverified: 61
- published-unverified review findings: 59
- live clinical-evidence references with canonical URLs: 64
- retired clinical-evidence references with canonical URLs: 4
- combined clinical-URL provenance observation: 68

This uses the two-row headroom left after Batch 30 without raising the ratchet. Qualified-human verification remains a separate gate.

## Repository validation contract

`tests/clinical-evidence-promotion-batch31.test.ts` enforces:

- frozen 300/300 catalog/KB scope;
- both new bounded publications and their `verified: false` source state;
- preservation of the existing mild-TBI→migraine relationship;
- the micro-TBI modeling boundary;
- safe-draft state for the other targeted identities;
- key negative modeling dispositions such as CTS/median overlap and RBD prodromal prediction;
- exact citation counts at the existing debt ceilings; and
- unchanged Wave 1-7 ledger totals of 30 published / 77 safe draft / 0 candidates.

## Closure status

This document describes the Batch-31 branch candidate. Production closure still requires exact-head PR CI, a genuine Vercel Agent immutable-head review on that same SHA, expected-head protected merge, independent merge-SHA `main` CI, and Production Runtime Readiness.
