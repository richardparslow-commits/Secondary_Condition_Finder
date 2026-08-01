# Schema Hardening Migration Checklist

Use this checklist whenever schema constraints are tightened for
`data/conditions` or `data/knowledge-base`.

- [ ] Confirm the canonical JSON contract in `src/lib/catalog/schema.ts` and
      `src/lib/kb/schema.ts` (including strict object parsing).
- [ ] Run a repository-wide keyset audit and remove non-contract fields from
      JSON files before enabling stricter validation.
- [ ] Reconcile any ID drift between catalog IDs, KB filenames, and mapping
      `id` fields.
- [ ] Validate cross-file references (`suggestions[].conditionId`) against the
      catalog after reconciliation.
- [ ] Ensure published mappings (`draft: false`) have traceable citations and
      no placeholder text.
- [ ] Regenerate/refresh reporting artifacts (`draft-backlog-tracker.csv`,
      validation/audit scripts, README coverage statements).
- [ ] Run full validation gates from repo root:
      - `npm run lint`
      - `npm run typecheck`
      - `npm test`
- [ ] Keep all new source references unverified (`verified: false`) pending
      qualified human review.
