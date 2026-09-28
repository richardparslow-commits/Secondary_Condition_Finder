# Condition catalog

## Three different things

The app models three concepts that are easy to conflate. Keep them apart.

| Concept | Question it answers | Authority | Location |
|---|---|---|---|
| **Catalog** | Does this condition exist, what is it called, how is severity rated | 38 CFR Part 4 (VASRD) | `data/conditions/` |
| **Secondary mappings** | What might this condition have caused or worsened | 38 CFR 3.310 plus condition-specific clinical evidence | `data/knowledge-base/` |
| **Presumptives** | What does service in a place and time presume | 38 CFR 3.307, 3.309 | `data/presumptives/` |

A rating schedule citation says **how VA evaluates severity**. It is not evidence of service connection and must never be presented as medical nexus evidence. A condition appearing in the catalog means only that the app recognizes the condition identity.

## Structure

Catalog files are grouped by body system. Expansion work may use reviewed batch files within the same body system so a large catalog expansion remains easy to inspect as a pull-request diff. Post-expansion quality maintenance may physically relocate or more precisely scope an existing stable identity without changing the condition universe.

```json
{
  "id": "sleep-apnea",
  "name": "Sleep Apnea (Obstructive, Central, Mixed)",
  "aliases": ["central sleep apnea", "mixed sleep apnea", "obstructive sleep apnea", "osa", "sleep apnea"],
  "bodySystem": "Respiratory System",
  "ratingSchedule": [
    { "citation": "38 CFR 4.97", "note": "Schedule of ratings, respiratory system.", "verified": false }
  ],
  "reviewNotes": []
}
```

The catalog is the single source of condition identity. Mapping files carry only `conditionId` references, so a display name cannot drift between two files. Referential integrity is enforced by test and again at load time before recommendations are computed.

## Current-state sources of truth

This guide intentionally contains stable catalog rules rather than a copy of fast-moving clinical-promotion totals. Do **not** duplicate the latest evidence-promotion batch number, citation-debt counts, or promotion-candidate counts here. Those values change independently of catalog identity and previously caused this document to drift behind the repository.

Use these repository-controlled sources instead:

- `data/conditions/` — current catalog identities, aliases, body systems, rating references, and review notes.
- `data/knowledge-base/` — the one-to-one secondary mapping set for catalog identities.
- `docs/clinical-program-status.md` — current clinical-evidence program state, frozen-universe accounting, promotion dispositions, and current citation position.
- `docs/clinical-evidence-promotion-batch-*.md` — bounded historical detail for each evidence-promotion batch.
- `data/expansion-dispositions.json` — current Wave 1–7 disposition ledger.
- `docs/modeling-debt-dispositions.md` — current catalog-v2 modeling-debt decisions and quarantine states.
- `docs/condition-expansion-roadmap.md` — completed Waves 1–7 expansion record and the target catalog-v2 universe.
- `docs/qualified-human-citation-verification-queue.md` and `docs/citation-verification-sop.md` — current human-review queue and verification policy.

The 2026-09 universe is frozen at **817 catalog identities with 817 corresponding knowledge-base mappings** (the frozen count moved 813/813 to 814/814 on 2026-09-28 with the versioned `tardive-dyskinesia` taxonomy addition and 814/814 to 817/817 the same day with the versioned movement-disorder additions `drug-induced-parkinsonism`, `neuroleptic-malignant-syndrome` and `serotonin-syndrome`, both recorded in `docs/condition-expansion-roadmap.md`; the additions preserved one-to-one identity/KB integrity and changed no stable ID). Clinical evidence work may change whether a mapping is a published evidence-led relationship or an intentional safe draft without changing that identity contract. The current split must be read from `docs/clinical-program-status.md` and `data/expansion-dispositions.json`, not copied into this file.

## Catalog quality and maintenance rules

The catalog remains independent from the strength or publication status of any secondary relationship:

- Rating references added or corrected by automated work remain `verified: false` unless a qualified human completes citation verification under the Citation Verification SOP.
- Clinical source records may be source-checked with URLs, dates, and locators, but source checking does not authorize `verified: true`.
- Where the rating schedule does not provide a single diagnosis-specific diagnostic code, record the applicable rating framework and an explicit review note rather than inventing authority.
- A shared diagnostic code does not collapse distinct disease identities or establish common medical causation.
- A product grouping does not override the rating schedule body system in which VA actually evaluates the disability.
- Physical file relocation is maintenance only when the stable condition ID, one-to-one KB mapping, and truthful rating-reference state are preserved.
- `carried-over.json` is reserved for intentionally quarantined compatibility identities; current dispositions are governed by `docs/modeling-debt-dispositions.md`.

## Wave 8 quality cleanup

Wave 8 resolved a bounded catalog-quality batch without changing condition count or publishing secondary relationships:

