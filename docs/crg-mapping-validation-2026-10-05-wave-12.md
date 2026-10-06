# CRG draft-identity mapping packet validation — wave 12 (2026-10-05)

## Selected pathways and artifact

1. Osteomalacia (renal osteodystrophy mineralization defect) from service-connected chronic kidney disease.
2. Vocal cord paralysis (recurrent laryngeal nerve palsy) following thyroidectomy for service-connected nontoxic thyroid enlargement.
3. Tendinopathy (fluoroquinolone-associated tendinitis, tendinosis or rupture) from antibiotic treatment of service-connected chronic prostatitis.
4. Raynaud's syndrome (secondary Raynaud's phenomenon with digital ulceration) from service-connected systemic sclerosis.
5. Subacute cutaneous lupus erythematosus (drug-induced) from hydrochlorothiazide prescribed for service-connected hypertension.

The complete requested flat array is
[crg-draft-identity-mapping-packet-wave12-2026-10-05.json](crg-draft-identity-mapping-packet-wave12-2026-10-05.json).
It has five rows, the user's eight exact mapping keys and four exact evidence-item keys, with
three references per row. This is a research/authoring proposal, **not a signed IME opinion,
patient-level nexus finding, or publication into the governed corpus**. No patient records were
supplied; no individual probability is established.

## Repository selection and direction screen

All five secondary identities were confirmed `draft: true` in the authored corpus, and each was
required to carry **zero outgoing edges, zero incoming edges and no governance note** before
selection, so that no deferral is overridden and no diagnostic-presentation restatement is
proposed. No wave-12 target repeats any target used in waves 1-11, and none of the chosen host
files already suggests its proposed target.

| Secondary identity | Draft | Existing outgoing | Existing incoming | Governance note | Chosen host primary |
| --- | --- | --- | --- | --- | --- |
| osteomalacia | true | none | none | none | chronic-kidney-disease (published) |
| vocal-cord-paralysis | true | none | none | none | nontoxic-thyroid-enlargement (draft) |
| tendinopathy | true | none | osgood-schlatter-disease | none | prostatitis (draft) |
| raynauds-syndrome | true | none | none | none | scleroderma (draft) |
| subacute-cutaneous-lupus | true | none | none | none | hypertension (published) |

Host-to-target duplicate check: the chronic-kidney-disease host points only to anemia and
congestive heart failure; the nontoxic-thyroid-enlargement host points only to hypoparathyroidism;
the prostatitis host has no outgoing edges; the scleroderma host points only to
interstitial-lung-disease; and the hypertension host points to chronic kidney disease, ischemic
heart disease, congestive heart failure and erectile dysfunction. None already suggests its
proposed target, so no host-to-target edge is duplicated. No registry, catalog, authored mapping,
adjacency, tracker or application-source data is modified by this packet. Existing wave 1-11
documentation and the completed documentation-test edits are preserved; no staging or commit is
performed.

### Governance and scope controls

- **The single most consequential selection decision was a rejection.** A
  Wernicke-Korsakoff-syndrome row secondary to service-connected alcohol use disorder was
  researched and **dropped before authoring** on two independent grounds. First,
  `alcohol-use-disorder` carries an authored governance note stating that it was created with zero
  suggestions by design and that it is "the standing confounding-exposure vocabulary for hepatic,
  psychiatric, trauma and pancreatic routes," with the instruction that "every liver or mood claim
  must evaluate alcohol exposure as a rival etiology before attribution." Using that identity as a
  *primary* host would invert its authored governance role, which is exactly the kind of override
  this series must not perform. Second, the live § 4.130 schedule contains no substance-use
  disorder diagnostic code: the enumerated codes run 9201 through 9440 with no alcohol- or
  drug-use entry, so the host could not be cited to a Part 4 code without inventing one.
  Wernicke-Korsakoff syndrome itself would rate under **DC 9326** (major or mild neurocognitive
  disorder due to another medical condition or substance/medication-induced major or mild
  neurocognitive disorder), which was verified live but is not used in this packet.
- Four other candidate pathways from the clean pool (`pericardial-effusion`, `pulmonary-edema`,
  `cubital-tunnel-syndrome`, `common-peroneal-neuropathy`) remain excluded by the explicit corpus
  deferrals documented in the wave-11 record, and `periodontitis` remains excluded because a
  periodontitis-to-diabetes association edge is already authored and a diabetes-to-periodontitis
  edge would risk a directional cycle in a deliberately single-direction DAG.
