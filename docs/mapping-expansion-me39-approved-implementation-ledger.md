# ME-39 Approved Implementation Ledger

**Batch:** ME-39  
**Date:** 2026-09-06  
**Status:** APPROVED-AND-IMPLEMENTED-LOCALLY

## Scope

Publish existing draft `rem-sleep-disorder → parkinsons-disease` prodromal edge (ME-14) as the first published outgoing relationship from `rem-sleep-disorder`. Add `governanceNotes` schema field to resolve the `draft:false` + non-empty `todo` validation blocker.

## What changed

### Relationship publication

The `rem-sleep-disorder → parkinsons-disease` edge transitions from draft to published:

| Field | Value |
|---|---|
| **Relationship** | `rem-sleep-disorder → parkinsons-disease` |
| **Nexus** | `ASSOCIATION_ONLY` / `NOT_ESTABLISHED` |
| **Mechanism** | Prodromal temporal-risk marker (hypothesized only) |
| **Guard** | RBD is a marker for later synucleinopathy, not a cause; many patients do not convert; DLB and MSA remain alternative phenoconversion outcomes |
| **Source** | Postuma RB, et al. *Neurology* 2020;94(15):e1565-e1575 (PMID 20083800) — verified |
| **Prior state** | draft (ME-14, safe-draft hold) |
| **New state** | published, ASSOCIATION_ONLY, bounded prodromal guard |

### Schema change: `governanceNotes`

Added optional `governanceNotes: z.array(z.string().min(1)).default([]).optional()` to `conditionMappingSchema`. This allows published mappings (`draft: false`) to preserve governance decision records without triggering the validation rule that requires `todo` to be empty before publication.

- `todo` remains the active work tracker (must be non-empty for drafts, must be empty for published)
- `governanceNotes` stores historical governance decisions and is non-blocking
- The `rem-sleep-disorder` mapping's 4 todo items (governance notes from ME-14, ME-38, ME-39) were moved to `governanceNotes`

### REM Sleep Disorder state

`rem-sleep-disorder.json` is now `draft: false` with:
- 1 published suggestion (→ parkinsons-disease, prodromal)
- 1 published incoming edge (ptsd → rem-sleep-disorder, ME-38)
- 4 governance notes preserving decision history
- Approved disposition updated from `FINAL-CLOSE-DIRECTION` to `PUBLISHED-PRODROMAL-OUTGOING`

## Considered but not entered

| Candidate | Reason deferred |
|---|---|
| REM → DLB | Catalog gap — DLB not in condition catalog |
| REM → MSA | Catalog gap — MSA not in condition catalog |
| mTBI → RBD | Isolated mTBI evidence thinner than TBI+PTSD; deferred to future review |
| Husain 2001 | Small study (n=27), superseded by Elliott 2020 |
| Shahkhali 2025 preprint | Non-peer-reviewed; MR found no causal support — used only as guard evidence |

## Aggregate state after ME-39

| Metric | Count |
|---|---|
| Published relationships | 140 |
| Draft relationships | 673 |
| Total relationships | 813 |
| Verified source entities | 346 |
| Total source entities (incl. lineage) | 355 |
| Live source reference uses | 379 |
| Explicit publication guards | 289 |
| Published mappings | 140 |
| Draft mappings | 673 |
| Registry state | `ME-39-CITATION-VERIFIED` |

## Gates

- ✅ `kb:validate` — PASS
- ✅ `audit-master-registry` — PASS (140 published / 673 draft)
- ✅ `audit-citation-verification` — PASS
- ✅ `vitest` — 194 files, 1023 tests, all passing
- ✅ `typecheck` — PASS
- ✅ `lint` — PASS
- ✅ `build` — PASS
