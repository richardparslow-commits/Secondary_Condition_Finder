# Missing-identity addition roadmap — evidence-preserving refusals and catalog gaps

**Status:** living planning document, written 2026-09-28. Current-state numbers here are
generated, not transcribed — registry and debt totals come from `node scripts/audit-master-registry.js`,
`node scripts/audit-citation-verification.js`, `npm run authoring:tracker`, and `npm run citations:audit`.
The numbers below are refusal ordinals, batch numbers, and PMID identifiers: the immutable record of the
cited ledger entries in `docs/condition-expansion-roadmap.md`, not repository snapshots.

## What this document is

Every time the mapping workflow located authoring-quality evidence for a route that could not be
authored compliantly, the proposition and its anchors were preserved rather than discarded — an
**evidence-preserving refusal**. Twelve of these carry ordinals in the batch record. This document:

1. inventories every numbered evidence-preserving refusal, classified by blocker type and status;
2. inventories the unnumbered catalog-gap continuations that accumulated alongside them;
3. prioritizes the missing-identity additions that would unblock the most preserved evidence; and
4. records the versioned-migration mechanics each addition must follow.

The refusal narratives live in the batch comments of `scripts/audit-master-registry.js` and
`scripts/audit-citation-verification.js`, in the ledger entries of `docs/condition-expansion-roadmap.md`,
and in the governance notes / todo lists of the individual `data/knowledge-base/<id>.json` files. This
document is the cross-cutting index, not a replacement for any of them.

## The numbered evidence-preserving refusal series

| # | Refusal (primary → target) | Batch | Blocker | Missing identity | Preserved evidence | Status |
|---|---|---|---|---|---|---|
| 1 | `nightmare-disorder` → `suicidal-ideation` | 64 | MISSING IDENTITY | `suicidal-ideation` | PMID 32807889 (meta-analytic nightmares-to-attempt OR 1.81); PMID 40265245 (acute-trauma cohort, ideation 42.9 versus 6.7 percent) | STILL BLOCKED |
| 2 | `nocturnal-enuresis` → `suicidal-ideation` | 65 | MISSING IDENTITY | `suicidal-ideation` | PMID 16005077 (bladder-control-attainment cohort suicidality proposition) | STILL BLOCKED |
| 3 | `overactive-bladder` → `suicidal-ideation` | 68 | MISSING IDENTITY | `suicidal-ideation` | OAB ideation proposition recorded on the file | STILL BLOCKED |
| 4 | `phantom-limb-pain` → `suicidal-ideation` | 71 | MISSING IDENTITY | `suicidal-ideation` | PMID 36163201 (OR 1.62) | STILL BLOCKED |
| 5 | `polymyalgia-rheumatica` → `giant-cell-arteritis` | 73 | MISSING IDENTITY | `giant-cell-arteritis` | PMID 41140743 (southern-Sweden predictor cohort; PMR progresses to or overlaps GCA in a well-quantified minority) | STILL BLOCKED — also withholds the ischemic-optic-neuropathy window that belongs to the unregistered GCA identity (`-> visual-impairment`, `-> blindness`) |
| 6 | `premature-atrial-ventricular-contractions` → `atrial-fibrillation` | 74 | MISSING IDENTITY | `atrial-fibrillation` (specific identity; the coarse `cardiac-arrhythmia` umbrella cannot receive a progression-to-AF signal) | risk signal preserved in `data/knowledge-base/premature-atrial-ventricular-contractions.json` | STILL BLOCKED |
| 7 | `pseudophakia` → `cystoid-macular-edema` | 76 | MISSING IDENTITY | `cystoid-macular-edema` | Irvine-Gass cohort literature preserved on the file | STILL BLOCKED — gap continuation recorded again in batch 79 |
| 8 | `raynaud-s-phenomenon` → `digital-ulcers` | 77 | MISSING IDENTITY | `digital-ulcers` (companions `gangrene`, `digital-ischemia` also missing) | PMID 29804150 (vascular-complications cohorts) | STILL BLOCKED |
| 9 | `restless-leg-syndrome` → `suicidal-ideation` and → `self-harm` | 78 | MISSING IDENTITY | `suicidal-ideation` **and** `self-harm` | PMID 31441941 (claims cohort, adjusted HR 2.66); PMID 30529070 (lifetime ideation or behavior 27.1 versus 7.0 percent, odds 2.80); PMID 34985142 (registered on the depressive-disorder edge) | STILL BLOCKED |
| 10 | `schizophrenia` → `tardive-dyskinesia` | 80 | MISSING IDENTITY | `tardive-dyskinesia` | PMID 37424417, PMID 39240484, PMID 42030922 | **RESOLVED 2026-09-28** — identity added as the versioned 814th entry (`data/conditions/neurological.json`, commit `2c9acb50`); route **held, not refused**, in `docs/batch-90-schizophrenia-tardive-dyskinesia-held-edge.json` pending qualified-human verification |
| 11 | `rotator-cuff-tear` closure | 82 | IDENTITY-DUPLICATION — **corrected 2026-09-28 to UMBRELLA/MEMBER** | none — the pair is umbrella (`rotator-cuff-injury`, "Rotator Cuff Tendonitis / Tear") and tear member, not two names for one disease | none required | **RESOLVED 2026-09-28** — closure vacated by the three-closure adjudication (`docs/modeling-debt-dispositions.md`), then reconciled the same day to canonical `rotator-cuff-injury` as a quarantined pointer record (all registered edges and sources preserved) |
| 12 | `short-qt-syndrome` → `long-qt-syndrome` | 83 | EVIDENCE-CONTRADICTED | none | inverse QTc-arrhythmia relationship preserved as the refusal rationale (median 315.0 versus 330.0 ms, P=0.0023) | **PERMANENT REFUSAL** absent new evidence — this is not an identity gap |

