# Mapping Expansion ME-20 — Batch Plan (backlog rows 1–5 from the ME-19 plan)

**Status: implemented as ME-20 batch 6 on 2026-09-02 (see `docs/mapping-expansion-me20-approved-implementation-ledger.{json,md}`) — citations pending qualified-human verification.**

- ME-20 is batch 6 of the ME series and consumes the first five ranked rows of the ME-19 backlog, all over Wave-8 framework-only draft identities (catalog 813).
- Batch shape follows the established ME convention: **5 primaries, one rank-1 suggestion each**, all primaries remain `draft: true`, every new clinical reference enters `verified: false` and awaits the separate qualified-human citation-verification gate, and GitHub/Vercel writes remain forbidden.
- Authoring posture for every row: `ASSOCIATION_ONLY` / `NOT_ESTABLISHED` / `NOT_ASSERTED`, `hypothesizedOnly: true`, with a strict publication guard — identical to the ME-12/ME-16/ME-17/ME-18/ME-19 rows. No causation or aggravation claim is asserted by any automated change.

## Approved rows (proposed)

| # | Primary (framework-only id) | Target | Evidence base to source (exact PMID/DOI finalized at implementation via PubMed, then human-verified) | Guard summary |
|---|------------------------------|--------|------------------------------------------------------------------------------------------------------|---------------|
| 1 | `pheochromocytoma` → `hypertension` | Endocrine Society pheochromocytoma/paraganglioma guideline — hypertension as the most common presentation | Require a diagnosed pheochromocytoma with biochemically confirmed catecholamine excess and separately established hypertension with compatible chronology. Do not infer pheochromocytoma from episodic pressure elevation or hypertension alone. Preserve essential/renal/renovascular/other endocrine hypertension, OSA, medications, and pre-existing hypertension. |
| 2 | `sjogren-s-syndrome` → `dry-eye-syndrome` | Review of keratoconjunctivitis sicca in Sjögren disease (KCS in up to ~95% of patients) | Require an established Sjögren's syndrome diagnosis and objective evidence of dry eye/keratoconjunctivitis sicca with compatible chronology. Do not infer Sjögren's from dry eye symptoms alone. Preserve meibomian gland dysfunction, environmental/medication dry eye, aging, contact lens wear, prior ocular surgery, other autoimmune/ocular-surface conditions. |
| 3 | `leukoplakia` → `oral-cancer` | Malignant-transformation systematic review of oral leukoplakia | Require biopsy-documented oral leukoplakia and separately established oral SCC with compatible chronology. Do not infer cancer from clinical appearance or dysplasia alone. Preserve tobacco/alcohol, other potentially malignant disorders, HPV, immunocompromise, other risk factors. |
| 4 | `erythroplakia` → `oral-cancer` | Systematic review and meta-analysis of oral erythroplakia (overall malignant development rate 19.9%) | Require biopsy-documented oral erythroplakia and separately established oral SCC with compatible chronology. Do not infer cancer from clinical appearance or dysplasia alone. Preserve tobacco/alcohol, other potentially malignant disorders, HPV, immunocompromise, other risk factors. Independent of the leukoplakia row (distinct PMID, distinct guard). |
| 5 | `meningitis` → `hearing-loss` | Bacterial meningitis hearing-loss study (SNHL highly prevalent post-infection) | Require an established bacterial meningitis episode with compatible chronology and separately documented hearing loss. Do not infer hearing loss from meningitis history alone. Preserve ototoxic medications (aminoglycosides), otitis media/labyrinthitis, congenital/pre-existing hearing loss, ototoxic illness, noise. |

All five targets (`hypertension`, `dry-eye-syndrome`, `oral-cancer`, `hearing-loss`) already exist in the catalog, so the edges are the only new objects; no catalog change is needed for ME-20.

## Implementation checklist (executed per batch)

1. **Research** — locate one high-tier source per row with an exact PMID (+ DOI where available) and record the publication guard. No URL or citation is ever invented; a source that cannot be located stays out of the batch.
2. **Author** — edit each of the 5 KB mapping files (`data/knowledge-base/<primary>.json`): keep the draft state and todo discipline, add the rank-1 suggestion carrying the full CRG trio (`nexusClaim` with `associationBasis` + `causationStatus`, `causalMechanism` with `mechanismCategory` + `hypothesizedOnly`, `evidentiaryProfile` with `etiologicalConsensus: NOT_ESTABLISHED` + `vaNexusProbabilityAlignment: NOT_ASSERTED` + evidence gaps + alternatives), and `sourceReferences` with `verified: false`, `verificationScope: "clinical-evidence"`, exact `sourceUrl`, `note`, and `sourceLocator` embedding the guard.
3. **Registry** — add the 5 relationships to `data/evidence/master-relationships.json` with their canonical `suggestionObjectHash` (and the 5 new `pmid-NNNN` source entities to `data/evidence/master-sources.json`) so `npm run audit:master-registry` parity holds.
4. **Ledger + tests** — create `docs/mapping-expansion-me20-approved-implementation-ledger.{json,md}`, a `docs/master-registry-2026.md` batch-6 entry, and `tests/mapping-expansion-me20.test.ts` pinning the 5 rows, their guards, and the draft/verified-false state.
5. **Gates** — `npm run kb:validate`, `audit:me-compliance`, `audit:master-registry`, `citations:audit`, `test:composition`, typecheck, lint, and the full Vitest suite must pass on the exact branch head before commit.
6. **Commit + push** — commit the batch, push to GitHub (the Desktop folder is this repo, so it stays in sync), wait 5 seconds, then begin ME-21.

## Post-batch human gate (out of agent scope)

Publication of the 5 rows requires the qualified-human citation-verification step (verify each PMID supports the guard, flip `verified: true` + `sourceCheckedOn`, then — and only then — consider publishing the primary). Until then ME-20 rows remain draft, exactly like the 20 pending ME-16..ME-19 refs.

## Ranked backlog for ME-21 onward (same process)

1. `peptic-ulcer-disease` → `anemia`
2. `eosinophilic-esophagitis` → `dysphagia`
3. `cholelithiasis` → `pancreatitis`
4. `insulin-resistance-syndrome` → `diabetes-mellitus-type-2`
5. `metabolic-syndrome` → `diabetes-mellitus-type-2`
6. `transient-ischemic-attack-residuals` → `cerebrovascular-accident-stroke-residuals`
7. `testicular-torsion` → `testicular-atrophy`
8. `lichen-sclerosus` → `squamous-cell-carcinoma`
9. `nasal-polyps` → `asthma`
10. `diabetic-gastroparesis` → `gastroparesis`

At 5 primaries per batch, the remaining ~10-edge backlog spans ME-21 through roughly ME-22; the ~480 remaining framework-only identities then continue the same loop, prioritized by evidence strength and the availability of published target identities.