# Mapping Expansion ME-15 — Qualified-Human Citation Verification Ledger

**APPROVED-AND-APPLIED-LOCALLY — 5/5 VERIFIED**

Required implementation commit: `126bc0d0983c8b4cfd90457a7a6a68e3f7f30e97`

Approved scope: all five ME-15 citation-verification rows exactly as implemented; no narrowing, source replacement, bibliographic correction, source-identity change, guard change, rank change, publication change, taxonomy change, or pathway change.

## `anxiety-disorder → depressive-disorder`
- PMID: 17548747
- DOI: 10.1001/archpsyc.64.6.651
- Title: Depression and generalized anxiety disorder: cumulative and sequential comorbidity in a birth cohort followed prospectively to age 32 years
- Citation: Moffitt TE, Harrington H, Caspi A, Kim-Cohen J, Goldberg D, Gregory AM, Poulton R. Depression and generalized anxiety disorder: cumulative and sequential comorbidity in a birth cohort followed prospectively to age 32 years. Arch Gen Psychiatry. 2007;64(6):651-660. PMID 17548747. doi:10.1001/archpsyc.64.6.651.
- Source URL: https://pubmed.ncbi.nlm.nih.gov/17548747/
- Guard: Require independently established generalized anxiety disorder and separately established major depressive disorder. The cited prospective birth cohort found cumulative and roughly symmetric sequential comorbidity, with depression onset first, anxiety onset first, and concurrent onset each occurring in about one third of comorbid cases; do not treat either disorder as reliably primary in onset order. Preserve other psychiatric illness, substance use, medical illness, medications, psychosocial stressors, and shared vulnerability as competing explanations. Treat this only as population-level comorbidity association, not proof that generalized anxiety disorder caused an individual's depressive disorder.
- Decision: `approve-as-implemented`

## `panic-disorder → agoraphobia`
- PMID: 16585471
- DOI: 10.1001/archpsyc.63.4.415
- Title: The epidemiology of panic attacks, panic disorder, and agoraphobia in the National Comorbidity Survey Replication
- Citation: Kessler RC, Chiu WT, Jin R, Ruscio AM, Shear K, Walters EE. The epidemiology of panic attacks, panic disorder, and agoraphobia in the National Comorbidity Survey Replication. Arch Gen Psychiatry. 2006;63(4):415-424. PMID 16585471. doi:10.1001/archpsyc.63.4.415.
- Source URL: https://pubmed.ncbi.nlm.nih.gov/16585471/
- Guard: Require independently documented panic disorder and separately established agoraphobia; under DSM-5 these are distinct diagnoses and agoraphobia must not be inferred from panic attacks or panic disorder alone. The cited nationally representative survey found that most lifetime panic disorder cases did not carry agoraphobia; do not present co-occurrence as inevitable progression. Preserve other anxiety disorders, depressive disorders, substance use, medical causes of episodic symptoms, and avoidance attributable to other conditions as competing explanations. Treat this only as population-level co-occurrence risk, not proof that panic disorder caused an individual's agoraphobia.
- Decision: `approve-as-implemented`

## `ocd → depressive-disorder`
- PMID: 18725912
- DOI: 10.1038/mp.2008.94
- Title: The epidemiology of obsessive-compulsive disorder in the National Comorbidity Survey Replication
- Citation: Ruscio AM, Stein DJ, Chiu WT, Kessler RC. The epidemiology of obsessive-compulsive disorder in the National Comorbidity Survey Replication. Mol Psychiatry. 2010;15(1):53-63. PMID 18725912. doi:10.1038/mp.2008.94.
- Source URL: https://pubmed.ncbi.nlm.nih.gov/18725912/
- Guard: Require independently established obsessive-compulsive disorder and separately established depressive disorder; the cited nationally representative survey reported substantial comorbidity of OCD with mood disorders as a class and does not establish onset order or direction. Preserve other anxiety disorders, substance use, medical illness, medications, and shared vulnerability as competing explanations. Do not infer a depressive disorder from OCD symptoms or distress alone, and do not treat this population-level association as proof that OCD caused an individual's depressive disorder.
- Decision: `approve-as-implemented`

## `binge-eating-disorder → depressive-disorder`
- PMID: 16815322
- DOI: 10.1016/j.biopsych.2006.03.040
- Title: The prevalence and correlates of eating disorders in the National Comorbidity Survey Replication
- Citation: Hudson JI, Hiripi E, Pope HG Jr, Kessler RC. The prevalence and correlates of eating disorders in the National Comorbidity Survey Replication. Biol Psychiatry. 2007;61(3):348-358. PMID 16815322. doi:10.1016/j.biopsych.2006.03.040.
- Source URL: https://pubmed.ncbi.nlm.nih.gov/16815322/
- Guard: Require independently established binge eating disorder and separately established depressive disorder; the cited nationally representative survey found eating disorders significantly comorbid with many other DSM-IV disorders without establishing direction of onset. Preserve obesity and metabolic disease, other eating pathology, substance use, medications, and other psychiatric illness as competing explanations. Do not infer a depressive disorder from binge eating symptoms, weight change, or role impairment alone, and do not treat this population-level association as proof that binge eating disorder caused an individual's depressive disorder.
- Decision: `approve-as-implemented`

## `bipolar-disorder → anxiety-disorder`
- PMID: 17485606
- DOI: 10.1001/archpsyc.64.5.543
- Title: Lifetime and 12-month prevalence of bipolar spectrum disorder in the National Comorbidity Survey replication
- Citation: Merikangas KR, Akiskal HS, Angst J, Greenberg PE, Hirschfeld RM, Petukhova M, Kessler RC. Lifetime and 12-month prevalence of bipolar spectrum disorder in the National Comorbidity Survey replication. Arch Gen Psychiatry. 2007;64(5):543-552. PMID 17485606. doi:10.1001/archpsyc.64.5.543.
- Source URL: https://pubmed.ncbi.nlm.nih.gov/17485606/
- Guard: Require independently established bipolar disorder and a separately established anxiety disorder diagnosis; the cited nationally representative survey reported lifetime comorbidity of bipolar spectrum disorder with other Axis I disorders, particularly anxiety disorders as a class, and does not specify onset order or direction. Distinguish an independent anxiety disorder from anxiety symptoms occurring within manic, hypomanic, or depressive episodes. Preserve substance use, medical illness, medications, and other psychiatric illness as competing explanations. Treat this only as population-level comorbidity association, not proof that bipolar disorder caused an individual's anxiety disorder.
- Decision: `approve-as-implemented`

## Local verification result

- 5/5 selected ME-15 KB references promoted to `verified:true`.
- 5/5 matching master sources promoted from `pending-verification` to `active` and `verified:true`, with `qualifiedHumanCitationReviewDecision: approve-as-implemented` and `qualifiedHumanCitationReviewRequired: false`.
- All five were approved exactly as implemented; no narrowing, bibliographic correction, source replacement, source-identity, semantic, rank, guard, publication, taxonomy, or pathway change.
- Relationship identities, ranks (`ocd` entry remains rank 2 behind `ocd -> migraine-headaches`), draft publication states, explicit guards, and source linkage are preserved exactly.
- No GitHub/Vercel write was performed.