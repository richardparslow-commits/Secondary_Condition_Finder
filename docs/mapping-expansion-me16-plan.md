# Mapping Expansion ME-16 — Mental Disorders Wave Batch 2 (Research Plan)

**STATUS: RESEARCH AND PLANNING — NOT YET APPROVED**

Issue: #360 Mapping Expansion Wave: Mental Disorders (ME-15+)
Required baseline for the future map step: `75e956d` (ME-15 verification commit, current branch head).
Planned subjects: `map: mapping expansion ME-16 (5 relationships)` then `verify: mapping expansion ME-16 citations (5 relationships)`.

This document records the research supporting a proposed ME-16 batch. Nothing here is implemented; a qualified-human approval gate (mapping approval plus a separately captured citation-verification decision) must precede implementation, mirroring ME-15.

## Current-state baseline (post ME-15 verification)

- Knowledge-base files: 311; published 139 / draft 172.
- Relationships: **248**; explicit publication guards 174; legacy rationale boundaries 74.
- Registered primaries: **159** / 311; remaining **152** (38 target-only / 114 never-used).
- Live references: **256**; verified **256**; unverified **0**; verified provenance 262 (including 6 retired).
- Master sources: **233 active / 0 pending / 242 total**; active clinical 232 / pending clinical 0.
- Registry state: `ME15-CITATION-VERIFIED`; baseline `126bc0d0983c8b4cfd90457a7a6a68e3f7f30e97`.

## Available mental-disorder primary pool

All of the following are draft with zero suggestions (rank 1 is free for each):

| Primaries | Pool |
|---|---|
| `bulimia-nervosa`, `specific-phobia`, `hoarding-disorder`, `body-dysmorphic-disorder`, `persistent-depressive-disorder`, `illness-anxiety-disorder`, `somatic-symptom-disorder`, `adjustment-disorder`, `dissociative-disorder`, `depersonalization-derealization-disorder`, `functional-neurological-symptom-disorder`, `delusional-disorder`, `schizoaffective-disorder` | never-used (114 pooled) |
| `agoraphobia` | target-only (38 pooled; inbound 1 from ME-15 `panic-disorder`) |

## Proposed ME-16 scope — five bounded edges

All rows enter at **rank 1**, prevalence `sometimes-explored`, no `pathwayIntelligence`, `verified:false` until a separate qualified-human verification gate (approval decision pre-captured at planning: `approve-as-implemented` for all five, same as ME-15).

### 1. `bulimia-nervosa` → `depressive-disorder`
- Source: Hudson JI, Hiripi E, Pope HG Jr, Kessler RC. The prevalence and correlates of eating disorders in the National Comorbidity Survey Replication. Biol Psychiatry. 2007;61(3):348-358. **PMID 16815322** (shared parent source with the ME-15 `binge-eating-disorder` row; the NCS-R paper reports bulimia nervosa comorbidity with mood disorders separately from BED; a master source already supports multi-row use, e.g. PMID 40772230 across 7 rows).
- Claim boundary: population-level comorbidity association; NCS-R found BN significantly comorbid with mood and anxiety disorders without establishing onset order or direction.
- Guard seed: Require independently established bulimia nervosa and separately established depressive disorder; do not infer depression from eating-disorder distress, weight concern, or impairment alone. Preserve obesity/metabolic disease, other eating pathology, substance use, medications, and other psychiatric illness as competing explanations. Population-level association only, not proof that bulimia nervosa caused an individual's depressive disorder.

### 2. `specific-phobia` → `depressive-disorder`
- Source: Wardenaar KJ, et al. The cross-national epidemiology of specific phobia in the World Mental Health Surveys. Psychol Med. 2017;47(10):1744-1760. **PMID 28222820** — DOI 10.1017/S0033291717000174.
- Claim boundary: cross-national comorbidity association (WMH); phobia subtypes vary in impairment; onset-order/direction not established.
- Guard seed: Require independently diagnosed specific phobia and separately established depressive disorder under DSM-5; do not infer depression from phobic avoidance or distress alone. Preserve other anxiety disorders, depressive disorders, substance use, medical causes of episodic symptoms, and avoidance attributable to other conditions as competing explanations. Population-level association only.

### 3. `hoarding-disorder` → `depressive-disorder`
- Source: Nordsletten AE, de la Cruz LF, Billotti D, Mataix-Cols D. Epidemiology of hoarding disorder. Br J Psychiatry. 2013;203(6):445-452. **PMID 24158881** — DOI 10.1192/bjp.bp.113.130195.
- Claim boundary: comorbidity association in a UK community sample (1.5% weighted prevalence; elevated comorbid depressive and anxiety disorders); DSM-5 hoarding disorder identity required.
- Guard seed: Require independently established DSM-5 hoarding disorder and separately established depressive disorder; hoarding (difficulty discarding, clutter, distress/impairment) must not be inferred from depression-related disorganization or from collecting behavior. Preserve other psychiatric illness, substance use, medical illness, medications, and shared vulnerability as competing explanations. Population-level association only, not proof that hoarding disorder caused an individual's depressive disorder.

