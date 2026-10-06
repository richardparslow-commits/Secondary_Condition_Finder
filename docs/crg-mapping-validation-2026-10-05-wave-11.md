# CRG draft-identity mapping packet validation — wave 11 (2026-10-05)

## Selected pathways and artifact

1. Cholelithiasis (chronic gallstone disease) due to service-connected cirrhosis of the liver.
2. Fibromyalgia (primary fibromyalgia syndrome) from service-connected hypothyroidism.
3. Meniere's disease (secondary endolymphatic hydrops) following service-connected traumatic brain injury residuals.
4. Dry eye syndrome / ocular surface disease from service-connected hyperthyroidism (Graves' disease).
5. Meralgia paresthetica (external cutaneous nerve of thigh neuropathy) from service-connected type 2 diabetes mellitus.

The complete requested flat array is
[crg-draft-identity-mapping-packet-wave11-2026-10-05.json](crg-draft-identity-mapping-packet-wave11-2026-10-05.json).
It has five rows, the user's eight exact mapping keys and four exact evidence-item keys, with
three references per row. This is a research/authoring proposal, **not a signed IME opinion,
patient-level nexus finding, or publication into the governed corpus**. No patient records were
supplied; no individual probability is established.

## Repository selection and direction screen

All five secondary identities were confirmed `draft: true` in the authored corpus. No wave-11
target repeats any target used in waves 1-10, and none of the chosen host files already suggests
its proposed target.

| Secondary identity | Draft | Existing outgoing | Existing incoming | Chosen host primary |
| --- | --- | --- | --- | --- |
| cholelithiasis | true | pancreatitis | erythropoietic-protoporphyria; somatostatinoma | cirrhosis-of-the-liver (published) |
| fibromyalgia | true | depressive-disorder | none | hypothyroidism (published) |
| menieres-disease | true | none | none | traumatic-brain-injury-residuals (draft) |
| dry-eye-syndrome | true | insomnia; depressive-disorder | ichthyosis; rosacea; sjogren-s-syndrome; stevens-johnson-syndrome | hyperthyroidism (published) |
| meralgia-paresthetica | true | none | none | diabetes-mellitus-type-2 (published) |

Host-to-target duplicate check: the cirrhosis host points only to osteoporosis; the
hypothyroidism host points to tinnitus and depressive disorder; the traumatic-brain-injury
residuals host points only to depressive disorder; the hyperthyroidism host points to
hypothyroidism and cardiac arrhythmia; and the type-2-diabetes host points to GERD, chronic
kidney disease, diabetic retinopathy and depressive disorder. None already suggests its proposed
target, so no host-to-target edge is duplicated. No registry, catalog, authored mapping,
adjacency, tracker or application-source data is modified by this packet. Existing wave 1-10
documentation and the completed documentation-test edits are preserved; no staging or commit is
performed.

### Governance and scope controls

- Four candidate pathways were **dropped after governance review rather than authored**, because
  their target identities carry explicit deferral records that this packet must not override:
  `pericardial-effusion` (D1 batch 70 deferral — located literature is dialysis/secondary-etiology
  cohort class and the congestive-heart-failure relationship is dominantly reverse-direction),
  `pulmonary-edema` (D1 batch 76 deferral — intermediate-manifestation semantics with zero
  quantified edema-specific downstream outcomes), `cubital-tunnel-syndrome` (ME-41
  phenotype-identity barrier — it *is* the ulnar compression neuropathy), and
  `common-peroneal-neuropathy` (same phenotype-identity barrier). `hallux-rigidus` and
  `piriformis-syndrome` were also deferred on constitutive-identity and proximity grounds.
  `periodontitis` was excluded because the corpus already authors a periodontitis-to-diabetes
  association edge, so a diabetes-to-periodontitis edge would risk a directional cycle in a DAG
  that the authors deliberately left single-direction and `hypothesizedOnly: true`.
- Meniere's disease: this is the strongest CFR-supported landing in the packet, because DC 8045
  itself directs that a residual with a distinct diagnosis "such as migraine headache or
  Meniere's disease" be evaluated separately rather than under the traumatic-brain-injury table.
  The host is itself still `draft: true`, so host publication posture remains an open governance
  question.
- Dry eye syndrome: the identity carries a governance guard recording a documented reverse
  direction (poor sleep aggravating dry eye) plus four existing inbound associates (ichthyosis,
  rosacea, Sjogren's syndrome, Stevens-Johnson syndrome). Those routes are ichthyosis-related,
  acne-rosacea-related, autoimmune-sicca and drug-eruption related; the Graves' orbitopathy route
  proposed here is a distinct immune-mediated upstream driver and must not be merged with them.
- Fibromyalgia and meralgia paresthetica are both marked contested in the projection below
  because their key supporting studies define populations by thyroid autoimmunity rather than
  documented hypothyroidism, and by hospital referral rather than diabetes registries,
  respectively. Both therefore carry at least two alternative etiologies to rule out and would
  require `requiresSpecificDbqEvidence: true` on any authored landing.
- Cholelithiasis: the citation to DC 7315 points through DC 7314, which pays 0 percent when
  asymptomatic. Most cirrhosis-associated pigment stones remain asymptomatic, so the packet
  explicitly states that the rating value may be 0 percent and that service connection is
  frequently the real relief sought.

## Medical-source identity and functional-URL checks

All 15 evidence items use canonical `https://pubmed.ncbi.nlm.nih.gov/<PMID>/` URLs. Twelve cited
records were verified by direct PubMed article-page fetch (exact displayed title, indexed authors,
abstract): 9361181, 38382725, 28176037, 34369360, 27905199, 24782951, 9386247, 28511974, 38697741,
35535063, 26605355 and 21975198. The remaining three records — 28306649 (Ferster, secondary
endolymphatic hydrops), 25584018 (Selter) and 35167950 (Rana) — were verified on their PMC article
pages (PMC5425947, PMC4287254 and PMC9058200), from which the canonical PMID was extracted from
`citation_pmid` metadata and the abstract was read from the article body, because PMC meta abstract
tags are frequently empty; each of those identifiers resolves to a PubMed record. Manuscript titles used in the packet were reconciled against
the live displayed titles, so punctuation differences such as the journal's hyphenation in
"Gallstone Disease in Cirrhosis-Pathogenesis and Management" are reproduced as displayed. No
placeholder, guessed or unverified PMID is used.

| Pathway | Verified PubMed identifiers |
| --- | --- |
| Cholelithiasis ← cirrhosis of the liver | [9361181](https://pubmed.ncbi.nlm.nih.gov/9361181/), [35535063](https://pubmed.ncbi.nlm.nih.gov/35535063/), [38382725](https://pubmed.ncbi.nlm.nih.gov/38382725/) |
| Fibromyalgia ← hypothyroidism | [28176037](https://pubmed.ncbi.nlm.nih.gov/28176037/), [34369360](https://pubmed.ncbi.nlm.nih.gov/34369360/), [27905199](https://pubmed.ncbi.nlm.nih.gov/27905199/) |
| Meniere's disease ← traumatic brain injury residuals | [28306649](https://pubmed.ncbi.nlm.nih.gov/28306649/), [24782951](https://pubmed.ncbi.nlm.nih.gov/24782951/), [9386247](https://pubmed.ncbi.nlm.nih.gov/9386247/) |
| Dry eye syndrome ← hyperthyroidism (Graves' disease) | [25584018](https://pubmed.ncbi.nlm.nih.gov/25584018/), [35167950](https://pubmed.ncbi.nlm.nih.gov/35167950/), [26605355](https://pubmed.ncbi.nlm.nih.gov/26605355/) |
| Meralgia paresthetica ← type 2 diabetes | [21975198](https://pubmed.ncbi.nlm.nih.gov/21975198/), [28511974](https://pubmed.ncbi.nlm.nih.gov/28511974/), [38697741](https://pubmed.ncbi.nlm.nih.gov/38697741/) |

Full-text anchors inspected while verifying include
[PMC9077239](https://pmc.ncbi.nlm.nih.gov/articles/PMC9077239/),
[PMC3198972](https://pmc.ncbi.nlm.nih.gov/articles/PMC3198972/),
[PMC4655452](https://pmc.ncbi.nlm.nih.gov/articles/PMC4655452/),
[PMC5425947](https://pmc.ncbi.nlm.nih.gov/articles/PMC5425947/),
[PMC4287254](https://pmc.ncbi.nlm.nih.gov/articles/PMC4287254/) and
[PMC9058200](https://pmc.ncbi.nlm.nih.gov/articles/PMC9058200/). Additional live-verified records
inspected but not cited include 25796283 (uremic pericarditis case series) and 26605355's sibling
thyroid-eye reviews; they are not extra evidence rows. Intermittent NCBI bot/cookie challenges
remain possible and one PMC-path fetch returned a stale-origin 404 that was corrected by
navigating to the PMC origin before re-fetching; functional verification is point-in-time.

### Reuse screen

An identifier-level screen of `data/evidence/master-sources.json` and
`data/evidence/master-relationships.json` was run for all 15 packet PMIDs. **None of the 15
identifiers appears in either governance-bound file**, so no substitution was required in this
wave. The screen is identifier-level only and does not certify absence of the same study under a
different identifier. This mirrors the standing rule that governance-bound corpus rows and their
sources are not reused or landed by this packet.

## Legal and rating checks

Live eCFR pages display Title 38 current through 2026-10-01, last amended 2026-08-27. Use
claim-period-specific criteria when adjudicating an actual claim.

- [§ 3.310](https://www.ecfr.gov/current/title-38/part-3/section-3.310): (a) proximate secondary
  causation; (b) attributable worsening beyond natural progression against a qualifying baseline.
  All five rows are direct causation under § 3.310(a); each row nevertheless states the § 3.310(b)
  aggravation alternative and the baseline-plus-increment requirement that would govern if
  pre-existing disease were documented before the primary condition.
- [§ 3.102](https://www.ecfr.gov/current/title-38/part-3/section-3.102): approximate balance and the
  distinction between probability and speculation. The cirrhosis prevalence figures (roughly 25-30
  percent), the pooled global gallstone prevalence of about 6.1 percent, the 65-95 percent ocular
  surface disease range in thyroid eye disease, and the approximately 60 percent rate of thyroid
  eye disease among hyperthyroid patients are population statistics and are not individual nexus
  probabilities.
- [§ 4.114](https://www.ecfr.gov/current/title-38/part-4/section-4.114): **DC 7315** (cholelithiasis,
  chronic) is rated as **DC 7314** (chronic biliary tract disease), 30/10/0 percent on documented
  attacks in the past 12 months; **DC 7312** (cirrhosis of the liver) governs the host and is
  assigned on Model for End-Stage Liver Disease score or on the enumerated decompensating events,
  with Note (3) permitting rating on symptomatology where no score exists; the section's
  anti-pyramiding instruction for DCs 7301 through 7329 supports the § 4.14 statement in the row.
- [§ 4.71a](https://www.ecfr.gov/current/title-38/part-4/section-4.71a): **DC 5025** (fibromyalgia)
  provides 40/20/10 percent tiers with the note defining widespread pain; the same section's DC 5013
  through DC 5024 group and its note are not used, so no fibromyalgia rating is taken under a
  degenerative-arthritis analogy.
- [§ 4.119](https://www.ecfr.gov/current/title-38/part-4/section-4.119): **DC 7903** hypothyroidism
  (100 percent myxedema, 30 percent without myxedema, with residual rating under appropriate body
  systems thereafter); **DC 7900** hyperthyroidism including Graves' disease, with **Note (2)**
  expressly directing separate evaluation of Graves' eye involvement as diplopia (DC 6090),
  impairment of central visual acuity (DCs 6061-6066), or under the most appropriate codes in
  § 4.79 — the direct authority for the dry-eye row; **DC 7903 Note (3)** similarly contemplates
  separate § 4.79 evaluation of thyroid eye involvement; and **DC 7913** governs the diabetes host.
- [§ 4.79](https://www.ecfr.gov/current/title-38/part-4/section-4.79): **DC 6025** (disorders of the
  lacrimal apparatus (epiphora, dacryocystitis, etc.)) pays 20 percent bilateral and 10 percent
  unilateral; **DC 6001** (keratopathy) is available where punctate corneal epithelial disease is
  documented; the General Rating Formula and DCs 6061-6066 supply the visual-acuity route that
  § 4.14 forbids from being pyramided with the lacrimal-apparatus rating.
- [§ 4.87](https://www.ecfr.gov/current/title-38/part-4/section-4.87): **DC 6205** (Meniere's syndrome
  (endolymphatic hydrops)) pays 100/60/30 percent by attack frequency and its note bars combining
  an evaluation under DC 6205 with separate hearing-impairment, tinnitus (**DC 6260**) or vertigo
  (**DC 6204**) evaluations, though it permits the alternative method if higher.
- [§ 4.124a](https://www.ecfr.gov/current/title-38/part-4/section-4.124a): **DC 8045** governs
  traumatic brain injury residuals and states expressly that any residual with a distinct
  diagnosis, "such as migraine headache or Meniere's disease," is separately evaluated rather than
  under the cognitive/subjective-symptoms table — the packet's Meniere's anchor; **DC 8529**
  (external cutaneous nerve of thigh) pays 10 percent severe-to-complete and 0 percent
  mild-or-moderate, with **DC 8629** neuritis and **DC 8729** neuralgia as the inflammatory and
  purely sensory alternatives, and **DC 8526** (anterior crural nerve (femoral)) noted as the
  proximal comparator.
- [§ 4.20](https://www.ecfr.gov/current/title-38/part-4/section-4.20) and
  [§ 4.27](https://www.ecfr.gov/current/title-38/part-4/section-4.27): the dry-eye row must use a
  justified analogous evaluation where the predominant disability picture is tear-film failure
  without a lacrimal-apparatus or keratopathy diagnosis; no rated value is invented.
- [§ 4.14](https://www.ecfr.gov/current/title-38/part-4/section-4.14): avoid pyramiding across all
  five proposals — not rating the same abdominal pain or liver decompensation, widespread pain and
  fatigue, vertigo/tinnitus/hearing loss, ocular surface disease and visual impairment, or
  anterolateral thigh sensory loss twice.

## Schema projection (next step, not yet authored)

| Mapping | conditionId (secondary) | nexusClassification | mechanismCategory | etiologicalConsensus | vaNexusProbabilityAlignment |
| --- | --- | --- | --- | --- | --- |
| Cholelithiasis ← cirrhosis of the liver | cholelithiasis | DIRECT_CAUSATION | METABOLIC_OR_NUTRITIONAL (pigment-stone bile lithogenicity with gallbladder stasis) | PROBABLE (replicated prevalence excess; mechanism partly inferred) | NOT_ASSERTED |
| Fibromyalgia ← hypothyroidism | fibromyalgia | DIRECT_CAUSATION | NEUROENDOCRINE_CASCADE (hypothyroid myopathy with central sensitization) | CONTESTED_REQUIRES_SPECIFIC_EVIDENCE (literature is defined by thyroid autoimmunity) | NOT_ASSERTED |
| Meniere's disease ← traumatic brain injury residuals | menieres-disease | DIRECT_CAUSATION | MECHANICAL_OR_COMPRESSIVE (post-traumatic endolymphatic hydrops) | PROBABLE (accepted entity, but most Meniere's disease is idiopathic) | NOT_ASSERTED |
| Dry eye syndrome ← hyperthyroidism (Graves' disease) | dry-eye-syndrome | DIRECT_CAUSATION | IMMUNE_MEDIATED (thyroid-eye-disease orbital inflammation and tear-film failure) | WELL_ESTABLISHED (65-95 percent ocular surface disease in thyroid eye disease) | NOT_ASSERTED |
| Meralgia paresthetica ← type 2 diabetes | meralgia-paresthetica | DIRECT_CAUSATION | MICROVASCULAR_METABOLIC (diabetic nerve vulnerability with inguinal entrapment) | CONTESTED_REQUIRES_SPECIFIC_EVIDENCE (referral series found diabetes in only about 2 percent) | NOT_ASSERTED |

These are vocabulary-valid proposed classifications, not approvals or individual medical findings.
No row is marked legally presumed. Every row keeps `NOT_ASSERTED` on patient-level probability
despite the explicit discussion of the "at least as likely as not" standard, because no patient
record was supplied. The two contested-tier rows each list at least two alternative etiologies in
the narrative and would require `requiresSpecificDbqEvidence: true` on any authored landing, per
the schema's contested-tier refinement. No medication-side-effect row appears in this wave, so no
`PHARMACOLOGICAL_IATROGENIC`/`IATROGENIC_TREATMENT_EFFECT` pairing is asserted here.

The user's flat interface is **not directly accepted by the actual strict `suggestionSchema`**.
That schema requires the secondary `conditionId`, `rank`, nested `nexusClaim`, `causalMechanism`,
`evidentiaryProfile`, `rationale`, `evidenceGaps` and `sourceReferences`. Any future
transformation must author those fields separately, preserve the contested/probable disclosures,
use `verified: false` until qualified-human verification, honour the contested-tier requirement of
at least two alternative etiologies plus `requiresSpecificDbqEvidence: true`, and enforce
host-level rank, catalog, source-registry and graph rules. No schema was weakened and no governed
data was landed.

## Self-audit and verification

- Exactly five mappings with three evidence records each; exact key sets, canonical PubMed URL
  syntax, uniqueness, the individualized-legal safeguard phrases, `draft: true` targets and clean
  host-target pairs are checked with a strict packet-only audit. The actual repository authored-row
  parsers (`suggestionSchema` and `conditionMappingSchema`) are also exercised to confirm and
  disclose the flat/nested incompatibility rather than hide it: both reject every flat row with a
  `conditionId`-rooted error.
- Every narrative addresses § 3.310(a) causation, § 3.310(b) aggravation with baseline and natural
  progression, the "at least as likely as not" standard, competing causes, rating scope and § 4.14
  nonpyramiding. Each row states the explicit evidentiary record the individual nexus opinion
  would require (imaging chronology, laboratory confirmation, audiologic/vestibular testing,
  ocular surface testing, or electrodiagnostic testing as applicable).
- Counter-evidence and limitations are retained rather than smoothed away: most
  cirrhosis-associated pigment stones are asymptomatic and DC 7314 may pay 0 percent; the
  fibromyalgia literature is defined by thyroid autoimmunity and histologically defined Hashimoto
  thyroiditis rather than by biochemical hypothyroidism alone; DiBiase and Arriaga themselves
  record that many Meniere's disease cases have no identifiable etiologic agent; McAlinden reports
  that about 5 percent of thyroid eye disease patients are euthyroid, so thyroid hormone levels
  alone do not establish the ocular surface nexus; and Weng found diabetes in only about 2 percent
  of electrodiagnostically confirmed meralgia paresthetica referrals while Parisi found the
  neuropathy often precedes the diabetes diagnosis.
- No population percentage, odds ratio or relative risk is converted into an individual
  probability. No intentional rechallenge, unsupervised medication discontinuation or
  patient-specific prescribing is requested.
- Final packet-only strict checks passed for five mappings, 15 unique canonical PubMed URLs, five
  `draft: true` targets, and five host-target pairs with no pre-existing edge. Both actual authored
  schema parsers reject the flat objects as expected; this is a disclosed incompatibility, not a
  repository-schema validation pass.
- The reuse screen found no governance-bound identifier among the 15 packet PMIDs, so unlike wave
  10 no source substitution was needed; the screen's identifier-level limitation is disclosed.
- Four candidate pathways with explicit corpus deferrals (pericardial effusion, pulmonary edema,
  cubital tunnel syndrome, common peroneal neuropathy) plus hallux rigidus, piriformis syndrome
  and periodontitis were dropped before authoring rather than overridden.
- Final local checks under Node 22.23.2: `npm run test:doc-lint` passed **150 tests** in three
  suites, including the automatically discovered wave-11 projection table; `npm run typecheck` and
  `git diff --check` passed, and both new files are free of trailing whitespace. No build, full
  application suite or patient-interface test is claimed for this documentation-only proposal.
- Qualified clinical/legal and citation-provenance review is still required before publication.
