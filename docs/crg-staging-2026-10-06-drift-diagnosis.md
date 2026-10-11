# CRG staging-packet drift diagnosis — 2026-10-09

Diagnosis of why `tests/crg-packet-converter.test.ts` reports the delivered 2026-10-06 staging
packet as drifted, and what the owner should decide about re-delivering it. **No delivered hash was
rewritten, no packet was regenerated, and no assertion was relaxed by this diagnosis.**

## 1. What the failing assertions actually compare

`tests/crg-packet-converter.test.ts` rebuilds the staging packet from the **current working tree**
(`buildStaging()` reads `data/knowledge-base/*.json`, `data/conditions/*.json`, the 13 packets and
validation records, and the registries) and compares the result to the committed record under
[docs/crg-staging-2026-10-06/](crg-staging-2026-10-06/manifest.json):

- the census pin `holdCounts` must equal the delivered census (the hard-coded
  `HOST_GOVERNANCE_REVIEW: 4`), and
- the delivered `manifest.json` (minus its `outputFiles`) must equal the freshly built manifest, and
  each recorded output hash must match the file on disk.

So those two failures are the *only* place the repository reports divergence between the delivered
record and the local corpus. `assertInputsUnchanged()` does not cover it: it captures input hashes
at build time and therefore proves only that nothing changed *during* a run, not that nothing
changed since delivery.

## 2. Headline finding: the delivered packet is exact for `HEAD`, and the drift is entirely uncommitted

The same comparison run against a clean worktree of `HEAD` (`fb8a3485`, via
`git worktree add --detach`, removed afterwards) is **identical to the delivered record in every
field**:

| Compared | Working tree | Clean `HEAD` worktree |
| --- | --- | --- |
| Manifest fields `formatVersion`/`status`/`authorityBoundary`/`schemaValidation`/`counts`/`probabilityNormalizations` | identical | identical |
| `holdCounts` | **differs** | identical |
| `inputFiles` (883 captured inputs) | **3 changed** | 0 changed |
| `proposals` (65) | **4 differ** | 65/65 identical |
| `authored-mappings.json` bytes | identical | identical |
| `graph/*.json` bytes | 28/28 identical | 28/28 identical |

The staged clinical payload is byte-identical in both cases — `authored-mappings.json`
SHA-256 `565ad3c879792ae927323b79cf88d081365efd65c3870de655128d20e59843dd`, matching the hash the
manifest records for it, and all 28 staged graph files match theirs. **No proposal text,
mechanism, alternative, citation or hold *reason* changed.** Only three pieces of manifest metadata
moved: four input hashes → three changed input hashes, the hold census, and the four proposal
entries whose holds changed.

**The diverging inputs are three files, all modified in the working tree and none committed since
2026-10-05:**

| Input | `HEAD` | Working tree | Effect on the rebuild |
| --- | --- | --- | --- |
| [data/knowledge-base/degenerative-disc-disease.json](../data/knowledge-base/degenerative-disc-disease.json) | 0 `governanceNotes` | 2 new notes | three staged proposals gain `HOST_GOVERNANCE_REVIEW` |
| [data/knowledge-base/tinnitus.json](../data/knowledge-base/tinnitus.json) | 2 suggestions (`→ depressive-disorder`, `→ insomnia`), 0 notes | 1 suggestion (`→ migraine-headaches`), 2 new notes | wave-2 row-1 proposal gains `EXISTING_HOST_TARGET` **and** `HOST_GOVERNANCE_REVIEW` |
| [data/knowledge-base/traumatic-brain-injury-residuals.json](../data/knowledge-base/traumatic-brain-injury-residuals.json) | same suggestion set, 0 notes | same suggestion set, 0 notes | input hash only; no hold change |

The new notes are substantive governance framing, not incidental text — for example the DDD pair
scopes the edge to *anatomically concordant* radiculopathy and states where it "must not be used",
and the tinnitus pair frames the edge as comorbidity/central sensitisation rather than causation
and requires re-rooting under a different primary where the award is TMJ, cervical or acoustic
trauma. They are the reason the `HOST_GOVERNANCE_REVIEW` hold fires: the converter emits that hold
whenever a host carries `governanceNotes` at all, precisely so their presence is surfaced for
review rather than auto-cleared.

## 3. The four drifted proposals

| Proposal | Delivered holds | Rebuild holds | Why |
| --- | --- | --- | --- |
| wave 2 row 1 `tinnitus → migraine-headaches` | `QUALIFIED_REVIEW_REQUIRED`, `TARGET_NOT_DRAFT` | + `EXISTING_HOST_TARGET`, + `HOST_GOVERNANCE_REVIEW` | the rewritten live host now already contains this exact target ("reconciliation is required, not append") and now carries governance notes |
| wave 3 row 4 `degenerative-disc-disease → hypogonadism` | `QUALIFIED_REVIEW_REQUIRED`, `TARGET_NOT_DRAFT` | + `HOST_GOVERNANCE_REVIEW` | host gained governance notes |
| wave 6 row 1 `degenerative-disc-disease → radiculopathy-sciatic` | `QUALIFIED_REVIEW_REQUIRED` | + `HOST_GOVERNANCE_REVIEW` | host gained governance notes |
| wave 6 row 2 `degenerative-disc-disease → radiculopathy-upper-extremity` | `QUALIFIED_REVIEW_REQUIRED` | + `HOST_GOVERNANCE_REVIEW` | host gained governance notes |

