# Mapping Expansion ME-19 — Batch Plan (first batch over the 502 new framework-only identities)

**Status: implemented as ME-19 batch 5 on 2026-09-02 (see `docs/mapping-expansion-me19-approved-implementation-ledger.{json,md}`) — citations pending qualified-human verification.**

- Original plan text below. ME-19 is batch 5 of the ME series and the **first mapping-expansion batch over the 502 framework-only draft identities** introduced by the 2026-09 master-list catalog expansion (Wave 8: 311 → 813 conditions).
- Batch shape follows the established ME convention: **5 primaries, one rank-1 suggestion each**, all primaries remain `draft: true`, every new clinical reference enters `verified: false` and awaits the separate qualified-human citation-verification gate, and GitHub/Vercel writes remain forbidden.
- Authoring posture for every row: `ASSOCIATION_ONLY` / `NOT_ESTABLISHED` / `NOT_ASSERTED`, `hypothesizedOnly: true`, with a strict publication guard — identical to the ME-12/ME-16/ME-17/ME-18 rows. No causation or aggravation claim is asserted by any automated change.

## Approved rows (proposed)

| # | Primary (new framework-only id) | Target | Evidence base to source (exact PMID/DOI finalized at implementation via PubMed, then human-verified) | Guard summary |
|---|--------------------------------|--------|------------------------------------------------------------------------------------------------------|---------------|
| 1 | `traumatic-brain-injury-residuals` → `depressive-disorder` | Post-TBI depression — systematic reviews / meta-analyses of depressive disorder after TBI | Require documented TBI residuals and separately diagnosed depression with compatible chronology. Do not infer depression from TBI or from transient mood symptoms alone. Preserve pre-existing mood disorder, substance effects, concurrent PTSD/anxiety, medications, and sleep disorders. |
| 2 | `allergic-rhinitis` → `asthma` | AR–asthma relationship (allergic march / united airway) — systematic reviews and meta-analyses | Require documented allergic rhinitis and separately established asthma. Do not infer asthma from rhinitis symptoms, spirometry in isolation, or self-reported wheeze. Preserve other asthma triggers (viral, occupational, exercise, irritants, GERD) and other rhinitis phenotypes. |
| 3 | `diabetic-nephropathy` → `chronic-kidney-disease` | Diabetic kidney disease → CKD — ADA / KDOQI guideline statements and cohort data | Require established diabetic nephropathy (documented albuminuria and/or eGFR decline in a diabetic with compatible phenotype) and separately documented CKD. Do not infer diabetic nephropathy from isolated creatinine elevation or from diabetes alone. Preserve hypertensive, ischemic, obstructive, glomerular, and other CKD etiologies. |
| 4 | `menstrual-disorders` → `anemia` | Heavy menstrual bleeding → iron-deficiency anemia — guideline/literature support | Require documented abnormal uterine bleeding and objective anemia (hemoglobin/ferritin). Do not infer anemia from bleeding history alone. Preserve other blood loss, malabsorption, dietary deficiency, and chronic-disease anemia. |
| 5 | `oral-lichen-planus-lichenoid-lesions` → `oral-cancer` | OLP / lichenoid lesions → oral squamous-cell carcinoma — meta-analyses of malignant transformation | Require biopsy-documented OLP/lichenoid lesion and separately established oral cancer with compatible chronology. Do not infer cancer from clinical appearance or from dysplasia alone. Preserve tobacco/alcohol, other premalignant lesions (leukoplakia, erythroplakia), HPV, and other oral-cancer risk factors. |

All five targets (`depressive-disorder`, `asthma`, `chronic-kidney-disease`, `anemia`, `oral-cancer`) already exist in the catalog and are published primaries themselves, so the edges are the only new objects; no catalog change is needed for ME-19.

## Implementation checklist (executed per batch when this plan is approved)

1. **Research** — locate one high-tier source per row (systematic review / meta-analysis / guideline) with an exact PMID (+ DOI where available) and record the publication guard. No URL or citation is ever invented; a source that cannot be located stays out of the batch.
2. **Author** — edit each of the 5 KB mapping files (`data/knowledge-base/<primary>.json`): clear the framework-only `todo` for the authored edge (keep the draft state and any remaining todo items), add the rank-1 suggestion carrying the full CRG trio (`nexusClaim` with `associationBasis` + `causationStatus`, `causalMechanism` with `mechanismCategory` + `hypothesizedOnly`, `evidentiaryProfile` with `etiologicalConsensus: NOT_ESTABLISHED` + `vaNexusProbabilityAlignment: NOT_ASSERTED` + evidence gaps + alternatives), and `sourceReferences` with `verified: false`, `verificationScope: "clinical-evidence"`, exact `sourceUrl`, `note`, and `sourceLocator` embedding the guard.
3. **Registry** — add the 5 relationships to `data/evidence/master-relationships.json` with their canonical `suggestionObjectHash` (and any new `pmid-NNNN` source entities to `data/evidence/master-sources.json`) so `npm run audit:master-registry` parity holds.
4. **Ledger + tests** — create `docs/mapping-expansion-me19-approved-implementation-ledger.{json,md}` (required exact HEAD, the 5 rows, guards, verified:false state, separate citation gate), a `docs/master-registry-2026.md` batch-5 entry, and `tests/mapping-expansion-me19.test.ts` (+ citation-verification variant) pinning the 5 rows, their guards, and the draft/verified-false state.
5. **Gates** — `npm run kb:validate`, `audit:me-compliance`, `audit:master-registry`, `citations:audit`, `test:composition`, typecheck, lint, and the full Vitest suite must pass on the exact branch head before commit.
6. **Commit + push** — commit the batch, push to GitHub (the Desktop folder is this repo, so it stays in sync), wait 5 seconds, then begin ME-20.

## Post-batch human gate (out of agent scope)

Publication of the 5 rows requires the qualified-human citation-verification step (verify each PMID supports the guard, flip `verified: true` + `sourceCheckedOn`, then — and only then — consider publishing the primary). Until then ME-19 rows remain draft, exactly like the 15 pending ME-16/17/18 refs.

## Ranked backlog for ME-20 onward (one edge per primary, same process)

1. `pheochromocytoma` → `hypertension`
2. `sjogren-s-syndrome` → `dry-eye-syndrome`
3. `leukoplakia` → `oral-cancer`
4. `erythroplakia` → `oral-cancer`
5. `meningitis` → `hearing-loss`
6. `cholesteatoma` → `conductive-hearing-loss`
7. `otitis-media` → `hearing-loss`
8. `peptic-ulcer-disease` → `anemia`
9. `eosinophilic-esophagitis` → `dysphagia`
10. `cholelithiasis` → `pancreatitis`
11. `insulin-resistance-syndrome` → `diabetes-mellitus-type-2`
12. `metabolic-syndrome` → `diabetes-mellitus-type-2`
13. `transient-ischemic-attack-residuals` → `cerebrovascular-accident-stroke-residuals`
14. `testicular-torsion` → `testicular-atrophy`
15. `lichen-sclerosus` → `squamous-cell-carcinoma`
16. `nasal-polyps` → `asthma`
17. `diabetic-gastroparesis` → `gastroparesis`

At 5 primaries per batch, the current ~17-edge backlog spans ME-20 through roughly ME-23; the remaining ~480 framework-only identities then continue the same loop, prioritized by evidence strength and the availability of published target identities.