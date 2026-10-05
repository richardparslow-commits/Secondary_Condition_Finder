# Landing checklist 2026-10-11 — stacked local branches: diff-isolation proof, merge order, procedure

**Status:** verification and planning record prepared 2026-09-29, signed by qualified-human review.
**Freeze gate (standing):** NO `git push`, NO `gh pr create/merge`, NO Vercel promotion **before
2026-10-11**. This document is preparation only; every command in it is executed on or after
2026-10-11 unless marked "re-verification" (safe, local, read-only).

---

## 1. The stack

Base: `main` = `origin/main` = `1e92080b` ("Merge pull request #515 … d1-mappings-batch-88").
Six branches stack linearly on `main` — 16 commits total, **0 merge commits**, working tree clean
at verification time.

| # | branch | own commits | own diff | cumulative vs `main` |
|---|--------|-------------|----------|----------------------|
| 1 | `identity-review-eczema-scope-split` | `9d61f958` (1) | 6 files, +115/−8 | 6 files, +115/−8 |
| 2 | `batch-89-ptsd-stress-flare-held` | `5887d5d5` (1) | 3 files, +263/−0 | 8 files, +378/−8 |
| 3 | `catalog-add-tardive-dyskinesia` | `2c9acb50` (1) | 20 files, +65/−26 | 27 files, +443/−34 |
| 4 | `re-screen-batch-80-eczema-routes` | `7344b4b4` (1) | 2 files, +16/−1 | 27 files, +458/−34 |
| 5 | `batch-90-tardive-dyskinesia-routes` | `36f31e94` (1) | 67 files, +842/−503 | 81 files, +1299/−536 |
| 6 | `catalog-v2-movement-identities` | `8ce7258d…2b6edb8d` (11) | 109 files combined | 114 files, +4832/−695 |

## 2. Diff-isolation verification (performed 2026-09-29)

**2a. Single-commit branches — `git diff <prev>..<branch>` ≡ `git show <branch>` (stable patch-id
equality): all five PASS.**

| branch | patch-id (`--stable`) |
|--------|----------------------|
| `identity-review-eczema-scope-split` | `4030ac8199764e6fd2cded32aa28099ca37e4676` |
| `batch-89-ptsd-stress-flare-held` | `79af1d76f20e9dba9894695f08e2245b80df0e1b` |
| `catalog-add-tardive-dyskinesia` | `3a67e3c1cec8c6f384207281da86697c7b7bd124` |
| `re-screen-batch-80-eczema-routes` | `b801aa4b526d400f0f7a2e000b8001e95d51bbdf` |
| `batch-90-tardive-dyskinesia-routes` | `e0e53c9123a25edf2a7054f18bf1127cefdb71ae` |

Each branch's diff against its predecessor is **exactly its own commit** — no leaked hunks, no
smuggled files. Patch-ids are content-derived (`git patch-id --stable`), so they survive an
unchanged rebase; if a rebase must edit a patch, re-record the table.

**2b. Top branch — the combined diff of the 11 commits equals the union of their per-commit file
sets (109 files), each commit scoped to its own batch:**

| commit | batch scope | files |
|--------|-------------|-------|
| `8ce7258d` | drug-induced parkinsonism / NMS / serotonin-syndrome identities (catalog 814→817) | 24 |
| `601a75de` | missing-identity refusal inventory + addition roadmap | 2 |
| `06bc8f86` | identity closures; rotator-cuff corrected to umbrella/member | 4 |
| `8d3eed50` | bare `tear` alias removed; umbrella/member scope recorded | 4 |
| `94ca7169` | canonical elections (rotator-cuff, thumb); pointer reconciliation | 10 |
| `3c352939` | dermatitis audited against the eczema scope split; atopic edges superseded | 8 |
| `4f357916` | skier's-thumb preserved-evidence record completed with verified PMIDs | 6 |
| `1a8cceb1` | D1 batch 91 (dental-erosion, tinnitus-sleep; four held) | 72 |
| `ad0e4d27` | D1 batch 92 (verification pass; four held edges landed verified:true) | 67 |
| `9d2fca5c` | D1 batch 93 (versioned catalog migration design) | 4 |
| `2b6edb8d` | D1 batch 94 (direction-discipline sweep dispositions) | 3 |

Shared files across commits (`docs/modeling-debt-dispositions.md`, `draft-backlog-tracker.csv`,
`docs/condition-expansion-roadmap.md`, the `tests/mapping-expansion-me*.test.ts` pin files,
`scripts/audit-*.js`) are the expected batch-cadence overlap — each commit's hunks are its own
batch's pins and entries.

## 3. What each PR carries (review scope)

1. **`identity-review-eczema-scope-split`** — retracts the eczema identity-duplication finding;
   records the scope split instead.
2. **`batch-89-ptsd-stress-flare-held`** — holds the batch-89 PTSD stress-flare edges with their
   six-PMID evidence (held artifacts; verification pass still pending).
