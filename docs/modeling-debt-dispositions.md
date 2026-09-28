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

## `eczema` / `atopic-dermatitis-eczema`

**Disposition: NOT duplicate identities; retained as two distinct identities under an explicit scope split. The
identity-duplication finding is retracted as erroneous at the evidence level.**

- Batches 80 and 82 recorded these two as `IDENTITY-DUPLICATION` — "open identities for the same disease" — and the
  `eczema` knowledge-base file called the identity "a common clinical synonym for atopic dermatitis rather than a
  distinct disease process". **The registered evidence contradicts that reading**, and neither batch read the
  verified edge that disproves it.
- `eczema` holds a **qualified-human-verified** route, `psoriasis` → `eczema` at `POST_SURGICAL_OR_TREATMENT`, whose
  source is the prospective biologic-registry study *Risk of Paradoxical Eczema in Patients Receiving Biologics for
  Psoriasis* (JAMA Dermatol. 2024;160(1):71-79, PMID 38055239, verified 2026-08-19). Its guard states that eczema
  must **not** be inferred from psoriasis itself and that exposure to the implicated biologic is required.
- `atopic-dermatitis-eczema` holds a **qualified-human-verified** route, `atopic-dermatitis-eczema` → `asthma` at
  `IMMUNE_MEDIATED`, the **atopic march**, scoped to atopic dermatitis phenotypes (J Am Acad Dermatol.
  2022;86(2):365-372, PMID 34384834, verified 2026-09-02).
- **Paradoxical eczema is a drug-induced eczematous eruption and is not atopic dermatitis.** The two identities
  therefore carry two different disease routes, and no single merged identity can preserve both verified mappings:
  consolidating into `atopic-dermatitis-eczema` would assert that biologic therapy causes *atopic dermatitis*, a
  category error on a human-approved mapping; consolidating the other way would assert that eczema in general
  causes asthma, a widening beyond the atopic-dermatitis evidence. Preserving existing mappings was the governing
  constraint, so the request to merge was resolved as a **scope split** rather than a consolidation.
- **Scope boundary.** `eczema` owns the generic and iatrogenic eczematous eruptions including paradoxical eczema;
  `atopic-dermatitis-eczema` owns the atopic-disease route. No claim routed to either may be extended to the
  other's scope. Both knowledge-base files and both catalog entries carry the cross-reference so a reviewer
  encountering one name resolves to the other rather than to its scope.
- **Aliases tightened so the names resolve distinctly, not to one another's scope:** `eczema` gained
  `paradoxical eczema` and `drug-induced eczema`; `atopic-dermatitis-eczema` gained `atopic dermatitis`.
- **The reopening condition set in the `eczema` knowledge base is met**, and its record is that file's governance
  note: the earlier condition was "a condition-specific pathway with its own published evidence base distinct from
  the atopic-dermatitis literature", and the verified paradoxical-eczema biologic-registry route is exactly such a
  pathway. The batch-27 duplicate-scope deferral is therefore **closed**, not left pending.
- **Stable IDs unchanged, one-to-one catalog/KB integrity preserved, and the frozen identity contract is NOT
  moved.** No identity was added, retired, merged or renamed, so this is a bounded maintenance edit rather than a
  versioned identity migration, and saved workflow state is unaffected because the catalog fingerprint is
  unchanged.
- **Open follow-up, deliberately not resolved here:** the batch-80 *withholding* of `ptsd` → `eczema` and
  `anxiety-disorder` → `eczema` rested partly on this same identity-duplication premise. Those routes should be
  re-screened on their own evidence, but re-screening them is a new mapping task and not part of this disposition.

## Other physical-placement and grouped-identity debt

The endocrine and pulmonary-hypertension maintenance sequence has already corrected the major known cross-system physical placements without changing stable IDs. Any newly discovered cross-system placement, grouped identity, obsolete code, or over-broad alias must be handled as a separate bounded change with:

1. stable-ID preservation unless a versioned migration is explicitly designed;
2. current rating authority checked separately from medical evidence;
3. one-to-one catalog/KB integrity preserved;
4. regression coverage for the exact identity change; and
5. no inference that shared rating authority establishes shared etiology or secondary causation.

## v2 closure rule

The four named items above are **not open blockers to the current clinical evidence program** after these dispositions are recorded. They are controlled modeling states:

- laterality placeholder quarantined;
- historical micro-TBI label quarantined as draft;
- cerebral-palsy recognition identity retained without service-connection inference;
- eczema / atopic-dermatitis-eczema retained as two distinct identities under an explicit scope split, with the
  identity-duplication finding retracted.

A future catalog-v3 identity migration may retire or consolidate these IDs, but v2 should not violate 300/300 or silently rewrite stable identity history to make the debt list appear empty.
