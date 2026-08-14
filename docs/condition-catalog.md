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

Catalog files are grouped by body system. Expansion work may use reviewed batch files within the same body system so a large catalog expansion remains easy to inspect as a pull-request diff.

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

After catalog expansion Wave 6:

- **290 catalog conditions** are represented across **29 catalog files**.
- Every catalog condition has exactly one corresponding published-or-draft file in `data/knowledge-base/`.
- Wave 1 added **20 conditions**: 12 musculoskeletal and 8 neurological.
- Wave 2 added **18 conditions**: 10 musculoskeletal and 8 neurological/peripheral-neurological.
- Wave 3 added **15 conditions**: 7 endocrine and 8 cardiovascular/product-grouped identities, including pulmonary hypertension with its actual respiratory rating authority.
- Wave 4 added **15 conditions**: 8 respiratory/ENT, 1 neurological sleep-wake condition, and 6 ophthalmologic/special-sense identities.
- Wave 5 added **15 conditions**: 10 digestive and 5 genitourinary identities.
- Wave 6 added **14 conditions**: 8 mental-disorder, 3 hematologic, and 3 skin/cutaneous identities.
- All 97 Wave 1 through Wave 6 secondary mappings remain `draft: true` with no published suggestions. They must not enter recommendation output until condition-specific clinical research satisfies the normal publication rules.
- Rating references added by automated work remain `verified: false`. A qualified human review is required before verification status can change.
- Where the rating schedule does not provide a single diagnosis-specific diagnostic code, the catalog records the applicable rating framework and an explicit review note rather than inventing authority. Wave 6 applies that safeguard to `body-dysmorphic-disorder` and `hoarding-disorder` rather than borrowing OCD's DC 9404.
- Product expansion grouping does not override the actual rating schedule. For example, Wave 3 retains pulmonary hypertension in its approved batch while citing 38 CFR 4.97 / DC 6817, and Wave 4 keeps narcolepsy under neurological 38 CFR 4.124a / DC 8108 rather than the respiratory sleep-apnea schedule.
- A broader regulatory umbrella may coexist with a narrower user-facing diagnosis only when names and aliases remain unambiguous and the overlap is documented. Wave 6 keeps `specific-phobia` distinct from the existing `social-anxiety-disorder` even though both are named under DC 9403, and keeps `discoid-lupus` distinct from `systemic-lupus-erythematosus`.
- Related diagnoses may share a rating code without becoming one medical entity. Wave 6 therefore keeps `essential-thrombocythemia` and `primary-myelofibrosis` as separate catalog identities despite shared DC 7718, and keeps `scarring-alopecia` distinct from the existing `alopecia-areata` identity.
- When one roadmap identity intentionally groups related diagnoses, the catalog grouping is only a discovery/identity choice. Clinical relationship authoring must evaluate each diagnosis and causal pathway separately. Wave 6's stable `dissociative-disorder` id is explicitly scoped in its display identity to dissociative amnesia and dissociative identity disorder, the diagnoses named by DC 9416.

The broader expansion target and ranked Waves 1-7 are maintained in `docs/condition-expansion-roadmap.md`. Target catalog v2 is 300 conditions. That is a versioned product-coverage target, not a statement that the VA schedule or medicine contains only 300 possible diagnoses.

## Existing modeling debt

Some older entries need cleanup independently of the expansion program:

- `hip-strain` and `ankle-strain` were carried into the catalog because older KB relationships referenced them; their rating citations were not supplied and remain explicitly unverified/unresolved.
- `contralateral-knee-condition` is not a distinct diagnosis. It is the same condition on the opposite side. Laterality should become an attribute rather than a separate catalog identity.
- `diabetic-retinopathy`, `insomnia`, and `substance-use-disorder` were also carried over from older KB references without supplied rating citations and retain review notes rather than invented authority.
- `cerebral-palsy` remains a catalog-governance question because congenital/developmental defects can raise distinct service-connection rules. Catalog presence by itself does not mean the app asserts service connection is available.
- Older neurological/endocrine carryovers contain naming/body-system cleanup debt. Expansion waves should not copy those inconsistencies into new entries.

## Citation status

Catalog rating references are deliberately separate from medical evidence. Automated work must not mark them verified. A rating citation may support condition/rating identity but never a causal statement such as “condition A caused condition B.”

One older item still deserving specific human review is **fibromyalgia**, which carries both `38 CFR 4.71a` and `38 CFR 4.88b` in the historical data. The 4.88b reference may be a carryover from chronic fatigue syndrome and should not be silently normalized without review.

## Adding a condition

1. Add the condition to the appropriate body-system catalog file or an explicitly named expansion-batch file.
2. Use a unique kebab-case `id`, a stable display `name`, and only unambiguous aliases.
3. Add a traceable rating-schedule citation when one is known; leave it `verified: false` under automated authoring policy.
4. If there is no single diagnosis-specific diagnostic code, cite the applicable rating framework and add a `reviewNotes` explanation. If no defensible rating authority is known at all, leave `ratingSchedule` empty and explain why. Never invent a code.
5. If a product-wave grouping crosses rating-schedule body systems, preserve the approved product grouping but cite the actual Part 4 section and explain the exception in `reviewNotes`.
6. If a broader regulatory identity overlaps an existing narrower catalog identity, do not duplicate the narrower condition's name or aliases. Document the overlap in `reviewNotes` and keep the user-facing identities distinguishable.
7. If one catalog identity intentionally groups related diagnoses, keep aliases unambiguous and require later clinical authoring to evaluate diagnosis-specific pathways separately rather than treating the grouped identity as one causal entity.
8. If distinct diagnoses share one rating code, keep them separate when the product needs separate identities and do not infer shared etiology, causation, aggravation, or secondary pathways from the common code.
9. Create exactly one matching `data/knowledge-base/<id>.json` in the same change.
10. Default a new mapping to `draft: true` until its secondary suggestions have condition-specific clinical evidence, conservative rationale, evidence gaps, and compliant source references.
11. Run catalog/KB integrity tests and the citation audit before review.

Aliases must be unambiguous. Tests reject an alias claimed by two conditions or one that collides with another condition's name or id.