3. **`catalog-add-tardive-dyskinesia`** — the tardive-dyskinesia catalog identity, versioned
   813/813 → 814/814 migration.
4. **`re-screen-batch-80-eczema-routes`** — re-screens the batch-80 ptsd/anxiety eczema routes on
   their own evidence; both remain withheld.
5. **`batch-90-tardive-dyskinesia-routes`** — maps the bipolar antipsychotic route to
   tardive-dyskinesia; holds the schizophrenia route.
6. **`catalog-v2-movement-identities`** — batches 91–94 plus the identity-closure, rotator-cuff /
   thumb election, dermatitis, skier's-thumb, and catalog 814→817 work (11 commits, each its own
   reviewable batch). A landing-prep commit for this document lands here as the twelfth.

## 4. Merge order

**Strict ancestry order 1 → 6.** The stack is linear, so each merge moves `main` forward to that
branch's tip without conflicts; any out-of-order merge forces rebases and invalidates the
isolation proofs above.

**Shape A (recommended — repo precedent, cf. PR #469 and PR #515):** one PR per branch into
`main`, merged in order. As each PR merges, the next PR's diff auto-narrows to exactly its own
commits — that narrowing is precisely what section 2 proves, so re-confirm it in the GitHub diff
view before each merge.

**Shape B (equivalent content, less review granularity):** a single PR from
`catalog-v2-movement-identities` carrying the whole stack (114 files at `2b6edb8d`, plus this
document). Fastest; loses per-batch review.

## 5. Landing checklist

### Gate 0 — freeze (standing until 2026-10-11)
- [ ] Nothing pushed, no PR created/merged, no Vercel promotion before 2026-10-11.

### Pre-flight (on or after 2026-10-11, before the first push)
- [ ] `git fetch origin`; confirm `origin/main` is still `1e92080b`. If `main` has moved, rebase
      the stack onto `origin/main` **in ancestry order**, then re-run every check in section 2 and
      re-record the patch-id table.
- [ ] Confirm the working tree is clean and `git log --oneline main..catalog-v2-movement-identities`
      still lists exactly the 16 commits of section 1 (17 after this document's commit lands).
- [ ] Re-run the verification battery at the top tip:
      `npm test` (1,857 green expected; re-count if files changed),
      `npx tsc --noEmit`, `npm run lint` (0 errors; the 5 pre-existing warnings are accepted),
      `npm run kb:validate` (0 errors),
      `node scripts/audit-master-registry.js` (PASS),
      `node scripts/audit-citation-verification.js` (0 hard / 0 review),
      `node scripts/audit-crg-graph.js` (REVIEW status, 0 violations; `CRG_REDUNDANCY_BASELINE`
      29 is a documented batch-92 re-pin).

### Per-branch loop (repeat in order 1 → 6)
- [ ] `git push -u origin <branch>`.
- [ ] Open the PR `<branch>` → `main` (repo precedent: merge commit, "Merge pull request #NNN …").
- [ ] CI green: `ci.yml`, `doc-lint.yml`, and the other repo workflows — except the known decay
      note below, everything must pass.
- [ ] Confirm the PR diff is exactly the branch's own commits (section 2 for 1–5; for 6, exactly
      its remaining unmerged commits).
- [ ] Merge. Confirm `main` advanced to precisely the branch tip.
- [ ] Next branch; its PR diff must have narrowed to its own commits before merging.

### Post-landing (2026-10-11 or later)
- [ ] Vercel production promotion (permitted from 2026-10-11); probe `/api/health`, the recommend
      page, `/wiki/7387` (airway obstruction), and `/tmd-codes`.
- [ ] Record the landing in `docs/condition-expansion-roadmap.md` (follow-up branch/PR).
- [ ] Delete merged remote branches; keep local branches until the probes pass.

### Known accepted state — record it, do NOT "fix" it on landing day
- The citation-decay gate **will flag** undigested-verified **395 > `MAX_UNDIGESTED_VERIFIED_REFS`
  383** (`scripts/audit-citation-decay.js`). Batch 92's qualified-human decision: the pin is
  deliberately NOT raised and no digests are backfilled (PubMed pages are dynamic per fetch; the
  SOP forbids false-positive digests and pin raises to accommodate debt). The `citation-decay-watch`
  workflow surfacing this is expected; record and escalate, never edit the pin to go green.
- `CRG_REDUNDANCY_BASELINE` 29 and the citation-verification ratchet counts are deliberate,
  ledger-commented pins. Escalation rule for all gates: **stop, record, escalate to a
  qualified human — never raise a pin to make CI green.** The 29 redundancy conflicts are
  itemized with candidate dispositions in `docs/crg-redundancy-triage-2026-10-04.md` (read-only;
  changes no pin, pinned to the live audit by `tests/crg-redundancy-triage.test.ts`).
