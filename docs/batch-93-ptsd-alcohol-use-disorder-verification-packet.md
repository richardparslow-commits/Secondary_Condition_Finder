# Batch 93 held-edge verification packet — `ptsd` → `alcohol-use-disorder`

**Status: PREPARED — decision pending. The edge remains HELD. This packet records no decision and moves no registry count.**

Prepared 2026-10-04. The held edge is preserved verbatim in `docs/batch-93-ptsd-alcohol-use-disorder-held-edge.json` (status `HELD_2026-10-04`) and is fully authored, not registered: no relationship row, no source entities, no reference uses, and no knowledge-base suggestion exist for it. The only open question is the qualified-human citation-verification decision described below.

Related records: the per-row worksheet format follows `docs/d1-citation-verification-packet-2026-09.md`, and completed decisions are recorded in the style of `docs/liver-cancer-sarcopenia-citation-verification-2026-disposition.md` (row 504).

Per `docs/citation-verification-sop.md`, repository automation can assemble this review packet but **cannot** make the verification decision. Nothing in this packet changes a verification state, a mapping, a publication state, or a count.

## The exact decision needed

**Three per-anchor decisions, one landing decision.**

1. For **each** of the three pending anchors (PMIDs 35587413, 32939901, 24933396), a qualified human records exactly one decision:
   - **APPROVE AS WRITTEN** — the source supports the bounded proposition in the anchor's note under review, at association strength, with no overstatement.
   - **APPROVE WITH NARROWING** — the source is usable, but the edge text or reference note must be narrowed before verification; the required narrowing is recorded verbatim and applied at landing before the reference flips to `verified: true`.
   - **REJECT** — the source does not support the bounded proposition; the edge stays held (held, not refused) and any replacement anchor goes through the ordinary SOP path.
   - **HOLD** — the decision is deferred; the edge stays held unchanged.
2. **The landing rule is all-or-nothing:** the edge may land only when all three anchors are approved, as written or with recorded narrowing applied. Any REJECT or HOLD leaves the edge held for as long as `ptsd` remains published. Partial approval does not register a partial edge.

Each decision must leave the SOP reviewer evidence: **source URL, source-checked date, claim reviewed, relevant source section, reviewer identity/role, decision, and unresolved limitations** (plus the digest decision in the section below).

## Why the edge is held (and why verification is the only blocker)

- `data/knowledge-base/ptsd.json` is **published** (`draft: false`) and carries **20 registered suggestions**. `scripts/validate-knowledge-base.js` applies the citation-purity threshold **per suggestion**: a published mapping may not carry more than 30 percent unverified references, so a single `verified: false` reference among three is already 33 percent — no unverified reference can enter a published mapping at all.
- Flipping `ptsd` to `draft: true` to admit the edge is not an option: it would unpublish the 20 registered edges and break the 140 published / 679 draft pin. Mapping approval is not citation verification.
- The three anchors were claim-versus-source checked against their PubMed records on 2026-10-04, confirmed absent from `data/evidence/master-sources.json` before authoring, and cleared by `node scripts/preflight-source-status.js --pmids 35587413,32939901,24933396` with zero blocking flags and zero notes. Once verified as `verified: true`, the edge lands **verbatim** as rank 21 in `data/knowledge-base/ptsd.json`, exactly as the batch-89, batch-90 and batch-91 held sets landed after their verification passes.

## The bounded proposition being verified (edge level)

**Registered claim:** PTSD is associated with harmful alcohol use and, in a veteran cohort, with current alcohol use disorder, with coping-related drinking the best-supported mediating pathway. ASSOCIATION_ONLY; hypothesized-only mechanism; etiological consensus `NOT_ESTABLISHED`; VA nexus probability alignment `NOT_ASSERTED`.

**Causation boundary:** neither causation nor aggravation under 38 CFR 3.310 is established for any individual by these anchors. The meta-analytic evidence is cross-sectional at its core, the veteran cohort is observational and does not date onset, and the longitudinal community sample tests pathways in a single community cohort with a modest trauma-exposed subsample. The located anchors cannot exclude the reverse direction, shared familial/genetic liability, an externalizing pathway, other psychiatric comorbidity, or drinking context.

**Direction limit is the controlling disclosure:** the evidence supports the PTSD-to-drinking direction as the best-supported of the tested hypotheses, but directionality remains unresolved across the located designs and the self-medication reading is the best-supported hypothesis among those tested — not an established individual mechanism.

