# CRG transitive-redundancy triage — 2026-10-04

**Status:** read-only adjudication packet, prepared for the qualified-human review queue.
**Provenance:** machine-derived from `npm run audit:crg` (`scripts/audit-crg-graph.js`) run against the
working tree of `catalog-v2-movement-identities`; the register and posture tables are generated, not
transcribed — `npm run crg:triage` (`scripts/report-crg-triage.js`) emits them directly from the live
audit analysis and `data/evidence/master-relationships.json` — and are pinned to the live audit, and
each row's edge posture to the registry, by `tests/crg-redundancy-triage.test.ts` and
`tests/crg-triage-report.test.ts`.
**Ratchet context:** the audit reports REVIEW with **0 violations** and **29 redundancy conflicts**;
`CRG_REDUNDANCY_BASELINE` is **29** (batch-92 deliberate re-pin, 2026-09-29, batch-63 precedent).
**Freeze note:** prepared during the 2026-10-11 landing freeze. This is an escalation record, not a
landing prerequisite.

## 1. What the audit counts

The audit's transitive-redundancy rule is purely structural: whenever a published direct edge
`A -> C` coexists with a fully published authored chain `A -> B -> C`, it records one conflict with
the message *"either the direct edge overstates the evidence or the chain is redundant —
qualified-human decision required."* The audit deliberately cannot decide which side is right; the
ratchet (`CRG_REDUNDANCY_BASELINE` 29) only keeps the backlog from growing silently. This packet
itemizes the 29 live conflicts so a qualified human can adjudicate them unit by unit.

**Mechanical honesty:** the count is structural, not evidential. It falls only when a direct edge or
a composing chain hop is removed or moves out of published state. Rewording, narrowing, or
cross-referencing an edge does **not** change it. If every unit below lands on a retain-class
disposition, the live count remains 29 and the pin remains 29 — an explicitly recorded outcome, not
a gate failure.

## 2. What this packet is and is not

- **Is:** an itemized register of all 29 live conflicts with per-finding posture (rank, publication
  state, guard status, source-reference count), a candidate classification, and per-unit candidate
  disposition options with a recommended review order.
- **Is not:** a resolution. **This packet does not change any pin or edge.** No edge was added,
  dropped, or edited; `CRG_REDUNDANCY_BASELINE` remains 29; no recorded human decision is revisited.
  Automation prepared the packet; a qualified human makes every decision. The standing escalation
  rule applies throughout: stop, record, escalate to a qualified human — **never raise a pin to make
  CI green**.
- Machine summaries of mechanism are candidate readings of the authored `rationale` text on the
  face of the mapping files. No source was re-opened and no evidence re-reviewed here; a qualified
  human should treat mechanism summaries as leads, not findings.

## 3. Headline: 29 findings group into 17 review units

**Census:** 23 Coexist, 3 Bound and 3 Collinear.

- **Coexist (23 findings)** — distinct-route coexistence. The direct edge and the chain encode
  independently-anchored routes (different mechanisms, different mechanisms under different
  documented intermediates, or different condition granularity), so the structural overlap is
  informational. Candidate disposition: retain both, with the overlap disclosed in this register.
- **Bound (3 findings)** — the chain composes only under a phenotype or treatment binding narrower
  than the direct edge's population (R-10 sickle-cell anemia binding; R-18 GLP-1 receptor agonist
  exposure; R-26 NSAID exposure), so it cannot broadly duplicate the direct edge in general use.
- **Collinear (3 findings)** — same-exposure or same-mechanism overlap where a qualified human
  should decide whether one route subsumes the other: the esophageal-cancer treatment triangle
  (R-03/R-04) and the PTSD → erectile-dysfunction medication routes (R-21).

29 findings group into 17 review units. The largest is U-11, where seven conflicts against the single
direct edge `ptsd->depressive-disorder` collapse to one decision.

**Recommended review order** (highest adjudication value first):

1. **Collinear** — R-03/R-04 (U-03), R-21 (U-13). These are the only findings where a retain-class
   default is not obviously right.
2. **Bound quick-confirm** — R-10 (U-08), R-18/R-26 (U-14). Confirm the binding text, then retain.
3. **Hub** — U-11. One decision covering seven conflicts.
4. **Coexist sweep** — the remaining units. Retain-class confirmations against the register.

