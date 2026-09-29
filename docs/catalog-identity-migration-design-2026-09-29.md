# Catalog identity migration design 2026-09-29 — `sarcopenia`, `alcohol-use-disorder`, and the TMJ canonical election

**Status:** versioned migration design, signed by qualified-human decision on 2026-09-29. This is a
design-only deliverable: the design lands now as the auditable artifact, and execution lands in staged
local commits against it. The upstream freeze stands — nothing ships before 2026-10-11, and everything
here is local work queued for that date.

**Authority.** `docs/condition-catalog.md` freezes the identity contract and states that any change to
it "requires a versioned migration design rather than an unreviewed cleanup. An identity addition moves
the same contract and follows the same discipline: a versioned addition record plus the coordinated pin
migration across the identity-count pins". This document is that design. The working precedent is the
`tardive-dyskinesia` addition of 2026-09-28 (813/813 → 814/814) and the movement-disorder triple that
followed the same day (814/814 → 817/817), both recorded in `docs/condition-expansion-roadmap.md`.

**The contract move designed here: 817/817 → 819/819.** Two identity additions (`sarcopenia`,
`alcohol-use-disorder`); one identity adjudication that moves **no** count (the TMJ canonical election).
Preserved routes unblocked: `liver-cancer` → `sarcopenia`, the `ptsd` → `alcohol-use-disorder` →
`chronic-liver-disease` chain (in place of the withheld direct edge), and — subject to the signed
disposition in Leg C — `bruxism-awake-sleep` → `tmj-disorder`.

---

## 1. Findings that reshape the request

The request named three "missing" identities. The catalog survey of 2026-09-29 finds one flat gap, one
scope split, and one duplication — each needing a different migration shape.

### 1a. TMJ is not missing: the catalog already carries TWO TMJ identities

| id | name | file | aliases | KB state |
|---|---|---|---|---|
| `tmj-disorder` | Temporomandibular Joint (TMJ) Disorders | `data/conditions/dental-and-oral.json` | `temporomandibular joint disorders` | zero-suggestion draft, zero registered edges |
| `tmj-dysfunction` | TMJ dysfunction | `data/conditions/dental-oral-expansion-wave-7.json` | `Temporomandibular joint`, `temporomandibular joint dysfunction`, `tmj`, `temporomandibular disorder` | zero-suggestion draft, zero registered edges |

A flat `temporomandibular-disorder` addition would mint a **third** identity for one clinical spectrum
and would immediately trip the alias-collision tests: the literal alias `temporomandibular disorder` is
already claimed by `tmj-dysfunction`. The records also carry **three notations** for one target: ME-34's
rejection names `tmj-dysfunction`, the withdrawn batch-6 draft named `tmj-disorder`, and the
missing-identity roadmap and corpus leads name `temporomandibular-disorder`. This is the
identity-coordination finding, not an absence: the standing prejudice from the rotator-cuff and eczema
adjudications (`docs/modeling-debt-dispositions.md`) is to elect one canonical identity rather than
mint or delete. **Leg C elects `tmj-disorder` canonical** (qualified-human decision, 2026-09-29) and
quarantines `tmj-dysfunction` as a pointer record. The identity count does not move on this leg.

### 1b. `alcohol-use-disorder` is missing, but its names live on the umbrella

`data/conditions/mental-disorders.json` `substance-use-disorder` ("Substance use disorder", the broad
discovery grouping) currently claims the aliases `alcohol use disorder` and `alcoholism`. Minting
`alcohol-use-disorder` therefore collides with existing aliases unless they move — the exact shape of the
`eczema` / `atopic-dermatitis-eczema` scope split. Leg B is a **scope split with alias migration**, not a
flat addition. The umbrella keeps its grouping role (rule 9: clinical authoring must evaluate the
substance-specific diagnosis rather than the discovery grouping); the new identity owns the
alcohol-specific diagnosis, pathway, and confound vocabulary (rule 10: a shared 38 CFR 4.130 framework
does not collapse distinct diagnoses).

### 1c. `sarcopenia` is a clean gap

No catalog identity, no alias, no name anywhere in `data/conditions` carries sarcopenia or muscle-wasting
language for this concept (`muscle-atrophy` and `interosseous-muscle-atrophy` exist and are distinct
identities that must NOT absorb it; see the scope note in Leg A). Leg A is a **flat addition** on the
`tardive-dyskinesia` precedent.

---

## 2. Leg A — `sarcopenia` (flat addition; identity 818 of the new contract)

