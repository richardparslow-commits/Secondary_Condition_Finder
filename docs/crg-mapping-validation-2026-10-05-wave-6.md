# CRG draft-identity mapping packet validation — wave 6 (2026-10-05)

## Selected pathways and artifact

1. L5/S1 radiculopathy ← service-connected lumbar disc disease with a concordant lesion.
2. Cervical radiculopathy ← service-connected cervical disc disease/foraminal stenosis.
3. Benign peptic esophageal stricture ← chronic GERD with reflux esophagitis.
4. Drug-induced parkinsonism ← antipsychotic treatment for service-connected schizophrenia.
5. Aggravation of pre-existing restless legs syndrome ← advanced service-connected CKD requiring dialysis.

The complete array is [crg-draft-identity-mapping-packet-wave6-2026-10-05.json](crg-draft-identity-mapping-packet-wave6-2026-10-05.json).
It contains exactly the user's eight mapping keys and four evidence-item keys. It is a
research/authoring proposal, **not an authored corpus row, signed IME opinion, or publication**.
No patient records were supplied; no individual nexus probability is established.

## Repository selection screen

The authored mapping files were read directly on 2026-10-05; `draft` describes each identity's
outgoing authored file, not approval of the incoming proposal.

| Secondary catalog identity | Authored file draft | Outgoing suggestions | Incoming authored suggestions before proposal |
| --- | --- | --- | --- |
| radiculopathy-sciatic | true | 0 | 0 |
| radiculopathy-upper-extremity | true | 0 | 0 |
| esophageal-stricture | true | 1 | 2: esophagitis; epidermolysis-bullosa-acquired |
| drug-induced-parkinsonism | true | 0 | 0 |
| restless-leg-syndrome | true | 3 | 0 |

The separate adjacency-file scan found no incoming edges for these targets in
`data/knowledge-base/graph/`; this does **not** erase the authored incoming stricture routes or
imply that the adjacency representation is complete. No registry, catalog, authored mapping,
adjacency, tracker, or application-source data was modified by this packet.

### Duplicate and held-evidence constraints

- `degenerative-disc-disease` already points to generic `radiculopathy`. The anatomically scoped
  sciatic and cervical identities need canonical/scope reconciliation before any new row; no
  additional independent recommendation for the same impairment is implied. Lumbar service
  connection does not automatically establish cervical service connection.
- `esophagitis` already points to `esophageal-stricture`, which points to `dysphagia`. GERD's
  proposed mechanism explicitly uses the esophagitis intermediate. Review redundancy before
  landing a GERD-to-stricture shortcut. PMID 19439958 is already present in the source registry;
  reuse requires existing-source provenance, not a second source entity.
- `drug-induced-parkinsonism` carries a batch-95 deferral, and the schizophrenia movement-disorder
  evidence has an ME-29 joint-adjudication hold. Newly located independent systematic-review
  PMID 34506552 is offered for human reassessment, **not an automatic lifting of the hold**.
  Reserved PMID 30695288 and excluded degenerative-parkinsonism PMID 34652577 are not used.
- Schizophrenia, GERD and CKD host files are published. The existing citation-purity gate does
  not permit landing an unverified clinical source in those files. Live machine checks are not
  qualified-human verification under [citation-verification-sop.md](citation-verification-sop.md).

## Medical-source identity and functional-URL checks

All 15 evidence items use canonical `https://pubmed.ncbi.nlm.nih.gov/<PMID>/` URLs.
Search/discovery, PubMed abstracts, and available PMC full texts were reviewed; no placeholder
or guessed PMID is used. Exact PubMed display titles and first authors were cross-checked.
The Smith trial title deliberately retains its indexed `Restore Investigator Group` suffix.

