# CRG draft-identity mapping packet validation — wave 7 (2026-10-05)

## Selected pathways and artifact

1. Oral candidiasis ← inhaled corticosteroid treatment for service-connected asthma.
2. Achilles tendinopathy/rupture ← systemic fluoroquinolone treatment for service-connected chronic bacterial prostatitis.
3. Sensorineural hearing loss ← cisplatin treatment for service-connected testicular germ-cell cancer.
4. Hydronephrosis ← documented BPH-related bladder outlet obstruction/high-risk retention physiology.
5. Contiguous foot osteomyelitis ← infected diabetes-related foot ulcer in service-connected type 2 diabetes.

The complete requested flat array is
[crg-draft-identity-mapping-packet-wave7-2026-10-05.json](crg-draft-identity-mapping-packet-wave7-2026-10-05.json).
It has five rows, the user's eight exact mapping keys and four exact evidence-item keys, with
three references per row. This is a research/authoring proposal, **not a signed IME opinion,
patient-level nexus finding, or publication into the governed corpus**. No patient records were
supplied and no board-certification or examiner credential is claimed.

## Repository selection and direction screen

Each secondary identity's authored mapping file was read directly and remains `draft: true`.
Draft status describes that identity's outgoing file; it does not approve an incoming proposal.
Catalog identities are stored in body-system collections under `data/conditions/`, not in
one-condition-per-file paths. All ten primary/secondary identities passed the final
collection-based unique-catalog-identity check.

| Secondary identity | Draft | Existing outgoing suggestions | Existing incoming authored sources |
| --- | --- | --- | --- |
| oral-candidiasis | true | 1: ageusia, association only | oral-cancer, association only |
| achilles-tendinopathy-rupture | true | 1: deep-vein-thrombosis | none |
| hearing-loss | true | 2: cognitive-disorder and depressive-disorder, association only | labyrinthitis; otitis-media; neuroblastoma; acoustic-neuroma; granulomatosis-with-polyangiitis; oral-cancer; meningitis; paraganglioma; otosclerosis |
| hydronephrosis | true | 0 | urethral-stricture; meatal-stenosis; cystitis-or-neurogenic-bladder; aortic-aneurysm; diabetes-insipidus |
| osteomyelitis | true | 0 | actinomycosis; charcot-arthropathy; decubitus-ulcers; cellulitis, all association only |

The selected primary files do not already contain these proposed targets. Asthma, testicular
cancer, BPH and type 2 diabetes host files are published; prostatitis remains draft with a
condition-specific rebuilding TODO. No registry, catalog, mapping, adjacency, tracker or
application-source data is modified by this packet. Earlier documentation packets and the
pre-existing documentation-test edits are preserved; no staging or commit is performed.

### Governance and intermediate-chain controls

- Oral culture positivity is not clinical thrush. The existing taste-clinic association does
  not become causal because a new incoming ICS route is proposed. No esophageal-extension,
  dysphagia, invasive-candidiasis or malignant-transformation edge is authored.
- Achilles treatment attribution is agent/exposure-specific. General fluoroquinolone studies
  are not prostatitis-specific cohorts; chronic pelvic pain is not assumed to require an
  antibiotic. The actual service-connected treatment indication must be established.
- Hearing-loss governance explicitly places ototoxicity on the incoming exposure/oncology
  side. This proposal respects that direction and does not upgrade the outgoing cognitive
  or depression associations. Tinnitus and hearing loss may share cochlear injury rather
  than one necessarily causing the other.
- Hydronephrosis is an imaging consequence, not synonymous with obstruction or nephropathy.
  The withdrawn hydronephrosis-to-CKD route remains withdrawn. Review the actual BPH-related
  obstructive disorder and the existing BPH-to-CKD route for scope/redundancy.
- The catalog selection scan found no dedicated diabetic-foot-ulcer identity. Retain the
  clinical intermediate in the narrative; do not invent an ID or use `decubitus-ulcers` as
  a substitute. A future multi-hop chain or proposed shortcut needs explicit identity,
  direction, overlap and graph-governance review.
- Identifier scans of both evidence master registries and the authored mapping root found
  none of these 15 PMIDs. This is an identifier-level reuse screen, not proof that no
  differently indexed duplicate or related publication exists. Human provenance review
  remains necessary before adding source entities.
