# CRG draft-identity mapping packet validation — wave 14 (2026-10-06)

## Selected pathways and artifact

1. Symptomatic acquired lumbar spinal stenosis from anatomically concordant service-connected lumbar degenerative disc disease.
2. Clinically significant ulnar entrapment at the elbow from service-connected type 2 diabetes, conditional on individual localization and etiologic evidence.
3. Acquired agranulocytosis from antithyroid medication used for service-connected hyperthyroidism.
4. Tracheal stenosis after intubation/tracheostomy actually performed for a service-connected COPD exacerbation or respiratory failure.
5. Aggravation of pre-existing chronic spontaneous urticaria by NSAIDs actually used for service-connected osteoarthritis.

The complete five-row requested flat array is saved in
[crg-draft-identity-mapping-packet-wave14-2026-10-06.json](crg-draft-identity-mapping-packet-wave14-2026-10-06.json).
Every row has the eight exact user-specified keys and three evidence records with the four exact
evidence keys. This is research for qualified clinical/legal review, **not a signed IME opinion,
individual diagnosis, established patient nexus, or publication into the live corpus**. No patient
records were supplied. Medical examiner board certification is not claimed by the authoring agent.

## Repository selection and direction screen

All five targets were confirmed draft, nonquarantined and without governance notes, and none
appears as a target in the 13 previous packet projections. The selected host-target pairs are
absent from the corresponding authored host. Three targets already have other incoming routes;
these are not represented as entirely unmapped or edge-free.

| Secondary identity | Draft | Existing outgoing | Existing incoming | Governance note | Chosen host primary |
| --- | --- | --- | --- | --- | --- |
| spinal-stenosis | true | none | dwarfism | none | degenerative-disc-disease (draft) |
| ulnar-neuropathy | true | none | epicondylitis | none | diabetes-mellitus-type-2 (published) |
| agranulocytosis | true | cellulitis | none | none | hyperthyroidism (published) |
| tracheal-stenosis | true | none | none | none | copd (published) |
| urticaria | true | none | katayama-fever; thyroiditis | none | osteoarthritis (published) |

All five hosts are also nonquarantined and have no governance notes. Host publication is a
landing limitation, not permission to change publication state: four hosts are published and
cannot accept these new unverified references under the existing citation-purity gate. No host,
secondary identity, catalog, registry, adjacency, tracker, or application source file is changed.
The completed converter and its 13-wave staging checkpoint are preserved without edits.

### Selection caveats

- These are recognizable secondary-pathway concepts, not five diagnoses proven frequent in the
  VA claimant population. Agranulocytosis is rare; post-intubation stenosis is an uncommon serious
  complication. They were selected for evidence-supported, underdocumented draft pathways rather
  than an unsupported claims-frequency assertion.
- MS-to-optic-neuritis and breast-cancer-to-lymphedema candidates were rejected because those
  exact host-target suggestions already exist. No additional duplicate route is authored.
- Stenosis and disc disease commonly share an underlying degenerative process; a structural
  secondary relationship does not promise a separate lumbar rating.
- The diabetic ulnar literature includes subclinical abnormalities and does not isolate an
  individual causal contribution. If clinical chronology, localization and rival etiologies do
  not establish causation, association-only status is appropriate instead of forcing the claim.
- The urticaria proposal concerns **pre-existing CSU**, so its flat theory is `Aggravation`
  despite a medication-mediated worsening factor. A de novo drug reaction is a different phenotype.
- Tracheal instrumentation is a treatment complication, not a drug effect: its flat theory is
  `Causation` and the projected mechanism is `POST_SURGICAL_OR_TREATMENT`.

## Medical-source verification

All selected PubMed article records were directly fetched on the PubMed origin in a browser on
2026-10-06. Each selected URL returned HTTP 200 with a matching displayed PMID, exact article
title, indexed byline and readable abstract. No source identity was taken solely from a search
snippet. Author strings reproduce indexed full names where available; group/role byline entries
in the WAO record are retained as displayed rather than silently omitted.

