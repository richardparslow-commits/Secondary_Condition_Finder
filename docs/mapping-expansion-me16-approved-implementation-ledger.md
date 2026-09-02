# Mapping Expansion ME-16 — Approved Implementation Ledger

**APPROVED AND APPLIED LOCALLY — CITATIONS PENDING VERIFICATION**

Required baseline: `d6783c1652ade0b005ef0a952ba667126523e09c`
Commit subject: `map: mapping expansion ME-16 (5 relationships)`
Issue: #360 Mapping Expansion Wave: Mental Disorders (ME-15+)

## Approved scope

Five bounded Mental Disorders relationships approved by qualified-human review on 2026-09-01. All five rows enter at rank 1 on previously unregistered draft primaries; each primary's live publication state is read immediately before mutation and preserved unchanged (all five remain draft). All five new clinical source references enter as `verified:false`; matching master sources (four new, one fresh 2026-09-01 source record) enter as `pending-verification`. Citation verification is separately gated (approval decision pre-captured at planning: `approve-as-implemented` for all five).

## 1. `bulimia-nervosa` → `depressive-disorder`
- Rank: **1** — PMID: **21383252** — DOI: `10.1001/archgenpsychiatry.2011.22`
- Source: Swanson SA, Crow SJ, Le Grange D, Swendsen J, Merikangas KR. Prevalence and Correlates of Eating Disorders in Adolescents: Results From the National Comorbidity Survey Replication Adolescent Supplement. Arch Gen Psychiatry. 2011;68(7):714-723. PMID 21383252. doi:10.1001/archgenpsychiatry.2011.22.
- Claim boundary: population-level-comorbidity-association (adolescent NCS-A sample)
- Guard: Require independently established bulimia nervosa and separately established depressive disorder; the cited nationally representative adolescent survey reported substantial bulimia nervosa comorbidity with mood disorders without establishing onset order or direction, and its adolescent sample should not be overgeneralized to adult populations. Preserve obesity and metabolic disease, other eating pathology, substance use, medications, and other psychiatric illness as competing explanations. Do not infer a depressive disorder from eating-disorder symptoms, weight concern, or role impairment alone, and do not treat this population-level association as proof that bulimia nervosa caused an individual's depressive disorder.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 2. `specific-phobia` → `depressive-disorder`
- Rank: **1** — PMID: **28222820** — DOI: `10.1017/S0033291717000174`
- Source: Wardenaar KJ, Lim CCW, Al-Hamzawi AO, et al. The cross-national epidemiology of specific phobia in the World Mental Health Surveys. Psychol Med. 2017;47(10):1744-1760. PMID 28222820. doi:10.1017/S0033291717000174.
- Claim boundary: population-level-comorbidity-association
- Guard: Require independently diagnosed specific phobia and separately established depressive disorder; the cited cross-national survey reported specific phobia comorbidity with other mental disorders and does not establish onset order or direction. Preserve other anxiety disorders, depressive disorders, substance use, medical causes of episodic symptoms, and avoidance attributable to other conditions as competing explanations. Do not infer a depressive disorder from phobic avoidance, distress, or impairment alone, and do not treat this population-level association as proof that specific phobia caused an individual's depressive disorder.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 3. `hoarding-disorder` → `depressive-disorder`
- Rank: **1** — PMID: **24158881** — DOI: `10.1192/bjp.bp.113.130195`
- Source: Nordsletten AE, de la Cruz LF, Billotti D, Mataix-Cols D. Epidemiology of hoarding disorder. Br J Psychiatry. 2013;203(6):445-452. PMID 24158881. doi:10.1192/bjp.bp.113.130195.
- Claim boundary: population-level-comorbidity-association
- Guard: Require independently established DSM-5 hoarding disorder and separately established depressive disorder; the cited community study reported elevated comorbidity of hoarding disorder with mood and anxiety disorders and does not establish onset order or direction. Preserve other psychiatric illness, substance use, medical illness, medications, shared vulnerability, and disorganization or collecting behavior attributable to other conditions as competing explanations. Do not infer a depressive disorder from hoarding-related distress or impairment alone, and do not treat this population-level association as proof that hoarding disorder caused an individual's depressive disorder.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 4. `body-dysmorphic-disorder` → `depressive-disorder`
- Rank: **1** — PMID: **16893571** — DOI: `10.1016/j.jad.2006.06.006`
- Source: Phillips KA, Didie ER, Menard W, Pagano ME, Fay C, Weisberg RB. Clinical features and correlates of major depressive disorder in individuals with body dysmorphic disorder. J Affect Disord. 2007;97(1-3):129-135. PMID 16893571. doi:10.1016/j.jad.2006.06.006.
- Claim boundary: clinical-sample-comorbidity-association
- Guard: Require independently established body dysmorphic disorder and separately established major depressive disorder; the cited clinical sample reported high lifetime comorbidity of body dysmorphic disorder with major depressive disorder and does not establish onset order or direction. Preserve eating disorders, OCD-spectrum conditions, social anxiety disorder, substance use, and other psychiatric illness as competing explanations. Do not infer a depressive disorder from appearance-preoccupation distress or impairment alone, and do not treat this clinical-sample association as proof that body dysmorphic disorder caused an individual's depressive disorder.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 5. `agoraphobia` → `depressive-disorder`
- Rank: **1** — PMID: **27775828** — DOI: `10.1002/da.22572`
- Source: de Jonge P, Roest AM, Lim CCW, et al. Cross-national epidemiology of panic disorder and panic attacks in the World Mental Health Surveys. Depress Anxiety. 2016;33(12):1155-1177. PMID 27775828. doi:10.1002/da.22572.
- Claim boundary: population-level-comorbidity-association
- Guard: Require independently documented DSM-5 agoraphobia and separately established depressive disorder; under DSM-5 agoraphobia is distinct from panic disorder and must not be inferred from panic attacks or panic disorder alone. The cited cross-national survey reported agoraphobia comorbidity with depressive and other disorders without establishing onset order or direction. Preserve other anxiety disorders, depressive disorders, substance use, medical causes of episodic symptoms, and avoidance attributable to other conditions as competing explanations. Do not present co-occurrence as inevitable progression, and do not treat this population-level association as proof that agoraphobia caused an individual's depressive disorder.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## Projected non-publication counts
- Relationships: 248 → **253**
- Registered primaries: 159 → **164**
- Remaining primaries: 152 → **147**
- Remaining target-only: 38 → **37**
- Remaining never-used: 114 → **110**
- References: 256 → **261**; verified remains **256**; unverified 0 → **5**
- Master sources: 233 active / 0 pending / 242 total → **233 active / 5 pending / 247 total**
- Clinical sources: 232 active / 0 pending → **232 active / 5 pending**
- Explicit publication guards: 174 → **179**
- P1/D1 counts are resolved from the read-before-write publication-state proof.

## Local implementation result
- 5/5 approved relationships added (all rank 1).
- Publication state preserved from the read-before-write proof: `{"bulimia-nervosa": "draft", "specific-phobia": "draft", "hoarding-disorder": "draft", "body-dysmorphic-disorder": "draft", "agoraphobia": "draft"}`.
- 5/5 new source references remain `verified:false`; matching master sources are `pending-verification` (four new master source records; the bulimia row uses a dedicated NCS-A source, PMID 21383252, rather than reusing the ME-15 NCS-R source so that pending state is not mixed with an active verified source).
- Registered-primary coverage is 164/311; 147 primaries remain, partitioned 37 target-only / 110 never-used.
- Citation verification remains separately gated (qualified-human decision approve-as-implemented pre-captured at planning for the verify commit).
- No GitHub/Vercel write was performed.