The series order is pinned by the batch-78 entry ("the NINTH evidence-preserving refusal with no catalog
target identity, after nightmare-disorder, nocturnal-enuresis, overactive-bladder, phantom-limb-pain,
giant-cell-arteritis, premature-atrial-contraction to atrial-fibrillation, pseudophakic cystoid macular
edema, and raynaud digital-ulcer disease") and by the later ordinal confirmations (sixth in batch 74,
seventh in batch 76, eighth in batch 77, tenth in batch 80, eleventh in batch 82, twelfth in batch 83).
**The series stops at twelve**: batches 84 onward record gaps deliberately as unnumbered catalog-gap
continuations (batch 79: "catalog-gap continuations rather than numbered evidence-preserving refusals, so
the count remains at nine"), so no thirteenth ordinal exists and none should be minted without the same
ledger discipline.

## Classification by blocker type

**MISSING IDENTITY — ten of the twelve (refusals 1–10).** The dominant class by a wide margin. Nine of
these are still blocked (1–9); one is resolved (10). They cluster into three shapes:

- **The suicidality cluster (refusals 1, 2, 3, 4, 9).** Five numbered refusals, six preserved routes, all
  blocked on the same two absent identities: `suicidal-ideation` and `self-harm`. The batch-64 note
  verified across `data/conditions` that the catalog holds NO suicidality identity of any kind. This is
  the highest-leverage gap in the entire series: two identity additions close five ordinals.
- **Single-target gaps (refusals 5, 6, 7, 8).** `giant-cell-arteritis`, `atrial-fibrillation`,
  `cystoid-macular-edema`, `digital-ulcers` — one identity each, evidence preserved and waiting.
- **The resolved one (refusal 10).** `tardive-dyskinesia` is the proof case: identity added as a versioned
  catalog addition, preserved routes resumed, one registered and one held for citation verification.

**IDENTITY-DUPLICATION — one of the twelve (refusal 11), since corrected.** The batch-82 closure recorded
the pair as two open identities for one disease and closed `rotator-cuff-tear` reversibly. The 2026-09-28
three-closure adjudication (`docs/modeling-debt-dispositions.md`) **corrected that framing to
umbrella/member**: `rotator-cuff-injury` ("Rotator Cuff Tendonitis / Tear") is the umbrella over the
tendinopathy/tear spectrum and `rotator-cuff-tear` is the tear member, so the closure is vacated; the
pair was then reconciled the same day to canonical `rotator-cuff-injury` with the member retained as a
quarantined pointer record, so tear claims are authored under the canonical umbrella entry. Of the three batch-80/82/84 identity closures, only `skier-s-thumb` /
`gamekeeper-s-thumb` was a genuine synonymy and only that closure stands (canonical-name election is a
versioned migration); the batch-80 `eczema` / `atopic-dermatitis-eczema` pair was retracted as a scope split
by the 2026-09-28 identity review, which is the standing prejudice for future duplication findings: check
scope before closing. Batch 86 recorded the **mirror**
case — the catalog finer than the evidence (`spermatocele` *is* an `epididymal-cyst`; the two are one
category in the located cohort) — refused on taxonomic containment, durable in the file's todo list. Taxonomic
containment is not a secondary condition and never becomes an edge.

**EVIDENCE-CONTRADICTED — one of the twelve (refusal 12).** The located evidence reports the opposite of
the proposed direction. No identity addition can ever unblock this route; only new evidence could.

## Unnumbered missing-identity gaps (catalog-gap continuations)

Recorded without ordinals, by theme and provenance batch:

- **Injury semantics (batch 85).** Self-injury and injury to bed partners — the most concrete finding in
  the sleepwalking anchor (injuries requiring medical care in 17 percent), no identity to receive it.
- **Amblyopia (batch 87).** The batch's most consequential refusal: the single most important consequence
  of `strabismus`, the visual-deficiency outcome a unilateral or alternating deviation produces through
  suppression in the critical period, and the catalog has no identity for it at all. Recorded in the
  `data/knowledge-base/strabismus.json` todo list for the next catalog curator.
- **Drug-induced movement-disorder family (batch 88).** Status 2026-09-28: `drug-induced-parkinsonism`,
  `neuroleptic-malignant-syndrome` and `serotonin-syndrome` **added** in the versioned 814/814 → 817/817
  migration; `dystonia` and `akathisia` **remain missing** — a family-level omission rather than
  coincidences. The toxidrome pair's located literature is dominated by case reports and post-marketing
  signal analyses and needs a non-case-report anchor tier even now the identities exist. The reserved
  FACE-SZ quantification (drug-induced parkinsonism 13.2 percent, adjusted
  OR 2.038 for first-generation prescription, PMID 30695288) and the reserved Piedmont cohort (PMID
  34652577) must stay strictly separated: the latter studies **degenerative** parkinsonism and attributing
  it to a reversible drug effect would be a category error.
- **Metabolic and GI (batches 80, 85).** `obesity` — the single most clinically significant association in
  the located sleep-related-eating-disorder literature (the primary anchor enrolled obese subjects
  specifically), a gap carried since batch 80; also `small-bowel-obstruction`, perforation,
  `vitamin-b12-deficiency`, and `alcohol-use-disorder` (missing identity **and** confounding exposure).
- **Nerve and head-and-neck (batch 81).** `facial-nerve-palsy` (the most frequent neurological
  accompaniment of parotid malignancy); `scleredema` → cachexia / `metabolic-syndrome` (with `obesity`
  overlapping the metabolic row above).
- **Endocrine and renal (batches 80, 88).** Nephrogenic diabetes insipidus (batch-80 continuation);
  `hypercalcaemia` — the direct cause of the batch-88 scope mapping, where a calcium finding had to be
  mapped onto the narrower parathyroid identity and the mapping is not reversible without returning to
  the edge's association basis.
- **Ophthalmic companions (batches 76, 79, 81).** Pseudophakia → posterior-capsule-opacification /
  endophthalmitis (constitutive/missing mix); the uveitic cystoid-macular-edema continuation;
  `scotoma` → optic-neuritis (DUPLICATE-SCOPE **and** missing identity).
- **Vascular companions (batch 77).** Raynaud → `gangrene` / `digital-ischemia`.
- **Salivary subtypes and miscellany (batch 84).** Chronic sialadenitis, eosinophilic sialodochitis,
  radioiodine-induced sialadenitis, IgG4-related sialadenitis (the generic `sialadenitis` identity
  exists — these are subtype-scoped gaps), orbital cellulitis, thumb avulsion fracture.
- **Older continuations (batches 25, 64–79).** Opsoclonus-myoclonus-ataxia (batch 64, neuroblastoma
  proposition); NPH gait impairment and falls (batch 65); a generic headache identity for papilledema
  (batch 68); stridor/dysphonia (batch 67); dyspnoea and chest pain (batch 71, pleura-cancer);
  musculoskeletal contracture outcomes (batch 25); the batch-79 continuation set (anosmia, growth-failure,
  developmental-delay, dilated-cardiomyopathy, tracheal-stenosis, extrathyroidal-involvement,
  blepharitis).
- **Mechanism vocabulary (batch 86).** Perineural invasion is tumour spread *along* a nerve, not a
  neuropathy of that nerve, and no catalog identity represents the mechanism.
- **Corpus-review companions (batch 91).** `sarcopenia` — the corpus's liver-cancer sarcopenia-route
  lead cannot be authored at all while the identity is absent (the route is otherwise unblocked);
  `temporomandibular-disorder` (TMJ) remains missing AND any bruxism-to-TMJ route stays separately
  barred by the ME-34 evidence rejection (PMID 9758394), so the gap is doubled; `alcohol-use-disorder`
  is re-confirmed as the blocking identity for the batch-91 `ptsd` to `chronic-liver-disease`
  self-medication-chain withholding (PMID 30080255 preserved under ME-29).


**Catalog cross-check of 2026-09-29 (the migration design corrects a third claim).** The batch-91
companions bullet above states that `temporomandibular-disorder` (TMJ) "remains missing" — that claim is
**wrong**, in the same way the batch-84 `atrial-flutter` claim was wrong. The catalog already carries TWO
TMJ identities (`tmj-disorder`, "Temporomandibular Joint (TMJ) Disorders", and `tmj-dysfunction`, "TMJ
dysfunction", which already holds the literal alias "temporomandibular disorder"), both zero-suggestion
drafts with no registered edges, and the records use three notations for one target (ME-34's
`tmj-dysfunction`, the withdrawn batch-6 draft's `tmj-disorder`, and the never-minted
`temporomandibular-disorder`). The real gap is **identity coordination, not absence**: minting a third
identity would collide with the existing alias. The versioned migration design of 2026-09-29
(`docs/catalog-identity-migration-design-2026-09-29.md`) elects `tmj-disorder` canonical (the
rotator-cuff pointer precedent), quarantines `tmj-dysfunction` as a pointer record, resolves the
`temporomandibular-disorder` notation into the canonical name, and carries a signed ME-34 reopening
disposition (age-scope reconciliation of the juvenile null PMID 9758394 against the adult meta-analytic
association PMIDs 37474733 and 27796166) that unblocks the preserved bruxism-to-TMJ route alone. The
same design covers the genuinely missing pair: `sarcopenia` (flat addition, closing the liver-cancer
sarcopenia gap) and `alcohol-use-disorder` (a scope split from the `substance-use-disorder` discovery
grouping, whose "alcohol use disorder" and "alcoholism" aliases migrate to the new identity), moving the
frozen contract 817/817 to 819/819 at execution. **Execution update 2026-10-03:** staged Leg A landed locally with the `sarcopenia` addition alone (contract 817/817 to 818/818; the coordinated pin migration is complete and `kb:validate` is green), because the liver-cancer route needs its target identity before any lawful edge exists; the route's three PubMed anchors (PMID 37274463, PMID 36590214, PMID 26266324) were located, absent-checked against the registry, and cleared by source-status preflight with zero blocking flags the same day, and are authored as the first real adjacency edge in `data/knowledge-base/graph/liver-cancer.json`. **Execution update 2026-10-03 (Stage 3b):** the authored-corpus registration landed the same day — `data/knowledge-base/liver-cancer.json` now carries the rank-1 ASSOCIATION_ONLY suggestion with its three verified:false references, `data/evidence/master-relationships.json` and `data/evidence/master-sources.json` carry the relationship row and the three pending-verification source entities in lockstep, and the citation/registry ratchets moved to 1,693 live reference uses (1,298 pending; 1,486 source entities including lineage). **Execution update 2026-10-03 (stage 2 Leg B):** the `alcohol-use-disorder` identity landed the same day as a versioned scope split from the `substance-use-disorder` discovery grouping (contract 818/818 to 819/819; the aliases `alcohol use disorder` and `alcoholism` migrated off the umbrella, which keeps `substance abuse` and its non-alcohol substance scope, and the coordinated pin migration is complete with `kb:validate` green at 819/819). The identity is a zero-suggestion draft; its Stage 3a windows (`alcohol-use-disorder` → `chronic-liver-disease` on the ordinary draft path with preserved PMID 30080255 attaching under ME-29, and the `ptsd` → `alcohol-use-disorder` held artifact because `ptsd` is published) remain to land. **Execution update 2026-10-03 (stage 1, Leg C):** the TMJ canonical election and pointer quarantine landed the same day — `tmj-disorder` is canonical (with the alias set migrated off `tmj-dysfunction` plus `temporomandibular disorders` minted; the variant name `tmj dysfunction` stays on the pointer's own catalog name under the catalog alias invariant), `tmj-dysfunction` is a quarantined pointer record with its stable ID and KB file retained, and `docs/modeling-debt-dispositions.md` carries the disposition. No catalog count moves and no registry row moves (both identities are zero-suggestion drafts), and the signed ME-34 reopening edge (`bruxism-awake-sleep` → `tmj-disorder`, design Stage 3c) remains unexecuted. **Execution update 2026-10-04 (Stage 3a):** both designed windows landed. The `alcohol-use-disorder` → `chronic-liver-disease` route is registered on the ordinary draft path as rank 1 at ASSOCIATION_ONLY (hypothesizedOnly, etiological consensus NOT_ESTABLISHED) in `data/knowledge-base/alcohol-use-disorder.json`, with the preserved batch-91 anchor PMID 30080255 attached under ME-29 and the dose-response anchors PMID 36926309 and PMID 20636661 as verified:false references; the relationship row `rel-alcohol-use-disorder-to-chronic-liver-disease`, the three pending-verification source entities and the adjacency node `data/knowledge-base/graph/alcohol-use-disorder.json` landed in lockstep, and the registry ratchets moved to 872 recorded relationship rows (798 explicit guards) and 1,696 live reference uses (1,301 pending; 1,489 source entities including lineage) with the publication splits and verified counts unmoved. The `ptsd` → `alcohol-use-disorder` window is fully authored but HELD as `docs/batch-93-ptsd-alcohol-use-disorder-held-edge.json` (rank 21; the `ptsd` mapping is published and the per-suggestion citation-purity gate admits no verified:false reference), with its three anchors (PMIDs 35587413, 32939901, 24933396) absent-checked and preflight-cleared the same day and a CRG parallel-targeting review against the registered `ptsd` → `substance-use-disorder` window recorded as a landing condition; the direct `ptsd` → `chronic-liver-disease` edge remains withheld, superseded by the two honest windows, and no PTSD-to-alcohol-to-liver chain claim is made on either edge's face. Stage 3c (the signed ME-34 reopening edge `bruxism-awake-sleep` → `tmj-disorder`) remains unexecuted. **Execution update 2026-10-04 (Stage 3c):** the signed ME-34 reopening landed on the ordinary draft path — `data/knowledge-base/bruxism-awake-sleep.json` carries the rank-1 ASSOCIATION_ONLY suggestion targeting `tmj-disorder` (hypothesizedOnly, etiological consensus NOT_ESTABLISHED, vaNexus alignment NOT_ASSERTED) with the adult meta-analytic anchors PMID 37474733 (pooled OR 2.25, awake 2.51, sleep 2.06) and PMID 27796166 (39 studies, 33 positive of 39, quality low to moderate) as verified:false references and the juvenile null PMID 9758394 (ages 6 to 9, self-limiting bruxing unrelated to TMJ symptoms) registered as an explicit counterweight; the signed disposition reconciles the juvenile null with the adult association as an age-scope matter only, the bidirectional reading is disclosed with direction unresolved, diagnosis-method conditioning and overlapping-literature limits are carried on the face, and the edge asserts no individual causation or aggravation. The relationship row `rel-bruxism-awake-sleep-to-tmj-disorder`, the three pending-verification source entities and the adjacency node `data/knowledge-base/graph/bruxism-awake-sleep.json` landed in lockstep, and the registry ratchets moved to 873 recorded relationship rows (799 explicit guards) and 1,699 live reference uses (1,304 pending; 1,492 source entities including lineage) with the publication splits and verified counts unmoved; `npm run audit:crg` stays at the reviewed state (no bruxism-to-TMJ findings) and `npm run audit:crg:graph` passes over three nodes. The ME-34 contract pin in `tests/mapping-expansion-me34.test.ts` moved 0 → 1 with a batch comment recording the signed reopening; the ME-34 ledger records are annotated as superseded as to outcome only and are not rewritten, and NO OTHER ME-34 conclusion is reopened. The original rejection named `tmj-dysfunction`; under Leg C the route is authored to the canonical `tmj-disorder` (the pointer is quarantined), and the sibling batch-91 `ptsd` → `bruxism-awake-sleep` edge keeps its own boundary — when both windows exist, CRG reports `ptsd` → `bruxism-awake-sleep` → `tmj-disorder` chains against any future direct `ptsd` → `tmj-disorder` claim, and none is proposed.

**Execution update 2026-10-04 (row-504 citation-verification pass):** the three `liver-cancer` → `sarcopenia` anchors (PMID 37274463, PMID 36590214, PMID 26266324; packet row 504) completed qualified-human citation verification under `docs/citation-verification-sop.md` and landed `verified:true`, with the decision recorded in `docs/liver-cancer-sarcopenia-citation-verification-2026-disposition.json` / `.md`. The two pooled prevalence anchors were approved **with narrowing**: the "CT-defined" assessment-method description was revised to the composition the full texts report (PMID 37274463: CT at L3 in 47 of 48 pooled studies — 43 skeletal-muscle, four psoas — with one MRI-derived FFMA study and each study's original definition retained; PMID 36590214: six pooled CT- and MRI-based assessment methods — SMI, PMI, TPV, TPMT/BH, IMAC, FFMA), and the figures themselves were unchanged; the 90-patient curative-intent cohort anchor (PMID 26266324) was approved as written. The proposition/note text and its mirrors (graph edge, registry guard) were narrowed first and only then were the flags promoted. No `contentDigest` was recorded on the three promotions because PubMed record pages are dynamic per fetch (SOP: omit rather than record a false-positive digest), so the decay audit's undigested-verified flag persists by policy and `MAX_UNDIGESTED_VERIFIED_REFS` is deliberately not raised. The registry lockstep is verification-only: **no new relationship row and no graph adjacency change** (relationships stay 873; `audit:crg` and `audit:crg:graph` stay at the reviewed state), while the source entities moved `pending-verification → active` and the registry and citation ratchets moved to the promoted state, with the current totals reported by `node scripts/audit-master-registry.js` and `npm run citations:audit` rather than transcribed here (the exact post-promotion figures are recorded in the disposition JSON).

**Catalog cross-check of 2026-09-28 (correcting two ledger claims).** `atrial-flutter` **does** carry a
catalog identity (`data/conditions/cardiovascular-expansion-wave-3.json`) despite the batch-84 gap note —
it is not a real gap. `atrial-fibrillation`, by contrast, is real: the specific identity is absent and AF
is folded in only as an alias of the coarse `cardiac-arrhythmia` umbrella (`data/conditions/cardiovascular.json`),
which is exactly why refusal 6 needs a specific identity (or a scope split) rather than an edge to the
umbrella.

## Prioritized identity-addition tiers

Prioritization criteria, in order: numbered refusals unblocked per identity added; evidence readiness
(preserved anchors versus a still-missing anchor tier); clinical salience; family coherence.

### Tier 1 — the suicidality pair: `suicidal-ideation` and `self-harm`

Closes five numbered refusals (1, 2, 3, 4, 9) covering six preserved routes — the largest unblock
available anywhere in the series. Evidence is fully preserved and spans independent designs: meta-analysis
(PMID 32807889), trauma cohort (PMID 40265245), bladder-control cohort (PMID 16005077), amputee cohort
(PMID 36163201), claims cohort (PMID 31441941), community case-control (PMID 30529070). Design notes:
two identities, exactly as the refusals name them; reopening conditions follow the batch-61
miscarriage-to-self-harm precedent; expect CRG parallel-targeting scrutiny since many primaries will aim
at the same targets — the redundancy-semantics question should be read before authoring, not after.

### Tier 2 — `amblyopia` and `obesity`

- **`amblyopia`** — single route (`strabismus` → `amblyopia`) but the highest clinical salience of any
  gap on record ("the single most important consequence of strabismus"); the evidence case is already
  written in the strabismus todo list.
- **`obesity`** — three preserved routes across three batches (sleep-related-eating-disorder batch 85,
  `scleredema` batch 81, `phantom-limb-pain` batch 71): the widest unblock after the suicidality pair,
  and it interacts productively with the batch-85 metabolic cluster below.

### Tier 3 — the movement-disorder family completion (partially delivered 2026-09-28)

**DELIVERED 2026-09-28:** `drug-induced-parkinsonism`, `neuroleptic-malignant-syndrome` and
`serotonin-syndrome` were added in one versioned migration (contract move 814/814 → 817/817, recorded in
`docs/condition-expansion-roadmap.md`), completing the identity side of the batch-88 psychotropic-damage
request. Two gates stand after the identities: the toxidrome routes stay blocked behind the batch-88
non-case-report anchor tier, and the FACE-SZ drug-induced-parkinsonism quantification (PMID 30695288) is
reserved with the held schizophrenia route and needs an ME-29 adjudication before reuse. **Remaining in
this tier:** `dystonia` and `akathisia`, the two movement-family members still missing.

### Tier 4 — one-refusal closers with evidence ready

- **`atrial-fibrillation`** — closes refusal 6; needs a specific identity split from the
  `cardiac-arrhythmia` umbrella (the eczema scope-split precedent) rather than a flat addition.
- **`giant-cell-arteritis`** — closes refusal 5 **and** reopens the ischemic-optic-neuropathy visual
  window (PMR → visual-impairment / blindness) that currently has no legitimate owner.
- **`cystoid-macular-edema`** — closes refusal 7 plus the batch-79 uveitic continuation.
- **`digital-ulcers`** — closes refusal 8; `gangrene` / `digital-ischemia` companions can ride the same
  family addition if the Raynaud literature supports all three.

### Tier 5 — remaining singletons, subtypes, and long tail

*(2026-09-29: `alcohol-use-disorder` and `sarcopenia` are no longer waiting in this tier — both are
delivered by the signed migration design at `docs/catalog-identity-migration-design-2026-09-29.md`, and
the TMJ coordination gap is dispositioned there.)*

`vitamin-b12-deficiency`, `small-bowel-obstruction`, `alcohol-use-disorder`, `hypercalcaemia`,
nephrogenic diabetes insipidus, `facial-nerve-palsy`, cachexia / `metabolic-syndrome`, the self-injury /
bed-partner-injury identities, `perineural-invasion` (mechanism vocabulary), and the older continuation
set (opsoclonus-myoclonus-ataxia, falls, gait impairment, generic headache, stridor/dysphonia, dyspnoea /
chest pain, the sialitis subtypes, orbital cellulitis, thumb avulsion fracture, contracture outcomes,
batch-79 continuations). Each closes at most one preserved route; add opportunistically when a batch's
request touches them.

## Migration mechanics — how an identity gets added

`docs/condition-catalog.md` freezes the identity contract and states that any change to the frozen
contract "requires a versioned migration design rather than an unreviewed cleanup". The
`tardive-dyskinesia` addition of 2026-09-28 (commit `2c9acb50`) is the working precedent:

1. **Add the catalog entry** in the right `data/conditions/<body-system>.json`, with a review note that
   names the numbered refusal (or gap) it closes and the preserved PMIDs — the note is what makes the
   addition auditable.
2. **Add the knowledge-base mapping file** (`data/knowledge-base/<id>.json`), draft-quarantined.
3. **Move the count pins** — the identity/registry counts pinned in fifteen test files, the pinned totals
   in `scripts/apply-all-94-citation-verification.js`, and the doc string asserted by
   `tests/condition-catalog-doc.test.ts` (which also locks this document's sibling
   `docs/condition-catalog.md`).
4. **Registry discipline.** No rows move in `data/evidence/master-sources.json` until a route is actually
   authored. Preserved PMIDs are confirmed absent there and pass
   `node scripts/preflight-source-status.js` before any registration.
5. **Citation purity.** `scripts/validate-knowledge-base.js` applies the verification threshold per
   suggestion, so no unverified reference can enter a published mapping. For routes whose primary file is
   published (as `schizophrenia` was for refusal 10), the held-artifact path applies: qualified-human
   verification under `docs/citation-verification-sop.md`, then the held edge lands verbatim.
   `docs/batch-89-ptsd-stress-flare-held-edges.json` and
   `docs/batch-90-schizophrenia-tardive-dyskinesia-held-edge.json` are the templates.

Suggested sequencing: batch the Tier 1 pair as one migration (one frozen-contract change, five refusals
closed), then Tier 2, then Tier 4 opportunistically; the Tier 3 family migration is delivered except for
`dystonia` and `akathisia`, which can ride any later movement-family migration. Each migration is a local
branch-and-commit landing; the upstream freeze stands and nothing ships before 2026-10-11.
