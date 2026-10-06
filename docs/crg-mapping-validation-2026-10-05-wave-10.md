# CRG draft-identity mapping packet validation — wave 10 (2026-10-05)

## Selected pathways and artifact

1. Aortic aneurysm (ascending, thoracic or abdominal) aggravated by chronic service-connected hypertension.
2. Trigger finger (stenosing flexor tenosynovitis) associated with service-connected type 2 diabetes mellitus.
3. Xerostomia from maintenance inhaled anticholinergic therapy for service-connected COPD.
4. Acquired flatfoot (pes planus with hindfoot valgus) due to service-connected rheumatoid arthritis.
5. Femoral neuropathy (diabetic lumbosacral radiculoplexus neuropathy / diabetic amyotrophy) from service-connected type 2 diabetes.

The complete requested flat array is
[crg-draft-identity-mapping-packet-wave10-2026-10-05.json](crg-draft-identity-mapping-packet-wave10-2026-10-05.json).
It has five rows, the user's eight exact mapping keys and four exact evidence-item keys, with
three references per row. This is a research/authoring proposal, **not a signed IME opinion,
patient-level nexus finding, or publication into the governed corpus**. No patient records were
supplied; no individual probability is established.

## Repository selection and direction screen

All five secondary identities were confirmed `draft: true` in the authored corpus. No wave-10
target repeats any target used in waves 1-9, and none of the chosen host files already suggests
its proposed target.

| Secondary identity | Draft | Existing outgoing | Existing incoming | Chosen host primary |
| --- | --- | --- | --- | --- |
| aortic-aneurysm | true | valvular-heart-disease; hydronephrosis | gout; tuberculosis (association only) | hypertension (published) |
| trigger-finger | true | none | dupuytren-s-contracture (association only) | diabetes-mellitus-type-2 (published) |
| xerostomia | true | none | salivary-gland-cancer; sialadenitis; sialolithiasis | copd (published) |
| flatfoot | true | osteoarthritis (association only) | none | rheumatoid-arthritis (published) |
| femoral-neuropathy | true | unexplained-chronic-pain | none | diabetes-mellitus-type-2 (published) |

Host-to-target duplicate check: the hypertension host points to chronic kidney disease, ischemic
heart disease, congestive heart failure and erectile dysfunction; the type-2-diabetes host points
to GERD, chronic kidney disease, diabetic retinopathy and depressive disorder; the COPD host
points to sleep apnea and pulmonary hypertension; and the rheumatoid-arthritis host points to
depressive disorder and GERD. None already suggests its proposed target. No registry, catalog,
authored mapping, adjacency, tracker or application-source data is modified by this packet.
Existing wave 1-9 documentation and the completed documentation-test edits are preserved; no
staging or commit is performed.

### Governance and scope controls

- Aortic aneurysm: this is the first AGGRAVATION-theory row in the series. It invokes the
  § 3.310(b) baseline-plus-increment structure against age-related aortic degeneration and is
  marked CONTESTED_REQUIRES_SPECIFIC_EVIDENCE because smoking, age, male sex and genetic aortic
  disease are dominant competing drivers; any authored landing would require at least two
  alternative etiologies plus `requiresSpecificDbqEvidence: true`. The identity already carries
  gout and tuberculosis inbound associations and outbound suggestions to valvular heart disease
  and hydronephrosis, so this vascular-host route must be reconciled against that posture.
- Trigger finger: the identity already receives an association-only edge from Dupuytren
  contracture, and that corpus row is supported in part by a governance-bound source
  (PMID 7722249). That source was therefore **excluded** here (see the reuse screen below) and
  replaced with a different verified diabetes-specific study; the two routes (fibroproliferative
  co-occurrence versus diabetic metabolic tenosynovial change) are distinct and must not be
  merged.
- Xerostomia: the medication route is new; the identity's existing inbound edges are
  salivary-gland cancer, sialadenitis and sialolithiasis. Because Part 4 has no xerostomia code,
  the row explicitly declines to invent one.
- Flatfoot: the identity's only existing edge is an outbound association to osteoarthritis. The
  rheumatoid route is a different upstream driver and is supported by radiographic and
  genetic-instrumental evidence.
