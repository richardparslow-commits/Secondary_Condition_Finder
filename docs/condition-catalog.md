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

Catalog files are grouped by body system. Expansion work may use reviewed batch files within the same body system so a large catalog expansion remains easy to inspect as a pull-request diff. Post-expansion quality maintenance may physically relocate an existing stable identity into a more appropriate reviewed body-system file without changing the 300-condition universe.

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

After Clinical Evidence Promotion Batch 2:

- **300 catalog conditions** remain represented across **33 catalog files**.
- Every catalog condition still has exactly one corresponding published-or-draft file in `data/knowledge-base/`.
- Wave 1 added **20 conditions**: 12 musculoskeletal and 8 neurological.
- Wave 2 added **18 conditions**: 10 musculoskeletal and 8 neurological/peripheral-neurological.
- Wave 3 added **15 conditions**: 7 endocrine and 8 cardiovascular/product-grouped identities, including pulmonary hypertension with its actual respiratory rating authority.
- Wave 4 added **15 conditions**: 8 respiratory/ENT, 1 neurological sleep-wake condition, and 6 ophthalmologic/special-sense identities.
- Wave 5 added **15 conditions**: 10 digestive and 5 genitourinary identities.
- Wave 6 added **14 conditions**: 8 mental-disorder, 3 hematologic, and 3 skin/cutaneous identities.
- Wave 7 added **10 conditions**: 6 infectious/tropical, 3 oncological, and 1 dental/oral identity.
- Wave 8 added **no new condition identities**. It was a catalog-quality pass that preserved the target-v2 300/300 contract.
- Clinical Evidence Promotion Batch 1 added no identities and promoted `cardiomyopathy` → `congestive-heart-failure` and `urethral-stricture` → `hydronephrosis` after condition-specific clinical review.
- Clinical Evidence Promotion Batch 2 adds no identities and promotes `hypertensive-heart-disease` → `congestive-heart-failure` and `chronic-pyelonephritis` → `chronic-kidney-disease` after condition-specific clinical review.
- **103 of the 107 Wave 1 through Wave 7 secondary mappings remain `draft: true`**. The four promoted expansion mappings are `cardiomyopathy`, `urethral-stricture`, `hypertensive-heart-disease`, and `chronic-pyelonephritis`.
- `ankle-strain`, `knee-injury`, and `osteoarthritis` are draft because previously published downstream claims were not supported by condition-specific clinical evidence at the level required for publication.
- Rating references added or corrected by automated work remain `verified: false`. Clinical source records may be source-checked with URLs, dates, and locators, but remain `verified: false` until qualified-human verification under the Citation Verification SOP.
- Where the rating schedule does not provide a single diagnosis-specific diagnostic code, the catalog records the applicable rating framework and an explicit review note rather than inventing authority.
- Wave 8 applies that rule to `hip-strain`, `ankle-strain`, `insomnia`, and `substance-use-disorder` rather than inventing diagnosis-specific codes.
- Wave 8 records `diabetic-retinopathy` under 38 CFR 4.79 / DC 6040 and corrects `fibromyalgia` to 38 CFR 4.71a / DC 5025, removing the historical 4.88b carryover from fibromyalgia.
- Clinical Evidence Promotion Batch 1 physically relocates the unchanged `fibromyalgia` identity from the historical hemic/immune catalog file to `musculoskeletal-quality-maintenance.json`.
- Clinical Evidence Promotion Batch 2 physically relocates the unchanged `diabetic-retinopathy` identity from `carried-over.json` into `ophthalmologic-expansion-wave-4.json`; its stable ID, aliases, body-system value, rating identity, and one-to-one KB mapping do not change.
- `contralateral-knee-condition` remains a quarantined legacy relationship/laterality placeholder with no rating code because it is not a distinct diagnosis. Laterality should be modeled structurally before that placeholder is retired.
- Product expansion grouping does not override the actual rating schedule. Wave 7 therefore scopes `histoplasmosis` to the pulmonary DC 6834 identity even though the stable discovery id is broader, and treats DCs 6822 and 6823 as pulmonary rating identities for actinomycosis and nocardiosis rather than universal codes for every extra-pulmonary manifestation.
- Obsolete diagnostic codes must not be carried forward as current authority. Wave 7 records that former amebiasis DC 7321 was removed effective May 19, 2024 and uses the current infectious/parasitic framework instead.
- Severity-limited diagnostic codes must not be generalized. Wave 7 records DC 6325 only for hyperinfection syndrome or disseminated strongyloidiasis and preserves broader parasitic/residual review for other presentations.
- Broader system malignancy codes do not become invented diagnosis-specific codes. Wave 7 uses DC 7627 for ovarian cancer, DC 7528 for testicular cancer, and DC 6819 for laryngeal cancer while explicitly documenting that those are broader gynecological, genitourinary, and respiratory malignancy frameworks.
- A broader regulatory umbrella may coexist with a narrower user-facing diagnosis only when names and aliases remain unambiguous and the overlap is documented.
- Related diagnoses may share a rating code without becoming one medical entity. A shared rating framework never establishes shared etiology, causation, aggravation, or a secondary pathway.

The completed Waves 1-7 expansion record is maintained in `docs/condition-expansion-roadmap.md`. Target catalog v2 remains **300 conditions**. Post-v2 evidence promotion and quality maintenance do not convert that target into a claim that 300 conditions exhaust medicine or the VA rating schedule.

## Wave 8 quality cleanup

Wave 8 resolved the first bounded batch of documented catalog debt without changing condition count or publishing secondary relationships:

- `fibromyalgia`: corrected to **38 CFR 4.71a / DC 5025** and condition-level body system `Musculoskeletal System`; removed the historical 4.88b carryover.
- `hip-strain`: added the current hip/thigh residual framework under 38 CFR 4.71a and explicitly states that no single hip-strain-specific DC is assigned.
- `ankle-strain`: added the current ankle residual framework under 38 CFR 4.71a and explicitly states that no single ankle-strain-specific DC is assigned.
- `diabetic-retinopathy`: added the express **38 CFR 4.79 / DC 6040** identity.
- `insomnia`: records the 38 CFR 4.130 mental-disorders framework and distinguishes an insomnia diagnosis from the `chronic sleep impairment` symptom appearing in the General Rating Formula.
- `substance-use-disorder`: records the 38 CFR 4.130 framework without inventing a generic SUD diagnostic code; catalog presence does not resolve separate service-connection or compensability rules.
- `contralateral-knee-condition`: intentionally remains uncoded because it is a laterality/relationship placeholder, not a distinct diagnosis. A future structural migration should model laterality and retire the placeholder without breaking the one-to-one catalog/KB contract.

The Wave 8 regression contract is `tests/catalog-quality-wave8.test.ts`.

## Post-v2 evidence promotion and catalog maintenance

Clinical Evidence Promotion Batches 1 and 2 follow a relationship-level publication rule rather than promoting whole catalog waves. Four expansion mappings are published because their individual relationships have condition-specific clinical support, conservative rationales, explicit evidence gaps, and source provenance. The remainder of each expansion wave stays draft unless its own relationships independently satisfy that bar.

Batch 1 promotes `cardiomyopathy` and `urethral-stricture`, withdraws unsupported `ankle-strain` relationships, and completes fibromyalgia's physical file relocation.

Batch 2 promotes `hypertensive-heart-disease` and `chronic-pyelonephritis`, withdraws unsupported `knee-injury` and `osteoarthritis` relationships, and physically relocates `diabetic-retinopathy` into the ophthalmologic catalog file. Batch 2 also tightens the citation-debt ratchet after retiring nine unsafe legacy references.

See `docs/clinical-evidence-promotion-batch-1.md`, `docs/clinical-evidence-promotion-batch-2.md`, `tests/clinical-evidence-promotion-batch1.test.ts`, and `tests/clinical-evidence-promotion-batch2.test.ts`.

## Remaining modeling debt

Separate modeling work remains after Batch 2:

- `contralateral-knee-condition` still requires a structural laterality migration before the legacy placeholder can be retired.
- `cerebral-palsy` remains a catalog-governance question because congenital/developmental conditions can raise distinct service-connection rules. Catalog presence by itself does not mean the app asserts service connection is available.
- The historical `carried-over.json` file still contains stable musculoskeletal and mental-health identities whose physical placement can be normalized in later bounded maintenance passes without changing IDs.
- Older neurological/endocrine carryovers contain naming/body-system cleanup debt. Future catalog work should not copy those inconsistencies.
- Other historical catalog files may still contain cross-system physical placement or over-broad grouped identities; those should be corrected only in bounded changes that preserve stable IDs and one-to-one mappings.

## Citation status

Catalog rating references are deliberately separate from medical evidence. Automated work must not mark them verified. A rating citation may support condition/rating identity but never a causal statement such as “condition A caused condition B.”

Wave 8 removed fibromyalgia's historical 38 CFR 4.88b carryover and locked the corrected 38 CFR 4.71a / DC 5025 identity with regression coverage. Clinical Evidence Promotion Batches 1 and 2 add source-checked clinical references for four individual expansion relationships; those sources remain `verified: false` until qualified-human verification under `docs/citation-verification-sop.md`.

Batch 2 improves the automated citation debt position by retiring nine unsafe unverified references while adding two condition-specific clinical references. The non-regression baseline is tightened to 141 total references, 14 verified, 127 unverified, 125 published-unverified review findings, and at least 29 clinical-evidence references with canonical URLs.

## Adding or revising a condition

1. Add the condition to the appropriate body-system catalog file or an explicitly named reviewed batch/maintenance file.
2. Use a unique kebab-case `id`, a stable display `name`, and only unambiguous aliases.
3. Add a traceable rating-schedule citation when one is known; leave it `verified: false` under automated authoring policy.
4. If there is no single diagnosis-specific diagnostic code, cite the applicable framework and add a `reviewNotes` explanation. If no defensible rating authority is known at all, leave `ratingSchedule` empty and explain why. Never invent a code.
5. Recheck whether the cited diagnostic code is still current. If a regulatory revision removed or replaced an older code, do not preserve the stale code as present authority; document it only when necessary to prevent regression or explain historical data.
6. If a code applies only to a disease site, severity, phase, treatment state, or residual, state that scope explicitly rather than generalizing it to the whole diagnosis.
7. If a product grouping crosses rating-schedule body systems, preserve the product grouping but cite the schedule where VA actually evaluates it.
8. If a broader regulatory identity overlaps an existing narrower catalog identity, do not duplicate the narrower condition's name or aliases. Document the overlap and keep identities distinguishable.
9. If one catalog identity intentionally groups related diagnoses, keep aliases unambiguous and require later clinical authoring to evaluate diagnosis-specific pathways separately.
10. If distinct diagnoses share one rating code, keep them separate when the product needs separate identities and do not infer shared etiology, causation, aggravation, or secondary pathways from the common code.
11. Create exactly one matching `data/knowledge-base/<id>.json` in the same change.
12. Default a new mapping to `draft: true` until its secondary suggestions have condition-specific clinical evidence, conservative rationale, evidence gaps, and compliant source references.
13. Run catalog/KB integrity tests and the citation audit before review.

Aliases must be unambiguous. Tests reject an alias claimed by two conditions or one that collides with another condition's name or id.
