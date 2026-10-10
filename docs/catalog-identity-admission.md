# Reviewed catalog-identity admission

## Authority boundary

This path creates a review record or a validated **isolated candidate**, never a
live catalog write. A successful check is not an owner decision, clinical/legal
approval, publication approval or citation verification.

The owner chose **process + pending proposal** for `chronic-pain` on 2026-10-09.
The live universe remains 819 catalog identities and 819 matching KB files.
The six REL-01 archived files and their manifest hashes remain unchanged. The
prior decision not to re-root to `unexplained-chronic-pain` remains in force.

- [Pending proposal](catalog-admissions/chronic-pain-proposal-v1.json)
- [Current pending decision](catalog-admissions/chronic-pain-review-2026-10-10/owner-decision.json)
- [Current preflight record](catalog-admissions/chronic-pain-review-2026-10-10/admission-report.json)
- [Historical pending review](catalog-admissions/chronic-pain-review-v2/admission-report.json) (preserved, not reusable against the current baseline)
- [CLI and strict schemas](../scripts/catalog-identity-admission.ts)
- [End-to-end regression tests](../tests/catalog-identity-admission.test.ts)

### Baseline refresh — 2026-10-10

The [registered-baseline reconciliation](clinical-baseline-reconciliation-2026-10-10/README.md)
changed the full-data hash. The CLI generated a **new pending review**, without
an approval file, against those reconciled inputs. The proposal is byte-identical,
the live catalog remains 819, and no candidate `data/` directory was created.
The historical v2 record is unchanged; its stale baseline binding is correctly
refused. This refresh does not admit `chronic-pain`, restore an archive, publish
a mapping or verify a citation.

## 1. Propose a distinct identity

Use a versioned JSON proposal under `docs/`. Format version 1 requires:

- `proposalId`: stable kebab-case proposal identity;
- `condition`: the actual strict `catalogConditionSchema` object (id, name,
  aliases, bodySystem, ratingSchedule, reviewNotes);
- `scope`: explicit `definition`, `ratingRationale`, and a nonempty
  `distinctFrom` list of existing catalog IDs with authored rationales;
- `restore`: the quarantine manifest path, selected archival path and SHA-256.

Use only unambiguous names and aliases. All lookup tokens (id, spaced id,
name, aliases) are checked against existing identities. An addition cannot
capture an existing alias, rename a root or elect a target by guesswork.

For a broad construct with no defensible supplied rating authority, an empty
rating list is more truthful than an invented diagnostic code. The owner must
resolve rating scope and body-system placement. Rating references must remain
`verified: false`; no automatic rating verification is performed.

The `chronic-pain` proposal deliberately leaves the identity's suitability,
body-system placement and rating scope open. Its proposed treatment context is
not an exclusion-based unexplained-pain diagnosis or a synonym for fibromyalgia.
The broad treatment-context label may itself be rejected by the owner; passing
a schema does not answer that product/medical question.

## 2. Record pending preflight

```bash
npm run catalog:admission -- \
  --proposal=docs/catalog-admissions/chronic-pain-proposal-v1.json \
  --out=docs/catalog-admissions/chronic-pain-next-review
```

Output must be a **fresh** directory under `docs/`. Existing artifacts, live
outputs, path traversal and symlink-mediated reads/writes are refused.
Preflight parses the live catalog/KB/graph through the shared strict schemas,
checks one-to-one identity presence, validates target references, pointer guards
and authored graph evidence joins, then checks the new lookup identity and the
selected archive's hash, byte length, root and draft state.

It writes `proposal.json`, `owner-decision.json` and `admission-report.json`.
Without an explicit decision it records `outcome: "pending"` and
`status: "PENDING_OWNER_DECISION"`. **No candidate data is produced.** Exit 0
here means the review record was generated, not that an identity was admitted.
The `counts.after` field is the projected candidate count, not the live count.

## 3. Owner review and decision

Review the exact proposal and archive, especially diagnostic scope,
distinctions, rating authority/placement, and all clinical framing that would
return as a draft. Do not sign the current proposal without resolving its open
questions. If the proposal changes, regenerate preflight before signing.

