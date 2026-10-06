# CRG draft-identity mapping packet validation — wave 13 (2026-10-05)

## Selected pathways and artifact

1. Myositis (statin-associated immune-mediated necrotizing myopathy with anti-HMGCR autoantibodies) from statin therapy for service-connected hypertension.
2. Tarsal tunnel syndrome (posterior tibial nerve entrapment at the ankle) from service-connected type 2 diabetes mellitus.
3. Toxic epidermal necrolysis with chronic cutaneous, ocular and mucosal sequelae from allopurinol prescribed for service-connected gout.
4. Peritoneal adhesions (adhesive small bowel obstruction) following open cholecystectomy for service-connected cholelithiasis.
5. Takotsubo cardiomyopathy (stress-induced cardiomyopathy) in a veteran with service-connected post-traumatic stress disorder.

The complete requested flat array is
[crg-draft-identity-mapping-packet-wave13-2026-10-05.json](crg-draft-identity-mapping-packet-wave13-2026-10-05.json).
It has five rows, the user's eight exact mapping keys and four exact evidence-item keys, with
three references per row. This is a research/authoring proposal, **not a signed IME opinion,
patient-level nexus finding, or publication into the governed corpus**. No patient records were
supplied; no individual probability is established.

## Repository selection and direction screen

All five secondary identities were confirmed `draft: true` with **zero outgoing edges, zero
incoming edges and no governance note** before selection, and none of the chosen host files already
suggests its proposed target.

| Secondary identity | Draft | Existing outgoing | Existing incoming | Governance note | Chosen host primary |
| --- | --- | --- | --- | --- | --- |
| myositis | true | none | none | none | hypertension (published) |
| tarsal-tunnel-syndrome | true | none | none | none | diabetes-mellitus-type-2 (published) |
| toxic-epidermal-necrolysis | true | none | none | none | gout (published) |
| peritoneal-adhesions | true | none | none | none | cholelithiasis (draft) |
| takotsubo-cardiomyopathy | true | none | none | none | ptsd (published) |

Host-to-target duplicate check: the hypertension host points to chronic kidney disease, ischemic
heart disease, congestive heart failure and erectile dysfunction; the type-2-diabetes host points
to GERD, chronic kidney disease, diabetic retinopathy and depressive disorder; the gout host points
to aortic aneurysm and macular degeneration; the cholelithiasis host points only to pancreatitis;
and the PTSD host points to twenty downstream identities (sleep apnea, migraine, erectile
dysfunction, ischemic heart disease, hypertension, type 2 diabetes, depressive disorder, insomnia,
substance use disorder, metabolic syndrome, systemic lupus erythematosus, rheumatoid arthritis,
inflammatory bowel disease, multiple sclerosis, thyroiditis, irritable bowel syndrome, GERD, COPD,
REM sleep disorder and sleep bruxism). None already suggests its proposed target, so no
host-to-target edge is duplicated. No registry, catalog, authored mapping, adjacency, tracker or
application-source data is modified by this packet. Existing wave 1-12 documentation and the
completed documentation-test edits are preserved; no staging or commit is performed.

### Governance and scope controls

- **Clean-pool census.** After twelve waves, only **78** of the 679 draft identities remain both
  edge-free and deferral-free. This wave consumed five of them. The pool included
  `prostatitis`, `plantar-fasciitis`, `median-neuropathy`, `radial-neuropathy`, `vestibular-disorder`,
  `nystagmus`, `vocal-cord-dysfunction` and `sacroiliac-joint-dysfunction`; those were passed over
  for this slate only because a stronger or better-documented pathway was available for each slot,
  not because of any defect in the identities themselves.
- **A researched pathway was rejected on a governance note.** A radial-neuropathy row secondary to
  humeral-shaft fracture malunion was drafted conceptually and then dropped when
  `malunion-nonunion-of-fractures` turned out to carry a governance note; per the standing rule the
  deferral is respected rather than overridden. This is the second consecutive wave in which a
  governance note, not evidence quality, eliminated a candidate.
