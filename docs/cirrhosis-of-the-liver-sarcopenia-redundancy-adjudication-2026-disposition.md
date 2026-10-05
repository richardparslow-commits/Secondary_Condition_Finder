# Cirrhosis-of-the-liver → sarcopenia redundancy adjudication — 2026-10-04

**Status:** adjudicated window-discipline disposition (read-only), recorded at the repository
owner's direction on 2026-10-04.
**Scope:** the redundancy question raised on the new `liver-cancer` → `sarcopenia` edge about a
future `cirrhosis-of-the-liver` → `sarcopenia` window. **No edge, relationship row, source entity,
pin, or ratchet moves in this change** — this record prepares and records the decision only.
**Provenance:** machine-derived from the working tree of `catalog-v2-movement-identities`:
`data/evidence/master-relationships.json`, the knowledge-base mappings (`data/knowledge-base/`),
`git log -S` history searches over both ID spellings, and the live `npm run audit:crg` verdict
(`scripts/audit-crg-graph.js`: status REVIEW, cycles 13, redundancy conflicts 29, no finding naming
these conditions).
**Related records:** `docs/catalog-identity-migration-design-2026-09-29.md` (Leg A route spec),
`docs/liver-cancer-sarcopenia-citation-verification-2026-disposition.md` (row 504),
`docs/crg-redundancy-triage-2026-10-04.md` (the 29-conflict backlog), and
`docs/crg-adjacency-migration-checklist.md` (the living per-migration register).

## 1. The question as raised

The new edge's face carries this window-discipline sentence (suggestion `rationale`, registry row
`clinicalProposition.text`/`rationale`, and the graph node rationale; the guard tail restates it):

> "the authored corpus registers liver-cancer to cirrhosis-of-the-liver, so a future
> cirrhosis-of-the-liver to sarcopenia window would create a direct-versus-chain redundancy
> conflict that must be adjudicated under npm run audit:crg before authoring; only this single
> window is authored."

The signed design's Leg A route spec states the same premise:

> "Expected CRG review: `liver-cancer` → `cirrhosis-of-the-liver` is registered, so a later
> `cirrhosis-of-the-liver` → `sarcopenia` window would create transitive redundancy with a direct
> `liver-cancer` → `sarcopenia` edge; author one window per claim and read the redundancy semantics
> before authoring both."

## 2. Premise verification — the stated registration does not exist

Checked against the live corpus:

- **Registry.** The rows touching `liver-cancer` are `rel-hepatic-steatosis-to-liver-cancer`,
  `rel-porphyria-cutanea-tarda-to-liver-cancer`, and the new `rel-liver-cancer-to-sarcopenia`. The
  rows touching `cirrhosis-of-the-liver` are `rel-chronic-liver-disease-to-cirrhosis-of-the-liver`,
  `rel-hepatic-steatosis-to-cirrhosis-of-the-liver`, and
  `rel-cirrhosis-of-the-liver-to-osteoporosis`. **No `liver-cancer` → `cirrhosis-of-the-liver`
  relationship row exists in either orientation.**
- **Knowledge base.** The only suggestion targeting `sarcopenia` is the new
  `liver-cancer` → `sarcopenia` suggestion (rank 1, ASSOCIATION_ONLY, inside the still-draft
  `liver-cancer` mapping). The suggestions targeting `cirrhosis-of-the-liver` come from
  `chronic-liver-disease` (published, DIRECT_CAUSATION) and `hepatic-steatosis` (draft,
  DIRECT_CAUSATION). No mapping registers `liver-cancer` → `cirrhosis-of-the-liver`.
- **History.** `git log -S` over the repository for both ID spellings
  (`liver-cancer-to-cirrhosis`, `cirrhosis-of-the-liver-to-liver-cancer`) returns no commit in which
  such a row or suggestion ever existed.

**Finding:** the premise is inaccurate. It appears to conflate the registered *inbound*-cirrhosis
edges (`chronic-liver-disease` → `cirrhosis-of-the-liver`, `hepatic-steatosis` →
`cirrhosis-of-the-liver`) with an intended — but never authored — `liver-cancer` →
`cirrhosis-of-the-liver` hop. The claim is carried in four artifacts; section 5 itemizes them and
their correction dispositions.

## 3. What the audit's transitive-redundancy rule can and cannot compose

The audit (`scripts/audit-crg-graph.js`) builds edges from the knowledge-base mappings
(`from` = mapping ID, `to` = suggestion target, `draft` = `mapping.draft === true`) and reports one
transitive-redundancy conflict whenever a **published** direct edge `A → C` coexists with a fully
**published** two-hop chain `A → B → C`. The audit deliberately does not decide which side is
right; only a qualified human can.

Applying that rule to the claimed conflict (`A` = `liver-cancer`, `B` = `cirrhosis-of-the-liver`,
`C` = `sarcopenia`):

1. The claimed conflict is not live: the audit's current redundancy list names none of these
   conditions.
2. The conflict cannot compose while the `liver-cancer` → `cirrhosis-of-the-liver` hop is absent —
   the rule has no `B` to traverse.
3. Even if that hop existed, nothing composes until the hop, the future window, **and** the direct
   edge are all published; the direct edge is inside the still-draft `liver-cancer` mapping today.