| Pathway | Verified PubMed identifiers |
| --- | --- |
| Lumbar radiculopathy | [31788391](https://pubmed.ncbi.nlm.nih.gov/31788391/), [24239490](https://pubmed.ncbi.nlm.nih.gov/24239490/), [9726337](https://pubmed.ncbi.nlm.nih.gov/9726337/) |
| Cervical radiculopathy | [27250042](https://pubmed.ncbi.nlm.nih.gov/27250042/), [23024624](https://pubmed.ncbi.nlm.nih.gov/23024624/), [17204882](https://pubmed.ncbi.nlm.nih.gov/17204882/) |
| Peptic stricture | [19439958](https://pubmed.ncbi.nlm.nih.gov/19439958/), [7926495](https://pubmed.ncbi.nlm.nih.gov/7926495/), [34807007](https://pubmed.ncbi.nlm.nih.gov/34807007/) |
| Drug-induced parkinsonism | [22523509](https://pubmed.ncbi.nlm.nih.gov/22523509/), [36573102](https://pubmed.ncbi.nlm.nih.gov/36573102/), [34506552](https://pubmed.ncbi.nlm.nih.gov/34506552/) |
| RLS aggravation proposal | [37008995](https://pubmed.ncbi.nlm.nih.gov/37008995/), [26944272](https://pubmed.ncbi.nlm.nih.gov/26944272/), [39324694](https://pubmed.ncbi.nlm.nih.gov/39324694/) |

The text-extraction client encountered PubMed HTTP 203 cookie interstitials and some PMC browser
challenges. Those responses were **not** counted as verified article content. Browser-origin
fetches retrieved HTTP 200 article pages with identities; a subsequent batch returned HTTP 200
challenge bodies for five URLs (missing article selectors). Each of those five was navigated
individually in Chromium and its article title, PMID, and first author confirmed: 17204882,
7926495, 22523509, 34506552, 26944272. Across successful fetches and individual navigations,
all 15 URLs were functionally confirmed at verification time. Intermittent NCBI bot/cookie
challenges remain possible; HTTP 200 alone is not proof of an article.

Available full-text mechanism/standard anchors include
[PMC6858271](https://pmc.ncbi.nlm.nih.gov/articles/PMC6858271/),
[PMC4958381](https://pmc.ncbi.nlm.nih.gov/articles/PMC4958381/),
[PMC3325428](https://pmc.ncbi.nlm.nih.gov/articles/PMC3325428/),
[PMC4826337](https://pmc.ncbi.nlm.nih.gov/articles/PMC4826337/), and
[PMC11701286](https://pmc.ncbi.nlm.nih.gov/articles/PMC11701286/).
These are alternate full texts, not extra evidence rows or independent studies.

## Legal/rating checks

Live eCFR pages display Title 38 up to date as of 2026-10-01. The packet uses current provisions;
claim-period applicability and analogous-code selection still require qualified review.

- [§ 3.310](https://www.ecfr.gov/current/title-38/part-3/section-3.310): secondary causation in (a),
  attributable aggravation/baseline and natural-progress requirements in (b). Medication effects
  are treatment-mediated causation/aggravation, not a separate statutory presumption.
- [§ 3.102](https://www.ecfr.gov/current/title-38/part-3/section-3.102): approximate balance and the
  distinction between probability and speculation. Population prevalence is not an individual's
  nexus probability. No proposed route is marked legally presumed.
- [§ 4.71a](https://www.ecfr.gov/current/title-38/part-4/section-4.71a): DC 5242 versus DC 5243's
  disc-herniation/root-irritation restriction, DC 5238, General Formula Note (1), and the alternative
  IVDS evaluation method. Physician-prescribed bed rest is required for qualifying incapacitating
  episodes; separate neurologic evaluation is not an automatic duplicate award.
- [§ 4.124a](https://www.ecfr.gov/current/title-38/part-4/section-4.124a): sciatic DC 8520/8620/8720;
  upper/middle/lower/all radicular-group DC 8510–8513 and related neuritis/neuralgia codes;
  DC 8004 lists paralysis agitans, **not** a dedicated drug-induced-parkinsonism code;
  DC 8103 lists convulsive tic, **not** a dedicated RLS code.
- [§ 4.114](https://www.ecfr.gov/current/title-38/part-4/section-4.114): dedicated stricture DC 7203
  and GERD DC 7206; overlapping manifestations remain subject to § 4.14.
- [§ 4.130](https://www.ecfr.gov/current/title-38/part-4/section-4.130): schizophrenia uses **DC 9201**;
  DC 9203 is explicitly removed.
- [§ 4.115b](https://www.ecfr.gov/current/title-38/part-4/section-4.115b) and
  [§ 4.115a](https://www.ecfr.gov/current/title-38/part-4/section-4.115a): DC 7530 requires regular
  dialysis and rates as renal dysfunction; it is not a universal code for all CKD.
- [§ 4.20](https://www.ecfr.gov/current/title-38/part-4/section-4.20) and
  [§ 4.27](https://www.ecfr.gov/current/title-38/part-4/section-4.27): any code for unlisted DIP/RLS
  must be justified by analogous function, localization and symptoms. No built-up code or automatic
  minimum rating is invented in the packet.
- [§ 4.14](https://www.ecfr.gov/current/title-38/part-4/section-4.14): avoid pyramiding.
- The RLS narrative does not add a permanent-worsening threshold to secondary aggravation;
  see [Ward v. Wilkie, 31 Vet. App. 233 (2019)](https://www.uscourts.cavc.gov/documents/WardLM_16-2157%20(3).pdf).
  An actual attributable increase and qualifying baseline evidence still must be identified.
  The court PDF could not be extracted by the URL-reading tool (unsupported PDF content type).
  The Ward holding was additionally corroborated in VA's discussion in
  [85 FR 56189 (2020 proposed rule)](https://www.federalregister.gov/documents/2020/09/11/2020-17672/aggravation-definition).
  That document proposed a different permanence rule; it is **not** treated as adopted law, and
  the current retrieved § 3.310(b) text remains the regulatory reference.

## Schema projection (next step, not yet authored)

| Mapping | conditionId (secondary) | nexusClassification | mechanismCategory | etiologicalConsensus | vaNexusProbabilityAlignment |
| --- | --- | --- | --- | --- | --- |
| Lumbar radiculopathy ← lumbar disc lesion | radiculopathy-sciatic | DIRECT_CAUSATION | MECHANICAL_OR_COMPRESSIVE | WELL_ESTABLISHED | NOT_ASSERTED |
| Cervical radiculopathy ← cervical disc lesion | radiculopathy-upper-extremity | DIRECT_CAUSATION | MECHANICAL_OR_COMPRESSIVE | WELL_ESTABLISHED | NOT_ASSERTED |
| Peptic stricture ← GERD/esophagitis | esophageal-stricture | DIRECT_CAUSATION | MULTIFACTORIAL (reflux injury, fibrotic repair and narrowing) | WELL_ESTABLISHED | NOT_ASSERTED |
| Drug-induced parkinsonism ← antipsychotic treatment | drug-induced-parkinsonism | DIRECT_CAUSATION | PHARMACOLOGICAL_IATROGENIC | IATROGENIC_TREATMENT_EFFECT | NOT_ASSERTED |
| Pre-existing RLS worsened with advanced CKD | restless-leg-syndrome | AGGRAVATION (conditional on baselineProgression and aggravatingFactor) | MULTIFACTORIAL | PROBABLE (conditional individual aggravation, not universal causation) | NOT_ASSERTED |

These are vocabulary-valid proposed classifications, **not** a finding that all business rules,
patient nexus requirements, or governance gates have been met. RLS must remain association-only if
an actual attributable worsening is unsupported. `NOT_ASSERTED` on every row preserves the
absence of patient-level probability evidence despite the explicit discussion of the
"at least as likely as not" standard.

The requested flat objects cannot directly parse against the actual strict `suggestionSchema`:
that schema requires `conditionId`, `rank`, nested `nexusClaim`, `causalMechanism`,
`evidentiaryProfile`, `rationale`, `evidenceGaps`, and `sourceReferences`. A future transformation
must separately author the appropriate nexus narrative fields (including both aggravation fields),
retain evidence limitations, provide alternative etiologies/gaps, use `verified: false` until human
verification, and enforce host-level rank, catalog, source-registry and graph rules. No schema was
weakened to disguise the mismatch.

## Self-audit and corrections before finalization

- Five strict flat-format mappings, three evidence records each, nonempty required fields and
  canonical PubMed URL syntax were validated with an ad hoc strict Zod schema for **this packet
  interface only**. This is not the repository's authored-row schema.
- Each narrative explicitly addresses § 3.310(a)/(b), the "at least as likely as not" standard,
  evidence needed for an individual opinion, competing causes, rating scope and overlap.
- Population frequencies and treatment effects are never substituted for individual probabilities.
  The old inflammation review's unproven-mediator conclusion and the RLS causal-label warning are
  carried openly, rather than recast as studies "proving" every nexus.
- Current schizophrenia DC 9201 replaced the obsolete 9203 idea during research. RLS/DIP codes are
  explicitly conditional analogies; DC 7530 is scoped to regular dialysis. The AASM 2025 guideline
  controls the RLS clinical-standard discussion rather than obsolete dopamine-agonist preferences.
- Final local checks: `npm run test:doc-lint` passed **145 tests**, including the automatically
  discovered wave-6 projection table; `npm run typecheck` passed. The flat-contract/self-audit
  check passed for all five mappings after making the competing-cause labels explicit.
- Clinical and legal correctness still require qualified SME review. Machine validation is not
  evidence promotion, source verification under the human SOP, or approval to author held routes.