## 4. The finding register

Rows are ordered by the audit's enumeration order (structural, not priority). `R-nn` are packet-local
finding IDs; `U-nn` are packet-local review units. The class vocabulary is defined in section 3.
`Direct` and `Chain` reproduce the audit's exact edge strings; the collapsed posture facts
(rank/guard/source-reference counts) are per edge, in direct-then-chain-hop order, and are pinned in
the posture table below (and restated in the unit notes).

| ID | Direct | Chain | Class | Unit | Candidate disposition |
| --- | --- | --- | --- | --- | --- |
| R-01 | `acromegaly->hypertension` | `acromegaly->sleep-apnea->hypertension` | Coexist | U-01 | Retain both; no edit requested. |
| R-02 | `chronic-pyelonephritis->chronic-kidney-disease` | `chronic-pyelonephritis->hypertension->chronic-kidney-disease` | Coexist | U-02 | Retain both; no edit requested. |
| R-03 | `esophageal-cancer->cardiomyopathy` | `esophageal-cancer->cardiac-arrhythmia->cardiomyopathy` | Collinear | U-03 | Joint-review knot with R-04; decide direct-route independence. |
| R-04 | `esophageal-cancer->cardiac-arrhythmia` | `esophageal-cancer->cardiomyopathy->cardiac-arrhythmia` | Collinear | U-03 | Same joint-review knot as R-03. |
| R-05 | `gerd->respiratory-cancer` | `gerd->pulmonary-fibrosis->respiratory-cancer` | Coexist | U-04 | Retain both; disclose shared confounding. |
| R-06 | `gerd->bronchiectasis` | `gerd->tuberculosis->bronchiectasis` | Coexist | U-05 | Retain both; no edit requested. |
| R-07 | `hypertension->congestive-heart-failure` | `hypertension->chronic-kidney-disease->congestive-heart-failure` | Coexist | U-06 | Retain both; no edit requested. |
| R-08 | `hypoparathyroidism->chronic-kidney-disease` | `hypoparathyroidism->kidney-stones->chronic-kidney-disease` | Coexist | U-07 | Retain; reviewer confirms the overlap scope. |
| R-09 | `multiple-myeloma->anemia` | `multiple-myeloma->chronic-kidney-disease->anemia` | Coexist | U-08 | Retain pair with R-10; distinct mechanisms. |
| R-10 | `multiple-myeloma->chronic-kidney-disease` | `multiple-myeloma->anemia->chronic-kidney-disease` | Bound | U-08 | Retain; chain composes only in the sickle phenotype. |
| R-11 | `psoriasis->colorectal-cancer` | `psoriasis->inflammatory-bowel-disease->colorectal-cancer` | Coexist | U-09 | Retain both; disclose when IBD is co-diagnosed. |
| R-12 | `ptsd->hypertension` | `ptsd->sleep-apnea->hypertension` | Coexist | U-10 | Retain both as one unit decision with R-23. |
| R-13 | `ptsd->depressive-disorder` | `ptsd->sleep-apnea->depressive-disorder` | Coexist | U-11 | Retain; hub unit, one decision covers seven rows. |
| R-14 | `ptsd->depressive-disorder` | `ptsd->migraine-headaches->depressive-disorder` | Coexist | U-11 | Retain; hub unit, same decision as R-13. |
| R-15 | `ptsd->depressive-disorder` | `ptsd->erectile-dysfunction->depressive-disorder` | Coexist | U-11 | Retain; hub unit, same decision as R-13. |
| R-16 | `ptsd->ischemic-heart-disease` | `ptsd->hypertension->ischemic-heart-disease` | Coexist | U-12 | Retain both; no edit requested. |
| R-17 | `ptsd->erectile-dysfunction` | `ptsd->hypertension->erectile-dysfunction` | Coexist | U-13 | Retain; one medication-route unit with R-21. |
| R-18 | `ptsd->gerd` | `ptsd->diabetes-mellitus-type-2->gerd` | Bound | U-14 | Retain; chain requires documented GLP-1 exposure. |
| R-19 | `ptsd->depressive-disorder` | `ptsd->diabetes-mellitus-type-2->depressive-disorder` | Coexist | U-11 | Retain; hub unit, same decision as R-13. |
| R-20 | `ptsd->sleep-apnea` | `ptsd->depressive-disorder->sleep-apnea` | Coexist | U-15 | Retain both as one unit decision with R-28. |
| R-21 | `ptsd->erectile-dysfunction` | `ptsd->depressive-disorder->erectile-dysfunction` | Collinear | U-13 | Review first: does the DD route add an independent mechanism? |
| R-22 | `ptsd->depressive-disorder` | `ptsd->insomnia->depressive-disorder` | Coexist | U-11 | Retain; hub unit, same decision as R-13. |
| R-23 | `ptsd->hypertension` | `ptsd->insomnia->hypertension` | Coexist | U-10 | Retain both as one unit decision with R-12. |
| R-24 | `ptsd->depressive-disorder` | `ptsd->substance-use-disorder->depressive-disorder` | Coexist | U-11 | Retain; hub unit, same decision as R-13. |
| R-25 | `ptsd->depressive-disorder` | `ptsd->rheumatoid-arthritis->depressive-disorder` | Coexist | U-11 | Retain; hub unit, same decision as R-13. |
| R-26 | `ptsd->gerd` | `ptsd->rheumatoid-arthritis->gerd` | Bound | U-14 | Retain; chain requires documented NSAID exposure. |
| R-27 | `ptsd->copd` | `ptsd->gerd->copd` | Coexist | U-16 | Retain both; disclose shared confounding. |
| R-28 | `ptsd->sleep-apnea` | `ptsd->copd->sleep-apnea` | Coexist | U-15 | Retain both as one unit decision with R-20. |
| R-29 | `testicular-cancer->erectile-dysfunction` | `testicular-cancer->hypogonadism->erectile-dysfunction` | Coexist | U-17 | Retain both; distinct treatment-mediated routes. |

