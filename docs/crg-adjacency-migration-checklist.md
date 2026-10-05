# CRG adjacency migration checklist

Living ledger for the multi-hop CRG adjacency layer. The loader, the generator
entry point, and the CI gate already exist; this document records the layout
decision, the first migrated node, and the acceptance checklist every future
node (especially every future **edge**) migration must satisfy.

## Layout decision

Adjacency files live in **`data/knowledge-base/graph/<nodeId>.json`** — not in
the authored corpus root.

- `data/knowledge-base/*.json` is the identity layer with a frozen contract:
  exactly one `ConditionMapping` file per catalog identity (819/819),
  pinned by `npm run kb:validate`, `npm run authoring:tracker`, and a dozen
  test files. An adjacency file in that directory is not an identity and would
  corrupt the count contract and the authored null-mapping/draft pins.
- The graph directory is a separate artifact with its own loader and its own
  CI gate (`npm run audit:crg:graph`), so graph files can evolve without
  touching identity pins.
- The path is single-sourced in `src/lib/kb/graph-layout.ts`, a dependency-free
  module shared by the server loader and the Node-run audit script (which
  cannot import `server-only` modules under Node's type stripping).

## Loader contract (`src/lib/kb/graph.ts`)

`loadKbGraph()` parses and validates the graph once per process, then caches.
An absent or empty directory yields an empty map — the pre-migration state is
valid, not an error. The loader fails loud on:

1. invalid JSON;
2. a schema-invalid `KbNodeMapping` (including an authored mapping file that
   was misplaced into the graph directory);
3. a file whose name does not equal its `nodeId`;
4. a duplicate `nodeId` (defense-in-depth while the filename check holds);
5. a `nodeId` or edge `targetConditionId` that is not a catalog identity.

Acyclicness is not re-checked in the loader: `scripts/audit-crg.ts` enforces it
in CI, and the traversal itself is cycle-safe by construction (branch-set
ancestor guard + shared `MAX_PATHWAY_HOPS`).

## First migration — 2026-10-03

`liver-cancer.json` is the first adjacency node: `{ "nodeId": "liver-cancer",
"outgoingEdges": [] }`.

- **Why this identity:** `liver-cancer` is a verified zero-suggestion draft
  (recorded in the signed `docs/catalog-identity-migration-design-2026-09-29.md`
  as the origin of the designed `liver-cancer` → `sarcopenia` route). An
  edge-free node therefore migrates structure only — no medical claim, no
  authored narrative, and no reference is added, moved, or dropped.
- **What it proves:** the real graph directory is parsed and validated by the
  loader, the generator entry point
  (`generateCatalogClaimPathways` in `src/lib/engine/graph-pathways.ts`)
  consumes real on-disk data, and `npm run audit:crg:graph` has flipped from
  its vacuous pre-migration warning to a hard PASS over live graph data.- **What it does not claim:** the graph is not populated; no pathway is produced for any origin. Surfaces must not render empty output as a finding. (Superseded later the same day by the second migration below, which authors the route's first real edge.)

## Second migration — 2026-10-03: the first real authored edge

`liver-cancer.json` now carries one outgoing edge, `liver-cancer` → `sarcopenia`
(rank 1), and the target identity `sarcopenia` was added to the catalog in the
same change as staged Leg A of the signed
`docs/catalog-identity-migration-design-2026-09-29.md` (contract 817/817 →
818/818, then to 819/819 the same day with the staged Leg B
`alcohol-use-disorder` scope split).

- **Evidence (located, absent-checked, preflight-cleared on 2026-10-03):**
  PMID 37274463 (pooled CT-defined sarcopenia prevalence 42 percent, 48 studies
  and 8,959 patients), PMID 36590214 (prevalence 39 percent, 42 studies and
  8,445 patients; pooled adjusted overall-survival HR 1.84 and
  progression-free-survival HR 1.33, irrespective of treatment modality) and
  PMID 26266324 (90-patient curative-intent cohort: 57.8 percent sarcopenic,
  median overall survival 33 versus 105 months, adjusted HR 3.756, no
  disease-free-survival difference, major complications 32.7 versus 13.2
  percent and treatment-related mortality 17.3 versus 2.6 percent). All three
  were confirmed absent from the registry and passed
  `node scripts/preflight-source-status.js --pmids …` with zero blocking flags;
  they remain unverified pending qualified-human citation verification.
- **Legal shape and disclosures:** the edge is ASSOCIATION_ONLY
  (hypothesizedOnly, NOT_ESTABLISHED) and carries on its face the
  sarcopenia-versus-cachexia boundary, the BMI-blind/myopenic-obesity boundary,
  the treatment-consequence guard (resection, ablation, locoregional and
  systemic therapy are treatments, not secondary conditions), the direction
  discipline (all anchors measure sarcopenia in established HCC) and the
  one-window discipline against a future `cirrhosis-of-the-liver` →
  `sarcopenia` window.
- **What it proves:** the adjacency layer carries real authored clinical
  content; `npm run audit:crg:graph` runs hard over a non-empty edge and passes;
  `/api/health` reports the validated counts (`nodes` 1, `edges` 1); and
  `generateCatalogClaimPathways("liver-cancer")` emits the one-hop pathway with
  `compositeNexus: "ASSOCIATION_ONLY_CHAIN_BROKEN"` (the association hop is
  surfaced for transparency and is never extended).
- **What it does not claim:** the authored-corpus registration was NOT part of
  the second migration — it landed separately the same day as the Stage 3b
  migration recorded below; the `/pathways` surface (added
  2026-10-04) renders the pathway read-only with the chain-break semantics; and
  the edge asserts population-level co-occurrence and prognostic association
  only, never individual causation or aggravation.

## Third migration — 2026-10-03: the Stage 3b authored-corpus registration

Stage 3b of the signed design registered the route into the authored corpus the
same day the edge landed, so the graph edge and the authored mapping now carry
the same evidence:

- `data/knowledge-base/liver-cancer.json` carries the rank-1 ASSOCIATION_ONLY
  suggestion targeting `sarcopenia`, with the three references (PMID 37274463,
  PMID 36590214, PMID 26266324) entering `verified: false` under the ordinary
  citation-verification queue.
- `data/evidence/master-relationships.json` gained
  `rel-liver-cancer-to-sarcopenia` (explicit publication guard; rationale and
  evidence-gap text identical to the suggestion; `suggestionObjectHash` locked
  to the authored object) and `data/evidence/master-sources.json` gained the
  three pending-verification clinical source entities over three reference uses.
- Counts moved in lockstep: relationships 870 → 871 (explicit guards 796 → 797),
  live reference uses 1,690 → 1,693, pending-verification/pending-clinical
  entities 1,117 → 1,120, total source entities 1,483 → 1,486; verified counts
  and the 140/678 publication split unmoved.
- Citation ratchets moved with them in `scripts/audit-citation-verification.js`
  (references 1,693; unverified 1,298; the two with-URLs counts 1,688/1,692)
  and the registry pins in `scripts/audit-master-registry.js`; the count pins
  across the mapping-expansion and registry test suites moved with the data.
- Artifacts regenerated: `draft-backlog-tracker.csv` (819 mappings / 679 drafts)
  and `docs/citation-verification-dashboard.html` (1,298 pending rows, 54
  batches).
- **What it does not claim:** the `/pathways` surface renders the route
  read-only and authors nothing of its own; both the edge and the suggestion
  completed qualified-human citation verification on 2026-10-04 (see
  `docs/liver-cancer-sarcopenia-citation-verification-2026-disposition.md`); and the
  window remains the single `liver-cancer` → `sarcopenia`
  route. The future `cirrhosis-of-the-liver` → `sarcopenia` redundancy question raised on this edge
  was adjudicated on 2026-10-04
  (`docs/cirrhosis-of-the-liver-sarcopenia-redundancy-adjudication-2026-disposition.md`): the premise
  that `liver-cancer` → `cirrhosis-of-the-liver` is registered was checked and found inaccurate, so
  the described direct-versus-chain conflict cannot compose; a future window is prospectively
  classified Coexist (distinct population proposition, its own anchors, overlap disclosed) and would
  require this adjudication to be superseded if the missing hop is ever authored.

## Fourth migration — 2026-10-04: the Stage 3a route (`alcohol-use-disorder` → `chronic-liver-disease`)

Stage 3a of the signed design authored the second adjacency node and its route in lockstep with the
authored-corpus registration:

- `data/knowledge-base/graph/alcohol-use-disorder.json` carries one outgoing edge,
  `alcohol-use-disorder` → `chronic-liver-disease` (rank 1), adapted from the authored suggestion with
  only the graph-specific opening/closing prose changed; the edge is ASSOCIATION_ONLY
  (hypothesizedOnly, status NOT_ESTABLISHED) with the mechanism category disclosed as the closest
  available toxic-metabolic-exposure label and the diagnosis-to-exposure mapping carried on its face.
- **Evidence (located, absent-checked, preflight-cleared on 2026-10-04):** PMID 36926309
  (sex-specific dose-response meta-analysis, 24 studies: 40 g/day RR 9.35 [7.64-11.45] in women versus
  2.82 [2.53-3.14] in men; 80 g/day 23.32 [18.24-29.82] versus 7.93 [7.12-8.83]), PMID 20636661
  (17-study dose-response review: threshold indications, larger mortality than morbidity impact, higher
  risk in women) and the preserved batch-91 anchor PMID 30080255 (heavy drinkers with versus without
  alcoholic hepatitis: PTSD 34 percent in both; PTSD associated with higher consumption, p=0.047, but
  not with relapse or mortality), attached under ME-29. All three were confirmed absent from the
  registry and passed `node scripts/preflight-source-status.js --pmids …` with zero blocking flags;
  they remain unverified pending qualified-human citation verification.
- **Registered in lockstep:** `data/knowledge-base/alcohol-use-disorder.json` carries the rank-1
  ASSOCIATION_ONLY suggestion with the three verified:false references;
  `data/evidence/master-relationships.json` gained
  `rel-alcohol-use-disorder-to-chronic-liver-disease` (explicit guard, `suggestionObjectHash` locked to
  the authored object) and `data/evidence/master-sources.json` gained the three pending-verification
  clinical source entities over three reference uses. Counts moved: relationships 871 → 872 (explicit
  guards 797 → 798), live reference uses 1,693 → 1,696, pending-verification/pending-clinical entities
  1,120 → 1,123, total source entities 1,486 → 1,489; verified counts and the 140/679 publication
  split unmoved.
- **Held sibling window:** the `ptsd` → `alcohol-use-disorder` window is fully authored but not in the
  graph or the authored corpus — `docs/batch-93-ptsd-alcohol-use-disorder-held-edge.json` (rank 21;
  the `ptsd` mapping is published) — so no adjacency node exists for it and the graph carries no
  ptsd-to-alcohol edge until it lands.
- **What it proves:** `npm run audit:crg:graph` runs hard over two nodes and passes; `/api/health`
  reports the validated counts (`nodes` 2, `edges` 2);
  `generateCatalogClaimPathways("alcohol-use-disorder")` emits the one-hop pathway with
  `compositeNexus: "ASSOCIATION_ONLY_CHAIN_BROKEN"`; and `npm run audit:crg` stays at the reviewed
  state with cycles 13 and redundancy 29 unchanged — the new edge creates no direct-versus-chain
  conflict (no second registered path reaches chronic-liver-disease, and the withheld direct ptsd edge
  is absent by design).
- **What it does not claim:** the edge asserts a population dose-response association only, never
  individual causation or aggravation, and makes no PTSD-to-alcohol-to-liver chain claim; the
  `/pathways` surface renders it read-only with the chain-break semantics; a future liver-first window
  or second alcohol-to-liver path requires a fresh `npm run audit:crg` redundancy adjudication before
  authoring.

## Fifth migration — 2026-10-04: the Stage 3c route (`bruxism-awake-sleep` → `tmj-disorder`)

Stage 3c of the signed design executed the qualified-human signed ME-34 reopening for this route only
and authored the third adjacency node and its route in lockstep with the authored-corpus registration:

- `data/knowledge-base/graph/bruxism-awake-sleep.json` carries one outgoing edge,
  `bruxism-awake-sleep` → `tmj-disorder` (rank 1), adapted from the authored suggestion with only the
  graph-specific opening/closing prose changed; the edge is ASSOCIATION_ONLY (hypothesizedOnly, status
  NOT_ESTABLISHED) at mechanism MECHANICAL_OR_COMPRESSIVE with the parafunctional-load cascade stated
  as hypothesized.
- **Evidence (located, absent-checked, preflight-cleared on 2026-10-04):** PMID 37474733 (20-study
  systematic review and meta-analysis: pooled OR 2.25 [1.94-2.56]; awake bruxism 2.51 [2.02-2.99];
  sleep bruxism 2.06 [1.82-2.30]), PMID 27796166 (39-study systematic review, 33 positive of 39,
  quality low to moderate, polysomnographic evidence least conclusive) and the juvenile null
  PMID 9758394 (150 bruxers aged 6 to 9, only 17 retained the habit after five years; self-limiting
  and appeared unrelated to TMJ symptoms) carried as an explicit counterweight under the signed
  age-scope reconciliation. All three were confirmed absent from the registry and passed
  `node scripts/preflight-source-status.js --pmids …` with zero blocking flags; they remain unverified
  pending qualified-human citation verification.
- **Registered in lockstep:** `data/knowledge-base/bruxism-awake-sleep.json` carries the rank-1
  ASSOCIATION_ONLY suggestion with the three verified:false references;
  `data/evidence/master-relationships.json` gained `rel-bruxism-awake-sleep-to-tmj-disorder` (explicit
  guard, `suggestionObjectHash` locked to the authored object) and `data/evidence/master-sources.json`
  gained the three pending-verification clinical source entities over three reference uses. Counts
  moved: relationships 872 → 873 (explicit guards 798 → 799), live reference uses 1,696 → 1,699,
  pending-verification/pending-clinical entities 1,123 → 1,126, total source entities 1,489 → 1,492;
  verified counts, the active counts and the 140/679 publication split unmoved. The three Stage 3a
  source entities' `doi` fields were repaired from a truncated value to their full DOIs in the same
  change.
- **ME-34 contract:** `tests/mapping-expansion-me34.test.ts` moved its zero-suggestions pin on
  `bruxism-awake-sleep` 0 → 1 with a batch comment recording the signed reopening; the ME-34 ledger
  (`.md` and `.json`) is annotated as superseded as to outcome only and is not rewritten, and no other
  ME-34 conclusion is reopened.
- **Disclosures on the face:** the signed ME-34 disposition reconciles the juvenile null with the
  adult association as an age-scope matter only; the bidirectional reading is disclosed with direction
  unresolved (the edge does not assert that bruxism causes TMJ disease in any individual); the
  diagnosis-method conditioning and the overlapping-literature limit are carried; the original
  rejection named `tmj-dysfunction`, while the route is authored to the canonical `tmj-disorder`
  (Leg C; the pointer is quarantined).
- **Sibling-window discipline:** the batch-91 `ptsd` → `bruxism-awake-sleep` edge keeps its own
  ME-34 boundary; when both windows exist CRG reports `ptsd` → `bruxism-awake-sleep` → `tmj-disorder`
  chains against any future direct `ptsd` → `tmj-disorder` claim, and none is proposed. One window per
  claim: a future TMJ-first window would require a fresh `npm run audit:crg` adjudication.
- **What it proves:** `npm run audit:crg:graph` runs hard over three nodes and passes; `/api/health`
  reports the validated counts (`nodes` 3, `edges` 3 after this migration);
  `generateCatalogClaimPathways("bruxism-awake-sleep")` emits the one-hop pathway with
  `compositeNexus: "ASSOCIATION_ONLY_CHAIN_BROKEN"`; and `npm run audit:crg` stays at the reviewed
  state with cycles 13 and redundancy 29 unchanged — the new edge creates no direct-versus-chain
  conflict.
- **What it does not claim:** the edge asserts an adult population association only, never individual
  causation or aggravation; direction is unresolved and the juvenile null is a counterweight rather
  than support; the `/pathways` surface renders it read-only with the chain-break semantics; and the
  ME-34 rejection stays on the record annotated as superseded as to outcome only.

## Acceptance checklist for each future node migration

1. Node file passes `KbNodeMappingSchema`, file name equals `nodeId`, and
   outgoing ranks are unique and gapless from 1.
2. `nodeId` and every `targetConditionId` exist in the condition catalog.
3. `npm run audit:crg:graph` exits 0 in hard mode (loaded ≥ 1 node, no cycles).
4. `tests/kb-graph-loader.test.ts` stays green (add cases for new failure
   modes rather than weakening existing ones).
5. `npm run kb:validate`, the authoring tracker, and the identity pins are
   untouched (this is why graph files stay out of the corpus root).
6. For an **edge** migration, first settle the open narrative-preservation
   decision below; then follow the ordinary evidence discipline: PubMed
   anchors, absent-check + `npm run citations:preflight`, citation purity
   (published mappings accept only `verified: true`), and one window per
   claim with redundancy reviewed through `npm run audit:crg`.
7. Re-run the recommendation and UI pins affected by any new edge.

## Redundancy triage record

The standing `npm run audit:crg` transitive-redundancy backlog (29 conflicts as of 2026-10-04,
`CRG_REDUNDANCY_BASELINE` 29) is itemized, classified and grouped into 17 review units with
candidate dispositions in `docs/crg-redundancy-triage-2026-10-04.md` — a read-only packet for
qualified-human review. The packet changes no pin and no edge; the register is pinned to the live
audit by `tests/crg-redundancy-triage.test.ts`. The separate prospective window question raised on
the `liver-cancer` → `sarcopenia` edge (a future `cirrhosis-of-the-liver` → `sarcopenia` window) was
adjudicated on 2026-10-04 in
`docs/cirrhosis-of-the-liver-sarcopenia-redundancy-adjudication-2026-disposition.md` and is not one
of the 29 live conflicts. When a unit is adjudicated and the audit confirms
the lower count, lower the pin and supersede the packet with a new dated triage in the same change.

## Open decisions- **Narrative preservation on edge migration.** Authored suggestions carry per-arm narrative fields (`etiologicalTrigger`, `baselineProgression`, `aggravatingFactor`, `associationBasis`, `causationStatus`) that the canonical `KbEdgeSchema` nexus arms deliberately exclude; the canonical shape carries `rationale` + `evidentiaryProfile.conservativeRationale` instead. Deciding where that narrative lives (move, summarize, or reference the authored file) is a content-governance decision, not a mechanical conversion — do not drop authored text silently. The first edge migration did not trigger this decision because the route had no authored narrative on either side (both mappings are zero-suggestion drafts); the decision remains open for migrations that move an existing authored suggestion into the graph.- **Runtime consumer.** The loader is now exercised in production by `/api/health` (validated `nodes`/`edges` migration counts; health degrades on invalid graph data), and the production readiness workflow probes that endpoint, records the validated counts in its summary, and blocks on a non-`ok` graph state. The graph's first user-facing surface is `/pathways` (claim pathway explorer, added 2026-10-04): a read-only, server-rendered index of every adjacency node and its pathways, built from the same validated traversal (`buildPathwayExplorerView` in `src/lib/engine/pathway-explorer.ts`) with the composite nexus travelling unchanged, per-hop classification badges from the shared `NEXUS_CLAIM_LABEL`, each hop's authored citation anchors joined read-only from the mapping's registered suggestion with the corpus's own `verified` flag travelling for reviewer triage (the surface shows the flag it was handed and derives no status), an explicit `CHAIN_BREAK_NOTICE` on every `ASSOCIATION_ONLY_CHAIN_BROKEN` pathway, and explicit non-finding empty states for an empty graph and for a zero-edge origin. The surface renders no raw enum values and routes nothing into the recommendation engine; any future surface must carry the same association-only chain-break semantics (surfaced for transparency, never presented as an established nexus) rather than render the pathway as a finding. The second user-facing surface is the Step 5 results section (`src/components/secondary/GraphPathwayReview.tsx`, added 2026-10-04): it surfaces only the routes connecting the conditions selected in a review — service-connected origins to diagnosed non-service-connected terminals — through `buildGraphPathwayMatchSectionView` in `src/lib/engine/graph-pathway-matches.ts`, shares the explorer's disclosure constants (`CHAIN_BREAK_NOTICE`, `POPULATION_LEVEL_GUARD`, `CITATION_TRIAGE_GUARD`) and the shared `graph-pathway-projection` helpers so the two surfaces cannot drift about what a chain says or whether it is broken, states that the adjacency layer is separate from the published-relationship results and may include draft-authored mappings, and renders nothing at all when no route connects the selections (an absent route is not a finding).- **Authoring tooling.** Whether graph nodes are generated from authored mappings by a script or authored independently is undecided; either way the loader's validation contract above is the acceptance bar. The first edge was authored independently in the graph (the second option) and its authored-corpus registration landed the same day as the Stage 3b migration above; whichever tooling is chosen, the evidence discipline in item 6 above is the authoring bar.