Verification is against **this bounded proposition only**: it verifies nothing stronger, is not mapping approval, is not publication, and is not an individual VA medical nexus determination.

## Anchor worksheets (three pending PMIDs)

### Anchor A — PMID 35587413 (Luciano et al. 2022)

- **Citation:** Luciano MT, Acuff SF, Olin CC, Lewin RK, Strickland JC, McDevitt-Murphy ME, Murphy JG. Posttraumatic stress disorder, drinking to cope, and harmful alcohol use: A multivariate meta-analysis of the self-medication hypothesis. J Psychopathol Clin Sci. 2022 Jul;131(5):447-456. doi:10.1037/abn0000764. PMID 35587413.
- **URL:** https://pubmed.ncbi.nlm.nih.gov/35587413/
- **Source checked on:** 2026-10-04
- **PMCID:** PMC9233097
- **Locator:** Meta-analytic structural equation model, 34 studies yielding 69 effect sizes, aggregate n=15,128 (median N=303.5, range 42–1,896); abstract states coping motives mediated the relation accounting for 80 percent of the variance in the total effect, moderators and publication bias found, directionality requiring additional longitudinal work.
- **Note under review:** PRIMARY mediating-pathway anchor. The source is asked to support: (i) the meta-analytic model found coping-related drinking motives mediated the PTSD-to-harmful-alcohol-use relation, accounting for 80 percent of the variance in the total effect; (ii) moderators (measurement approach, sample characteristics, study design) and evidence of publication bias were reported; (iii) the synthesis is cross-sectional at its core and its authors state additional longitudinal and multivariate studies are needed to establish directionality. The source is **not** asked to support individual causation, individual mediation, VA nexus, or that the 80 percent figure holds uniformly across populations or instruments.
- **Reviewer questions specific to this anchor:**
  - Does the record's abstract actually report the 34 studies / 69 effect sizes / n=15,128 composition and the 80 percent mediated figure, and does the note overstate them?
  - Does the note correctly carry the cross-sectional-core limit, the moderators, and the publication-bias evidence?
  - Is every citation-metadata element exact against the PubMed record (authors, title, journal, year, volume/issue/pages, DOI)?
- **Current state:** `verified: false` — pending qualified-human decision.

**Decision for PMID 35587413 (complete exactly one):**

- [ ] APPROVE AS WRITTEN
- [ ] APPROVE WITH NARROWING — required narrowing recorded below
- [ ] REJECT
- [ ] HOLD

Reviewer identity/role: — · Decision date: — · Relevant source section reviewed: — · Required narrowing (if any): — · Unresolved limitations: — · Digest decision: —

### Anchor B — PMID 32939901 (O'Toole et al. 2020)

- **Citation:** O'Toole BI, Gorman P, Catts SV. Military Combat, Posttraumatic Stress Disorder, and the Course of Alcohol Use Disorders in a Cohort of Australian Vietnam War Veterans. J Trauma Stress. 2020 Oct;33(5):709-719. doi:10.1002/jts.22588. PMID 32939901.
- **URL:** https://pubmed.ncbi.nlm.nih.gov/32939901/
- **Source checked on:** 2026-10-04
- **Locator:** Cohort study, N=388, standardized interviews at 22 and 36 years after return; abstract states PTSD but not combat exposure associated with current alcohol use disorder (OR 3.37), combat exposure but not PTSD with a history of alcohol use disorder (OR 1.02), current numbing and avoidance symptoms with current alcohol use disorder (OR 4.48), no support for mutual maintenance, consistent with self-medication.
- **Note under review:** DIRECTION-STRUCTURE anchor. The source is asked to support: (i) in a cohort of 388 Australian Vietnam War veterans assessed 22 and 36 years after return (148, 38.1 percent no alcohol-related history; 151, 38.9 percent past non-current alcohol use disorder; 89, 22.9 percent current), PTSD but not combat exposure was associated with **current** alcohol use disorder (OR 3.37); (ii) combat exposure but not PTSD tracked a **history** of alcohol use disorder (OR 1.02); (iii) current numbing and avoidance symptoms were associated with current alcohol use disorder (OR 4.48); (iv) the authors state the results do not support a mutual maintenance model and are consistent with self-medication. The source is **not** asked to support an individual causal finding, and the self-medication reading is the authors' interpretation of an observational pattern.
- **Reviewer questions specific to this anchor:**
  - Does the record's abstract report the current-versus-history asymmetry and each odds ratio exactly as the note states?
  - Does the note avoid converting the authors' self-medication interpretation into an established individual mechanism?
  - Is every citation-metadata element exact against the PubMed record?