**Catalog entry** — append to `data/conditions/musculoskeletal.json` (the file carrying `muscle-injury`;
the muscle family is uniformly "Musculoskeletal System"):

```json
{
  "id": "sarcopenia",
  "name": "Sarcopenia",
  "aliases": ["muscle wasting", "muscle loss", "age-related muscle loss"],
  "bodySystem": "Musculoskeletal System",
  "ratingSchedule": [],
  "reviewNotes": [
    "Added 2026-09-29 as a versioned catalog addition closing the corpus-review catalog gap behind the withheld liver-cancer to sarcopenia route (D1 batch 91), recorded in docs/missing-identity-addition-roadmap.md. The route is otherwise unblocked and awaits ordinary evidence authoring.",
    "Rating authority is deliberately left empty per docs/condition-catalog.md step 4 (never invent a code): a qualified human must confirm whether sarcopenia is evaluated under the muscle-injury framework of 38 CFR 4.73 or rated as a residual of its underlying etiology before any ratingSchedule citation is recorded, and any citation added by automated work stays verified: false.",
    "Scope guards: this identity is the clinical syndrome of progressive loss of skeletal muscle mass and strength, NOT the separate muscle-atrophy / interosseous-muscle-atrophy identities (denervation and disuse forms) and NOT cancer cachexia, which is a distinct systemic wasting syndrome with its own inflammation-dominant literature; the cachexia gap remains open and separate. Liver-cancer sarcopenia claims must state the myopenic/cachectic boundary on the face of the edge."
  ]
}
```

**Knowledge-base mapping** — create `data/knowledge-base/sarcopenia.json` (template shape of the
`data/knowledge-base/tardive-dyskinesia.json` precedent):

```json
{
  "id": "sarcopenia",
  "draft": true,
  "todo": ["Rebuild secondary-condition suggestions with condition-specific clinical evidence before publication."],
  "governanceNotes": [
    "Created 2026-09-29 in the versioned identity migration (docs/catalog-identity-migration-design-2026-09-29.md). Zero suggestions by design: no relationship is authored until condition-specific PubMed evidence is located, claim-versus-source verified, and cleared by source-status preflight. The batch-91 corpus references supporting the liver-cancer sarcopenia lead are BVA decision letters and are barred from registration by the batch-80 rule."
  ],
  "suggestions": []
}
```

**Route spec — `liver-cancer` → `sarcopenia`.** Primary `liver-cancer` is a zero-suggestion `draft: true`
mapping, so the edge takes the **ordinary draft path** (verified:false references allowed in drafts; no
held artifact needed). Requirements at authoring:

1. Locate PubMed anchors for sarcopenia prevalence/impact in primary liver cancer and hepatocellular
   carcinoma cohorts (the corpus lead itself is route discovery only — batch-80 rule: BVA decision
   letters are never registered).
2. Confirmed-absent check + `node scripts/preflight-source-status.js` before registration (ME-29
   discipline: bibliographic data never enters `data/evidence/master-sources.json` detached from a
   registered relationship).
3. Face-of-edge disclosures: the sarcopenia-versus-cachexia boundary; myopenic obesity and BMI-blind
   muscle loss in cirrhosis (sarcopenia is prevalent in cirrhosis independent of body weight); the
   treatment-consequence guard (locoregional therapy and resection are not secondary conditions).
4. Expected CRG review: `liver-cancer` → `cirrhosis-of-the-liver` is registered, so a later
   `cirrhosis-of-the-liver` → `sarcopenia` window would create transitive redundancy with a direct
   `liver-cancer` → `sarcopenia` edge; author one window per claim and read the redundancy semantics
   before authoring both.

---

## 3. Leg B — `alcohol-use-disorder` (scope split from `substance-use-disorder`; identity 819)

**Catalog entry** — append to `data/conditions/mental-disorders.json`, directly alongside
`substance-use-disorder`:

```json
{
  "id": "alcohol-use-disorder",
  "name": "Alcohol use disorder",
  "aliases": ["alcoholism", "alcohol dependence", "alcohol addiction", "aud"],
  "bodySystem": "Mental Disorders",
  "ratingSchedule": [
    {
      "citation": "38 CFR 4.130",
      "note": "Mental-disorders rating framework. No single alcohol-use-disorder-specific diagnostic code is asserted here; rating depends on documented findings and the General Rating Formula for Mental Disorders.",
      "verified": false
    }
  ],
  "reviewNotes": [
    "Added 2026-09-29 as a versioned catalog scope split from the substance-use-disorder discovery grouping (the eczema precedent): the aliases 'alcohol use disorder' and 'alcoholism' migrate from substance-use-disorder to this identity so the substance-specific diagnosis owns its name. Closing the missing-identity blocker behind the withheld ptsd to chronic-liver-disease self-medication chain (D1 batch 91; PMID 30080255 preserved under ME-29).",
    "Scope guards: this identity is the alcohol-specific diagnosis; substance-use-disorder remains the broad discovery grouping and keeps non-alcohol substance scope. A shared 38 CFR 4.130 framework does not establish shared etiology between them. Alcohol- and drug-related legal eligibility rules are separate from rating identity and must be evaluated independently.",
    "This identity is ALSO the standing confounding-exposure vocabulary for hepatic, psychiatric, trauma and pancreatic routes: every liver and mood claim must consider alcohol exposure as a rival etiology before attribution."
  ]
}
```

**Alias migration on `substance-use-disorder`** (same file, edited in the same change):

- Remove `alcohol use disorder` and `alcoholism` from its `aliases` (they move verbatim to the new
  identity; `substance abuse` remains). Alias-collision tests make the move mandatory, and no test
  pins these aliases to the umbrella as of 2026-09-29 (re-verify with a grep at execution).
