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

Catalog files are grouped by body system. Expansion work may use reviewed batch files within the same body system so a large catalog expansion remains easy to inspect as a pull-request diff. Post-expansion quality maintenance may physically relocate or more precisely scope an existing stable identity without changing the 300-condition universe.

```json
{
  "id": "sleep-apnea",
  "name": "Sleep Apnea (Obstructive, Central, Mixed)",
  "aliases": ["obstructive", "central", "mixed"],
  "bodySystem": "Respiratory System",
  "ratingSchedule": [
    { "citation": "38 CFR 4.97", "note": "...", "verified": false }
  ],
  "reviewNotes": []
}
```

The catalog is the single source of condition identity. Mapping files carry only `conditionId` references, so a display name cannot drift between two files. Referential integrity is enforced by test and again at load time before recommendations are computed.

## Current coverage

After Clinical Evidence Promotion Batch 7:

- **300 catalog conditions** remain represented across **33 catalog files**.
- Every catalog condition still has exactly one corresponding published-or-draft file in `data/knowledge-base/`.
- Waves 1 through 7 added **107 identities**; Wave 8 added no identities and was a catalog-quality pass.
- Clinical Evidence Promotion Batches 1 through 7 publish eleven individually reviewed Wave 1-7 mappings: `cardiomyopathy`, `urethral-stricture`, `hypertensive-heart-disease`, `chronic-pyelonephritis`, `chronic-liver-disease`, `acl-injury`, `pcl-injury`, `barretts-esophagus`, `achalasia`, `hyperaldosteronism`, and `acromegaly`.
- **96 of the 107 Wave 1-7 secondary mappings remain `draft: true`**.
- `ankle-strain`, `knee-injury`, `osteoarthritis`, `ageusia`, `agranulocytosis`, `al-amyloidosis`, `addisons-disease`, and `anorexia-nervosa` are draft because previously published claims did not satisfy the condition-specific clinical-evidence publication bar.
- Published legacy relationships for `amputation-or-loss-of-use`, `anosmia`, and `alopecia-areata` have had legal-only support replaced with condition-specific clinical evidence and conservative individual-review safeguards.
- Rating references added or corrected by automated work remain `verified: false`. Clinical source records may be source-checked with URLs, dates, and locators, but remain `verified: false` until qualified-human verification under the Citation Verification SOP.
- Where the rating schedule does not provide a single diagnosis-specific diagnostic code, the catalog records the applicable rating framework and an explicit review note rather than inventing authority.
- Wave 8 records `diabetic-retinopathy` under 38 CFR 4.79 / DC 6040 and corrects `fibromyalgia` to 38 CFR 4.71a / DC 5025, removing the historical 4.88b carryover from fibromyalgia.
- Batch 1 physically relocates `fibromyalgia` into `musculoskeletal-quality-maintenance.json`.
- Batch 2 physically relocates `diabetic-retinopathy` into `ophthalmologic-expansion-wave-4.json`.
- Batch 3 physically relocates `insomnia` into `mental-disorders.json`.
- Batch 4 physically relocates `hip-strain` and `ankle-strain` into `musculoskeletal-quality-maintenance.json` while preserving stable IDs, aliases, 38 CFR 4.71a residual frameworks, and rating-reference verification state.
- Batch 5 physically relocates `substance-use-disorder` into `mental-disorders.json` while preserving its stable identity, broad 38 CFR 4.130 framework, legal-eligibility cautions, and verification state.
- Batch 6 narrows the existing `hyperpituitarism` display name to `Hyperpituitarism (Prolactin-Secreting Pituitary Dysfunction)`, matching DC 7916's express scope while preserving the stable ID, aliases, and rating-reference verification state.
- Batch 7 physically relocates `cushings-syndrome` from the historical neurological file into `endocrine.json`, normalizes its display name to `Cushing's Syndrome`, and records the express 38 CFR 4.119 / DC 7907 framework while preserving its stable ID and draft KB mapping.
- `carried-over.json` is reduced to the intentionally quarantined `contralateral-knee-condition` laterality placeholder.
- `contralateral-knee-condition` remains a quarantined legacy relationship/laterality placeholder with no rating code because it is not a distinct diagnosis. Laterality should be modeled structurally before that placeholder is retired.
- Product expansion grouping does not override the actual rating schedule, and shared diagnostic codes do not collapse distinct disease identities or establish common medical causation.

The completed Waves 1-7 expansion record is maintained in `docs/condition-expansion-roadmap.md`. Target catalog v2 remains **300 conditions**. Post-v2 evidence promotion and quality maintenance do not convert that target into a claim that 300 conditions exhaust medicine or the VA rating schedule.

## Wave 8 quality cleanup

Wave 8 resolved the first bounded batch of documented catalog debt without changing condition count or publishing secondary relationships:

