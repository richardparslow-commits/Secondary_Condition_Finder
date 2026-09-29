# Direction-discipline dispositions 2026-09-29 (D1 batch 94) — withheld and candidate routes swept against reverse registrations across sibling identities

**Status:** bounded sweep and disposition record, signed by qualified-human review on 2026-09-29.
This batch is **records only**: no knowledge-base file, registry row, or pin moves. The sweep examines
the registry as of the batch-93 close (**870 relationships**, `data/evidence/master-relationships.json`)
against every withheld or candidate route on record and records a direction-discipline disposition for
each.

## Method

**Universe.** Every route that is withheld, refused, deferred, held, or named as a candidate without a
registry row: the twelve numbered evidence-preserving refusals (`docs/missing-identity-addition-roadmap.md`),
the unnumbered gap continuations, the direction-class withholdings recorded in the batch ledger
(`docs/condition-expansion-roadmap.md`) and in knowledge-base governance notes/todo lists, and the held
artifacts (`docs/batch-89-ptsd-stress-flare-held-edges.json`,
`docs/batch-90-schizophrenia-tardive-dyskinesia-held-edge.json`) plus the batch-93 design's named
candidates.

**Match classes** (registry rows in the reverse orientation of the swept route `A -> B`):

- **Class A — exact reverse registered:** `B -> A` carries a registry row.
- **Class B — reverse registered across sibling identities:** a registry row `B' -> A'` exists with
  `B'` the target or a documented sibling of the target and `A'` the primary or a documented sibling of
  the primary (including half-sibling forms `B' -> A` and `B -> A'`), other than the exact reverse.
- **Class C — no reverse-orientation registration:** screened clean; one-line disposition.

**Sibling map (documented identity-family relations only).** Siblings are pairs or families the record
itself has adjudicated as umbrella/member, synonym, scope-split, typed-identity, spectrum, or explicit
sibling wording — never inferred from clinical similarity alone:

| Family | Members | Basis |
|---|---|---|
| eczema family | `eczema`, `atopic-dermatitis-eczema`, `dermatitis` | batch-80 premise retraction + 2026-09-28 composite-scope adjudication ("the sibling dermatitis identity") |
| rotator-cuff pair | `rotator-cuff-injury`, `rotator-cuff-tear` | umbrella/member, reconciled pointer (`docs/modeling-debt-dispositions.md`) |
| TMJ pair | `tmj-disorder`, `tmj-dysfunction` | umbrella/member + pointer (batch-93 migration design) |
| thumb pair | `skier-s-thumb`, `gamekeeper-s-thumb` | synonymy closure (batch-84) |
| sinusitis pair | `sinusitis`, `chronic-sinusitis` | umbrella-scope finding (batch-84) |
| diabetes-typed family | `diabetes-mellitus`, `diabetes-mellitus-type-1`, `diabetes-mellitus-type-2` | typed-identity precedent |
| dementia pair | `dementia`, `alzheimer-s-disease` | duplicate-scope precedent (batch-25 note) |
| SJS/TEN spectrum | `stevens-johnson-syndrome`, `toxic-epidermal-necrolysis` | batch-87 spectrum finding |
| QT channelopathy pair | `short-qt-syndrome`, `long-qt-syndrome` | refusal 12 pair |
| parkinsonism pair | `parkinsons-disease`, `drug-induced-parkinsonism` | category-error guard (batch-88) |
| muscle-atrophy pair | `muscle-atrophy`, `interosseous-muscle-atrophy` | umbrella/instantiating finding (batch-48) |
| forefoot-deformity pair | `hallux-valgus`, `hammertoe` | "the sibling hammertoe identity" (batch-42) |
| myocarditis pair | `eosinophilic-myocarditis`, `giant-cell-myocarditis` | "the sibling eosinophilic-myocarditis" (batch-38) |
| arousal-parasomnia family | `sleepwalking-disorder`, `sleep-terror-disorder`, `sleep-related-eating-disorder`, `nightmare-disorder` | "sibling arousal parasomnias" (batch-85) |
| insulin family | `hyperinsulinism`, `insulin-resistance-syndrome`, `insulinoma` | "the sibling insulin-resistance-syndrome identity" |
| alcohol/substance pair | `substance-use-disorder`, `alcohol-use-disorder` | scope-split design (batch 93; identity pending) |
| alopecia umbrella/narrower | `alopecia`, `alopecia-areata` | broad-vs-areata evidence-scope finding (batch-14 re-screen) |
| voice family | `spasmodic-dysphonia`, `paradoxical-vocal-fold-motion`, `aphonia`, `hoarseness` | shared dysphonia-scope findings (batches 65-68, 86) |
| migraine family | `migraine-headaches`, `abdominal-migraine`, `vestibular-migraine` | subtype-scoped identities |
| anxiety family | `anxiety-disorder`, `social-anxiety-disorder`, `separation-anxiety-disorder` | umbrella/scoped-target discipline (batch-83) |

