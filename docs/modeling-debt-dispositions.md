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

## Identity-closure adjudication 2026-09-28 — the three closures (`eczema`, `rotator-cuff-tear`, `skier-s-thumb`)

**Disposition: the three identity closures are adjudicated together, and only one of the three was a true
duplication.** Batches 80, 82 and 84 each closed a knowledge-base identity on `IDENTITY-DUPLICATION` — the
catalog "coarser than the evidence" pattern — and the batch-84 record grouped them as "three duplications in
five batches". Applying the durable lesson recorded in the `eczema` disposition above (read the registered
edges and the catalog names before closing an identity) separates the trio into three different outcomes:

- **`eczema` / `atopic-dermatitis-eczema` — NOT duplication; scope split.** Already adjudicated in the
  `eczema` section above and in the 2026-09-28 identity review: the two identities carry
  qualified-human-verified routes about different diseases, the duplication premise is retracted, and both
  identities are retained. No further action.
- **`rotator-cuff-tear` / `rotator-cuff-injury` — NOT duplication; the corrected framing is UMBRELLA /
  MEMBER.** The batch-82 closure called them "open identities for the same disease", but the catalog itself
  says otherwise: `rotator-cuff-injury` is named **"Rotator Cuff Tendonitis / Tear"** and carries the alias
  `rotator cuff tendonitis` — it is the umbrella over the tendinopathy/tear spectrum — while
  `rotator-cuff-tear` is the **tear member** of that umbrella. An umbrella and its member are not two names
  for one disease; they are two granularities, the same shape as the `sinusitis` umbrella disposition and
  the batch-78 class-umbrella screens. The umbrella/member discipline therefore applies unchanged:
  - the umbrella keeps the general rotator-cuff window, and its registered
    `bicipital-tendinitis` → `rotator-cuff-injury` edge (batch 4) is left untouched;
  - the member owns tear-specific windows only; and
  - **no edge may be registered between an umbrella and its own member** (the batch-86
    `soft-tissue-sarcomas` umbrella guard).
  **Consequently the batch-82 closure is vacated, not merely re-described.** The reconciliation question it
  posed — obtain a qualified-human decision on which rotator-cuff identity is canonical — is malformed under
  the corrected framing: there is no canonical-singleton choice to make, because both identities are
  legitimate at their own granularity. `rotator-cuff-tear` returns to ordinary safe-draft status (still zero
  suggestions; authoring still requires condition-specific evidence inside tear scope), and the correction
  is annotated on the file per the superseded-annotation discipline. Nothing here moves the frozen identity
  contract: no identity was added, retired, merged or renamed.
  **Alias hazard fixed and scope recorded on both entries (2026-09-28):** the umbrella's bare alias `tear`,
  which resolved every tear in the catalog to one entry, was removed (the scoped alias
  `rotator cuff tendonitis` is retained), and both catalog entries now carry the umbrella/member scope note —
  the member owns tear-specific windows, the umbrella owns the general window, no edge may run between
  umbrella and member, and the shared 38 CFR 4.71a rating framework establishes neither shared etiology nor
  secondary causation. Regression coverage for the exact identity change lives in
  `tests/rotator-cuff-umbrella-scope.test.ts`.
- **`skier-s-thumb` / `gamekeeper-s-thumb` — GENUINE duplication; the closure stands.** This is the one true
  duplication of the trio: the located literature reviews thumb metacarpophalangeal collateral-ligament
  injuries as a single injury category and distinguishes the two names only by **mechanism of injury**
  (ski-pole-grip valgus versus forced abduction), not by lesion, and both names sit in the same catalog file
  under the same 38 CFR 4.71a framework. The closure remains deliberately reversible: electing a canonical
  name retires a stable ID and is therefore a **versioned identity migration**, not a bounded maintenance
  edit (see the v2 closure rule below).

**The corrected rule of the trio.** What batches 80/82/84 read as "three duplications" was actually three
different phenomena: a scope split hiding behind synonymy (`eczema`), an umbrella/member pair hiding behind
shared naming (`rotator-cuff-tear` / `rotator-cuff-injury`), and one genuine synonymy (`skier-s-thumb` /
`gamekeeper-s-thumb`). Name-level similarity is a poor predictor of entity-level duplication. Do not close
an identity on name-level evidence: read the catalog names, the aliases, and the registered edges first,
and record umbrella/member and scope-split outcomes as scope discipline rather than as closures.

## Other physical-placement and grouped-identity debt

The endocrine and pulmonary-hypertension maintenance sequence has already corrected the major known cross-system physical placements without changing stable IDs. Any newly discovered cross-system placement, grouped identity, obsolete code, or over-broad alias must be handled as a separate bounded change with:

1. stable-ID preservation unless a versioned migration is explicitly designed;
2. current rating authority checked separately from medical evidence;
3. one-to-one catalog/KB integrity preserved;
4. regression coverage for the exact identity change; and
5. no inference that shared rating authority establishes shared etiology or secondary causation.

## v2 closure rule

The five named items above are **not open blockers to the current clinical evidence program** after these dispositions are recorded. They are controlled modeling states:

- laterality placeholder quarantined;
- historical micro-TBI label quarantined as draft;
- cerebral-palsy recognition identity retained without service-connection inference;
- eczema / atopic-dermatitis-eczema retained as two distinct identities under an explicit scope split, with the
  identity-duplication finding retracted;
- the three identity closures adjudicated: `eczema` resolved as above, `rotator-cuff-tear` /
  `rotator-cuff-injury` corrected to umbrella/member with the member's duplication closure vacated, and
  `skier-s-thumb` / `gamekeeper-s-thumb` kept closed as the one genuine duplication pending a versioned
  canonical-name migration.

A future catalog-v3 identity migration may retire or consolidate these IDs, but v2 should not violate 300/300 or silently rewrite stable identity history to make the debt list appear empty.
