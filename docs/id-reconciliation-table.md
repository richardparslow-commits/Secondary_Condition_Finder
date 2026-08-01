# Canonical ID Reconciliation Table

This table records historical ID drift and the canonical IDs now enforced by
the catalog and knowledge-base schemas.

| Legacy ID | Canonical ID | Status |
| --- | --- | --- |
| `mild-traumatic-brain-injury` | `mild-tbi` | Legacy catalog entry removed |
| `cerebral-contusion-dai` | `cerebral-contusion-diffuse-axonal-injury` | Legacy catalog entry removed |
| `skull-fracture` | `skull-fracture-non-basilar-and-basal` | Legacy catalog entry removed |

## Rule

- New mappings and references must use canonical IDs only.
- Any new aliasing or renaming must be added to this table in the same PR as
  the data change.
