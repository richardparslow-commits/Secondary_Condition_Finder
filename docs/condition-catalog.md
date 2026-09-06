# Condition catalog

## Three different things

The app models three concepts that are easy to conflate. Keep them apart.

| Concept | Question it answers | Authority | Location |
|---|---|---|---|
| **Catalog** | Does this condition exist, what is it called, how is severity rated | 38 CFR Part 4 (VASRD) | `data/conditions/` |
| **Secondary mappings** | What might this condition have caused or worsened | 38 CFR 3.310 | `data/knowledge-base/` |
| **Presumptives** | What does service in a place and time presume | 38 CFR 3.307, 3.309 | `data/presumptives/` |

A rating schedule citation says **how VA evaluates severity**. It is not
evidence of service connection and must never be presented as such. A condition
appearing in the catalog means only that it exists and is ratable.

## Structure

One file per body system, 14 systems plus a carried-over file. 193 conditions.

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

The catalog is the single source of condition identity. Mapping files carry
only `conditionId` references, so a display name cannot drift between two
files. Referential integrity is enforced by test: every id referenced by a
mapping must exist in the catalog. The same check also runs at load time before
recommendations are computed.

## Coverage

- 193 conditions across 14 body systems
- 160 carry a rating schedule citation, all `verified: false`
- 33 carry none. No citation was supplied and none was inferred; each entry
  carries a `reviewNotes` entry saying why. The six originally flagged by the
  source list (`hip-strain`, `ankle-strain`,
  `contralateral-knee-condition`, `diabetic-retinopathy`, `insomnia`, and
  `substance-use-disorder`) remain among them.
- All 193 conditions have authored knowledge-base files and all 193 are published (active in recommendations).

> Counts above are checked against `data/conditions/*.json` and
> `data/knowledge-base/*.json`; recalculate from the data rather than trusting
> any copy of this document.

## Known gaps in the source list

> Historical notes from when the catalog was smaller. Most gaps listed below
> have since been filled (entries now exist for hip/ankle strain, insomnia,
> substance use disorder, and diabetic retinopathy). Verify against
> `data/conditions/` before acting on any of these.

- **No hip or ankle joint entries** in the musculoskeletal section, despite
  entries for spine, shoulder, elbow, wrist, knee, and foot. Both are common
  compensatory secondary claims.
- **No insomnia** entry, despite narcolepsy and restless leg syndrome.
- **No substance use disorder** entry, despite a full mental disorders section.
- **No diabetic retinopathy** entry, despite retinal detachment and macular
  degeneration.
- **Cerebral palsy** is listed. Congenital and developmental defects are
  generally barred from service connection by 38 CFR 3.303(c). Whether it
  belongs here needs a decision.
- **`contralateral-knee-condition`** is not a distinct diagnosis. It is the
  same condition on the opposite side. Laterality should become an attribute
  rather than a separate catalog entry.

## Citation status

Every rating citation ships `verified: false`. The source list arrived with a
self-declared "Hallucination Check" asserting the citations were accurate. A
generator asserting its own correctness is not review. Treat these exactly like
every other unverified citation in this repo until a qualified human checks
them.

One to check first: **fibromyalgia** was supplied as
`38 CFR 4.71a / 38 CFR 4.88b`. Fibromyalgia is rated under 4.71a. The 4.88b
reference belongs to the infectious disease and immune disorder schedule and
may be a carryover from chronic fatigue syndrome. Recorded as supplied, flagged
here rather than silently changed.

## Adding a condition

Add it to the body system file that fits. Give it a unique kebab-case `id`, a
display `name`, any unambiguous `aliases`, and a rating citation if you have a
real one. If you do not have one, leave `ratingSchedule` empty and add a
`reviewNotes` entry explaining why. Never invent a citation.

Aliases must be unambiguous. A test rejects an alias claimed by two conditions,
or one that collides with another condition's name or id.