Census delta: `HOST_GOVERNANCE_REVIEW` 4 → 8, `EXISTING_HOST_TARGET` 0 → 1. Every other hold count
is unchanged, and the delivered four were four *different* hosts
(`alcohol-use-disorder`, `schizophrenia`, `cerebrovascular-accident-stroke-residuals`,
`oral-cancer`), so no delivered hold was lost.

## 4. The delivered record is internally sound

- All 29 recorded `outputFiles` (1 authored file + 28 graph files) are present and their SHA-256
  values match the manifest: **0 missing, 0 mismatched**.
- The recorded directory is the **30 tracked files** (29 outputs + `manifest.json`); `docs/` has no
  uncommitted change under `docs/crg-staging-2026-10-06/`.
- 59 **untracked** `… 2.json` / `… 3.json` duplicates also sit in that directory (the duplicate
  working copies REL-01 logged elsewhere). Every comparable duplicate is **byte-identical** to its
  recorded counterpart (57 of 57), so they carry no divergent content — they are scratch clutter
  inside a delivered-artifact directory, worth deleting but not a provenance defect.

## 5. What this means for re-delivery

Two tempting responses are both wrong here:

- **Regenerating or overwriting `docs/crg-staging-2026-10-06/`** would replace the dated record —
  and its recorded hashes — with a build of *uncommitted, unreviewed* corpus edits. That converts a
  verifiable historical artifact into an unverifiable one, and it would bake three unreviewed host
  files into a clinical packet.
- **Re-pinning the census / relaxing the delivered-vs-fresh comparison** would make CI green by
  turning a provenance check into a snapshot of a dirty checkout, and it would hide exactly the
  signal that is currently doing its job.

Re-delivery also has little to offer *today*: because the staged payload is byte-identical, a new
packet built now would record the same 65 proposals and 64 edges with different metadata only.

### Recommendation: keep the 2026-10-06 packet as delivered; decide the corpus first

The record is not stale with respect to the repository — it is stale only with respect to unlanded
local edits. The blocking decision is about the three dirty host files, and it is the same decision
that already blocks the ME-17 ledger-join allowance (the uncommitted `tinnitus.json` rewrite is
what removed ME-17's approved `tinnitus → depressive-disorder` edge from the corpus). Sequence:

1. **Decide the three dirty files** — land them as reviewed authoring, or revert them. Until that
   happens the converter suite stays red, and that redness is a true report about the checkout.
2. **If they land**, author a *new dated* packet directory (the converter refuses to reuse an
   existing output path by design) and annotate this one as superseded-by that record, in a
   companion note — never by editing the 2026-10-06 manifest or its hashes.
3. **If they are reverted**, the rebuild matches the delivered record again and the suite goes green
   with nothing to re-deliver.

### Decision list for the owner

| # | Decision | Options | Consequence of deferring |
| --- | --- | --- | --- |
| D1 | Disposition of the three uncommitted host files (this is the actual blocker) | land as reviewed authoring · revert · hold as a pinned in-flight state | converter suite, ME-ledger allowance and every whole-corpus count pin stay divergent from the delivered record |
| D2 | Whether the corpus should legitimately move at all | no change (edits are superseded) · changed (new authored state) | no new packet can be honestly dated |
| D3 | If it moves: re-delivery route | new dated directory + supersession note (recommended) · one-off regeneration of the old directory (refused: destroys the record) | packet provenance and the 2026-10-06 evidence stay un-reconciled |
| D4 | Whether to keep the census pin at 4 while the corpus is dirty | keep it and stay red (recommended; the redness is true) · add a dated, proposal-named allowance for the four unlanded holds | a red suite can be misread as a tooling defect rather than a corpus decision |
| D5 | The 59 untracked duplicate copies inside the delivered directory | delete (they are unpinned scratch, byte-identical) · leave | directory hygiene only; no clinical or provenance effect |

## 6. Reproduction

The measurements above come from two read-only probes kept with the rest of this session's
evidence: [tmp/crg-drift-diagnosis/diagnose.ts](../tmp/crg-drift-diagnosis/diagnose.ts) (delivered
vs fresh, per-field and per-input) and
[tmp/crg-drift-diagnosis/diagnose2.ts](../tmp/crg-drift-diagnosis/diagnose2.ts) (drifted proposals,
delivered self-consistency, directory-vs-recorded-output set). Both call the shipped
`buildStaging()` and write nothing:

```sh
node --no-warnings tmp/crg-drift-diagnosis/diagnose.ts
node --no-warnings tmp/crg-drift-diagnosis/diagnose2.ts
```

To confirm the `HEAD` column, build in a clean worktree (`git worktree add --detach <tmp> HEAD`,
symlink `node_modules`, run the first probe from that root, then `git worktree remove`), which
leaves the working tree untouched.

**Not done here, deliberately:** the delivered manifest and its hashes are unchanged, no staging
packet was regenerated, the `holdCounts` pin and the delivered-vs-fresh comparison were not
relaxed, and the three dirty host files were not edited. The two converter failures therefore
remain, and remain accurate.
