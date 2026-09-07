# Mapping Expansion Batch ME-37 — Approved Implementation Ledger

## Scope

ME-37 adds nine **published** PTSD → secondary bounded-association relationships over existing catalog identities, sourced from the qualified-human synthesis `PTSD and Secondary Medical Conditions.pdf` (Desktop). PTSD remains published (`draft: false`); its suggestion count advances `9 → 18`. Each row carries one or two qualified-human-verified clinical references (**8 distinct sources, 15 citation uses**; the 2025 autoimmune meta-analysis PMID 40051767 and the Taiwan cohort PMID 37322294 are reused across the autoimmune family) entered `verified: true` at implementation.

| PTSD → | PMIDs | Rank | Boundary |
|---|---|---:|---|
| metabolic-syndrome | 23758060, 25982700 | 10 | MetS criteria with measured components; preserve obesity/lifestyle/medication/sleep causes |
| systemic-lupus-erythematosus | 40051767, 37322294 | 11 | Classification criteria + serology; preserve genetic/environmental/alternative autoimmune causes |
| rheumatoid-arthritis | 40051767, 37322294 | 12 | Classification criteria; preserve smoking/genetic/infectious/alternative arthropathies |
| inflammatory-bowel-disease | 40051767, 37322294 | 13 | Endoscopic/histologic IBD; distinguish from functional IBS |
| multiple-sclerosis | 40051767 | 14 | Diagnostic criteria + MRI; preserve vitamin D/EBV/smoking/alternative demyelinating causes |
| thyroiditis | 37322294, 40051767 | 15 | Autoimmune thyroiditis with serology; preserve iodine/medication/radiation causes |
| irritable-bowel-syndrome | 30144372 | 16 | Rome-type criteria with organic disease excluded; gut-brain framing |
| gerd | 36942766 | 17 | Narrower bound — self-reported veteran evidence; objective evaluation where indicated |
| copd | 41350112, 40402632 | 18 | Objective spirometry; smoking/occupational/deployment exposures dominate the guard |

## Evidence and publication state

- All nine new suggestions are `ASSOCIATION_ONLY`, `NOT_ESTABLISHED`, and `NOT_ASSERTED`, with `hypothesizedOnly: true` mechanisms and five bounded evidence gaps each.
- All references are `verified: true` with matching `active` master source entities; `verificationState` records decision `approve-as-implemented` on `2026-09-06`.
- Registry hashes use repository canonicalization (verified:false snapshot forms for authorized verification-only transitions).

## Aggregate ratchet

- Relationships: `353 -> 362`
- Live source reference uses: `361 -> 376`
- Verified live uses: `361 -> 376`
- Pending live uses: `0` unchanged
- Clinical uses: `356 -> 371`
- Explicit publication guards: `279 -> 288`
- Source entities including lineage: `344 -> 352`
- Published/draft mapping counts: `139 / 674` unchanged

## Documented no-edge boundary

Bourassa 2025 (PMID 41350112) primary analyses found **no** incident PTSD associations with cancer, renal disease, dementia, or liver disease. Per the sourcing synthesis, no PTSD edge for those categories is added without disease-specific literature and a highly individualized medical opinion.

## Safety boundary

These records are evidence-navigation aids only. They do not diagnose a condition, establish a VA medical nexus, determine service connection, or replace qualified clinical and accredited-representative review. No ME-37 edge asserts causation or aggravation for any individual veteran.
