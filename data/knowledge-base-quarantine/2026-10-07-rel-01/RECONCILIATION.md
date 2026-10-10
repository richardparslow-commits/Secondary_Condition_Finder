# REL-01 quarantine reconciliation — 2026-10-08

Reconciles the six drafts quarantined by REL-01 on 2026-10-07
([MANIFEST.json](MANIFEST.json)) against the live catalog, the live authored
corpus and the ARCH-01 evidence join, and answers the root/target identity
question the manifest left open for each one.

**Outcome — no restore.** None of the six can be restored as-is, so no entry
was copied back, no runtime file changed, and nothing was deleted. Five are
superseded by later authored work or are unrepairable duplicates; the sixth
(`chronic-pain`) has no catalog identity and no medically equivalent
candidate. The quarantine stays intact as the record.

**Owner decision, 2026-10-08.** Both follow-on questions were put to the
owner and resolved without new authoring: the `chronic-pain` draft stays
quarantined pending a reviewed catalog addition, and the shipped graph keeps
its five pinned routes (no new adjacency nodes are authored from the current
live mappings).

The verdicts are executable, not prose:
[tests/quarantine-restore-refusal.test.ts](../../../tests/quarantine-restore-refusal.test.ts)
runs this manifest's own `cp <quarantinePath> <originalPath>` restore
instruction through the real graph loader, the real catalog validator and the
real manifest hashes, and fails if any entry could be copied back.

Identity contract at record time: **819 catalog identities**, 819 mapping
files, five pinned adjacency routes.

## Identity layer — `data/knowledge-base/`

### `mappings/chronic-pain.json`

| | |
|---|---|
| Determined root | **none** — `chronic-pain` is not a catalog identity |
| Nearest catalog candidate | `unexplained-chronic-pain` (exists; authors 0 suggestions) |
| Target | `hypertension` (exists) |
| Authored claim | chronic pain → hypertension, `AGGRAVATION`, `PHARMACOLOGICAL_IATROGENIC` / `IATROGENIC_TREATMENT_EFFECT`, `AT_LEAST_AS_LIKELY_AS_NOT`, PMID 32322101 (`verified: false`) |

Re-rooting to `unexplained-chronic-pain` would file an NSAID-mediated
blood-pressure-aggravation claim under a diagnosis whose evidence never
described it: the anchor is treated chronic pain of any documented cause,
while `unexplained-chronic-pain` is a specific exclusion-based diagnosis.
The root cannot be guessed, exactly as the manifest says.

**Verdict: stays quarantined — needs a reviewed catalog identity.**
Owner-confirmed 2026-10-08: do not re-root; reopen only after the identity
exists in the catalog.

### `mappings/major-depressive-disorder.json`

| | |
|---|---|
| Determined root | `depressive-disorder` (catalog identity; the existing file is **published**, `draft: false`) |
| Target | **undecided** — `sexual-dysfunction` is not a catalog identity |
| Target candidates | `erectile-dysfunction`, `female-sexual-arousal-disorder` (also `anorgasmia`, `dyspareunia`) |
| Authored claim | SSRI-emergent sexual dysfunction, `ASSOCIATION_ONLY`, `PHARMACOLOGICAL_IATROGENIC` / `IATROGENIC_TREATMENT_EFFECT`, PMIDs 41203969, 39985829 (`verified: false`) |

Two independent blockers. The target class is split across named catalog
identities, so choosing one is a medical decision this record cannot make;
and the published `depressive-disorder` file already carries
`depressive-disorder → erectile-dysfunction` at rank 2 (`DIRECT_CAUSATION`,
PMID 34247952), so a restore would either duplicate or contradict a live
published edge.

**Verdict: stays quarantined — needs the named target identity plus medical
sign-off on the published record.**

### `mappings/post-traumatic-stress-disorder.json`