- Femoral neuropathy: the identity has only an outbound suggestion to unexplained chronic pain.
  This row deliberately distinguishes focal diabetic lumbosacral radiculoplexus neuropathy from
  the repository's separate distal symmetric polyneuropathy proposal so the same weakness and
  sensory loss are not double-counted.

## Medical-source identity and functional-URL checks

All 15 evidence items use canonical `https://pubmed.ncbi.nlm.nih.gov/<PMID>/` URLs. Seven of the
cited records were verified by direct PubMed article-page fetch (exact displayed title, indexed
authors, abstract): 27521823, 36994346, 19687073, 17166984, 11083677, 12022347 and 11932965.
Eight cited records were verified on their PMC article pages, from which the canonical PMID was
extracted from `citation_pmid` metadata and the abstract was read from the article body (PMC meta
abstract tags were frequently empty): 30903463 (PMC6497813), 30544688 (PMC6313801), 31456430
(PMC8283119), 39403528 (PMC11472086), 39421746 (PMC11484279), 41053714 (PMC12502487), 30760636
(PMC6511105) and 33653898 (PMC8166449). Additional live-verified records inspected but not cited
include 36634078 (medication-induced xerostomia cohort) plus 24360881, 33832915, 32590518 and
36540448 (other diabetes, trigger-finger and radiculoplexus studies). No placeholder, guessed or
unverified PMID is used.