- Two draft hosts are used (`nontoxic-thyroid-enlargement`, `prostatitis`), matching the wave-11
  precedent that draft targets are mandatory while draft hosts are permissible; their own
  publication posture remains an open governance question.
- Chronic kidney disease has **no free-standing Part 4 diagnostic code**, so the primary citation
  routes through DC 7530 and DC 7502, each rated as renal dysfunction, with § 4.115a supplying the
  evaluation criteria. This is stated in the packet rather than smoothed over, and no code was
  invented.
- The osteomalacia row is a deliberate three-way differential: osteoporosis, osteomalacia and
  renal osteodystrophy coexist in chronic kidney disease, and the packet requires bone-biopsy-class
  or biochemical evidence of defective mineralization rather than accepting a dual-energy
  x-ray absorptiometry result alone, because bone mineral density is unreliable in advanced kidney
  disease.
- Both medication rows are pleaded as § 3.310(a) proximate causation of treatment-related
  disability rather than as § 3.310(b) aggravation, and each states that an individual opinion
  requires the actual prescription record, the exposure-to-onset chronology, and objective
  findings, and that no rechallenge or unsupervised discontinuation is recommended.

## Medical-source identity and functional-URL checks

All 15 evidence items use canonical `https://pubmed.ncbi.nlm.nih.gov/<PMID>/` URLs. Fourteen cited
records were verified by direct PubMed article-page fetch (exact displayed title, indexed authors,
abstract): 33774081, 30298663, 32809577, 19335706, 22989215, 41047809, 31270563, 36147351,
40005998, 32099191, 16987831, 3873891, 21039412 and 20693204. One record, 35566614 (Maciejewska,
Raynaud's Phenomenon with Focus on Systemic Sclerosis), was verified on its PMC article page
(PMC9105786), from which the canonical PMID was extracted from `citation_pmid` metadata and the
abstract was read from the article body; its PubMed identifier is the one cited. Titles are
reproduced as displayed, including the journal's own hyphenation ("Fluoroquinolone-associated
suspected tendonitis and tendon rupture: A pharmacovigilance analysis from 2016 to 2021 based on
the FAERS database") and the StatPearls chapter title. No placeholder, guessed or unverified PMID
is used.

| Pathway | Verified PubMed identifiers |
| --- | --- |
| Osteomalacia ← chronic kidney disease | [33774081](https://pubmed.ncbi.nlm.nih.gov/33774081/), [30298663](https://pubmed.ncbi.nlm.nih.gov/30298663/), [32809577](https://pubmed.ncbi.nlm.nih.gov/32809577/) |
| Vocal cord paralysis ← thyroidectomy for thyroid enlargement | [19335706](https://pubmed.ncbi.nlm.nih.gov/19335706/), [22989215](https://pubmed.ncbi.nlm.nih.gov/22989215/), [41047809](https://pubmed.ncbi.nlm.nih.gov/41047809/) |
| Tendinopathy ← fluoroquinolone therapy for chronic prostatitis | [31270563](https://pubmed.ncbi.nlm.nih.gov/31270563/), [36147351](https://pubmed.ncbi.nlm.nih.gov/36147351/), [40005998](https://pubmed.ncbi.nlm.nih.gov/40005998/) |
| Raynaud's syndrome ← systemic sclerosis | [32099191](https://pubmed.ncbi.nlm.nih.gov/32099191/), [16987831](https://pubmed.ncbi.nlm.nih.gov/16987831/), [35566614](https://pubmed.ncbi.nlm.nih.gov/35566614/) |
| Subacute cutaneous lupus erythematosus ← hydrochlorothiazide for hypertension | [3873891](https://pubmed.ncbi.nlm.nih.gov/3873891/), [21039412](https://pubmed.ncbi.nlm.nih.gov/21039412/), [20693204](https://pubmed.ncbi.nlm.nih.gov/20693204/) |

Full-text anchor inspected during verification: [PMC9105786](https://pmc.ncbi.nlm.nih.gov/articles/PMC9105786/).
Additional live-verified records inspected but not cited include 25589780 (Wernicke-Korsakoff
syndrome not related to alcohol use) and PMC10393093 (Wernicke encephalopathy narrative review)
from the abandoned alcohol-use-disorder pathway, and PMC11297402 (molecule-stratified Achilles
tendon meta-analysis) from the fluoroquinolone pathway; they are not extra evidence rows, and the
abandoned pathway's sources are not repurposed to support a different row. One Google result for
the fluoroquinolone mechanism review returned an NCBI reCAPTCHA interstitial, and the record was
therefore verified on its PubMed page instead; functional verification is point-in-time.

### Reuse screen

An identifier-level screen of `data/evidence/master-sources.json` and
`data/evidence/master-relationships.json` was run for all 15 packet PMIDs. **None of the 15
identifiers appears in either governance-bound file**, so no substitution was required. The screen
is identifier-level only and does not certify absence of the same study under a different
identifier. This mirrors the standing rule that governance-bound corpus rows and their sources are
not reused or landed by this packet.

## Legal and rating checks

Live eCFR pages display Title 38 current through 2026-10-01, last amended 2026-08-27. Use
claim-period-specific criteria when adjudicating an actual claim.

- [§ 3.310](https://www.ecfr.gov/current/title-38/part-3/section-3.310): (a) proximate secondary
  causation; (b) attributable worsening beyond natural progression against a qualifying baseline.
  All five rows are § 3.310(a) rows, and each states the § 3.310(b) alternative that would govern
  if pre-existing disease of the same kind were documented before the primary condition. The two
  medication rows and the post-thyroidectomy row are pleaded as proximate causation of a
  treatment-related disability, which is the § 3.310(a) framing, not as aggravation.
- [§ 3.102](https://www.ecfr.gov/current/title-38/part-3/section-3.102): approximate balance and the
  distinction between probability and speculation. The 9.8 percent temporary and 2.3 percent
  permanent recurrent laryngeal palsy rates, the 0.3-3 percent permanent-palsy range, the
  approximately 2.9 percent permanent vocal cord palsy incidence, the approximately 80 percent
  Ro/SS-A positivity in drug-induced SCLE, and the more-than-40 implicated drugs are population and
  case-series statistics and are not individual nexus probabilities.
- [§ 4.71a](https://www.ecfr.gov/current/title-38/part-4/section-4.71a): **DC 5014** covers
  osteomalacia, residuals of, and the note to DCs 5013 through 5024 directs those diseases to be
  evaluated as degenerative arthritis on limitation of motion; **DC 5024** covers tenosynovitis,
  tendinitis, tendinosis or tendinopathy under the same note; **DC 5271** supplies ankle
  limitation-of-motion evaluation for an Achilles injury. Because osteomalacia presents with bone
  pain, myopathy and fracture rather than joint limitation, the packet states that an analogous
  evaluation under § 4.20 and § 4.27 may be required.
- [§ 4.115a](https://www.ecfr.gov/current/title-38/part-4/section-4.115a) and
  [§ 4.115b](https://www.ecfr.gov/current/title-38/part-4/section-4.115b): **DC 7530** (chronic
  renal disease requiring regular dialysis) and **DC 7502** (nephritis, chronic) are each rated as
  renal dysfunction, and **DC 7537** (interstitial nephritis, including disorders of calcium
  metabolism) is the alternative renal code; **DC 7525** (prostatitis, urethritis, epididymitis,
  orchitis, chronic only) is rated as urinary tract infection and is the host code for the
  fluoroquinolone row. The schedule contains no free-standing chronic-kidney-disease code.
- [§ 4.97](https://www.ecfr.gov/current/title-38/part-4/section-4.97): **DC 6516** (laryngitis,
  chronic) pays 30/10 percent on hoarseness findings; **DC 6519** (aphonia, complete organic) pays
  100/60 percent, and its note directs that incomplete aphonia be evaluated as DC 6516; **DC 6520**
  (larynx, stenosis of, including residuals of laryngeal trauma) and **DC 6518** (laryngectomy,
  total) with its partial-laryngectomy residual instruction complete the laryngeal scheme.
- [§ 4.119](https://www.ecfr.gov/current/title-38/part-4/section-4.119): **DC 7902** (thyroid
  enlargement, nontoxic) governs the host, with Note (1) requiring pressure symptoms to be
  evaluated under the appropriate code in the appropriate body system and Note (2) permitting
  separate disfigurement evaluation under DC 7800.
- [§ 4.104](https://www.ecfr.gov/current/title-38/part-4/section-4.104): **DC 7117** (Raynaud's
  syndrome, also known as secondary Raynaud's phenomenon) pays 100/60/40/20/10 percent by ulcer,
  auto-amputation and attack frequency, and is expressly the secondary-Raynaud's code;
  **DC 7124** (Raynaud's disease, primary Raynaud's) pays only 10/0 percent and must not be used
  for a secondary claim; **DC 7122** (cold injury residuals) note directs separate evaluation of
  Raynaud's syndrome unless those findings already support an evaluation under that code; and
  **DC 7101** (hypertensive vascular disease) is the hypertension host code with its
  three-different-days confirmation requirement in Note (1).
- [§ 4.118](https://www.ecfr.gov/current/title-38/part-4/section-4.118): **DC 7821** (cutaneous
  manifestations of collagen-vascular diseases not listed elsewhere) expressly names scleroderma,
  calcinosis cutis, **subacute cutaneous lupus erythematosus** and dermatomyositis and directs
  evaluation under the General Rating Formula for the Skin; **DC 7809** (discoid lupus
  erythematosus) is the alternative code and its note bars combination with the systemic lupus
  code; and § 4.118(b) permits combining two skin conditions only where separate areas of skin are
  involved.
- [§ 4.130](https://www.ecfr.gov/current/title-38/part-4/section-4.130): verified live and used only
  to document that no substance-use disorder code exists in the mental-disorder schedule and that
  **DC 9326** is the neurocognitive code that would apply to Wernicke-Korsakoff syndrome; no row in
  this packet rests on that code.
- [§ 4.20](https://www.ecfr.gov/current/title-38/part-4/section-4.20) and
  [§ 4.27](https://www.ecfr.gov/current/title-38/part-4/section-4.27): invoked for osteomalacia and
  for tendinopathy where the schedule's analogue understates a documented fracture or tendon
  rupture; no rated value is invented.
- [§ 4.14](https://www.ecfr.gov/current/title-38/part-4/section-4.14): avoid pyramiding across all
  five proposals — not rating mineralization disease twice, laryngeal findings under two laryngeal
  codes, the same tendon limitation twice, digital vasospasm under both DC 7117 and the cold-injury
  code, or an SCLE rating combined with another skin rating for the same skin.

## Schema projection (next step, not yet authored)

| Mapping | conditionId (secondary) | nexusClassification | mechanismCategory | etiologicalConsensus | vaNexusProbabilityAlignment |
| --- | --- | --- | --- | --- | --- |
| Osteomalacia ← chronic kidney disease | osteomalacia | DIRECT_CAUSATION | METABOLIC_OR_NUTRITIONAL (CKD-mineral and bone disorder mineralization defect) | WELL_ESTABLISHED (CKD-MBD is a recognized syndrome) | NOT_ASSERTED |
| Vocal cord paralysis ← thyroidectomy for thyroid enlargement | vocal-cord-paralysis | DIRECT_CAUSATION | POST_SURGICAL_OR_TREATMENT (recurrent laryngeal nerve injury) | WELL_ESTABLISHED (anatomically described, incidence replicated) | NOT_ASSERTED |
| Tendinopathy ← fluoroquinolone for chronic prostatitis | tendinopathy | DIRECT_CAUSATION | PHARMACOLOGICAL_IATROGENIC | IATROGENIC_TREATMENT_EFFECT | NOT_ASSERTED |
| Raynaud's syndrome ← systemic sclerosis | raynauds-syndrome | DIRECT_CAUSATION | THROMBOTIC_OR_VASCULAR (obliterative digital vasculopathy) | WELL_ESTABLISHED (occurs in virtually all systemic sclerosis patients) | NOT_ASSERTED |
| Subacute cutaneous lupus erythematosus ← hydrochlorothiazide for hypertension | subacute-cutaneous-lupus | DIRECT_CAUSATION | PHARMACOLOGICAL_IATROGENIC | IATROGENIC_TREATMENT_EFFECT | NOT_ASSERTED |

These are vocabulary-valid proposed classifications, not approvals or individual medical findings.
No row is marked legally presumed. Every row keeps `NOT_ASSERTED` on patient-level probability
despite the explicit discussion of the "at least as likely as not" standard, because no patient
record was supplied. The two medication rows project to `DIRECT_CAUSATION` with
`PHARMACOLOGICAL_IATROGENIC` and `IATROGENIC_TREATMENT_EFFECT` because the nexus-classification enum
contains no `MEDICATION_SIDE_EFFECT` token, matching the wave-9, wave-10 and wave-11 medication
rows; the packet's user-facing `nexusTheory` field nevertheless says "Medication Side Effect" as
the requested interface requires.

The user's flat interface is **not directly accepted by the actual strict `suggestionSchema`**.
That schema requires the secondary `conditionId`, `rank`, nested `nexusClaim`, `causalMechanism`,
`evidentiaryProfile`, `rationale`, `evidenceGaps` and `sourceReferences`. Any future
transformation must author those fields separately, preserve the contested/probable disclosures,
use `verified: false` until qualified-human verification, and enforce host-level rank, catalog,
source-registry and graph rules. No schema was weakened and no governed data was landed.

## Self-audit and verification

- Exactly five mappings with three evidence records each; exact key sets, canonical PubMed URL
  syntax, uniqueness, the individualized-legal safeguard phrases, `draft: true` targets and clean
  host-target pairs are checked with a strict packet-only audit. The actual repository authored-row
  parsers (`suggestionSchema` and `conditionMappingSchema`) are also exercised to confirm and
  disclose the flat/nested incompatibility rather than hide it: both reject every flat row with a
  `conditionId`-rooted error.
- **A real defect was found and repaired by this audit rather than waived.** Two rows initially
  rendered the required safeguard sentence with a comma instead of its terminal period
  ("No individual probability is asserted here, and no intentional rechallenge..."), which the
  literal-phrase check rejected; the packet was corrected to the exact required sentence. The
  check was not loosened.
- Every narrative addresses § 3.310(a) causation, § 3.310(b) aggravation with baseline and natural
  progression, the "at least as likely as not" standard, competing causes, rating scope and § 4.14
  nonpyramiding. Each row states the specific record the individual nexus opinion would require
  (bone histology or biochemical evidence, preoperative and postoperative laryngoscopy, the
  prescription record and exposure-to-onset chronology, classification features of systemic
  sclerosis with attack documentation, or dermatologic confirmation with drug-withdrawal response).
- Counter-evidence and limitations are retained rather than smoothed away: Duman et al. state that
  the exact molecular mechanisms of fluoroquinolone tendon toxicity remain unclear; the
  pharmacovigilance analysis reports suspected rather than adjudicated associations; the
  laryngeal-palsy rates are population incidences that do not establish cause in one veteran and
  are confounded by case mix and by the absence of routine preoperative laryngoscopy; and the
  osteomalacia row must exclude vitamin D deficiency, malabsorption, anticonvulsant exposure and
  coexisting osteoporosis rather than relabeling osteoporosis as osteomalacia. One cited source
  (32809577) is a StatPearls review chapter rather than a primary study, which is disclosed here.
- No population percentage, odds ratio or relative risk is converted into an individual
  probability. No intentional rechallenge, unsupervised medication discontinuation or
  patient-specific prescribing is requested.
- Final packet-only strict checks passed for five mappings, 15 unique canonical PubMed URLs, five
  `draft: true` targets with zero pre-existing edges, and five host-target pairs with no
  pre-existing edge. Both actual authored schema parsers reject the flat objects as expected; this
  is a disclosed incompatibility, not a repository-schema validation pass.
- The reuse screen found no governance-bound identifier among the 15 packet PMIDs. Selection
  governance was enforced upstream: only identities with zero edges and no governance note were
  eligible, and the one researched pathway that would have made a designated confounding-exposure
  identity into a primary host was dropped with its research recorded above.
- Final local checks under Node 22.23.2: `npm run test:doc-lint` passed **151 tests** in three
  suites, including the automatically discovered wave-12 projection table; `npm run typecheck` and
  `git diff --check` passed, and both new files are free of trailing whitespace. No build, full
  application suite or patient-interface test is claimed for this documentation-only proposal.
- Qualified clinical/legal and citation-provenance review is still required before publication.
