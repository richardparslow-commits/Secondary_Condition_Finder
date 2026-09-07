# Mapping Expansion Batch ME-36 — Approved Implementation Ledger

## Scope

ME-36 adds six **published** PTSD → secondary bounded-association relationships over existing catalog identities. Each row has one condition-specific clinical reference that entered **verified: true at implementation** after qualified-human approval in-session on 2026-09-06. PTSD remains published (`draft: false`); no other primary publication state changed.

| Primary | Target | PMID | Rank | Boundary |
|---|---|---:|---:|---|
| `ptsd` | `ischemic-heart-disease` | 24176435 | 4 | Bounded PTSD-to-CHD population-risk association; require separately established cardiac disease with objective evaluation and preserve traditional cardiovascular risk factors. |
| `ptsd` | `hypertension` | 27490852 | 5 | Bounded PTSD-to-incident-hypertension prospective-risk association; require repeated-measurement blood-pressure criteria and preserve established hypertension contributors. |
| `ptsd` | `diabetes-mellitus-type-2` | 26867081 | 6 | Bounded PTSD/T2DM association; require laboratory-supported diabetes and preserve obesity, medication, metabolic, and other risk factors. |
| `ptsd` | `depressive-disorder` | 23696449 | 7 | Bounded PTSD/MDD co-occurrence association; require a distinct depressive episode and separate the disorders clinically. |
| `ptsd` | `insomnia` | 36163136 | 8 | Bounded PTSD/insomnia association (bidirectional cohort evidence); distinguish a distinct insomnia disorder from PTSD symptoms and preserve sleep-disordered breathing. |
| `ptsd` | `substance-use-disorder` | 11481147 | 9 | Bounded PTSD/SUD co-occurrence association; require a specific SUD diagnosis and chronology, and preserve independent addictive processes. |

## Evidence and publication state

- The `ptsd` knowledge-base record remains **published** (`draft: false`); its suggestion count advances `3 → 9` (existing sleep-apnea, migraine-headaches, erectile-dysfunction preserved; six new rows appended at ranks 4–9).
- All six new suggestions are `ASSOCIATION_ONLY`, `NOT_ESTABLISHED`, and `NOT_ASSERTED`, with `hypothesizedOnly: true` mechanisms and five bounded evidence gaps each.
- All six clinical references are `verified: true` with matching `active` master source entities; `verificationState` records decision `approve-as-implemented` on `2026-09-06`.
- Registry hashes were generated from the final suggestion/reference objects using repository canonicalization (verified:false snapshot forms for authorized verification-only transitions).

## Aggregate ratchet

- Relationships: `347 -> 353`
- Live source reference uses: `355 -> 361`
- Verified live uses: `355 -> 361`
- Pending live uses: `0` unchanged
- Clinical uses: `350 -> 356`
- Explicit publication guards: `273 -> 279`
- Source entities including lineage: `338 -> 344`
- Published/draft mapping counts: `139 / 674` unchanged

## Independent corroboration

The qualified-human synthesis document `PTSD and Secondary Medical Conditions.pdf` (Desktop, 6 pp, 22 references) independently corroborates this source set: it cites the same **Edmondson PMID 24176435** (ischemic-heart-disease anchor) and **Vancampfort PMID 26867081** (diabetes-mellitus-type-2 anchor), and its condition-level literature supports the hypertension, insomnia, depression, and substance-use evidence used for the remaining four edges. The document is an evidence-navigation synthesis — not itself a master source — and its remaining PubMed/PMC references are preserved as the candidate pipeline for a future PTSD expansion (ME-37).

## Safety boundary

These records are evidence-navigation aids only. They do not diagnose a condition, establish a VA medical nexus, determine service connection, or replace qualified clinical and accredited-representative review. Every ME-36 edge is `ASSOCIATION_ONLY` and `NOT_ESTABLISHED`; no edge asserts causation or aggravation for any individual veteran.
