# Data Governance Note

## Canonical ID policy

- Condition identity is filename-and-schema driven and must be stable.
- Canonical IDs are documented in `docs/id-reconciliation-table.md`.
- Legacy IDs are removed rather than tolerated as parallel active entries.

## Publication criteria

A mapping is publishable only when:

- `draft` is `false`
- `todo` is empty
- ranks are unique and gapless
- references resolve to catalog conditions
- no placeholder text is present

## Citation acceptability

- Published mappings must use traceable citation text.
- Placeholder citation text (for example: “relevant link”, “TBD”, “TODO”,
  “example”) is rejected by schema validation.
- Source references remain `verified: false` until qualified human review.

## Review queue support

- Run `npm run citations:weak` to detect weak citation text in published
  mappings and fail fast before release.
