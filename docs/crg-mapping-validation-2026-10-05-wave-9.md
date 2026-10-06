# CRG draft-identity mapping packet validation — wave 9 (2026-10-05)

## Selected pathways and artifact

1. Dental erosion (tooth-surface loss) with progression to tooth loss ← service-connected GERD with oral acid regurgitation.
2. Stress urinary incontinence (cough-induced leakage) ← service-connected COPD with documented chronic cough.
3. Urge urinary incontinence (overactive bladder from diabetic neurogenic bladder dysfunction) ← service-connected type 2 diabetes with autonomic neuropathy.
4. Pleural effusion (heart-failure-associated transudate) ← service-connected congestive heart failure.
5. Rotator cuff tear with residual shoulder impairment (degenerative, diabetes-associated) ← service-connected type 2 diabetes mellitus.

The complete requested flat array is
[crg-draft-identity-mapping-packet-wave9-2026-10-05.json](crg-draft-identity-mapping-packet-wave9-2026-10-05.json).
It has five rows, the user's eight exact mapping keys and four exact evidence-item keys, with
three references per row. This is a research/authoring proposal, **not a signed IME opinion,
patient-level nexus finding, or publication into the governed corpus**. No patient records were
supplied; no individual probability is established.

## Repository selection and direction screen

All five secondary identities were confirmed `draft: true` in the authored corpus. This wave
reaches identities that waves 1-8 did not use, and it deliberately splits the undifferentiated
`urinary-incontinence` family into the granular draft identities (`stress-urinary-incontinence`,
`urge-urinary-incontinence`) rather than re-using the generic file.

| Secondary identity | Draft | Existing outgoing | Existing incoming | Chosen host primary |
| --- | --- | --- | --- | --- |
| dental-abrasion-erosion-abfraction | true | dentin-hypersensitivity (association only) | bulimia-nervosa (association only; intrinsic-acid route) | gerd (published) |
| stress-urinary-incontinence | true | depressive-disorder (association only) | none | copd (published) |
| urge-urinary-incontinence | true | none | none | diabetes-mellitus-type-2 (published) |
| pleural-effusion | true | pulmonary-hypertension (bounded) | amebic-liver-abscess; broncho-alveolar-carcinoma; liver-abscess; lung-abscess; lymphangioleiomyomatosis; pleura-cancer; pleurisy | congestive-heart-failure (published) |
| rotator-cuff-tear | true | none | none | diabetes-mellitus-type-2 (published) |

Host-to-target duplicate check: none of the host files (gerd, copd, congestive-heart-failure,
diabetes-mellitus-type-2) already suggests its proposed target. The gerd host currently points
only to pulmonary targets (asthma, bronchiectasis, copd, interstitial-lung-disease,
pulmonary-fibrosis, respiratory-cancer, tuberculosis); copd points to sleep-apnea and
pulmonary-hypertension; congestive-heart-failure points to depressive-disorder; and
diabetes-mellitus-type-2 points to gerd, chronic-kidney-disease, diabetic-retinopathy and
depressive-disorder. No wave-9 target repeats a target used in waves 1-8. No registry, catalog,
authored mapping, adjacency, tracker or application-source data is modified by this packet.
Existing wave 1-8 documentation and the completed documentation-test edits are preserved; no
staging or commit is performed.

### Governance and scope controls

- Dental erosion: the identity already receives an association-only **bulimia nervosa** edge
  (intrinsic gastric acid from vomiting). The reflux route proposed here is a different acid
  source reaching the same targets and must be reconciled for scope, not treated as additive
  proof. The gerd host is published and requires host-side review.
- Stress urinary incontinence: the identity's own authored edge is an association-only outcome
  edge to depressive disorder; this incoming cough-mechanical route is a distinct direction. The
  cough/COPD literature is largely cross-sectional or interventional, so the row is marked
  PROBABLE rather than well established.
- Urge urinary incontinence: no incoming or outgoing edges exist. The diabetes cluster in the
  corpus (neuropathy, gastroparesis, nephropathy, retinopathy) is a metabolic pattern; this row
  adds the genitourinary autonomic arm and must not be merged with the generic
  `urinary-incontinence` identity without host review.
- Pleural effusion: the identity already receives association-only edges from infective and
  malignant pleural sources. Heart failure is the leading cause in the cited hospital survey, so
  the cardiac route is not a duplicate of those infective/malignant routes, but competing
  etiologies must be separated clinically and the row remains a proposal only.
- Rotator cuff tear: the separate `rotator-cuff-injury` identity already receives associations
  from bicipital tendinitis and SLAP tear; the tear identity itself has no edges. Because
  age-related degeneration and discrete trauma are strong competing explanations for any single
  tear, this row is conservatively marked CONTESTED_REQUIRES_SPECIFIC_EVIDENCE and would require
  at least two alternative etiologies to rule out plus `requiresSpecificDbqEvidence: true` in any
  authored landing.