---

## Class A — exact reverse registered

### A1. `pneumothorax -> pleural-effusion` — WITHHELD (BIDIRECTIONAL-PAIR AVOIDANCE, batch 72)

The exact reverse **`pleural-effusion -> pneumothorax` is registered** (`rel-pleural-effusion-to-pneumothorax`,
rank 1, draft, procedure-window scoped: "the pleural-effusion -> pneumothorax procedure-window edge is
authored this batch and the natural-history window is thin"). **Disposition: AFFIRMED.** The withholding
exists precisely because the reverse registration owns the pair; the natural-history direction stays
withheld on pair-avoidance plus thin effusion-specific quantification (PMID 31995686 reports serious
adverse events without effusion-specific breakdown). The pair must never become a bidirectional claim on
one evidence set. Reopening condition: a natural-history cohort quantifying effusion after spontaneous
pneumothorax, adjudicated by a qualified human with both windows' procedure-vs-natural-history scope
guards intact — never a silent doubling.

---

## Class B — reverse registered across sibling identities

### B1. `anxiety-disorder -> eczema` — WITHHELD (comorbidity-without-direction + direction reversal)

**Registration found:** `dermatitis -> anxiety-disorder` (rank 5), with the family also carrying
`dermatitis -> depressive-disorder` (rank 4) and `dermatitis -> insomnia` (rank 1) — the skin-to-mood
orientation registered across the sibling identity. **Disposition: AFFIRMED — the file's own record
stands and is completed here.** The `eczema.json` route re-screen 2 of 2 already states the rule exactly:
an `anxiety-disorder -> eczema` edge "would register the REVERSE of a registered route across a sibling
identity on non-directional evidence" (NFBC1966, cross-sectional, adjusted OR 1.34, supports neither
arrow). This sweep re-affirms the withholding and records the window-ownership refinement of the
2026-09-28 composite-scope adjudication: the correctly-directed atopic psychiatric-morbidity and sleep
window belongs to `atopic-dermatitis-eczema`, so the family's registered mood windows and the withheld
mood-to-skin direction must never be read as one bidirectional eczema-family mood claim.

### B2. `interosseous-muscle-atrophy` and `muscle-atrophy` outward routes — DEFERRED (MANIFESTATION-IDENTITY / DIRECTION-INVERSION, batches 48 and 62)

**Registration found:** the located-evidence direction IS registered across the sibling umbrella:
`guyon-s-canal-syndrome -> muscle-atrophy` (DIRECT_CAUSATION, batch 41) and
`peripheral-nerve-paralysis -> muscle-atrophy` (batch ~5x) — upstream nerve lesion produces atrophy.
**Disposition: AFFIRMED + family-window ownership recorded.** The evidenced direction is already
registered under the sibling identity; any `interosseous-muscle-atrophy ->` or `muscle-atrophy ->` edge
would both invert the located evidence and restate a window the registry already owns. The manifestation
deferrals stand; `thenar-hypotenar-atrophy` stays queued under the same treatment. A future
interosseous-specific edge would require downstream-outcome quantification in patients identified by
interosseous atrophy (never located), not a restatement of the registered upstream-lesion windows.