- **Two draft hosts are used** (`cholelithiasis`), matching the wave-11 and wave-12 precedent that
  draft targets are mandatory while draft hosts are permissible; the cholelithiasis identity's own
  publication posture remains an open governance question.
- **Pathway-quality asymmetries are disclosed rather than smoothed.** The takotsubo row is marked
  `CONTESTED_REQUIRES_SPECIFIC_EVIDENCE` for two independent reasons stated in the packet: the
  cited literature concerns psychiatric illness broadly (principally anxiety and mood disorders)
  rather than PTSD specifically, and takotsubo cardiomyopathy is characteristically transient, so a
  claim resting only on a resolved acute episode fails for want of residual disability. The
  adhesion row discloses that laparoscopic cholecystectomy carries a materially lower
  adhesion-related risk than open surgery, so the operative note is decisive. The toxic epidermal
  necrolysis row discloses that HLA-B*58:01 is neither necessary nor sufficient, and the tarsal
  tunnel row requires electrodiagnostic focal slowing so that a diffuse diabetic polyneuropathy is
  not relabeled as an entrapment.
- Three of the five rows are treatment-related (two medication, one surgical) and are pleaded as
  § 3.310(a) proximate causation of a treatment-related disability rather than as § 3.310(b)
  aggravation, and no row recommends rechallenge or unsupervised discontinuation of a prescribed
  drug.

## Medical-source identity and functional-URL checks

All 15 evidence items use canonical `https://pubmed.ncbi.nlm.nih.gov/<PMID>/` URLs and all 15 were
verified by direct PubMed article-page fetch (exact displayed title, indexed authors, abstract):
21360500, 28277343, 40347460, 30113445, 32276769, 40591366, 17919772, 21906289, 23600531, 10232313,
17330836, 29030779, 29544664, 29168538 and 38331372. Titles, author lists and journal abbreviations
are reproduced as displayed on the live records, including the multi-author byline of PMID 38331372.
No placeholder, guessed or unverified PMID is used.

