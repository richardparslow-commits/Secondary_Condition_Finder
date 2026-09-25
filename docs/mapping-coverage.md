# Mapping coverage

How much of the condition catalog carries authored secondary-condition mappings,
and how that number is kept honest.

Regenerate the report and the ledger with:

```bash
npm run coverage:ledger            # print the per-system table
npm run coverage:ledger -- --write # refresh docs/mapping-coverage-ledger.json
```

`tests/mapping-coverage-ratchet.test.ts` recomputes coverage from `data/` with its
own code and fails if the ledger disagrees — so the ledger cannot describe a
repository that no longer exists, and `npm run kb:validate` cannot report a
different state from the ledger and the ratchet. Three consumers, one definition,
in `scripts/lib/kb-coverage.js`.

## Two metrics, only one of which is work

| Metric | Meaning | Current |
|---|---|---|
| `mappedConditions` (validator) | the identity has a `data/knowledge-base/<id>.json` file | 813 of 813 |
| `withAuthoredSuggestions` | that file carries at least one authored suggestion | **462 of 813** |

The first is structural and was satisfied for the whole catalog by the 2026-09
master-list import. The second is the research. The validator used to publish only
the first, as `unmappedCatalogConditions: 0`, which is exactly what a reader would
take for "the medical conditions are mapped" — and it was true of files, not of
mappings. It now reports both, and a test fails if the authored counts disappear
from its summary again.

A condition counts as mapped once its file has a suggestion, whether that
suggestion is published or still `draft: true`: a draft holds authored research
awaiting qualified-human publication review, which is a different state from never
having been researched at all. Both are counted separately.

## Current state

462 identities carry authored mappings — **140 published, 322 draft** — across
634 relationship edges. **351 identities have none.**

| Body system | Catalog | Mapped | Published | Draft | Unmapped |
|---|---:|---:|---:|---:|---:|
| Musculoskeletal System | 126 | 56 | 14 | 42 | **70** |
| Neurological | 87 | 51 | 13 | 38 | **36** |
| Skin Conditions | 70 | 36 | 4 | 32 | **34** |
| Genitourinary & Gynecological Systems | 55 | 24 | 10 | 14 | **31** |
| Auditory & Special Senses | 62 | 33 | 5 | 28 | **29** |
| Respiratory System | 70 | 41 | 13 | 28 | **29** |
| Cardiovascular System | 65 | 42 | 14 | 28 | **23** |
| Dental & Oral Conditions | 41 | 18 | 1 | 17 | **23** |
| Endocrine | 50 | 31 | 13 | 18 | 19 |
| Mental Disorders | 46 | 29 | 7 | 22 | 17 |
| Oncological Conditions | 31 | 18 | 11 | 7 | 13 |
| Digestive System | 59 | 49 | 16 | 33 | 10 |
| Infectious & Tropical Diseases | 26 | 17 | 12 | 5 | 9 |
| Hemic, Lymphatic & Immune Systems | 25 | 17 | 7 | 10 | 8 |

Rows are ordered by unmapped count, then alphabetically. Every number in this
section is a rendering of `docs/mapping-coverage-ledger.json`, so refresh it with
`npm run coverage:ledger -- --write` and re-render rather than editing it by hand —
a hand-edited coverage number is the drift this document exists to prevent.

`docs/mapping-coverage-ledger.json` also carries the sorted list of the 351 ids
without mappings — that list is the work queue.

## The ratchet

The ledger records two bounds. `withAuthoredSuggestionsMin` is a floor that
regeneration raises to the current count — 462 today. `withoutSuggestionsMax` is a
ceiling that regeneration only ever raises: it still holds the 555 baseline measured
when the ledger was first written, which is 204 identities above the current 351.

The floor is the binding constraint, because published + draft + unmapped is a
partition of the catalog and the test asserts that identity. Dropping an authored
mapping therefore fails immediately, with the numbers and the file to change. The
ceiling guards the other direction — a catalog import that adds identities faster
than they are authored — and trips only if unmapped identities climb back past 555.

Raising either bound is allowed, but it is a line in the diff rather than a silent
regression.

## What authoring a mapping actually costs

A new relationship is not one JSON edit. The governed pipeline requires all of:

1. the knowledge-base file with a CRG-complete suggestion (`nexusClaim`,
   `causalMechanism`, `evidentiaryProfile`, `sourceReferences` with
   `verificationScope`), CRG tiers and guards validated by `npm run kb:validate`;
2. the same relationship registered in `data/evidence/master-relationships.json`
   with a matching `suggestionObjectHash` (sha256 over canonical JSON), plus the
   source's `liveUses`/`liveUsageCount` in `master-sources.json`, because
   `scripts/audit-master-registry.js` checks KB↔registry parity in both
   directions;
3. advances to the totals pinned in that audit script and in the tests that read
   the citation audit's output;
4. and **the per-condition determinations earlier batches recorded.** Measured on
   2026-09-18: a ten-condition pilot batch reached 46 test files plus one shared
   helper, because each historical batch test re-pins the *global* totals (now 1073
   live source-reference uses, 634 relationships, 982 source entities) rather than
   its own delta. Two of the pilot's edges were also blocked on review, not mechanics:
   `tests/mapping-expansion-me30.test.ts` records that acquired syndactyly and
   acrocyanosis have "no credible condition-specific target", and
   `tests/clinical-evidence-promotion-batch31.test.ts` asserts the specific
   carpal-tunnel `todo` note about taxonomy and diagnostic overlap.

Item 4 is the reason this document exists before the remaining 351 mappings do. The
pins belong in one current-state test, not in the 85 batch test files `tests/` now
holds — 46 of which re-pin the live-use total and 39 the relationship total. Until
that is true, every new batch pays a mechanical sweep that hides the batch's own
contribution inside unrelated edits. That sweep is also why the numbers here had to
be recomputed rather than trusted: authored coverage moved from 258 to 462
identities across those batches, and nothing in the repository said so in one place.

## Status of the older trackers

`docs/condition-expansion-roadmap.md` still describes 300 catalog conditions as
the v2 target and `docs/kb-coverage-tracker.md` still carries a 311-identity /
139-published snapshot. Both predate the 813-identity import and are historical
records of their own batches; this document is the current coverage state.
