# CRG draft-identity mapping packet validation — wave 8 (2026-10-05)

## Selected pathways and artifact

1. Complex regional pain syndrome (post-stroke shoulder-hand syndrome) ← service-connected stroke residuals.
2. Adrenal insufficiency (secondary/tertiary, glucocorticoid-induced) ← chronic systemic corticosteroid therapy for service-connected rheumatoid arthritis.
3. Tardive dyskinesia ← metoclopramide treatment for service-connected GERD.
4. Osteoradionecrosis of the jaw ← therapeutic radiation for a service-connected oral cavity/oropharyngeal malignancy.
5. Heterotopic ossification ← service-connected residual deficits of traumatic brain injury.

The complete requested flat array is
[crg-draft-identity-mapping-packet-wave8-2026-10-05.json](crg-draft-identity-mapping-packet-wave8-2026-10-05.json).
It has five rows, the user's eight exact mapping keys and four exact evidence-item keys, with
three references per row. This is a research/authoring proposal, **not a signed IME opinion,
patient-level nexus finding, or publication into the governed corpus**. No patient records were
supplied; no individual probability is established.

## Repository selection and direction screen

All five secondary identities were confirmed `draft: true` in the authored corpus; every
identity was checked for existing outgoing and incoming suggestions.

| Secondary identity | Draft | Existing outgoing | Existing incoming | Chosen host primary |
| --- | --- | --- | --- | --- |
| complex-regional-pain-syndrome | true | osteoporosis; contractures (both association only) | none | cerebrovascular-accident-stroke-residuals (draft) |
| addisons-disease | true | depressive-disorder | adrenal-histoplasmosis (association only) | rheumatoid-arthritis (published) |
| tardive-dyskinesia | true | none | bipolar-disorder (association only, antipsychotic named as proximate agent) | gerd (published) |
| osteonecrosis-of-the-jaw | true | none | osteoporosis (association only) | oral-cancer (draft, governed) |
| heterotopic-ossification | true | peripheral-neuropathy (association only) | none | traumatic-brain-injury-residuals (draft) |

Host-to-target duplicate check: none of the five host files already suggests the proposed target.
Wave-8 targets do not repeat any target from waves 1-7 packets; wave 7's own note that Charcot
arthropathy was dropped because that identity is already **published** (`draft: false`) remains in
effect and is not revisited here. No registry, catalog, authored mapping, adjacency, tracker or
application-source data is modified by this packet. Existing wave 1-7 documentation and the
completed documentation-test edits are preserved; no staging or commit is performed.

### Governance and scope controls

- Stroke residuals identity: authored conservatively (association-only depression edge with a
  pre-stroke-depression confounder and a lesion-location note). The CRPS proposal must respect
  that posture; the CRPS identity itself already carries an immobilization-confounder guard for
  its outgoing edges, which applies equally to this incoming route.
- Adrenal insufficiency: the addisons-disease todo records withdrawn peripheral-neuropathy,
  diabetic-retinopathy and chronic-kidney-disease suggestions for lack of condition-specific
  evidence, so this proposal supplies disease-specific sources, not generic endocrine language.
  The rheumatoid-arthritis host is published and must pass host-side review.
- Tardive dyskinesia: the existing incoming route from bipolar disorder is a **different
  proximate agent** (antipsychotic). This metoclopramide route must be reconciled for duplicate
  scope; the two agent classes are not interchangeable proof.
- Osteoradionecrosis: the identity already receives an association-only osteoporosis edge
  (antiresorptive-related osteonecrosis). Radiation-related ORN is a distinct etiology, not a
  duplicate of that route, but both etiologies can coexist and must be separated clinically.
- Heterotopic ossification: the identity's governance authors only an association-only outgoing
  edge (perineural compression by heterotopic bone); this new incoming route from TBI residuals
  should be reviewed against that conservative posture.
- The oral-cancer host identity is draft and governed with six association-only outgoing edges;
  its class-scope posture requires host-side review before any landing. The head-and-neck-cancers
  umbrella remains under its class-scope deferral and is **not** used as the host.

## Medical-source identity and functional-URL checks

All 15 evidence items use canonical `https://pubmed.ncbi.nlm.nih.gov/<PMID>/` URLs. Ten records
were verified by direct PubMed article-page fetch (exact displayed title, indexed authors,
abstract). Five records were verified on their PMC article pages, from which the canonical PMID
was extracted: 36281309 (PMC9587704), 29184808 (PMC5682381), 28024723 (PMC5560021), 35967463
(PMC9366306) and 30341256 (PMC6260996). One record (18223146) has no indexed PubMed abstract;
it is cited only for the recognition claim noted in its title. No placeholder, guessed or
unverified PMID is used.