### Posture facts by edge slot

One row per finding, three cells in direct-then-chain-hop order; each cell reads `rank / guard /
sources`. `legacy` means `publicationGuard.status` is `legacy-rationale-boundary` with
`structuredGuardReviewPending: true`; `explicit` means `status` is `explicit` with no pending
structured review. Every cell is pinned against `data/evidence/master-relationships.json` by
`tests/crg-redundancy-triage.test.ts`, so a rank move, guard-state change, or source-count edit
fails that suite instead of drifting silently. Every cited edge slot is published in the registry.

| ID | Direct (A -> C) | Chain hop 1 (A -> B) | Chain hop 2 (B -> C) |
| --- | --- | --- | --- |
| R-01 | rank 1 / legacy / 1 | rank 2 / explicit / 1 | rank 1 / legacy / 1 |
| R-02 | rank 1 / legacy / 1 | rank 2 / explicit / 1 | rank 1 / legacy / 1 |
| R-03 | rank 2 / explicit / 1 | rank 1 / legacy / 1 | rank 1 / explicit / 1 |
| R-04 | rank 1 / legacy / 1 | rank 2 / explicit / 1 | rank 2 / explicit / 1 |
| R-05 | rank 6 / explicit / 1 | rank 5 / explicit / 1 | rank 1 / explicit / 1 |
| R-06 | rank 2 / explicit / 1 | rank 7 / explicit / 1 | rank 2 / explicit / 1 |
| R-07 | rank 3 / legacy / 1 | rank 1 / legacy / 1 | rank 2 / explicit / 1 |
| R-08 | rank 2 / explicit / 1 | rank 1 / legacy / 1 | rank 1 / explicit / 1 |
| R-09 | rank 2 / explicit / 1 | rank 1 / explicit / 1 | rank 1 / explicit / 1 |
| R-10 | rank 1 / explicit / 1 | rank 2 / explicit / 1 | rank 1 / explicit / 1 |
| R-11 | rank 1 / explicit / 1 | rank 3 / explicit / 1 | rank 1 / explicit / 1 |
| R-12 | rank 5 / explicit / 1 | rank 1 / legacy / 1 | rank 1 / legacy / 1 |
| R-13 | rank 7 / explicit / 1 | rank 1 / legacy / 1 | rank 2 / legacy / 1 |
| R-14 | rank 7 / explicit / 1 | rank 2 / legacy / 1 | rank 1 / legacy / 1 |
| R-15 | rank 7 / explicit / 1 | rank 3 / legacy / 1 | rank 1 / legacy / 1 |
| R-16 | rank 4 / explicit / 1 | rank 5 / explicit / 1 | rank 2 / legacy / 1 |
| R-17 | rank 3 / legacy / 1 | rank 5 / explicit / 1 | rank 4 / legacy / 1 |
| R-18 | rank 17 / explicit / 1 | rank 6 / explicit / 1 | rank 1 / explicit / 1 |
| R-19 | rank 7 / explicit / 1 | rank 6 / explicit / 1 | rank 4 / explicit / 2 |
| R-20 | rank 1 / legacy / 1 | rank 7 / explicit / 1 | rank 1 / legacy / 2 |
| R-21 | rank 3 / legacy / 1 | rank 7 / explicit / 1 | rank 2 / legacy / 1 |
| R-22 | rank 7 / explicit / 1 | rank 8 / explicit / 1 | rank 1 / legacy / 1 |
| R-23 | rank 5 / explicit / 1 | rank 8 / explicit / 1 | rank 2 / explicit / 1 |
| R-24 | rank 7 / explicit / 1 | rank 9 / explicit / 1 | rank 1 / explicit / 1 |
| R-25 | rank 7 / explicit / 1 | rank 12 / explicit / 2 | rank 1 / legacy / 2 |
| R-26 | rank 17 / explicit / 1 | rank 12 / explicit / 2 | rank 2 / legacy / 2 |
| R-27 | rank 18 / explicit / 2 | rank 17 / explicit / 1 | rank 3 / explicit / 1 |
| R-28 | rank 1 / legacy / 1 | rank 18 / explicit / 2 | rank 1 / legacy / 1 |
| R-29 | rank 2 / explicit / 1 | rank 1 / legacy / 1 | rank 2 / explicit / 1 |

