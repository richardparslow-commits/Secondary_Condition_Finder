# Qualified-Human Citation Verification Queue

Repository automation can prepare source-check metadata and identify every live published source that remains `verified: false`; it **cannot** make the qualified-human verification decision itself.

## Generate the queue

Run:

```bash
npm run citations:queue
```

The generated report is authoritative for the exact current human-review row set.

## Authoritative current citation state

The authoritative current citation state is **generated, not transcribed**: run `npm run citations:audit` for live reference counts and verification state, and `npm run citations:queue` for the exact machine-generated human-review row set. At the ME-35/all-94 registry snapshot every live reference was verified; subsequent ME-36–ME-39 citations were qualified-human verified at authoring time (see `docs/master-registry-2026.md`).

The all-94 approval was applied on 2026-09-04 as a citation-state transition only. It did not publish draft mappings or establish an individual medical nexus. The batch snapshots below are retained for audit history and are not the current queue.

## Held edges awaiting qualified-human verification

A held edge is fully authored but unregistered because its primary mapping is published and the per-suggestion citation-purity gate admits no unverified reference. Held edges do not appear in the generated queue because no reference use is registered for them; each is preserved as a held artifact with its own verification packet, and the decision belongs to the qualified human.

- The batch-93 `ptsd` → `alcohol-use-disorder` window is held as `docs/batch-93-ptsd-alcohol-use-disorder-held-edge.json`, with the prepared review packet at `docs/batch-93-ptsd-alcohol-use-disorder-verification-packet.md` (one decision per pending anchor, all-or-nothing landing rule). No decision has been recorded.

## Historical citation-verification baseline

