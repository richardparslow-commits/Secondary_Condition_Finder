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

## Canonical-identity reconciliation 2026-09-28 — the rotator-cuff and thumb pairs (pointer reconciliation, frozen contract unmoved)

**Disposition: one canonical identity per pair, the non-canonical identity reconciled to it as a quarantined
pointer record, and every registered edge and its sources preserved exactly.** This executes the
canonical-choice decision the batch-82 and batch-84 closures deferred ("obtain a qualified-human decision on
which rotator-cuff identity is canonical"):

- **`rotator-cuff-injury` is canonical for the rotator-cuff pair.** It holds both registered incoming edges
  (`rel-bicipital-tendinitis-to-rotator-cuff-injury`, batch 4, Braun PMID 21335355 and Sethi PMID 10633904;
  `rel-slap-tear-to-rotator-cuff-injury`, batch 85), and re-homing either to a tear-specific identity would
  change its clinical meaning — bicipital tendinitis and slap tears associate with cuff injury generally,
  not with one lesion subtype. Its catalog name ("Rotator Cuff Tendonitis / Tear") already covers the member
  concept, so routing tear claims into it loses nothing. `rotator-cuff-tear` becomes a **quarantined pointer
  record**; the umbrella/member framing recorded above stands as the pair's relationship and is superseded
  only as to authorship location (tear claims are authored under the canonical entry). The variant name
  `rotator cuff tear` stays on the pointer entry's own catalog name — the catalog invariant pinned by
  `tests/catalog.test.ts` forbids an alias colliding with another condition's name or id — so folding it
  into the canonical entry becomes available only if a future catalog-v3 migration retires the pointer ID.
- **`gamekeeper-s-thumb` is canonical for the thumb pair.** It holds the registered
  `rel-gamekeeper-s-thumb-to-osteoarthritis` edge (batch 36) with its three registered sources, whose
  chronic-instability meaning would change if re-homed; and the located review chapter that merges the pair
  is titled for Gamekeeper's Thumb. `skier-s-thumb` becomes a **quarantined pointer record** carrying its
  preserved unregistered evidence intact (the StatPearls chapter, the collateral-ligament review, and the
  repair and outcomes studies), which may support exactly one future authoring pass under the canonical
  entry. The two names denote one lesion, distinguished in the located literature only by mechanism of
  injury (ski-pole-grip valgus versus forced abduction); the mechanism is a documented feature of the
  canonical identity, not a second identity. The variant name `skier's thumb` stays on the pointer entry's
  own catalog name under the same catalog invariant, and folds into the canonical entry only with a future
  catalog-v3 retirement.

**Preservation guarantee.** Zero registry rows moved. `rel-bicipital-tendinitis-to-rotator-cuff-injury`
(two source uses), `rel-slap-tear-to-rotator-cuff-injury` (three source uses),
`rel-slap-tear-to-shoulder-condition` and `rel-gamekeeper-s-thumb-to-osteoarthritis` (three source uses)
keep their exact relationship objects, hash forms and registered sources. The batch-36 guard wording about a
separate acute skier-s-thumb pathway is annotated superseded at file level while the registered suggestion
text is deliberately untouched. `tests/canonical-identity-reconciliation.test.ts` pins the canonical
elections, the pointer states and the preserved relationships.

**Why pointers rather than deletion.** Deleting or merging either pointer identity would move the frozen
one-to-one identity contract and require a versioned identity migration; per the governing principle of this
document, the stable IDs are preserved as quarantined pointer records instead — the same end state as the
`contralateral-knee-condition` quarantine. Each pointer entry is the name-level resolution record for its
variant name while the pointers exist (the catalog invariant keeps variant names on their own entries), and
a future catalog-v3 migration may retire the pointer IDs and fold the variant names into the canonical
entries as aliases.

**The pointer's preserved-evidence record is complete (2026-09-28).** The `skier-s-thumb` pointer's
preserved-unregistered inventory has been resolved to PubMed-verified PMIDs so that a future reopening needs
no re-search: the chapter titled for Gamekeeper's Thumb (PMID 29494005, which on its own face states the
condition "has also been referred to as skier's thumb since it is more commonly observed in individuals who
fall while holding ski poles, which mechanistically causes the same type of hyperextension thumb injury"),
the single-injury-category reviews (PMIDs 20215892, 8623701, 24590986), the prospective surgical-repair
series (PMIDs 24126337, 24185690, 37294237), the long-term primary-repair outcomes (PMIDs 27117126,
23615487, 38488512), and the avulsion-fragment morphologic studies behind the recorded avulsion-fracture
catalog gap (PMIDs 9922540, 10194010). Because the batch-84 item descriptions are prose rather than verbatim
titles, each item is resolved to a **verified candidate set** with the matching quotation or design feature
stated on the record, so the future author chooses on each source's own content instead of on the paraphrase.
**All twelve PMIDs remain unregistered**, confirmed absent from `data/evidence/master-sources.json` on
2026-09-28, per the ME-29 reserved-evidence rule: zero source entities, reference uses and registry rows were
created, every count pin is unchanged, and the inventory may be drawn on only inside the one future
authoring pass under the canonical entry, which must adjudicate those PMIDs explicitly.
`tests/canonical-identity-reconciliation.test.ts` pins the completed inventory and its unregistered state.

## Dermatitis composite-scope adjudication 2026-09-28 — `dermatitis` audited against the eczema scope split (three atopic-evidence edges superseded, two infection edges retained)

**Disposition: the composite identity `dermatitis` ("Dermatitis (Atopic / Contact)") may hold subtype-agnostic
dermatitis windows only. Its three atopic-evidence edges (`insomnia`, `depressive-disorder`, `anxiety-disorder`)
are superseded as claim windows and preserved as registered records; its two infection edges (`cellulitis`,
`impetigo`) are retained as its live generic windows.** This applies the 2026-09-28 `eczema` /
`atopic-dermatitis-eczema` scope split to the third identity in the skin family:

- **The composite and its two named halves.** `dermatitis` is named for two halves ("Atopic / Contact"), and
  after the scope split each half is carried by a more specific sibling: the atopic half by
  `atopic-dermatitis-eczema`, the owner of the atopic-disease route; the contact half by `contact-dermatitis`.
  A composite whose named halves are each carried by a sibling keeps only what neither sibling carries: the
  subtype-agnostic dermatitis windows.
- **The five edges divide by evidence class, not by name.**
  - `dermatitis → insomnia` (rank 1), `→ depressive-disorder` (rank 4), `→ anxiety-disorder` (rank 5) are
    **ATOPIC-EVIDENCE EDGES**: every quantified anchor is an adult atopic-dermatitis population — Bawany 2021
    AD sleep review (PMID 33321263), Silverberg 2022 US AD sleep survey n=2,893 (PMID 33675326), Fasseeh 2022
    AD burden systematic review (PMID 36197589), Mann 2020 urticaria-and-AD ISI flare pilot (PMID 32016441).
  - `dermatitis → cellulitis` (rank 2) and `→ impetigo` (rank 3) are **NOT atopic-evidence**: their anchors
    (Cranendonk 2017 cellulitis pathophysiology review, Moses 2003 pruritus review, Hartman-Adams 2014
    impetigo review) are subtype-agnostic barrier, pruritus and superinfection reviews, so both edges remain
    this identity's live generic windows.
- **Why the three edges are superseded rather than re-scoped (claim unreachability).** The batch-20
  generic-identity guard ("individual-level attribution must anchor to the patient's specific subtype"), read
  against the split, exhausts their claim contexts: if the documented diagnosis is atopic dermatitis, the
  claim resolves to `atopic-dermatitis-eczema`, which owns the atopic route; if it is contact, stasis,
  nummular or unspecified dermatitis, the adult-AD anchors do not reach it. Keeping the three edges live
  under the composite would either double-route the atopic sleep/mood window across two identities or
  end-run the split's ownership rule through the composite's name.
- **Preservation guarantee.** Zero registry rows moved. The five `rel-dermatitis-to-*` relationships keep
  their exact relationship objects, hash forms and registered sources — `rel-dermatitis-to-insomnia` (three
  source uses), `rel-dermatitis-to-cellulitis` (two), `rel-dermatitis-to-impetigo` (three),
  `rel-dermatitis-to-depressive-disorder` (three), `rel-dermatitis-to-anxiety-disorder` (two) — and the
  registered suggestion text is deliberately untouched (batch-36 discipline). Supersession is
  annotation-level: the disposition is recorded in `data/knowledge-base/dermatitis.json` and the batch-20
  todos and governance notes are annotated, not rewritten.
- **The duplicate-scope tension on the cellulitis target is recorded, not resolved by deletion.**
  `rel-dermatitis-to-cellulitis` and `rel-contact-dermatitis-to-cellulitis` are parallel windows onto one
  target from a composite identity and its contact member; both stand, one-window-per-claim applies, and a
  claim routes through exactly one of them chosen by the documented diagnosis. The cellulitis and impetigo
  edges of the composite also share their Moses 2003 and Cranendonk 2017 anchors and are one evidence set,
  not independent confirmation of two separate pathways.
- **Superseded as to atopic-evidence scope only.** The batch-27 duplicate-scope record and the 2026-09-28
  route re-screen statement that `dermatitis` "already owns the correctly-directed window" (`dermatitis →
  anxiety-disorder`, `→ depressive-disorder`, `→ insomnia`) are superseded as to **window ownership only**:
  the correctly-directed atopic psychiatric-morbidity and sleep window belongs to `atopic-dermatitis-eczema`.
  The withholdings those statements support (`ptsd → eczema`, `anxiety-disorder → eczema`) stand unchanged on
  their own evidence grounds and are **not** reopened. Correspondingly, the `atopic-dermatitis-eczema`
  governance note refusing duplicate-scope restatements of "the dermatitis → insomnia ... or mood routes" is
  superseded as to the insomnia and mood targets only: exactly one future authoring pass under that identity
  may register the atopic sleep/mood window after explicit ME-29 adjudication of the preserved composite-side
  records and their PMIDs; its cellulitis/impetigo duplicate-scope refusal stands.
- **Alias hazard fixed (bare-`tear`-alias precedent).** The composite carried the bare aliases `atopic` and
  `contact`, which resolved sibling-owned disease words into the composite — the same hazard class as the
  bare `tear` alias removed in the umbrella/member adjudication. Both are removed; the bare generic alias
  `dermatitis` is self-scoped and remains. `tests/dermatitis-composite-scope.test.ts` pins the alias set, the
  per-edge evidence-class dispositions, the supersession annotations at the siblings, and the preserved
  five relationships with their registered source uses.
- Nothing here moves the frozen identity contract: no identity was added, retired, merged or renamed.

## Other physical-placement and grouped-identity debt

The endocrine and pulmonary-hypertension maintenance sequence has already corrected the major known cross-system physical placements without changing stable IDs. Any newly discovered cross-system placement, grouped identity, obsolete code, or over-broad alias must be handled as a separate bounded change with:

1. stable-ID preservation unless a versioned migration is explicitly designed;
2. current rating authority checked separately from medical evidence;
3. one-to-one catalog/KB integrity preserved;
4. regression coverage for the exact identity change; and
5. no inference that shared rating authority establishes shared etiology or secondary causation.

## v2 closure rule

The six named items above are **not open blockers to the current clinical evidence program** after these dispositions are recorded. They are controlled modeling states:

- laterality placeholder quarantined;
- historical micro-TBI label quarantined as draft;
- cerebral-palsy recognition identity retained without service-connection inference;
- eczema / atopic-dermatitis-eczema retained as two distinct identities under an explicit scope split, with the
  identity-duplication finding retracted;
- the three identity closures adjudicated and reconciled: `eczema` resolved as above, `rotator-cuff-tear` /
  `rotator-cuff-injury` corrected to umbrella/member with the member's duplication closure vacated, and
  `skier-s-thumb` / `gamekeeper-s-thumb` kept as the one genuine duplication — both pairs since reconciled
  to canonical identities (`rotator-cuff-injury`, `gamekeeper-s-thumb`) with the non-canonical identities
  retained as quarantined pointer records;
- `dermatitis` audited against the eczema scope split and dispositioned as a composite identity: its three
  atopic-evidence edges superseded as claim windows and preserved as registered records (the correctly-
  directed atopic psychiatric-morbidity and sleep window is owned by `atopic-dermatitis-eczema`), its two
  infection edges retained as subtype-agnostic windows, and the bare `atopic`/`contact` alias hazard
  removed.

## Batch 91 corpus-review dispositions (2026-09-29) — held-edge pointers for published mappings

The schema forbids todos on published mappings ("Resolve every todo before publishing, or keep the
mapping draft: true"), so the batch-91 dispositions that would otherwise sit in the affected files are
recorded here and in the held artifacts instead:

- `hypothyroidism` to `depressive-disorder` — FULLY AUTHORED AND HELD
  (`docs/batch-91-hypothyroidism-depressive-disorder-held-edge.json`, PMIDs 34524390, 31214119,
  30375372): overt-stronger-than-subclinical gradient, female-only post hoc signal with male null,
  the two subclinical meta-analyses in direct conflict, and the levothyroxine-treatment null.
- `diabetes-mellitus-type-2` to `depressive-disorder` — FULLY AUTHORED AND HELD
  (`docs/batch-91-diabetes-mellitus-type-2-depressive-disorder-held-edge.json`, PMIDs 19033418,
  11375373): the claimed direction is the weaker half of a bidirectional association (RR 1.15 versus
  reverse RR 1.60), and a published critique of the primary anchor is a landing precondition.
- `ptsd` to `bruxism-awake-sleep` — FULLY AUTHORED AND HELD
  (`docs/batch-91-ptsd-bruxism-awake-sleep-held-edge.json`, PMIDs 38363350, 36056716, 32577706):
  awake-bruxism-only adjusted evidence (OR 3.38) with a sleep-bruxism null in the same model, an
  erratum-linked industry-conflicted prevalence anchor, and the ME-34 TMJ boundary honored. The
  `ptsd` to `chronic-liver-disease` corpus route is separately WITHHELD as an intermediate-step
  self-medication chain (PMID 30080255 preserved under ME-29; `alcohol-use-disorder` identity
  missing; the registered `ptsd` to `substance-use-disorder` edge already opens the chain).
- `discoid-lupus` to `persistent-depressive-disorder` — FULLY AUTHORED AND HELD
  (`docs/batch-91-discoid-lupus-persistent-depressive-disorder-held-edge.json`, PMIDs 41849118,
  30877492, 35953237): NO anchor diagnoses persistent depressive disorder (phenotype boundary),
  psychosocial determinants dominate the cohort models, and re-targeting at `depressive-disorder`
  is an open reviewer decision.
- `anxiety-disorder` to `migraine-headaches` — UNRESOLVED-DIRECTION GAP: the located prospective
  literature runs migraine-to-anxiety; nothing registered in either direction (recorded on the
  draft file's todo as well).
- The `liver-cancer` sarcopenia lead is MISSING-IDENTITY blocked (`sarcopenia` absent); see
  `docs/missing-identity-addition-roadmap.md`.


A future catalog-v3 identity migration may retire or consolidate these IDs, but v2 should not violate 300/300 or silently rewrite stable identity history to make the debt list appear empty.