## 5. Unit notes

Posture notation: each edge is cited as rank / guard status / source-reference count. "legacy
boundary" means the edge carries a `legacy-rationale-boundary` publication guard (boundary text
preserved from the rationale, structured guard review still pending); "explicit" means a structured
explicit guard is on the edge. All edges in this register are published.

### U-01 — R-01: acromegaly → hypertension

Direct `rel-acromegaly-to-hypertension` (rank 1, legacy boundary, 1 source) assigns direct
mechanisms — renal sodium/water retention with extracellular-volume expansion and vascular effects
in active GH/IGF-I excess. The chain runs through `rel-acromegaly-to-sleep-apnea` (rank 2, explicit,
1 source; requires separately established OSA by sleep-study criteria) → `rel-sleep-apnea-to-hypertension`
(rank 1, legacy boundary, 1 source). Distinct mechanisms; the chain composes only with documented
OSA. **Candidate: Coexist — retain; no edit requested.**

### U-02 — R-02: chronic pyelonephritis → CKD

Direct (rank 1, legacy boundary, 1 source) is a heterogeneous-phenotype proposition (stable
preserved-function adults versus higher-risk scarring/proteinuria/hypertension phenotypes). The
chain runs through `rel-chronic-pyelonephritis-to-hypertension` (rank 2, explicit, 1 source; requires
objectively established vesicoureteral reflux/reflux nephropathy with parenchymal scarring) →
`rel-hypertension-to-chronic-kidney-disease` (rank 1, legacy boundary, 1 source). Reflux-scarring and
hypertensive-nephrosclerosis routes are distinct. **Candidate: Coexist — retain; no edit requested.**

### U-03 — R-03/R-04: the esophageal-cancer treatment triangle

Four published edges among three conditions: `esophageal-cancer->cardiac-arrhythmia`
(rank 1, legacy boundary; radiotherapy-associated incident atrial fibrillation),
`esophageal-cancer->cardiomyopathy` (rank 2, explicit; chemoradiotherapy-associated
left-ventricular functional decline), `cardiac-arrhythmia->cardiomyopathy` (rank 1, explicit;
phenotype-specific arrhythmia-induced cardiomyopathy) and `cardiomyopathy->cardiac-arrhythmia`
(rank 2, explicit; ventricular arrhythmia). Both findings share the same exposure — thoracic
radiotherapy/chemoradiotherapy — across two endpoints. **Candidate: Collinear — review as one
joint unit.** A reviewer should decide whether the two direct edges are independent
treatment-mediated propositions (each with its own phenotype binding, in which case they are a
Coexist-type knot to retain with a cross-reference) or whether one endpoint should be presented
only as a downstream route of the other (in which case the affected direct edge is the candidate
for narrowing or unpublishing, with the evidence decision recorded in its mapping governance
notes). No edit without that record.

