# Mapping Expansion ME-15 — Approved Implementation Ledger

**APPROVED AND APPLIED LOCALLY — CITATIONS PENDING VERIFICATION**

Required baseline: `db5b0ef600ce4caefb1fe3b75b9c419c704209e3`
Commit subject: `map: mapping expansion ME-15 (5 relationships)`
Issue: #360 Mapping Expansion Wave: Mental Disorders (ME-15+)

## Approved scope

Five bounded Mental Disorders relationships approved by qualified-human review on 2026-09-01. Four rows enter at rank 1 on previously unregistered draft primaries; the OCD row enters at rank 2 because `ocd -> migraine-headaches` already occupies rank 1. Each primary's live publication state is read immediately before mutation and preserved unchanged (all five remain draft). All five new clinical source references enter as `verified:false`; matching master sources enter as `pending-verification`. Citation verification is separately gated (approval already captured for the verify step: approve-as-implemented for all five).

## 1. `anxiety-disorder` → `depressive-disorder`
- Rank: **1** — PMID: **17548747** — DOI: `10.1001/archpsyc.64.6.651`
- Source: Moffitt TE, Harrington H, Caspi A, Kim-Cohen J, Goldberg D, Gregory AM, Poulton R. Depression and generalized anxiety disorder: cumulative and sequential comorbidity in a birth cohort followed prospectively to age 32 years. Arch Gen Psychiatry. 2007;64(6):651-660. PMID 17548747. doi:10.1001/archpsyc.64.6.651.
- Claim boundary: symmetric-cumulative-comorbidity
- Guard: Require independently established generalized anxiety disorder and separately established major depressive disorder. The cited prospective birth cohort found cumulative and roughly symmetric sequential comorbidity, with depression onset first, anxiety onset first, and concurrent onset each occurring in about one third of comorbid cases; do not treat either disorder as reliably primary in onset order. Preserve other psychiatric illness, substance use, medical illness, medications, psychosocial stressors, and shared vulnerability as competing explanations. Treat this only as population-level comorbidity association, not proof that generalized anxiety disorder caused an individual's depressive disorder.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 2. `panic-disorder` → `agoraphobia`
- Rank: **1** — PMID: **16585471** — DOI: `10.1001/archpsyc.63.4.415`
- Source: Kessler RC, Chiu WT, Jin R, Ruscio AM, Shear K, Walters EE. The epidemiology of panic attacks, panic disorder, and agoraphobia in the National Comorbidity Survey Replication. Arch Gen Psychiatry. 2006;63(4):415-424. PMID 16585471. doi:10.1001/archpsyc.63.4.415.
- Claim boundary: population-level-co-occurrence-risk
- Guard: Require independently documented panic disorder and separately established agoraphobia; under DSM-5 these are distinct diagnoses and agoraphobia must not be inferred from panic attacks or panic disorder alone. The cited nationally representative survey found that most lifetime panic disorder cases did not carry agoraphobia; do not present co-occurrence as inevitable progression. Preserve other anxiety disorders, depressive disorders, substance use, medical causes of episodic symptoms, and avoidance attributable to other conditions as competing explanations. Treat this only as population-level co-occurrence risk, not proof that panic disorder caused an individual's agoraphobia.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`
## 3. `ocd` → `depressive-disorder`
- Rank: **2** (rank 1 remains `ocd -> migraine-headaches`) — PMID: **18725912** — DOI: `10.1038/mp.2008.94`
- Source: Ruscio AM, Stein DJ, Chiu WT, Kessler RC. The epidemiology of obsessive-compulsive disorder in the National Comorbidity Survey Replication. Mol Psychiatry. 2010;15(1):53-63. PMID 18725912. doi:10.1038/mp.2008.94.
- Claim boundary: population-level-comorbidity-association
- Guard: Require independently established obsessive-compulsive disorder and separately established depressive disorder; the cited nationally representative survey reported substantial comorbidity of OCD with mood disorders as a class and does not establish onset order or direction. Preserve other anxiety disorders, substance use, medical illness, medications, and shared vulnerability as competing explanations. Do not infer a depressive disorder from OCD symptoms or distress alone, and do not treat this population-level association as proof that OCD caused an individual's depressive disorder.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 4. `binge-eating-disorder` → `depressive-disorder`
- Rank: **1** — PMID: **16815322** — DOI: `10.1016/j.biopsych.2006.03.040`
- Source: Hudson JI, Hiripi E, Pope HG Jr, Kessler RC. The prevalence and correlates of eating disorders in the National Comorbidity Survey Replication. Biol Psychiatry. 2007;61(3):348-358. PMID 16815322. doi:10.1016/j.biopsych.2006.03.040.
- Claim boundary: population-level-comorbidity-association
- Guard: Require independently established binge eating disorder and separately established depressive disorder; the cited nationally representative survey found eating disorders significantly comorbid with many other DSM-IV disorders without establishing direction of onset. Preserve obesity and metabolic disease, other eating pathology, substance use, medications, and other psychiatric illness as competing explanations. Do not infer a depressive disorder from binge eating symptoms, weight change, or role impairment alone, and do not treat this population-level association as proof that binge eating disorder caused an individual's depressive disorder.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 5. `bipolar-disorder` → `anxiety-disorder`
- Rank: **1** — PMID: **17485606** — DOI: `10.1001/archpsyc.64.5.543`
- Source: Merikangas KR, Akiskal HS, Angst J, Greenberg PE, Hirschfeld RM, Petukhova M, Kessler RC. Lifetime and 12-month prevalence of bipolar spectrum disorder in the National Comorbidity Survey replication. Arch Gen Psychiatry. 2007;64(5):543-552. PMID 17485606. doi:10.1001/archpsyc.64.5.543.
- Claim boundary: class-level-comorbidity-association
- Guard: Require independently established bipolar disorder and a separately established anxiety disorder diagnosis; the cited nationally representative survey reported lifetime comorbidity of bipolar spectrum disorder with other Axis I disorders, particularly anxiety disorders as a class, and does not specify onset order or direction. Distinguish an independent anxiety disorder from anxiety symptoms occurring within manic, hypomanic, or depressive episodes. Preserve substance use, medical illness, medications, and other psychiatric illness as competing explanations. Treat this only as population-level comorbidity association, not proof that bipolar disorder caused an individual's anxiety disorder.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## Projected non-publication counts
- Relationships: 243 → **248**
- Registered primaries: 155 → **159**
- Remaining primaries: 156 → **152**
- Remaining target-only: 39 → **37**
- Remaining never-used: 117 → **115**
- References: 251 → **256**; verified remains **251**; unverified 0 → **5**
- Master sources: 228 active / 0 pending / 237 total → **228 active / 5 pending / 242 total**
- Clinical sources: 227 active / 0 pending → **227 active / 5 pending**
- Explicit publication guards: 169 → **174**
- P1/D1 counts are resolved from the read-before-write publication-state proof.

## Local implementation result
- 5/5 approved relationships added (4 rank-1, 1 rank-2).
- Publication state preserved from the read-before-write proof: `{"anxiety-disorder": "draft", "panic-disorder": "draft", "ocd": "draft", "binge-eating-disorder": "draft", "bipolar-disorder": "draft"}`.
- 5/5 new source references remain `verified:false`; matching master sources are `pending-verification`.
- Registered-primary coverage is 159/311; 152 primaries remain, partitioned 37 target-only / 115 never-used.
- Citation verification remains separately gated (qualified-human decision approve-as-implemented captured for the verify commit).
- No GitHub/Vercel write was performed.