### 4. `body-dysmorphic-disorder` → `depressive-disorder`
- Source: Phillips KA, Didie ER, Menard W, et al. Clinical features and correlates of major depressive disorder in individuals with body dysmorphic disorder. J Affect Disord. 2007;97(1-3):129-135. **PMID 16893571**.
- Claim boundary: clinical-sample comorbidity study (74.2% lifetime MDD in the BDD sample); association only; no direction-of-onset claim.
- Guard seed: Require independently established body dysmorphic disorder and separately established major depressive disorder; do not infer depressive disorder from appearance-preoccupation distress alone. Preserve eating disorders, OCD-spectrum conditions, social anxiety, substance use, and other psychiatric illness as competing explanations. Population-level/clinical-sample association only, not proof that BDD caused an individual's depressive disorder.

### 5. `agoraphobia` → `depressive-disorder`
- Source: de Jonge P, et al. Cross-national epidemiology of panic disorder and panic attacks in the World Mental Health Surveys. Depress Anxiety. 2016;33(12):1155-1177. **PMID 27775828** — DOI 10.1002/da.22572.
- Claim boundary: cross-national comorbidity association; DSM-5 agoraphobia is distinct from panic disorder and must be separately established.
- Guard seed: Require independently documented DSM-5 agoraphobia and separately established depressive disorder; agoraphobia must not be inferred from panic attacks or panic disorder alone (echoes the ME-15 `panic-disorder -> agoraphobia` guard). Preserve other anxiety disorders, depressive disorders, substance use, medical causes of episodic symptoms, and avoidance attributable to other conditions as competing explanations. Population-level association only, not proof that agoraphobia caused an individual's depressive disorder.

## Projected registry deltas

### Map step (ME-16 map commit; all new refs `verified:false`)
- Relationships: 248 → **253**; explicit guards 174 → **179**.
- Registered primaries: 159 → **164**; remaining 152 → **147** (target-only 38 → 37; never-used 114 → 110).
- References: 256 → **261**; verified 256; unverified 0 → **5**.
- Master sources: 242 → **247** total; active 233; pending 0 → **5** (all clinical).
- Publication state: all five primaries remain **draft**; no P1/D1 change (draft D1 19 → **24**).
- Registry state: `ME16-PRE-QUALIFIED-HUMAN-CITATION-VERIFICATION`; baseline `75e956d`.

### Verify step (separately-gated ME-16 verification commit)
- Verified: 256 → **261**; unverified 5 → **0**; provenance 262 → **267**.
- Master sources: 233 active / **0 pending** (all five promoted `approve-as-implemented`).
- Registry state: `ME16-CITATION-VERIFIED`; baseline = the ME-16 map commit.
- No relationship, rank, guard, publication, taxonomy, or pathway changes.

## ME-17+ bench (same issue #360, not committed)

- `persistent-depressive-disorder` → `depressive-disorder`: Klein DN, Shankman SA, Rose S. Ten-year prospective follow-up study of the naturalistic course of dysthymic disorder and double depression. Am J Psychiatry. 2006;163(5):872-880. **PMID 16648329** — 95.1% lifetime MDD episode in the dysthymia sample; temporal risk framing (major depressive episode superimposed on persistent depressive disorder), guard must define the "double depression" proposition precisely.
- `somatic-symptom-disorder` → `depressive-disorder`: Löwe B, et al. Depression, anxiety and somatization in primary care: syndrome overlap and functional impairment. Gen Hosp Psychiatry. 2008. **PMID 18433651** — syndrome-level overlap >50%; guard must map somatization-syndrome evidence to the DSM-5 SSD identity (guard-heavy).
- `illness-anxiety-disorder` → `depressive-disorder`: no strong population-level source resolved at planning; requires dedicated literature search before this row can proceed (HOLD).
- `adjustment-disorder` → `depressive-disorder`, `delusional-disorder` → `depressive-disorder`, `dissociative` / `functional-neurological-symptom-disorder` → `depressive-disorder`, `schizoaffective-disorder`: diagnostic-overlap and phenotype-identity guards insufficiently supported at planning (HOLD).

## Sequencing and gates

1. Author the five ME-16 KB edges + master registry rows + implementation ledger (mirror ME-15 map commit shape: 5 relationships, 5 pending sources, preserved draft publication states).
2. Run `audit-master-registry.js`, `audit-citation-verification.js` (baseline raised to unverified 5), vitest, typecheck, lint on the exact branch head.
3. Capture qualified-human `approve-as-implemented` for all five citations (separate from mapping approval), then apply the ME-16 verification commit (5 KB promotions + 5 master-source activations + ledger + pinned-test bumps).
4. Local implementation only — no GitHub/Vercel write until the branch is merged through the established PR flow.

## Open items before implementation

1. Bulimia row source: reuse PMID 16815322 (recommended; same NCS-R sample, distinct proposition) vs. a bulimia-specific dedicated source (e.g., adolescent NCS-A PMID 21727255 raises an age-population mismatch) — decide at approval.
2. Confirm exact de Jonge 2016 agoraphobia-comorbidity coverage against the full text during authoring; if the agoraphobia-specific association is not independently reported, narrow to panic/agoraphobia-class association or substitute a dedicated agoraphobia source.
3. Confirm full author lists and DOIs (Phillips 2006 DOI, Wardenaar/Nordsletten DOIs above) from the canonical PubMed records during authoring; mapping approval is not citation verification.