| Pathway | Verified PubMed identifiers |
| --- | --- |
| Post-stroke CRPS | [16474282](https://pubmed.ncbi.nlm.nih.gov/16474282/), [27495051](https://pubmed.ncbi.nlm.nih.gov/27495051/), [36281309](https://pubmed.ncbi.nlm.nih.gov/36281309/) |
| Glucocorticoid-induced adrenal insufficiency | [25844620](https://pubmed.ncbi.nlm.nih.gov/25844620/), [41521083](https://pubmed.ncbi.nlm.nih.gov/41521083/), [29184808](https://pubmed.ncbi.nlm.nih.gov/29184808/) |
| Metoclopramide-associated tardive dyskinesia | [19886950](https://pubmed.ncbi.nlm.nih.gov/19886950/), [31050085](https://pubmed.ncbi.nlm.nih.gov/31050085/), [18223146](https://pubmed.ncbi.nlm.nih.gov/18223146/) |
| Osteoradionecrosis of the jaw | [28024723](https://pubmed.ncbi.nlm.nih.gov/28024723/), [35967463](https://pubmed.ncbi.nlm.nih.gov/35967463/), [30341256](https://pubmed.ncbi.nlm.nih.gov/30341256/) |
| Heterotopic ossification after TBI | [17572418](https://pubmed.ncbi.nlm.nih.gov/17572418/), [23610702](https://pubmed.ncbi.nlm.nih.gov/23610702/), [21447915](https://pubmed.ncbi.nlm.nih.gov/21447915/) |

Available full-text anchors inspected include [PMC9587704](https://pmc.ncbi.nlm.nih.gov/articles/PMC9587704/),
[PMC5682381](https://pmc.ncbi.nlm.nih.gov/articles/PMC5682381/),
[PMC5560021](https://pmc.ncbi.nlm.nih.gov/articles/PMC5560021/),
[PMC9366306](https://pmc.ncbi.nlm.nih.gov/articles/PMC9366306/) and
[PMC6260996](https://pmc.ncbi.nlm.nih.gov/articles/PMC6260996/). These full texts are not extra
independent studies or additional evidence rows. An initial PubMed in-page result fetch returned
HTTP 200 with no parsed result rows and was **not** counted as verification; discovery was then
performed by web search and every chosen record was fetched individually. One five-record fetch
exceeded the browser tool's ten-second limit; its unseen output was not counted and the batch was
split and rerun. Intermittent NCBI bot/cookie challenges remain possible; functional verification
is point-in-time.

## Legal and rating checks

Live eCFR pages display Title 38 current through 2026-10-01, last amended 2026-08-27. Use
claim-period-specific criteria when adjudicating an actual claim.

- [§ 3.310](https://www.ecfr.gov/current/title-38/part-3/section-3.310): (a) proximate secondary
  causation; (b) attributable worsening beyond natural progression with qualifying baseline
  evidence. Treatment/medication effects are treatment-mediated causation, not a separate
  statutory presumption.
- [§ 3.102](https://www.ecfr.gov/current/title-38/part-3/section-3.102): approximate balance and
  the distinction between probability and speculation. Pooled percentages and incidence ranges
  are not individual nexus probabilities.
- [§ 4.119](https://www.ecfr.gov/current/title-38/part-4/section-4.119): DC 7911 Addison's
  disease (adrenocortical insufficiency) with crisis, episode and corticosteroid-therapy tiers;
  the same section contains diabetes DC 7913 with its Note (1) on compensable complications.
- [§ 4.124a](https://www.ecfr.gov/current/title-38/part-4/section-4.124a): DC 8007-8009 (brain,
  vessels; embolism, thrombosis, hemorrhage) rate the stroke primary 100 percent for six months
  then residuals with a 10 percent minimum; DC 8045 governs TBI residuals with its
  cognitive/emotional/physical facets and Note (1) on overlapping manifestations; **no dedicated
  tardive-dyskinesia or CRPS code exists** — DC 8103 (convulsive tic) and DC 8004 (paralysis
  agitans) are analogy candidates only, and 'causalgia' appears only as descriptive language
  within DC 8525.
- [§ 4.150](https://www.ecfr.gov/current/title-38/part-4/section-4.150): DC 9900 expressly covers
  maxilla/mandible chronic osteomyelitis, osteonecrosis **or osteoradionecrosis** and directs
  rating as chronic osteomyelitis under DC 5000; DC 9918 covers malignant neoplasms of hard and
  soft tissue with continuation and post-treatment residual evaluation. No dedicated candidiasis
  or CRPS-type dental code is invented.
- [§ 4.71a](https://www.ecfr.gov/current/title-38/part-4/section-4.71a): DC 5000 osteomyelitis
  activity/recurrence/post-resection notes; DC 5002 names rheumatoid arthritis among multi-joint
  arthritis examples with DC 5003 for residuals; **DC 5023 heterotopic ossification** exists and
  the Note to DCs 5013-5024 directs evaluation as degenerative arthritis on limitation of motion.
- [§ 4.114](https://www.ecfr.gov/current/title-38/part-4/section-4.114): DC 7206 GERD is the
  published host code for the metoclopramide route.
- [§ 4.20](https://www.ecfr.gov/current/title-38/part-4/section-4.20) and
  [§ 4.27](https://www.ecfr.gov/current/title-38/part-4/section-4.27): any code for the unlisted
  CRPS and tardive-dyskinesia proposals must be justified by analogous function, localization and
  symptoms and built up properly; no built-up code or automatic minimum rating is invented.
- [§ 4.14](https://www.ecfr.gov/current/title-38/part-4/section-4.14): avoid pyramiding across all
  five proposals, including not using the same limitation of motion for both DC 8045 and DC 5023.

## Schema projection (next step, not yet authored)

| Mapping | conditionId (secondary) | nexusClassification | mechanismCategory | etiologicalConsensus | vaNexusProbabilityAlignment |
| --- | --- | --- | --- | --- | --- |
| Post-stroke CRPS ← stroke residuals | complex-regional-pain-syndrome | DIRECT_CAUSATION | MULTIFACTORIAL | PROBABLE (observational; mechanism unresolved) | NOT_ASSERTED |
| Glucocorticoid-induced adrenal insufficiency ← RA chronic steroids | addisons-disease | DIRECT_CAUSATION | PHARMACOLOGICAL_IATROGENIC | IATROGENIC_TREATMENT_EFFECT | NOT_ASSERTED |
| Tardive dyskinesia ← metoclopramide for GERD | tardive-dyskinesia | DIRECT_CAUSATION | PHARMACOLOGICAL_IATROGENIC | IATROGENIC_TREATMENT_EFFECT (low absolute risk) | NOT_ASSERTED |
| Osteoradionecrosis ← oral/oropharyngeal radiotherapy | osteonecrosis-of-the-jaw | DIRECT_CAUSATION | POST_SURGICAL_OR_TREATMENT | IATROGENIC_TREATMENT_EFFECT (radiation effect) | NOT_ASSERTED |
| Heterotopic ossification ← TBI residuals | heterotopic-ossification | DIRECT_CAUSATION | MULTIFACTORIAL | WELL_ESTABLISHED (incidence varies) | NOT_ASSERTED |

These are vocabulary-valid proposed classifications, not approvals or individual medical findings.
No row is marked legally presumed. Every row keeps `NOT_ASSERTED` on patient-level probability
despite the explicit discussion of the "at least as likely as not" standard.

The user's flat interface is **not directly accepted by the actual strict `suggestionSchema`**.
That schema requires the secondary `conditionId`, `rank`, nested `nexusClaim`, `causalMechanism`,
`evidentiaryProfile`, `rationale`, `evidenceGaps` and `sourceReferences`. A future transformation
must author those fields separately, preserve the contested/low-incidence disclosures, use
`verified: false` until qualified-human verification, and enforce host-level rank, catalog,
source-registry and graph rules. No schema was weakened and no governed data was landed.

## Self-audit and verification

- Exactly five mappings with three evidence records each; exact key sets, canonical PubMed URL
  syntax, uniqueness and the individualized-legal safeguard phrases are checked with a strict
  packet-only Zod schema. The actual repository authored-row parsers are also exercised to
  confirm and disclose the flat/nested incompatibility rather than hide it.
- Every narrative addresses § 3.310(a) causation, conditional § 3.310(b) aggravation with
  baseline and natural progression, the "at least as likely as not" standard, competing causes,
  rating scope and § 4.14 nonpyramiding.
- Counter-evidence and limitations are retained: CRPS mechanism expressly unresolved with
  immobilization confounding; adrenal-insufficiency prevalence varying 4.2-52.2 percent by route
  and up to 6-12 months of recovery; metoclopramide risk below 1 percent with roughly 0.1 percent
  per 1,000 patient-years; ORN single-center 4.3 percent; HO incidence 7.9 percent in one severe
  cohort versus an 11-73.3 percent literature range.
- No population percentage, odds ratio or relative risk is converted into an individual
  probability. No intentional rechallenge, unsupervised medication discontinuation or
  patient-specific prescribing is requested. DC 7911 is not limited to autoimmune Addison's
  disease in this packet; the etiology must be documented.
- Final packet-only strict Zod, catalog/draft/direction and safeguard-phrase checks passed for
  five mappings, 15 unique canonical PubMed URLs and five clean host-target pairs. Both actual
  authored schema parsers reject the flat objects as expected; this is a disclosed
  incompatibility, not a repository-schema validation pass.
- The first combined audit run aborted before any assertions on a directory read while scanning
  `data/knowledge-base`; the script was corrected to filter non-JSON entries and the full audit
  rerun passed. The failure output was inspected, not swallowed.
- Final local checks under Node 22.23.2: `npm run test:doc-lint` passed **147 tests** in three
  suites, including the automatically discovered wave-8 projection table; `npm run typecheck`
  and `git diff --check` passed. No build, full application suite or patient-interface test is
  claimed for this documentation-only proposal.
- Qualified clinical/legal and citation-provenance review is still required before publication.