- Published host files cannot accept unverified sources through this proposal. Live machine
  verification is not qualified-human source verification under
  [citation-verification-sop.md](citation-verification-sop.md); future references remain
  `verified: false` until that process is completed.

## Medical-source identity and functional-URL checks

Every delivered source uses canonical `https://pubmed.ncbi.nlm.nih.gov/<PMID>/` syntax.
Exact displayed titles, indexed author names and abstracts were checked against live PubMed
article pages; PMID 20725547 has no indexed abstract, so its mechanism was checked in the
available PMC article body. Journal editors are not represented as authors.

| Pathway | Verified PubMed identifiers |
| --- | --- |
| ICS/oral candidiasis | [17378253](https://pubmed.ncbi.nlm.nih.gov/17378253/), [23516006](https://pubmed.ncbi.nlm.nih.gov/23516006/), [26679628](https://pubmed.ncbi.nlm.nih.gov/26679628/) |
| Fluoroquinolone/Achilles | [30465300](https://pubmed.ncbi.nlm.nih.gov/30465300/), [20725547](https://pubmed.ncbi.nlm.nih.gov/20725547/), [33371012](https://pubmed.ncbi.nlm.nih.gov/33371012/) |
| Cisplatin/hearing loss | [27354478](https://pubmed.ncbi.nlm.nih.gov/27354478/), [29384420](https://pubmed.ncbi.nlm.nih.gov/29384420/), [28115933](https://pubmed.ncbi.nlm.nih.gov/28115933/) |
| BPH/obstruction/hydronephrosis | [28163030](https://pubmed.ncbi.nlm.nih.gov/28163030/), [6407564](https://pubmed.ncbi.nlm.nih.gov/6407564/), [42095481](https://pubmed.ncbi.nlm.nih.gov/42095481/) |
| Diabetes/infected ulcer/osteomyelitis | [37779323](https://pubmed.ncbi.nlm.nih.gov/37779323/), [33916055](https://pubmed.ncbi.nlm.nih.gov/33916055/), [28465790](https://pubmed.ncbi.nlm.nih.gov/28465790/) |

Available full-text anchors inspected include
[PMC4725385](https://pmc.ncbi.nlm.nih.gov/articles/PMC4725385/) (IDSA section XVI),
[PMC2921747](https://pmc.ncbi.nlm.nih.gov/articles/PMC2921747/) (tendon mechanism uncertainty),
[PMC5223030](https://pmc.ncbi.nlm.nih.gov/articles/PMC5223030/) (cochlear oxidative/cellular injury),
[PMC1548028](https://pmc.ncbi.nlm.nih.gov/articles/PMC1548028/) (high-pressure retention),
[PMC8066570](https://pmc.ncbi.nlm.nih.gov/articles/PMC8066570/) (contiguous wound-to-bone spread), and
[PMC5394733](https://pmc.ncbi.nlm.nih.gov/articles/PMC5394733/) (diagnostic limitations).
The 2023 clinical-standard recommendations and diabetes/foot-infection physiology were additionally
read on the [official IDSA guideline page](https://www.idsociety.org/practice-guideline/diabetic-foot-infections/).
These full-text versions are not extra independent studies or evidence rows.

NCBI extraction and some background fetches returned HTTP 203 cookie/challenge pages; those
were **not counted as verified article bodies**. Direct Chromium navigation obtained the needed
PMC pages. Final small PubMed batches returned HTTP 200 with title/author/abstract selectors,
and direct navigation confirmed 20725547's title, PMID and sole author. One oversized browser
batch exceeded the tool's ten-second evaluation limit; its unseen result was not counted and
bounded batches were rerun successfully. Functional verification is point-in-time, not a
promise that NCBI will never challenge future readers.

## Legal and rating checks

Live eCFR pages display Title 38 current through 2026-10-01, last amended 2026-08-27.
Use claim-period-specific criteria when adjudicating an actual claim; these are current
research anchors, not an assertion of retroactive applicability.

- [§ 3.310](https://www.ecfr.gov/current/title-38/part-3/section-3.310): (a) proximate secondary
  causation; (b) an attributable increase beyond natural progression with qualifying baseline
  evidence. Medication side effects are treatment-mediated causation/aggravation, not an
  additional statutory presumption or a separate repository nexus enum.
- [§ 3.102](https://www.ecfr.gov/current/title-38/part-3/section-3.102): reasonable doubt arises
  from approximate balance, not speculation. General mechanisms, prevalence, odds ratios and
  relative risks cannot directly establish an individual's probability.
- [§ 4.97](https://www.ecfr.gov/current/title-38/part-4/section-4.97): asthma DC 6602;
  inhaled and systemic corticosteroid criteria are distinct.
- [§ 4.150](https://www.ecfr.gov/current/title-38/part-4/section-4.150): no dedicated
  candidiasis code. Dental bone loss, neoplasms and TMJ criteria are not thrush criteria.
  [§ 4.20](https://www.ecfr.gov/current/title-38/part-4/section-4.20) and
  [§ 4.27](https://www.ecfr.gov/current/title-38/part-4/section-4.27) require a justified
  analogous function/localization/symptom selection and appropriate built-up coding;
  no invented specific comparator or automatic rating is supplied for this unlisted disorder.
- [§ 4.71a](https://www.ecfr.gov/current/title-38/part-4/section-4.71a): DC 5024 explicitly
  includes tendinopathy, evaluated on limitation of motion; DC 5271 describes ankle limitation.
  Rupture residuals are not automatically degenerative arthritis.
  [§ 4.73](https://www.ecfr.gov/current/title-38/part-4/section-4.73) DC 5311 covers Group XI
  propulsion/plantar flexion and is only a possible justified rupture-residual analogy.
- [§ 4.115b](https://www.ecfr.gov/current/title-38/part-4/section-4.115b): current DC 7525
  includes chronic prostatitis; DC 7527 includes prostate hypertrophy and outlet obstruction;
  DC 7528 covers GU malignancy; DC 7509 covers hydronephrosis and refers severe cases to renal
  dysfunction. [§ 4.115a](https://www.ecfr.gov/current/title-38/part-4/section-4.115a)
  controls UTI/voiding/renal criteria and allows separate distinct nonoverlapping disability,
  not duplicate dysfunction from multiple diagnoses.
- [§ 3.385](https://www.ecfr.gov/current/title-38/part-3/section-3.385): hearing-loss disability
  thresholds at 500–4000 Hz/Maryland CNC. Extended 8–12-kHz research loss alone is insufficient.
  [§ 4.85](https://www.ecfr.gov/current/title-38/part-4/section-4.85) gives audiology and
  table-based rating requirements for DC 6100; [§ 4.86](https://www.ecfr.gov/current/title-38/part-4/section-4.86)
  applies only to specified exceptional patterns. DC 6100 is also referenced in
  [§ 4.87](https://www.ecfr.gov/current/title-38/part-4/section-4.87)'s tinnitus note.
- [§ 4.119](https://www.ecfr.gov/current/title-38/part-4/section-4.119): diabetes DC 7913
  and Note (1) on compensable complications. Osteomyelitis DC 5000 under § 4.71a has specific
  recurrence/activity and post-cure/resection notes; no blanket inactive-infection rating.
- [§ 4.14](https://www.ecfr.gov/current/title-38/part-4/section-4.14): avoid pyramiding
  across all five proposals.

## Schema projection (next step, not yet authored)

| Mapping | conditionId (secondary) | nexusClassification | mechanismCategory | etiologicalConsensus | vaNexusProbabilityAlignment |
| --- | --- | --- | --- | --- | --- |
| Oral candidiasis ← ICS for asthma | oral-candidiasis | DIRECT_CAUSATION | PHARMACOLOGICAL_IATROGENIC | IATROGENIC_TREATMENT_EFFECT | NOT_ASSERTED |
| Achilles injury ← fluoroquinolone for bacterial prostatitis | achilles-tendinopathy-rupture | DIRECT_CAUSATION (conditional exposure-specific proposal) | PHARMACOLOGICAL_IATROGENIC | CONTESTED_REQUIRES_SPECIFIC_EVIDENCE (agent-specific results and confounding) | NOT_ASSERTED |
| Sensorineural loss ← cisplatin for testicular cancer | hearing-loss | DIRECT_CAUSATION | PHARMACOLOGICAL_IATROGENIC | IATROGENIC_TREATMENT_EFFECT | NOT_ASSERTED |
| Hydronephrosis ← demonstrated BPH outlet obstruction | hydronephrosis | DIRECT_CAUSATION | MECHANICAL_OR_COMPRESSIVE | WELL_ESTABLISHED (demonstrated pressure-mediated obstruction only) | NOT_ASSERTED |
| Foot osteomyelitis ← diabetes-related infected ulcer | osteomyelitis | DIRECT_CAUSATION | INFECTIOUS_SPREAD (conditional intermediate chain) | WELL_ESTABLISHED (contiguous infection, not diabetes alone) | NOT_ASSERTED |

These are vocabulary-valid proposal classifications, not approvals or individual medical
findings. The Achilles row is conservatively contested despite the recognized treatment-effect
window; a future contested evidentiary profile requires at least two alternative etiologies and
`requiresSpecificDbqEvidence: true` under the live schema. No direct-causation proposal should be
forced into a proven individual edge without its exposure/diagnosis/chain evidence.

The user's flat interface is **not directly accepted by the actual strict `suggestionSchema`**.
That schema requires secondary `conditionId`, `rank`, nested `nexusClaim`, `causalMechanism`,
`evidentiaryProfile`, `rationale`, `evidenceGaps` and `sourceReferences`. A future transformation
must author these fields and preserve limits rather than merely rename keys. Medication rows
project to the appropriate causation/aggravation arm, never a fabricated `MEDICATION_SIDE_EFFECT`
classification. Each conditional aggravation alternative needs separate `baselineProgression`
and `aggravatingFactor` narratives, not two theories crammed into one discriminated-union row.
All projected patient-probability fields remain `NOT_ASSERTED`; human source verification,
host rank, catalog identity, graph integrity and publication gates remain unmet by this packet.
No schema was weakened and no governed data was landed.

## Self-audit and verification

- Exactly five mappings with three evidence records each; exact key sets, nonempty strings,
  canonical PubMed URL format and uniqueness are checked with a strict packet-only Zod schema.
  The actual repository authored-row parse is also tested to confirm and disclose the mismatch.
- All narratives explicitly address causation, conditional aggravation/baseline/natural course,
  individualized 'at least as likely as not' reasoning, competing causes and nonpyramiding.
- No study is represented as proving every veteran's nexus. Reviews/guidelines are distinguished
  from original studies. The Achilles conflicting cohort, candidiasis prescribing-proxy limit,
  hearing-definition null comparison, selected old retention series and diabetic-colonization/
  Charcot distinctions are retained.
- No population odds/relative risk is converted into a patient-specific probability. No
  permanence requirement is added to secondary aggravation. No intentional rechallenge,
  unsupervised medication cessation or patient-specific prescription is requested.
- Current prostatitis DC 7525 is used rather than automatically using prostate-hypertrophy
  DC 7527. Oral candidiasis is honestly unlisted. Tendinopathy DC 5024 is distinguished from
  rupture residual analogies. ASHA/WHO audiometry is not substituted for VA criteria.
- Final packet-only strict Zod and catalog/draft/direction checks passed for five mappings,
  15 unique canonical PubMed URLs, ten unique catalog identities and the patient-evidence
  safeguards. Both actual authored schema parsers reject the flat objects as expected;
  this is a disclosed incompatibility, not a repository-schema validation pass.
- The first ad hoc audit failed on inconsistent capitalization of the no-probability sentence;
  a rerun also required the hearing row to explicitly identify natural progression. Both
  narrative repairs were made and the full audit rerun passed. The first combined shell
  command continued after failure; subsequent checks used `set -e`, preserving failures.
- Final local checks under Node 22.23.2: `npm run test:doc-lint` passed **146 tests** in three
  suites, including the automatically discovered wave-7 projection table; `npm run typecheck`
  and `git diff --check` passed. No build, full application suite or patient-interface test is
  claimed for this documentation-only proposal. The interface tests parse the saved JSON with
  strict Zod and verify its rejection by the actual authored interface.
- Qualified clinical/legal and citation-provenance review is still required before publication.