| Pathway | Verified PubMed identifiers |
| --- | --- |
| Aortic aneurysm ← hypertension | [30903463](https://pubmed.ncbi.nlm.nih.gov/30903463/), [30544688](https://pubmed.ncbi.nlm.nih.gov/30544688/), [27521823](https://pubmed.ncbi.nlm.nih.gov/27521823/) |
| Trigger finger ← type 2 diabetes | [36994346](https://pubmed.ncbi.nlm.nih.gov/36994346/), [19687073](https://pubmed.ncbi.nlm.nih.gov/19687073/), [31456430](https://pubmed.ncbi.nlm.nih.gov/31456430/) |
| Xerostomia ← inhaled anticholinergic for COPD | [17166984](https://pubmed.ncbi.nlm.nih.gov/17166984/), [11083677](https://pubmed.ncbi.nlm.nih.gov/11083677/), [39403528](https://pubmed.ncbi.nlm.nih.gov/39403528/) |
| Acquired flatfoot ← rheumatoid arthritis | [12022347](https://pubmed.ncbi.nlm.nih.gov/12022347/), [39421746](https://pubmed.ncbi.nlm.nih.gov/39421746/), [41053714](https://pubmed.ncbi.nlm.nih.gov/41053714/) |
| Femoral neuropathy ← type 2 diabetes | [30760636](https://pubmed.ncbi.nlm.nih.gov/30760636/), [11932965](https://pubmed.ncbi.nlm.nih.gov/11932965/), [33653898](https://pubmed.ncbi.nlm.nih.gov/33653898/) |

Full-text anchors inspected include [PMC6497813](https://pmc.ncbi.nlm.nih.gov/articles/PMC6497813/),
[PMC6313801](https://pmc.ncbi.nlm.nih.gov/articles/PMC6313801/),
[PMC11472086](https://pmc.ncbi.nlm.nih.gov/articles/PMC11472086/),
[PMC11484279](https://pmc.ncbi.nlm.nih.gov/articles/PMC11484279/),
[PMC12502487](https://pmc.ncbi.nlm.nih.gov/articles/PMC12502487/),
[PMC8283119](https://pmc.ncbi.nlm.nih.gov/articles/PMC8283119/),
[PMC6511105](https://pmc.ncbi.nlm.nih.gov/articles/PMC6511105/) and
[PMC8166449](https://pmc.ncbi.nlm.nih.gov/articles/PMC8166449/). These full texts are not extra
independent studies or additional evidence rows. Intermittent NCBI bot/cookie challenges remain
possible; functional verification is point-in-time.

### Reuse screen and exclusion

An identifier-level screen of `data/evidence/master-sources.json` and
`data/evidence/master-relationships.json` was run for all candidate PMIDs. It found that
**PMID 7722249 (Chammas 1995) is already a governance-bound source**, referenced by the authored
relationship `rel-dupuytren-s-contracture-to-trigger-finger` under
`data/evidence/master-relationships.json`. That record was therefore removed from the trigger
finger row and replaced with PMID 19687073 (Koh et al.), which is not present in the governance
files; the other fourteen wave-10 PMIDs returned no matches. This mirrors the standing rule that
governance-bound corpus rows and their sources are not reused or landed by this packet.

## Legal and rating checks

Live eCFR pages display Title 38 current through 2026-10-01, last amended 2026-08-27. Use
claim-period-specific criteria when adjudicating an actual claim.

- [§ 3.310](https://www.ecfr.gov/current/title-38/part-3/section-3.310): (a) proximate secondary
  causation; (b) attributable worsening beyond natural progression against a qualifying baseline.
  Four rows are direct causation under § 3.310(a); the aortic-aneurysm row is asserted as
  § 3.310(b) aggravation of pre-existing aortic degeneration, with § 3.310(a) preserved as the
  alternative framing.
- [§ 3.102](https://www.ecfr.gov/current/title-38/part-3/section-3.102): approximate balance and
  the distinction between probability and speculation. The 66 percent and 1.55 relative-risk
  estimates and the adverse-event reporting counts cited here are not individual nexus
  probabilities.
- [§ 4.104](https://www.ecfr.gov/current/title-38/part-4/section-4.104): DC 7101 hypertensive
  vascular disease governs the primary; **DC 7110** covers aortic aneurysm (ascending, thoracic
  or abdominal) and pays 100 percent only at 5 centimeters or larger, when symptomatic, or when
  surgery is required, otherwise 0 percent. The section also directs that hypertension be
  evaluated separately from heart disease.
- [§ 4.119](https://www.ecfr.gov/current/title-38/part-4/section-4.119): DC 7913 diabetes
  mellitus with Note (1) requiring separate evaluation of compensable complications unless used
  for the 100-percent criteria — the anchor for both diabetes rows.
- [§ 4.97](https://www.ecfr.gov/current/title-38/part-4/section-4.97): DC 6604 chronic obstructive
  pulmonary disease is the host code for the inhaled-anticholinergic xerostomia route.
- [§ 4.71a](https://www.ecfr.gov/current/title-38/part-4/section-4.71a): **DC 5024** covers
  tenosynovitis/tendinitis/tendinosis/tendinopathy with the Note to DCs 5013-5024 directing
  evaluation as degenerative arthritis on limitation of motion; DC 5229 and DC 5230 rate
  digit-specific limitation; **DC 5276** is the dedicated acquired-flatfoot code; DC 5002 and
  DC 5003 govern active and residual rheumatoid arthritis.
- [§ 4.124a](https://www.ecfr.gov/current/title-38/part-4/section-4.124a): **DC 8526 (anterior
  crural nerve (femoral))** rates femoral-nerve paralysis at 40 percent complete, 30 severe
  incomplete, 20 moderate and 10 mild, with DC 8626 neuritis as the alternative for a
  predominantly painful-inflammatory presentation. The same section's DC 8045 note also confirms
  that a residual with a distinct diagnosis is separately evaluated.
- [§ 4.20](https://www.ecfr.gov/current/title-38/part-4/section-4.20) and
  [§ 4.27](https://www.ecfr.gov/current/title-38/part-4/section-4.27): the xerostomia row must use
  a justified analogous code (or be evaluated with the respiratory condition) because no
  xerostomia diagnostic code exists; no rated value is invented.
- [§ 4.14](https://www.ecfr.gov/current/title-38/part-4/section-4.14): avoid pyramiding across all
  five proposals — not rating the same blood-pressure consequences, finger triggering or motion
  loss, dryness, foot deformity or quadriceps weakness twice.

## Schema projection (next step, not yet authored)

| Mapping | conditionId (secondary) | nexusClassification | mechanismCategory | etiologicalConsensus | vaNexusProbabilityAlignment |
| --- | --- | --- | --- | --- | --- |
| Aortic aneurysm ← hypertension | aortic-aneurysm | AGGRAVATION | THROMBOTIC_OR_VASCULAR (pressure-mediated wall remodeling) | CONTESTED_REQUIRES_SPECIFIC_EVIDENCE (smoking, age and genetic drivers dominate) | NOT_ASSERTED |
| Trigger finger ← type 2 diabetes | trigger-finger | DIRECT_CAUSATION | MICROVASCULAR_METABOLIC (glycated flexor tendon sheath) | WELL_ESTABLISHED | NOT_ASSERTED |
| Xerostomia ← inhaled anticholinergic for COPD | xerostomia | DIRECT_CAUSATION | PHARMACOLOGICAL_IATROGENIC | IATROGENIC_TREATMENT_EFFECT | NOT_ASSERTED |
| Acquired flatfoot ← rheumatoid arthritis | flatfoot | DIRECT_CAUSATION | BIOMECHANICAL_ALTERATION (inflammatory arch collapse) | WELL_ESTABLISHED | NOT_ASSERTED |
| Femoral neuropathy ← type 2 diabetes | femoral-neuropathy | DIRECT_CAUSATION | MICROVASCULAR_METABOLIC (ischemic microvasculitis) | PROBABLE (population incidence established) | NOT_ASSERTED |

These are vocabulary-valid proposed classifications, not approvals or individual medical findings.
No row is marked legally presumed. Every row keeps `NOT_ASSERTED` on patient-level probability
despite the explicit discussion of the "at least as likely as not" standard. The AGGRAVATION row
is vocabulary-valid because the repo's `nexusClassification` enum contains `AGGRAVATION`; the
medication row still uses `DIRECT_CAUSATION` with `PHARMACOLOGICAL_IATROGENIC` and
`IATROGENIC_TREATMENT_EFFECT` because no `MEDICATION_SIDE_EFFECT` token exists.

The user's flat interface is **not directly accepted by the actual strict `suggestionSchema`**.
That schema requires the secondary `conditionId`, `rank`, nested `nexusClaim`, `causalMechanism`,
`evidentiaryProfile`, `rationale`, `evidenceGaps` and `sourceReferences`. Any future
transformation must author those fields separately, preserve the contested/probable
disclosures, use `verified: false` until qualified-human verification, honour the contested-tier
requirement of at least two alternative etiologies plus `requiresSpecificDbqEvidence: true`, and
enforce host-level rank, catalog, source-registry and graph rules. No schema was weakened and no
governed data was landed.

## Self-audit and verification

- Exactly five mappings with three evidence records each; exact key sets, canonical PubMed URL
  syntax, uniqueness and the individualized-legal safeguard phrases are checked with a strict
  packet-only audit. The actual repository authored-row parsers (`suggestionSchema` and
  `conditionMappingSchema`) are also exercised to confirm and disclose the flat/nested
  incompatibility rather than hide it: both reject every flat row with a `conditionId`-rooted
  error.
- Every narrative addresses § 3.310(a) causation, § 3.310(b) aggravation with baseline and
  natural progression, the "at least as likely as not" standard, competing causes, rating scope
  and § 4.14 nonpyramiding.
- Counter-evidence and limitations are retained: hypertension raises aneurysm risk by about 66
  percent while not being associated with expansion rate in meta-analysis (Takagi); diabetic
  trigger finger is graded by insulin dependence and disease duration without an individual risk
  estimate; the tiotropium dry-mouth signal is trial-pooled (relative risk 3.60) and a
  spontaneous-reporting signal; the rheumatoid-flatfoot evidence spans radiographic series and a
  Mendelian-randomization instrument that cannot attribute one veteran's arch collapse; and
  lumbosacral radiculoplexus neuropathy has an incidence of roughly 4.16 per 100,000
  person-years with a recognized nondiabetic form.
- No population percentage, odds ratio or relative risk is converted into an individual
  probability. No intentional rechallenge, unsupervised medication discontinuation or
  patient-specific prescribing is requested.
- Final packet-only strict checks passed for five mappings, 15 unique canonical PubMed URLs, five
  `draft: true` targets, and five clean host-target pairs. Both actual authored schema parsers
  reject the flat objects as expected; this is a disclosed incompatibility, not a
  repository-schema validation pass.
- The reuse screen removed one candidate source (PMID 7722249) because it is already
  governance-bound to the authored Dupuytren-to-trigger-finger relationship; the packet uses
  PMID 19687073 in its place. The exclusion was applied to the packet, not documented away.
- Final local checks under Node 22.23.2: `npm run test:doc-lint` passed **149 tests** in three
  suites, including the automatically discovered wave-10 projection table; `npm run typecheck`
  and `git diff --check` passed, and both new files are free of trailing whitespace. No build,
  full application suite or patient-interface test is claimed for this documentation-only
  proposal.
- Qualified clinical/legal and citation-provenance review is still required before publication.
