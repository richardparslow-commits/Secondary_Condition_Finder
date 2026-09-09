# Recommendation Engine — Consensus Ranking Algorithm

## Purpose

This document describes the secondary-track recommendation engine in `src/lib/engine/recommend.ts` and `src/lib/secondary-workflow/suggestions.ts`. It is an **ordering heuristic** for authored KB relationships, not a medical or legal determination.

See also: `docs/product-spec.md` (FR-2/FR-3/FR-4/FR-10), `docs/master-specification.md`, and per-relationship ledgers under `docs/mapping-expansion-*.md`.

## What the engine does (and does not do)

- **Does:** Given catalog conditions, published KB mappings, and the user's workflow choices (diagnosed set, service-connected primaries, optional bounded medication/treatment/history context, optional approximate onset/diagnosis years), returns recommendations **strictly inside the diagnosed non-service-connected set**.
- **Does not:** generate a diagnosis the user did not report, estimate approval likelihood/ratings/compensation, treat absence of a mapping as a negative medical opinion, infer drug classes/mechanisms, or treat pathway labels as proof of nexus.

A test (`tests/non-service-connected-focus.test.ts`) enforces the diagnosed-set boundary (the "Focus Engine" invariant).

## Inputs

| Input | Source | Role |
|---|---|---|
| `catalog` | `data/conditions/*.json` (813 conditions) | Display names, body system, identity |
| `kb` | `data/knowledge-base/*.json` (813 mappings) | Authored `suggestions[]` per primary; only `published` mappings contribute |
| `intake.primaryConditions` | Workflow step 2 — service-connected primaries | Primaries to evaluate |
| `intake.diagnosedConditionIds` | Workflow step 1 — diagnosed set | **Output boundary** — recommendations are filtered to this set |
| `intake.medications/treatments/history` | Workflow step 4 — bounded context | **Display-only** literal overlap cues (see below) |
| `intake.conditionTimeline` | Workflow step 4 — optional approximate years | Chronology **flags** only |

## 1. Catalog recognition

Each `primaryConditions` entry is resolved via `findCondition(catalog, input)`:

- Unrecognized strings → `unrecognizedPrimaries` (reported, contributes nothing).
- Recognized but draft-only mapping → `unmappedPrimaries` (reported, contributes nothing).
- Recognized + published mapping → participates in scoring.

Identity deduping uses `indexById`; case/alias variants collapse.

## 2. Score and consensus

For each primary → each authored `suggestion` in its published mapping:

### 2.1 Consensus tiers

`etiologicalConsensus` on each suggestion is one of:

1. `WELL_ESTABLISHED`
2. `IATROGENIC_TREATMENT_EFFECT`
3. `PROBABLE`
4. `CONTESTED_REQUIRES_SPECIFIC_EVIDENCE`
5. `NOT_ESTABLISHED`

Mapped to an internal rank via `CONSENSUS_ORDER` (0–4, lower is stronger). Prevalence is **not** used.

### 2.2 Rank weight

Each suggestion has an authored `rank` (1 = strongest). Its contribution is:

```
contribution = 1 / rank
```

When multiple primaries point at the same secondary, contributions **add**. The `score` is the sum, rounded to 4 decimals. Scores are an ordering heuristic and are **never shown** to the user as a number.

### 2.3 Accumulation

An `Accumulated` bucket per secondary condition merges:

- `score` (summed)
- `consensusRank` — **minimum** (strongest) across contributing primaries
- `contributingPrimaries[]` — each with `rationale`, optional `pathwayIntelligence`, `nexusClaim`, `causalMechanism`, `evidentiaryProfile`
- `evidenceGaps[]` — deduped strings
- `sourceReferences[]` — deduped by sorted-JSON identity
- `clinicalFrictionWarnings` / `chronologyWarnings` — deduped by `code:primaryId:message`
- `intermediatePathways` — two-edge paths (see §4)

### 2.4 History-signal warnings

For each primary/suggestion, `findAlternativeEtiologyWarnings` checks whether any bounded `intake.history` term overlaps (via `HISTORY_SIGNAL_ALIASES`) with `alternativeEtiologiesToRuleOut` or `alternativeEtiologyTags`. Matches emit a `ClinicalFrictionWarning` ("A qualified clinician should address …; this warning does not determine causation.") — these are **flags**, not filters.

### 2.5 Chronology flags

`findChronologyWarnings` compares `intake.conditionTimeline[primary].(onsetYear|diagnosisYear)` vs `intake.conditionTimeline[target]`:

- `DIRECT_CAUSATION` + `secondaryYear < primaryYear` → `SECONDARY_PRECEDES_PRIMARY`
- `AGGRAVATION` + `secondaryYear >= primaryYear` → `AGGRAVATION_BASELINE_CHRONOLOGY`

Flags are informational and do not suppress the recommendation.

