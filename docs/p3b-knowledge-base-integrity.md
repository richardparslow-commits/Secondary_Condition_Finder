# P3-B Knowledge-Base Inventory & Data Integrity

This gate validates the structural integrity of the condition catalog and knowledge-base mappings before citation verification or publication.

## Required invariants

- Every knowledge-base filename matches its root `id`.
- Every knowledge-base primary condition exists in `data/conditions`.
- Catalog condition IDs are unique across all catalog files.
- Every suggestion target exists in the catalog.
- A condition cannot recommend itself.
- Suggestion targets are unique within a mapping.
- Suggestion ranks are positive, unique, and contiguous from 1.
- Suggestions have non-empty prevalence, rationale, and evidence-gap entries.
- Every suggestion has at least one source reference.
- Every source reference has citation, note, and boolean verification state.
- A source marked `verified: true` must carry `sourceCheckedOn` so verification is auditable.

## Coverage warnings

The validator also reports catalog conditions that do not yet have a knowledge-base mapping. These are warnings rather than hard failures because some catalog entries may intentionally remain unmapped during staged authoring.

## Commands

- `npm run kb:validate` — run the inventory/data-integrity audit directly.
- `npm test` — includes the integrity regression test.

A failing integrity audit blocks the P3 publication workflow; it does not automatically mark any medical or legal citation as verified.