- **Current state:** `verified: false` — pending qualified-human decision.

**Decision for PMID 32939901 (complete exactly one):**

- [ ] APPROVE AS WRITTEN
- [ ] APPROVE WITH NARROWING — required narrowing recorded below
- [ ] REJECT
- [ ] HOLD

Reviewer identity/role: — · Decision date: — · Relevant source section reviewed: — · Required narrowing (if any): — · Unresolved limitations: — · Digest decision: —

### Anchor C — PMID 24933396 (Haller & Chassin 2014)

- **Citation:** Haller M, Chassin L. Risk pathways among traumatic stress, posttraumatic stress disorder symptoms, and alcohol and drug problems: a test of four hypotheses. Psychol Addict Behav. 2014 Sep;28(3):841-51. doi:10.1037/a0035878. PMID 24933396.
- **URL:** https://pubmed.ncbi.nlm.nih.gov/24933396/
- **Source checked on:** 2026-10-04
- **PMCID:** PMC4165657
- **Locator:** Longitudinal community sample, n=377 (166 trauma-exposed, 54 percent male); abstract states strongest support for the self-medication hypothesis with PTSD symptoms predicting later alcohol and drug problems over and above pretrauma risk, partial support for high-risk, no support for susceptibility, little support for shared vulnerability.
- **Note under review:** LONGITUDINAL pathway anchor. The source is asked to support: (i) a community sample (n=377; 166 trauma-exposed; 54 percent male) tested four competing hypotheses in a path-analysis framework; (ii) the strongest support was for the self-medication hypothesis, with PTSD symptoms predicting later alcohol and drug problems over and above pretrauma family risk factors, pretrauma substance use problems, trauma exposure and demographics; (iii) partial support for the high-risk hypothesis; no support for the susceptibility hypothesis; and little support for shared vulnerability. The source is **not** asked to support an individual causal estimate, and its alcohol and drug outcomes are **combined** rather than alcohol-specific.
- **Reviewer questions specific to this anchor:**
  - Does the record's abstract report the four-hypothesis structure and the support pattern exactly as the note states, including that the strongest support is relative among the tested models?
  - Does the note carry the combined alcohol-and-drug outcome limit and the modest trauma-exposed subsample?
  - Is every citation-metadata element exact against the PubMed record?
- **Current state:** `verified: false` — pending qualified-human decision.

**Decision for PMID 24933396 (complete exactly one):**

- [ ] APPROVE AS WRITTEN
- [ ] APPROVE WITH NARROWING — required narrowing recorded below
- [ ] REJECT
- [ ] HOLD

Reviewer identity/role: — · Decision date: — · Relevant source section reviewed: — · Required narrowing (if any): — · Unresolved limitations: — · Digest decision: —

## Digest policy (disclosed, not hidden)

None of the three references carries a `contentDigest`. Per the batch-92 disclosure and the SOP's dynamic-page rule, PubMed record pages are dynamic per fetch (two fetches of the same record page return the same length with different digests), so a digest is **omitted rather than recorded as a false-positive value**. A qualified human verifier may record a digest at verification time if they check a stable fetchable body (for example the PMC full text for PMC9233097 or PMC4165657), anchored to that URL and the recorded `sourceCheckedOn` date; otherwise the digest is omitted explicitly. The landing review records the digest decision.

Consequence stated openly: the reference uses enter `verified: true` without digests, so the decay audit's verified-without-digest population moves 398 → 401 against `MAX_UNDIGESTED_VERIFIED_REFS` (**383**, already exceeded and policy-documented since batch 92). The pin is **never raised** to accommodate new debt.

