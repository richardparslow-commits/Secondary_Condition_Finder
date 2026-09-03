# Mapping Expansion ME-21 - Approved Implementation Ledger

**APPROVED AND APPLIED LOCALLY - CITATIONS PENDING VERIFICATION**

Required baseline: `ea005e50ccbc30800dd46f3872f764f98e977c1f`
Commit subject: `map: mapping expansion ME-21 (5 relationships)`
Issue: #360 Mapping Expansion Wave (ME-15+); ME-21 continues the ME-20 backlog over Wave-8 framework-only identities (catalog 813)

## Approved Scope

Five bounded relationships were approved on 2026-09-02. Each was added at rank 1 to a previously unregistered framework-only draft primary. All five primaries remain `draft: true`, all five clinical references remain `verified:false`, and the matching master sources remain `pending-verification`. Citation verification and publication are separate qualified-human gates.

## Relationships

1. `peptic-ulcer-disease` -> `anemia` - PMID `7942718`; selected endoscopy-cohort evidence. Require ulcer bleeding or clinically relevant iron loss, objective iron-deficiency anemia, compatible chronology, and review of competing causes.
2. `eosinophilic-esophagitis` -> `dysphagia` - PMID `34609446`; JAMA review evidence. Require biopsy-confirmed EoE and separately documented dysphagia; preserve structural, motility, neurologic, medication-related, and functional alternatives.
3. `cholelithiasis` -> `pancreatitis` - PMID `24679420`; gallstone-pancreatitis review. Require documented gallstones or migration, objective acute pancreatitis, compatible chronology, and review of nonbiliary etiologies.
4. `insulin-resistance-syndrome` -> `diabetes-mellitus-type-2` - PMID `12231073`; pathophysiologic review. Require an established insulin-resistance phenotype and separately diagnosed type 2 diabetes; do not infer diabetes from markers alone.
5. `metabolic-syndrome` -> `diabetes-mellitus-type-2` - PMID `24843675`; review of incident-diabetes prediction. Require an established metabolic-syndrome phenotype and separately diagnosed type 2 diabetes; do not treat population risk prediction as individual causation.

All five edges use `ASSOCIATION_ONLY` / `NOT_ESTABLISHED` / `NOT_ASSERTED`, with `causalMechanism.hypothesizedOnly: true`. No causation, aggravation, publication, taxonomy, or pathway-intelligence change is asserted.

## Projected State

- Relationships: 273 -> **278**
- Registered primaries: 184 -> **189** of 813
- Remaining primaries: 629 -> **624**; target-only primaries remain **37**
- Live references: 281 -> **286**; verified remains **256**; unverified **25 -> 30**
- Master sources: 233 active / 25 pending / 267 total -> **233 active / 30 pending / 272 total**
- Explicit publication guards: 199 -> **204**; legacy boundaries remain **74**
- Draft single-suggestion primaries: 44 -> **49**

## Local Implementation Result

- 5/5 approved relationships added at rank 1.
- Read-before-write publication states preserved: all five selected primaries remain draft.
- 5/5 new source references remain `verified:false`; matching source records remain `pending-verification`.
- No citation promotion or remote write was performed.
- The next backlog rows are `transient-ischemic-attack-residuals -> cerebrovascular-accident-stroke-residuals`, `testicular-torsion -> testicular-atrophy`, `lichen-sclerosus -> squamous-cell-carcinoma`, `nasal-polyps -> asthma`, and `diabetic-gastroparesis -> gastroparesis`.