### B3. `paradoxical-vocal-fold-motion -> anxiety-disorder` (mood targets) — DEFERRED (DIRECTION-INVERSION, batch 68)

**Registration found:** the voice family carries mood windows in the **opposite** orientation to the
located PVFM evidence: `spasmodic-dysphonia -> anxiety-disorder` and `spasmodic-dysphonia ->
depressive-disorder` (batch 86), with `laryngeal-cancer -> aphonia` and the aphonia dysphonia-scope
associations in the voice-to-mood direction; the PVFM anchors run **mood to voice** (anxiety/depression
predating ILO evaluation, PMID 38296051). **Disposition: WITHHELD STAYS + no family direction
inference.** The registered sibling windows and the PVFM evidence point in OPPOSITE directions across
one family and may not be merged into a bidirectional voice-mood claim: each window stands on its own
anchors, the sibling edges keep their cross-sectional/reverse guards as recorded, and a future
`mood -> paradoxical-vocal-fold-motion` candidate needs its own directional cohort with the
asthma-mimicry/comorbidity guard intact. The registered voice-to-mood edges are NOT authority for a
mood-to-voice claim anywhere in the family.

### B4. `nephritis -> hypertension` — WITHHELD (DIRECTION-INVERSION, batch 63)

**Registration found:** `hypertension -> chronic-kidney-disease` (rank 1, **published**) — the
hypertension-to-renal direction registered across the renal sibling of nephritis. **Disposition:
AFFIRMED.** The biopsy-cohort anchor runs hypertension producing renal injury; the registered
`hypertension -> chronic-kidney-disease` window owns that direction. A `nephritis -> hypertension` edge
would invert the evidence and double-claim the renal-hypertension adjacency that the published window
already carries. Reopening condition: renal-disease-specific incident-hypertension quantification with
the shared-cause guards (diabetes, NSAIDs, volume status, glomerulonephritis class) stated on the face.

### B5. `sialadenitis -> sjogren-s-syndrome` — WITHHELD (DIRECTION REVERSAL, batch 84)

**Registration found:** `sjogren-s-syndrome -> dry-eye-syndrome` — the autoimmunity-to-gland-family
direction registered in its correct orientation (Sjogren's systemic autoimmunity produces gland/ocular
surface inflammation). **Disposition: AFFIRMED + candidate direction named.** The withheld reverse
stands: the systemic autoimmune condition causes the gland inflammation, not its consequence. The
correctly-shaped future route is `sjogren-s-syndrome -> sialadenitis`, if a sialadenitis-scoped anchor
is located, with the umbrella-scope disclosure (the `sialadenitis` identity also covers obstructive,
bacterial, viral and radiation-induced disease) carried on its face.

### B6. `anxiety-disorder -> migraine-headaches` — WITHHELD (UNRESOLVED-DIRECTION GAP, batch 91)

**Registration found:** `migraine-headaches -> depressive-disorder` — the mood-window direction the
located literature supports (migraine to mood) is already registered for the **depressive** sibling
target. **Disposition: WITHHELD STAYS + candidate direction named.** The corpus direction
(anxiety as primary) remains unauthorable; the located prospective and bidirectional literature runs
migraine-to-anxiety. The correctly-shaped future route is `migraine-headaches -> anxiety-disorder`,
parallel in orientation to the registered `migraine-headaches -> depressive-disorder` window; if
authored it must rest on its own anchors (one-window-per-claim — it may not borrow the
migraine-to-depression evidence set) and carry the bidirectionality disclosure on its face. Nothing is
registered in either direction today.

### B7. `ptsd -> alopecia-areata` — BATCH-89 HELD CANDIDATE

