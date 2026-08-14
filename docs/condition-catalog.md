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

After catalog expansion Wave 1:

- **213 catalog conditions** are represented.
- Every catalog condition has exactly one corresponding published-or-draft file in `data/knowledge-base/`.
- Wave 1 added **20 conditions**: 12 musculoskeletal and 8 neurological.
- All 20 Wave 1 secondary mappings begin as `draft: true` with no published suggestions. They must not enter recommendation output until condition-specific clinical research satisfies the normal publication rules.
- Rating references added by automated work remain `verified: false`. A qualified human review is required before verification status can change.

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
4. If no rating citation is supplied, leave `ratingSchedule` empty and add a `reviewNotes` explanation. Never invent one.
5. Create exactly one matching `data/knowledge-base/<id>.json` in the same change.
6. Default a new mapping to `draft: true` until its secondary suggestions have condition-specific clinical evidence, conservative rationale, evidence gaps, and compliant source references.
7. Run catalog/KB integrity tests and the citation audit before review.

Aliases must be unambiguous. Tests reject an alias claimed by two conditions or one that collides with another condition's name or id.
