# Phase 1 Product Specification

Status: draft for review
Scope: Phase 1 only. See `docs/phase-plan.md` for Phases 2 and 3.

## Problem

A veteran service connected for one condition often has no practical way to
learn which related conditions are commonly considered alongside it, or what
evidence a secondary claim would need. That knowledge sits with experienced
representatives and is unevenly distributed.

## Users

- Veterans researching their own claims
- Accredited representatives and VSO staff
- Claim-preparation support staff

## What Phase 1 does

Two research paths, chosen at `/` because they need different evidence.

**Secondary track.** Given one or more service-connected primary conditions,
returns ranked **possible secondary conditions to explore**, each with
reasoning, the evidence a claim on that theory typically needs, and citations
to verify.

**Presumptive track.** Given where and when someone served, returns the
exposure presumptions that may apply and the conditions each covers. See
`docs/presumptive-track.md`.

## What Phase 1 explicitly does not do

- Diagnose, or suggest that any condition is present
- Estimate approval likelihood, ratings, or compensation
- Connect to live VA systems or read a veteran's records
- Store personally identifying information
- Generate or file claim forms

## Functional requirements

### FR-1 Intake

- Users select one or more primary conditions from the knowledge base.
- Optional free-text fields: symptoms, medications, exposures, notes.
- Submission is blocked until at least one primary condition is selected.
- Optional fields influence display only, never ranking. Inferring clinical
  significance from a symptom list would be diagnostic behavior.

### FR-2 Recommendations

Each suggestion shows:

- Condition name
- A qualitative prevalence band: commonly, sometimes, or occasionally explored.
  Never a number, never a percentage.
- Rationale, attributed to each contributing primary condition
- Evidence gaps: what a claim on this theory typically still needs
- Source references, each flagged verified or unverified

Ordering: rank 1 contributes 1.0, rank 2 contributes 0.5, rank n contributes
1/n. Contributions from multiple primaries add, so a suggestion supported by
two conditions outranks a single-source suggestion at the same rank. Ties break
alphabetically. The score is an ordering heuristic and is never displayed.

### FR-3 Multiple primaries

- Suggestions shared across primaries merge on `conditionId`, combining
  rationale, evidence gaps, and citations.
- A condition the user already listed as primary is never suggested as a
  secondary of another primary.
- Duplicate or differently-cased entries for the same condition collapse.

### FR-4 Unmapped and unrecognized conditions

Three outcomes, reported separately, because they mean different things.

- **Mapped**: the condition is in the catalog and has authored research.
- **Unmapped**: the condition is in the catalog but nobody has written its
  secondary research yet. Named explicitly, with a note that absence implies
  nothing about whether a claim is possible.
- **Unrecognized**: the input matched nothing in the catalog.

Additional rules:

- Conditions absent from the catalog are listed back to the user
  explicitly.
- The message states that absence implies nothing about whether a claim is
  possible.
- Lookup is exact match against id, name, and aliases. No fuzzy matching:
  silently resolving "knee" to the wrong entry is worse than returning nothing.

### FR-5 Disclaimers

- A banner appears on intake and results.
- A footer on every page notes that suggestions are not ranked by approval
  likelihood and that citations are unverified starting points.
- Unverified citations carry an inline badge.

### FR-6 Demo scenarios

Three runnable scenarios in `data/demo-scenarios.json`: a single primary, two
primaries with an overlapping suggestion, and a partially recognized intake. A
test asserts each runs end to end.

### FR-7 Presumptive matching

- Users select service locations and optionally a service date range.
- Matching is exact on location and inclusive on date boundaries.
- Omitted dates produce a match on location alone, flagged explicitly in the UI.
- Unmatched locations are reported back with a note that a claim is still
  possible with supporting evidence.
- Categories out of scope are named on the results screen so the list does not
  read as exhaustive.
- Every category carries source URLs and a `sourceCheckedOn` date.

### FR-8 Draft conditions

- A condition may ship as `draft: true` with an empty `suggestions` array and a
  non-empty `todo` checklist.
- Drafts are validated and version controlled but never resolvable through
  lookup and never listed in the UI.
- Schema rejects a published entry with no suggestions, and rejects a published
  entry with an unresolved todo.

### FR-9 Event logging

Each run records a UUID, timestamp, resolved primary names, unrecognized count,
recommended condition ids, and engine version. Intake free text is never
persisted. SQLite locally when `EVENT_LOG_SQLITE_PATH` is set, otherwise
structured stdout lines.

## Data model

Three layers, deliberately separate. See `docs/condition-catalog.md`.

- `data/conditions/` is the catalog: condition identity and rating schedule
  citations, one file per body system. 191 conditions, 14 systems.
- `data/knowledge-base/` holds secondary mappings, referencing catalog ids.
- `data/presumptives/` holds exposure categories.

The catalog is the single source of display names, so a label cannot drift
between mapping files. Referential integrity is enforced by test.

JSON in git rather than a database so every change to a mapping or a citation
is a reviewable pull request diff. That audit trail is a Phase 3 compliance
asset.

## Acceptance criteria

Mapped to `docs/phase-plan.md`.

| # | Criterion | Status |
|---|-----------|--------|
| 1 | A user can complete intake and receive ranked exploration suggestions | Met |
| 2 | Every suggestion includes explanation text and at least one source reference | Met, enforced by test |
| 3 | The app works end to end with no live VA data | Met |
| 4 | Disclaimers are visible in intake and results views | Met |
| 5 | At least three demo scenarios run consistently | Met, enforced by test |

## Open items before Phase 2

1. **Citation review.** Every citation ships `verified: false`. A qualified
   reviewer must confirm each one. The diabetic retinopathy reference was
   already corrected once: the prototype cited 38 CFR 4.119 (DC 7913), the
   diagnostic code for diabetes itself, where an eye citation belongs.
2. **Knowledge base coverage.** 5 of 191 catalog conditions have published
   mappings, about 2.6 percent. The catalog gives the app its vocabulary; the
   mappings are the remaining work and cannot be generated.
3. **Accessibility audit.** Keyboard and screen reader passes have not been run.
4. **No authentication.** Deliberate for Phase 1, since no user data is stored.
   Revisit before any deployment that handles veteran-specific data.