**Registration found:** `alopecia-areata -> depressive-disorder` — the skin-to-mood orientation
registered across the alopecia family; plus the **reserved reverse anchor** PMID 37900780 (PTSD as an
OUTCOME of alopecia areata; its own conclusion states causation cannot be deduced) preserved
unregistered under ME-29. **Disposition: HELD EDGE GOVERNS; reserved reverse stays unregistered.** The
held `ptsd -> alopecia-areata` edge claims only its own anchors (stress-flare direction); the reverse
anchor stays reserved and is not registered in either window; the sibling's `alopecia-areata ->
depressive-disorder` registration is a different pair and confers no direction on the held edge. When
the held edge lands, its face must record that the family carries both orientations across different
pairs (skin-to-mood registered, mood-to-skin held) and that neither implies the other.

### B8. `ptsd -> atopic-dermatitis-eczema`, `ptsd -> psoriasis`, `ptsd -> urticaria` (batch-89 held) and `ptsd -> eczema` (re-screened, remains withheld)

**Registration found:** the eczema family's registered skin-to-mood windows (`dermatitis ->
anxiety-disorder`, `-> depressive-disorder`, `-> insomnia`) sit in the opposite orientation to the held
mood-to-skin stress-flare edges; **`psoriasis -> eczema` is registered** (psoriasis's own outgoing
window), and the reserved reverse anchor PMID 42403316 (TriNetX: incident psychiatric disorders AFTER
chronic spontaneous urticaria, HR 1.15) stays unregistered under ME-29. **Disposition: HOLDS GOVERN;
family-direction guard recorded.** (1) Mood-to-skin and skin-to-mood windows may coexist across
different pairs but NO chain may ever claim a mood-skin cycle; each held edge keeps its one-window
discipline and its batch-89 evidence-sharing disclosure (PMIDs 33587564 and 42179055 shared across
held edges are one evidence set). (2) `ptsd -> eczema` remains withheld on its own evidence grounds
(PMID 35580455 reports current eczema NOT associated with PTSD, p = 0.24; PMID 18157997 has no located
magnitude and phenotype-unspecified eczema) — this sweep adds the transitive-redundancy reason to the
record: `psoriasis -> eczema` is registered and `ptsd -> psoriasis` is a held candidate, so a future
`ptsd -> eczema` edge would sit as a direct claim over an authored `ptsd -> psoriasis -> eczema` chain
and must be adjudicated against it (the batch-92 diabetes-chain precedent). (3) The urticaria reverse
anchor stays reserved; the held `ptsd -> urticaria` edge and the reserved `urticaria -> psychiatric`
literature may never be combined into one bidirectional claim.

### B9. Burn-scar carcinoma route (scars/burns -> carcinoma) — WITHHELD (direction reversal + MISSING IDENTITY, batch 87)

**Registration found:** seven premalignant-lesion-to-carcinoma registrations carry the correct
lesion-to-cancer orientation for the squamous-cell-carcinoma identity: `actinic-keratosis`,
`bowen-s-disease`, `erythroplasia-of-queyrat`, `lichen-planus`, `lichen-sclerosus`,
`necrobiosis-lipoidica`, `median-rhomboid-glossitis` each `-> squamous-cell-carcinoma`. **Disposition:
DIRECTION NAMED; identity block stands; candidate preserved.** The batch-87 refusal was of
burn-scar-carcinoma as a secondary OF squamous-cell-carcinoma; the located evidence runs burn to cancer
(mean latency 21.7 years; SCC 67.19 percent of burn-scar malignancies), the same orientation as the
seven registered premalignant windows. The `burn-scar-carcinoma` TARGET stays refused (missing
identity; it is a lesion entity, not a consequence of SCC). The correctly-shaped future route is
`scars`/`burns` -> `squamous-cell-carcinoma`, authorable on burn-scar-SCC-specific quantification with
the 21.7-year latency disclosure, the premalignant-family parallel disclosed (it would be the eighth
lesion-to-SCC window and must not restate the seven), and the burn-etiology scope stated. Nothing is
registered today.

### B10. `schizophrenia -> tardive-dyskinesia` (held) with the sibling `schizophrenia -> drug-induced-parkinsonism` (withheld, "ready for a later batch") — shared-anchor hazard, not a direction conflict

**Registration found:** none in reverse orientation — the movement family's direction is uniform
(antipsychotic exposure to drug-induced movement disorder) and no reverse claim exists anywhere. The
hazard this sweep records is anchor-sharing across siblings: the FACE-SZ cohort **PMID 30695288** is
registered on the held `schizophrenia -> tardive-dyskinesia` edge and is simultaneously the reserved
quantification for the `drug-induced-parkinsonism` route. **Disposition: DIRECTION CLEAN; shared-anchor
discipline recorded.** Any future `schizophrenia -> drug-induced-parkinsonism` edge requires the ME-29
adjudication named in the `drug-induced-parkinsonism` todo before reuse of PMID 30695288, and the
category-error guard stands in BOTH directions: PMID 34652577 (Piedmont degenerative-parkinsonism
hazard ratio) stays reserved and may never be registered against either drug-induced identity.

---

## Class C — screened clean (no reverse-orientation registration); one-line dispositions

| Swept route | Class on record | Direction-discipline disposition |
|---|---|---|
| `nightmare-disorder`, `nocturnal-enuresis`, `overactive-bladder`, `phantom-limb-pain`, `restless-leg-syndrome` -> `suicidal-ideation`; `restless-leg-syndrome` -> `self-harm` (refusals 1-4, 9) | MISSING IDENTITY | No reverse registration possible while the targets are absent; the preserved anchors keep their orientations (nightmares-to-attempt, RLS-to-ideation) and the Tier-1 pair design carries the parallel-targeting CRG warning for authoring time. |
| `polymyalgia-rheumatica` -> `giant-cell-arteritis` (refusal 5) | MISSING IDENTITY | Preserved; the progression direction (PMR to GCA) is the evidenced one and is not mirrored anywhere. |
| `premature-atrial-ventricular-contractions` -> `atrial-fibrillation` (refusal 6) | MISSING IDENTITY / umbrella-scope | The risk-signal direction (PAC to AF) is the evidenced one; the `cardiac-arrhythmia` umbrella registrations (`short-qt-syndrome` and `long-qt-syndrome` -> `cardiac-arrhythmia`) confer no AF-specific direction; preserved. |
| `pseudophakia` -> `cystoid-macular-edema` (refusal 7); `raynaud-s-phenomenon` -> `digital-ulcers` (refusal 8) | MISSING IDENTITY | Preserved; no reverse registration exists in either family. |
| `short-qt-syndrome` -> `long-qt-syndrome` (refusal 12) | EVIDENCE-CONTRADICTED | PERMANENT REFUSAL stands. The siblings share targets (`-> cardiac-arrhythmia` from both; `short-qt-syndrome` -> `ventricular-tachycardia-fibrillation`, `-> vasovagal-syncope`) but NO cross-edge exists in either direction; shared-target registration never implies a QT-family link, and the located evidence (inverse QTc-arrhythmia relationship) contradicts any shared-direction claim. |
| `seborrheic-dermatitis` -> `depressive-disorder` (batch 82) | DIRECTION REVERSAL | Stays withheld: the located scoping review conditions on psychiatric illness (arrow psychiatric-to-skin). The eczema-family mood windows are a DIFFERENT disease family (Malassezia-driven seborrhoeic disease vs atopic/contact eczema) and may not be borrowed; no reverse registration exists. |
| `shoulder-disarticulation` -> `complex-regional-pain-syndrome` (batch 83) | DIRECTION REVERSAL | Stays withheld: amputation is a TREATMENT for CRPS in the located literature — a treatment direction is not a secondary-condition route in either orientation. CRPS's registered outgoing windows (`-> contractures`, `-> osteoporosis`) are unaffected. |
| `renal-toxicity` -> `urinary-tract-cancer` (batch 78) | DIRECTION-GUARD / SHARED-EXPOSURE | Stays withheld: the aristolochic-acid exposure drives both outcomes (shared-cause); no reverse registration exists; the exposure stays rival-etiology vocabulary, not an edge. |
| `pseudophakia` -> `glaucoma` (batch 76) | DIRECTION-INVERSION | Stays withheld: the located literature is cataract-extraction history (procedural direction), not pseudophakia producing glaucoma. The family's registered window is `cataracts -> visual-impairment`; nothing reverses across it. |
| `oral-hairy-leukoplakia` outgoing (batch 66) | DIRECTION-INVERSION | Deferral stands: the sentinel evidence runs HIV/immunosuppression to OHL. No reverse-family registration exists (`hiv-aids` registers `-> peripheral-neuropathy`, `-> uveitis`; `oral-candidiasis` registers `-> ageusia` only), and the candidiasis coinfection is shared-substrate, not a direction. |
| `pleural-effusion` -> `pulmonary-embolism`, `-> deep-vein-thrombosis` (batch 72) | DIRECTION-INVERSION | Stays withheld: embolism produces effusion. The correctly-shaped candidate `pulmonary-embolism` -> `pleural-effusion` remains unregistered; the thromboembolic chain `deep-vein-thrombosis` -> `pulmonary-embolism` is already registered and owns that adjacency. |
| `ptsd` -> `chronic-liver-disease` (batch 91) | CHAIN-WITHHELD | Direct edge stays withheld; the route unblocks as the `alcohol-use-disorder` chain per the batch-93 migration design (PMID 30080255 attaches under ME-29). No reverse registration exists in either direction. |
| `bruxism-awake-sleep` -> `tmj-disorder` (ME-34; batch-93 reopened candidate) | REOPENED CANDIDATE | No direction conflict: both TMJ identities carry zero registrations. The signed ME-34 reopening disposition governs: ASSOCIATION_ONLY, juvenile null (PMID 9758394) as explicit counterweight, bidirectional reading disclosed (direction unresolved), diagnosis-method conditioning disclosed. |
| `fregoli-syndrome` -> `depressive-disorder` (batch 35) | REVERSE-ARROW GUARD | Deferral stands: the located literature runs primary psychiatric/neurodegenerative/brain-injury conditions producing Fregoli episodes. The capgras/cotard mood edges are different delusional identities and confer no direction; mirroring them would import another identity's evidence base. |
| `muscle-atrophy` outward, `myxedema-coma` (batch 62), `gigantism` (batch 38), `erythema-induratum` (batch 30), `overactive-bladder` -> `urinary-incontinence` (batch 68) | CONSTITUTIVE / REVERSE / ZERO-RECORD | Deferral dispositions stand as recorded (constitution, tuberculosis-to-EI direction, treatment-mediated reverse, constitutive manifestation); no reverse registration exists in any of their families. |

---

## Consequences recorded

1. **Nothing is registered, unpublished, or republished by this sweep.** Every disposition above is a
   record; the knowledge base, registries, and pins are untouched at the batch-93 state.
2. **Named future candidates** (correctly-shaped directions preserved, none authorable without fresh
   evidence): `migraine-headaches -> anxiety-disorder` (B6), `sjogren-s-syndrome -> sialadenitis` (B5),
   `scars`/`burns` -> `squamous-cell-carcinoma` (B9), `pulmonary-embolism` -> `pleural-effusion`
   (Class C), `schizophrenia -> drug-induced-parkinsonism` (B10, after ME-29 adjudication of the shared
   FACE-SZ anchor).
3. **CRG warnings for future landings** (transitive redundancy and bidirectional-pair findings should be
   expected and adjudicated, not surprised): landing both `ptsd -> psoriasis` and any future
   `ptsd -> eczema` (B8.2, chain via the registered `psoriasis -> eczema`); the `migraine-headaches ->
   anxiety-disorder` candidate alongside `migraine-headaches -> depressive-disorder` (parallel targets,
   shared-anchor discipline); the batch-93 alcohol chain alongside the registered `ptsd ->
   substance-use-disorder` (parallel alcohol/substance windows).
4. **The one Class A pair stays asymmetric by design** (A1): the registered `pleural-effusion ->
   pneumothorax` procedure window and the withheld natural-history direction are different claims and
   will never be merged into a bidirectional edge pair on one evidence set.