4. A future `cirrhosis-of-the-liver` → `sarcopenia` window would therefore not raise the audit's
   redundancy count through this edge, and is not barred by this rule against it.

## 4. Determination

- **No direct-versus-chain conflict exists or can compose from the corpus as it stands.** The
  window-discipline bar described on the new edge has no subject.
- **Prospective classification of a future `cirrhosis-of-the-liver` → `sarcopenia` window:
  Coexist** (the triage packet's distinct-route class). The two propositions are different: the
  direct edge measures sarcopenia burden and prognosis in established hepatocellular-carcinoma
  populations, while the future window would measure sarcopenia in cirrhosis populations — the
  upstream, superset population. The overlap is real rather than duplicative (most hepatocellular
  carcinoma arises in cirrhosis, and the direct edge already carries cirrhosis as a rival driver
  that must be documented and excluded), so the structural overlap is informational, not a
  duplication that subsumes either claim.
- **Conditions on any future authoring** (in addition to the ordinary evidence discipline:
  located anchors, absent-check, source-status preflight, citation purity, one window per claim):
  1. The window must carry its own cirrhosis-population anchors and reuse none of the direct edge's
     anchors (PMID 37274463, PMID 36590214, PMID 26266324).
  2. Its face must disclose the population overlap with the direct `liver-cancer` → `sarcopenia`
     edge and the HCC-population scope of that edge.
  3. `npm run audit:crg` must be re-run at authoring; the expected verdict for this composition is
     unchanged (no new conflict) unless the missing hop is also authored.
- **Supersession trigger.** If a `liver-cancer` → `cirrhosis-of-the-liver` hop is ever authored —
  and once it, the future window, and the direct edge are all published — the structural conflict
  composes after all, and this adjudication must be superseded by a fresh one rather than cited as
  permission. Authoring a published direct `chronic-liver-disease` → `sarcopenia` or
  `hepatic-steatosis` → `sarcopenia` edge alongside the future window would compose a *different*
  conflict (through the registered inbound-cirrhosis hops) that also requires its own
  adjudication at that time.
- This adjudication does not authorize authoring the future window; it removes the alleged
  structural bar and pre-classifies the overlap so a later evidence-led pass starts from an
  accurate record.

## 5. Premise-correction inventory

| Artifact | Where the inaccurate premise sits | Disposition |
| --- | --- | --- |
| `docs/catalog-identity-migration-design-2026-09-29.md` | Leg A route spec, expected-CRG-review item | **Annotated 2026-10-04** with a correction note pointing here; the signed design's decisions are not rewritten. |
| `docs/liver-cancer-sarcopenia-citation-verification-2026-disposition.md` | CRG note | **Annotated 2026-10-04** with a correction note pointing here; the citation-verification outcomes in that record are unaffected. Its `.json` companion is left as the dated machine record and carries the same premise text. |
| `data/knowledge-base/liver-cancer.json` | Suggestion `rationale` (window-discipline sentence) | **Not edited.** The rationale is hash-locked (`suggestionObjectHash`); re-wording is an authoring edit requiring mapping edit + registry lockstep + hash regeneration + pin/test updates in one reviewed change (see the triage guardrails). This record is the authoritative correction until that pass. |
| `data/knowledge-base/graph/liver-cancer.json` | Graph-node `rationale` (same sentence) | **Not edited**, same authoring-pipeline reason; the graph node mirrors the authored suggestion by design. |
| `data/evidence/master-relationships.json` | `rel-liver-cancer-to-sarcopenia` `clinicalProposition.text`, `rationale`, structured-guard tail | **Not edited**, same authoring-pipeline reason; the guard text mirrors the suggestion's window-discipline sentence. |
| `docs/crg-adjacency-migration-checklist.md` | Stage 3b "what it does not claim" bullet | **Updated 2026-10-04** with the adjudication result. |

## 6. Execution guardrails

- Nothing was added, dropped, edited, or re-pinned by this adjudication: the registry keeps its 873
  relationships, the audit keeps its reviewed state (cycles 13, redundancy conflicts 29), and
  `CRG_REDUNDANCY_BASELINE` stays 29. A retain-class outcome keeps the count unchanged by design.
- Only a qualified human may decide a unit; this record is a decided disposition recorded at the
  repository owner's direction, prepared from live evidence by automation.
- Any future correction of the hash-locked prose follows the standing authoring pipeline in one
  reviewed change, with this record superseded by a dated correction entry rather than edited in
  place.
- Never raise a pin to make CI green; a pin move is a deliberate, commented, reviewed act.

## 7. Limitations

- The population/mechanism readings in section 4 summarize the authored corpus's own text and the
  anchor populations; no source was re-opened and no citation-verification decision is revisited
  here.
- The premise check is a structural scan of the registry, the knowledge-base mappings, and git
  history; it does not adjudicate whether a `liver-cancer` → `cirrhosis-of-the-liver` hop would be
  clinically defensible if proposed later — that would be a fresh window question on its own
  evidence.
- This record is a dated snapshot. If any of the scanned conditions change (a new
  `liver-cancer` → `cirrhosis-of-the-liver` hop, a `cirrhosis-of-the-liver` → `sarcopenia` window,
  or a new direct edge into `sarcopenia` from a cirrhosis inbound primary), supersede it rather
  than letting it describe a graph that moved.
