# CRG batch-5 nexus registration — deferral record (2026-10-11)

Status: **DEFERRED, not rejected.** The authored content is preserved; the live
corpus mutation was withdrawn.

PR #520 bundled a Concept 1 creative deliverable set together with an attempt to
register two batch-5 CRG nexus rows. The deliverables are inert and land
unchanged. The registration half broke the required `verify` gate and was
withdrawn from the live corpus, because completing it would have required
decisions this repository reserves for a qualified human.

## What was attempted

`scripts/register-crg-nexus-batch5.mjs` wrote two rows into the authored corpus:

- Row A — `degenerative-disc-disease` → `radiculopathy`: reclassified from
  `ASSOCIATION_ONLY` to `DIRECT_CAUSATION`, evidentiary tier moved to
  `WELL_ESTABLISHED`, rationale rewritten, evidence gaps replaced, one source
  reference added.
- Row B — `traumatic-brain-injury-residuals` → `seizure-disorder`: a new rank-2
  `DIRECT_CAUSATION` edge with three unverified source references.

It also wrote two adjacency nodes under `data/knowledge-base/graph/`.

## Why it failed

The script writes the corpus and the graph but never writes the authoritative
registries, `data/evidence/master-relationships.json` and
`data/evidence/master-sources.json`. `scripts/audit-master-registry.js` enforces
byte-exact lockstep between the authored suggestions and those registries, so
writing one side fails the gate. Because roughly 135 test files invoke the
registry and citation audits through a live-audit helper or pin the same counts,
the single authoring omission surfaced as 137 failing tests rather than as one
clear error.

Four distinct defects were identified:

1. **Registry lockstep omission.** The corpus carried one more suggestion than
   the registry carried rows, and Row A's registry rationale no longer matched
   the corpus.
2. **Verified-citation demotion.** The script hardcoded `verified: false` for
   PMID 34402323, which is already qualified-human verified in
   `data/evidence/master-sources.json` (status active, decision
   approve-as-implemented, reviewed 2026-08-22), and it moved `sourceCheckedOn`
   off the recorded review date. This regressed verified provenance and tripped
   the citation-debt ratchet in `scripts/audit-citation-verification.js`. The
   reference object must stay byte-identical to the verified snapshot or the
   source's `rawReferenceHashes` no longer match.
3. **Unregistrable source entities.** PMIDs 32281018, 9414327 and 41686304 have
   no source entity. PMID 19233461 exists only as a `superseded-unverified`
   `clinical-evidence-lineage` record, superseded by PMID 33687971 on
   `rel-skull-fracture-non-basilar-and-basal-to-epilepsy`. No lineage record in
   the registry currently carries a live use, so citing it live would require an
   unprecedented reactivation. The staging manifest already records this exact
   concern as a `REGISTRY_IDENTIFIER_MATCH` hold.
4. **Promotion of staging-only content.** The proposals live in
   `docs/crg-staging-2026-10-06/`, whose manifest is marked
   `STAGING_ONLY_NOT_PUBLISHABLE` with zero proposals publication-ready and a
   `QUALIFIED_REVIEW_REQUIRED` hold on every one. Row A has no staged proposal
   at all, and its registry row records
   `publicationGuard.semanticRewriteAuthorized: false` against
   `boundarySource: approved-me13-implementation-scope` — so the semantic
   rewrite is not authorized by the current registry state. Row B also diverges
   from its staged plan, which records a different rank.

## What was changed

- `data/knowledge-base/degenerative-disc-disease.json` and
  `data/knowledge-base/traumatic-brain-injury-residuals.json` restored to their
  authoritative state.
- The two live adjacency nodes under `data/knowledge-base/graph/` removed. The
  staged copies remain at `docs/crg-staging-2026-10-06/graph/` and still match
  the manifest hashes.
- `scripts/register-crg-nexus-batch5.mjs` corrected and hardened:
  - the verified-citation demotion is fixed, preserving `verified: true` and the
    recorded `sourceCheckedOn` date for PMID 34402323;
  - a registry lockstep authorization gate now runs before any write and refuses
    to proceed until the registries, the staging holds and the semantic-rewrite
    authorization are all in place, printing every blocker instead of
    half-writing the contract;
  - the header no longer claims registry lockstep it does not implement.

All Concept 1 deliverables, `merge-plan-duplicate-concepts.md`,
`docs/crg-secondary-nexus-expansion-2026-10-06.json` and the registration script
land unchanged in intent.

## What remains, to land batch-5 properly

Per `docs/catalog-identity-migration-design-2026-09-29.md` §6, the registries
move only when a route is authored, and the move must be synchronized. Landing
these rows therefore requires one coordinated change that:

1. Records a qualified-human decision clearing the staging holds for each row,
   including the `REGISTRY_IDENTIFIER_MATCH` hold on PMID 19233461 and the
   semantic-rewrite authorization for Row A, and reconciles Row B's rank with
   its staged rank.
2. Resolves the `epilepsy` / `seizure-disorder` catalog-identity question that
   `merge-plan-duplicate-concepts.md` leaves open, since Row B targets the draft
   `seizure-disorder` identity.
3. Authors the registry side in the same commit: the relationship rows
   (direction, rank, rationale, `clinicalProposition.text` equal to the
   rationale, `publicationGuard`, `evidenceGaps`, ordered `sourceIds`,
   `sourceReferenceCount`, `suggestionObjectHash`) and the source entities
   (`liveUses`, `liveUsageCount`, `rawReferenceHashes`, and the counts block).
4. Decides the source-status disposition for PMID 19233461 — reactivate the
   lineage record, or substitute an anchor that does not require reactivation.
5. Moves the ratchets deliberately in `scripts/audit-master-registry.js` and
   `scripts/audit-citation-verification.js`, and the pinned counts in the
   affected tests. Each pin move is a governed act, not a way to make a failure
   disappear.
6. Clears `node scripts/preflight-source-status.js` with zero blocking flags,
   then runs `npm run citations:queue` and `npm run authoring:tracker`.

Until those are done, `node scripts/register-crg-nexus-batch5.mjs` exits non-zero
and writes nothing. That is the intended behaviour.