| Pathway | Directly checked selected PMIDs |
| --- | --- |
| Lumbar stenosis from degenerative disc disease | [26727925](https://pubmed.ncbi.nlm.nih.gov/26727925/), [35503342](https://pubmed.ncbi.nlm.nih.gov/35503342/), [26839989](https://pubmed.ncbi.nlm.nih.gov/26839989/) |
| Diabetic ulnar entrapment | [27660694](https://pubmed.ncbi.nlm.nih.gov/27660694/), [24565211](https://pubmed.ncbi.nlm.nih.gov/24565211/), [24639928](https://pubmed.ncbi.nlm.nih.gov/24639928/) |
| Antithyroid-drug agranulocytosis | [28105610](https://pubmed.ncbi.nlm.nih.gov/28105610/), [24057289](https://pubmed.ncbi.nlm.nih.gov/24057289/), [38710619](https://pubmed.ncbi.nlm.nih.gov/38710619/) |
| Post-intubation tracheal stenosis | [19942129](https://pubmed.ncbi.nlm.nih.gov/19942129/), [18803874](https://pubmed.ncbi.nlm.nih.gov/18803874/), [16258758](https://pubmed.ncbi.nlm.nih.gov/16258758/) |
| NSAID-exacerbated chronic urticaria | [40837856](https://pubmed.ncbi.nlm.nih.gov/40837856/), [34284571](https://pubmed.ncbi.nlm.nih.gov/34284571/), [32673879](https://pubmed.ncbi.nlm.nih.gov/32673879/) |

Detailed mechanism passages were additionally checked in full text:
[PMC6887476](https://pmc.ncbi.nlm.nih.gov/articles/PMC6887476/) (disc/facet/ligament changes and
ischemic/venous hypotheses), [PMC5027001](https://pmc.ncbi.nlm.nih.gov/articles/PMC5027001/)
(diabetic nerve vulnerability/two-hit model), [PMC5318340](https://pmc.ncbi.nlm.nih.gov/articles/PMC5318340/)
(antithyroid direct-toxic and immune-mediated mechanisms), and
[PMC12361610](https://pmc.ncbi.nlm.nih.gov/articles/PMC12361610/) (NECD classification and COX-1 mechanism).
The latter full text first returned a browser-check interstitial to readable-page extraction;
its actual NECD and pathogenic-mechanism sections subsequently loaded and were examined in the
browser. A PubMed extraction request also returned a cookie challenge; that response was not
counted as verification. Direct browser record fetches resolved all selected sources.
An additional ulnar study, PMID 31425363, was verified but not selected; it is not a fourth evidence
item. Source access is point-in-time, not a promise of indefinite availability.

### Evidence limitations retained on each proposal

- Reviews and diagnostic consensus support recognized anatomy/phenotype, not a signed individual
  causation finding. The stenosis Delphi diagnostic certainty is not a VA nexus probability.
- Ulnar observational studies include referral selection, generalized slowing and subclinical
  lesions; focal conduction criteria and clinical impairment remain essential.
- Agranulocytosis incidence and latency data establish a rare adverse-event pattern, not the
  probability that a particular episode is drug-attributable. No dangerous rechallenge is required.
- The ICU injury study has a broad laryngotracheal endpoint and late endoscopy in only 280 of 654
  original participants. Its 11-percent injury rate is not isolated tracheal-stenosis incidence.
- Urticaria challenge results support control-dependent exacerbation; they do not establish
  permanent deterioration or authorize home testing. Clinical algorithms are not prescribing advice.

### Registry screen and verification boundary

The 15 selected PMIDs were screened against both current master-source and master-relationship
registry contents. None appears in either file at this checkpoint. This is an identifier-level
screen only: it does not exclude the same source under a DOI-only representation or independently
clear source-status, clinical applicability, umbrella/member or transitive-redundancy gates.
No registry entries were added. Future nested references must remain `verified: false` until
qualified-human review under the [citation SOP](citation-verification-sop.md). Automated browser
checks are not such review, and no verified source-body digest or individual opinion was created.

## Legal and diagnostic-code checks

Live eCFR pages on 2026-10-06 displayed Title 38 current through **2026-10-02**, last amended
2026-08-27. The packet requires claim-period criteria; current text is not automatically the
applicable historical rating version.

- [§ 3.310](https://www.ecfr.gov/current/title-38/part-3/section-3.310): four proposals use (a)
  proximate causation, including one drug and one instrumentation complication; urticaria uses
  (b) actual attributable worsening against a qualifying medical baseline, beyond natural progress.
  Each narrative separates the other theory rather than conflating causation and aggravation.
- [§ 3.102](https://www.ecfr.gov/current/title-38/part-3/section-3.102): approximate balance of
  individual positive/negative evidence, not speculation or conversion of group rates to a patient
  probability. Every row says `No individual probability is asserted here.`
- [§ 4.71a](https://www.ecfr.gov/current/title-38/part-4/section-4.71a): DC **5238** spinal
  stenosis; DC **5242** degenerative arthritis/disc disease other than IVDS; DC **5243** only for
  qualifying herniation with adjacent root compression/irritation; separate objective neurologic
  abnormalities under spinal Note (1); DC **5003** osteoarthritis with the actual joint-motion code.
- [§ 4.124a](https://www.ecfr.gov/current/title-38/part-4/section-4.124a): DC **8516**, **8616**,
  **8716** for ulnar impairment, neuritis and neuralgia. Major/minor and wholly sensory restrictions
  are preserved; the same loss must not be counted as diffuse neuropathy and focal entrapment twice.
- [§ 4.119](https://www.ecfr.gov/current/title-38/part-4/section-4.119): DC **7913** and its
  complication Note (1); DC **7900** six-month initial hyperthyroidism evaluation and subsequent
  appropriate-body-system rating of disease residuals/treatment complications.
- [§ 4.117](https://www.ecfr.gov/current/title-38/part-4/section-4.117): DC **7702** acquired
  agranulocytosis; its actual treatment/infection thresholds matter, not the diagnostic label alone.
- [§ 4.97](https://www.ecfr.gov/current/title-38/part-4/section-4.97): DC **6604** COPD;
  DC **6520** is literally laryngeal stenosis, not a dedicated tracheal-stenosis code. Candidate
  **6599-6520** is expressly an analogy requiring clinical/legal review under
  [§ 4.20](https://www.ecfr.gov/current/title-38/part-4/section-4.20) and
  [§ 4.27](https://www.ecfr.gov/current/title-38/part-4/section-4.27), with actual compatible
  upper-airway flow-volume-loop/FEV-1 or permanent-tracheostomy criteria. No automatic percentage.
- [§ 4.96](https://www.ecfr.gov/current/title-38/part-4/section-4.96): (d) applies to listed COPD
  pulmonary-function evaluation; (a)'s exact noncombination ranges do **not** include DC 6520.
  The packet does not misquote that rule as an automatic prohibition on the precise 6604/6520 pair;
  overlapping dyspnea and functional loss still require § 4.14 review.
- [§ 4.118](https://www.ecfr.gov/current/title-38/part-4/section-4.118): DC **7825** explicitly
  defines rating-purpose chronic urticaria and its treatment tiers; subsection (b) limits overlapping
  same-area skin ratings. No patient is asked to stop treatment to manufacture off-treatment evidence.
- [§ 4.14](https://www.ecfr.gov/current/title-38/part-4/section-4.14): no duplication of the same
  lumbar, ulnar, infection, airway or wheal manifestations under multiple diagnostic labels.

## Schema projection (next step, not yet authored)

| Mapping | conditionId (secondary) | nexusClassification | mechanismCategory | etiologicalConsensus | vaNexusProbabilityAlignment |
| --- | --- | --- | --- | --- | --- |
| Lumbar stenosis ← degenerative disc disease | spinal-stenosis | DIRECT_CAUSATION | MECHANICAL_OR_COMPRESSIVE | WELL_ESTABLISHED (structural degeneration, not individual attribution) | NOT_ASSERTED |
| Ulnar entrapment ← type 2 diabetes | ulnar-neuropathy | DIRECT_CAUSATION (conditional individual contributor) | MICROVASCULAR_METABOLIC | CONTESTED_REQUIRES_SPECIFIC_EVIDENCE (observational association, focal-versus-diffuse overlap) | NOT_ASSERTED |
| Agranulocytosis ← antithyroid treatment | agranulocytosis | DIRECT_CAUSATION | PHARMACOLOGICAL_IATROGENIC | IATROGENIC_TREATMENT_EFFECT | NOT_ASSERTED |
| Tracheal stenosis ← COPD-related instrumentation | tracheal-stenosis | DIRECT_CAUSATION | POST_SURGICAL_OR_TREATMENT | IATROGENIC_TREATMENT_EFFECT | NOT_ASSERTED |
| Chronic urticaria ← NSAID exacerbation | urticaria | AGGRAVATION (requires baselineProgression and aggravatingFactor) | PHARMACOLOGICAL_IATROGENIC | IATROGENIC_TREATMENT_EFFECT | NOT_ASSERTED |

These vocabulary-valid projections are proposed classifications, not approvals. The diabetic
ulnar row requires specific DBQ evidence and at least two alternative etiologies on nested landing;
absent individual causal support retain association-only rather than assert causation. The urticaria
row needs separately authored baseline and aggravating-factor narratives without inventing patient
facts. No individual presumption or probability is asserted.

The requested flat interface **does not directly pass** `suggestionSchema` or
`conditionMappingSchema`. The authored schema requires `conditionId`, rank, nested nexus claim,
mechanism and evidentiary profile, rationale, evidence gaps and source references; a mapping also
requires its primary `id` and host-level rank/state rules. This packet preserves the requested exact
flat keys instead of weakening the real schemas. The previous converter currently supports waves
1–13 only; wave 14 is not silently added to its identity plan or saved 65-proposal checkpoint.
No flat or nested wave-14 data is landed into the live graph by this task.

## Self-audit and final local checks

- Strict flat parsing verifies exactly five rows, eight exact mapping keys, four exact evidence
  keys, three sources per row, 15 distinct canonical PubMed URLs and all required individual-legal
  safeguard phrases. Actual authored parsers reject each flat row as expected; that is the disclosed
  flat/nested incompatibility, not a claim of authored-schema acceptance.
- All five selected targets remain draft, nonquarantined and without governance notes; all five
  hosts remain nonquarantined, without governance notes and without these host-target edges. None
  duplicates an earlier packet target. Catalog IDs and directed proposal acyclicity are checked.
- At least as likely as not reasoning requires chronology, objective phenotype, mechanism and
  competing causes to be weighed in the individual record. No population percentage is substituted
  for an individual nexus probability, no generic association is called proof, and no patient
  baseline is fabricated. § 3.310(a), § 3.310(b), baseline/natural progression and § 4.14 are explicit
  in every narrative.
- Clinical-source identity and live access are checked directly; current rating and analogy scope
  are checked against the live eCFR. Sources and legal provisions are purpose-separated.
- Final verification under Node 22.23.2: strict packet audit passed; `npm run test:doc-lint` passed
  **153 tests**, `npm run typecheck` passed, and `git diff --check` passed. Both new files contain
  no trailing whitespace. The existing converter regression suite also passed **14 tests**,
  demonstrating that its prior 13-wave deliverable remains unchanged.
- Qualified clinical/legal, citation and governed landing review remains necessary. No full
  application build, new live recommendation, patient-interface behavior or signed nexus opinion
  is claimed. Original files and existing work are preserved; no Git staging, commit or push.