## 3. Intake-context matching (display-only)

`matchIntakeContext` surfaces medication/treatment/history entries **only** when their normalized text (≥ 3 chars, case-insensitive via `normalizeConditionName`) literally appears inside authored content:

```
authoredText = condition name + contributingPrimary rationales + evidenceGaps
```

- Does **not** affect `score`, ordering, or filtering.
- Does **not** infer drug classes, mechanisms, or individual causation.
- Excludes `pathwayIntelligence` fields so richer Step 5 explanation cannot create new matches.
- Feature-flagged in UI as "research cues rather than proof" (FR-2 / FR-4).

## 4. Intermediate-chain research paths

`findIntermediatePathways` enumerates explicit **two-edge** paths through published mappings:

```
primary → intermediate → target
```

Constraints:

- Both edges must be published.
- `intermediate` and `target` must not already be service-connected.
- `target` must be in `diagnosedConditionIds` (the diagnosed-set boundary).
- Deduped by `primaryId:intermediateId:targetId`.

If a target has no direct `Accumulated` bucket, a new one is created with:

```
score = 1 / (firstEdge.rank * secondEdge.rank)
consensusRank = max(edge consensus ranks)  // weaker of the two
rationale = "Bounded intermediate-chain research path: A → B → C. Each edge requires separate individual medical support; the path is not a direct nexus finding."
```

Paths are research navigation, not transitive causation. Each edge retains its own `sourceReferences` and `pathwayTypes`; the path is never promoted to a direct nexus claim.

## 5. Final shaping

For each accumulated bucket, build a `Recommendation` with the catalog's display name/body system and the strongest consensus label (`CONSENSUS_BY_RANK[minRank]`), sort `contributingPrimaries` by `rank` then name, and sort all recommendations by:

```
b.score - a.score  ||  a.condition.localeCompare(b.condition)
```

Then apply the Focus Engine filter when `diagnosedConditionIds` is present:

```ts
recommendations = recommendations.filter(r => diagnosedSet.has(r.conditionId));
```

Return `{ recommendations, recognizedPrimaries, unmappedPrimaries, unrecognizedPrimaries }`.

## 6. Pseudocode

```
recommend(catalog, kb, intake):
  byId = indexById(catalog)
  mappings = publishedMappings(kb)

  recognizedIds, recognizedPrimaries, unmappedPrimaries, unrecognizedPrimaries = classify(intake.primaryConditions)

  accumulator = Map<conditionId, Accumulated>()

  for primaryId in recognizedIds:
    if no mapping: continue
    for suggestion in mapping.suggestions:
      if suggestion.conditionId in recognizedIds: continue
      upsert accumulator[suggestion.conditionId] with
        score += 1/rank
        consensusRank = min(consensusRank, CONSENSUS_ORDER[suggestion.etiologicalConsensus])
        merge gaps/references/warnings
    paths = findIntermediatePathways(primary, mappings, byId, diagnosedSet, recognizedIds)
    for pathway in paths:
      if accumulator has pathway.targetId: attach pathway
      else create accumulator[ pathway.targetId ] with
        score = 1/(rank1*rank2), consensusRank = max(edge consensuses)

  recommendations = accumulators → Recommendations (catalog names)
  sort by score desc, then condition name

  if intake.diagnosedConditionIds present:
    recommendations = recommendations ∩ diagnosedSet

  return { recommendations, recognizedPrimaries, unmappedPrimaries, unrecognizedPrimaries }
```

## 7. Example

- Primaries: `hypertension` (rank 1 → secondary `kidney-disease`), `diabetes` (rank 2 → same secondary).
- `kidney-disease` score = `1/1 + 1/2 = 1.5`.
- If a single-primary secondary has rank 1, its score is `1.0`, so the multi-primary secondary outranks it.
- If a relationship is `CONTESTED_REQUIRES_SPECIFIC_EVIDENCE` from one primary and `PROBABLE` from another, the displayed consensus is `PROBABLE` (stronger), but the ranking is still by summed rank weight, not by consensus label.

## 8. Observability

`recommend()` emits:

- `recommendation.latency.ms` histogram (via `src/lib/observability/logger.ts` → OTel) with `primaryCount` / `recommendationCount` attributes.
- Structured log `recommendation executed` with `durationMs`, `primaryCount`, `recommendationCount`, `unmappedCount` (no medical content).

## 9. Related surfaces

- `src/lib/secondary-workflow/suggestions.ts` — builds `NonServiceConnectedConditionResult[]` from `recommend()` output for Step 5/Step 6.
- `src/lib/secondary-workflow/export.ts` — browser-generated consultation summary (Step 6) — excludes raw evidence and intake context by default.
- `tests/step5-pathway-intelligence.test.ts`, `tests/non-service-connected-focus.test.ts` — boundary tests.
