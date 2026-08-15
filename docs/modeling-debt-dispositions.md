# Modeling Debt Dispositions — Target Catalog v2

These dispositions close the current **v2 modeling-debt review** without changing the frozen 300 catalog / 300 knowledge-base universe. A disposition can intentionally preserve a quarantined stable identity when deleting or merging it would require a versioned identity migration rather than a safe maintenance edit.

## `contralateral-knee-condition`

**Disposition: quarantined laterality placeholder; no v2 publication.**

- This is a historical relationship/laterality placeholder, not a distinct medical diagnosis.
- It remains isolated in `data/conditions/carried-over.json`, has no invented rating code, and has no published secondary mapping.
- Correct long-term modeling is to represent laterality/contralateral relationship structurally rather than multiplying diagnostic identities.
- Removing the ID during v2 would either break the 300/300 identity contract or require a replacement/migration design. That is not a bounded maintenance change.
- For v2, the safe completed state is therefore: stable ID retained for compatibility, no clinical publication, explicit quarantine, future structural laterality migration required before retirement.

## `micro-tbi`

**Disposition: historical/non-standard research label retained as a safe draft; no v2 publication.**

- `mild-tbi` is the standardized clinical identity used for current evidence-led post-traumatic-headache research.
- `micro-tbi` remains a separate historical catalog identity for compatibility, but its prior legal-only secondary suggestions were withdrawn in Clinical Evidence Promotion Batch 21.
- Future consolidation into `mild-tbi` would be an identity migration with alias, historical-state, and saved-workflow implications. It should not be performed as an unversioned maintenance rename.
- For v2, `micro-tbi` must remain `draft: true` with no suggestions and must not be treated as a second independently validated TBI diagnosis merely because the stable ID exists.

## `cerebral-palsy`

**Disposition: catalog-recognition identity retained; service-connection/legal applicability remains outside catalog identity.**

- Catalog presence means the product can recognize the condition name; it does not assert that the condition is service connected, secondarily service connectable, or compensable in a particular case.
- Congenital/developmental conditions can raise legal questions distinct from ordinary acquired-disability pathways. Those questions must not be inferred from catalog presence.
- The knowledge-base mapping remains a safe draft until a specific secondary relationship has both condition-specific clinical evidence and appropriate legal applicability review.
- No generic causal or secondary pathway is published in v2.

## Other physical-placement and grouped-identity debt

The endocrine and pulmonary-hypertension maintenance sequence has already corrected the major known cross-system physical placements without changing stable IDs. Any newly discovered cross-system placement, grouped identity, obsolete code, or over-broad alias must be handled as a separate bounded change with:

1. stable-ID preservation unless a versioned migration is explicitly designed;
2. current rating authority checked separately from medical evidence;
3. one-to-one catalog/KB integrity preserved;
4. regression coverage for the exact identity change; and
5. no inference that shared rating authority establishes shared etiology or secondary causation.

## v2 closure rule

The three named items above are **not open blockers to the current clinical evidence program** after these dispositions are recorded. They are controlled modeling states:

- laterality placeholder quarantined;
- historical micro-TBI label quarantined as draft;
- cerebral-palsy recognition identity retained without service-connection inference.

A future catalog-v3 identity migration may retire or consolidate these IDs, but v2 should not violate 300/300 or silently rewrite stable identity history to make the debt list appear empty.
