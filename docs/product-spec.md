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

- Secondary intake is a six-step workflow:
  1) diagnosed conditions,
  2) service-connected status,
  3) current ratings,
  4) optional document-upload flag,
  5) grouped suggestions,
  6) evidence review.
- Diagnosed selections come only from catalog condition ids.
- Service-connected step only shows diagnosed selections.
- Ratings step only shows service-connected selections and accepts 0–100 or
  decline.
- The upload step is explicit MVP scaffolding: no document parsing, no medical
  file interpretation, no persisted file contents.
- Steps 2 through 6 are guarded against invalid or incomplete prior-step state.
- Back navigation preserves prior workflow selections through query state so users
  can revise earlier choices without starting over.

### FR-2 Recommendations

Each suggestion shows:

- Condition name
- A qualitative prevalence band: commonly, sometimes, or occasionally explored.
  Never a number, never a percentage.
- Rationale, attributed to each contributing primary condition
- Evidence gaps: what a claim on this theory typically still needs
- Source references, each flagged verified or unverified
- Suggestions grouped by selected service-connected primary condition in the
  workflow UI
- For recognized conditions with no authored mappings, the UI must say they are
  recognized-but-unmapped and that absence implies nothing about claim viability.

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

Scenario compatibility note: `/scenarios` currently targets the legacy
query-based `/results` route for repeatable demos. Keep this route stable until
scenario migration is completed.

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

### FR-10 Evidence review page

- The workflow ends with a structured evidence checklist grouped by
  service-connected primary condition.
- Checklist content is sourced from authored `evidenceGaps` in published
  secondary mappings.
- The page must state that it is organizational support only and does not
  interpret uploaded documents.

## Data model

Three layers, deliberately separate. See `docs/condition-catalog.md`.

- `data/conditions/` is the catalog: condition identity and rating schedule
  citations, one file per body system. 191 conditions, 14 systems.
- `data/knowledge-base/` holds secondary mappings, referencing catalog ids.
- `data/presumptives/` holds exposure categories.

The catalog is the single source of display names, so a label cannot drift
between mapping files. Referential integrity is enforced by tests and by
load-time validation before recommendation logic runs.

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

1. **Citation review workflow (Workflow Enforced / Legal Review In Progress).** All citations ship with `verified: false` and are strictly validated by build/runtime schema checks. Formal subject-matter expert review of individual regulatory citations remains an ongoing operational task governed by `docs/kb-pr-checklist.md`.
2. **Mapping-authoring gaps (In Progress).** 191 catalog conditions have version-controlled knowledge-base files, but coverage is currently split: 17 mappings are published (`draft: false`) and active in UI recommendations, while 174 remain draft placeholders (`draft: true`) awaiting domain authoring.
3. **Accessibility audit (Open).** Basic semantic structure tests exist in `tests/accessibility-ux-reliability.test.ts`, but formal WCAG 2.1 AA keyboard navigation and screen-reader audit passes (NVDA/VoiceOver) have not been conducted.
4. **No authentication (Deliberate).** Intentional for Phase 1/Phase 2 client-side architecture since no veteran PII or intake free text is persisted.