### U-04 — R-05: GERD → respiratory cancer

Direct (rank 6, explicit, 1 source) is a temporal association-risk proposition that already names
tobacco, occupational exposure and surveillance factors. The chain runs through
`gerd->pulmonary-fibrosis` (rank 5, explicit, 1 source) → `pulmonary-fibrosis->respiratory-cancer`
(rank 1, explicit; occupational/exposure-related fibrosis phenotype only). The chain is
phenotype-restricted to a fibrotic route; the direct edge is population temporal risk.
**Candidate: Coexist — retain both; disclose shared confounding.**

### U-05 — R-06: GERD → bronchiectasis

Direct (rank 2, explicit, 1 source; aspiration, infection, immune disease and other pulmonary
causes to be assessed). The chain runs through `gerd->tuberculosis` (rank 7, explicit, 1 source;
microbiologically/clinically established TB required) → `tuberculosis->bronchiectasis`
(rank 2, explicit; post-tuberculosis structural sequelae). The chain composes only with documented
TB. **Candidate: Coexist — retain; no edit requested.**

### U-06 — R-07: hypertension → CHF

Direct (rank 3, legacy boundary, 1 source) is the guideline-anchored pressure-overload risk
proposition (2025 AHA/ACC dose-dependent association). The chain runs through
`hypertension->chronic-kidney-disease` (rank 1, legacy boundary) →
`chronic-kidney-disease->congestive-heart-failure` (rank 2, explicit; population-level incidence).
Cardiorenal progression is additive, not duplicative. **Candidate: Coexist — retain; no edit
requested.**

### U-07 — R-08: hypoparathyroidism → CKD

Direct (rank 2, explicit; renal complications under long-term conventional calcium and
active-vitamin-D therapy). The chain runs through `hypoparathyroidism->kidney-stones`
(rank 1, legacy boundary; nephrolithiasis and nephrocalcinosis, reflecting both the calcium-phosphate
disorder and its long-term conventional treatment) → `kidney-stones->chronic-kidney-disease`
(rank 1, explicit; population-level temporal risk). The mechanism families overlap (renal calcium
deposition) but the direct edge also covers non-stone renal complications. **Candidate: Coexist —
retain; reviewer confirms the overlap scope.**

### U-08 — R-09/R-10: the myeloma pair

Shared edges: `multiple-myeloma->anemia` (rank 2, explicit; anemia as a common manifestation) and
`multiple-myeloma->chronic-kidney-disease` (rank 1, explicit; disease complication with chronicity
guard). R-09's chain adds `chronic-kidney-disease->anemia` (rank 1, explicit; generic CKD anemia,
"do not infer anemia from CKD stage alone"). R-10's chain adds `anemia->chronic-kidney-disease`
(rank 1, explicit) whose binding is **phenotype-restricted**: it applies only when the catalog
anemia diagnosis is specifically sickle cell anemia with CKD in the sickle nephropathy phenotype.
The two routes encode distinct mechanisms (marrow/cytokine anemia; cast nephropathy/CKD anemia),
and R-10's chain cannot compose in the general myeloma case at all. **Candidate: R-09 Coexist,
R-10 Bound — retain both; confirm the binding text.** R-10 is a candidate precedent for the
principle that phenotype-restricted hops are structural overlaps only.

### U-09 — R-11: psoriasis → colorectal cancer

Direct (rank 1, explicit; association risk with chronology, smoking, obesity, IBD, treatment and
surveillance to be accounted for). The chain runs through `psoriasis->inflammatory-bowel-disease`
(rank 3, explicit; shared-immune susceptibility preserved) → `inflammatory-bowel-disease->colorectal-cancer`
(rank 1, explicit; disease duration, extent, inflammation, dysplasia and PSC to be accounted for).
Overlap exists only when IBD is co-diagnosed; the direct edge already requires IBD to be accounted
for. **Candidate: Coexist — retain both; disclose the co-diagnosis condition.**

### U-10 — R-12/R-23: PTSD → hypertension