Create an owner-decision JSON file under `docs/`. Copy `formatVersion`,
`proposalId`, `proposalSha256`, and `baselineSha256` from the generated pending
record. The hashes bind the decision to the exact proposal bytes and the entire
current `data/` snapshot (including the archive). Any change requires a new
review rather than silently reusing stale approval.

An approved decision additionally requires:

- `outcome: "approved"`;
- the actual `owner` name/handle, ISO `decidedOn`, `decisionReference` to the
  real approval conversation/review, and an authored `rationale`;
- `scope: "identity-and-draft-restoration-only"`;
- `confirmations` containing four explicit `true` values:
  `distinctIdentityReviewed`, `ratingScopeReviewed`,
  `unchangedDraftRestorationReviewed`, `noPublicationOrCitationVerification`.

No owner name or approval reference is fabricated by the tool. Pending records
have no approver. A rejected decision records the same binding, real owner,
date, reference and rationale with `outcome: "rejected"`, and produces no data.
The strict discriminated schema refuses absent confirmations, extra fields,
blank identities, future approval dates and unrelated decision scope.

**Trust model:** these are auditable owner attestations, not signed credentials.
A JSON file alone cannot authenticate an approver. Reviewed PR provenance and
owner review establish authority; do not treat a fabricated decision file as
permission. Test approvals are explicitly synthetic, live only in disposable
test roots, and do not authorize `chronic-pain` admission.

## 4. Validate the approved candidate

```bash
npm run catalog:admission -- \
  --proposal=docs/catalog-admissions/chronic-pain-proposal-v1.json \
  --decision=docs/catalog-admissions/chronic-pain-owner-decision.json \
  --out=docs/catalog-admissions/chronic-pain-approved-candidate
```

This command is available for a **future real approval**, not authorized by
the current pending decision. It creates a full isolated data snapshot and:

1. Adds `data/conditions/admission-<id>.json` with exactly one catalog entry.
2. Adds `data/knowledge-base/<id>.json` using the original archival bytes.
   Published mappings, pointer records and adjacency copies cannot be restored.
3. Runs shared schema, referential, pointer, copy and graph-evidence validation.
4. Runs the real KB validator and client-corpus generator against the candidate.
5. Proves every pre-existing data hash is unchanged; the candidate has only the
   two additions; the catalog exposes the identity; the restored draft is absent
   from `publishedMappings`; and the graph is unchanged.

A successful result is `VALIDATED_DRAFT_CANDIDATE_NOT_LANDED`, with captured
`kb-validator.log`, `client-corpus.log`, `admission-report.json`, and
`candidate-files.json` containing output hashes and the generated corpus hash.
Failed validation returns nonzero, records `VALIDATION_FAILED_NOT_LANDED`, and
leaves its candidate for diagnosis. Never use a failed candidate for landing.

A candidate contains archival material for verification. It is **not a
publishable deployment directory** and must not be uploaded wholesale.
The tool adds no graph node and does not change any `verified` flag, draft
status, probability label, source registry or clinical claim text. The NSAID
edge's original probability framing and citation debt still require independent
clinical/legal and qualified-human citation review.

## 5. Reviewed landing and later publication

After real owner approval and candidate validation, use a reviewed PR to land
only the two additions together with the versioned identity migration record.
Do not simply copy the archive to live data before the catalog exists.
Coordinate the 819-to-new-count pins, coverage ledger, current-state documents,
and any saved-state/alias compatibility implications; the tool never rewrites
historical contracts or loosens pinned tests automatically.

Run the full suite, `npm run kb:validate`, citation audits,
`npm run build:client-corpus`, production build and deployment-artifact checks
on the landing commit. A candidate's limited admission checks do not replace
those checks. Regenerate if the baseline changes before landing.

Publication remains a **separate** review. Draft restoration cannot establish
an individual medical nexus, mark citations verified, publish the mapping or
activate a new graph route. The current five-route graph remains unchanged.