The published surface remains fully verified: for published mappings, `npm run citations:queue` reports an empty row set. The citation-verification batches left the repository fully verified at the time they ran, and every transiently unverified published row since (including Batch 31's two bounded `verified: false` source rows) has been qualified-human verified.

Batch 31 added exactly two bounded clinical source rows as `verified: false` at the time; both have since been qualified-human verified:

- insomnia→depressive disorder, PMID 38833937; and
- migraine headaches→depressive disorder, PMID 23588795.

Both are prospective incident-depression sources. Their published rationales explicitly distinguish population-level temporal risk from an individual medical nexus and require diagnosis-specific chronology and competing-cause review.

No source is automatically verified. Citation Verification Batches 01 through 13 record explicit qualified-human decisions, reducing the then-current ceilings to a single live unverified reference and a single published-unverified review finding without changing the live-reference denominator. Batch 08 intentionally held one reviewed source unverified because the knowledge-base target was broader/different than the cited post-traumatic-headache evidence; that row has since been resolved.

The targeted screen also records several nonpublished evidence dispositions without adding live source rows: carpal tunnel syndrome psychiatric association (PMID 37639884); ME/CFS psychiatric temporal/comorbidity literature (including PMIDs 40785390, 15184691, 19566769); hypothyroidism/CTS evidence (PMID 41002938); narcolepsy/depression meta-analysis (PMID 32671534); peripheral-neuropathy/falls-fractures evidence (PMID 36945108); radial mononeuropathy characterization (PMID 41392533); REM sleep behavior disorder prodromal synucleinopathy evidence (PMIDs 39177811 and 28429825); and social-anxiety/depression prospective evidence (PMID 11231832). These are screening notes, not live published citation rows.

## Completed Citation Verification Batch 01

Five sources were reviewed and explicitly approved by the repository owner acting as the qualified human reviewer: achalasia→esophageal cancer (PMID 37975607), ACL injury→osteoarthritis (PMID 33852440), acromegaly→hypertension (PMID 42050227), traumatic limb amputation→depressive disorder (PMID 25294119), and sphincter-cutting anal-fistula treatment→fecal incontinence (PMID 33387100). The reproducible decision record is `docs/citation-verification-batch-01.md`.

## Completed Citation Verification Batch 02

Five additional sources were explicitly approved by the repository owner acting as the qualified human reviewer: asthma→OSA (PMID 40774162; proposition narrowed before verification), Barrett's esophagus→esophageal adenocarcinoma (PMID 41125322), cardiomyopathy→heart failure (PMID 37622657), cauda equina syndrome→erectile dysfunction (PMID 40380123; population/etiology scope narrowed before verification), and chronic liver disease with documented fibrosis progression→cirrhosis (PMID 32108989). The reproducible decision record is `docs/citation-verification-batch-02.md`.

## Completed Citation Verification Batch 03

Five additional sources were explicitly approved by the repository owner acting as the qualified human reviewer: chronic pyelonephritis→CKD (PMID 11110586), documented allergic-rhinitis phenotype→OSA (PMID 40774162), chronic rhinosinusitis→OSA (PMID 41969980), COPD→OSA overlap/coexistence (PMID 36672523; unsupported direct-secondary/aggravation pathway labels removed before verification), and Cushing's syndrome→hypertension (PMID 35950979). The reproducible decision record is `docs/citation-verification-batch-03.md`.

## Completed Citation Verification Batch 04

Five additional live clinical-evidence references were explicitly approved by the repository owner acting as the qualified human reviewer: depressive-disorder treatment→weight gain (PMID 31524318), obesity/weight gain→OSA as the second link in the depressive-disorder intermediate chain (PMID 40330547), depressive-disorder psychotropic treatment→erectile dysfunction with agent-specific safeguards (PMID 34247952), type 1 diabetes→CKD (PMID 41358881), and scalp discoid lupus→scarring alopecia (PMID 35817588). All five were verified as written. The reproducible decision record is `docs/citation-verification-batch-04.md`.

## Completed Citation Verification Batch 08

Five additional published clinical-evidence rows were explicitly reviewed by the repository owner. ILD→OSA (PMID 33403599), Paget disease→osteoarthritis (PMID 18504638), and ovarian-cancer paclitaxel treatment→peripheral neuropathy (PMID 24582486) were verified as written. Migraine→depressive disorder (PMID 23588795) was narrowed from `somatopsychic` mechanism metadata to temporal-association-only framing and then verified. Mild TBI→`migraine-headaches` (PMID 38568491) was narrowed to a phenotype-oriented post-traumatic-headache research flag and intentionally remains `verified: false` because the cited review does not independently establish the repository's migraine diagnostic target. The reproducible decision record is `docs/citation-verification-batch-08.md`.

## Completed Citation Verification Batch 07

Five additional live clinical-evidence references were explicitly approved by the repository owner: hypertensive heart disease→congestive heart failure (PMID 36082670), confirmed hypogonadism→osteoporosis (PMID 29499097), chronic hypoparathyroidism→kidney stones (PMID 36375810), and transvenous pacemaker lead→heart-valve disorder (PMID 34389210) as written; insomnia→depressive disorder (PMID 38833937) after removal of directional `direct-secondary` pathway intelligence and conversion to temporal-association framing. The reproducible decision record is `docs/citation-verification-batch-07.md`.

## Completed Citation Verification Batch 06

Five additional live clinical-evidence references were explicitly approved by the repository owner acting as the qualified human reviewer: prolactin-secreting pituitary dysfunction→hypogonadism (PMID 40812946) as written; hypertension→CKD, ischemic heart disease, and congestive heart failure using the 2025 multisociety hypertension guideline (PMID 40811497) as written; and hypertension→erectile dysfunction after one-for-one replacement of PMID 27491642 with the current corrected 2025 multisociety guideline (PMID 40811497), retaining association-only and individual-causation safeguards. The reproducible decision record is `docs/citation-verification-batch-06.md`.

## Completed Citation Verification Batch 05

Five additional live clinical-evidence references were explicitly approved by the repository owner acting as the qualified human reviewer: erectile dysfunction↔depressive disorder association evidence (PMID 29960891) after removing unsupported directional `somatopsychic` pathway intelligence; femoroacetabular impingement→hip osteoarthritis (PMID 26524551) as written; heart-valve-replacement residuals→hemolytic anemia after one-for-one source replacement with Alkhouli et al. (PMID 31039274); confirmed primary aldosteronism→hypertension as written; and confirmed primary hyperparathyroidism→kidney stones (PMID 36245251) as written. The reproducible decision record is `docs/citation-verification-batch-05.md`.

## D1 draft-authoring verification queue (2026-09)

The D1 condition-expansion batches of 2026-09-22 authored draft-quarantined `ASSOCIATION_ONLY` suggestions whose source references are deliberately `verified: false` pending this queue. These rows are **not** surfaced by the default published-surface command above; the machine queue for them is:

```bash
node scripts/report-citation-verification-queue.js --markdown --include-drafts
```

Rows are generated directly from the mapping files — never transcribed here — and each row carries its publication state so a reviewer can see it is a draft-quarantined mapping citation, not a published one. The reviewer-facing worksheets (proposition, causation boundary, per-source note under review, and decision-record template) are in `docs/d1-citation-verification-packet-2026-09.md`, generated from the same mapping records.

Approving a D1 row verifies only that the source supports the bounded association-only proposition as authored; it does not publish the mapping, convert association into causation, or constitute an individual VA nexus determination. The debt ratchet in `scripts/audit-citation-verification.js` closes only through these qualified-human decisions, applied in lockstep with the master registries.

## Graph-pathway anchor review (Stages 3a–3c, 2026-10)

The 2026-10 graph-adjacency stages (3a, 3b and 3c) registered three routes on the ordinary draft path, each carrying three authored citation anchors. All three mappings remain `draft: true`, so none of the anchors appears in the default published queue above; the machine row set is the draft queue the D1 section describes, and the reviewer-facing worksheets are the corresponding per-edge sections of `docs/d1-citation-verification-packet-2026-09.md`. The nine anchors are indexed below: six remain pending qualified-human review, and three carry recorded decisions from the Stage 3b review.

| Stage | Route | Worksheet row | PMID | Decision state |
|---|---|---|---|---|
| 3a | `alcohol-use-disorder` → `chronic-liver-disease` | 505.1 | 30080255 | PENDING (draft-quarantined) |
| 3a | `alcohol-use-disorder` → `chronic-liver-disease` | 505.2 | 36926309 | PENDING (draft-quarantined) |
| 3a | `alcohol-use-disorder` → `chronic-liver-disease` | 505.3 | 20636661 | PENDING (draft-quarantined) |
| 3b | `liver-cancer` → `sarcopenia` | 504.1 | 37274463 | VERIFIED 2026-10-04 (with narrowing) |
| 3b | `liver-cancer` → `sarcopenia` | 504.2 | 36590214 | VERIFIED 2026-10-04 (with narrowing) |
| 3b | `liver-cancer` → `sarcopenia` | 504.3 | 26266324 | VERIFIED 2026-10-04 (as written) |
| 3c | `bruxism-awake-sleep` → `tmj-disorder` | 506.1 | 37474733 | PENDING (draft-quarantined) |
| 3c | `bruxism-awake-sleep` → `tmj-disorder` | 506.2 | 27796166 | PENDING (draft-quarantined) |
| 3c | `bruxism-awake-sleep` → `tmj-disorder` | 506.3 | 9758394 | PENDING (draft-quarantined) |

The Stage 3b decisions are recorded in `docs/liver-cancer-sarcopenia-citation-verification-2026-disposition.md`; the packet rows are retained as the pre-decision worksheet and are superseded by that record. For every pending row, approving the source verifies only the bounded `ASSOCIATION_ONLY` proposition as authored — it publishes nothing, converts no association into causation, and constitutes no individual VA medical nexus determination.

## Human review procedure

For each live queue row, a qualified reviewer must independently open the canonical source and determine whether the citation accurately supports the exact proposition for which it is being used, including phenotype, direction, treatment/procedure exposure, chronology, limitations, and competing explanations.

## Permitted outcomes

- **VERIFY:** source and proposition are accurate. Update the live source record to `verified: true` and preserve URL/check date/locator/role.
- **REPLACE:** proposition is defensible but the source is weak, outdated, or mismatched. A replacement remains `verified: false` until reviewed.
- **RETIRE:** a previously verified live source no longer belongs on the relationship; preserve provenance in `data/citation-retirements.json`.
- **WITHDRAW/NARROW:** the evidence does not support the live proposition as authored; fix the relationship rather than verifying an inapplicable citation.
- **HOLD:** review is incomplete; leave `verified: false`.

## Non-negotiable boundary

Automated source retrieval or screening is not the qualified-human verification decision required by repository policy.

<!-- HISTORICAL-CURRENT-SECTIONS:START -->
> The following Batch 13 and M1 sections are historical snapshots retained for provenance. They predate the ME-35/all-94 promotion and are not current aggregate state; consult the authoritative current state at the top of this file.


Master-approved implementation was complete through **Batch 13** at the time of this historical snapshot.
- Live verified references: **68**
- Retired verified references: **6**
- Verified provenance: **74**
- Live unverified references: **1**
- Published unverified review findings: **1**
- Hard findings: **0**
- Live clinical source URL coverage: **64/64**

Current unresolved published queue:
- `mild-tbi.json` → `migraine-headaches`: Schwedt TJ. Posttraumatic Headache. Continuum (Minneap Minn). 2024;30(2):411-424. PMID 38568491
<!-- HISTORICAL-CURRENT-SECTIONS:END -->

<!-- clinical-mapping-m1-current:start -->
## Historical clinical-mapping position — M1

Qualified-human Clinical Mapping Batch M1 is approved and implemented locally.

- Catalog identities: **300**
- Knowledge-base mappings: **300**
- Overall published mappings: **55**
- Overall draft mappings: **245**
- Wave 1–7 identities: **107**
- Wave dispositions: **31 published-evidence-led**, **76 safe-draft**, **0 promotion-candidate**
- live references: **73**
- live verified: **68**
- retired verified: **6**
- verified provenance: **74**
- live unverified: **5**
- published-unverified review findings: **5**
- live clinical-evidence references with canonical URLs: **68**
- retired clinical-evidence references with canonical URLs: **4**
- combined clinical-URL provenance observation: **72**
- hard citation findings: **0**

M1 publishes:
- `social-anxiety-disorder` → `depressive-disorder`: prospective temporal-risk/association only; no causal pathway metadata.
- `laryngeal-cancer` → `aphonia`: treatment-complication only; documented total laryngectomy and documented aphonia required.

The 5 live unverified published references are PMID 38568491, PMID 11231832, PMID 17679635, PMID 25630206, and PMID 20189345. No M1 source is auto-verified.
<!-- clinical-mapping-m1-current:end -->

<!-- CLINICAL-MAPPING-MASTER-2026:START -->
## Clinical Mapping Master Batch 2026 — citation verification complete

Qualified-human approval was provided on 2026-08-19:

> I approve Clinical Mapping Master Batch 2026 — Master Citation Verification Disposition

All **68 Master relationship source rows** are verified. The final set contains **60 unique PMIDs** after 8 approved narrowings and 5 one-for-one replacements.

| Final PMID | Relationship rows | Decision(s) | Status |
|---:|---|---|---|
| 9371291 | 1: myelodysplastic-syndrome → leukemia | VERIFY-AS-WRITTEN | verified |
| 10326187 | 1: anorexia-nervosa → osteoporosis | VERIFY-AS-WRITTEN | verified |
| 18038923 | 1: sarcoidosis → thrombocytopenia | VERIFY-AS-WRITTEN | verified |
| 20644150 | 1: penetrating-head-trauma → seizure-disorder | REPLACE-SOURCE | verified |
| 20680529 | 1: ankylosing-spondylitis → osteoporosis | VERIFY-AS-WRITTEN | verified |
| 20722714 | 1: parkinsons-disease → depressive-disorder | VERIFY-AS-WRITTEN | verified |
| 22694245 | 1: hiatal-hernia → barretts-esophagus | VERIFY-AS-WRITTEN | verified |
| 25061487 | 1: cirrhosis-of-the-liver → osteoporosis | VERIFY-AS-WRITTEN | verified |
| 26683953 | 1: hepatitis → osteoporosis | REPLACE-SOURCE | verified |
| 26882216 | 1: psoriatic-arthritis → depressive-disorder | VERIFY-AS-WRITTEN | verified |
| 27666776 | 1: emphysema → respiratory-cancer | VERIFY-WITH-NARROWING | verified |
| 28342087 | 1: pelvic-inflammatory-disease → ovarian-cancer | VERIFY-AS-WRITTEN | verified |
| 29157021 | 1: gastroparesis → cardiac-arrhythmia | VERIFY-AS-WRITTEN | verified |
| 29280918 | 1: celiac-disease → schizophrenia | VERIFY-AS-WRITTEN | verified |
| 29735408 | 1: psoriasis → erectile-dysfunction | VERIFY-AS-WRITTEN | verified |
| 30393090 | 1: osteoporosis → osteonecrosis-of-the-jaw | VERIFY-AS-WRITTEN | verified |
| 30422277 | 1: psoriasis → inflammatory-bowel-disease | VERIFY-AS-WRITTEN | verified |
| 30912336 | 1: hyperthyroidism → hypothyroidism | VERIFY-AS-WRITTEN | verified |
| 31203833 | 1: narcolepsy → depressive-disorder | VERIFY-AS-WRITTEN | verified |
| 31782315 | 1: q-fever → gallbladder-disease | VERIFY-AS-WRITTEN | verified |
| 32088651 | 1: hepatitis → pancreatic-cancer | VERIFY-AS-WRITTEN | verified |
| 33011316 | 1: psoriasis → colorectal-cancer | VERIFY-AS-WRITTEN | verified |
| 33433655 | 1: inflammatory-bowel-disease → colorectal-cancer | REPLACE-SOURCE | verified |
| 33829302 | 1: charcot-arthropathy → amputation-or-loss-of-use | VERIFY-WITH-NARROWING | verified |
| 34049905 | 1: bronchiolitis → asthma | VERIFY-AS-WRITTEN | verified |
| 34406259 | 1: anemia → chronic-kidney-disease | VERIFY-AS-WRITTEN | verified |
| 34447668 | 1: brucellosis → cardiac-inflammatory-disease | VERIFY-WITH-NARROWING | verified |
| 34596875 | 1: psoriasis → psoriatic-arthritis | REPLACE-SOURCE | verified |
| 35233053 | 1: hypothyroidism → tinnitus | VERIFY-AS-WRITTEN | verified |
| 35334622 | 1: osteoporosis → trigeminal-neuralgia | VERIFY-WITH-NARROWING | verified |
| 35383546 | 1: actinomycosis → cardiac-inflammatory-disease | VERIFY-AS-WRITTEN | verified |
| 35605220 | 1: tuberculosis → aortic-aneurysm | VERIFY-AS-WRITTEN | verified |
| 35787151 | 1: nocardiosis → cardiac-inflammatory-disease | VERIFY-AS-WRITTEN | verified |
| 35906745 | 1: systemic-lupus-erythematosus → cardiac-arrhythmia | VERIFY-AS-WRITTEN | verified |
| 36680511 | 1: primary-myelofibrosis → leukemia | VERIFY-AS-WRITTEN | verified |
| 36855430 | 2: ischemic-heart-disease → colorectal-cancer; ischemic-heart-disease → respiratory-cancer | VERIFY-AS-WRITTEN, VERIFY-WITH-NARROWING | verified |
| 37149284 | 1: gout → aortic-aneurysm | VERIFY-AS-WRITTEN | verified |
| 37223912 | 2: substance-use-disorder → depressive-disorder; substance-use-disorder → bipolar-disorder | VERIFY-AS-WRITTEN | verified |
| 37349198 | 1: pneumoconiosis → tuberculosis | VERIFY-AS-WRITTEN | verified |
| 37357958 | 1: polycythemia-vera → leukemia | VERIFY-AS-WRITTEN | verified |
| 37574171 | 1: esophageal-cancer → cardiac-arrhythmia | VERIFY-WITH-NARROWING | verified |
| 37899363 | 1: hepatitis → parkinsons-disease | VERIFY-WITH-NARROWING | verified |
| 38055239 | 1: psoriasis → eczema | REPLACE-SOURCE | verified |
| 38269572 | 1: essential-thrombocythemia → leukemia | VERIFY-AS-WRITTEN | verified |
| 38355151 | 1: pulmonary-fibrosis → respiratory-cancer | VERIFY-AS-WRITTEN | verified |
| 38573463 | 1: pneumoconiosis → sleep-apnea | VERIFY-AS-WRITTEN | verified |
| 38652139 | 1: thyroid-cancer → hypoparathyroidism | VERIFY-AS-WRITTEN | verified |
| 39005656 | 1: typhoid-fever → cardiac-inflammatory-disease | VERIFY-AS-WRITTEN | verified |
| 39046420 | 1: hiv-aids → uveitis | VERIFY-AS-WRITTEN | verified |
| 39324122 | 1: schizophrenia → diabetes-mellitus-type-2 | VERIFY-AS-WRITTEN | verified |
| 39847853 | 1: thromboangiitis-obliterans → amputation-or-loss-of-use | VERIFY-WITH-NARROWING | verified |
| 39895893 | 1: pancreatitis → cardiac-inflammatory-disease | VERIFY-AS-WRITTEN | verified |
| 39963138 | 1: psoriatic-arthritis → tuberculosis | VERIFY-AS-WRITTEN | verified |
| 40005458 | 1: sarcoidosis → pulmonary-hypertension | VERIFY-AS-WRITTEN | verified |
| 40196966 | 1: benign-prostatic-hyperplasia → chronic-kidney-disease | VERIFY-AS-WRITTEN | verified |
| 40329131 | 1: osteoarthritis → sleep-apnea | VERIFY-AS-WRITTEN | verified |
| 40632946 | 1: gout → macular-degeneration | VERIFY-AS-WRITTEN | verified |
| 40658955 | 1: diabetes-mellitus-type-2 → gerd | VERIFY-AS-WRITTEN | verified |
| 40772230 | 7: gerd → asthma; gerd → bronchiectasis; gerd → copd; gerd → interstitial-lung-disease; gerd → pulmonary-fibrosis; gerd → respiratory-cancer; gerd → tuberculosis | VERIFY-AS-WRITTEN | verified |
| 40959074 | 1: systemic-lupus-erythematosus → tuberculosis | VERIFY-AS-WRITTEN | verified |
<!-- CLINICAL-MAPPING-MASTER-2026:END -->

<!-- RESIDUAL-M1-CLOSURE-2026:START -->
## Residual M1 Citation Closure

Approval: **I approve Residual Citation Verification — M1 Closure 2026**

- PMID 11231832 — verified
- PMID 17679635 — verified
- PMID 25630206 — verified
- PMID 20189345 — verified
- PMID 38568491 — taxonomy hold / verified:false
<!-- RESIDUAL-M1-CLOSURE-2026:END -->

<!-- PTH-TAXONOMY-2026:START -->
## Post-Traumatic Headache taxonomy/citation item — closed

- `mild-tbi → post-traumatic-headache` — PMID **38568491** — **verified**.
- Qualified-human approval: **I approve Post-Traumatic Headache Citation Verification 2026**
- Prior `mild-tbi → migraine-headaches` active mismatch remains removed.
- Live citation verification queue: **0**.
<!-- PTH-TAXONOMY-2026:END -->

<!-- ADRENAL-HISTOPLASMOSIS-TAXONOMY-2026:START -->
## Adrenal Histoplasmosis citation item — closed

- `adrenal-histoplasmosis → addisons-disease` — PMID **30656706** — **verified**.
- Qualified-human approval: **I approve Adrenal Histoplasmosis Citation Verification 2026**
- Live citation verification queue: **0**.
<!-- ADRENAL-HISTOPLASMOSIS-TAXONOMY-2026:END -->

<!-- CLINICAL-MAPPING-MASTER-RESOLUTION-2026:START -->
## Clinical Mapping Master Resolution 2026 — citation verification complete

All **39 source rows** have qualified-human dispositions and have been promoted only after fail-closed implementation checks.

- 23 verified as written
- 14 verified with approved source-specific narrowing
- 2 verified with one-for-one source replacement
- 36 unique final live PMIDs
- 0 remaining Master Resolution unverified/review rows
- Replacement provenance is preserved in each replacement sourceLocator
<!-- CLINICAL-MAPPING-MASTER-RESOLUTION-2026:END -->

## Held batch-89 stress-dermatology citations — screening notes, not live rows

Four PTSD stress-flare edges (`ptsd` to psoriasis, atopic-dermatitis-eczema, alopecia-areata and urticaria) were fully authored on 2026-09-28 and are **held out of the knowledge base** pending qualified-human verification of their six PMIDs: **33587564, 29124739, 42179055, 41362509, 23317485, 41766900**. The target mapping is published and the citation-purity gate applies per suggestion, so these rows cannot enter the knowledge base as `verified: false` at all; they are screening notes awaiting review under `docs/citation-verification-sop.md`, not live citation rows. The complete held edges and the hold disposition are in `docs/batch-89-ptsd-stress-flare-held-edges.json` and `docs/condition-expansion-roadmap.md`. Reserved reverse-direction literature (PMID 37900780 and PMID 42403316) remains unregistered. Run `npm run citations:queue` for the authoritative live row set.

## Held batch-90 schizophrenia tardive-dyskinesia citation — screening notes, not live rows

One schizophrenia tardive-dyskinesia edge (`schizophrenia` to `tardive-dyskinesia`, rank 2) was fully authored on 2026-09-28 and is **held out of the knowledge base** pending qualified-human verification of its three PMIDs: **37424417, 39240484, 30695288**. The target mapping is published and the citation-purity gate applies per suggestion, so these rows cannot enter the knowledge base as `verified: false` at all; they are screening notes awaiting review under `docs/citation-verification-sop.md`, not live citation rows. The complete held edge and the hold disposition are in `docs/batch-90-schizophrenia-tardive-dyskinesia-held-edge.json` and `docs/condition-expansion-roadmap.md`. The companion bipolar route registered in the same batch (PMIDs 28146614 and 42030922) carries ordinary draft-queue rows and appears in `npm run citations:queue --include-drafts`. Run `npm run citations:queue` for the authoritative live row set.


## Held batch-91 corpus-review citations — screening notes, not live rows

**RESOLVED 2026-09-29 (batch 92).** The qualified-human verification pass is complete: all eleven PMIDs
are verified and the four held edges were re-landed as `verified: true` into their published mappings
(`hypothyroidism` to `depressive-disorder` rank 2; `diabetes-mellitus-type-2` to `depressive-disorder`
rank 4; `ptsd` to `bruxism-awake-sleep` rank 20; `discoid-lupus` to `depressive-disorder` rank 3). Both
reading obligations are discharged on the record: the erratum linked to PMID 36056716 was **read** (PMID
38379424, J Oral Rehabil. 2024;51(5):911-914 — sex-miscoding correction, 154 women coded as male;
corrected cohort 519 women 77.1% / 154 men 22.9%; authors state outcomes and significance unchanged),
and the published critique of PMID 19033418 was **identified but remains unread** (Nouwen, Lloyd, Pouwer.
Depression and type 2 diabetes over the lifespan: a meta-analysis. Response to Mezuk et al. Diabetes Care.
2009;32(5):e56, author reply e57; PMID 19407066, paywalled letter), so the reviewer decision is to LAND
the diabetes edge with that adjudication **standing open on the edge's face**. The discoid-lupus reviewer
decision **elects the `depressive-disorder` target**: no anchor diagnoses persistent depressive disorder, the `persistent-depressive-disorder` window remains UNAUTHORED, and the
election is preserved in the held artifact. No `contentDigest` is recorded on any of the eleven — PubMed
record pages are dynamic per fetch and the SOP requires omission over false-positive digests — so
undigested-verified is 395 against `MAX_UNDIGESTED_VERIFIED_REFS` 383, deliberately NOT raised; the
qualified-human decision of 2026-09-29 accepts the flagged state pending a future policy session. Each
artifact now carries a `landingRecord` with its adaptations and reviewer decisions; the `heldEdges` bodies
are preserved verbatim as the pre-landing record. The batch-89 (PTSD stress-flare) and batch-90
(schizophrenia tardive-dyskinesia) held sets remain held pending their own verification passes. The
section below stands unchanged as the pre-landing screening record.

Four corpus-review edges (`hypothyroidism` to `depressive-disorder`; `diabetes-mellitus-type-2` to
`depressive-disorder`; `ptsd` to `bruxism-awake-sleep`; `discoid-lupus` to `persistent-depressive-disorder`)
were fully authored on 2026-09-29 and are **held out of the knowledge base** pending qualified-human
verification of their eleven PMIDs: **34524390, 31214119, 30375372, 19033418, 11375373, 38363350,
36056716, 32577706, 30877492, 35953237, 41849118**. *(All eleven verified and landed 2026-09-29 — see
the resolution note above.)* Every primary mapping is published and the
citation-purity gate applies per suggestion, so these rows cannot enter the knowledge base as
`verified: false` at all; they are screening notes awaiting review under `docs/citation-verification-sop.md`,
not live citation rows. Two reading obligations ride with the set: the **erratum linked to PMID 36056716**
(J Oral Rehabil. 2024 May;51(5):911-914. doi:10.1111/joor.13668) must be read before that edge lands, and
the **published critique of PMID 19033418** (comment in Diabetes Care. 2009;32(5):e56, author reply e57)
must be adjudicated on the record. The complete held edges and hold dispositions are in
`docs/batch-91-hypothyroidism-depressive-disorder-held-edge.json`,
`docs/batch-91-diabetes-mellitus-type-2-depressive-disorder-held-edge.json`,
`docs/batch-91-ptsd-bruxism-awake-sleep-held-edge.json` and
`docs/batch-91-discoid-lupus-persistent-depressive-disorder-held-edge.json`, and in
`docs/condition-expansion-roadmap.md`. The two edges registered the same day (`bulimia-nervosa` to
`dental-abrasion-erosion-abfraction`, PMIDs 37834805, 26429686, 38915100; `tinnitus` to `insomnia`,
PMIDs 34708282, 38389785) carry ordinary draft-queue rows and appear in
`npm run citations:queue --include-drafts`. Run `npm run citations:queue` for the authoritative live row set.