Direct `rel-ptsd-to-hypertension` (rank 5, explicit; ME-36 prospective-risk association, veteran
cohort, competing contributors named). Chains: via `ptsd->sleep-apnea` (rank 1, legacy boundary) →
`sleep-apnea->hypertension` (rank 1, legacy boundary), and via `ptsd->insomnia` (rank 8, explicit) →
`insomnia->hypertension` (rank 2, explicit; 14 prospective cohorts, pooled RR 1.21, 95% CI
1.10-1.33). OSA and insomnia are independently documented intermediaries, each with its own
mechanism; both chains compose only when the intermediary is established. **Candidate: Coexist —
retain both; one unit decision covers R-12 and R-23.**

### U-11 — R-13/R-14/R-15/R-19/R-22/R-24/R-25: the PTSD → depressive-disorder hub

Direct `rel-ptsd-to-depressive-disorder` (rank 7, explicit; ME-36, bounded as a PTSD/MDD
co-occurrence association and not an etiologic claim). Seven chains: via sleep-apnea
(rank 2, legacy boundary; dose-response meta-analysis with cross-sectional/heterogeneous
underlying designs), migraine (rank 1, legacy boundary; prospective cohort), erectile dysfunction
(rank 1, legacy boundary; bidirectional, direction not established), type 2 diabetes
(rank 4, explicit, 2 sources; the batch-92 landed edge carrying its held-artifact adjudication and
the weaker-half direction asymmetry on its face), insomnia (rank 1, legacy boundary;
population-based prospective cohort), substance-use disorder (rank 1, explicit; cannabis-use
phenotype only) and rheumatoid arthritis (rank 1, legacy boundary; chronic-pain co-occurrence).
Each chain asserts a different authored route; the direct edge asserts co-occurrence only and
neither subsumes nor contradicts them. **Candidate: Coexist — retain all seven; review as ONE
decision.** This is the queue's largest collapse: seven findings, one unit.

### U-12 — R-16: PTSD → ischemic heart disease

Direct (rank 4, explicit; meta-analytic PTSD-to-incident-CHD risk after adjustment). Chain via
`ptsd->hypertension` (rank 5, explicit) → `hypertension->ischemic-heart-disease` (rank 2, legacy
boundary; guideline-anchored modifiable risk factor). The two-step cardiovascular route and the
direct coronary-risk association are both population-risk framings. **Candidate: Coexist — retain;
no edit requested.**

### U-13 — R-17/R-21: PTSD → erectile dysfunction, medication focus

Direct `rel-ptsd-to-erectile-dysfunction` (rank 3, legacy boundary; authored as a **medication-related
aggravation theory** requiring documented SSRI exposure). Chains: via hypertension
(`hypertension->erectile-dysfunction`, rank 4, legacy boundary; population vascular/
endothelial route) and via depressive disorder (`depressive-disorder->erectile-dysfunction`,
rank 2, legacy boundary; antidepressant/psychotropic medication-related secondary theory).
R-17's vascular route is distinct from the direct edge; R-21's chain asserts the same pharmacologic
mechanism class (antidepressant treatment) as the direct edge and adds a depression-diagnosis
precondition. **Candidate: R-17 Coexist, R-21 Collinear — review as one medication-focused unit.**
A reviewer should decide whether the DD route adds an independent mechanism (depression-mediated,
non-pharmacologic) or duplicates the direct medication theory; if it duplicates, the options are
retain with a cross-reference or narrow the direct edge to subsume the DD route, with the evidence
decision recorded. No edit without that record.

### U-14 — R-18/R-26: PTSD → GERD, treatment-bound chains

Direct `rel-ptsd-to-gerd` (rank 17, explicit; veteran self-report-based association, GERD-specific
causation evidence explicitly weaker). Chains: via `ptsd->diabetes-mellitus-type-2` (rank 6,
explicit) → `diabetes-mellitus-type-2-to-gerd` (rank 1, explicit; requires documented GLP-1
receptor agonist exposure preceding GERD — treatment-associated, "not diabetes itself"), and via
`ptsd->rheumatoid-arthritis` (rank 12, explicit, 2 sources) → `rheumatoid-arthritis-to-gerd`
(rank 2, legacy boundary, 2 sources; composes only when NSAID treatment is documented). Each chain
is bound to a documented medication exposure, so neither broadly duplicates the direct association.
**Candidate: Bound — retain both; quick-confirm the two binding texts.**