- Add a `reviewNotes` entry recording the scope split (annotate, don't rewrite existing notes):
  the umbrella deliberately spans substance-specific diagnoses, `alcohol-use-disorder` now owns the
  alcohol-specific window, and clinical authoring under the umbrella must name the substance.

**Knowledge-base mapping** — create `data/knowledge-base/alcohol-use-disorder.json` on the same
zero-suggestion draft template as Leg A, with governance notes recording the scope split and the
chain-resolution role below.

**Route specs — the self-medication chain.** Batch 91 withheld `ptsd` → `chronic-liver-disease` as an
intermediate-step chain: PMID 30080255 measures PTSD in heavy-alcohol users with alcoholic hepatitis, so
the route runs PTSD → alcohol use → liver disease, and the direct edge would duplicate a route the graph
resolves at one remove. With the identity present, the chain unblocks as two honest windows instead of
one dishonest edge:

1. **`alcohol-use-disorder` → `chronic-liver-disease`** (ordinary draft path: `alcohol-use-disorder` and
   `chronic-liver-disease` are both draft mappings). Preserved anchor PMID 30080255 attaches here per
   ME-29 discipline (preserved without registration; it attaches to a registered relationship at
   authoring). Disclosures: alcoholic hepatitis/severity spectrum, dose-and-duration dependence, and the
   viral/metabolic rival etiologies.
2. **`ptsd` → `alcohol-use-disorder`** — `ptsd` is a **published** mapping, so this edge takes the
   **held-artifact path**: fully authored into `docs/batch-93-ptsd-alcohol-use-disorder-held-edge.json`
   (the batch-89/90 templates), references verified under `docs/citation-verification-sop.md`, then
   landed verbatim. The claim is self-medication/co-occurrence at ASSOCIATION_ONLY; the same-window
   discipline as the tinnitus case applies — no PTSD → alcohol → liver chain claim is made on the face of
   either edge; each window stands on its own anchors.

The **direct `ptsd` → `chronic-liver-disease` edge stays WITHHELD** — superseded as to mechanism, not
reversed: the chain it was withheld for now exists explicitly. CRG note: `ptsd` →
`substance-use-disorder` is already registered, so expect a parallel-targeting/redundancy review finding
between the two alcohol/substance windows; read the redundancy semantics before authoring, and do not
duplicate the umbrella edge's evidence.

---

## 4. Leg C — TMJ canonical election and the signed ME-34 reopening

**Election (qualified-human decision, 2026-09-29): `tmj-disorder` is canonical.** It already carries the
spectrum name "Temporomandibular Joint (TMJ) Disorders", the right body system, and the 38 CFR 4.150
dental-and-oral framework. All TMJ claims are authored under it.

1. **`tmj-disorder`** gains the coordinated aliases: `temporomandibular disorders`, `temporomandibular
   disorder`, `temporomandibular joint`, `temporomandibular joint dysfunction`, `tmj`, `tmj dysfunction`
   (all migrate off `tmj-dysfunction` or are minted; each must remain unique across the catalog).
   A `reviewNotes` entry records the election, the three-notation reconciliation (ME-34's
   `tmj-dysfunction`, batch-6's `tmj-disorder`, the roadmap's `temporomandibular-disorder` — the last
   never minted and now resolved as canonical name/alias), and the pointer relationship below.
2. **`tmj-dysfunction`** becomes a **quarantined pointer record** on the rotator-cuff-tear precedent
   (`docs/modeling-debt-dispositions.md`): stable ID preserved (one-to-one catalog/KB integrity unmoved;
   saved workflow state untouched), name and a disambiguating alias retained, all matching aliases moved
   to the canonical, and `reviewNotes` pointing at `tmj-disorder` as the identity under which claims are
   authored. `docs/modeling-debt-dispositions.md` gains the disposition entry (the quarantine ledger is
   authoritative there; annotate, don't rewrite).
3. **No count moves**: quarantine keeps both records; the 817/817 → 819/819 delta is entirely Leg A+B.

**The signed ME-34 reopening disposition (qualified-human decision, 2026-09-29).** ME-34 rejected
`bruxism-awake-sleep` → TMJ on evidence grounds and its contract test pins `bruxism-awake-sleep`
suggestions at zero. Its governance notes allow reopening only by explicit qualified-human disposition
reconciling the negative juvenile evidence with the adult meta-analytic association. That disposition is
signed as follows:

> The ME-34 rejection rested on PMID 9758394, a juvenile bruxism cohort finding no relationship to TMJ
> symptoms. The adult evidence located since is meta-analytically positive and reconcilable with it:
> Mortazavi 2023 (PMID 37474733) reports temporomandibular disorders associated with bruxism at roughly
> 2.25-fold higher odds (awake 2.51, sleep 2.06), with the association conditioned on diagnostic method
> and bidirectional in the underlying literature, and Jiménez-Silva 2017 (PMID 27796166) is consistent.
> The reconciliation is an **age-scope reconciliation**: the juvenile null and the adult positive
> association measure different populations and can both stand. The rejection is therefore reopened
> **only** for the `bruxism-awake-sleep` → `tmj-disorder` route, authored at ASSOCIATION_ONLY /
> hypothesizedOnly, draft-quarantined, with the juvenile null (PMID 9758394) carried as an explicit
> counterweight on the face of the edge, the bidirectional reading disclosed (the edge does not assert
> that bruxism causes TMJ disease in any individual; direction is unresolved), and the
> diagnosis-method conditioning disclosed. No other ME-34 conclusion is reopened.

Execution consequences of the reopening:

- `bruxism-awake-sleep` and `tmj-disorder` are both draft mappings, so the edge takes the **ordinary
  draft path**; PMIDs 37474733, 27796166 and 9758394 pass absent-check + preflight before registration.
- `tests/mapping-expansion-me34.test.ts` moves its contract pin (the zero-suggestions pin on
  `bruxism-awake-sleep`) 0 → 1 **when the edge lands**, with a batch comment recording the signed
  reopening; the ME-34 ledger record itself is annotated as superseded-as-to-outcome-only, never
  rewritten.
- The batch-91 `ptsd` → `bruxism-awake-sleep` edge's "ME-34 boundary" language keeps its stance for
  itself ("this edge does NOT reopen masticatory-joint claims") and gains no contradiction: its window
  remains PTSD-anchored; the TMJ route is a separate window on the bruxism primary. When both exist, CRG
  will report `ptsd` → `bruxism-awake-sleep` → `tmj-disorder` chains against any future direct `ptsd` →
  `tmj-disorder` claim; none is proposed here.

---

## 5. Pin-migration inventory (execution-time checklist)

Authoritative inventory as of 2026-09-29 (the batch-88 ledger's "15 test files" is a historical figure;
this table supersedes it as a snapshot of the pins that actually exist today).

| Pin | Current | After Leg A+B | Locations |
|---|---|---|---|
| KB file / identity count | 817 | 819 | `expect(files).toHaveLength(817)` in `tests/mapping-expansion-me1..me6.test.ts`, `tests/mapping-expansion-me21..me23.test.ts`; `expect(mappings).toHaveLength(817)` in `tests/all-94-citation-verification-current-state.test.ts`; loop bound `index < 817` in `tests/all-94-citation-verification-script.test.ts`; `expect(ids).toHaveLength(817)` in `tests/clinical-mapping-master-resolution-2026.test.ts`; `expect(files).toHaveLength(817)` in `tests/helpers/master-resolution-2026-current.ts`; `knowledgeBaseFiles: 817` in `scripts/apply-all-94-citation-verification.js`; `files.length !== 817` in `scripts/audit-master-registry.js` |
| Draft split | 677 | 679 | `draft === true` pins in `tests/mapping-expansion-me1..me6.test.ts`, `tests/all-94-citation-verification-current-state.test.ts`, `tests/helpers/master-resolution-2026-current.ts` |
| Published split | 140 | 140 (unmoved) | `draft === false` pins alongside the above |
| Doc-string contract | "817 catalog identities with 817 corresponding knowledge-base mappings" | "819 catalog identities with 819 corresponding knowledge-base mappings" | the sentence in `docs/condition-catalog.md` **and** the assertion in `tests/condition-catalog-doc.test.ts`; extend the dated parenthetical in `docs/condition-catalog.md` with this migration's clause (817/817 → 819/819, 2026-09-29, this design's name) |
| ME-34 contract | `bruxism-awake-sleep` suggestions 0 | 1 when the reopened edge lands | `tests/mapping-expansion-me34.test.ts` |
| Alias pins | none for `alcohol use disorder` / `alcoholism` | re-grep at execution | — |

Deferred pins (move only when routes are authored, not at identity stages): citation and registry
ratchets in `scripts/audit-citation-verification.js` and `scripts/audit-master-registry.js`; recommend
ordering pins (`tests/recommend.test.ts` family) as each new window lands; published-singles pins if a
published mapping gains a suggestion; `npm run authoring:tracker` regeneration after each state change.
Hash discipline: no recomputation of untouched rows; serialize registries `indent=2,
ensure_ascii=False` + trailing newline; macOS `sed -i ''`.

## 6. Registry and verification discipline (unchanged rules, restated as gates)

1. **No registry rows at Stages 1–2.** `data/evidence/master-sources.json` and
   `data/evidence/master-relationships.json` move only when a route is actually authored (ME-29:
   bibliographic data is never registered detached from a relationship).
2. **Absent-check + preflight** for every preserved or new PMID (30080255, 9758394, 37474733, 27796166)
   before registration; `node scripts/preflight-source-status.js` must clear with zero blocking flags.
3. **Citation purity:** published mappings receive only `verified: true` references; the `ptsd` hop is a
   held artifact until qualified-human verification; draft mappings receive `verified: false` rows in the
   ordinary queue (`npm run citations:queue`).
4. **Digest policy:** per the batch-92 disclosure — dynamic PubMed pages omit `contentDigest` rather than
   record false-positive values; `MAX_UNDIGESTED_VERIFIED_REFS` in `scripts/audit-citation-decay.js` is
   never raised to accommodate debt.
5. **One-to-one integrity:** every catalog identity has exactly one mapping file in the same change;
   quarantine preserves IDs; aliases remain unique and unambiguous (tests enforce both).

## 7. Staged execution plan

| Stage | Content | Contract effect | Gate |
|---|---|---|---|
| 0 | This design lands (batch 93) | none | full battery green |
| 1 | Leg C identity work: `tmj-disorder` canonical (aliases + review note), `tmj-dysfunction` quarantined pointer, `docs/modeling-debt-dispositions.md` disposition entry | none | alias-collision + catalog-quality tests green |
| 2 | Legs A+B: `sarcopenia` + `alcohol-use-disorder` entries, alias migration off `substance-use-disorder`, the two KB stubs, pin table (817→819, 677→679, doc string), tracker regen | **817/817 → 819/819** | kb:validate 819/819 zero drift; full battery green |
| 3a | `alcohol-use-disorder` → `chronic-liver-disease` + `ptsd` → `alcohol-use-disorder` held artifact (PMID 30080255 attaches under ME-29) | reference-use ratchets move | audits + battery |
| 3b | `liver-cancer` → `sarcopenia` after PubMed anchoring | reference-use ratchets move | audits + battery |
| 3c | `bruxism-awake-sleep` → `tmj-disorder` under the signed ME-34 reopening; me34 pin 0→1 | reference-use ratchets move | audits + battery |

Rollback: Stages 1 and 2 are pure data+pin commits and revert cleanly as units; Stage 3 edges are
draft-quarantined or held and can be withdrawn per the citation-verification SOP without touching the
identity contract. Each stage is one local commit with the battery green at landing; nothing is pushed
and nothing ships before 2026-10-11.

## 8. Signed decisions record (2026-09-29)

1. **TMJ shape:** elect `tmj-disorder` canonical; quarantine `tmj-dysfunction` as a pointer record; the
   name `temporomandibular-disorder` resolves to canonical name/alias and is never minted as an ID.
2. **ME-34:** reopen the rejection with the signed age-scope reconciliation in section 4 for the
   `bruxism-awake-sleep` → `tmj-disorder` route only.
3. **Delivery:** design-only this turn; execution proceeds stage-by-stage against this document.