- `fibromyalgia`: corrected to **38 CFR 4.71a / DC 5025** and condition-level body system `Musculoskeletal System`; removed the historical 4.88b carryover.
- `hip-strain`: added the current hip/thigh residual framework under 38 CFR 4.71a and explicitly states that no single hip-strain-specific DC is assigned.
- `ankle-strain`: added the current ankle residual framework under 38 CFR 4.71a and explicitly states that no single ankle-strain-specific DC is assigned.
- `diabetic-retinopathy`: added the express **38 CFR 4.79 / DC 6040** identity.
- `insomnia`: records the 38 CFR 4.130 mental-disorders framework and distinguishes an insomnia diagnosis from the `chronic sleep impairment` symptom appearing in the General Rating Formula.
- `substance-use-disorder`: records the 38 CFR 4.130 framework without inventing a generic SUD diagnostic code; catalog presence does not resolve separate service-connection or compensability rules.
- `contralateral-knee-condition`: intentionally remains uncoded because it is a laterality/relationship placeholder, not a distinct diagnosis.

The Wave 8 regression contract is `tests/catalog-quality-wave8.test.ts`.

## Post-v2 evidence promotion

Evidence promotion is relationship-level work, not catalog expansion. A published mapping requires condition-specific clinical support, conservative rationale, explicit evidence gaps, and compliant source provenance. A safe draft is an intentional disposition when those requirements are not met; it is not a request to manufacture a relationship.

Detailed promotion history belongs in the numbered `docs/clinical-evidence-promotion-batch-*.md` records. The current program summary belongs in `docs/clinical-program-status.md`. This separation keeps catalog identity documentation stable while clinical evidence is repaired, promoted, withdrawn, or reclassified through bounded reviews.

Legal or rating authority may describe eligibility or severity frameworks, but it must not be used as the clinical evidence for a medical proposition. Population-level association or prevalence evidence must not be rewritten as proof of individual causation or aggravation.

## Modeling debt

Catalog-v2 modeling debt is dispositioned in `docs/modeling-debt-dispositions.md`. That document is authoritative for current quarantine and compatibility states. Do not maintain a second debt list here: doing so risks preserving resolved physical-placement issues or missing later bounded dispositions.

Any future identity retirement, merge, or replacement that would change the frozen 817/817 contract requires a versioned migration design rather than an unreviewed cleanup. An identity addition moves the same contract and follows the same discipline: a versioned addition record plus the coordinated pin migration across the identity-count pins (see the `tardive-dyskinesia` addition of 2026-09-28 in `docs/condition-expansion-roadmap.md`). Stable IDs can affect saved workflow state, aliases, historical records, and one-to-one KB integrity.

## Citation status

Catalog rating references are deliberately separate from medical evidence. Automated work must not mark them verified. A rating citation may support condition/rating identity but never a causal statement such as “condition A caused condition B.”

Clinical evidence citation counts and the qualified-human review queue are intentionally not duplicated here. Use `docs/clinical-program-status.md`, `docs/qualified-human-citation-verification-queue.md`, and the citation audit for the current position. Only qualified-human review may change a citation to `verified: true`.

## Adding or revising a condition

1. Add the condition to the appropriate body-system catalog file or an explicitly named reviewed batch/maintenance file.
2. Use a unique kebab-case `id`, a stable display `name`, and only unambiguous aliases.
3. Add a traceable rating-schedule citation when one is known; leave it `verified: false` under automated authoring policy.
4. If there is no single diagnosis-specific diagnostic code, cite the applicable framework and add a `reviewNotes` explanation. If no defensible rating authority is known at all, leave `ratingSchedule` empty and explain why. Never invent a code.
5. Recheck whether the cited diagnostic code is still current. If a regulatory revision removed or replaced an older code, do not preserve the stale code as present authority; document it only when necessary to prevent regression or explain historical data.
6. If a code applies only to a disease site, severity, phase, treatment state, residual, or named endocrine phenotype, state that scope explicitly rather than generalizing it to the whole diagnosis.
7. If a product grouping crosses rating-schedule body systems, preserve the product grouping but cite the schedule where VA actually evaluates it.
8. If a broader regulatory identity overlaps an existing narrower catalog identity, do not duplicate the narrower condition's name or aliases. Document the overlap and keep identities distinguishable.
9. If one catalog identity intentionally groups related diagnoses, keep aliases unambiguous and require later clinical authoring to evaluate diagnosis-specific pathways separately.
10. If distinct diagnoses share one rating code, keep them separate when the product needs separate identities and do not infer shared etiology, causation, aggravation, or secondary pathways from the common code.
11. Create exactly one matching `data/knowledge-base/<id>.json` in the same change.
12. Default a new mapping to `draft: true` until its secondary suggestions have condition-specific clinical evidence, conservative rationale, evidence gaps, and compliant source references.
13. Run catalog/KB integrity tests and the citation audit before review.

Aliases must be unambiguous. Tests reject an alias claimed by two conditions or one that collides with another condition's name or id.