### U-15 — R-20/R-28: PTSD → sleep apnea

Direct `rel-ptsd-to-sleep-apnea` (rank 1, legacy boundary; population co-occurrence with direction
unresolved — the rationale says the evidence does not establish causation in an individual). Chains:
via `ptsd->depressive-disorder` (rank 7, explicit) → `depressive-disorder->sleep-apnea` (rank 1,
legacy boundary, 2 sources; antidepressant weight-gain intermediate-step theory) and via
`ptsd->copd` (rank 18, explicit, 2 sources) → `copd->sleep-apnea` (rank 1, legacy boundary;
overlap syndrome co-occurrence). Both chains are mechanism-specific and compose only with the
intermediary documented. **Candidate: Coexist — retain both; one unit decision covers R-20 and
R-28.**

### U-16 — R-27: PTSD → COPD

Direct (rank 18, explicit, 2 sources; longitudinal veteran study and a veterans-with-HIV cohort —
PTSD symptoms/diagnosis associated with incident pulmonary disease). Chain via `ptsd->gerd`
(rank 17, explicit) → `gerd->copd` (rank 3, explicit; temporal association risk with smoking,
occupational exposure, obesity and medication effects named). Shared confounding (smoking) is the
likely reviewer focus; both edges name account-for items on their face. **Candidate: Coexist —
retain; disclose shared confounding.**

### U-17 — R-29: testicular cancer → erectile dysfunction

Direct (rank 2, explicit; treatment-mediated, requires documented actual exposure to a supported
regimen — BEP chemotherapy, abdominal radiotherapy and related regimens per the rationale). Chain
via `testicular-cancer->hypogonadism` (rank 1, legacy boundary; treatment-specific testosterone
deficiency after standard chemotherapy) → `hypogonadism->erectile-dysfunction` (rank 2, explicit;
androgen-deficiency hypogonadism with testosterone-treatment response evidence). Hypogonadal and
vascular/neurologic treatment-mediated routes are distinct. **Candidate: Coexist — retain; no edit
requested.**

## 6. Execution guardrails

- Any disposition that edits edge text or removes/unpublishes an edge goes through the standing
  authoring pipeline: mapping edit, registry lockstep (`data/evidence/master-relationships.json`,
  `data/evidence/master-sources.json`), canonical hash regeneration, and the ratchet/test/document
  updates in one reviewed change. This packet performs none of that.
- Only a qualified human may decide a unit. An unpublishing decision is recorded in the affected
  mapping's `governanceNotes` with its evidence basis; the pin is lowered only after
  `npm run audit:crg` confirms the lower count. Re-wording or cross-referencing does not lower the
  count and does not require a pin move.
- If all units land on retain-class dispositions, the correct end state is: live count 29, pin 29,
  and this packet as the disclosure record. That is a permissible outcome.
- Never raise a pin to make CI green (standing landing-checklist rule). The audit's own ratchet
  message points at `scripts/audit-crg-graph.js`; a pin move is an editor's deliberate, commented,
  reviewed act, not an automated one.
- When the backlog eventually moves, supersede this packet with a new dated triage and update
  `tests/crg-redundancy-triage.test.ts` in the same change. The contract is intentionally strict:
  the packet is a dated snapshot, not a living document.

## 7. Provenance and limitations

- Prepared by automation on 2026-10-04 from the working tree; the register and posture tables are
  reproducible with `npm run crg:triage`, which emits them from the audit's own analysis and the
  registry (no re-implementation), and the register is verified against the
  live audit by `tests/crg-redundancy-triage.test.ts` (count and baseline pins, bidirectional set
  equality against `npm run audit:crg` output, class census, unit map, guardrail anchors), and its
  per-edge posture facts (rank, guard state, source-reference count) against
  `data/evidence/master-relationships.json`.
- Mechanism summaries are candidate readings of authored `rationale`/`conservativeRationale` text
  only; no source was re-opened, no PMID re-verified, no citation-verification decision touched.
- Many legacy boundary edges carry `structuredGuardReviewPending` on their registry guards; that
  standing structured-guard queue is separate from this triage and is not advanced or extended here.
- Classification and review order are recommendations for the qualified-human queue, not decisions.
  The qualified human is free to collapse, reorder, or reject any unit — the contract test only
  guarantees that every live conflict is itemized and disclosed.