## Medical-source identity and functional-URL checks

All 15 evidence items use canonical `https://pubmed.ncbi.nlm.nih.gov/<PMID>/` URLs. Seven records
were verified by direct PubMed article-page fetch (exact displayed title, indexed authors,
abstract): 30564013, 33571021, 37226650, 36576376, 19574887, 35257948 and 34223408. Eight records
were verified on their PMC article pages, from which the canonical PMID was extracted from the
`citation_pmid` metadata and the abstract text was read from the article body (PMC meta abstract
tags were frequently empty): 24738088 (PMC3986576), 33644221 (PMC7897843), 34895285
(PMC8665568), 21833175 (PMC3153010), 24709194 (PMC4426965), 33197694 (PMC10248950), 30406935
(PMC8015984) and 36299460 (PMC9588920). Additional live-verified records (35917996 on GERD and
dental erosion in children, 30366709 on urinary incontinence in obstructive lung disease, 38505011
on cardiac pleural effusions, 32995347 on diabetic rotator-cuff repair outcomes) were inspected
but not used, and one initially guessed identifier (33604537) resolved to an unrelated article
and was discarded rather than cited. No placeholder, guessed or unverified PMID is used.

| Pathway | Verified PubMed identifiers |
| --- | --- |
| Dental erosion ← GERD | [30564013](https://pubmed.ncbi.nlm.nih.gov/30564013/), [33571021](https://pubmed.ncbi.nlm.nih.gov/33571021/), [24738088](https://pubmed.ncbi.nlm.nih.gov/24738088/) |
| Stress urinary incontinence ← COPD chronic cough | [37226650](https://pubmed.ncbi.nlm.nih.gov/37226650/), [33644221](https://pubmed.ncbi.nlm.nih.gov/33644221/), [34895285](https://pubmed.ncbi.nlm.nih.gov/34895285/) |
| Urge urinary incontinence ← type 2 diabetes | [21833175](https://pubmed.ncbi.nlm.nih.gov/21833175/), [24709194](https://pubmed.ncbi.nlm.nih.gov/24709194/), [33197694](https://pubmed.ncbi.nlm.nih.gov/33197694/) |
| Pleural effusion ← congestive heart failure | [36576376](https://pubmed.ncbi.nlm.nih.gov/36576376/), [19574887](https://pubmed.ncbi.nlm.nih.gov/19574887/), [30406935](https://pubmed.ncbi.nlm.nih.gov/30406935/) |
| Rotator cuff tear ← type 2 diabetes | [35257948](https://pubmed.ncbi.nlm.nih.gov/35257948/), [36299460](https://pubmed.ncbi.nlm.nih.gov/36299460/), [34223408](https://pubmed.ncbi.nlm.nih.gov/34223408/) |

Full-text anchors inspected include [PMC3986576](https://pmc.ncbi.nlm.nih.gov/articles/PMC3986576/),
[PMC7897843](https://pmc.ncbi.nlm.nih.gov/articles/PMC7897843/),
[PMC8665568](https://pmc.ncbi.nlm.nih.gov/articles/PMC8665568/),
[PMC3153010](https://pmc.ncbi.nlm.nih.gov/articles/PMC3153010/),
[PMC4426965](https://pmc.ncbi.nlm.nih.gov/articles/PMC4426965/),
[PMC10248950](https://pmc.ncbi.nlm.nih.gov/articles/PMC10248950/),
[PMC8015984](https://pmc.ncbi.nlm.nih.gov/articles/PMC8015984/),
[PMC7502797](https://pmc.ncbi.nlm.nih.gov/articles/PMC7502797/) and
[PMC9588920](https://pmc.ncbi.nlm.nih.gov/articles/PMC9588920/). These full texts are not extra
independent studies or additional evidence rows. Discovery was performed by web search and every
chosen record was then fetched individually; an unrelated record returned by a guessed identifier
was discarded. Intermittent NCBI bot/cookie challenges remain possible; functional verification is
point-in-time. An identifier-level screen of `data/evidence/master-sources.json` and
`data/evidence/master-relationships.json` found no reuse of any of the 15 wave-9 PMIDs.

## Legal and rating checks

Live eCFR pages display Title 38 current through 2026-10-01, last amended 2026-08-27. Use
claim-period-specific criteria when adjudicating an actual claim.

- [§ 3.310](https://www.ecfr.gov/current/title-38/part-3/section-3.310): (a) proximate secondary
  causation; (b) attributable worsening beyond natural progression against a qualifying baseline.
  All five rows are direct causation of a new disability, so § 3.310(a) governs; § 3.310(b) is
  addressed only as a contingency if a pre-existing condition is asserted to have worsened.
- [§ 3.102](https://www.ecfr.gov/current/title-38/part-3/section-3.102): approximate balance and
  the distinction between probability and speculation. Population prevalence, odds ratios and
  relative risks cited here are not individual nexus probabilities.
- [§ 4.114](https://www.ecfr.gov/current/title-38/part-4/section-4.114): DC 7206 gastroesophageal
  reflux disease is the published host code for the dental-erosion route.
- [§ 4.97](https://www.ecfr.gov/current/title-38/part-4/section-4.97): DC 6604 chronic obstructive
  pulmonary disease is the host code for the incontinence route; **DC 6845 chronic pleural
  effusion or fibrosis** sits within the Restrictive Lung Disease general rating formula, which
  also permits rating the primary disorder instead. There is no dedicated code for dental erosion
  or for stress urinary incontinence in Part 4.
- [§ 4.115a](https://www.ecfr.gov/current/title-38/part-4/section-4.115a): the voiding-dysfunction
  schedule supplies tiers for "Continual Urine Leakage, Post Surgical Urinary Diversion, Urinary
  Incontinence, or Stress Incontinence" (20/40/60 percent by absorbent-material requirement) plus
  urgency/frequency and obstructed-voiding tiers, but it is reached only through a listed
  diagnostic code.
- [§ 4.115b](https://www.ecfr.gov/current/title-38/part-4/section-4.115b): **DC 7542 neurogenic
  bladder** rates as voiding dysfunction or urinary tract infection, whichever predominates, and
  is the anchor for the diabetic autonomic route; DC 7527 covers prostate disease and bladder
  outlet obstruction. No code designates stress incontinence as a diagnosis, so that row needs a
  § 4.20 analogy (DC 7542 or DC 7517 as candidates only).
- [§ 4.119](https://www.ecfr.gov/current/title-38/part-4/section-4.119): DC 7913 diabetes mellitus
  with Note (1) requiring that compensable complications be evaluated separately unless used to
  support the 100-percent criteria; the same section's DC 7911 is not relevant to this wave.
- [§ 4.150](https://www.ecfr.gov/current/title-38/part-4/section-4.150): **DC 9913** (teeth, loss
  of, due to loss of substance of body of maxilla or mandible) covers the tooth-loss end point but
  its note expressly excludes alveolar loss from periodontal disease; there is no enamel/dentin
  erosion code, so an erosion-only presentation requires a justified § 4.20 analogy.
- [§ 4.104](https://www.ecfr.gov/current/title-38/part-4/section-4.104): there is no dedicated
  "congestive heart failure" code; heart failure is evaluated under the General Rating Formula for
  Diseases of the Heart reached through the etiologic code (for example DC 7005 arteriosclerotic
  heart disease or DC 7007 hypertensive heart disease), with cor pulmonale evaluated as part of
  the pulmonary condition that causes it.
- [§ 4.71a](https://www.ecfr.gov/current/title-38/part-4/section-4.71a): **DC 5201** (arm,
  limitation of motion) is the shoulder-limitation route for the rotator cuff tear.
- [§ 4.73](https://www.ecfr.gov/current/title-38/part-4/section-4.73): **DC 5304 (Muscle Group
  IV)** names the rotator cuff muscles (supraspinatus; infraspinatus and teres minor;
  subscapularis) and is rated by the § 4.56 severity criteria;
  [§ 4.59](https://www.ecfr.gov/current/title-38/part-4/section-4.59) requires painful motion to
  be considered.
- [§ 4.20](https://www.ecfr.gov/current/title-38/part-4/section-4.20) and
  [§ 4.27](https://www.ecfr.gov/current/title-38/part-4/section-4.27): any code for dental erosion
  and for stress incontinence must be justified by analogous function, localization and symptoms
  and built up properly; no built-up code or automatic minimum rating is invented.
- [§ 4.14](https://www.ecfr.gov/current/title-38/part-4/section-4.14): avoid pyramiding across all
  five proposals, including not using the same leakage, breathlessness, tooth loss or limitation
  of motion to support two evaluations.

## Schema projection (next step, not yet authored)

| Mapping | conditionId (secondary) | nexusClassification | mechanismCategory | etiologicalConsensus | vaNexusProbabilityAlignment |
| --- | --- | --- | --- | --- | --- |
| Dental erosion ← GERD | dental-abrasion-erosion-abfraction | DIRECT_CAUSATION | MULTIFACTORIAL (acid-mediated dissolution) | WELL_ESTABLISHED (population reflux-erosion association) | NOT_ASSERTED |
| Stress urinary incontinence ← COPD chronic cough | stress-urinary-incontinence | DIRECT_CAUSATION | MECHANICAL_OR_COMPRESSIVE (cough pressure transmission) | PROBABLE (observational and treatment-trial evidence) | NOT_ASSERTED |
| Urge urinary incontinence ← type 2 diabetes | urge-urinary-incontinence | DIRECT_CAUSATION | MICROVASCULAR_METABOLIC (diabetic autonomic neuropathy) | WELL_ESTABLISHED (diabetes-related bladder dysfunction) | NOT_ASSERTED |
| Pleural effusion ← congestive heart failure | pleural-effusion | DIRECT_CAUSATION | THROMBOTIC_OR_VASCULAR (hydrostatic transudation) | WELL_ESTABLISHED | NOT_ASSERTED |
| Rotator cuff tear ← type 2 diabetes | rotator-cuff-tear | DIRECT_CAUSATION | MICROVASCULAR_METABOLIC (glycation and microangiopathy) | CONTESTED_REQUIRES_SPECIFIC_EVIDENCE (degenerative and traumatic alternatives require specific evidence) | NOT_ASSERTED |

These are vocabulary-valid proposed classifications, not approvals or individual medical findings.
No row is marked legally presumed. Every row keeps `NOT_ASSERTED` on patient-level probability
despite the explicit discussion of the "at least as likely as not" standard. No
`MEDICATION_SIDE_EFFECT` token exists in the repo's `nexusClassification` enum; this wave used no
medication/treatment-effect route, so that mapping question does not arise here.

The user's flat interface is **not directly accepted by the actual strict `suggestionSchema`**.
That schema requires the secondary `conditionId`, `rank`, nested `nexusClaim`, `causalMechanism`,
`evidentiaryProfile`, `rationale`, `evidenceGaps` and `sourceReferences`. A future transformation
must author those fields separately, preserve the contested/probable disclosures, use
`verified: false` until qualified-human verification, honour the contested-tier requirement of at
least two alternative etiologies plus `requiresSpecificDbqEvidence: true`, and enforce host-level
rank, catalog, source-registry and graph rules. No schema was weakened and no governed data was
landed.

## Self-audit and verification

- Exactly five mappings with three evidence records each; exact key sets, canonical PubMed URL
  syntax, uniqueness and the individualized-legal safeguard phrases are checked with a strict
  packet-only Zod schema. The actual repository authored-row parsers (`suggestionSchema` and
  `conditionMappingSchema`) are also exercised to confirm and disclose the flat/nested
  incompatibility rather than hide it: both reject every flat row with a `conditionId`-rooted
  error.
- Every narrative addresses § 3.310(a) causation, conditional § 3.310(b) aggravation with
  baseline and natural progression, the "at least as likely as not" standard, competing causes,
  rating scope and § 4.14 nonpyramiding.
- Counter-evidence and limitations are retained: dental erosion prevalence in GERD about 48.81
  percent versus 20.48 percent in one systematic review with a 10.6-42 percent range; stress
  incontinence reported by 42.13 percent of surveyed women with 63.3 percent in a chronic-cough
  clinic series; diabetic bladder dysfunction ranging from overactive bladder and urge
  incontinence to overflow incontinence; heart failure responsible for 37.4 percent of effusions
  in one hospital survey with 20-25 percent of heart-failure effusions showing exudative
  chemistry; and rotator cuff disease associations that remain observational with a rat-model
  mechanism only.
- No population percentage, odds ratio or relative risk is converted into an individual
  probability. No intentional rechallenge, unsupervised medication discontinuation or
  patient-specific prescribing is requested. The rotator cuff row is retained as contested
  because age-related degeneration and discrete trauma are strong competing explanations for a
  single tear.
- Final packet-only strict checks passed for five mappings, 15 unique canonical PubMed URLs, five
  `draft: true` targets, and five clean host-target pairs. Both actual authored schema parsers
  reject the flat objects as expected; this is a disclosed incompatibility, not a
  repository-schema validation pass.
- One earlier inline audit run reported false non-canonical URL failures. The cause was shell
  quoting stripping the backslash from the `\d` digit class in the inline Node expression, not a
  defect in the packet; the audit was moved into a script file with string-based canonical-URL
  checks and the corrected run passed. The failure output was inspected and diagnosed, not
  swallowed or worked around by loosening the URL test.
- Final local checks under Node 22.23.2: `npm run test:doc-lint` passed **148 tests** in three
  suites, including the automatically discovered wave-9 projection table; `npm run typecheck` and
  `git diff --check` passed. No build, full application suite or patient-interface test is claimed
  for this documentation-only proposal.
- Qualified clinical/legal and citation-provenance review is still required before publication.