- `fibromyalgia`: corrected to **38 CFR 4.71a / DC 5025** and condition-level body system `Musculoskeletal System`; removed the historical 4.88b carryover.
- `hip-strain`: added the current hip/thigh residual framework under 38 CFR 4.71a and explicitly states that no single hip-strain-specific DC is assigned.
- `ankle-strain`: added the current ankle residual framework under 38 CFR 4.71a and explicitly states that no single ankle-strain-specific DC is assigned.
- `diabetic-retinopathy`: added the express **38 CFR 4.79 / DC 6040** identity.
- `insomnia`: records the 38 CFR 4.130 mental-disorders framework and distinguishes an insomnia diagnosis from the `chronic sleep impairment` symptom appearing in the General Rating Formula.
- `substance-use-disorder`: records the 38 CFR 4.130 framework without inventing a generic SUD diagnostic code; catalog presence does not resolve separate service-connection or compensability rules.
- `contralateral-knee-condition`: intentionally remains uncoded because it is a laterality/relationship placeholder, not a distinct diagnosis.

The Wave 8 regression contract is `tests/catalog-quality-wave8.test.ts`.

## Post-v2 evidence promotion and catalog maintenance

Clinical Evidence Promotion Batches 1 through 7 follow a relationship-level publication rule rather than promoting whole catalog waves. Eleven expansion mappings are published because their individual relationships have condition-specific clinical support, conservative rationales, explicit evidence gaps, and source provenance. The remainder of each expansion wave stays draft unless its own relationships independently satisfy that bar.

- **Batch 1:** promotes `cardiomyopathy` and `urethral-stricture`, withdraws unsupported `ankle-strain` relationships, and completes fibromyalgia's physical file relocation.
- **Batch 2:** promotes `hypertensive-heart-disease` and `chronic-pyelonephritis`, withdraws unsupported `knee-injury` and `osteoarthritis` relationships, and physically relocates `diabetic-retinopathy`.
- **Batch 3:** promotes `chronic-liver-disease` only through documented hepatic-fibrosis progression, repairs the amputation/depression relationship with clinical evidence, withdraws unsupported `ageusia` relationships, and physically relocates `insomnia`.
- **Batch 4:** promotes `acl-injury` and `pcl-injury` to affected-knee osteoarthritis research with injury-specific systematic-review evidence; repairs `anosmia` and `alopecia-areata` depression relationships with condition-specific evidence; withdraws `agranulocytosis`; and physically normalizes `hip-strain` and `ankle-strain` into musculoskeletal maintenance.
- **Batch 5:** promotes `barretts-esophagus` and `achalasia` to histology-aware esophageal-cancer research pathways; withdraws the legal-only generic `al-amyloidosis` relationships; and physically normalizes `substance-use-disorder` into mental-disorders maintenance.
- **Batch 6:** promotes `hyperaldosteronism` to hypertension research only for a confirmed primary-aldosteronism phenotype using current Endocrine Society guideline evidence; withdraws the three rating-only generic `addisons-disease` relationships; and narrows `hyperpituitarism` to DC 7916's prolactin-secreting pituitary-dysfunction display scope.
- **Batch 7:** promotes `acromegaly` to hypertension research using the 2026 international acromegaly complications consensus and condition-activity/chronology safeguards; withdraws the legal-only generic `anorexia-nervosa` depression relationship; and physically relocates `cushings-syndrome` into the endocrine catalog with the DC 7907 framework.

See `docs/clinical-evidence-promotion-batch-1.md` through `docs/clinical-evidence-promotion-batch-7.md` and their corresponding regression tests.

## Remaining modeling debt

Separate modeling work remains after Batch 7:

- `contralateral-knee-condition` still requires a structural laterality migration before the legacy placeholder can be retired.
- `cerebral-palsy` remains a catalog-governance question because congenital/developmental conditions can raise distinct service-connection rules. Catalog presence by itself does not mean the app asserts service connection is available.
- The historical `neurological.json` file still contains endocrine/metabolic identities such as diabetes mellitus type 1, thyroid disorders, and parathyroid disorders. Those should be relocated only in bounded stable-ID changes with rating authority and regression coverage rather than mass-moved.
- Other historical catalog files may still contain cross-system physical placement or over-broad grouped identities; those should be corrected only in bounded changes that preserve stable IDs and one-to-one mappings.

## Citation status

Catalog rating references are deliberately separate from medical evidence. Automated work must not mark them verified. A rating citation may support condition/rating identity but never a causal statement such as “condition A caused condition B.”

Clinical Evidence Promotion Batches 1 through 7 add or repair source-checked clinical references only for individually reviewed relationships; those sources remain `verified: false` until qualified-human verification under `docs/citation-verification-sop.md`.

After Batch 7, the automated non-regression ceilings remain **138 total references, 14 verified, 124 unverified, and 122 published-unverified review findings**, while the clinical-evidence-with-canonical-URL floor rises to **39**.

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