| | |
|---|---|
| Determined root | `ptsd` (catalog identity; the existing file is **published**, `draft: false`) |
| Target | `sleep-apnea` (exists, and is **already rank 1** in the published `ptsd` file: `ASSOCIATION_ONLY`, PMID 28735910) |
| Authored claim | PTSD → obstructive sleep apnea, `ASSOCIATION_ONLY`, `PSYCHOPHYSIOLOGICAL` / `CONTESTED_REQUIRES_SPECIFIC_EVIDENCE`, PMIDs 36163136, 38913378 (`verified: false`) |

The root identity resolves cleanly to `ptsd`, but the draft is a redundant
duplicate of an edge that already ships. Its citations differ (PMID 36163136
is the ME-36 *insomnia* reference), so a restore would mean either a second
`sleep-apnea` edge on a published record or swapping citations on one — both
medical review decisions.

**Verdict: stays quarantined — redundant with the published edge.**

## Adjacency layer — `data/knowledge-base/graph/`

All three retired. Each duplicates authored content that the owner has since
rewritten, and the ARCH-01 join now enforces that the mapping is the
authority.

### `graph/tinnitus.json`

`nodeId: tinnitus`, three edges: → `depressive-disorder`, → `insomnia`, →
`migraine-headaches`. Doubly refused: it is still schema-invalid (three
nested `evidentiaryProfile.evidenceGaps` values are arrays, not strings), and
even in string form two of its three edges are unsupported — the live
`tinnitus` mapping authorises only `→ migraine-headaches`, so the loader
refuses `tinnitus → depressive-disorder` for missing authored evidence.

### `graph/tinnitus 2.json`

The same three edges in schema-valid string form. Its filename can never equal
its `nodeId`, so the loader refuses it permanently whatever its content; the
manifest already describes it as unreachable.

### `graph/degenerative-disc-disease 2.json`

`nodeId: degenerative-disc-disease`, one edge → `radiculopathy`
`DIRECT_CAUSATION` / `WELL_ESTABLISHED` / `AT_LEAST_AS_LIKELY_AS_NOT`.
Filename-identity violation, and the live mapping now asserts
`ASSOCIATION_ONLY`, so the classification join refuses it. Activating it would
have upgraded a shipped draft route from association to direct causation
without review.

**Verdict: all three stay quarantined; the shipped graph keeps its five pinned
routes.** Owner-confirmed 2026-10-08: no new adjacency node is authored for
either condition.

## Reopening conditions

**Process follow-on, 2026-10-09:** the owner requested an admission process and
pending proposal only, not approval or live restoration. The
[reviewed catalog-identity admission path](../../../docs/catalog-identity-admission.md)
now provides a hash-bound owner decision and isolated end-to-end candidate
validation. The [chronic-pain proposal](../../../docs/catalog-admissions/chronic-pain-proposal-v1.json)
remains pending. The six archival hashes, live 819/819 universe and five-route
graph are unchanged; the restore-refusal tests still apply to blind copying.

| Draft | Reopens when |
|---|---|
| `chronic-pain` | a `chronic-pain` identity has been added through the reviewed catalog process — then restore and revalidate. The `unexplained-chronic-pain` re-root was declined 2026-10-08 |
| `major-depressive-disorder` | a named target identity is elected and the published `depressive-disorder` record's ownership of that route is decided |
| `post-traumatic-stress-disorder` | the evidence for the published `ptsd → sleep-apnea` edge is reopened for citation replacement |
| the three adjacency copies | not reopened: owner-confirmed 2026-10-08 that the graph keeps its five pinned routes. The superseded copies remain superseded; a future node would be authored fresh from the current live mapping, never copied from here |

## What this record did not do

No medical content was approved, re-rooted, rewritten or deleted. No citation
verification flag was changed. Draft prefixes and publication states are
untouched, and no runtime file changed. The two follow-on questions — adding a
`chronic-pain` catalog identity, and authoring nodes from the current live
mappings — were put to the owner and answered on 2026-10-08; they are product
and medical decisions, not findings of this reconciliation.