| Pathway | Verified PubMed identifiers |
| --- | --- |
| Myositis ← statin therapy for hypertension | [21360500](https://pubmed.ncbi.nlm.nih.gov/21360500/), [28277343](https://pubmed.ncbi.nlm.nih.gov/28277343/), [40347460](https://pubmed.ncbi.nlm.nih.gov/40347460/) |
| Tarsal tunnel syndrome ← type 2 diabetes | [30113445](https://pubmed.ncbi.nlm.nih.gov/30113445/), [32276769](https://pubmed.ncbi.nlm.nih.gov/32276769/), [40591366](https://pubmed.ncbi.nlm.nih.gov/40591366/) |
| Toxic epidermal necrolysis ← allopurinol for gout | [17919772](https://pubmed.ncbi.nlm.nih.gov/17919772/), [21906289](https://pubmed.ncbi.nlm.nih.gov/21906289/), [23600531](https://pubmed.ncbi.nlm.nih.gov/23600531/) |
| Peritoneal adhesions ← cholecystectomy for cholelithiasis | [10232313](https://pubmed.ncbi.nlm.nih.gov/10232313/), [17330836](https://pubmed.ncbi.nlm.nih.gov/17330836/), [29030779](https://pubmed.ncbi.nlm.nih.gov/29030779/) |
| Takotsubo cardiomyopathy ← PTSD | [29544664](https://pubmed.ncbi.nlm.nih.gov/29544664/), [29168538](https://pubmed.ncbi.nlm.nih.gov/29168538/), [38331372](https://pubmed.ncbi.nlm.nih.gov/38331372/) |

Additional live-verified records inspected but not cited include 41650628 (spontaneous remission in
statin-associated HMGCR myopathy) and 28857441 (diagnostic utility of HLA-B*5801 screening in
severe cutaneous adverse reactions); they are not extra evidence rows. One searched record resolved
to a reCAPTCHA interstitial rather than a usable page and was discarded rather than cited from its
snippet. NCBI cookie and challenge responses remain possible; functional verification is
point-in-time.

### Reuse screen

An identifier-level screen of `data/evidence/master-sources.json` and
`data/evidence/master-relationships.json` was run for all 15 packet PMIDs. **None of the 15
identifiers appears in either governance-bound file**, so no substitution was required. The screen
is identifier-level only and does not certify absence of the same study under a different
identifier.

## Legal and rating checks

Live eCFR pages display Title 38 current through 2026-10-01, last amended 2026-08-27. Use
claim-period-specific criteria when adjudicating an actual claim.

- [§ 3.310](https://www.ecfr.gov/current/title-38/part-3/section-3.310): (a) proximate secondary
  causation; (b) attributable worsening beyond natural progression against a qualifying baseline.
  All five rows are § 3.310(a) rows, and each states the § 3.310(b) alternative that would govern
  if disease of the same kind were documented before the primary condition. Three rows concern
  disability produced by treatment of the service-connected condition (two medication, one
  surgical).
- [§ 3.102](https://www.ecfr.gov/current/title-38/part-3/section-3.102): approximate balance and the
  distinction between probability and speculation. The 45-of-750 antibody series, the
  44.9 percent versus 26.5 percent entrapment prevalence, the 34.6 percent ten-year adhesion-related
  readmission figure, the approximately 12 percent adhesive-obstruction recurrence rate, the 31-of-58
  anxiety history, and the up-to-43 percent psychiatric comorbidity figure are population and cohort
  statistics and are not individual nexus probabilities.
- [§ 4.71a](https://www.ecfr.gov/current/title-38/part-4/section-4.71a): **DC 5021** (myositis) and
  **DC 5017** (gout) sit in the DC 5013 through 5024 group whose note directs evaluation as
  degenerative arthritis based on limitation of motion; the packet states that proximal weakness and
  fatigue may instead require the muscle provisions of § 4.73 and § 4.56 or an analogous evaluation
  under § 4.20 and § 4.27.
- [§ 4.104](https://www.ecfr.gov/current/title-38/part-4/section-4.104): **DC 7020** (cardiomyopathy)
  is the takotsubo code and is evaluated under the General Rating Formula for Diseases of the Heart
  on symptom-limited METs, with Note (1) placing cor pulmonale with its pulmonary cause and Notes
  (2) and (3) defining METs estimation and heart failure symptoms; **DC 7101** (hypertensive
  vascular disease) governs the statin-row primary, with its three-different-days confirmation
  requirement in Note (1); **DC 7005** and **DC 7006** are named in the packet as the differential
  codes that must be excluded before a stress cardiomyopathy is accepted.
- [§ 4.119](https://www.ecfr.gov/current/title-38/part-4/section-4.119): **DC 7913** (diabetes
  mellitus) governs the tarsal tunnel primary and its note requires complications to be evaluated
  under the appropriate diagnostic code, which is the anti-double-counting hook for the entrapment
  versus polyneuropathy distinction.
- [§ 4.124a](https://www.ecfr.gov/current/title-38/part-4/section-4.124a): **DC 8525** (posterior
  tibial nerve) pays 30/20/10/10 percent, with **DC 8625** neuritis and **DC 8725** neuralgia as the
  alternatives and **DC 8524** (internal popliteal nerve (tibial)) as the proximal comparator;
  **DC 8520** (sciatic nerve) is named as the proximal differential.
- [§ 4.114](https://www.ecfr.gov/current/title-38/part-4/section-4.114): **DC 7301** (peritoneum,
  adhesions of, due to surgery, trauma, disease, or infection) provides the 80/50/30/10/0 tier
  structure used by the adhesion row, **DC 7315** (cholelithiasis, chronic) is rated as **DC 7314**
  (chronic biliary tract disease), and **DC 7318** covers cholecystectomy complications; the
  section's anti-pyramiding instruction for DCs 7301 through 7329 supports the § 4.14 statement.
- [§ 4.118](https://www.ecfr.gov/current/title-38/part-4/section-4.118): **DC 7827** (erythema
  multiforme; toxic epidermal necrolysis) supplies the recurrent-mucosal tier structure, and the
  same section's DC 7800 and DCs 7801 through 7805 supply the disfigurement and scar alternatives;
  § 4.118(b) permits combining two skin conditions only where separate areas of skin are involved.
- [§ 4.130](https://www.ecfr.gov/current/title-38/part-4/section-4.130): **DC 9411** (posttraumatic
  stress disorder) governs the takotsubo-row primary, rated under the General Rating Formula for
  Mental Disorders.
- [§ 4.20](https://www.ecfr.gov/current/title-38/part-4/section-4.20), [§ 4.27](https://www.ecfr.gov/current/title-38/part-4/section-4.27),
  [§ 4.25](https://www.ecfr.gov/current/title-38/part-4/section-4.25) and
  [§ 4.56](https://www.ecfr.gov/current/title-38/part-4/section-4.56)/[§ 4.73](https://www.ecfr.gov/current/title-38/part-4/section-4.73):
  analogous and muscle-injury evaluation provisions invoked where the schedule's analogue
  understates a documented necrotizing myopathy, and combined-rating rules for the skin rows.
- [§ 4.14](https://www.ecfr.gov/current/title-38/part-4/section-4.14): avoid pyramiding across all
  five proposals — not rating myositis twice, not using the same plantar sensory loss for both
  polyneuropathy and entrapment, not rating the same skin through both a TEN code and a scar code,
  not rating the same abdominal symptoms under both biliary and adhesion codes, and not rating the
  same heart failure symptoms under two cardiac codes or the same functional limitation under both
  a psychiatric and a cardiac evaluation.

## Schema projection (next step, not yet authored)

| Mapping | conditionId (secondary) | nexusClassification | mechanismCategory | etiologicalConsensus | vaNexusProbabilityAlignment |
| --- | --- | --- | --- | --- | --- |
| Myositis ← statin therapy for hypertension | myositis | DIRECT_CAUSATION | PHARMACOLOGICAL_IATROGENIC | IATROGENIC_TREATMENT_EFFECT | NOT_ASSERTED |
| Tarsal tunnel syndrome ← type 2 diabetes | tarsal-tunnel-syndrome | DIRECT_CAUSATION | MECHANICAL_OR_COMPRESSIVE (diabetic connective-tissue thickening at a fibro-osseous tunnel) | PROBABLE (prevalence replicated; polyneuropathy overlap requires electrodiagnosis) | NOT_ASSERTED |
| Toxic epidermal necrolysis ← allopurinol for gout | toxic-epidermal-necrolysis | DIRECT_CAUSATION | PHARMACOLOGICAL_IATROGENIC | IATROGENIC_TREATMENT_EFFECT | NOT_ASSERTED |
| Peritoneal adhesions ← cholecystectomy for cholelithiasis | peritoneal-adhesions | DIRECT_CAUSATION | POST_SURGICAL_OR_TREATMENT | WELL_ESTABLISHED (open-surgery adhesion morbidity is replicated across record-linkage cohorts) | NOT_ASSERTED |
| Takotsubo cardiomyopathy ← PTSD | takotsubo-cardiomyopathy | DIRECT_CAUSATION | PSYCHOPHYSIOLOGICAL (catecholamine-mediated stress cardiomyopathy) | CONTESTED_REQUIRES_SPECIFIC_EVIDENCE (psychiatric association is with anxiety and mood disorders broadly; transient disease) | NOT_ASSERTED |

These are vocabulary-valid proposed classifications, not approvals or individual medical findings.
No row is marked legally presumed. Every row keeps `NOT_ASSERTED` on patient-level probability
despite the explicit discussion of the "at least as likely as not" standard, because no patient
record was supplied. The takotsubo row is the contested-tier row; the packet lists well more than
the two required alternative etiologies (acute coronary syndrome and spontaneous coronary artery
dissection, pheochromocytoma, sepsis and critical illness, subarachnoid hemorrhage, thyrotoxicosis,
stimulant use, alcohol withdrawal, perioperative stress, and chemotherapy), so any authored landing
would carry `requiresSpecificDbqEvidence: true`. The two medication rows project to
`DIRECT_CAUSATION` with `PHARMACOLOGICAL_IATROGENIC` and `IATROGENIC_TREATMENT_EFFECT` because the
nexus-classification enum contains no `MEDICATION_SIDE_EFFECT` token, matching waves 9 through 12;
the user-facing `nexusTheory` field nevertheless says "Medication Side Effect" as the requested
interface requires.

The user's flat interface is **not directly accepted by the actual strict `suggestionSchema`**.
That schema requires the secondary `conditionId`, `rank`, nested `nexusClaim`, `causalMechanism`,
`evidentiaryProfile`, `rationale`, `evidenceGaps` and `sourceReferences`. Any future transformation
must author those fields separately, preserve the contested/probable disclosures, use
`verified: false` until qualified-human verification, and enforce host-level rank, catalog,
source-registry and graph rules. No schema was weakened and no governed data was landed.

## Self-audit and verification

- Exactly five mappings with three evidence records each; exact key sets, canonical PubMed URL
  syntax, uniqueness, the individualized-legal safeguard phrases, `draft: true` targets and clean
  host-target pairs are checked with a strict packet-only audit. The actual repository authored-row
  parsers (`suggestionSchema` and `conditionMappingSchema`) are also exercised to confirm and
  disclose the flat/nested incompatibility rather than hide it: both reject every flat row with a
  `conditionId`-rooted error.
- Every narrative addresses § 3.310(a) causation, § 3.310(b) aggravation with baseline and natural
  progression, the "at least as likely as not" standard, competing causes, rating scope and § 4.14
  nonpyramiding, and each states the specific record the individual nexus opinion would require
  (antibody or biopsy confirmation, electrodiagnostic focal slowing, the acute drug-attribution
  reasoning, the operative note and imaging transition point, or serial echocardiographic
  documentation of persistent dysfunction).
- Counter-evidence and limitations are retained rather than smoothed away: ordinary statin myalgia
  and self-limited toxic myopathy are distinguished from the immune-mediated disease; the Tinel sign
  alone was of imperfect validity in the cited study; HLA-B*58:01 is neither necessary nor
  sufficient across populations; laparoscopic cholecystectomy carries materially lower adhesion risk
  than open surgery; and the takotsubo literature concerns psychiatric illness broadly while the
  disease itself is characteristically transient.
- No population percentage, odds ratio or relative risk is converted into an individual
  probability. No intentional rechallenge, unsupervised medication discontinuation or
  patient-specific prescribing is requested.
- Final packet-only strict checks passed for five mappings, 15 unique canonical PubMed URLs, five
  `draft: true` targets with zero pre-existing edges, and five host-target pairs with no
  pre-existing edge. Both actual authored schema parsers reject the flat objects as expected; this is
  a disclosed incompatibility, not a repository-schema validation pass.
- The reuse screen found no governance-bound identifier among the 15 packet PMIDs. Selection
  governance was enforced upstream (edge-free and deferral-free identities only) and one researched
  pathway was dropped because its host carried a governance note.
- Final local checks under Node 22.23.2: `npm run test:doc-lint` passed **152 tests** in three
  suites, including the automatically discovered wave-13 projection table; `npm run typecheck` and
  `git diff --check` passed, and both new files are free of trailing whitespace. No build, full
  application suite or patient-interface test is claimed for this documentation-only proposal.
- Qualified clinical/legal and citation-provenance review is still required before publication.