*(Updated 2026-10-14, issue #518: the corpus-wide pin named above no longer exists. It counted references the SOP itself forbids digesting — a PubMed record page is served to the decay probe as a per-request anti-bot interstitial, so a digest recorded against that URL could never validate — which meant no human action could clear it, and made the scheduled probe fail on that count alone with nothing decayed. `npm run citations:decay` therefore ratchets only the **digest-eligible** backlog (`MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS`, currently 5) and excludes the measured, expiring classes declared in `docs/citation-digest-ineligible-classes.json`. Landing these three anchors accordingly moves the **digest-ineligible** PubMed population 392 → 395 and leaves the eligible backlog at its pin. See `docs/citation-digest-ineligibility-policy-2026-10-14.md`.)*

## Landing condition and exact post-verification state

**Landing is verbatim:** on all-three approval, the held edge is authored exactly as preserved — rank 21 of `data/knowledge-base/ptsd.json` (after the current 20), ASSOCIATION_ONLY, hypothesized-only, `NOT_ESTABLISHED`, with the three references entering as `verified: true` and any recorded narrowing applied to the edge/note text first.

**Live baseline and re-derived landing deltas.** The held artifact's `landingCondition` records deltas measured from the Stage-3a snapshot on its own path (relationships 872 → 873, uses 1,696 → 1,699, entities 1,489 → 1,492, verified 395 → 398). Those numbers are **historical and MUST NOT be applied at landing** — Stage 3c and the row-504 verification pass moved the corpus after they were written. Re-derive the counters at landing with `node scripts/audit-master-registry.js`. This packet's re-derived baseline and expected landing state (2026-10-04):

| Counter | Live 2026-10-04 (packet baseline) | At landing (re-derived expected) |
| --- | --- | --- |
| Recorded relationship rows | 873 | 873 → 874 |
| Explicit publication guards | 799 | 799 → 800 |
| Live reference uses | 1,699 | 1,699 → 1,702 |
| Verified live reference uses | 398 | 398 → 401 |
| Pending-verification reference uses | 1,301 | 1,301 (unchanged) |
| Live clinical uses | 1,694 | 1,694 → 1,697 |
| Live legal uses | 5 | 5 (unchanged) |
| Source entities including lineage | 1,492 | 1,492 → 1,495 |
| Active source entities (active-clinical) | 360 (359) | 360 → 363 (359 → 362) |
| Pending-verification source entities | 1,123 | 1,123 (unchanged) |
| Retired verified uses | 6 | 6 (unchanged) |
| Published / draft mappings | 140 / 679 | 140 / 679 (unchanged) |
| Adjacency graph nodes / edges | 3 / 3 | 3 / 3 → 4 / 4 |

The three references were never registered as pending, so they enter already verified: the pending counts do not move. Publication splits are unmoved because `ptsd` already carries its suggestions and `alcohol-use-disorder` already entered the draft set.

**Registry lockstep at landing:** add the relationship row `rel-ptsd-to-alcohol-use-disorder`; register the three source entities as **active** with qualified-human verificationState blocks; add the adjacency node for `ptsd` beside the three shipped nodes in the graph directory (one outgoing edge to `alcohol-use-disorder`, rank 21) per the Stage 3a / Stage 3c precedent; and update the pins that move: the entity-count expectation and batch comment in `scripts/audit-master-registry.js`, the `CITATION_DEBT_BASELINE` in `scripts/audit-citation-verification.js` (references 1,699 → 1,702; liveVerified 398 → 401), the test pins asserting 1,699 / 398 / 1,694 / 873, and the graph-loader test's `ptsd` node/pathway pin.

**Two landing reviews are required, not optional:**

1. **CRG parallel-targeting / redundancy review (`npm run audit:crg`)** against the registered `rel-ptsd-to-substance-use-disorder` window (rank 9 of `ptsd.json`, published, anchored on PMID 11481147, the 2001 Jacobsen review). The two windows share the primary and the association claim, so the landing review must confirm they do not duplicate evidence and do not assert the same route twice. This edge uses three anchors (PMIDs 35587413, 32939901, 24933396), **none** of which is the umbrella window's anchor, and the umbrella's evidence was deliberately not reused. Record the finding.
2. **Transitive chain check.** This window plus the registered `rel-alcohol-use-disorder-to-chronic-liver-disease` window forms the `ptsd` → `alcohol-use-disorder` → `chronic-liver-disease` chain. The direct `ptsd` → `chronic-liver-disease` edge stays **WITHHELD** (superseded as to mechanism by the two honest windows, not reversed), so no direct-versus-chain redundancy exists at landing; no PTSD-to-alcohol-to-liver chain claim is made on the edge's face. A future direct `ptsd` → `chronic-liver-disease` edge or a `ptsd` → `cirrhosis-of-the-liver` window requires a fresh `npm run audit:crg` adjudication.

Also run `npm run audit:crg:graph` at landing (expected PASS over 4 nodes / 4 edges once the `ptsd` node lands).

## What approval does and does not authorize

- It authorizes the three references to flip to `verified: true` and the held edge to land verbatim as rank 21. It authorizes nothing else.
- If review finds a source supports **more** than the bounded proposition (individual causation or aggravation), do **not** promote the edge in place: record the finding and route the classification change through its own governance disposition.
- If review finds a source supports **less** than the proposition, the outcome is APPROVE WITH NARROWING or REJECT; a rejected anchor keeps the edge held and any replacement goes through the SOP.
- Approval does **not** release the direct `ptsd` → `chronic-liver-disease` withhold, does not alter the registered umbrella edge, does not alter the registered `alcohol-use-disorder` → `chronic-liver-disease` window (still pending its own verification), does not publish or unpublish any mapping, and does not establish any individual medical nexus.
- This packet is read-only: it registers nothing, flips nothing, and records no decision. The decision belongs to the qualified human.

## Landing procedure (ordered)

This procedure executes only after all three anchors are approved and the decision record below is complete. It closes the hold in one pass:

1. **Record the decision.** Write the disposition record in the style of `docs/liver-cancer-sarcopenia-citation-verification-2026-disposition.md` (row 504) with the three per-anchor decisions, any recorded narrowing, the SOP review evidence and the digest decisions; complete the decision record table below with reviewer identity/role and date.
2. **Re-run the source-status preflight.** `node scripts/preflight-source-status.js --pmids 35587413,32939901,24933396` must still report zero blocking flags before anything lands.
3. **Close the hold on the held artifact.** In `docs/batch-93-ptsd-alcohol-use-disorder-held-edge.json`, set the status to `LANDED_<date>` and add a `landingRecord` in the batch-91 pattern (`landedOn`, `verificationPass`, `adaptationsFromHeldText`), preserving the `heldEdges` body verbatim as the pre-landing record.
4. **Land the edge verbatim.** Add the suggestion to `data/knowledge-base/ptsd.json` at rank 21 with the three references `verified: true` — any recorded narrowing applied to the edge and note text first — exactly as preserved in the artifact.
5. **Registry lockstep.** Apply the relationship row, source-entity promotions, registration posture and hash recomputations listed under "Registry lockstep at landing" above, then re-derive the counters with `node scripts/audit-master-registry.js` against the deltas table above.
6. **Add the adjacency node.** Author the `ptsd` node beside the three shipped nodes in `data/knowledge-base/graph/` with one outgoing edge to `alcohol-use-disorder` at rank 21.
7. **Run the landing reviews.** `npm run audit:crg` for the parallel-targeting finding against the umbrella window, the transitive chain check, and `npm run audit:crg:graph` (expected PASS over four nodes and four edges).
8. **Update the pins.** The pins named under "Registry lockstep at landing" — the master-registry expectation and batch comment, the citation-debt baseline, the test pins asserting 1,699 / 398 / 1,694 / 873, and the graph-loader node/pathway pin.
9. **Close the queue record.** Update `docs/qualified-human-citation-verification-queue.md` with the resolution note and the disposition-record pointer (the batch-91 resolution annotation is the precedent), and re-run `npm run citations:queue` so the authoritative row set is regenerated from the landed corpus.
10. **Re-run the gates and update this packet.** `node scripts/audit-master-registry.js`, `npm run citations:audit`, `npm run test:doc-lint`, typecheck, lint and the full test suite must pass; then replace the status line above with the landed status and the disposition pointer.

If any of the three decisions is REJECT or HOLD, or a recorded narrowing cannot be applied as written, none of the steps above execute and the edge remains held.

## Decision record (to complete at review)

| Anchor | PMID | Decision | Narrowing recorded | Reviewer | Date |
| --- | --- | --- | --- | --- | --- |
| A | 35587413 | — | — | — | — |
| B | 32939901 | — | — | — | — |
| C | 24933396 | — | — | — | — |

**Landing decision:** — · All three approved? — · Narrowing applied before flips? — · CRG parallel-targeting finding recorded? — · Transitive chain check recorded? — · Digest decisions recorded?
