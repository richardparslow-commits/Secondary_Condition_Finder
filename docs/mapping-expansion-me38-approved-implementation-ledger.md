# Mapping Expansion Batch ME-38 — Approved Implementation Ledger

## Scope

ME-38 adds one **published** PTSD → REM sleep behavior disorder bounded-association relationship over the existing `rem-sleep-disorder` catalog identity, driven by qualified-human medical-literature supplied in-session. PTSD remains published (`draft: false`); its suggestion count advances `18 → 19`. The row carries three qualified-human-verified clinical references entered `verified: true` at implementation. `rem-sleep-disorder`'s own mapping remains `draft: true` and safe-draft — this change adds only the incoming published edge from `ptsd` and does not alter REM's primary publication state or its prodromal-synucleinopathy negative-modeling posture.

| PTSD → | PMIDs | Rank | Boundary |
|---|---|---:|---|
| rem-sleep-disorder | 31587047, 41616415, 32804070 | 19 | PSG-confirmed RBD (REM sleep without atonia + dream enactment); preserve TBI, PTSD nightmares/TASD, OSA, PLMD, medications, alcohol/substance use, neurodegenerative risk |

## Evidence and publication state

- The new suggestion is `ASSOCIATION_ONLY`, `NOT_ESTABLISHED`, and `NOT_ASSERTED`, with a `hypothesizedOnly: true` psychophysiological mechanism and five bounded evidence gaps.
- All references are `verified: true` with matching `active` master source entities; `verificationState` records decision `approve-as-implemented` on `2026-09-06`.
- Registry hashes use repository canonicalization and are computed over the final verified suggestion objects stored in the KB.

## Sources (verified against PubMed in-session)

1. **Elliott 2020** (PMID 31587047) — video-polysomnography veteran cohort (n=394): confirmed RBD ~9% overall, ~15% with PTSD, ~21% with comorbid TBI+PTSD; PTSD associated with ~2.81× age-adjusted odds (TBI+PTSD ~3.43×). Authors state the association is supported while any causal role for PTSD remains uncertain.
2. **Baldini 2026** (PMID 41616415) — systematic review of seven studies (4,152 participants): PTSD associated with higher prevalence of probable/confirmed RBD, particularly among veterans; findings remain primarily observational.
3. **Barone 2020** (PMID 32804070) — clinical review of PTSD, RBD, and trauma-associated sleep disorder: dream enactment in a person with PTSD does not automatically establish true RBD, which requires polysomnographic REM sleep without atonia; TASD, OSA, PLMD, medication effects, and other conditions may mimic RBD.

## Documented decisions

- **Considered but not entered:** Husain 2001 (PMID 11435805) is superseded by the vPSG cohort evidence and was not entered as a fourth reference. The Shahkhali 2025 medRxiv preprint (DOI 10.1101/2025.09.05.25335205) is excluded from verified sources as non-peer-reviewed; its Mendelian-randomization analyses found no causal support for PTSD → RBD and are recorded as no-causation guard evidence only.
- **Causality boundary:** neither the cohort study nor the systematic review establishes that PTSD causes or aggravates an individual's RBD. The edge is bounded to association, and the diagnostic-boundary guard (Barone) is mandatory — dream enactment alone does not establish RBD.

## Aggregate ratchet

- Relationships: `362 -> 363`
- Live source reference uses: `376 -> 379`
- Verified live uses: `376 -> 379`
- Pending live uses: `0` unchanged
- Clinical uses: `371 -> 374`
- Explicit publication guards: `288 -> 289`
- Source entities including lineage: `352 -> 355`
- Published/draft mapping counts: `139 / 674` unchanged

## Safety boundary

These records are evidence-navigation aids only. They do not diagnose a condition, establish a VA medical nexus, determine service connection, or replace qualified clinical and accredited-representative review. The ME-38 edge is `ASSOCIATION_ONLY` and `NOT_ESTABLISHED`; it does not assert causation or aggravation for any individual veteran.
