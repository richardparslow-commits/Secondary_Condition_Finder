# D1 Draft-Authoring Citation Verification Packet (2026-09)

This packet prepares — and only prepares — the qualified-human citation-verification review of the draft-quarantined references authored by the D1 condition-expansion batches of 2026-09-22. Per `docs/citation-verification-sop.md`, repository automation can record source-check metadata and assemble review rows; it **cannot** make the verification decision. Every row here remains `verified: false` until a qualified human records a decision.

The row set is **generated, not transcribed**. The authoritative machine queue is:

```bash
node scripts/report-citation-verification-queue.js --markdown --include-drafts
```

Registry parity and debt state at any time: `node scripts/audit-master-registry.js` and `npm run citations:audit`. This packet's worksheets mirror the authored mapping records; where they disagree, the mapping files and registries are the system of record.

## What verification of these rows means (and does not mean)

- Approving a source verifies that the **source supports the bounded proposition as authored** — for association rows, a population-level or cohort-level ASSOCIATION_ONLY co-occurrence proposition with `NOT_ESTABLISHED` etiological consensus and `hypothesizedOnly` mechanism; for the direct-causation row (brain-cancer → seizure-disorder), a source-supported symptomatic-manifestation proposition whose stronger classification rests entirely on the cited review surviving review. It verifies nothing stronger in either case.
- Verification is not mapping approval, not publication, and not an individual VA medical nexus determination. The draft mappings stay `draft: true` and unpublished regardless of citation outcomes; publishing is a separate gate.
- If review finds the source supports **more** than the bounded proposition (causation or aggravation), do **not** promote the row in place: record the finding in the decision record. The edge classification is a mapping change that requires its own governance disposition.
- If review finds the source supports **less** than the proposition (wrong population, wrong outcome, overstated note), the outcome is reject-with-narrowing or replace: the row stays `verified: false` and the disposition records the reason.

## Reviewer procedure (per row)

1. Open the canonical PubMed record from the row's URL. Confirm every citation-metadata element (authors, title, journal, year, volume/issue/pages, DOI) matches the record exactly.
2. Read the abstract/results against the row's `Note` and the edge's `Proposition` below. The source must support the proposition as written, at association strength, with no overstatement.
3. Record the SOP reviewer-evidence fields: reviewer identity/role, date, claim reviewed, relevant source section, decision (approve / approve-with-narrowing / reject / hold), and unresolved limitations.
4. On approval: flip `verified` to `true` in the mapping file and move the registry source entity from `pending-verification` to `active` (recomputing its canonical-JSON hash), record a `contentDigest` for fetchable bodies per the SOP, update the citation-debt baseline in `scripts/audit-citation-verification.js`, and let the count pins ratchet in the test suite. The debt ratchet closes only through this human step.
5. On rejection or narrowing: keep `verified: false`, record the disposition, and queue the replacement or narrowed source through the same SOP.

## Per-edge verification worksheets

### `apathy` → `depressive-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** Clinical literature defines apathy as a syndrome of diminished goal-directed behavior and motivation that is dissociable from major depression yet frequently co-occurring with it; population and clinical studies report elevated depressive symptom rates among patients exhibiting apathy syndromes across neurologic and psychiatric settings.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established: apathy and major depression share overlapping symptom domains (diminished motivation, anhedonia, psychomotor slowing) that make co-occurrence expected without any directional causal pathway, and the cited literature does not demonstrate that apathy causes, worsens, or prolongs a depressive disorder in an individual veteran.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 1.1 — Marin RS. Differential diagnosis and classification of apathy. Am J Psychiatry. 1990;147(1):22-30. PMID 2403472. doi:10.1176/ajp.147.1.22.**

- URL: https://pubmed.ncbi.nlm.nih.gov/2403472/
- Source checked on: 2026-09-22
- Locator: PMID 2403472; differential-diagnosis section distinguishing apathy from major depression
- Note under review: Definitional review establishing apathy as a distinct clinical syndrome dissociable from major depression; supports the bounded co-occurrence/differential-diagnosis proposition and the identity-overlap caution, not individual causation or aggravation.
- Current state: `verified: false` — pending qualified-human decision

**Row 1.2 — Marin RS. Apathy: concept, syndrome, neural mechanisms, and treatment. Semin Clin Neuropsychiatry. 1996;1(4):304-314. PMID 10320433. doi:10.1053/SCNP00100304.**

- URL: https://pubmed.ncbi.nlm.nih.gov/10320433/
- Source checked on: 2026-09-22
- Locator: PMID 10320433; syndrome definition and neural mechanisms discussion
- Note under review: Syndrome and neural-mechanism review describing frontostriatal circuit involvement in apathy and its co-occurrence with depressive states; supports the hypothesized shared-substrate framing only, with no directional causal claim.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `aphasia-dysphasia` → `depressive-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** Poststroke cohort research reports that aphasic stroke patients show elevated depression rates and that poststroke depression correlates with the degree of cognitive impairment and neurologic deficit; aphasia and depression co-occur within stroke populations more often than chance would predict.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established: the cited cohort literature reports correlations between communication deficit, cognitive burden, and depressive symptoms, but study designs report associations within stroke cohorts and do not demonstrate that an individual's aphasia caused, worsened, or prolonged a depressive disorder; shared stroke lesion burden and psychosocial reaction to acquired communication disability remain competing explanations for the observed co-occurrence.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 2.1 — Kauhanen ML, Korpelainen JT, Hiltunen P, Määttä R, Mononen H, Brusin E, Sotaniemi KA, Myllylä VV. Aphasia, depression, and non-verbal cognitive impairment in ischaemic stroke. Cerebrovasc Dis. 2000;10(6):455-461. PMID 11070376. doi:10.1159/000016107.**

- URL: https://pubmed.ncbi.nlm.nih.gov/11070376/
- Source checked on: 2026-09-22
- Locator: PMID 11070376; cohort results on aphasia, depression, and cognitive impairment
- Note under review: Ischaemic-stroke cohort reporting aphasia and depression co-occurrence with non-verbal cognitive impairment; supports the bounded co-occurrence proposition and the deficit-burden context, not individual causation or aggravation.
- Current state: `verified: false` — pending qualified-human decision

**Row 2.2 — Kauhanen M, Korpelainen JT, Hiltunen P, Brusin E, Mononen H, Määttä R, Nieminen P, Sotaniemi KA, Myllylä VV. Poststroke depression correlates with cognitive impairment and neurological deficits. Stroke. 1999;30(9):1875-1880. PMID 10471439. doi:10.1161/01.str.30.9.1875.**

- URL: https://pubmed.ncbi.nlm.nih.gov/10471439/
- Source checked on: 2026-09-22
- Locator: PMID 10471439; correlation results between poststroke depression and deficit measures
- Note under review: Cohort study reporting that poststroke depression correlates with cognitive impairment and neurologic deficit burden; supports the association framing and the competing-explanation caution, not a directional causal claim.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `arteriosclerosis` → `cerebrovascular-accident-stroke-residuals` — ASSOCIATION_ONLY

**Proposition (associationBasis):** Cohort literature reports that arteriosclerotic vascular risk burden, carotid thickening, and silent brain infarction associate with increased risk of clinical stroke events and with poststroke depression, and that vascular depression associations exist between cerebrovascular disease burden and late-life depressive symptoms.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established: the cited literature reports population-level associations between vascular disease burden and stroke or mood outcomes, but the arteriosclerosis catalog label does not identify which vascular bed is affected, when disease progressed, or whether the individual's specific cerebrovascular event or residual mood disturbance arose from the documented arteriosclerotic process rather than from competing etiologies such as cardioembolism, arrhythmia, or dissection.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 3.1 — Sacco RL, Blanton SL, Slifer S. Atherosclerotic disease and risk of stroke: epidemiologic evidence. Adv Neurol. 2003;92:343-350. PMID 14794445.**

- URL: https://pubmed.ncbi.nlm.nih.gov/14794445/
- Source checked on: 2026-09-22
- Locator: PMID 14794445; epidemiologic association between atherosclerosis and stroke risk
- Note under review: Epidemiologic review of the association between atherosclerotic disease burden and incident stroke risk; supports the population-level association proposition only, with no individual causal determination.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `arteriovenous-fistula` → `congestive-heart-failure` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The hemodialysis-access literature reports arteriovenous fistulas producing high-output cardiac states, with published case reports and reviews describing heart failure secondary to fistula flow and documenting reverse cardiac remodeling after fistula closure or flow reduction in individual patients.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the literature base is dominated by case reports and small series without controlled denominators, fistula flow volume and cardiac reserve vary widely between individuals, and coexisting cardiac disease is the rule in the reported populations, so whether a specific fistula caused or aggravated an individual's heart failure requires case-specific hemodynamic documentation and medical review.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 4.1 — Stern AB, Klemmer PJ. High-output heart failure secondary to arteriovenous fistula. Hemodial Int. 2011;15(1):104-107. PMID 21223485. doi:10.1111/j.1542-4758.2010.00518.x.**

- URL: https://pubmed.ncbi.nlm.nih.gov/21223485/
- Source checked on: 2026-09-22
- Locator: PMID 21223485; pathophysiology and case evidence for fistula-related high-output failure
- Note under review: Review of high-output heart failure attributable to arteriovenous fistula flow in the hemodialysis-access population, including the shunt-hemodynamics pathway and reported reversibility; supports the bounded association proposition and the hemodynamic evidence-gap framing, not automatic individual causation or aggravation.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `astigmatism` → `tension-type-headache` — ASSOCIATION_ONLY

**Proposition (associationBasis):** Optometry clinic studies report headaches co-occurring with uncorrected refractive error including astigmatism, and the International Classification of Headache Disorders includes a descriptive category for headache attributed to refractive error, based on reported temporal association with visual tasks in observational settings.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established: the reported astigmatism-headache association is observational with mixed findings across studies, the ICHD-3 refractive-error headache category is descriptive and its causal mechanism is contested in the headache literature, and tension-type headache has strong competing drivers (stress, posture, sleep, cervicogenic factors) that cannot be excluded without individual assessment.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 5.1 — Wajuihian SO. Exploring correlations between headaches and refractive errors in an optometry clinic sample. Br Ir Orthopt J. 2024;20(1):1-15. PMID 38187096. doi:10.22599/bioj.313.**

- URL: https://pubmed.ncbi.nlm.nih.gov/38187096/
- Source checked on: 2026-09-22
- Locator: PMID 38187096; headache and refractive-error correlation results
- Note under review: Optometry clinic study reporting correlations between headaches and refractive error including astigmatism; explicitly observational, supporting the bounded co-occurrence proposition only, not individual causation or aggravation.
- Current state: `verified: false` — pending qualified-human decision

**Row 5.2 — Khoo NT, Burgos-Blasco B, Antoniou A, Jenkins B, Fraser CL, Moloney G. Headache attributed to refractive error: improvement after topography-guided photorefractive keratectomy with corneal cross-linking in patients with keratoconus. J Clin Med. 2024;13(3):690. PMID 38337384. doi:10.3390/jcm13030690.**

- URL: https://pubmed.ncbi.nlm.nih.gov/38337384/
- Source checked on: 2026-09-22
- Locator: PMID 38337384; headache outcomes after refractive correction
- Note under review: Case series reporting headache improvement after refractive correction in keratoconus patients, illustrating the refractive-error headache concept and its contested, treatment-signal-based support; reinforces the association-only framing rather than establishing individual causation.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `atypical-odontalgia` → `trigeminal-neuralgia` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The atypical-odontalgia literature classifies the condition among persistent idiopathic or neuropathic orofacial pain states that share diagnostic space with the cranial neuralgias, and reviews discuss shared neuropathic features, deafferentation-type mechanisms, and co-occurrence within the same trigeminal distribution as trigeminal neuralgia.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established: atypical odontalgia is a diagnosis of exclusion with uncertain origin, and the cited literature reports classification proximity and mechanistic hypotheses, not that atypical odontalgia caused or aggravated trigeminal neuralgia in any individual; the two entities also enter the same differential diagnosis, so observed co-occurrence can reflect diagnostic substitution or shared neuropathic susceptibility rather than a directional pathway.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 6.1 — Patel SB, Boros AL, Kumar SK. Atypical odontalgia--an update. J Calif Dent Assoc. 2012;40(9):739-747. PMID 23097829.**

- URL: https://pubmed.ncbi.nlm.nih.gov/23097829/
- Source checked on: 2026-09-22
- Locator: PMID 23097829; etiology, pathophysiology, and diagnostic-approach sections
- Note under review: Review describing atypical odontalgia as a commonly misdiagnosed neuropathic condition of uncertain etiology within the orofacial-pain spectrum; supports the classification-proximity and diagnostic-caution proposition only, not individual causation or aggravation.
- Current state: `verified: false` — pending qualified-human decision

**Row 6.2 — Melis M, Lobo SL, Ceneviz C, Zawawi K, Al-Badawi E, Maloney G, Mehta N. Atypical odontalgia: a review of the literature. Headache. 2003;43(10):1060-1074. PMID 14629241. doi:10.1046/j.1526-4610.2003.03207.x.**

- URL: https://pubmed.ncbi.nlm.nih.gov/14629241/
- Source checked on: 2026-09-22
- Locator: PMID 14629241; etiology, mechanism, and management-review sections
- Note under review: Literature review reporting deafferentation as the most likely initiating mechanism with psychological and idiopathic factors implicated, and warning against unnecessary dental intervention; supports the hypothesized shared-mechanism framing only, with no directional causal claim.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `auriculotemporal-neuralgia` → `trigeminal-neuralgia` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The auriculotemporal-nerve literature defines ATN neuralgia as a paroxysmal preauricular and temporal pain syndrome carried by a terminal branch of the mandibular (third) division of the trigeminal nerve, classifies it among the cranial neuralgias in the International Classification of Headache Disorders framework, and notes clinical overlap and differential-diagnostic proximity with other trigeminal-distribution neuralgias.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established: ATN neuralgia and trigeminal neuralgia are sibling diagnoses within the same cranial-neuralgia family rather than a source and outcome, and the cited literature reports anatomic relationship and diagnostic overlap, not that one condition caused or aggravated the other in any individual.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 7.1 — Speciali JG, Gonçalves DA. Auriculotemporal neuralgia. Curr Pain Headache Rep. 2005;9(4):277-280. PMID 16004845. doi:10.1007/s11916-005-0037-0.**

- URL: https://pubmed.ncbi.nlm.nih.gov/16004845/
- Source checked on: 2026-09-22
- Locator: PMID 16004845; anatomy, syndrome description, and ICHD-classification discussion
- Note under review: Review of auriculotemporal-nerve anatomy, the ATN-neuralgia syndrome, and its ICHD classification among the cranial neuralgias; supports the classification-proximity and differential-diagnosis proposition only, not individual causation or aggravation.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `bagassosis` → `interstitial-lung-disease` — ASSOCIATION_ONLY

**Proposition (associationBasis):** Bagassosis is an occupational hypersensitivity pneumonitis caused by thermophilic actinomycetes in molded sugar-cane bagasse, and chronic hypersensitivity pneumonitis from inhaled antigen exposure is reviewed as a fibrotic interstitial lung disease with imaging and pathology descriptions of fibrotic evolution; bagassosis cases are reported within this interstitial-lung-disease spectrum.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the exposure-disease literature for bagassosis consists of historic case series without population denominators, the fibrotic outcome is documented for chronic hypersensitivity pneumonitis generally rather than for bagassosis specifically, and other antigen exposures, idiopathic interstitial pneumonias, and connective-tissue disease must be excluded before any individual attribution.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 8.1 — Pereira CA, Gimenez A, Kuranishi L, Storrer K. Chronic hypersensitivity pneumonitis. J Asthma Allergy. 2016;9:171-181. PMID 27703382. doi:10.2147/JAA.S81540.**

- URL: https://pubmed.ncbi.nlm.nih.gov/27703382/
- Source checked on: 2026-09-22
- Locator: PMID 27703382; chronic-HP natural history and fibrotic evolution discussion
- Note under review: Review of chronic hypersensitivity pneumonitis as a fibrotic interstitial lung disease including clinical, imaging, and outcome features; supports the bounded syndrome-level proposition and the evidence-gap framing, not automatic individual causation or aggravation for bagassosis specifically.
- Current state: `verified: false` — pending qualified-human decision

**Row 8.2 — Buechner HA. Bagassosis. GP. 1967;35(3):108-114. PMID 5609030.**

- URL: https://pubmed.ncbi.nlm.nih.gov/5609030/
- Source checked on: 2026-09-22
- Locator: PMID 5609030; clinical description and exposure relationship
- Note under review: Historic clinical review describing bagassosis as hypersensitivity pneumonitis from thermophilic-actinomycete-contaminated sugar-cane bagasse; supports the exposure-syndrome identification only; the small historic evidence base is itself a reason this edge remains association-strength.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `balanitis-balanoposthitis` → `phimosis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The systematic-review literature on penile inflammatory skin disorders reports that penile inflammation produces significant morbidity including acquired phimosis and balanoposthitis, that recurrent balanoposthitis appears among the recognized causes of acquired phimosis, and that a tight or scarred foreskin in turn predisposes to poor hygiene and persistent inflammation, so the two conditions co-occur within recurrent penile inflammatory disease.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the reported relationship is bidirectional (inflammation causing scarring and scarring predisposing to inflammation), the evidence base is review-level without longitudinal individual attribution, and both conditions share upstream drivers (diabetes, poor hygiene, dermatoses such as lichen sclerosus, infection) that can produce either or both independently.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 9.1 — Morris BJ, Krieger JN. Penile inflammatory skin disorders and the preventive role of circumcision. Int J Prev Med. 2017;8:32. PMID 28567234. doi:10.4103/ijpvm.IJPVM_377_16.**

- URL: https://pubmed.ncbi.nlm.nih.gov/28567234/
- Source checked on: 2026-09-22
- Locator: PMID 28567234; morbidity section listing acquired phimosis and balanoposthitis among inflammatory outcomes
- Note under review: Systematic review reporting that penile inflammation produces morbidity including acquired phimosis and balanoposthitis, with recurrence and scarring interlinked; supports the bounded co-occurrence proposition and the bidirectional-caution framing, not automatic individual causation or aggravation.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `bankart-lesion` → `post-traumatic-osteoarthritis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The Bankart-lesion literature identifies the lesion as an anteroinferior glenoid-rim fracture occurring in a substantial fraction of first-time traumatic anterior shoulder dislocations and documents that untreated or recurrent lesions lead to recurrent anterior instability and glenoid bone loss; shoulder-dislocation cohorts and meta-analyses report dislocation arthropathy as a recognized long-term outcome after traumatic anterior instability.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the cited literature documents the untreated-course association and the arthropathy outcome at cohort level, but individual attribution requires documenting the initial chondral injury, recurrent-instability episodes, and progression chronology, and excluding primary osteoarthritis, prior trauma, and other arthropathy drivers, none of which the catalog label provides.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 10.1 — Weisberg Z, Cole W, Rumps MV, Vopat B, Mulcahey MK. Bony Bankart Lesion: Diagnosis, Management, and Outcomes. JBJS Rev. 2024;12(5). PMID 38709911. doi:10.2106/JBJS.RVW.23.00200.**

- URL: https://pubmed.ncbi.nlm.nih.gov/38709911/
- Source checked on: 2026-09-22
- Locator: PMID 38709911; natural-history and untreated-course discussion
- Note under review: Review of bony Bankart lesions documenting their occurrence in first-time anterior dislocations and the untreated course of recurrent anterior instability and glenoid bone loss; supports the bounded injury-outcome association proposition and the evidence-gap framing, not automatic individual causation or aggravation.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `benign-migratory-glossitis` → `psoriasis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** A systematic review and meta-analysis of observational studies reports that geographic tongue (benign migratory glossitis) occurs at substantially higher prevalence among patients with psoriasis than in controls, and smaller clinical studies report the co-occurrence of the two mucocutaneous findings.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established: the reported relationship is a cross-sectional prevalence association, geographic tongue is a benign inflammatory lesion of the tongue dorsum, and no literature demonstrates that geographic tongue caused, worsened, or prolonged psoriasis or vice versa in any individual; the co-occurrence is most consistently framed as a shared inflammatory diathesis rather than a directional pathway.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 11.1 — González-Álvarez L, García-Martín JM, García-Pola MJ. Association between geographic tongue and psoriasis: A systematic review and meta-analyses. J Oral Pathol Med. 2019;48(5):365-372. PMID 30739339. doi:10.1111/jop.12840.**

- URL: https://pubmed.ncbi.nlm.nih.gov/30739339/
- Source checked on: 2026-09-22
- Locator: PMID 30739339; meta-analysis results on geographic tongue and psoriasis
- Note under review: Systematic review and meta-analysis reporting higher geographic-tongue prevalence among psoriasis patients; supports the bounded prevalence-association proposition only, not individual causation or aggravation.
- Current state: `verified: false` — pending qualified-human decision

**Row 11.2 — Tarakji B, Umair A, Babaker Z, Sn A, Gazal G, Sarraj F. Relation between psoriasis and geographic tongue. J Clin Diagn Res. 2014;8(11):ZE06-7. PMID 25584342. doi:10.7860/JCDR/2014/9101.5171.**

- URL: https://pubmed.ncbi.nlm.nih.gov/25584342/
- Source checked on: 2026-09-22
- Locator: PMID 25584342; co-occurrence and histopathology discussion
- Note under review: Review discussing the reported co-occurrence of psoriasis and geographic tongue and the shared histopathologic features; supports the shared-diathesis framing and the diagnostic-caution note, not a directional causal claim.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `benign-paroxysmal-positional-vertigo` → `anxiety-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** Systematic reviews and meta-analyses of observational studies report that patients with BPPV show significantly higher anxiety prevalence than controls (roughly threefold increased odds in one meta-analysis, with about a quarter of BPPV patients affected), and a large vestibular-disorder meta-analysis reports elevated anxiety across episodic vestibular conditions including BPPV, with dizziness-handicap scores correlating with anxiety measures.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the cited meta-analyses pool cross-sectional and cohort studies that cannot establish direction, the included reviews explicitly call for further studies to confirm the associations, anxiety disorders can amplify or maintain dizziness symptoms independently of peripheral vestibular status, and shared drivers (inner-ear disease, medical comorbidity, psychosocial stressors) require individual exclusion.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 12.1 — Yeo BSY, Toh EMS, Lim NE, Lee RS, Ho RCM, Tam WWS, Ngo RYS. Association of Benign Paroxysmal Positional Vertigo with Depression and Anxiety-A Systematic Review and Meta-Analysis. Laryngoscope. 2024;134(2):526-534. PMID 37560919. doi:10.1002/lary.30957.**

- URL: https://pubmed.ncbi.nlm.nih.gov/37560919/
- Source checked on: 2026-09-22
- Locator: PMID 37560919; meta-analysis results and conclusion
- Note under review: Systematic review and meta-analysis reporting BPPV associated with roughly threefold increased anxiety risk and elevated anxiety inventory scores; explicitly calls for further studies to confirm the association, supporting the bounded association-only framing rather than individual causation.
- Current state: `verified: false` — pending qualified-human decision

**Row 12.2 — Kim CH, McCray LR, Nguyen SA, Staab JP, Jafri S, Rizk H. Anxiety and Depression in Adults With Vestibular Disorders: A Systematic Review and Meta-Analysis. Laryngoscope. 2026;136(2):535-546. PMID 40815545. doi:10.1002/lary.70055.**

- URL: https://pubmed.ncbi.nlm.nih.gov/40815545/
- Source checked on: 2026-09-22
- Locator: PMID 40815545; BPPV subgroup prevalence and meta-regression results
- Note under review: Large vestibular-disorder meta-analysis reporting elevated anxiety prevalence across episodic vestibular conditions including BPPV with dizziness-handicap correlation; supports the syndrome-level comorbidity proposition and the bidirectionality caution, not a directional causal claim.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `bicipital-tendinitis` → `rotator-cuff-injury` — ASSOCIATION_ONLY

**Proposition (associationBasis):** A prospective arthroscopic cohort of 207 shoulders found pulley tears and long-head-of-biceps pathology significantly associated with rotator cuff injury (P < .001), and shoulder-surgery reviews describe bicipital tenosynovitis and rotator cuff disease as commonly co-occurring degenerative findings in the same shoulder; several surgical-indications reviews list biceps disease persisting after failed decompression for rotator cuff tendinitis.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the co-prevalence data are cross-sectional surgical cohorts selected for arthroscopy, the shared degenerative microtrauma environment of the bicipital groove and cuff insertion can explain co-occurrence without either structure causing the other, and biceps symptoms can reflect cuff pathology rather than cause it, so direction cannot be inferred for any individual.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 13.1 — Braun S, Horan MP, Elser F, Millett PJ. Lesions of the biceps pulley. Am J Sports Med. 2011;39(4):790-795. PMID 21335355. doi:10.1177/0363546510393942.**

- URL: https://pubmed.ncbi.nlm.nih.gov/21335355/
- Source checked on: 2026-09-22
- Locator: PMID 21335355; cohort results and conclusion
- Note under review: Prospective arthroscopic cohort of 207 shoulders reporting a significant association between reflection-pulley tears and rotator cuff injury (P < .001) and between pulley lesions and biceps tendon instability; supports the co-prevalence proposition only, not a directional causal claim.
- Current state: `verified: false` — pending qualified-human decision

**Row 13.2 — Sethi N, Wright R, Yamaguchi K. Disorders of the long head of the biceps tendon. J Shoulder Elbow Surg. 1999;8(6):644-654. PMID 10633904. doi:10.1016/s1058-2746(99)90105-2.**

- URL: https://pubmed.ncbi.nlm.nih.gov/10633904/
- Source checked on: 2026-09-22
- Locator: PMID 10633904; review discussion of biceps-cuff interaction
- Note under review: Review of long-head-of-biceps disorders describing chronic inflammatory and structural biceps changes co-occurring with rotator cuff disease and listing biceps disease after failed rotator-cuff decompression among tenodesis indications; supports the clinical co-occurrence proposition, not causation.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `bile-reflux-gastritis` → `esophagitis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The alkaline (enterogastric) reflux literature documents bile-containing reflux producing both gastritis and esophagitis: a review of alkaline reflux gastritis and esophagitis describes the syndrome and its association with gastroduodenal dysmotility and prior gastric surgery, and a surgical series of spontaneous enterogastric reflux reported gastritis and esophagitis occurring together in refluxing patients; bile reflux is also frequently documented alongside acid reflux in reflux-type esophagitis cohorts.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level for this edge: the strongest published associations come from postsurgical populations where the operation itself created the reflux, non-surgical bile reflux cohorts are small and frequently confounded by concurrent acid reflux, H. pylori status, NSAID exposure, and motility disorders that independently injure the esophageal mucosa, and the relative contribution of the biliary component alone cannot be isolated for any individual, so the mapping asserts syndrome-level co-occurrence only.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 14.1 — Nath BJ, Warshaw AL. Alkaline reflux gastritis and esophagitis. Annu Rev Med. 1984;35:383-396. PMID 6372664. doi:10.1146/annurev.me.35.020184.002123.**

- URL: https://pubmed.ncbi.nlm.nih.gov/6372664/
- Source checked on: 2026-09-22
- Locator: PMID 6372664; review scope and postsurgical association
- Note under review: Review describing the alkaline reflux syndrome in which duodenogastric bile-containing reflux produces gastritis and esophagitis, principally in the postsurgical setting; supports the syndrome-level co-occurrence proposition and the postsurgical-confound caution, not a directional claim for non-surgical cases.
- Current state: `verified: false` — pending qualified-human decision

**Row 14.2 — Gowen GF. Spontaneous enterogastric reflux gastritis and esophagitis. Ann Surg. 1985;201(2):170-175. PMID 3970596. doi:10.1097/00000658-198502000-00006.**

- URL: https://pubmed.ncbi.nlm.nih.gov/3970596/
- Source checked on: 2026-09-22
- Locator: PMID 3970596; case-series findings
- Note under review: Surgical series of spontaneous (non-operated) enterogastric reflux reporting gastritis and esophagitis occurring together in refluxing patients; supports co-occurrence in a small observational series with limited denominators, not individual causation.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `biliary-tract-cancer` → `malnutrition-residuals` — ASSOCIATION_ONLY

**Proposition (associationBasis):** Prognostic cohort studies in intrahepatic cholangiocarcinoma report that roughly half or more of patients fall into CONUT-defined mild-or-worse malnutrition before any treatment (53.5% mild plus 7% moderate-severe in one 101-patient cohort; 43.7% at CONUT >= 2 in a 71-patient cohort), and higher malnutrition scores independently predicted shorter survival, consistent with the malignant-obstruction and cancer-anorexia burden described for biliary tract cancers.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: these are retrospective treatment-cohort studies using nutritional scores for prognosis, not etiologic studies attributing a malnutrition diagnosis to the cancer; cholangiocarcinoma populations carry competing wasting drivers including prior hepatectomy, chronic liver disease and parasitic-biliary disease endemic to the studied regions, and tumor-related cachexia overlaps with treatment-related anorexia, so attribution of malnutrition residuals to the cancer in any individual requires medical professional review rather than this mapping.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 15.1 — Titapun A, Sookprasert A, Sripanuskul Y, Watcharenwong P, Loilome W, Twinprai P, Srisuk T, Prajumwongs P, Chindaprasirt J. Preoperative controlling nutritional status (CONUT) score is an independent prognostic factor in cholangiocarcinoma patients treated with hepatectomy. Heliyon. 2023;9(10):e20473. PMID 37822625. doi:10.1016/j.heliyon.2023.e20473.**

- URL: https://pubmed.ncbi.nlm.nih.gov/37822625/
- Source checked on: 2026-09-22
- Locator: PMID 37822625; cohort results and CONUT distribution
- Note under review: Retrospective 101-patient intrahepatic cholangiocarcinoma cohort reporting 53.5% mild and 7% moderate-severe CONUT-defined malnutrition preoperatively, with high CONUT an independent poor-prognosis factor (HR 4.71); supports the prevalence proposition, not individual etiologic attribution.
- Current state: `verified: false` — pending qualified-human decision

**Row 15.2 — Miyata T, Yamashita YI, Higashi T, Taki K, Izumi D, Kosumi K, Tokunaga R, Nakagawa S, Okabe H, Imai K, Hashimoto D, Chikamoto A, Baba H. The Prognostic Impact of Controlling Nutritional Status (CONUT) in Intrahepatic Cholangiocarcinoma Following Curative Hepatectomy: A Retrospective Single Institution Study. World J Surg. 2018;42(4):1085-1091. PMID 28887635. doi:10.1007/s00268-017-4214-1.**

- URL: https://pubmed.ncbi.nlm.nih.gov/28887635/
- Source checked on: 2026-09-22
- Locator: PMID 28887635; cohort results and conclusion
- Note under review: Retrospective 71-patient intrahepatic cholangiocarcinoma cohort reporting 43.7% of patients at CONUT >= 2 with significantly shorter overall survival (HR 3.02); supports the malnutrition-burden proposition at the cohort level only.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `bladder-contracture` → `urinary-frequency-retention` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The chronic-cystitis literature documents contracted bladder with bladder-wall thickening as the typical gross pathologic change in ketamine-related cystitis, characterized clinically by urinary frequency and bladder pain, and severe chronic cystitis syndromes broadly are described as producing small-capacity fibrotic bladders whose storage physiology manifests as severe frequency with variable emptying dysfunction; urologic-cause reviews (including genitourinary schistosomiasis systematic review data) document chronic inflammatory bladder disease progressing to fibrotic contracture with storage symptoms.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the evidence is syndrome-descriptive (case series, reviews, and etiology-specific cohorts such as ketamine and schistosomiasis) rather than controlled studies linking a diagnosed bladder contracture to urinary frequency/retention residuals in individual patients; a contracted bladder can coexist with neurogenic bladder, prior pelvic surgery or radiation, outlet obstruction, and medication effects that independently produce frequency and retention, and the fibrosis-symptom relationship in any individual requires urodynamic confirmation by a qualified medical professional, so no directional claim is asserted here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 16.1 — Jhang JF, Hsu YH, Kuo HC. Possible pathophysiology of ketamine-related cystitis and associated treatment strategies. Int J Urol. 2015;22(9):816-825. PMID 26087832. doi:10.1111/iju.12841.**

- URL: https://pubmed.ncbi.nlm.nih.gov/26087832/
- Source checked on: 2026-09-22
- Locator: PMID 26087832; gross pathology and presentation description
- Note under review: Review documenting contracted bladder with bladder-wall thickening as the most typical gross pathologic change of ketamine-related cystitis, presenting with urinary frequency and bladder pain; supports the chronic-cystitis-to-contracted-bladder co-occurrence proposition within that syndrome, not general causation.
- Current state: `verified: false` — pending qualified-human decision

**Row 16.2 — Khalaf I, Shokeir A, Shalaby M. Urologic complications of genitourinary schistosomiasis. World J Urol. 2012;30(1):31-38. PMID 21909645. doi:10.1007/s00345-011-0751-7.**

- URL: https://pubmed.ncbi.nlm.nih.gov/21909645/
- Source checked on: 2026-09-22
- Locator: PMID 21909645; bladder complications sections
- Note under review: Systematic review documenting chronic inflammatory bladder disease (schistosomal cystitis) progressing to fibrotic contracture with storage and obstructive urinary symptoms; illustrates the inflammation-to-contracture sequence in an etiologically specific population, supporting the co-occurrence proposition only.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `bladder-pain-syndrome-interstitial-cystitis` → `depressive-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** A PRISMA systematic review of psychosocial comorbidities in IC/BPS (34 studies, meta-analytic pooling) reports population mean CES-D depression scores of 19.89 (SD 13.12) consistent with the range seen in clinical depression and mean HADS-A anxiety scores of 8.15, with psychosocial difficulty worse than average on essentially all measures, and a nationwide population-based cohort study reports increased healthcare-seeking risks of anxiety, depression, and insomnia among patients with bladder pain syndrome/interstitial cystitis.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the systematic review pools predominantly cross-sectional studies that cannot establish direction, the population cohort measures healthcare-seeking behavior rather than incident depression attribution, chronic pelvic pain and mood disorders are bidirectionally intertwined (depression amplifies pain perception and pain burden drives depressive symptoms), and shared drivers (central sensitization, other chronic pain syndromes, psychosocial stressors) require individual exclusion, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 17.1 — McKernan LC, Walsh CG, Reynolds WS, Crofford LJ, Dmochowski RR, Williams DA. Psychosocial co-morbidities in Interstitial Cystitis/Bladder Pain syndrome (IC/BPS): A systematic review. Neurourol Urodyn. 2018;37(3):926-941. PMID 28990698. doi:10.1002/nau.23421.**

- URL: https://pubmed.ncbi.nlm.nih.gov/28990698/
- Source checked on: 2026-09-22
- Locator: PMID 28990698; meta-analysis results and conclusion
- Note under review: PRISMA systematic review with meta-analytic pooling reporting IC/BPS population mean CES-D depression scores (19.89, SD 13.12) in the range seen in clinical depression and elevated HADS-A anxiety scores, with pervasive psychosocial difficulty; supports the comorbidity proposition, not a directional causal claim.
- Current state: `verified: false` — pending qualified-human decision

**Row 17.2 — Chuang YC, Weng SF, Hsu YW, Huang CL, Wu MP. Increased risks of healthcare-seeking behaviors of anxiety, depression and insomnia among patients with bladder pain syndrome/interstitial cystitis: a nationwide population-based study. Int Urol Nephrol. 2015;47(2):275-281. PMID 25577231. doi:10.1007/s11255-014-0908-6.**

- URL: https://pubmed.ncbi.nlm.nih.gov/25577231/
- Source checked on: 2026-09-22
- Locator: PMID 25577231; cohort risk results
- Note under review: Nationwide population-based cohort study reporting increased healthcare-seeking risks of anxiety, depression, and insomnia among IC/BPS patients; supports the population-level comorbidity proposition while measuring care-seeking rather than incident attribution, so no directional claim is supported.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `blindness` → `depressive-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** A systematic review of visual impairment and depression in the elderly (ten included studies ranging from 31 to 21,995 participants) reports depression associated with visual impairment in every included study, while noting that heterogeneous diagnostic instruments prevented meta-analysis or a pooled causal estimate, and a large age-stratified cross-sectional survey of blind and partially sighted adults reports diagnostic-algorithm depression prevalence of 9.4 to 22.8 percent across age and sex strata, highest among younger adults, with late-onset vision loss associated with higher depression rates.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the systematic review explicitly could not establish a pooled relationship because of unstandardized diagnostics, the cross-sectional design of the prevalence data cannot establish direction, depression can amplify functional disability from vision loss and vision loss can drive depressive symptoms through loss of independence and social participation, and competing drivers (preexisting mood disorder, other sensory impairments, comorbid medical disease) require individual exclusion, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 18.1 — Ribeiro MV, Hasten-Reiter Júnior HN, Ribeiro EA, Jucá MJ, Barbosa FT, Sousa-Rodrigues CF. Association between visual impairment and depression in the elderly: a systematic review. Arq Bras Oftalmol. 2015;78(3):197-201. PMID 26222114. doi:10.5935/0004-2749.20150051.**

- URL: https://pubmed.ncbi.nlm.nih.gov/26222114/
- Source checked on: 2026-09-22
- Locator: PMID 26222114; systematic review results and limitation statement
- Note under review: Systematic review of ten studies (31 to 21,995 participants) reporting depression associated with visual impairment in all included studies while explicitly stating that unstandardized diagnostic tests prevented meta-analysis or establishment of a relationship; supports the bounded comorbidity proposition and the no-pooled-causal-estimate caution, not individual causation.
- Current state: `verified: false` — pending qualified-human decision

**Row 18.2 — Brunes A, Heir T. Visual impairment and depression: Age-specific prevalence, associations with vision loss, and relation to life satisfaction. World J Psychiatry. 2020;10(6):139-149. PMID 32742947. doi:10.5498/wjp.v10.i6.139.**

- URL: https://pubmed.ncbi.nlm.nih.gov/32742947/
- Source checked on: 2026-09-22
- Locator: PMID 32742947; prevalence estimates and regression results
- Note under review: Age-stratified cross-sectional survey of 736 blind and partially sighted adults reporting diagnostic-algorithm depression prevalence of 9.4 to 22.8 percent with late-onset vision loss and additional impairments associated with higher rates; supports the prevalence proposition at the cross-sectional level only, not a directional causal claim.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `bone-cysts` → `malunion-nonunion-of-fractures` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The benign-bone-cyst literature documents pathological fracture as the common presenting event of cyst-weakened bone (the proximal-femur and proximal-humerus locations being classic) and, in the same lesion population, reports fracture-related and cyst-related healing complications: a femoral head and neck benign-lesion systematic review found 20.8 percent of patients presenting with pathological fracture and 12.5 percent local recurrence after curettage, and simple-cyst case series document growth arrest after pathological fracture through the physis.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level for this edge: the cited studies document cyst population co-occurrence rather than controlled estimates of fracture-healing-complication rates attributable to cysts, malunion and nonunion in any individual have competing determinants (fracture location and displacement, immobilization adequacy, patient age and biology) that orthopedic assessment must separate, and the growth-arrest literature explicitly lists iatrogenic and treatment mechanisms among the candidate causes, so the mapping asserts lesion-population co-occurrence only.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 19.1 — Clayer M, Boatright C, Conrad E. Growth disturbances associated with untreated benign bone cysts. Aust N Z J Surg. 1997;67(12):872-873. PMID 9451345. doi:10.1111/j.1445-2197.1997.tb07616.x.**

- URL: https://pubmed.ncbi.nlm.nih.gov/9451345/
- Source checked on: 2026-09-22
- Locator: PMID 9451345; case-series background and conclusions
- Note under review: Case series of three patients documenting growth disturbance from benign bone cysts adjacent to an active physis in the absence of surgical intervention, with physeal penetration, pathological fracture, and curettage listed as candidate mechanisms; supports the lesion-population co-occurrence proposition and the competing-mechanism caution, not individual causation.
- Current state: `verified: false` — pending qualified-human decision

**Row 19.2 — Shi J, Zhao Z, Yan T, Guo W, Yang R, Tang X, Qu H, Dong S. Surgical treatment of benign osteolytic lesions in the femoral head and neck: a systematic review. BMC Musculoskelet Disord. 2021;22(1):549. PMID 34134687. doi:10.1186/s12891-021-04442-y.**

- URL: https://pubmed.ncbi.nlm.nih.gov/34134687/
- Source checked on: 2026-09-22
- Locator: PMID 34134687; systematic review results
- Note under review: Systematic review of 33 articles (274 patients) reporting 20.8 percent pathological-fracture presentation among benign osteolytic lesions with documented recurrence and joint-preservation outcomes after curettage; supports the fracture co-occurrence proposition in the lesion population, not a fracture-healing-complication causal estimate.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `bone-tumors` → `malunion-nonunion-of-fractures` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The benign-bone-tumor literature documents pathological fracture through tumor-weakened bone as a standard presentation and surgical indication (a Nigerian orthopedic series lists pathological fracture among the most common indications for surgery in 67 surgically treated benign bone tumors), and a femoral head and neck benign-lesion systematic review reports 20.8 percent pathological-fracture presentation with documented post-treatment recurrence (33.3 percent for giant cell tumor after curettage) and fracture cases treated with joint preservation.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level for this edge: the cited studies document lesion-population co-occurrence rather than controlled fracture-healing-complication rates attributable to bone tumors, malunion and nonunion have competing determinants (tumor site and extent, fracture displacement, curettage and reconstruction choices, biology) that the orthopedic record must separate, and recurrence-and-revision pathways confound any simple attribution, so the mapping asserts lesion-population co-occurrence only.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 20.1 — Eyesan SU, Idowu OK, Obalum DC, Nnodu OE, Abdulkareem FB. Surgical consideration for benign bone tumors. Niger J Clin Pract. 2011;14(2):146-150. PMID 21860128. doi:10.4103/1119-3077.84003.**

- URL: https://pubmed.ncbi.nlm.nih.gov/21860128/
- Source checked on: 2026-09-22
- Locator: PMID 21860128; series results and indications
- Note under review: Prospective series of 67 surgically treated benign bone tumors listing pathological fracture among the most common surgical indications alongside painful swelling, with recurrence concentrated in giant cell tumor; supports the lesion-population fracture co-occurrence proposition, not a healing-complication causal estimate.
- Current state: `verified: false` — pending qualified-human decision

**Row 20.2 — Shi J, Zhao Z, Yan T, Guo W, Yang R, Tang X, Qu H, Dong S. Surgical treatment of benign osteolytic lesions in the femoral head and neck: a systematic review. BMC Musculoskelet Disord. 2021;22(1):549. PMID 34134687. doi:10.1186/s12891-021-04442-y.**

- URL: https://pubmed.ncbi.nlm.nih.gov/34134687/
- Source checked on: 2026-09-22
- Locator: PMID 34134687; systematic review results
- Note under review: Systematic review of 33 articles (274 patients) reporting 20.8 percent pathological-fracture presentation and giant-cell-tumor local recurrence of 33.3 percent after curettage with joint-preservation outcomes; supports the fracture co-occurrence and local-aggressiveness propositions in the lesion population, not individual causation.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `brain-cancer` → `seizure-disorder` — DIRECT_CAUSATION

**Proposition (direct_causation):** Brain cancer (glioblastoma and related glial tumors) → tumor-driven cortical disruption (glutamate excitotoxicity, ion-channel dysfunction, inflammatory tumor microenvironment) → electroclinically characterized seizures; seizures are a direct symptomatic manifestation of the tumor rather than a co-occurring condition, with chronology and tumor-confirmed diagnosis required in every case.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 21.1 — Scheffel TB, Diz FM, Wieck A, Begnini KR, da Costa JC. The molecular landscape of glioblastoma-associated epilepsy. J Mol Med (Berl). 2025;103(8):923-933. PMID 40576825. doi:10.1007/s00109-025-02567-4.**

- URL: https://pubmed.ncbi.nlm.nih.gov/40576825/
- Source checked on: 2026-09-22
- Locator: PMID 40576825; molecular-mechanism review results
- Note under review: Review of glioblastoma-associated epilepsy documenting seizures as a common symptom reflecting tumor microenvironment interactions, with molecular mechanisms including increased glutamate release, ion-channel dysfunction, inflammation, and shared synaptic and immune pathways; supports the direct tumor-driven seizure mechanism, not a statistical comorbidity framing.
- Current state: `verified: false` — pending qualified-human decision

**Row 21.2 — Kerkhof M, Benit C, Duran-Pena A, Vecht CJ. Seizures in oligodendroglial tumors. CNS Oncol. 2015;4(5):347-356. PMID 26478444. doi:10.2217/cns.15.29.**

- URL: https://pubmed.ncbi.nlm.nih.gov/26478444/
- Source checked on: 2026-09-22
- Locator: PMID 26478444; epilepsy prevalence and mechanism discussion
- Note under review: Review reporting epilepsy development in more than 70 to 90 percent of oligodendroglial tumors with glutamate and GABA metabolism alterations implicated in glioma-associated epilepsy and seizure outcomes after surgery, radiotherapy, and chemotherapy; supports the tumor-driven seizure physiology within the glial-tumor spectrum, not individual claim determination.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `bronchitis` → `copd` — ASSOCIATION_ONLY

**Proposition (associationBasis):** A prospective birth-cohort trajectory study (8,583 participants followed to age 53) identifies childhood bronchitis and pneumonia among the early-life predictors of the below-average and accelerated-decline lung-function trajectories that carry approximately 75 percent of adult COPD burden, and a referral-clinic cohort (803 COPD patients among 4,345 recruited) reports significantly lower FEV1, FVC, and FEF25-75 with more frequent chronic expectoration and recurrent infections among COPD patients reporting childhood pneumonia; a separate 1958-birth-cohort spirometry study found no association between childhood chest illness and accelerated mid-adult lung-function decline.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the trajectory association is confounded by tobacco exposure, occupational exposures, asthma, and developmental lung-function deficits, the clinic cohort is referral-sampled without population denominators, the one birth-cohort study measuring within-person decline found no effect, and no study provides an individual-level causal estimate, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 22.1 — Bui DS, Lodge CJ, Burgess JA, et al. Childhood predictors of lung function trajectories and future COPD risk: a prospective cohort study from the first to the sixth decade of life. Lancet Respir Med. 2018;6(7):535-544. PMID 29628376. doi:10.1016/S2213-2600(18)30100-0.**

- URL: https://pubmed.ncbi.nlm.nih.gov/29628376/
- Source checked on: 2026-09-22
- Locator: PMID 29628376; TAHS trajectory-cohort results and interpretation
- Note under review: Tasmanian Longitudinal Health Study trajectory modeling (2,438 participants analyzed from 8,583) identifying childhood bronchitis and pneumonia among early-life predictors of the three low-lung-function trajectories carrying approximately 75 percent of COPD burden at age 53; observational trajectory association with explicit acknowledgment that modifiable early-life exposures interact with adult factors, not an individual causal estimate.
- Current state: `verified: false` — pending qualified-human decision

**Row 22.2 — Dey D, Bhattacharyya P, Roy D, et al. Does childhood TB or pneumonia impact COPD or asthma in adulthood? Int J Tuberc Lung Dis. 2025;29(8):349-354. PMID 40751209. doi:10.5588/ijtld.24.0570.**

- URL: https://pubmed.ncbi.nlm.nih.gov/40751209/
- Source checked on: 2026-09-22
- Locator: PMID 40751209; clinic-cohort results and conclusion
- Note under review: Referral-clinic cohort (803 COPD and 841 asthma patients among 4,345 recruited) reporting significantly declined FEV1, FVC, and FEF25-75 and more frequent chronic expectoration and recurrent lung infections among COPD patients with childhood pneumonia; conclusion frames childhood pneumonia as a risk-factor association with worse symptoms and lower spirometry, referral-sampled without population denominators.
- Current state: `verified: false` — pending qualified-human decision

**Row 22.3 — Marossy AE, Strachan DP, Rudnicka AR, Anderson HR. Childhood chest illness and the rate of decline of adult lung function between ages 35 and 45 years. Am J Respir Crit Care Med. 2007;175(4):355-359. PMID 17023728. doi:10.1164/rccm.200607-1023OC.**

- URL: https://pubmed.ncbi.nlm.nih.gov/17023728/
- Source checked on: 2026-09-22
- Locator: PMID 17023728; birth-cohort results and conclusions
- Note under review: British 1958 birth-cohort spirometry at 35 and 45 years finding no significant association between childhood pneumonia or chest illness and the rate of mid-adult FEV1 decline; recorded deliberately as the competing longitudinal evidence constraining this edge to association strength rather than a progressive post-infectious decline mechanism.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `broncho-alveolar-carcinoma` → `pleural-effusion` — ASSOCIATION_ONLY

**Proposition (associationBasis):** A radiology review of air-space disease lists bronchioloalveolar carcinoma among the CT-demonstrable causes of pneumonia-pattern consolidation with accompanying pleural effusion, and published case documentation of lepidic-predominant adenocarcinoma reports bilateral pleural effusion and hydropneumothorax with pleural fluid cytology and pleural biopsy positive for lepidic adenocarcinoma; no cohort study or pooled estimate quantifies pleural-effusion frequency for this histologic pattern.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the supporting evidence is a radiology review plus case reports, case series cannot provide incidence or risk estimates, effusion in cancer populations also arises from parapneumonic, paramalignant, treatment-related, and comorbid causes (heart failure, renal disease) that require individual exclusion, and the malignancy association would only be cytology-proven in a subset of cases, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 23.1 — Hommeyer SH, Godwin JD, Takasugi JE. Computed tomography of air-space disease. Radiol Clin North Am. 1991;29(5):1065-1084. PMID 1871256.**

- URL: https://pubmed.ncbi.nlm.nih.gov/1871256/
- Source checked on: 2026-09-22
- Locator: PMID 1871256; air-space disease review, BAC and pleural-effusion passages
- Note under review: Radiology review of CT findings in air-space disease listing bronchioloalveolar carcinoma among the pneumonia-pattern causes and noting that accompanying abnormalities such as pleural effusion are often clearly demonstrated by CT; establishes the imaging co-occurrence, not an etiologic estimate.
- Current state: `verified: false` — pending qualified-human decision

**Row 23.2 — Akhtar Z, Laageide L, Robles J, et al. Unusual presentation of lepidic adenocarcinoma in a healthy female. BMC Pulm Med. 2022;22(1):197. PMID 35578218. doi:10.1186/s12890-022-01969-1.**

- URL: https://pubmed.ncbi.nlm.nih.gov/35578218/
- Source checked on: 2026-09-22
- Locator: PMID 35578218; case presentation and conclusion
- Note under review: Case report of lepidic-predominant adenocarcinoma with diffuse pneumonic-type bilateral aerogenous disease, right hydropneumothorax and left pleural effusion, with pleural fluid cytology and pleural biopsy positive for lepidic adenocarcinoma; demonstrates the malignant-effusion pathway is biologically real in individual cases while explicitly acknowledging its rarity and the absence of cohort-level frequency data.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `bundle-branch-block` → `implantable-cardiac-pacemaker` — ASSOCIATION_ONLY

**Proposition (associationBasis):** A long-follow-up matched-cohort study within the Adult Health Study of atomic-bomb survivors detected 520 subjects with newly acquired complete right bundle branch block and no organic heart disease and matched them 1:2 to comparators without block; over follow-up extending to 2010, right bundle branch block carried a hazard ratio of 4.79 (95 percent CI 1.89-12.58) for pacemaker implantation for any cause, 3.77 (95 percent CI 1.09-13.07) when implanted for high-degree atrioventricular block, and 6.28 (95 percent CI 1.24-31.73) when implanted for sick sinus syndrome, with coexisting axis deviation roughly tripling the all-cause hazard; procedure-associated conduction injury cohorts (new left bundle branch block after transcatheter aortic valve implantation, with about 24 percent progressing to implantation) document the same progression phenomenon under iatrogenic conditions.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the cohort cannot distinguish the block as driver from the block as early marker of a shared degenerative conduction-system process, progression latency and individual trajectory are highly variable, implantation decisions are guideline- and clinician-dependent outcomes rather than pure disease endpoints, and competing drivers (ischemic disease, infiltrative disease, drug effects, hyperkalemia, thyroid dysfunction) require individual exclusion, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 24.1 — Kusumoto S, Kawano H, Makita N, et al. Right bundle branch block without overt heart disease predicts higher risk of pacemaker implantation: the study of atomic-bomb survivors. Int J Cardiol. 2014;174(1):77-82. PMID 24745858. doi:10.1016/j.ijcard.2014.03.152.**

- URL: https://pubmed.ncbi.nlm.nih.gov/24745858/
- Source checked on: 2026-09-22
- Locator: PMID 24745858; cohort results and conclusions
- Note under review: Matched cohort (520 newly acquired right bundle branch block subjects without organic heart disease versus 1,038 matched comparators) reporting pacemaker implantation hazards of 4.79 all-cause, 3.77 for atrioventricular block, and 6.28 for sick sinus syndrome, with axis deviation tripling risk; the abstract frames the finding as progression association and explicitly notes that progression mechanisms differ with and without axis deviation, supporting the association-strength framing.
- Current state: `verified: false` — pending qualified-human decision

**Row 24.2 — Nijenhuis VJ, Van Dijk VF, Chaldoupi SM, Balt JC, Ten Berg JM. Severe conduction defects requiring permanent pacemaker implantation in patients with a new-onset left bundle branch block after transcatheter aortic valve implantation. Europace. 2017;19(6):1015-1021. PMID 28340150. doi:10.1093/europace/euw174.**

- URL: https://pubmed.ncbi.nlm.nih.gov/28340150/
- Source checked on: 2026-09-22
- Locator: PMID 28340150; post-TAVI cohort methods and results
- Note under review: Retrospective post-TAVI cohort (155 patients with new-onset left bundle branch block) with 24 percent progressing to pacemaker implantation, mainly for total atrioventricular block; recorded deliberately as the procedure-associated contrast class that is excluded from this edge's scope, since the block there is iatrogenic rather than the spontaneous natural history this identity's edge documents.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `burning-mouth-syndrome` → `depressive-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** A nationwide propensity-matched cohort (1:4 matching, survival analysis) reports an adjusted hazard ratio of 3.37 (95 percent CI 1.67-6.80) for incident burning mouth syndrome among patients with depression and 5.09 (95 percent CI 2.19-11.80) for anxiety, with female sex carrying higher risk, while dermatology and orofacial-pain reviews consistently list depression, anxiety, and cancerphobia among the most frequently associated conditions in BMS populations; the evidence base is explicitly bidirectional or reverse-directed, since the cohort measured mood disorders as the upstream exposure.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the strongest cohort evidence runs from depression to burning mouth syndrome (the reverse of this edge's direction), cross-sectional psychiatric comorbidity in pain populations cannot establish direction, chronic orofacial pain and mood disorders share neurotransmitter and stress-axis pathways that could produce the association in either direction, and a depressive disorder can only be attributed as a consequence of the pain after excluding preexisting mood disorder and the sensory, endocrine, nutritional, and medication causes that the BMS diagnostic algorithm itself requires ruling out, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 25.1 — Lee SJ, Kim C, Yu H, Kim DK. Relationship of Depression, Anxiety, and Bipolar Disease with Burning Mouth Syndrome: A Nationwide Cohort Study. Int J Environ Res Public Health. 2023;20(4):3391. PMID 36834086. doi:10.3390/ijerph20043391.**

- URL: https://pubmed.ncbi.nlm.nih.gov/36834086/
- Source checked on: 2026-09-22
- Locator: PMID 36834086; cohort results and conclusion
- Note under review: Nationwide 1:4 propensity-matched cohort reporting adjusted hazard ratios of 3.37 (depression) and 5.09 (anxiety) for incident burning mouth syndrome, with bipolar disorder showing no significant risk; the abstract frames mood disorders as the upstream exposure, which is why this edge records the direction as reverse-dominant and stays at association strength.
- Current state: `verified: false` — pending qualified-human decision

**Row 25.2 — Drage LA, Rogers RS 3rd. Burning mouth syndrome. Dermatol Clin. 2003;21(1):135-145. PMID 12622276. doi:10.1016/s0733-8635(02)00063-3.**

- URL: https://pubmed.ncbi.nlm.nih.gov/12622276/
- Source checked on: 2026-09-22
- Locator: PMID 12622276; review associated-conditions and evaluation passages
- Note under review: Clinical review listing depression, anxiety, and cancerphobia as the most frequently associated conditions in burning mouth syndrome populations while warning that psychiatric causes should not be invoked without thorough evaluation and that multiple contributing factors are common; anchors the comorbidity proposition and the exclusion discipline the diagnostic algorithm requires.
- Current state: `verified: false` — pending qualified-human decision

**Row 25.3 — Canfora F, Calabria E, Armogida NG, et al. Burning mouth syndrome: updates on pathogenesis and diagnostic algorithms. J Oral Facial Pain Headache. 2025;39(4):1-30. PMID 41436103. doi:10.22514/jofph.2025.064.**

- URL: https://pubmed.ncbi.nlm.nih.gov/41436103/
- Source checked on: 2026-09-22
- Locator: PMID 41436103; pathogenesis and diagnostic-algorithm sections
- Note under review: Contemporary pathogenesis and diagnostic-algorithm review characterizing burning mouth syndrome as a chronic neuropathic orofacial pain disorder requiring exclusion of oral infections, nutritional deficiencies, hormonal imbalances, autoimmune disorders, and medication side effects, with psychological-profile assessment part of the diagnostic workup; anchors the mechanism framing and the competing-cause exclusions this edge's evidence gaps require.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `cannabinoid-hyperemesis-syndrome` → `esophagitis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** Case-report literature documents esophageal injury in the course of cannabinoid hyperemesis syndrome: a pregnant patient with syndrome-typical intractable emesis developed Mallory-Weiss esophageal tears during repeated admissions (Alaniz 2015), and an endoscopic workup in a syndrome case recorded mild reflux esophagitis before the syndrome diagnosis was reached (Aziz 2020); a pediatric case of syndrome-driven pneumomediastinum raised occult esophageal perforation as a managed concern (Klazura 2022).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: every identified record is a single case or a case series without denominators, esophagitis in these patients has competing explanations (gastroesophageal reflux, infection, medication use, alcohol, pregnancy-associated reflux), and no study reports esophagitis prevalence among unselected cannabinoid hyperemesis cohorts, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 26.1 — Alaniz VI, Liss J, Metz TD, Stickrath E. Cannabinoid hyperemesis syndrome: a cause of refractory nausea and vomiting in pregnancy. Obstet Gynecol. 2015;125(6):1484-1486. PMID 25774930. doi:10.1097/AOG.0000000000000595.**

- URL: https://pubmed.ncbi.nlm.nih.gov/25774930/
- Source checked on: 2026-09-22
- Locator: PMID 25774930; case report and conclusion
- Note under review: Case report of a pregnant patient with syndrome-typical intractable emesis and compulsive bathing who sustained Mallory-Weiss esophageal tears during repeated admissions; supports co-occurrence of esophageal injury with syndrome episodes at case level only, without prevalence or denominator data.
- Current state: `verified: false` — pending qualified-human decision

**Row 26.2 — Aziz A, Waheed T, Oladunjoye O, Oladunjoye A, Hanif M, Latif F. Topical capsaicin for treating cannabinoid hyperemesis syndrome. Case Rep Gastrointest Med. 2020;2020:8868385. PMID 33294233. doi:10.1155/2020/8868385.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33294233/
- Source checked on: 2026-09-22
- Locator: PMID 33294233; case presentation endoscopy findings
- Note under review: Case report in which endoscopic evaluation during a cannabinoid hyperemesis workup recorded mild reflux esophagitis at initial presentation, with a negative repeat examination after symptom control; documents esophagitis co-occurrence at case level and illustrates the confounding role of independent reflux disease.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `capgras-syndrome` → `depressive-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** A cross-sectional re-analysis of the CATIE-AD cohort (421 patients with Alzheimer's disease) found Neuropsychiatric Inventory depression scores were higher among patients exhibiting Capgras syndrome than among those without it, and that Capgras syndrome was associated with the presence of depression in the severer global cognitive impairment stratum (Nagata 2024); pediatric case series document co-occurring depressive presentations in children with Capgras syndrome (Walfisch 2025).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the cross-sectional design cannot order onset, the entire quantitative evidence is internal to an Alzheimer's disease population and may not generalize to other Capgras contexts, depression in psychotic disorders has multifactorial determinants (shared neurobiology, psychosocial disability, institutional and medication effects), and no longitudinal cohort measures incident depressive disorder after Capgras onset, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 27.1 — Nagata T, Nakajima S, Kito S, Shinagawa S. The association between distinct delusional ideations and depressive symptoms in Alzheimer's disease: a re-analysis of CATIE-AD. J Alzheimers Dis. 2024;101(2):661-670. PMID 39213078. doi:10.3233/JAD-240702.**

- URL: https://pubmed.ncbi.nlm.nih.gov/39213078/
- Source checked on: 2026-09-22
- Locator: PMID 39213078; cross-sectional results and conclusions
- Note under review: Cross-sectional re-analysis of 421 CATIE-AD patients reporting higher Neuropsychiatric Inventory depression scores with Capgras syndrome and an association between Capgras and depression presence in the severer cognitive-impairment stratum; supports co-occurrence within a dementia population without onset ordering.
- Current state: `verified: false` — pending qualified-human decision

**Row 27.2 — Walfisch R, Perlman Danieli P, Mosheva M, Eldar E, David V, Hochberg Y, Shilton T, Gothelf D. Co-existence of Capgras syndrome and OCD in children: case studies. Clin Child Psychol Psychiatry. 2025;30(3):800-808. PMID 40262183. doi:10.1177/13591045251329972.**

- URL: https://pubmed.ncbi.nlm.nih.gov/40262183/
- Source checked on: 2026-09-22
- Locator: PMID 40262183; case presentations
- Note under review: Pediatric case series describing depressive presentations co-occurring with Capgras syndrome (alongside obsessive-compulsive and catatonic features); corroborates case-level co-occurrence outside dementia populations but contributes no denominators or onset ordering.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `carcinoid-syndrome` → `malnutrition-residuals` — ASSOCIATION_ONLY

**Proposition (associationBasis):** In the TELESTAR randomized-trial population (metastatic neuroendocrine tumors with uncontrolled carcinoid syndrome), weight loss is described as associated with uncontrolled carcinoid syndrome and possibly with reduced survival, and biochemical nutritional markers (albumin, cholesterol) moved with weight change (Weickert 2018); pooled open-label extension data report that diarrhea- and flushing-driven weight loss accompanies the syndrome and that 68.7 percent of patients maintained or gained weight once syndrome control improved over 48 weeks (Srirajaskanthan 2021); surgical series of mid-gut carcinoid document severe malnutrition as a presenting feature of syndrome-bearing patients with mesenteric disease, and cachexia from mesentericointestinal entrapment accounted for 35 percent of deaths (Makridis 1990, 1997).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the trial analyses measure weight response to syndrome-directed therapy rather than attributing malnutrition etiologically to the syndrome, surgical-series malnutrition is inseparable from mesenteric fibrosis, obstruction, and metastatic burden, and protein-losing enteropathy, anorexia of chronic disease, and treatment effects are active competing drivers, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 28.1 — Weickert MO, Kaltsas G, Hörsch D, Lapuerta P, Pavel M, Valle JW, Caplin ME, Bergsland E, Kunz PL, Anthony LB, Grande E, Öberg K, Welin S, Lombard-Bohas C, Ramage JK, Kittur A, Yang QM, Kulke MH. Changes in weight associated with telotristat ethyl in the treatment of carcinoid syndrome. Clin Ther. 2018;40(6):952-962.e2. PMID 29724499. doi:10.1016/j.clinthera.2018.04.006.**

- URL: https://pubmed.ncbi.nlm.nih.gov/29724499/
- Source checked on: 2026-09-22
- Locator: PMID 29724499; purpose, findings, implications
- Note under review: TELESTAR analysis (135 patients with uncontrolled carcinoid syndrome) reporting that weight loss is associated with uncontrolled syndrome and possibly reduced survival, with weight gain under syndrome-directed therapy accompanied by albumin and cholesterol rises; supports the syndrome-nutrition co-occurrence as a treatment-response observation, not an etiologic attribution.
- Current state: `verified: false` — pending qualified-human decision

**Row 28.2 — Srirajaskanthan R, Pavel M, Kulke M, Clement D, Houchard A, Keeber L, Weickert MO. Weight maintenance up to 48 weeks in patients with carcinoid syndrome treated with telotristat ethyl: pooled data from the open-label extensions of the phase III clinical trials TELESTAR and TELECAST. Clin Ther. 2021;43(10):1779-1785. PMID 34598813. doi:10.1016/j.clinthera.2021.08.014.**

- URL: https://pubmed.ncbi.nlm.nih.gov/34598813/
- Source checked on: 2026-09-22
- Locator: PMID 34598813; background and results
- Note under review: Pooled open-label extension (48 weeks) reporting syndrome diarrhea and flushing as drivers of weight loss with 68.7 percent of patients maintaining or gaining weight under therapy; documents the population-level weight-loss burden of uncontrolled syndrome at observational strength.
- Current state: `verified: false` — pending qualified-human decision

**Row 28.3 — Makridis C, Ekbom A, Bring J, Rastad J, Juhlin C, Oberg K, Akerström G. Survival and daily physical activity in patients treated for advanced midgut carcinoid tumors. Surgery. 1997;122(6):1075-1082. PMID 9426422. doi:10.1016/s0039-6060(97)90211-7.**

- URL: https://pubmed.ncbi.nlm.nih.gov/9426422/
- Source checked on: 2026-09-22
- Locator: PMID 9426422; results and conclusions
- Note under review: Surgical series (121 patients) reporting substantial weight loss as a survival-reducing factor and malnutrition as a physical-activity impairment, while attributing 35 percent of deaths to cachexia from mesentericointestinal entrapment; supports co-occurrence and simultaneously documents the tumor-burden confounder recorded as an alternative etiology.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `cellulitis` → `osteomyelitis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** Case reports document osteomyelitis arising by contiguous spread from secondarily infected skin disease overlying the affected bone (Masuka 2020, phalangeal and tibial osteomyelitis complicating infected atopic eczema), and radiologic-anatomic studies in pedal infection localize confirmed osteomyelitis immediately deep to a focus of overlying skin disruption, cellulitis, abscess, or sinus tract (Toledano 2011, Ledermann 2002).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the identified records are case reports and imaging-anatomic descriptions without incidence denominators, in pedal populations the cellulitis-osteomyelitis pairing usually reflects a shared deep infection rather than superficial-to-bone progression, and hematogenous osteomyelitis, penetrating injury, surgery, and vascular insufficiency are active competing drivers, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 29.1 — Masuka JT, Troisi K, Mkhize Z. Osteomyelitis complicating secondarily infected atopic eczema: two case reports and a narrative literature review. BMC Dermatol. 2020;20(1):2. PMID 32008574. doi:10.1186/s12895-019-0098-0.**

- URL: https://pubmed.ncbi.nlm.nih.gov/32008574/
- Source checked on: 2026-09-22
- Locator: PMID 32008574; case presentation and conclusions
- Note under review: Two case reports of osteomyelitis arising by contiguous spread from secondarily infected skin overlying the affected bone (phalangeal, tibial), with a narrative review of osteo-articular complications of infected skin disease; supports the contiguity pathway at case level only.
- Current state: `verified: false` — pending qualified-human decision

**Row 29.2 — Toledano TR, Fatone EA, Weis A, Cotten A, Beltran J. MRI evaluation of bone marrow changes in the diabetic foot: a practical approach. Semin Musculoskelet Radiol. 2011;15(3):257-268. PMID 21644199. doi:10.1055/s-0031-1278425.**

- URL: https://pubmed.ncbi.nlm.nih.gov/21644199/
- Source checked on: 2026-09-22
- Locator: PMID 21644199; imaging-approach discussion
- Note under review: Radiologic review describing confirmed osteomyelitis localized adjacent to a skin ulcer, cellulitis, abscess, or sinus tract in the diabetic foot, while explicitly distinguishing the shared deep-infection presentation from true progression; supports the anatomic pairing and simultaneously documents the confounding recorded in the causation boundary.
- Current state: `verified: false` — pending qualified-human decision

**Row 29.3 — Ledermann HP, Morrison WB, Schweitzer ME, Raikin SM. Tendon involvement in pedal infection: MR analysis of frequency, distribution, and spread of infection. AJR Am J Roentgenol. 2002;179(4):939-947. PMID 12239042. doi:10.2214/ajr.179.4.1790939.**

- URL: https://pubmed.ncbi.nlm.nih.gov/12239042/
- Source checked on: 2026-09-22
- Locator: PMID 12239042; methods and results
- Note under review: Contrast-MR cohort (159 infected feet) defining peritendinous enhancement contiguous to an adjacent ulcer or cellulitis and documenting deep soft-tissue involvement in roughly half of surgical pedal infections; supports the contiguity anatomy at population-prevalence level without incidence-of-progression data.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `central-cord-syndrome` → `urinary-incontinence` — ASSOCIATION_ONLY

**Proposition (associationBasis):** A video-urodynamic cohort of 22 men with central cord syndrome from the Houston VA spinal cord registry found vesicourethral dysfunction in 19 of 22, with external detrusor-sphincter dyssynergia in 11, detrusor areflexia in 4, detrusor hyperreflexia in 1, and hypocontractility in 1, plus recurrent urinary tract infection in dyssynergia patients (Smith 2000); spinal-cord disease literature generally documents the overactive-bladder with retained-residual pattern reflecting descending and ascending pathway lesions (Sakakibara 2019).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the urodynamic series is small, uncontrolled, and cross-sectional with evaluation delayed years after injury, dysfunction subtypes are heterogeneous within the syndrome, age and prostatic obstruction independently produce the same symptoms, and no study reports population incidence of neurogenic bladder after central cord syndrome, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 30.1 — Smith CP, Kraus SR, Nickell KG, Boone TB. Video urodynamic findings in men with the central cord syndrome. J Urol. 2000;164(6):2014-2017. PMID 11061905.**

- URL: https://pubmed.ncbi.nlm.nih.gov/11061905/
- Source checked on: 2026-09-22
- Locator: PMID 11061905; results and conclusions
- Note under review: Video-urodynamic cohort (22 men, Houston VA spinal cord registry, mean 34.5 months post-injury) reporting vesicourethral dysfunction in 19 of 22 with external detrusor-sphincter dyssynergia most common (11), plus areflexia, hyperreflexia, and hypocontractility subtypes; supports co-occurrence at series level without control or incidence data.
- Current state: `verified: false` — pending qualified-human decision

**Row 30.2 — Sakakibara R. Neurogenic lower urinary tract dysfunction in multiple sclerosis, neuromyelitis optica, and related disorders. Clin Auton Res. 2019;29(3):313-320. PMID 30076494. doi:10.1007/s10286-018-0551-x.**

- URL: https://pubmed.ncbi.nlm.nih.gov/30076494/
- Source checked on: 2026-09-22
- Locator: PMID 30076494; results and conclusions
- Note under review: Systematic review of spinal cord immune-mediated disease documenting that bladder dysfunction reflects lesions in spinal descending and ascending pathways with an overactive-bladder plus retention pattern; supports the pathway-level mechanism by analogy across spinal cord disease without central-cord-syndrome-specific denominators.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `cerebral-contusion` → `seizure-disorder` — DIRECT_CAUSATION

**Proposition (direct_causation):** Cerebral contusion → cortical tissue disruption, hemosiderin deposition, and glial scarring in contused (most commonly frontal and temporal) cortex → pathologic neuronal hyperexcitability and electroclinically characterized post-traumatic seizures; late seizures after a documented contusion are a direct symptomatic manifestation of the structural brain injury rather than a co-occurring condition, with chronology and imaging-documented contusion required in every case.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 31.1 — Xu T, Yu X, Ou S, Liu X, Yuan J, Huang H, Yang J, He L, Chen Y. Risk factors for posttraumatic epilepsy: a systematic review and meta-analysis. Epilepsy Behav. 2017;67:1-6. PMID 28076834. doi:10.1016/j.yebeh.2016.10.026.**

- URL: https://pubmed.ncbi.nlm.nih.gov/28076834/
- Source checked on: 2026-09-22
- Locator: PMID 28076834; results and conclusion
- Note under review: Systematic review and meta-analysis of PTE risk factors reporting brain contusion as a strong risk factor (RR 2.35, 95% CI 1.69-3.28) among TBI-related neuroimaging findings, with elevated risk sustained beyond ten years; supports the direct lesion-seizure pathway at the highest evidence tier available for this edge.
- Current state: `verified: false` — pending qualified-human decision

**Row 31.2 — Wang H, Xin T, Sun X, Wang S, Guo H, Holton-Burke C, Pang Q. Post-traumatic seizures—a prospective, multicenter, large case study after head injury in China. Epilepsy Res. 2013;107(3):272-278. PMID 24239245. doi:10.1016/j.eplepsyres.2013.10.006.**

- URL: https://pubmed.ncbi.nlm.nih.gov/24239245/
- Source checked on: 2026-09-22
- Locator: PMID 24239245; results and conclusion
- Note under review: Prospective multicenter cohort (3,093 TBI patients, two-year follow-up) identifying frontal-temporal lobar contusion among three independent multivariate predictors of post-traumatic seizures, with a cumulative 24-month seizure rate of 9.8% establishing population incidence; independently corroborates the meta-analytic finding.
- Current state: `verified: false` — pending qualified-human decision

**Row 31.3 — Lutkenhoff ES, Shrestha V, Ruiz Tejeda J, Real C, McArthur DL, Duncan D, La Rocca M, Garner R, Toga AW, Vespa PM, Monti MM. Early brain biomarkers of post-traumatic seizures: initial report of the multicentre epilepsy bioinformatics study for antiepileptogenic therapy (EpiBioS4Rx) prospective study. J Neurol Neurosurg Psychiatry. 2020;91(11):1154-1157. PMID 32848013. doi:10.1136/jnnp-2020-322780.**

- URL: https://pubmed.ncbi.nlm.nih.gov/32848013/
- Source checked on: 2026-09-22
- Locator: PMID 32848013; results and conclusions
- Note under review: Multicenter prospective cohort (96 moderate-to-severe TBI patients) associating focal cortical volume deficits, including hippocampal and temporal-cortex thinning, with early and late post-traumatic seizures; supports the lesion-burden gradient underlying the pathway, at biomarker-association strength.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `cerebrovascular-accident-stroke-residuals` → `depressive-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** Meta-analytic and pooled cohort data establish post-stroke depression as a high-prevalence, prognostically consequential comorbidity of stroke populations: 25-50 percent prevalence in recent pooled cohorts (Liu 2026, seven cohorts n=10,643), pooled all-cause mortality hazard of 1.59 with PSD in 15 cohorts of 250,294 participants (Cai 2019), and inflammatory and metabolic markers (Hs-CRP SMD 0.16, homocysteine SMD 0.14, acute hyperglycemia) elevated in PSD patients across pooled prospective studies (Jaiswal 2023, Wang 2022).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the primary is the residuals identity while the quantitative literature defines incidence within stroke populations generally, pre-stroke depression raises the odds of post-stroke depression roughly threefold (pooled OR 3.0) and is a documented dominant confounder, lesion location predicts depression inconsistently across studies, and disability, medication, and psychosocial-loss pathways are each independently sufficient, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 32.1 — Liu L, Zhang G, He Y, Zhang H. Post-stroke depression and its impact on mortality and functional outcomes: a systematic review and meta-analysis. NeuroRehabilitation. 2026;59(1):48-62. PMID 42506930. doi:10.1177/10538135261462562.**

- URL: https://pubmed.ncbi.nlm.nih.gov/42506930/
- Source checked on: 2026-09-22
- Locator: PMID 42506930; background, results, conclusions
- Note under review: Pooled cohort analysis (seven cohorts, n=10,643) reporting 25-50 percent post-stroke depression prevalence with 3.5-fold disability odds independent of stroke severity; establishes population-level comorbidity burden without attributing depression causally to residual deficit.
- Current state: `verified: false` — pending qualified-human decision

**Row 32.2 — Cai W, Mueller C, Li YJ, Shen WD, Stewart R. Post stroke depression and risk of stroke recurrence and mortality: a systematic review and meta-analysis. Ageing Res Rev. 2019;50:102-109. PMID 30711712. doi:10.1016/j.arr.2019.01.013.**

- URL: https://pubmed.ncbi.nlm.nih.gov/30711712/
- Source checked on: 2026-09-22
- Locator: PMID 30711712; results and conclusion
- Note under review: Meta-analysis of 15 prospective cohorts (250,294 participants) reporting pooled all-cause mortality hazard of 1.59 (95% CI 1.30-1.96) with post-stroke depression; documents the prognostic weight of the comorbidity at population scale, at observational strength.
- Current state: `verified: false` — pending qualified-human decision

**Row 32.3 — Taylor-Rowan M, Momoh O, Ayerbe L, Evans JJ, Stott DJ, Quinn TJ. Prevalence of pre-stroke depression and its association with post-stroke depression: a systematic review and meta-analysis. Psychol Med. 2019;49(4):685-696. PMID 30107864. doi:10.1017/S0033291718002003.**

- URL: https://pubmed.ncbi.nlm.nih.gov/30107864/
- Source checked on: 2026-09-22
- Locator: PMID 30107864; results and conclusions
- Note under review: Meta-analysis (29 studies, n=164,993) reporting pre-stroke depression prevalence of 11.6 percent and a pooled odds ratio of 3.0 (95% CI 2.3-4.0) for post-stroke depression; deliberately entered as the documented competing-evidence anchor for the confounder recorded in the causation boundary.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `cervical-strain` → `post-traumatic-headache` — ASSOCIATION_ONLY

**Proposition (associationBasis):** Symptomatic-cohort data document headache among the most frequent presenting complaints after whiplash injury, with unprepared occupants showing more severe headache and rotated or inclined head position associated with more severe cervical-strain and radicular findings (Sturzenegger 1994, 137 consecutive patients, examined within days of trauma); however, the only controlled natural-history cohort found chronic headache at similar rates in collision victims and matched uninjured controls (9.4 versus 5.9 percent, not significant; Schrader 1996), leaving the association contested rather than established.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the controlled cohort shows no victim-control difference in chronic headache, concurrent mild head injury is difficult to exclude in the same accidents, cervicogenic headache is operationally hard to distinguish from post-traumatic headache of intracranial origin, and litigation and expectation effects are documented determinants in this literature, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 33.1 — Sturzenegger M, DiStefano G, Radanov BP, Schnidrig A. Presenting symptoms and signs after whiplash injury: the influence of accident mechanisms. Neurology. 1994;44(4):688-693. PMID 8164827. doi:10.1212/wnl.44.4.688.**

- URL: https://pubmed.ncbi.nlm.nih.gov/8164827/
- Source checked on: 2026-09-22
- Locator: PMID 8164827; results and conclusion
- Note under review: Cohort of 137 consecutive whiplash patients examined within days of trauma reporting headache among the most frequent presenting symptoms, with unprepared occupants showing more severe headache and head posture modulating musculoligamentous and radicular severity; supports early symptomatic co-occurrence and biomechanical modulation without chronic-outcome attribution.
- Current state: `verified: false` — pending qualified-human decision

**Row 33.2 — Schrader H, Obelieniene D, Bovim G, Surkiene D, Mickeviciene D, Miseviciene I, Sand T. Natural evolution of late whiplash syndrome outside the medicolegal context. Lancet. 1996;347(9010):1207-1211. PMID 8622449. doi:10.1016/s0140-6736(96)90733-3.**

- URL: https://pubmed.ncbi.nlm.nih.gov/8622449/
- Source checked on: 2026-09-22
- Locator: PMID 8622449; findings and interpretation
- Note under review: Controlled retrospective cohort (202 collision victims versus matched uninjured controls, outside medicolegal context) finding chronic headache in 9.4 versus 5.9 percent (not significant) and daily headache often predating the accident; deliberately entered as the competing-evidence anchor recorded in the causation boundary.
- Current state: `verified: false` — pending qualified-human decision

**Row 33.3 — Gross A, Forget M, St George K, Fraser MM, Graham N, Perry L, Burnie SJ, Goldsmith CH, Haines T, Brunarski D. Patient education for neck pain. Cochrane Database Syst Rev. 2012;(3):CD005106. PMID 22419306. doi:10.1002/14651858.CD005106.pub4.**

- URL: https://pubmed.ncbi.nlm.nih.gov/22419306/
- Source checked on: 2026-09-22
- Locator: PMID 22419306; background and main results
- Note under review: Cochrane review framing the whiplash and mechanical neck-pain population including cervicogenic headache and documenting the modest, time-limited benefit of structured education interventions on acute whiplash-related pain; supports the population framing without outcome-attribution strength.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `aortic-aneurysm` → `valvular-heart-disease` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The definitive bicuspid-aortic-valve review documents that the most frequent associated finding is dilatation of the proximal ascending aorta secondary to aortic-media abnormalities, that media changes are present whether the valve is normal, stenotic, or incompetent, and that complications include aortic regurgitation, aneurysm formation, and dissection (Siu 2010); the 2022 guideline update confirms that BAV aortopathy can develop independent of valvular alterations and can lead to aneurysm or dissection (Verma 2022).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the evidence describes co-expression of aneurysm and valvular disease within bicuspid aortopathy (a shared-cause structure, not a causal chain), most aortic aneurysms are degenerative without valvular involvement, chronic regurgitation can itself cause root dilation (reverse arrow), and the literature is review/guideline class without population transition rates, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 34.1 — Siu SC, Silversides CK. Bicuspid aortic valve disease. J Am Coll Cardiol. 2010;55(25):2789-2800. PMID 20579534. doi:10.1016/j.jacc.2009.12.068.**

- URL: https://pubmed.ncbi.nlm.nih.gov/20579534/
- Source checked on: 2026-09-22
- Locator: PMID 20579534; results and conclusions
- Note under review: Definitive review documenting proximal ascending dilatation from aortic-media abnormalities as the most frequent BAV association, media changes independent of valve function, and regurgitation/aneurysm/dissection among complications; the central shared-media evidence.
- Current state: `verified: false` — pending qualified-human decision

**Row 34.2 — Verma R, Cohen G, Colbert J, Fedak PWM. Bicuspid aortic valve associated aortopathy: 2022 guideline update. Curr Opin Cardiol. 2023;38(2):61-67. PMID 36718616. doi:10.1097/HCO.0000000000001020.**

- URL: https://pubmed.ncbi.nlm.nih.gov/36718616/
- Source checked on: 2026-09-22
- Locator: PMID 36718616; results and conclusions
- Note under review: ACC/AHA-aligned update confirming BAV aortopathy develops independent of valvular alterations and can lead to aneurysm, dissection, or rupture; supports the shared-media rather than causal reading.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `aortic-aneurysm` → `hydronephrosis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** A review of 348 abdominal aortic aneurysms identified 15 inflammatory aneurysms, with unilateral ureteral obstruction in 4 patients and bilateral in 1, and documented that hydronephrosis due to ureteral obstruction could disappear or decrease after repair (Siebenmann 1988); a case report of non-inflammatory aortoiliac aneurysm with ureteral obstruction cites ureteral obstruction in 20% to 71% of inflammatory aneurysm cases (Babic 2012); a case report of abdominal aortic aneurysm causing duodenal and ureteric obstruction notes that as many as 71% of patients may show radiologic ureteric involvement and that obstruction runs through inflammatory perianeurysmal fibrosis encasement rather than simple compression (Hodgson 1986).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the evidence is case reports and surgical-series reviews without population denominators, the frequently cited 71% figure reflects radiologic ureteric involvement in selected surgical cohorts rather than hydronephrosis incidence, and the intermediate fibrosis mechanism means the aneurysm is one of several retroperitoneal processes that can entrap the ureter, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 35.1 — Siebenmann R, Schneider K, von Segesser L, Turina M. [Inflammatory abdominal aortic aneurysm]. Schweiz Med Wochenschr. 1988;118(23):881-888. PMID 3393898.**

- URL: https://pubmed.ncbi.nlm.nih.gov/3393898/
- Source checked on: 2026-09-22
- Locator: PMID 3393898; case series and post-repair outcomes
- Note under review: 348-case review identifying 15 inflammatory aneurysms with ureteral obstruction in 5 patients and post-repair regression of hydronephrosis; the central series evidence with the reversible-mechanism observation.
- Current state: `verified: false` — pending qualified-human decision

**Row 35.2 — Babic S, Radak D, Matic P, Kovacevic V, Jocic D. [Non-inflammatory aortoiliac aneurysm with ureteral obstruction and consequent hydronephrosis: case report]. Srp Arh Celok Lek. 2012;140(1-2):91-93. PMID 22462354. doi:10.2298/sarh1202091b.**

- URL: https://pubmed.ncbi.nlm.nih.gov/22462354/
- Source checked on: 2026-09-22
- Locator: PMID 22462354; case report and cited prevalence range
- Note under review: Case report documenting that even non-inflammatory aneurysms can obstruct the ureter and citing ureteral obstruction in 20-71% of inflammatory cases; scope-context evidence.
- Current state: `verified: false` — pending qualified-human decision

**Row 35.3 — Hodgson KJ, Webster DJ. Abdominal aortic aneurysm causing duodenal and ureteric obstruction. J Vasc Surg. 1986;3(2):364-368. PMID 3511305. doi:10.1067/mva.1986.avs0030364.**

- URL: https://pubmed.ncbi.nlm.nih.gov/3511305/
- Source checked on: 2026-09-22
- Locator: PMID 3511305; case report and literature review
- Note under review: Documents that ureteric obstruction runs through perianeurysmal fibrosis encasement rather than simple compression and that up to 71% of surgical AAA patients show radiologic ureteric involvement; mechanism-nuance evidence.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `bronchomalacia` → `bronchiectasis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** A single-center case-control study (45 CT-confirmed bronchiectasis cases vs 90 disease controls, bronchoscopy videos reviewed blinded) found any tracheomalacia significantly associated with bronchiectasis (adjusted OR 13.2, 95% CI 3.2-55) and ERS-defined tracheomalacia further increasing that estimate (ORadj 24.4, 95% CI 3.4-infinity), with the authors explicitly concluding that causality cannot be inferred (Thomas 2022); the Ehlers-Danlos respiratory review documents tracheobronchomalacia as a structural manifestation and bronchiectasis as an inflammatory manifestation within the same syndrome population (Bascom 2021); the spirometry 'knee'-pattern study documents tracheomalacia in 65.4% of pattern-positive children, supporting case-finding context (Boonjindasup 2022).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the only controlled association comes from a pediatric single-center case-control design with age imbalance between groups, its authors explicitly disclaim causality, shared inflammatory and connective-tissue substrates can generate both conditions in parallel, and post-infectious causes dominate adult bronchiectasis, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 36.1 — Thomas R, Chang A, Masters IB, Grimwood K, Marchant J, Yerkovich S, Chatfield M, O'Brien C, Goyal V. Association of childhood tracheomalacia with bronchiectasis: a case-control study. Arch Dis Child. 2022;107(6):565-569. PMID 34649867. doi:10.1136/archdischild-2021-322578.**

- URL: https://pubmed.ncbi.nlm.nih.gov/34649867/
- Source checked on: 2026-09-22
- Locator: PMID 34649867; results and conclusions
- Note under review: The only controlled association study (ORadj 13.2, 95% CI 3.2-55; ERS-defined ORadj 24.4), explicitly concluding causality cannot be inferred; the central association evidence with its own limitation built in.
- Current state: `verified: false` — pending qualified-human decision

**Row 36.2 — Bascom R, Dhingra R, Francomano CA. Respiratory manifestations in the Ehlers-Danlos syndromes. Am J Med Genet C Semin Med Genet. 2021;187(4):533-548. PMID 34811894. doi:10.1002/ajmg.c.31953.**

- URL: https://pubmed.ncbi.nlm.nih.gov/34811894/
- Source checked on: 2026-09-22
- Locator: PMID 34811894; results and conclusions
- Note under review: Review documenting tracheobronchomalacia and bronchiectasis as parallel structural and inflammatory manifestations within one syndrome population; the shared-terrain confounder anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 36.3 — Boonjindasup W, Marchant JM, McElrea MS, Yerkovich ST, Thomas RJ, Masters IB, Chang AB. The 'knee' pattern in spirometry flow-volume curves in children: Does it relate to tracheomalacia? Respir Med. 2022;204:107029. PMID 36335911. doi:10.1016/j.rmed.2022.107029.**

- URL: https://pubmed.ncbi.nlm.nih.gov/36335911/
- Source checked on: 2026-09-22
- Locator: PMID 36335911; results and conclusions
- Note under review: Documents tracheomalacia in 65.4% of 'knee'-pattern children with lower spirometry values; case-finding and severity context.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `bullosis-diabeticorum` → `cellulitis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The systematic review of specific skin signs as cutaneous markers of diabetes found that association between bullous skin lesions and diabetes was documented only by case reports and case series (Bustan 2017); the bullosis diabeticorum case report describing conservative management notes that clinical recognition and conservative management to prevent secondary infection reduces morbidity (Mota 2013); the Haitian case report documented a bullosis diabeticorum presentation treated with antibiotics for signs of superinfection until resolution (Paul 2023).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the underlying diabetes-bullae literature is entirely case-report and series class without incidence denominators, the secondary-infection pathway is documented as management recognition and case practice rather than measured risk, and the shared diabetic-foot substrate (peripheral neuropathy, arterial insufficiency, autonomic skin fragility) is the dominant competing route to cellulitis, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 37.1 — Bustan RS, Wasim D, Yderstraede KB, Bygum A. Specific skin signs as a cutaneous marker of diabetes mellitus and the prediabetic state - a systematic review. Dan Med J. 2017;64(1):A5316. PMID 28007053.**

- URL: https://pubmed.ncbi.nlm.nih.gov/28007053/
- Source checked on: 2026-09-22
- Locator: PMID 28007053; results and conclusions
- Note under review: Systematic review documenting that the association between bullous skin lesions and diabetes rests exclusively on case reports and case series; the evidence-class anchor for the conservative tier.
- Current state: `verified: false` — pending qualified-human decision

**Row 37.2 — Mota AN, Nery NS, Barcaui CB. Case for diagnosis: bullosis diabeticorum. An Bras Dermatol. 2013;88(4):652-654. PMID 24068147. doi:10.1590/abd1806-4841.20132114.**

- URL: https://pubmed.ncbi.nlm.nih.gov/24068147/
- Source checked on: 2026-09-22
- Locator: PMID 24068147; results and conclusions
- Note under review: Case report stating that clinical recognition and conservative management to prevent secondary infection reduces morbidity in diabetic patients; the complication-prevention anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 37.3 — Paul AJ, Louis RS, Julien AAI, Florvil F, Blaise W. Bullosis diabeticorum in a morbidly obese woman in Haiti. Arch Clin Cases. 2023;10(4):196-199. PMID 38155997. doi:10.22551/2023.41.1004.10274.**

- URL: https://pubmed.ncbi.nlm.nih.gov/38155997/
- Source checked on: 2026-09-22
- Locator: PMID 38155997; results and conclusions
- Note under review: Case report documenting antibiotic treatment of superinfection signs in bullosis diabeticorum with resolution; practice-documented superinfection anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `corneal-scarring` → `visual-impairment` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The infectious-keratitis update states that corneal opacity is the fifth leading cause of blindness and visual impairment globally, affecting approximately six million people, with 1.5-2.0 million new cases of monocular blindness per year and infection, trauma, and inflammation among its etiologies (Ting 2021); the Global Burden of Disease vision-loss meta-analysis models corneal opacity as a distinct cause of blindness with regionally varying proportions (Flaxman 2017); the corneal-scarring nanomedicine review describes keratocyte-to-myofibroblast transformation and irregular extracellular-matrix synthesis as the prominent cause of opacity and hazy vision (Al-Mashahedah 2019).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the population statistics establish the global pathway but not the probability that a given scar causes functionally significant loss, the catalog target spans acuity and field impairment across many causes, and competing ocular disease is common in the same populations, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 38.1 — Ting DSJ, Ho CS, Deshmukh R, Said DG, Dua HS. Infectious keratitis: an update on epidemiology, causative microorganisms, risk factors, and antimicrobial resistance. Eye (Lond). 2021;35(4):1084-1101. PMID 33414529. doi:10.1038/s41433-020-01339-3.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33414529/
- Source checked on: 2026-09-22
- Locator: PMID 33414529; results and conclusions
- Note under review: States corneal opacity is the fifth leading cause of blindness and visual impairment globally affecting ~6 million people, with 1.5-2.0 million new monocular blindness cases yearly and trauma, inflammation, and infection among etiologies; the central burden anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 38.2 — Flaxman SR, Bourne RRA, Resnikoff S, et al. Global causes of blindness and distance vision impairment 1990-2020: a systematic review and meta-analysis. Lancet Glob Health. 2017;5(12):e1221-e1234. PMID 29032195. doi:10.1016/S2214-109X(17)30393-5.**

- URL: https://pubmed.ncbi.nlm.nih.gov/29032195/
- Source checked on: 2026-09-22
- Locator: PMID 29032195; results and conclusions
- Note under review: GBD Vision Loss Expert Group meta-analysis modelling corneal opacity as a distinct cause of blindness with regionally varying proportions; the population-architecture anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 38.3 — Ibrahim Al-Mashahedah AM, Kanwar RK, Kanwar JR. Utility of nanomedicine targeting scar-forming myofibroblasts to attenuate corneal scarring and haze. Nanomedicine (Lond). 2019;14(8):1049-1072. PMID 30901304. doi:10.2217/nnm-2017-0305.**

- URL: https://pubmed.ncbi.nlm.nih.gov/30901304/
- Source checked on: 2026-09-22
- Locator: PMID 30901304; results and conclusions
- Note under review: Describes keratocyte-to-myofibroblast transformation and disorganized extracellular-matrix deposition as the prominent mechanism of corneal opacity and hazy vision; the mechanism anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `cracked-tooth-syndrome` → `loss-of-teeth` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The National Dental Practice-Based Research Network Registry's 3-year multisite observational data document that few cracks fracture (3%) or progress (12%) in three years, with tooth survival exceeding 98% and about 80% of monitored teeth never crossing to treatment (Ferracane 2023); the treatment-outcomes meta-analysis of 26 studies found direct restorations without cuspal coverage increased the risk ratio of tooth extraction 8.1-fold versus full crowns, and root-canal-treated cracked teeth without crowns carried 11.3-fold higher extraction risk (Zhang 2024); the 5-year retrospective found cracks extending onto the pulpal floor independently increased the odds of extraction 11-fold (Sim 2016).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the natural-history cohorts show most cracks never cause loss, the large extraction-risk estimates come from treatment-stratified and referral-cohort designs, and the outcome depends decisively on restorative care that interrupts the pathway, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 39.1 — Ferracane JL, Hilton TJ, Funkhouser E; National Dental Practice-Based Research Network Collaborative Group. Lessons learned from the Cracked Tooth Registry: A 3-year clinical study in the Nation's Network. J Am Dent Assoc. 2023;154(3):235-244. PMID 36690539. doi:10.1016/j.adaj.2022.11.020.**

- URL: https://pubmed.ncbi.nlm.nih.gov/36690539/
- Source checked on: 2026-09-22
- Locator: PMID 36690539; results and conclusions
- Note under review: Multisite Registry synthesis: 3% fracture, 12% progression in three years, >98% survival, treatment characteristics and clinician decision-making; the natural-history anchor with its low progression rates built in.
- Current state: `verified: false` — pending qualified-human decision

**Row 39.2 — Zhang S, Xu Y, Ma Y, Zhao W, Jin X, Fu B. The treatment outcomes of cracked teeth: A systematic review and meta-analysis. J Dent. 2024;142:104843. PMID 38272437. doi:10.1016/j.jdent.2024.104843.**

- URL: https://pubmed.ncbi.nlm.nih.gov/38272437/
- Source checked on: 2026-09-22
- Locator: PMID 38272437; results and conclusions
- Note under review: Meta-analysis of 26 studies: extraction risk RR 8.1 without cuspal coverage in vital cracked teeth and 11.3-fold without crowns after root canal treatment; the treatment-stratified risk anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 39.3 — Sim IG, Lim TS, Krishnaswamy G, Chen NN. Decision Making for Retention of Endodontically Treated Posterior Cracked Teeth: A 5-year Follow-up Study. J Endod. 2016;42(2):225-229. PMID 26723485. doi:10.1016/j.joen.2015.11.011.**

- URL: https://pubmed.ncbi.nlm.nih.gov/26723485/
- Source checked on: 2026-09-22
- Locator: PMID 26723485; results and conclusions
- Note under review: Five-year retrospective: crack extension onto the pulpal floor independently increased extraction odds 11-fold; the depth-of-crack prognostic anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `cracked-tooth-syndrome` → `abscesses` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The cracked-teeth treatment meta-analysis documents pulpal complications as a quantified outcome of cracked-tooth management, with direct restorations without cuspal coverage raising pulpal-complication risk 3.2-fold versus full crowns (Zhang 2024); the practice-based Registry identifies biting pain and crack characteristics that guide intervention, reflecting the recognized symptom cascade from crack toward pulpal involvement (Ferracane 2023); the endodontic-outcomes literature documents bacterial persistence within the root-canal system as the established substrate of posttreatment apical periodontitis, the downstream infection state of this pathway (Siqueira 2008).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: no cohort reports abscess incidence in untreated cracked-tooth populations, pulpal involvement depends on crack depth and treatment that interrupts it, and periapical abscess in the same teeth can arise from caries-driven pulpitis or failed restorations without any crack, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 40.1 — Zhang S, Xu Y, Ma Y, Zhao W, Jin X, Fu B. The treatment outcomes of cracked teeth: A systematic review and meta-analysis. J Dent. 2024;142:104843. PMID 38272437. doi:10.1016/j.jdent.2024.104843.**

- URL: https://pubmed.ncbi.nlm.nih.gov/38272437/
- Source checked on: 2026-09-22
- Locator: PMID 38272437; results and conclusions
- Note under review: Meta-analysis documenting pulpal complications as a quantified cracked-tooth outcome (RR 3.2 without cuspal coverage); the pulpal-complication anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 40.2 — Ferracane JL, Hilton TJ, Funkhouser E; National Dental Practice-Based Research Network Collaborative Group. Lessons learned from the Cracked Tooth Registry: A 3-year clinical study in the Nation's Network. J Am Dent Assoc. 2023;154(3):235-244. PMID 36690539. doi:10.1016/j.adaj.2022.11.020.**

- URL: https://pubmed.ncbi.nlm.nih.gov/36690539/
- Source checked on: 2026-09-22
- Locator: PMID 36690539; results and conclusions
- Note under review: Registry synthesis identifying biting pain and crack characteristics guiding intervention; the symptom-cascade context anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 40.3 — Siqueira JF Jr, Rocas IN. Clinical implications and microbiology of bacterial persistence after treatment procedures. J Endod. 2008;34(11):1291-1301. PMID 18928835. doi:10.1016/j.joen.2008.07.028.**

- URL: https://pubmed.ncbi.nlm.nih.gov/18928835/
- Source checked on: 2026-09-22
- Locator: PMID 18928835; results and conclusions
- Note under review: Review establishing root-canal bacterial colonization and persistence as the substrate of apical periodontitis; the downstream-infection mechanism anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `cryptogenic-organizing-pneumonia` → `pulmonary-fibrosis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The pathologic-predictor case-control matched steroid-responsive against progressive idiopathic BOOP/COP: progressive cases showed scarring and remodeling of the background parenchyma in 89% versus 10% of good-prognosis cases, with the authors noting steroid-nonresponsive cases may cause irreversible injury or represent a BOOP/COP-like reaction in associated fibrosing pneumonia, especially UIP (Yousem 1997); the rapidly progressive series described a fulminant subset dying of or surviving with chronic severe fibrosis and marked impairment (Cohen 1994); the exacerbation review documents OP as one pole of the acute-injury spectrum that can accompany or presage fibrosing ILD (Kershaw 2021).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: more than 80% of COP responds to steroids with resolution, the fibrotic outcomes concentrate in a small progressive subset, and the decisive confound is that background scarring at diagnosis may reflect underlying UIP misclassified as COP, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 41.1 — Yousem SA, Lohr RH, Colby TV. Idiopathic bronchiolitis obliterans organizing pneumonia/cryptogenic organizing pneumonia with unfavorable outcome: pathologic predictors. Mod Pathol. 1997;10(9):864-871. PMID 9310948.**

- URL: https://pubmed.ncbi.nlm.nih.gov/9310948/
- Source checked on: 2026-09-22
- Locator: PMID 9310948; matched case-control pathology findings
- Note under review: Matched case-control: background scarring in 89% of progressive COP versus 10% of steroid-responsive cases, with the underlying-UIP confound stated by the authors; the central pathologic-predictor anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 41.2 — Cohen AJ, King TE Jr, Downey GP. Rapidly progressive bronchiolitis obliterans with organizing pneumonia. Am J Respir Crit Care Med. 1994;149(6):1670-1675. PMID 8004328. doi:10.1164/ajrccm.149.6.8004328.**

- URL: https://pubmed.ncbi.nlm.nih.gov/8004328/
- Source checked on: 2026-09-22
- Locator: PMID 8004328; case series outcomes and autopsy findings
- Note under review: Ten-patient series of fulminant BOOP: seven deaths and survivors with persistent dysfunction, autopsy fibrotic honeycombing in the fatal subset; the severe-outcome anchor with its rarity stated.
- Current state: `verified: false` — pending qualified-human decision

**Row 41.3 — Kershaw CD, Batra K, Torrealba J, Terada LS. Characteristics and evaluation of acute exacerbations in chronic interstitial lung diseases. Respir Med. 2021;183:106400. PMID 33957435. doi:10.1016/j.rmed.2021.106400.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33957435/
- Source checked on: 2026-09-22
- Locator: PMID 33957435; results and conclusions
- Note under review: Review situating organizing pneumonia within the acute-injury spectrum of fibrosing interstitial lung disease; the disease-spectrum context anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `cotard-s-syndrome` → `depressive-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The analysis of 100 historical and modern cases found depression reported in 89% of subjects, with exploratory factor analysis extracting psychotic-depression, Cotard type I (no depression loadings, closer to delusional disorders), and mixed type II factors, concluding the syndrome cuts across diagnostic categories (Berrios 1995); the systematic review of 69 reported cases from 2005-2018 found major depression significantly more frequent in older patients and extracted the same psychotic-depression factor leading the structure (Huarcaya-Victoria 2020); the case report and review situates Cotard's within psychotic depression with ECT as the most reported successful treatment and records associated organic conditions (Moschopoulos 2016).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the co-occurrence is better modeled as embedding of the syndrome within severe depressive episodes (or within non-affective psychosis and organic disease in other cases), the pure type I form shows no depression loadings, and reverse generation (depressive illness producing the syndrome) is the standard clinical reading, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 42.1 — Berrios GE, Luque R. Cotard's syndrome: analysis of 100 cases. Acta Psychiatr Scand. 1995;91(3):185-188. PMID 7625193. doi:10.1111/j.1600-0447.1995.tb09764.x.**

- URL: https://pubmed.ncbi.nlm.nih.gov/7625193/
- Source checked on: 2026-09-22
- Locator: PMID 7625193; results and conclusions
- Note under review: The largest case analysis: depression in 89%, three-factor structure separating psychotic depression from pure type I and mixed type II; the central cross-cutting-structure anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 42.2 — Huarcaya-Victoria J, Bojorquez-De la Torre J, De la Cruz-Ore J. Factor Structure of Cotard's Syndrome: Systematic Review of Case Reports. Rev Colomb Psiquiatr (Engl Ed). 2020;49(3):187-193. PMID 32888662. doi:10.1016/j.rcp.2018.10.008.**

- URL: https://pubmed.ncbi.nlm.nih.gov/32888662/
- Source checked on: 2026-09-22
- Locator: PMID 32888662; results and conclusions
- Note under review: Systematic review of 69 cases from 2005-2018 confirming major-depression predominance and the psychotic-depression factor; the modern-confirmation anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 42.3 — Moschopoulos NP, Kaprinis S, Nimatoudis J. [Cotard's syndrome: Case report and a brief review of literature]. Psychiatriki. 2016;27(4):296-302. PMID 28114093.**

- URL: https://pubmed.ncbi.nlm.nih.gov/28114093/
- Source checked on: 2026-09-22
- Locator: PMID 28114093; case report and literature review
- Note under review: Case report and review situating the syndrome within psychotic depression, recording associated organic conditions and ECT as the most reported successful treatment; the clinical-context anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `aphonia` → `depressive-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The All of Us cross-sectional analysis of 283,137 adults, whose exposure was the ICD-10 dysphonia code R49.0 encompassing aphonia, found 1.34 times the adjusted odds of depression (95% CI 1.27-1.41) in dysphonia after controlling for demographics, smoking, alcohol, and comorbidities (Weinstein 2026); a prospective voice-clinic cohort found 17% HADS caseness for anxiety and/or depression with strong emotional-VoiSS/HADS correlation, and noted organic laryngeal disorders carried more distress than functional dysphonia (Montgomery 2016); the retrospective voice-clinic cohort found 31.2% of voice-disorder patients with elevated depression scores, varying by diagnosis (Dietrich 2008).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: all three sources are cross-sectional or retrospective, depressive illness can itself alter voice use and care-seeking, the exposure code spans hoarseness to complete loss, and no longitudinal or treatment-discordant cohort separates disability effects from reverse causation, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 43.1 — Weinstein HNW, Denham MW, Tucker LH, Golub JS, Born HL. Dysphonia Is Associated With Anxiety and Depression in the All of Us Research Program. Laryngoscope. 2026;136(6):2648-2654. PMID 41555208. doi:10.1002/lary.70372.**

- URL: https://pubmed.ncbi.nlm.nih.gov/41555208/
- Source checked on: 2026-09-22
- Locator: PMID 41555208; results and conclusions
- Note under review: Cross-sectional All of Us analysis (n=283,137) with exposure ICD-10 R49.0 dysphonia: adjusted OR 1.34 (1.27-1.41) for depression; the population-scale anchor with its cross-sectional design and dysphonia-span exposure recorded.
- Current state: `verified: false` — pending qualified-human decision

**Row 43.2 — Montgomery J, Hendry J, Wilson JA, Deary IJ, MacKenzie K. Pragmatic detection of anxiety and depression in a prospective cohort of voice outpatient clinic attenders. Clin Otolaryngol. 2016;41(1):2-7. PMID 25973976. doi:10.1111/coa.12459.**

- URL: https://pubmed.ncbi.nlm.nih.gov/25973976/
- Source checked on: 2026-09-22
- Locator: PMID 25973976; results and conclusions
- Note under review: Prospective voice-clinic cohort (n=210): 17% HADS caseness, strong emotional-VoiSS/HADS correlation, organic laryngeal disorders more distressed than functional dysphonia; the clinic-cohort anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 43.3 — Dietrich M, Verdolini Abbott K, Gartner-Schmidt J, Rosen CA. The frequency of perceived stress, anxiety, and depression in patients with common pathologies affecting voice. J Voice. 2008;22(4):472-488. PMID 18395419. doi:10.1016/j.jvoice.2006.08.007.**

- URL: https://pubmed.ncbi.nlm.nih.gov/18395419/
- Source checked on: 2026-09-22
- Locator: PMID 18395419; results and conclusions
- Note under review: Retrospective voice-clinic cohort (n=160): 31.2% elevated depression scores varying by diagnosis; the diagnosis-stratified burden anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `aphonia` → `anxiety-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The All of Us cross-sectional analysis found 1.44 times the adjusted odds of anxiety (95% CI 1.37-1.52) in ICD-10 R49.0 dysphonia, the largest psychiatric association in that dataset (Weinstein 2026); the voice-clinic cohort found 20% borderline and 17% positive HADS anxiety and/or depression caseness with the emotional VoiSS subscale tracking anxiety at Spearman's rho 0.68 (Montgomery 2016); the retrospective voice-clinic cohort found 36.9% of patients with elevated anxiety scores, the most frequent elevation among the measured domains and highest in paradoxical vocal fold movement disorder (Dietrich 2008).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: all evidence is cross-sectional or retrospective, anxiety states can themselves produce or amplify voice symptoms (including paradoxical vocal fold motion), and the exposure spans hoarseness to complete loss, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 44.1 — Weinstein HNW, Denham MW, Tucker LH, Golub JS, Born HL. Dysphonia Is Associated With Anxiety and Depression in the All of Us Research Program. Laryngoscope. 2026;136(6):2648-2654. PMID 41555208. doi:10.1002/lary.70372.**

- URL: https://pubmed.ncbi.nlm.nih.gov/41555208/
- Source checked on: 2026-09-22
- Locator: PMID 41555208; results and conclusions
- Note under review: Cross-sectional All of Us analysis: adjusted OR 1.44 (1.37-1.52) for anxiety in ICD-10 R49.0 dysphonia, the stronger of the two psychiatric associations; the population-scale anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 44.2 — Montgomery J, Hendry J, Wilson JA, Deary IJ, MacKenzie K. Pragmatic detection of anxiety and depression in a prospective cohort of voice outpatient clinic attenders. Clin Otolaryngol. 2016;41(1):2-7. PMID 25973976. doi:10.1111/coa.12459.**

- URL: https://pubmed.ncbi.nlm.nih.gov/25973976/
- Source checked on: 2026-09-22
- Locator: PMID 25973976; results and conclusions
- Note under review: Prospective voice-clinic cohort: 20% borderline and 17% positive HADS caseness with emotional-VoiSS/HADS anxiety correlation rho 0.68; the clinic-cohort anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 44.3 — Dietrich M, Verdolini Abbott K, Gartner-Schmidt J, Rosen CA. The frequency of perceived stress, anxiety, and depression in patients with common pathologies affecting voice. J Voice. 2008;22(4):472-488. PMID 18395419. doi:10.1016/j.jvoice.2006.08.007.**

- URL: https://pubmed.ncbi.nlm.nih.gov/18395419/
- Source checked on: 2026-09-22
- Locator: PMID 18395419; results and conclusions
- Note under review: Retrospective voice-clinic cohort: 36.9% elevated anxiety scores, the most frequent elevation, highest in paradoxical vocal fold movement disorder; the diagnosis-stratified anchor with its reverse-direction caveat recorded.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `bacterial-rhinitis` → `sinusitis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The 2020 management review defines acute rhinosinusitis (ARS) as mainly an inflammatory disease triggered by viral infection in which few cases end up developing bacterial infection, with bacterial and non-bacterial ARS discriminated by specific sign-symptom combinations (Jaume 2020); the primary-care review states most acute rhinosinusitis is viral (common-cold associated), guides antibiotics for suspected bacterial cases, and warns that non-responders should be suspected of chronic sinusitis (DeCastro 2014); the American Family Physician review records that acute rhinosinusitis is specified as bacterial or viral, most cases are viral, antibiotics are reserved for persistent or worsening courses, and rare bacterial complications include orbital, intracranial, and bony involvement (Aring 2011).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the population pathway runs predominantly through viral URIs, only a minority of ARS episodes develop bacterial infection, and no cohort reports progression rates from documented bacterial rhinitis specifically, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 45.1 — Jaume F, Valls-Mateus M, Mullol J. Common Cold and Acute Rhinosinusitis: Up-to-Date Management in 2020. Curr Allergy Asthma Rep. 2020;20(7):28. PMID 32495003. doi:10.1007/s11882-020-00917-5.**

- URL: https://pubmed.ncbi.nlm.nih.gov/32495003/
- Source checked on: 2026-09-22
- Locator: PMID 32495003; results and conclusions
- Note under review: Guideline-current review: ARS is mainly viral-triggered inflammation and few cases develop bacterial infection, with bacterial and non-bacterial ARS discriminated by sign-symptom combinations; the central continuum-and-minority anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 45.2 — DeCastro A, Mims L, Hueston WJ. Rhinosinusitis. Prim Care. 2014;41(1):47-61. PMID 24439880. doi:10.1016/j.pop.2013.10.006.**

- URL: https://pubmed.ncbi.nlm.nih.gov/24439880/
- Source checked on: 2026-09-22
- Locator: PMID 24439880; results and conclusions
- Note under review: Primary-care review: most acute rhinosinusitis is viral, antibiotics for suspected bacterial cases, non-responders suspected of chronic sinusitis; the diagnostic-criteria anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 45.3 — Aring AM, Chan MM. Acute rhinosinusitis in adults. Am Fam Physician. 2011;83(9):1057-1063. PMID 21534518.**

- URL: https://pubmed.ncbi.nlm.nih.gov/21534518/
- Source checked on: 2026-09-22
- Locator: PMID 21534518; results and conclusions
- Note under review: Review: acute rhinosinusitis specified bacterial or viral with most cases viral and rare bacterial complications (orbital, intracranial, bony); the subtype-and-complication-spectrum anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `chronic-laryngitis` → `vocal-cord-nodules-polyps-cysts-paralysis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The benign vocal-fold-lesion review groups Reinke's edema as a form of chronic laryngitis within lesions of Reinke's space (nodules, polyps, cysts) and assumes a multifactorial genesis (Pickhard 2013); the occupational-voice cohort of 478 professional voice users found chronic laryngitis forms including catarrhal (46.7%), hyperplastic (23.2%), edematous-polypoid (8.5%), and atrophic (5.1%), with etiologic factors smoking, chronic tonsillitis, GERD, asthma, and diabetes (Stepanova 2019); the functional-dysphonia diagnostic-criteria series associated muscle tension dysphonia with vocal nodules, chronic laryngitis, or polypoidal degeneration, recording the hyperfunctional co-behavior confounder (Morrison 1986).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the strongest source connection is taxonomic (Reinke's edema classified as a chronic-laryngitis form), the polypoid form is a minority of chronic laryngitis, shared etiologic drivers dominate, and the target identity includes lesion types and paralysis outside the recorded pathway, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 46.1 — Pickhard A, Reiter R. [Benign vocal fold lesions]. Laryngorhinootologie. 2013;92(5):304-312. PMID 23348959. doi:10.1055/s-0032-1331162.**

- URL: https://pubmed.ncbi.nlm.nih.gov/23348959/
- Source checked on: 2026-09-22
- Locator: PMID 23348959; lesion classification and genesis discussion
- Note under review: Lesion-review classification placing Reinke's edema as a form of chronic laryngitis within Reinke's-space lesions (nodules, polyps, cysts) with multifactorial genesis assumed; the taxonomy anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 46.2 — Stepanova YE, Konoplev OI, Gotovyakhina TV, Koren' EE, Mal'tseva GS. [Acute and chronic laryngitis in the subjects engaged in the voice and speech professions]. Vestn Otorinolaringol. 2019;84(1):68-71. PMID 30938347. doi:10.17116/otorino20198401168.**

- URL: https://pubmed.ncbi.nlm.nih.gov/30938347/
- Source checked on: 2026-09-22
- Locator: PMID 30938347; cohort form distribution and etiology results
- Note under review: Occupational-voice cohort (n=478): chronic laryngitis forms catarrhal 46.7%, hyperplastic 23.2%, edematous-polypoid 8.5%, atrophic 5.1%, with smoking/tonsillitis/GERD/asthma/diabetes as etiologic factors; the form-distribution anchor quantifying polypoid rarity.
- Current state: `verified: false` — pending qualified-human decision

**Row 46.3 — Morrison MD, Nichol H, Rammage LA. Diagnostic criteria in functional dysphonia. Laryngoscope. 1986;96(1):1-8. PMID 3941573. doi:10.1288/00005537-198601000-00001.**

- URL: https://pubmed.ncbi.nlm.nih.gov/3941573/
- Source checked on: 2026-09-22
- Locator: PMID 3941573; results and conclusions
- Note under review: Diagnostic-criteria series associating muscle tension dysphonia with vocal nodules, chronic laryngitis, or polypoidal degeneration; the hyperfunctional co-behavior confounder anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `complex-regional-pain-syndrome` → `osteoporosis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The Buenos Aires DXA cross-sectional study found significantly lower bone mineral density in both regions of interest of the CRPS-affected foot versus the contralateral foot (median difference -8.4% and -8.9%, n=17, Budapest criteria) (Abdala 2025); the Bochum ultrasonographic osteodensitometry study found lower calcaneal Z-scores in both affected and nonaffected limbs of CRPS patients compared with other unilateral pain and healthy controls, with shorter disease duration showing lower Z-scores, and 'local osteopenia and altered bone metabolism' described as major complications of CRPS (Bazika-Gerasch 2019); the lower-extremity CRPS treatment review lists regional osteoporosis among the syndrome's target components for therapy (Hogan 2002).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the quantified studies are cross-sectional with small samples, disuse osteopenia is an alternative explanation, the systemic component lowers both limbs (confounding 'regional' attribution), reverse-direction evidence exists (osteoporosis as a risk factor for CRPS), and the catalog target represents systemic osteoporosis residuals rather than regional atrophy, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 47.1 — Abdala R, Tantau I, Mastronardi G, Weiss F, Micone D, Pizarro GM, Spina M, Zanchetta MB. Impaired bone mineral density in patients with complex regional pain syndrome. J Clin Densitom. 2025;28(4):101632. PMID 41161020. doi:10.1016/j.jocd.2025.101632.**

- URL: https://pubmed.ncbi.nlm.nih.gov/41161020/
- Source checked on: 2026-09-22
- Locator: PMID 41161020; results and conclusions
- Note under review: DXA cross-sectional study (n=17, Budapest criteria): significantly lower affected-foot BMD in both regions of interest (median -8.4% / -8.9%); the quantified regional-deficit anchor with its small-sample limit stated.
- Current state: `verified: false` — pending qualified-human decision

**Row 47.2 — Bazika-Gerasch B, Maier C, Kumowski N, Fiege C, Kaisler M, Vollert J, Dietrich JW. Compared to limb pain of other origin, ultrasonographic osteodensitometry reveals loss of bone density in complex regional pain syndrome. Pain. 2019;160(6):1261-1269. PMID 30747906. doi:10.1097/j.pain.0000000000001520.**

- URL: https://pubmed.ncbi.nlm.nih.gov/30747906/
- Source checked on: 2026-09-22
- Locator: PMID 30747906; results and conclusions
- Note under review: Ultrasonographic osteodensitometry case-control: lower calcaneal Z-scores bilaterally in CRPS versus other unilateral pain and controls, duration-dependent, with local osteopenia described as a major CRPS complication; the comparative anchor with its systemic-component caveat recorded.
- Current state: `verified: false` — pending qualified-human decision

**Row 47.3 — Hogan CJ, Hurwitz SR. Treatment of complex regional pain syndrome of the lower extremity. J Am Acad Orthop Surg. 2002;10(4):281-289. PMID 15089077. doi:10.5435/00124635-200207000-00006.**

- URL: https://pubmed.ncbi.nlm.nih.gov/15089077/
- Source checked on: 2026-09-22
- Locator: PMID 15089077; treatment-component review
- Note under review: Lower-extremity CRPS treatment review listing regional osteoporosis among the syndrome components targeted by therapy; the clinical-recognition anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `complex-regional-pain-syndrome` → `contractures` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The upper-extremity CRPS review records that chronic sequelae of contracture may be addressed surgically in patients with controllable sympathetically maintained pain, and lists stiffness and difficulty sleeping among onset harbingers with progression possible despite intervention (Patterson 2011); the Croatian CRPS review records that physical therapy both prevents atrophy and contractures and reduces analgesic use, positioning contracture prevention as a standard-of-care goal (Blažeković 2015); the foot-and-ankle CRPS review characterizes the natural history as chronicity and relapses producing significant disability, with motor-function abnormality among hallmark features (Shah 2011).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: no cohort reports contracture incidence in CRPS populations, the sources are clinical reviews rather than longitudinal studies, disuse and guarded positioning are alternative explanations, and the catalog contractures identity spans many etiologies, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 48.1 — Patterson RW, Li Z, Smith BP, Smith TL, Koman LA. Complex regional pain syndrome of the upper extremity. J Hand Surg Am. 2011;36(9):1553-1562. PMID 21872098. doi:10.1016/j.jhsa.2011.06.027.**

- URL: https://pubmed.ncbi.nlm.nih.gov/21872098/
- Source checked on: 2026-09-22
- Locator: PMID 21872098; clinical review of sequelae and management
- Note under review: Upper-extremity CRPS review: chronic contracture sequelae surgically addressable with controllable pain, stiffness among onset harbingers, progression possible despite intervention; the clinical-recognition anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 48.2 — Blažeković I, Bilić E, Žagar M, Anić B. [Complex regional pain syndrome]. Lijec Vjesn. 2015;137(9-10):297-306. PMID 26749953.**

- URL: https://pubmed.ncbi.nlm.nih.gov/26749953/
- Source checked on: 2026-09-22
- Locator: PMID 26749953; review of therapy goals
- Note under review: CRPS review recording that physical therapy prevents atrophy and contractures and reduces analgesic use; the prevention-standard-of-care anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 48.3 — Shah A, Kirchner JS. Complex regional pain syndrome. Foot Ankle Clin. 2011;16(2):351-366. PMID 21600455. doi:10.1016/j.fcl.2011.03.001.**

- URL: https://pubmed.ncbi.nlm.nih.gov/21600455/
- Source checked on: 2026-09-22
- Locator: PMID 21600455; results and conclusions
- Note under review: Foot-and-ankle CRPS review: natural history of chronicity and relapses producing significant disability with motor-function abnormality among hallmark features; the natural-history context anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `chalazion` → `visual-impairment` — ASSOCIATION_ONLY

**Proposition (associationBasis):** Prospective quasi-experimental data (253 eyelids, 195 patients) document chalazion-induced corneal astigmatism (mean keratometry difference 0.34 D) and topographic surface-regularity change that decrease after excision, with larger effects from single, firm, centrally located lesions (Bagheri 2009); case documentation describes chalazion-induced hyperopic shift with 20/60 uncorrected acuity resolving completely as the lesion resolved (Cosar 2001); early optometric measurement demonstrated astigmatic change in the axis of the lesion (Nisted 1974).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the observed refractive and topographic changes are largely reversible and small on average, the strongest data derive from excision trials rather than natural-history cohorts, lasting visual impairment is not reported as an outcome in the general chalazion population, and coexisting blepharokeratoconjunctivitis, dry eye, and amblyopia risk factors are active competing explanations, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 49.1 — Bagheri A, Hasani HR, Karimian F, Abrishami M, Yazdani S. Effect of chalazion excision on refractive error and corneal topography. Eur J Ophthalmol. 2009;19(4):521-526. PMID 19551663. doi:10.1177/112067210901900401.**

- URL: https://pubmed.ncbi.nlm.nih.gov/19551663/
- Source checked on: 2026-09-22
- Locator: PMID 19551663; results and conclusions
- Note under review: Prospective quasi-experimental trial (253 eyelids, 195 patients) reporting mean 0.34 D keratometric-astigmatism change and significant surface-regularity improvement after excision, with larger effects from single, firm, central upper-lid lesions; supports the mechanical pathway with excision-reversal evidence rather than natural-history impairment data.
- Current state: `verified: false` — pending qualified-human decision

**Row 49.2 — Cosar CB, Rapuano CJ, Cohen EJ, Laibson PR. Chalazion as a cause of decreased vision after LASIK. Cornea. 2001;20(8):890-892. PMID 11685074. doi:10.1097/00003226-200111000-00024.**

- URL: https://pubmed.ncbi.nlm.nih.gov/11685074/
- Source checked on: 2026-09-22
- Locator: PMID 11685074; results and conclusion
- Note under review: Case documentation of chalazion-induced hyperopic shift with uncorrected acuity 20/60 and topographic central corneal flattening geometrically matching the lesion, resolving completely as the chalazion resolved; supports the compression mechanism directly at case level and illustrates the reversibility bounding the impairment claim.
- Current state: `verified: false` — pending qualified-human decision

**Row 49.3 — Nisted M, Hofstetter HW. Effect of chalazion on astigmatism. Am J Optom Physiol Opt. 1974;51(8):579-582. PMID 4413027. doi:10.1097/00006324-197408000-00007.**

- URL: https://pubmed.ncbi.nlm.nih.gov/4413027/
- Source checked on: 2026-09-22
- Locator: PMID 4413027; title-recorded measurement finding
- Note under review: Early optometric measurement demonstrating chalazion-associated astigmatic change oriented to the lesion; supports the mechanical effect at measurement level without outcome-attribution data.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `charles-bonnet-syndrome` → `anxiety-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** Cross-sectional survey of 70 Charles Bonnet syndrome patients documented that 65.7% experienced distress from hallucinations and 44% reported associated anxiety and depression (Walker 2025); a 126-patient cross-sectional study reported that 42% of patients were bothered by hallucinations, with higher bother associated with psychological distress symptoms (Higgins 2021); a clinical review recommends routine evaluation for emotional distress and quality-of-life impact in CBS (Jones 2021).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the studies are cross-sectional or survey designs without comparison groups, onset ordering between hallucination burden and anxious symptoms is not established, shared drivers (severity of visual loss, social isolation, sensory deprivation) confound the association, and no intervention study demonstrates distress reduction by treating hallucinations, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 50.1 — Walker C, et al. Charles Bonnet syndrome: hallucination characteristics and psychological impact in a large cross-sectional survey. 2025. PMID 41771640.**

- URL: https://pubmed.ncbi.nlm.nih.gov/41771640/
- Source checked on: 2026-09-22
- Locator: PMID 41771640; survey results
- Note under review: Cross-sectional survey of 70 CBS patients documenting hallucination characteristics with 65.7% reporting distress and 44% reporting anxiety and depression; establishes comorbidity prevalence without control or longitudinal data.
- Current state: `verified: false` — pending qualified-human decision

**Row 50.2 — Higgins KE, et al. Visual hallucinations and bother in low-vision patients. 2021. PMID 34377938.**

- URL: https://pubmed.ncbi.nlm.nih.gov/34377938/
- Source checked on: 2026-09-22
- Locator: PMID 34377938; results
- Note under review: Cross-sectional study of 126 low-vision patients in which hallucination bother was associated with psychological distress symptoms; extends the association into a measured bother-distress relationship without onset ordering.
- Current state: `verified: false` — pending qualified-human decision

**Row 50.3 — Jones CA, et al. Charles Bonnet syndrome: a review of the literature. 2021. PMID 39351142.**

- URL: https://pubmed.ncbi.nlm.nih.gov/39351142/
- Source checked on: 2026-09-22
- Locator: PMID 39351142; review discussion
- Note under review: Clinical review recommending routine evaluation of emotional distress and quality-of-life impact in CBS; supports the clinical recognition of the association without directional evidence.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `chemical-pneumonitis` → `interstitial-lung-disease` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The definitive Chest review of aspiration-related syndromes documents chronic aspiration pneumonitis as an established clinical entity whose repeated inflammatory injury can evolve toward pulmonary fibrosis, within a syndrome classification built on clinical-radiologic correlation (Hu 2015); case-based radiologic reviews document diffuse lung disease patterns attributable to chronic aspiration with progression on serial imaging (Mukhopadhyay 2015); a radiologic-course series documented chronic pneumonitis cases evolving to definite idiopathic pulmonary fibrosis patterns on follow-up imaging (Komiya 2015).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the evidence base is reviews and small series without population denominators, the elderly dysphagic populations carry heavy confounding from comorbid neurologic disease, smoking, and independent ILD, and distinguishing aspiration-driven fibrosis from idiopathic disease within an individual requires imaging and clinical synthesis no mapping can substitute for, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 51.1 — Hu X, Lee JS, Pianesi R, et al. Aspiration-related pulmonary syndromes. Chest. 2015;147(3):815-823. PMID 25762348. doi:10.1378/chest.14-1826.**

- URL: https://pubmed.ncbi.nlm.nih.gov/25762348/
- Source checked on: 2026-09-22
- Locator: PMID 25762348; chronic aspiration pneumonitis section
- Note under review: Definitive syndrome-classification review distinguishing aspiration pneumonia, chronic aspiration pneumonitis, and diffuse aspiration bronchiolitis, and describing the chronic injury-to-fibrosis evolution; framework support without cohort denominators.
- Current state: `verified: false` — pending qualified-human decision

**Row 51.2 — Mukhopadhyay S, Katzenstein AL. Pulmonary disease due to aspiration of gastric and oropharyngeal contents: an analysis of 79 cases. 2015. PMID 25732447.**

- URL: https://pubmed.ncbi.nlm.nih.gov/25732447/
- Source checked on: 2026-09-22
- Locator: PMID 25732447; results
- Note under review: Large case-based radiologic-pathologic review documenting lung disease patterns attributable to chronic aspiration, including fibrotic evolution on serial imaging; case-series class supporting the pathway without incidence data.
- Current state: `verified: false` — pending qualified-human decision

**Row 51.3 — Komiya K, et al. Radiological findings and clinical course of chronic pneumonitis of the elderly. 2015. PMID 34349846.**

- URL: https://pubmed.ncbi.nlm.nih.gov/34349846/
- Source checked on: 2026-09-22
- Locator: PMID 34349846; results
- Note under review: Radiologic-course series documenting chronic pneumonitis evolving toward definite IPF-pattern fibrosis on follow-up imaging in described patients; supports the progression observation while illustrating the diagnostic overlap that keeps the edge at association strength.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `choroiditis` → `retinal-detachment` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The definitive review of exudative retinal detachment identifies inflammatory disruption of the blood-retinal barrier, including choroiditis within the uveitis spectrum, as an established mechanism category for serous subretinal fluid collection in uveitis-clinic populations (Amer 2017); Vogt-Koyanagi-Harada disease, a severe bilateral granulomatous panuveitis with choroiditis, is defined by bilateral serous retinal detachments among its presenting features (Bonnet 2017; Baltmr 2016).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the association rests on uveitis-clinic series and pathogenesis reviews without population denominators, in VKH the serous detachments are part of the syndrome's own defined presentation rather than an independently caused outcome, and competing mechanisms (infectious, neoplastic, vascular, iatrogenic) account for many detachments, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 52.1 — Amer R, Nalcı H, Yalçındağ N. Exudative retinal detachment. Surv Ophthalmol. 2017;62(6):723-769. PMID 28506603. doi:10.1016/j.survophthal.2017.05.001.**

- URL: https://pubmed.ncbi.nlm.nih.gov/28506603/
- Source checked on: 2026-09-22
- Locator: PMID 28506603; abstract pathogenesis discussion
- Note under review: Definitive pathogenesis review identifying inflammatory blood-retinal-barrier breakdown, including choroiditis within the uveitis spectrum, as an established mechanism category for exudative retinal detachment in uveitis-clinic populations.
- Current state: `verified: false` — pending qualified-human decision

**Row 52.2 — Bonnet C, Daudin JB, Monnet D, Brézin A. Vogt-Koyanagi-Harada disease. J Fr Ophtalmol. 2017;40(6):512-519. PMID 28579215. doi:10.1016/j.jfo.2017.02.006.**

- URL: https://pubmed.ncbi.nlm.nih.gov/28579215/
- Source checked on: 2026-09-22
- Locator: PMID 28579215; abstract definition
- Note under review: VKH review defining the disease as severe bilateral granulomatous panuveitis associated with serous retinal detachments; supports the co-occurrence at syndrome-definition level rather than as an independently caused outcome.
- Current state: `verified: false` — pending qualified-human decision

**Row 52.3 — Baltmr A, Lightman S, Tomkins-Netzer O. Vogt-Koyanagi-Harada syndrome - current perspectives. Clin Ophthalmol. 2016;10:2345-2361. PMID 27932857. doi:10.2147/OPTH.S94866.**

- URL: https://pubmed.ncbi.nlm.nih.gov/27932857/
- Source checked on: 2026-09-22
- Locator: PMID 27932857; abstract
- Note under review: Moorfields uveitis-service review describing bilateral panuveitis with serous retinal detachments and significant vision loss; documents the clinical association and its treatment dependence without population incidence data.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `chronic-intestinal-pseudo-obstruction` → `malnutrition-residuals` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The comprehensive CIPO pathophysiology-and-management review names malnutrition and small intestinal bacterial overgrowth as the complications requiring prompt recognition and treatment, with management directed at maintaining adequate nutrition (Downes 2018); the dysmotility nutritional-approach review states the main goals of CIPO management are to improve propulsion and maintain adequate nutrition status, with home parenteral nutrition a frequently used, high-dependence therapy and CIPO now a significant cause of chronic intestinal failure (Billiauws 2014); the ESPEN practical guideline for chronic intestinal failure, which includes CIPO-related intestinal failure, devotes 112 recommendations to nutrition management including home parenteral nutrition and its complications (Cuerda 2021).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the evidence is review and guideline class organized around management targets rather than cohort-measured prevalence of malnutrition in CIPO populations, secondary etiologies (systemic disease, post-surgical, neuropathic) confound the attribution, and individual nutritional status depends on intake, absorption, and treatment access, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 53.1 — Downes TJ, Cheruvu MS, Karunaratne TB, De Giorgio R, Farmer AD. Pathophysiology, Diagnosis, and Management of Chronic Intestinal Pseudo-Obstruction. J Clin Gastroenterol. 2018;52(6):477-489. PMID 29877952. doi:10.1097/MCG.0000000000001047.**

- URL: https://pubmed.ncbi.nlm.nih.gov/29877952/
- Source checked on: 2026-09-22
- Locator: PMID 29877952; abstract complications and management
- Note under review: Comprehensive CIPO review naming malnutrition and small intestinal bacterial overgrowth as complications requiring prompt recognition, with management directed at maintaining adequate nutrition and electrolyte balance; establishes the complication relationship at review level.
- Current state: `verified: false` — pending qualified-human decision

**Row 53.2 — Billiauws L, Corcos O, Joly F. Dysmotility disorders: a nutritional approach. Curr Opin Clin Nutr Metab Care. 2014;17(5):483-488. PMID 25023191. doi:10.1097/MCO.0000000000000095.**

- URL: https://pubmed.ncbi.nlm.nih.gov/25023191/
- Source checked on: 2026-09-22
- Locator: PMID 25023191; abstract
- Note under review: Nutritional-management review of CIPO: goals are improving propulsion and maintaining nutrition status; home parenteral nutrition is frequently used with high dependence, and CIPO is a significant cause of chronic intestinal failure; supports the pathway without prevalence denominators.
- Current state: `verified: false` — pending qualified-human decision

**Row 53.3 — Cuerda C, Pironi L, Arends J, et al. ESPEN practical guideline: Clinical nutrition in chronic intestinal failure. Clin Nutr. 2021;40(9):5196-5220. PMID 34479179. doi:10.1016/j.clnu.2021.07.002.**

- URL: https://pubmed.ncbi.nlm.nih.gov/34479179/
- Source checked on: 2026-09-22
- Locator: PMID 34479179; abstract
- Note under review: ESPEN guideline (112 recommendations) for chronic intestinal failure management including home parenteral nutrition and complications; documents the clinical framework in which CIPO-related nutritional failure is managed, guideline class without CIPO-specific prevalence data.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `chronic-pelvic-pain-syndrome` → `endometriosis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The narrative review of endometriosis-related pain identifies endometriosis as the leading cause of chronic pelvic pain, with mechanisms contributing to CPP reviewed across central and peripheral sensitization (Sieberg 2020); the deep-dyspareunia framework documents that half of women with endometriosis experience deep dyspareunia and that CPP in endometriosis is multifactorial, with comorbid interstitial cystitis/bladder pain syndrome and central sensitization as active contributors (Yong 2017); the deep-dyspareunia quality-of-life review documents recurrent dysmenorrhea causing hyperalgesic priming that sensitizes the nervous system, leading to chronic pelvic pain (Yong 2022).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level, and the direction is contested: endometriosis is itself the leading cause of CPP, so CPP as a source condition may reflect undiagnosed endometriosis rather than causing it, CPP populations carry heavy confounding from comorbid bladder-pain syndrome, IBS, pelvic-floor dysfunction, and central sensitization, and the cited evidence is review class without longitudinal onset-ordering data, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 54.1 — Sieberg CB, Lunde CE, Borsook D. Endometriosis and pain in the adolescent- striking early to limit suffering: A narrative review. Neurosci Biobehav Rev. 2020;108:866-876. PMID 31862211. doi:10.1016/j.neubiorev.2019.12.004.**

- URL: https://pubmed.ncbi.nlm.nih.gov/31862211/
- Source checked on: 2026-09-22
- Locator: PMID 31862211; abstract
- Note under review: Review identifying endometriosis as the leading cause of chronic pelvic pain and reviewing mechanisms contributing to CPP; establishes the comorbidity while documenting the diagnostic-delay and sensitization context.
- Current state: `verified: false` — pending qualified-human decision

**Row 54.2 — Yong PJ. Deep Dyspareunia in Endometriosis: A Proposed Framework Based on Pain Mechanisms and Genito-Pelvic Pain Penetration Disorder. Sex Med Rev. 2017;5(4):495-507. PMID 28778699. doi:10.1016/j.sxmr.2017.06.005.**

- URL: https://pubmed.ncbi.nlm.nih.gov/28778699/
- Source checked on: 2026-09-22
- Locator: PMID 28778699; abstract
- Note under review: Framework review documenting that half of women with endometriosis experience deep dyspareunia and that pain in endometriosis is multifactorial with comorbid bladder-pain syndrome and central sensitization; supports the confounded-comorbidity framing.
- Current state: `verified: false` — pending qualified-human decision

**Row 54.3 — Yong PJ. Deep dyspareunia: a narrative review of impact on sexual function and quality of life. Minerva Obstet Gynecol. 2022;74(3):222-233. PMID 35107234. doi:10.23736/S2724-606X.22.04974-0.**

- URL: https://pubmed.ncbi.nlm.nih.gov/35107234/
- Source checked on: 2026-09-22
- Locator: PMID 35107234; abstract
- Note under review: Review documenting recurrent dysmenorrhea causing hyperalgesic priming that sensitizes the nervous system and leads to chronic pelvic pain; supports the sensitization mechanism at review level without directional cohort data.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `churg-strauss-syndrome` → `asthma` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The EGPA treatment review describes EGPA as strongly associated with asthma, with eosinophilic inflammation as the shared pathobiology (McBrien 2018); the childhood-onset Cleveland Clinic cohort documented upper airway disease and pulmonary involvement in all nine patients, with median asthma/rhinitis symptom onset at age 13 preceding EGPA diagnosis at 15 (Gendelman 2013); the Polish pneumonology-center cohort of 86 patients documented sinusitis correlating with better prognosis and prolonged low-dose corticosteroid treatment mainly for asthma as a characteristic management pattern (Fijolek 2023).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: asthma is part of EGPA's defining prodromal presentation rather than an independently caused outcome, the cohorts are small single-center series without general-population denominators, and shared eosinophilic pathobiology makes the direction of any causal claim indeterminate, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 55.1 — McBrien CN, Menzies-Gow A. Mepolizumab for the treatment of eosinophilic granulomatosis with polyangiitis. Drugs Today (Barc). 2018;54(2):93-101. PMID 29637936. doi:10.1358/dot.2018.54.2.2788013.**

- URL: https://pubmed.ncbi.nlm.nih.gov/29637936/
- Source checked on: 2026-09-22
- Locator: PMID 29637936; abstract
- Note under review: EGPA review describing the strong association with asthma and the shared eosinophilic pathobiology, with anti-IL-5 efficacy validated across severe eosinophilic asthma and EGPA; supports the shared-substrate framing without causal direction.
- Current state: `verified: false` — pending qualified-human decision

**Row 55.2 — Gendelman S, Zeft A, Spalding SJ. Childhood-onset eosinophilic granulomatosis with polyangiitis (formerly Churg-Strauss syndrome): a contemporary single-center cohort. J Rheumatol. 2013;40(6):929-935. PMID 23637321. doi:10.3899/jrheum.120808.**

- URL: https://pubmed.ncbi.nlm.nih.gov/23637321/
- Source checked on: 2026-09-22
- Locator: PMID 23637321; results
- Note under review: Cleveland Clinic cohort documenting eosinophilia, upper airway disease, and pulmonary involvement in all nine childhood-onset patients, with asthma/rhinitis onset preceding EGPA diagnosis; documents the prodrome pattern at small-cohort level.
- Current state: `verified: false` — pending qualified-human decision

**Row 55.3 — Fijolek J, Wiatr E, Bujnowski P, Piotrowska-Kownacka D, Roszkowski-Sliz K. Evaluation of prognostic factors for patients with eosinophilic granulomatosis with polyangiitis recruited at the pneumonological centre and mainly ANCA negativity: A retrospective analysis of a single cohort in Poland. Mod Rheumatol. 2023;34(1):157-166. PMID 36658715. doi:10.1093/mr/road001.**

- URL: https://pubmed.ncbi.nlm.nih.gov/36658715/
- Source checked on: 2026-09-22
- Locator: PMID 36658715; results
- Note under review: 86-patient EGPA cohort documenting sinusitis correlation with better prognosis and prolonged low-dose corticosteroid treatment mainly for asthma as the characteristic management pattern; documents the airway-disease overlap without causal claims.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `cicatricial-pemphigoid` → `corneal-scarring` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The OCP case series documents severe dry eye syndrome, entropion, corneal erosions, and ultimately permanent vision loss in three patients with ocular cicatricial pemphigoid (Stan 2020); the comprehensive review describes bilateral chronic cicatricial conjunctivitis producing fornix foreshortening, symblepharon, trichiasis, and entropion whose mechanical factors drive progressive scarring and vascularization of the ocular surface, with blinding keratopathy prevalent in advanced disease (Holsclaw 1998); the diagnostics review identifies antibasement-membrane-mediated subepithelial blistering and conjunctival fibrosis causing severe entropion, trichiasis, symblepharon, and corneal epithelial erosions or ulceration (Brydak-Godowska 2005).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the evidence is case-series and review class without population denominators, the corneal outcome arises through a multi-step mechanical cascade (dry eye, lid malposition, trichiasis) rather than direct corneal involvement, and individual trajectories vary widely with treatment access, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 56.1 — Stan C, Diaconu E, Hopirca L, Petra N, Rednic A, Stan C. Ocular cicatricial pemphigoid. Rom J Ophthalmol. 2020;64(2):226-230. PMID 32685792.**

- URL: https://pubmed.ncbi.nlm.nih.gov/32685792/
- Source checked on: 2026-09-22
- Locator: PMID 32685792; abstract
- Note under review: Case series of three OCP patients documenting severe dry eye syndrome, entropion, corneal erosions, and ultimately permanent vision loss; establishes the end-stage outcome at case-series level.
- Current state: `verified: false` — pending qualified-human decision

**Row 56.2 — Holsclaw DS. Ocular cicatricial pemphigoid. Int Ophthalmol Clin. 1998;38(4):89-106. PMID 10200078. doi:10.1097/00004397-199803840-00009.**

- URL: https://pubmed.ncbi.nlm.nih.gov/10200078/
- Source checked on: 2026-09-22
- Locator: PMID 10200078; abstract
- Note under review: Comprehensive review describing the mechanical cascade from cicatricial conjunctivitis through symblepharon, trichiasis, and entropion to progressive scarring, vascularization, and blinding keratopathy in advanced disease.
- Current state: `verified: false` — pending qualified-human decision

**Row 56.3 — Brydak-Godowska J, Moneta-Wielgoś J, Pauk-Domańska M, et al. Diagnostics and pharmacological treatment of ocular cicatricial pemphigoid. Klin Oczna. 2005;107(10-12):725-727. PMID 16619831.**

- URL: https://pubmed.ncbi.nlm.nih.gov/16619831/
- Source checked on: 2026-09-22
- Locator: PMID 16619831; abstract
- Note under review: Diagnostics review identifying antibasement-membrane-mediated subepithelial blistering and conjunctival fibrosis as the pathophysiologic basis for entropion, trichiasis, symblepharon, and corneal erosions or ulceration; also names secondary glaucoma as a frequent complication.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `circadian-rhythm-sleep-wake-phase-disorders` → `depressive-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The chronotype review documents that the evening chronotype is a risk factor for depressive disorders, with clock genes, neuroendocrinology, and light/dark-cycle mechanisms described (Zou 2022); the neurodevelopmental review documents sleep and circadian disturbances, including circadian rhythm disorders, closely linked to internalizing symptoms such as anxiety and depression (Bruni 2025); the adolescent review documents close association between circadian rhythm disorder and comorbidity of anxiety and depression (Che 2023); the Lancet Series on circadian rhythm sleep-wake disorders notes consequences of disturbed alignment for mental health while emphasizing that not all disruption is driven by underlying circadian disturbance (Meyer 2022).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the association evidence is cross-sectional or review class without longitudinal onset ordering, bidirectionality is plausible (depressive illness also disrupts sleep timing), and behavioral and environmental factors (light exposure, schedules, sleep debt) confound the circadian-specific attribution, as the Lancet Series itself emphasizes, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 57.1 — Zou H, Zhou H, Yan R, Yao Z, Lu Q. Chronotype, circadian rhythm, and psychiatric disorders: Recent evidence and potential mechanisms. Front Neurosci. 2022;16:811771. PMID 36033630. doi:10.3389/fnins.2022.811771.**

- URL: https://pubmed.ncbi.nlm.nih.gov/36033630/
- Source checked on: 2026-09-22
- Locator: PMID 36033630; abstract findings (1)-(5)
- Note under review: Narrative review documenting the evening chronotype as a risk factor for depressive disorders, with clock-gene, neuroendocrine, and light/dark-cycle mechanisms described; association-level evidence without longitudinal onset ordering.
- Current state: `verified: false` — pending qualified-human decision

**Row 57.2 — Bruni O, Breda M, Mammarella V, Mogavero MP, Ferri R. Sleep and circadian disturbances in children with neurodevelopmental disorders. Nat Rev Neurol. 2025;21(2):103-120. PMID 39779841. doi:10.1038/s41582-024-01052-9.**

- URL: https://pubmed.ncbi.nlm.nih.gov/39779841/
- Source checked on: 2026-09-22
- Locator: PMID 39779841; abstract
- Note under review: Review documenting circadian rhythm disorders among the sleep disturbances closely linked to internalizing symptoms including anxiety and depression, with neurotransmitter, hormonal, and inflammatory mechanisms discussed.
- Current state: `verified: false` — pending qualified-human decision

**Row 57.3 — Meyer N, Harvey AG, Lockley SW, Dijk DJ. Circadian rhythms and disorders of the timing of sleep. Lancet. 2022;400(10357):1061-1078. PMID 36115370. doi:10.1016/S0140-6736(22)00877-7.**

- URL: https://pubmed.ncbi.nlm.nih.gov/36115370/
- Source checked on: 2026-09-22
- Locator: PMID 36115370; abstract
- Note under review: Lancet Series review of circadian rhythm sleep-wake disorders noting mental-health consequences of disturbed alignment while explicitly cautioning that not all disruption is driven by underlying circadian disturbance; framework support with built-in confounding caveat.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `cleft-lip-palate-residuals` → `otitis-media` — ASSOCIATION_ONLY

**Proposition (associationBasis):** GeneReviews documents that cleft palate management mandates timely treatment of otitis media due to eustachian-tube dysfunction to prevent secondary hearing loss, with otolaryngologic evaluation within six months of life and continued throughout adolescence (Schutte 2021); the Brazilian cross-sectional cohort of 89 cleft children documented chronic otitis media related to eustachian-tube dysfunction with associated conductive hearing loss, worst thresholds at ages 4-7 (mean 21.2 dB, air-bone gap 19.7 dB, up to 70 dB at some frequencies) (Godinho 2018); the adult speech-outcomes study documents that untreated cleft palate persists into adulthood with associated functional morbidity, illustrating the residuals population in whom ear disease may remain active (Lou 2021).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the pathway is well described but the evidence is cohort/series class without incidence denominators against matched non-cleft adults, modern early palatal repair and tube placement change the natural history, and individual ear-disease course depends on surgical timing and adenoid status, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 58.1 — Schutte BC, Saal HM, Goudy S, Leslie EJ. IRF6-Related Disorders. GeneReviews. 2003 Oct 30 [updated 2021 Mar 4]. PMID 20301581.**

- URL: https://pubmed.ncbi.nlm.nih.gov/20301581/
- Source checked on: 2026-09-22
- Locator: PMID 20301581; management and surveillance sections
- Note under review: GeneReviews entry documenting timely treatment of otitis media due to eustachian-tube dysfunction to prevent secondary hearing loss as standard cleft management, with otolaryngologic surveillance mandated into adolescence; establishes the complication relationship at guideline level.
- Current state: `verified: false` — pending qualified-human decision

**Row 58.2 — Godinho RN, Sih T, Ibiapina CDC, Oliveira MHMF, Rezende ALF, Tassara RV. Cleft lip and palate associated hearing loss in Brazilian children. Int J Pediatr Otorhinolaryngol. 2018;115:38-40. PMID 30368389. doi:10.1016/j.ijporl.2018.08.038.**

- URL: https://pubmed.ncbi.nlm.nih.gov/30368389/
- Source checked on: 2026-09-22
- Locator: PMID 30368389; results and conclusion
- Note under review: Cross-sectional cohort of 89 cleft children documenting chronic otitis media related to eustachian-tube dysfunction with conductive hearing loss (mean thresholds 17.5-21.2 dB, air-bone gaps 13.2-19.7 dB, up to 70 dB); series-level quantification without matched controls.
- Current state: `verified: false` — pending qualified-human decision

**Row 58.3 — Lou Q, Wang X, Chen Y. Speech Outcomes Comparison Between Adult Velopharyngeal Insufficiency and Patients With Unrepaired Cleft Palate. J Craniofac Surg. 2021;32(2):655-659. PMID 33705003. doi:10.1097/SCS.0000000000006994.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33705003/
- Source checked on: 2026-09-22
- Locator: PMID 33705003; results
- Note under review: Adult cleft-palate outcomes study documenting persistent functional morbidity in the unrepaired/adult population; illustrates the residuals context in which ear disease may remain active without contributing directional data.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `cluster-headache` → `depressive-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The LUCA cross-sectional questionnaire study (462 ICHD-III-defined cluster headache patients vs 177 controls) documented almost threefold higher odds of lifetime depression in cluster headache (OR 2.77, 95% CI 1.70-4.51), with current depression associated with active attacks but no effect remaining after correction for sleep disturbances (Louter 2016); the psychiatric-comorbidity review discusses depression, anxiety, and suicide in cluster headache along with confounding variables (Robbins 2013); the Brazilian real-world study documented anxiety, insomnia, and depression among the most common comorbidities with 10.34% of patients having considered suicide (Karnieg 2026).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the flagship association attenuated to non-significance after sleep-disturbance correction, bidirectionality is plausible (depressive illness worsens pain coping and sleep), shared hypothalamic mechanisms may generate both conditions in parallel, and the comorbidity surveys are cross-sectional without onset ordering, so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 59.1 — Louter MA, Wilbrink LA, Haan J, van Zwet EW, van Oosterhout WPJ, Zitman FG, Ferrari MD, Terwindt GM. Cluster headache and depression. Neurology. 2016;87(18):1899-1906. PMID 27694264. doi:10.1212/WNL.0000000000003282.**

- URL: https://pubmed.ncbi.nlm.nih.gov/27694264/
- Source checked on: 2026-09-22
- Locator: PMID 27694264; results and conclusions
- Note under review: Controlled cross-sectional study (462 patients vs 177 controls) documenting OR 2.77 for lifetime depression in cluster headache, with current depression associated with active attacks but no residual effect after sleep-disturbance correction; the central association evidence with its key confounder built in.
- Current state: `verified: false` — pending qualified-human decision

**Row 59.2 — Robbins MS. The psychiatric comorbidities of cluster headache. Curr Pain Headache Rep. 2013;17(2):313. PMID 23296640. doi:10.1007/s11916-012-0313-8.**

- URL: https://pubmed.ncbi.nlm.nih.gov/23296640/
- Source checked on: 2026-09-22
- Locator: PMID 23296640; abstract
- Note under review: Review discussing depression, anxiety, bipolar disorder, aggression, and suicide in cluster headache with explicit attention to confounding variables; supports the comorbidity framing without directional claims.
- Current state: `verified: false` — pending qualified-human decision

**Row 59.3 — Karnieg T, Vincent M, Martinez J, Whitton W, Hargreaves L, Papadimitropoulos E. Clinical Characteristics and Patient Burden of Cluster Headache in Brazil: A Real-World Study. Adv Ther. 2026;43(2):583-599. PMID 41335330. doi:10.1007/s12325-025-03424-z.**

- URL: https://pubmed.ncbi.nlm.nih.gov/41335330/
- Source checked on: 2026-09-22
- Locator: PMID 41335330; results
- Note under review: Real-world burden study (n=450 physician forms, 177 patient forms) documenting anxiety, insomnia, and depression among the most common comorbidities with 10.34% suicidality; burden documentation without onset-ordering data.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `cognitive-disorder` → `depressive-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The state-of-the-science review of mild cognitive impairment records the MCI phenomenology as comprising lower quality of life, greater symptoms of depression, and avoidant coping including social withdrawal, in a condition affecting 10-15% of the over-65 population (Anderson 2019); the umbrella review of potentially modifiable risk factors for dementia and MCI synthesizes the depression-comorbidity literature among risk and associate factors (Jones 2024); and the neurocognitive meta-reviews document how cognitive dysfunction co-occurs with mood disturbance across etiologies while reversible and confounded causes remain active (Bucks 2013).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the association is cross-sectional with bidirectionality built into the literature itself (depressive disorder both co-occurs with and reversibly mimics cognitive impairment), the umbrella identity mixes etiologies with distinct comorbidity structures, and sleep-disorder and medication confounding is pervasive, so only co-occurrence is recorded.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 60.1 — Anderson ND. State of the science on mild cognitive impairment (MCI). CNS Spectr. 2019;24(1):78-87. PMID 30651152. doi:10.1017/S1092852918001347.**

- URL: https://pubmed.ncbi.nlm.nih.gov/30651152/
- Source checked on: 2026-09-22
- Locator: PMID 30651152; abstract
- Note under review: State-of-the-science review recording the MCI phenomenology as including lower quality of life, greater depression symptoms, and avoidant coping with social withdrawal, in a condition affecting 10-15% of the over-65 population; the central comorbidity-phenomenology evidence.
- Current state: `verified: false` — pending qualified-human decision

**Row 60.2 — Jones A, Ali MU, Kenny M, Mayhew A, Mokashi V, He H, Lin S, Yavari E, Paik K, Subramanian D, Dydynsky R, Aryal K, Correia RH, Dash D, Manis DR, O'Connell M, Liu-Ambrose T, Taler V, McMillan JM, Hogan DB, Kirkland S, Costa AP, Wolfson C, Raina P, Griffith L. Potentially Modifiable Risk Factors for Dementia and Mild Cognitive Impairment: An Umbrella Review and Meta-Analysis. Dement Geriatr Cogn Disord. 2024;53(2):91-106. PMID 38346414. doi:10.1159/000536643.**

- URL: https://pubmed.ncbi.nlm.nih.gov/38346414/
- Source checked on: 2026-09-22
- Locator: PMID 38346414; introduction, methods
- Note under review: Umbrella review and meta-analysis synthesizing the risk-factor and comorbidity literature for mild and major neurocognitive disorders; the broad associate-factor context for depression in the dementia/MCI spectrum.
- Current state: `verified: false` — pending qualified-human decision

**Row 60.3 — Bucks RS, Olaithe M, Eastwood P. Neurocognitive function in obstructive sleep apnoea: a meta-review. Respirology. 2013;18(1):61-70. PMID 22913604. doi:10.1111/j.1440-1843.2012.02255.x.**

- URL: https://pubmed.ncbi.nlm.nih.gov/22913604/
- Source checked on: 2026-09-22
- Locator: PMID 22913604; abstract
- Note under review: Meta-review of 33 reviews documenting OSA-associated deficits in attention, memory, and executive function with sleep-fragmentation and hypoxaemia associations, and CPAP-treatment reversibility of those deficits (RCT meta-analysis PMID 32310179: attention/processing-speed improvement in severe OSA); entered deliberately as the competing-etiology anchor showing a treatable sleep disorder generating cognitive impairment and mood disturbance in parallel.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `conus-medullaris-syndrome` → `urinary-incontinence` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The defining-presentation and case-series literature documents bladder dysfunction as a core feature of conus medullaris syndrome: the pure-conus surgical cohort (8 patients, L1 burst fractures) recorded urodynamic-confirmed neurogenic bladder in all patients, split between overactive and underactive types, with only half regaining normal voiding function at final follow-up (Chiu & Liao 2019); the lumbar burst-fracture case study documents bladder dysfunction from conus injury after a 25-foot fall (Storch 2005); the DAVF case report presents urinary retention as part of a rapidly progressive conus syndrome (Stevens 2009).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the quantified evidence is a single 8-patient surgical series plus case reports, the injury-level-to-bladder-phenotype mapping varies patient to patient, and the neurogenic-bladder literature defines the dysfunction as a direct expression of the lesion rather than an independently progressing condition, so only co-occurrence within the syndrome picture is recorded.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 61.1 — Chiu PY, Liao JC. Surgical outcomes in thoracolumbar fractures with pure conus medullaris syndrome. Biomed J. 2019;42(4):277-284. PMID 31627870. doi:10.1016/j.bj.2019.02.004.**

- URL: https://pubmed.ncbi.nlm.nih.gov/31627870/
- Source checked on: 2026-09-22
- Locator: PMID 31627870; background, results, conclusions
- Note under review: Eight-patient pure-conus L1 burst-fracture cohort with urodynamic assessment: all had neurogenic bladder (four overactive, four underactive), five regained self-voiding, three required intermittent catheterization, and only half regained normal bladder and sexual function; the central quantified outcome evidence.
- Current state: `verified: false` — pending qualified-human decision

**Row 61.2 — Storch JS. Lumbar burst fracture associated with bowel, bladder, and sexual dysfunction: case study. J Neurosci Nurs. 2005;37(2):68-71. PMID 15902947. doi:10.1097/01376517-200504000-00002.**

- URL: https://pubmed.ncbi.nlm.nih.gov/15902947/
- Source checked on: 2026-09-22
- Locator: PMID 15902947; abstract
- Note under review: Case study of L1 burst fracture after a 25-foot fall producing conus medullaris injury with bowel, bladder, and sexual dysfunction; documents the combined sacral-dysfunction picture in a single injury mechanism.
- Current state: `verified: false` — pending qualified-human decision

**Row 61.3 — Stevens EA, Powers AK, Morris PP, Wilson JA. Occult dural arteriovenous fistula causing rapidly progressive conus medullaris syndrome and paraplegia after lumbar microdiscectomy. Spine J. 2009;9(9):e8-12. PMID 19442586. doi:10.1016/j.spinee.2009.03.015.**

- URL: https://pubmed.ncbi.nlm.nih.gov/19442586/
- Source checked on: 2026-09-22
- Locator: PMID 19442586; background, results
- Note under review: Case report of an occult spinal DAVF presenting as rapidly progressive conus medullaris syndrome with urinary retention and fecal incontinence; entered deliberately as the etiologic-heterogeneity anchor showing non-traumatic conus lesions produce the same downstream picture.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `conus-medullaris-syndrome` → `fecal-incontinence` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The defining-presentation and case literature documents bowel dysfunction among the core features of conus medullaris syndrome: the pure-conus definition used by the surgical literature is itself a combination of bladder/bowel incontinence and impotence signs (Chiu & Liao 2019), the lumbar burst-fracture case study documents bowel dysfunction from conus injury (Storch 2005), and the DAVF case report presents frank fecal incontinence as part of a rapidly progressive conus syndrome (Stevens 2009).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the evidence is case-report and small-series class with no population denominators, bowel dysfunction is defined as part of the syndrome's own presentation rather than an independently progressing condition, and anorectal-manometry quantification of conus-lesion bowel dysfunction is not reported in the available records, so only co-occurrence within the syndrome picture is recorded.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 62.1 — Chiu PY, Liao JC. Surgical outcomes in thoracolumbar fractures with pure conus medullaris syndrome. Biomed J. 2019;42(4):277-284. PMID 31627870. doi:10.1016/j.bj.2019.02.004.**

- URL: https://pubmed.ncbi.nlm.nih.gov/31627870/
- Source checked on: 2026-09-22
- Locator: PMID 31627870; background
- Note under review: Surgical cohort whose working definition of pure conus medullaris syndrome is itself bladder/bowel incontinence plus impotence signs; anchors bowel dysfunction as a defining feature while its outcomes quantify only voiding and sexual recovery.
- Current state: `verified: false` — pending qualified-human decision

**Row 62.2 — Storch JS. Lumbar burst fracture associated with bowel, bladder, and sexual dysfunction: case study. J Neurosci Nurs. 2005;37(2):68-71. PMID 15902947. doi:10.1097/01376517-200504000-00002.**

- URL: https://pubmed.ncbi.nlm.nih.gov/15902947/
- Source checked on: 2026-09-22
- Locator: PMID 15902947; abstract
- Note under review: Case study of L1 burst fracture producing conus medullaris injury with bowel and bladder dysfunction; the direct bowel-outcome documentation in the batch.
- Current state: `verified: false` — pending qualified-human decision

**Row 62.3 — Stevens EA, Powers AK, Morris PP, Wilson JA. Occult dural arteriovenous fistula causing rapidly progressive conus medullaris syndrome and paraplegia after lumbar microdiscectomy. Spine J. 2009;9(9):e8-12. PMID 19442586. doi:10.1016/j.spinee.2009.03.015.**

- URL: https://pubmed.ncbi.nlm.nih.gov/19442586/
- Source checked on: 2026-09-22
- Locator: PMID 19442586; background
- Note under review: Case report presenting frank fecal incontinence and urinary retention from an occult DAVF congestive myelopathy; the etiologic-heterogeneity anchor for non-traumatic conus lesions.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `coccydynia` → `depressive-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The condition-specific literature consistently documents the chronic-burden profile that the general chronic-pain literature links to depression: the reference work states many cases are notoriously persistent, challenging to treat, and associated with severe and disabling chronic pain, and records the psychosocial burden of diagnostic dismissal (Bain, Mabrouk & Foye 2025); the clinical review states coccyx pain substantially decreases quality of life with classic sitting-exacerbated symptoms (Foye 2017); the interventional case series documents mean baseline pain of 8.4-8.5 on an 11-point numerical rating scale in refractory patients with significant functional impairment (Saldanha 2025), and the 173-patient coccygectomy series shows disability-index outcomes that remain abnormal in a subset at mean 5.6-year follow-up with trauma the etiology in 41% (Mulpuri 2022, PMID 35177527 — retained in the registry relationship record, not cited on this edge to respect the three-reference cap).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: no controlled depression-prevalence study exists in coccydynia specifically, the burden-to-depression inference crosses from the general chronic-pain literature, bidirectionality is plausible (depression amplifies pain reporting and reduces treatment engagement), and the interventional cohorts are small, treatment-selected, and heavily female, so only comorbidity-consistent burden documentation is recorded.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 63.1 — Bain HL, Mabrouk A, Foye PM. Coccyx Pain. StatPearls [Internet]. Treasure Island (FL): StatPearls Publishing; 2025 Aug 9. PMID 33085286.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33085286/
- Source checked on: 2026-09-22
- Locator: PMID 33085286; introduction
- Note under review: Reference work stating that many cases are notoriously persistent, challenging to treat, and associated with severe and disabling chronic pain, and documenting the diagnostic-dismissal burden patients report; the condition-characterization anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 63.2 — Foye PM. Coccydynia: Tailbone Pain. Phys Med Rehabil Clin N Am. 2017;28(3):539-549. PMID 28676363. doi:10.1016/j.pmr.2017.03.006.**

- URL: https://pubmed.ncbi.nlm.nih.gov/28676363/
- Source checked on: 2026-09-22
- Locator: PMID 28676363; abstract
- Note under review: Clinical review stating coccyx pain substantially decreases quality of life, with classic sitting-exacerbated midline symptoms and focal tenderness; the burden and functional-limitation documentation.
- Current state: `verified: false` — pending qualified-human decision

**Row 63.3 — Saldanha J, Crispiniano M, Carvalho JL. Ganglion Impar Block and Pulsed Radiofrequency Under Fluoroscopic Guidance in Chronic Coccydynia: A Retrospective Case Series. Cureus. 2025;17(11):e97753. PMID 41458750. doi:10.7759/cureus.97753.**

- URL: https://pubmed.ncbi.nlm.nih.gov/41458750/
- Source checked on: 2026-09-22
- Locator: PMID 41458750; introduction, results
- Note under review: Retrospective series of 24 refractory chronic-coccydynia patients (91.7% female) with mean baseline NRS 8.4-8.5 quantifying the severity ceiling of persistent pain despite conservative care; burden quantification without psychiatric outcomes.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `contact-dermatitis` → `cellulitis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The dermatologic literature recognizes superinfection of dermatitic skin as a standard complication: the topical-antibiotic review names impetigo and other superinfected dermatitis among the central indications for antibacterial therapy (Bonamonte 2020); the eczema-herpeticum review documents how a defective epidermal barrier with Th2-skewed immunity, reduced antimicrobial peptides, and Staphylococcus-aureus dysbiosis predisposes eczematous skin to disseminated infection (Traidl 2021); and the reference review records that atopic patients tend to develop viral infections with eczema herpeticum the most feared complication (Wetzel & Wollenberg 2004).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the superinfection evidence is concentrated in atopic dermatitis rather than contact dermatitis specifically, the step from epidermal impetiginization to deeper dermal cellulitis is mechanistically coherent but not quantified in contact-dermatitis cohorts, and local wound care in modern practice interrupts the chain, so only the complication pathway is recorded without a causal claim.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 64.1 — Bonamonte D, De Marco A, Giuffrida R, Conforti C, Barlusconi C, Foti C, Romita P. Topical antibiotics in the dermatological clinical practice: Indications, efficacy, and adverse effects. Dermatol Ther. 2020;33(6):e13824. PMID 32531105. doi:10.1111/dth.13824.**

- URL: https://pubmed.ncbi.nlm.nih.gov/32531105/
- Source checked on: 2026-09-22
- Locator: PMID 32531105; abstract
- Note under review: Narrative review naming impetigo and other superinfected dermatitis among the central indications for topical antibiotic therapy; establishes superinfection of dermatitic skin as a treatment-recognized complication.
- Current state: `verified: false` — pending qualified-human decision

**Row 64.2 — Traidl S, Roesner L, Zeitvogel J, Werfel T. Eczema herpeticum in atopic dermatitis. Allergy. 2021;76(10):3017-3027. PMID 33844308. doi:10.1111/all.14853.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33844308/
- Source checked on: 2026-09-22
- Locator: PMID 33844308; abstract
- Note under review: Review documenting the barrier-plus-immune predisposition of eczematous skin to disseminated infection: type-2-skewed antiviral T cells, impaired dendritic and NK-cell function, reduced antimicrobial peptides, and Staphylococcus-aureus dysbiosis; the mechanistic anchor for barrier-failure superinfection across eczematous dermatitides.
- Current state: `verified: false` — pending qualified-human decision

**Row 64.3 — Wetzel S, Wollenberg A. [Eczema herpeticatum]. Hautarzt. 2004;55(7):646-652. PMID 15150652. doi:10.1007/s00105-004-0744-1.**

- URL: https://pubmed.ncbi.nlm.nih.gov/15150652/
- Source checked on: 2026-09-22
- Locator: PMID 15150652; abstract
- Note under review: Reference review recording that atopic dermatitis patients tend to develop viral infections, with eczema herpeticum the most feared complication; corroborates the infection-predisposition framing in eczematous skin.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `conductive-hearing-loss` → `tinnitus` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The validated-questionnaire otosclerosis cohort found preoperative tinnitus in 107 of 157 patients (68.2%), 47.7% unilateral in the surgical ear and 52.3% bilateral, moderately severe on THI/TFI instruments (Skarzynski 2019); the Portuguese acuphenometry cohort found tinnitus in 72.7% of 66 otosclerosis patients, mostly unilateral and low-frequency, with THI median 37 (mild handicap modal, severe 22.9%) (Lima 2022); the literature review identifies middle-ear and secondary inner-ear dysfunction from stapes blockage as the major etiopathogenic factors and documents considerable tinnitus-prevalence improvement after corrective surgery, indicating a substantial reversible conductive component (Deggouj 2009).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the cohorts are otosclerosis-specific rather than all-cause conductive-loss populations, tinnitus severity does not correlate with hearing-loss degree in either cohort, cochlear (sensorineural) involvement can coexist and independently generate tinnitus, and surgery-improvement data show reversible contributions - so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 65.1 — Skarzynski PH, Dziendziel B, Gos E, Wlodarczyk E, Miaskiewicz B, Rajchel JJ, Skarzynski H. Prevalence and Severity of Tinnitus in Otosclerosis: Preliminary Findings from Validated Questionnaires. J Int Adv Otol. 2019;15(2):277-282. PMID 31418718. doi:10.5152/iao.2019.5512.**

- URL: https://pubmed.ncbi.nlm.nih.gov/31418718/
- Source checked on: 2026-09-22
- Locator: PMID 31418718; results and conclusions
- Note under review: Validated-questionnaire cohort (n=157): preoperative tinnitus in 68.2%, moderately severe on THI/TFI, no correlation between tinnitus severity and audiometric results; the quantified prevalence anchor with its severity-decoupling limit recorded.
- Current state: `verified: false` — pending qualified-human decision

**Row 65.2 — Lima AF, Moreira FC, Costa IE, Azevedo C, Mar F, Dias L. Tinnitus and Otosclerosis: An Exploratory Study about the Prevalence, Features and Impact in Daily Life. Int Arch Otorhinolaryngol. 2022;26(3):e390-e395. PMID 35846815. doi:10.1055/s-0041-1739967.**

- URL: https://pubmed.ncbi.nlm.nih.gov/35846815/
- Source checked on: 2026-09-22
- Locator: PMID 35846815; results and conclusions
- Note under review: Acuphenometry cohort (n=66): tinnitus in 72.7%, mostly unilateral low-frequency, THI median 37 with 22.9% severe handicap; corroborating anchor recording that tinnitus existence and severity were not associated with hearing-loss degree.
- Current state: `verified: false` — pending qualified-human decision

**Row 65.3 — Deggouj N, Castelein S, Gerard JM, Decat M, Gersdorff M. Tinnitus and otosclerosis. B-ENT. 2009;5(4):241-244. PMID 20163050.**

- URL: https://pubmed.ncbi.nlm.nih.gov/20163050/
- Source checked on: 2026-09-22
- Locator: PMID 20163050; results and conclusions
- Note under review: Literature review identifying middle-ear and secondary inner-ear dysfunction from stapes blockage as major etiopathogenic factors and documenting tinnitus-prevalence improvement after corrective surgery; the mechanistic and reversibility anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `conjunctivitis` → `corneal-scarring` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The adenoviral-keratoconjunctivitis review records that viral protein remnants on Bowman layer provoke an immune reaction forming subepithelial infiltrates, described as the major sequelae and difficult to treat (Renard 2010); the update review confirms keratitis nummularis as the corneal manifestation of adenoviral infection (Gonzalez-Lopez 2013); the mechanism study resolves the pathway - HMGB1 secreted by infected corneal epithelial cells induces leukocytic infiltrates directly and via stimulated stromal cells, explaining subepithelial infiltrate formation in epidemic keratoconjunctivitis (Saha 2025).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the scar pathway is documented for adenoviral EKC specifically rather than conjunctivitis broadly, subepithelial infiltrates often resolve rather than persisting as permanent scarring, no cohort reports permanent-opacity incidence after conjunctivitis, and unrelated corneal disease produces identical scarring - so no directional claim is made here.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 66.1 — Renard G. [Adenoviral keratoconjunctivitis]. J Fr Ophtalmol. 2010;33(8):586-592. PMID 20724026. doi:10.1016/j.jfo.2010.07.003.**

- URL: https://pubmed.ncbi.nlm.nih.gov/20724026/
- Source checked on: 2026-09-22
- Locator: PMID 20724026; results and conclusions
- Note under review: Adenoviral keratoconjunctivitis review: viral protein remnants on Bowman layer provoke immune-reaction subepithelial infiltrates, described as the major difficult-to-treat sequelae; the scar-pathway anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 66.2 — Gonzalez-Lopez JJ, Morcillo-Laiz R, Munoz-Negrete FJ. Adenoviral keratoconjunctivitis: an update. Arch Soc Esp Oftalmol. 2013;88(3):108-115. PMID 23473088. doi:10.1016/j.oftal.2012.07.007.**

- URL: https://pubmed.ncbi.nlm.nih.gov/23473088/
- Source checked on: 2026-09-22
- Locator: PMID 23473088; results and conclusions
- Note under review: Update review confirming keratitis nummularis as the corneal manifestation of adenoviral infection; the clinical-recognition anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 66.3 — Saha A, Islam MM, Kumar R, Ismail AM, Garcia E, Gullapali RR, Chodosh J, Rajaiya J. Virus and cell specific HMGB1 secretion and subepithelial infiltrate formation in adenovirus keratitis. PLoS Pathog. 2025;21(5):e1013184. PMID 40367285. doi:10.1371/journal.ppat.1013184.**

- URL: https://pubmed.ncbi.nlm.nih.gov/40367285/
- Source checked on: 2026-09-22
- Locator: PMID 40367285; results and conclusions
- Note under review: Mechanism study resolving SEI formation: HMGB1 secreted by infected corneal epithelial cells induces leukocytic infiltrates directly and via stromal chemokine stimulation; the experimental-mechanism anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `coronary-bypass-residuals` → `cardiac-arrhythmia` — DIRECT_CAUSATION

**Proposition (direct_causation):** This DIRECT_CAUSATION classification is about the proposed treatment-mediated theory, not a population-level statement that coronary artery disease causes arrhythmia: coronary bypass surgery residuals (the post-CABG state) -> postoperative atrial fibrillation arising from the surgery itself, if documented -> claimed cardiac arrhythmia identity; the exposure is the surgery, not the underlying atherosclerosis, and agent-specific documentation (operation date, arrhythmia onset, persistence) is required. Postoperative atrial fibrillation is recognized as a common complication of isolated CABG in patients with no prior AF.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 67.1 — Kuroda Y, Shiomi H, Morimoto T, Hirao S, Tsubota H, Matsuo T, et al. Postoperative Atrial Fibrillation After Coronary Artery Bypass Grafting. Circ J. 2025;90(1):24-34. PMID 41242757. doi:10.1253/circj.CJ-25-0581.**

- URL: https://pubmed.ncbi.nlm.nih.gov/41242757/
- Source checked on: 2026-09-22
- Locator: PMID 41242757; results and conclusions
- Note under review: CREDO-Kyoto Cohort-3 (n=1,483 CABG without prior AF): new-onset POAF during the index hospitalization in 337 (23%), with numerically higher 5-year stroke and heart failure and significantly higher major bleeding; the large-cohort incidence and long-term-outcome anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 67.2 — Rum M, Er H, Yilmaz F, Ceylan L, Ketenci B. Postoperative Atrial Fibrillation Following Isolated Coronary Artery Bypass Grafting: Incidence, Predictors, and Clinical Outcomes. J Coll Physicians Surg Pak. 2025;35(9):1083-1087. PMID 40948152. doi:10.29271/jcpsp.2025.09.1083.**

- URL: https://pubmed.ncbi.nlm.nih.gov/40948152/
- Source checked on: 2026-09-22
- Locator: PMID 40948152; results and conclusions
- Note under review: Observational cohort (n=489 isolated CABG, prior AF and valvular disease excluded): POAF associated with advanced age, reduced GFR, chronic kidney disease, and prolonged cross-clamp time, and with increased postoperative morbidity and mortality; the predictor and outcome anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 67.3 — Royster RL, Deng H, Whalen SP. Postoperative Atrial Fibrillation. Anesth Analg. 2017;125(1):10-12. PMID 28628573. doi:10.1213/ANE.0000000000002070.**

- URL: https://pubmed.ncbi.nlm.nih.gov/28628573/
- Source checked on: 2026-09-22
- Locator: PMID 28628573; results and conclusions
- Note under review: Editorial overview positioning POAF as the most common arrhythmia complication after cardiac surgery; the clinical-recognition anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `coronary-bypass-residuals` → `cognitive-disorder` — DIRECT_CAUSATION

**Proposition (direct_causation):** This DIRECT_CAUSATION classification is about the proposed treatment-mediated theory, not a population-level statement that coronary artery disease causes dementia: coronary bypass surgery residuals (the post-CABG state) -> postoperative cognitive dysfunction/neurocognitive decline arising from the surgery itself, if documented -> claimed cognitive disorder identity; the exposure is the surgery, not the underlying atherosclerosis, and documentation of the cognitive trajectory across the operation is required.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 68.1 — Saczynski JS, Marcantonio ER, Quach L, Fong TG, Gross A, Inouye SK, Jones RN. Cognitive trajectories after postoperative delirium. N Engl J Med. 2012;367(1):30-39. PMID 22762316. doi:10.1056/NEJMoa1112923.**

- URL: https://pubmed.ncbi.nlm.nih.gov/22762316/
- Source checked on: 2026-09-22
- Locator: PMID 22762316; results and conclusions
- Note under review: Longitudinal cohort (n=225 cardiac surgery, CABG or valve): delirium in 46%, with larger immediate MMSE decline and lower cognitive function at 1 month and 1 year, and 40% not returned to baseline at 6 months; the trajectory anchor with its recovery-uncertainty limit recorded.
- Current state: `verified: false` — pending qualified-human decision

**Row 68.2 — Roman GC. Vascular dementia may be the most common form of dementia in the elderly. J Neurol Sci. 2002;203-204:7-10. PMID 12417349. doi:10.1016/s0022-510x(02)00252-6.**

- URL: https://pubmed.ncbi.nlm.nih.gov/12417349/
- Source checked on: 2026-09-22
- Locator: PMID 12417349; results and conclusions
- Note under review: Review recording measurable cognitive dysfunction post-CABG in 80-90% of patients at hospital discharge and a long-term (5-year) incidence of cognitive defects of 42%; the incidence anchor (figures are review-cited literature values).
- Current state: `verified: false` — pending qualified-human decision

**Row 68.3 — Funder KS, Steinmetz J, Rasmussen LS. Cognitive dysfunction after cardiovascular surgery. Minerva Anestesiol. 2009;75(5):329-332. PMID 19412153.**

- URL: https://pubmed.ncbi.nlm.nih.gov/19412153/
- Source checked on: 2026-09-22
- Locator: PMID 19412153; results and conclusions
- Note under review: Review of POCD after cardiovascular surgery: high incidence, contradictory on- versus off-pump evidence, and important long-term consequences for quality of life and survival; the scope-and-context anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `cyclic-vomiting-syndrome` → `migraine-headaches` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The critical review states CVS is closely associated with migraine headaches and likely shares pathophysiology (Frazier 2023); the 2025 NASPGHAN guideline panel records considerable symptom overlap with migraine and issued a strong recommendation for anti-migraine abortive agents specifically in patients with a personal or family migraine history (Karrento 2025); the earlier review describes a strong association with migraine in the patient and the mother and proposes a mitochondrial mechanism (Kaul 2015).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: anti-migraine efficacy and family-history overlap support a shared trigeminal-autonomic substrate but do not show migraine causing CVS or vice versa; no prospective cohort quantifies migraine development after CVS onset; symptom overlap can reflect the same episodic disorder spectrum rather than a causal link.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 69.1 — Frazier R, Li BUK, Venkatesan T. Diagnosis and Management of Cyclic Vomiting Syndrome: A Critical Review. Am J Gastroenterol. 2023;118(7):1157-1167. PMID 36791365. doi:10.14309/ajg.0000000000002216.**

- URL: https://pubmed.ncbi.nlm.nih.gov/36791365/
- Source checked on: 2026-09-23
- Locator: PMID 36791365; Discussion (migraine/psychiatric comorbidity) and minimal-testing recommendations
- Note under review: Critical review: CVS is 'closely associated with migraine headaches' with likely shared pathophysiology, and is 'frequently associated with anxiety, depression, and autonomic dysfunction'; minimal testing includes upper endoscopy, where esophageal mucosal injury would be assessed.
- Current state: `verified: false` — pending qualified-human decision

**Row 69.2 — Karrento K, Rosen JM, Tarbell SE, Issenman RM, Gelfand AA, Gamboa H, Parikh S, Adams K, Wiercioch W, Li BUK. North American Society for Pediatric Gastroenterology, Hepatology, and Nutrition 2025 guidelines for management of cyclic vomiting syndrome in children. J Pediatr Gastroenterol Nutr. 2025;80(6):1028-1061. PMID 40223700. doi:10.1002/jpn3.70020.**

- URL: https://pubmed.ncbi.nlm.nih.gov/40223700/
- Source checked on: 2026-09-23
- Locator: PMID 40223700; Background/Results (migraine overlap, anti-migraine recommendation, QoL)
- Note under review: NASPGHAN 2025 evidence-based guidelines (GRADE): considerable symptom overlap with migraine, strong recommendation for anti-migraine abortive agents with personal/family migraine history, and explicit recognition of inordinate quality-of-life impact and biopsychosocial management.
- Current state: `verified: false` — pending qualified-human decision

**Row 69.3 — Kaul A, Kaul KK. Cyclic Vomiting Syndrome: A Functional Disorder. Pediatr Gastroenterol Hepatol Nutr. 2015;18(4):224-229. PMID 26770896. doi:10.5223/pghn.2015.18.4.224.**

- URL: https://pubmed.ncbi.nlm.nih.gov/26770896/
- Source checked on: 2026-09-23
- Locator: PMID 26770896; pathophysiology and complications sections
- Note under review: Review: strong association with migraine headaches in the patient and the mother (mitochondrial hypothesis); severe episodes can produce dehydration and hematemesis from Mallory-Weiss tears of the esophageal mucosa.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `cyclic-vomiting-syndrome` → `depressive-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The critical review states CVS is frequently associated with anxiety and depression and recommends treatment of comorbid conditions to improve outcomes (Frazier 2023); the task-force review characterizes CVS as marked by frequent hospitalizations, multiple comorbidities, and poor quality of life (Raucci 2020); the guideline panel records the syndrome's inordinate impact on quality of life and endorses biopsychosocial management (Karrento 2025).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: chronic episodic illness burden plausibly contributes to depression, but the same sources document stress and anxiety triggering episodes (reverse direction), no incidence cohort quantifies depressive-disorder development after CVS onset, and psychiatric comorbidity may share the autonomic/central substrate rather than result from vomiting burden.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 70.1 — Frazier R, Li BUK, Venkatesan T. Diagnosis and Management of Cyclic Vomiting Syndrome: A Critical Review. Am J Gastroenterol. 2023;118(7):1157-1167. PMID 36791365. doi:10.14309/ajg.0000000000002216.**

- URL: https://pubmed.ncbi.nlm.nih.gov/36791365/
- Source checked on: 2026-09-23
- Locator: PMID 36791365; Discussion (migraine/psychiatric comorbidity) and minimal-testing recommendations
- Note under review: Critical review: CVS is 'closely associated with migraine headaches' with likely shared pathophysiology, and is 'frequently associated with anxiety, depression, and autonomic dysfunction'; minimal testing includes upper endoscopy, where esophageal mucosal injury would be assessed.
- Current state: `verified: false` — pending qualified-human decision

**Row 70.2 — Raucci U, Borrelli O, Di Nardo G, et al. Cyclic Vomiting Syndrome in Children. Front Neurol. 2020;11:583425. PMID 33224097. doi:10.3389/fneur.2020.583425.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33224097/
- Source checked on: 2026-09-23
- Locator: PMID 33224097; etiopathogenesis and quality-of-life sections
- Note under review: Joint SIGENP/SINP task-force review: CVS is an underdiagnosed episodic syndrome characterized by frequent hospitalizations, multiple comorbidities, and poor quality of life; HPA-axis hyperactivity and aberrant brain-gut pathways are implicated in the episodic pattern.
- Current state: `verified: false` — pending qualified-human decision

**Row 70.3 — Karrento K, Rosen JM, Tarbell SE, Issenman RM, Gelfand AA, Gamboa H, Parikh S, Adams K, Wiercioch W, Li BUK. North American Society for Pediatric Gastroenterology, Hepatology, and Nutrition 2025 guidelines for management of cyclic vomiting syndrome in children. J Pediatr Gastroenterol Nutr. 2025;80(6):1028-1061. PMID 40223700. doi:10.1002/jpn3.70020.**

- URL: https://pubmed.ncbi.nlm.nih.gov/40223700/
- Source checked on: 2026-09-23
- Locator: PMID 40223700; Background/Results (migraine overlap, anti-migraine recommendation, QoL)
- Note under review: NASPGHAN 2025 evidence-based guidelines (GRADE): considerable symptom overlap with migraine, strong recommendation for anti-migraine abortive agents with personal/family migraine history, and explicit recognition of inordinate quality-of-life impact and biopsychosocial management.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `cyclic-vomiting-syndrome` → `esophagitis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The review literature documents that severe CVS episodes can produce hematemesis from Mallory-Weiss tears of the esophageal mucosa (Kaul 2015), and that upper endoscopy is minimal recommended testing in CVS (Frazier 2023), the modality by which reflux and mucosal injury are assessed; repeated forceful emesis with acid exposure is the recognized injury pathway for esophageal mucosal disease in chronic vomiting syndromes.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: Mallory-Weiss tears are acute mucosal lacerations, not chronic esophagitis, and no cohort reports esophagitis incidence in CVS; GERD can coexist as an antecedent or comorbid condition rather than an outcome; endoscopy-based testing acknowledges mucosal evaluation but does not quantify injury frequency.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 71.1 — Kaul A, Kaul KK. Cyclic Vomiting Syndrome: A Functional Disorder. Pediatr Gastroenterol Hepatol Nutr. 2015;18(4):224-229. PMID 26770896. doi:10.5223/pghn.2015.18.4.224.**

- URL: https://pubmed.ncbi.nlm.nih.gov/26770896/
- Source checked on: 2026-09-23
- Locator: PMID 26770896; pathophysiology and complications sections
- Note under review: Review: strong association with migraine headaches in the patient and the mother (mitochondrial hypothesis); severe episodes can produce dehydration and hematemesis from Mallory-Weiss tears of the esophageal mucosa.
- Current state: `verified: false` — pending qualified-human decision

**Row 71.2 — Frazier R, Li BUK, Venkatesan T. Diagnosis and Management of Cyclic Vomiting Syndrome: A Critical Review. Am J Gastroenterol. 2023;118(7):1157-1167. PMID 36791365. doi:10.14309/ajg.0000000000002216.**

- URL: https://pubmed.ncbi.nlm.nih.gov/36791365/
- Source checked on: 2026-09-23
- Locator: PMID 36791365; Discussion (migraine/psychiatric comorbidity) and minimal-testing recommendations
- Note under review: Critical review: CVS is 'closely associated with migraine headaches' with likely shared pathophysiology, and is 'frequently associated with anxiety, depression, and autonomic dysfunction'; minimal testing includes upper endoscopy, where esophageal mucosal injury would be assessed.
- Current state: `verified: false` — pending qualified-human decision

**Row 71.3 — Karrento K, Rosen JM, Tarbell SE, Issenman RM, Gelfand AA, Gamboa H, Parikh S, Adams K, Wiercioch W, Li BUK. North American Society for Pediatric Gastroenterology, Hepatology, and Nutrition 2025 guidelines for management of cyclic vomiting syndrome in children. J Pediatr Gastroenterol Nutr. 2025;80(6):1028-1061. PMID 40223700. doi:10.1002/jpn3.70020.**

- URL: https://pubmed.ncbi.nlm.nih.gov/40223700/
- Source checked on: 2026-09-23
- Locator: PMID 40223700; Background/Results (migraine overlap, anti-migraine recommendation, QoL)
- Note under review: NASPGHAN 2025 evidence-based guidelines (GRADE): considerable symptom overlap with migraine, strong recommendation for anti-migraine abortive agents with personal/family migraine history, and explicit recognition of inordinate quality-of-life impact and biopsychosocial management.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `cystitis-or-neurogenic-bladder` → `hydronephrosis` — DIRECT_CAUSATION

**Proposition (direct_causation):** Documented neurogenic bladder dysfunction (detrusor-sphincter dyssynergia or detrusor underactivity) -> clinically significant high-pressure storage/voiding or incomplete emptying -> overwhelmed ureterovesical junction with vesicoureteral reflux or direct back-pressure -> claimed hydronephrosis.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 72.1 — Leslie SW, Aeddula NR. Vesicoureteral Reflux. StatPearls [Internet]. Treasure Island (FL): StatPearls Publishing; updated 2024 Apr 30. PMID 33085409.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33085409/
- Source checked on: 2026-09-23
- Locator: PMID 33085409; etiology (neurogenic bladder association) and renal-damage predictors
- Note under review: StatPearls review: neurogenic bladder is a recognized cause of vesicoureteral reflux, and high-pressure bladder conditions are key predictors of additional renal damage and scarring; reflux nephropathy accounts for about 5% of pediatric renal transplants.
- Current state: `verified: false` — pending qualified-human decision

**Row 72.2 — Wu CQ, Franco I. Management of vesicoureteral reflux in neurogenic bladder. Investig Clin Urol. 2017;58(Suppl 1):S54-S58. PMID 28612061. doi:10.4111/icu.2017.58.S1.S54.**

- URL: https://pubmed.ncbi.nlm.nih.gov/28612061/
- Source checked on: 2026-09-23
- Locator: PMID 28612061; introduction (UVJ overwhelm mechanism, pyelonephritis/renal-scarring risk)
- Note under review: Review: VUR in neurogenic bladder develops through a defective ureterovesical junction or an overwhelmed normal UVJ mechanism caused by bladder dysfunction; VUR is a significant risk factor for pyelonephritis and renal scarring.
- Current state: `verified: false` — pending qualified-human decision

**Row 72.3 — Belko NA, Pohl HG. Pediatric Urinary Tract Infections. Urol Clin North Am. 2024;51(4):537-549. PMID 39349021. doi:10.1016/j.ucl.2024.06.004.**

- URL: https://pubmed.ncbi.nlm.nih.gov/39349021/
- Source checked on: 2026-09-23
- Locator: PMID 39349021; introduction (neurogenic bladder as UTI risk factor)
- Note under review: Review: neurogenic bladder conveys an increased risk of urinary tract infection; in the obstructed/refluxing bladder, UTI and stasis are the standard drivers of upper-tract dilatation and pyelonephritis.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `cystitis-or-neurogenic-bladder` → `kidney-stones` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The StatPearls bladder-stone review states adult bladder stone formation is most often associated with urinary stasis from bladder outlet obstruction or neurogenic bladder dysfunction (Leslie 2026); the SCI-focused literature review documents excess kidney and bladder stone risk in neurogenic bladder populations (Ruffion 2007); the neurogenic-bladder UTI review lists urinary stasis, high bladder pressure, and bladder stones among the population's risk factors, documenting the reciprocal stasis-stone-infection interaction (Dinh 2019).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the quantified excess-risk data are spinal-cord-injury cohorts rather than all-cause neurogenic bladder, catheter use independently drives encrustation and infection stones, immobilization and metabolic factors contribute in SCI, and no incidence denominator exists for non-SCI neurogenic bladder populations.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 73.1 — Leslie SW, Sajjad H, Murphy PB. Bladder Stones. StatPearls [Internet]. Treasure Island (FL): StatPearls Publishing; updated 2026 Jun 8. PMID 28722973.**

- URL: https://pubmed.ncbi.nlm.nih.gov/28722973/
- Source checked on: 2026-09-23
- Locator: PMID 28722973; etiology (neurogenic bladder stasis) and prognosis (recurrence)
- Note under review: StatPearls review: in adults, bladder stone formation is most often associated with urinary stasis from bladder outlet obstruction or neurogenic bladder dysfunction, chronic infection, augmentation, or catheters; recurrence is expected without correction of underlying etiologic factors.
- Current state: `verified: false` — pending qualified-human decision

**Row 73.2 — Ruffion A, Traxer O, Chartier-Kastler E. [Stones and neurogenic bladder]. Prog Urol. 2007;17(3):417-423. PMID 17622069. doi:10.1016/s1166-7087(07)92340-4.**

- URL: https://pubmed.ncbi.nlm.nih.gov/17622069/
- Source checked on: 2026-09-23
- Locator: PMID 17622069; abstract (excess stone risk in neurogenic bladder populations)
- Note under review: Literature review: excess risk of kidney and bladder stones in spinal-cord-injury neurogenic bladder populations; discusses prevention and identification of high-risk groups for intensive follow-up.
- Current state: `verified: false` — pending qualified-human decision

**Row 73.3 — Dinh A, Davido B, Duran C, Bouchand F, Gaillard JL, Even A, Denys P, Chartier-Kastler E, Bernard L. Urinary tract infections in patients with neurogenic bladder. Med Mal Infect. 2019;49(7):495-504. PMID 30885540. doi:10.1016/j.medmal.2019.02.006.**

- URL: https://pubmed.ncbi.nlm.nih.gov/30885540/
- Source checked on: 2026-09-23
- Locator: PMID 30885540; risk-factor list (stasis, high pressure, stones)
- Note under review: Narrative review: risk factors for UTI in neurogenic bladder include indwelling catheter, urinary stasis, high bladder pressure, and bladder stones - the reciprocal stasis-stone-infection interaction documented in the population.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `dandy-walker-syndrome` → `hydrocephalus` — DIRECT_CAUSATION

**Proposition (direct_causation):** Documented Dandy-Walker malformation (posterior-fossa cyst communicating with the fourth ventricle with vermian hypoplasia) -> obstructed CSF flow from the posterior fossa -> claimed hydrocephalus.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 74.1 — Ocampo-Navia MI, Perez-Mendez W, Rodriguez-Alvarez MP, Chadid-Contreras J, Vergara MF. Dandy-Walker syndrome: an updated literature review. Childs Nerv Syst. 2025;41(1):194. PMID 40445443. doi:10.1007/s00381-025-06842-0.**

- URL: https://pubmed.ncbi.nlm.nih.gov/40445443/
- Source checked on: 2026-09-23
- Locator: PMID 40445443; abstract (hydrocephalus presentation, management, prognosis)
- Note under review: Updated review: DWS occurs in 1 in 25,000-35,000 live births and often presents with hydrocephalus and other CNS anomalies; management involves treating hydrocephalus, and prognosis hinges on associated malformations.
- Current state: `verified: false` — pending qualified-human decision

**Row 74.2 — Spennato P, Mirone G, Nastro A, Buonocore MC, Ruggiero C, Trischitta V, Aliberti F, Cinalli G. Hydrocephalus in Dandy-Walker malformation. Childs Nerv Syst. 2011;27(10):1665-1681. PMID 21928031. doi:10.1007/s00381-011-1544-4.**

- URL: https://pubmed.ncbi.nlm.nih.gov/21928031/
- Source checked on: 2026-09-23
- Locator: PMID 21928031; conclusion (hydrocephalus control determines outcome)
- Note under review: Definitive review dedicated to the hydrocephalus-DWM relationship: therapeutic control of hydrocephalus (single shunting of ventricle or cyst, or endoscopic third ventriculostomy) is effective, and prognosis and intellectual outcome depend on associated malformations and the adequate control of hydrocephalus.
- Current state: `verified: false` — pending qualified-human decision

**Row 74.3 — Bokhari I, Rehman L, Hassan S, Hashim MS. Dandy-Walker Malformation: A Clinical and Surgical Outcome Analysis. J Coll Physicians Surg Pak. 2015;25(6):431-433. PMID 26100996.**

- URL: https://pubmed.ncbi.nlm.nih.gov/26100996/
- Source checked on: 2026-09-23
- Locator: PMID 26100996; results (hydrocephalus in 100% of presenting cohort)
- Note under review: Surgical case series (n=70): hydrocephalus was present in all patients as the predominant presenting feature; shunt malfunction and infection were the commonest post-treatment complications.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `de-quervain-s-tenosynovitis` → `carpal-tunnel-syndrome` — ASSOCIATION_ONLY

**Proposition (associationBasis):** In a 310-patient electrodiagnostic CTS cohort, ultrasound-confirmed de Quervain's tenosynovitis was found in 9.9% of hands, which the authors report as a higher prevalence than the normal population (Mandiroglu 2021); the JAMA spectrum review groups de Quervain tenosynovitis and carpal tunnel syndrome among the common hand conditions sharing risk factors (female sex, diabetes, occupational exposures) and first-line therapies (Currie 2022); de Quervain's is characterized as an overuse thickening of the first extensor compartment (Goel 2015), the same degenerative/fibrotic tenosynovial biology that underlies stenosing tenosynovial disease elsewhere in the wrist.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the co-occurrence study is cross-sectional in a referred population (ascertainment bias possible), no cohort quantifies incident CTS after de Quervain's onset, the common substrate (tenosynovial fibrosis from repetitive use, diabetes, female sex, hormonal factors) can produce either condition independently, and effective treatment of either condition interrupts any shared pathway.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 75.1 — Mandiroglu S, Alemdaroglu E. Idiopathic carpal tunnel syndrome and de Quervain's tenosynovitis: is there an association? Somatosens Mot Res. 2021;38(4):353-356. PMID 34632917. doi:10.1080/08990220.2021.1986378.**

- URL: https://pubmed.ncbi.nlm.nih.gov/34632917/
- Source checked on: 2026-09-23
- Locator: PMID 34632917; results (9.9% co-occurrence above baseline) and conclusion
- Note under review: Cohort of 310 patients/356 hands evaluated for idiopathic CTS: de Quervain's tenosynovitis was present in 9.9% of CTS hands (29 cases), a prevalence the authors report as higher than the normal population baseline; ultrasound-confirmed DQT with electrodiagnostic CTS.
- Current state: `verified: false` — pending qualified-human decision

**Row 75.2 — Currie KB, Tadisina KK, Mackinnon SE. Common Hand Conditions: A Review. JAMA. 2022;327(24):2434-2445. PMID 35762992. doi:10.1001/jama.2022.8481.**

- URL: https://pubmed.ncbi.nlm.nih.gov/35762992/
- Source checked on: 2026-09-23
- Locator: PMID 35762992; Importance/Observations (shared risk profile across the hand-condition spectrum)
- Note under review: JAMA review of the four common compressive/stenosing hand conditions - carpal tunnel syndrome, trigger finger, de Quervain tenosynovitis, and thumb basilar arthritis - as a spectrum with shared risk factors (female sex, diabetes, occupation) and common first-line therapy.
- Current state: `verified: false` — pending qualified-human decision

**Row 75.3 — Goel R, Abzug JM. de Quervain's tenosynovitis: a review of the rehabilitative options. Hand (N Y). 2015;10(1):1-5. PMID 25762881. doi:10.1155/2014/9649-3.**

- URL: https://pubmed.ncbi.nlm.nih.gov/25762881/
- Source checked on: 2026-09-23
- Locator: PMID 25762881; introduction (overuse tendinopathy definition) and management
- Note under review: Review characterizing de Quervain's as an overuse disease with thickening of the first dorsal compartment extensor retinaculum; documents conservative and surgical management that interrupts the tendinopathy pathway.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `decubitus-ulcers` → `osteomyelitis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The StatPearls pathophysiology review documents that unchecked pressure-injury necrosis can spread into the bony architecture and cause osteomyelitis, with tissue destruction deepest at the bone-muscle interface (Zaidi 2026); the primary-care management review directs monitoring of all pressure injuries for osteomyelitis (Visconti 2023); however, the systematic review of stage IV sacral ulcers found many patients with chronically exposed bone lack biopsy-confirmed osteomyelitis and MRI cannot accurately distinguish osteomyelitis from bone remodeling (Wong 2019).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the contiguous-spread pathway is qualitatively standard but its actual incidence in exposed-bone populations is unquantified and, per the biopsy data, likely a minority of advanced ulcers; imaging over-calls infection versus remodeling; healing-stage wounds and treated wounds interrupt the pathway; and diabetic foot-ulcer osteomyelitis literature (a different population) cannot be transposed without cohort-specific data.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 76.1 — Zaidi SRH, El Khatib S, Sharma S. Pressure Injury. StatPearls [Internet]. Treasure Island (FL): StatPearls Publishing; updated 2026 Jul 5. PMID 31971747.**

- URL: https://pubmed.ncbi.nlm.nih.gov/31971747/
- Source checked on: 2026-09-23
- Locator: PMID 31971747; pathophysiology (vertical spread to bony architecture)
- Note under review: StatPearls review: unchecked necrotic breakdown can migrate vertically, promote localized cellulitis, spread into the bony architecture and cause osteomyelitis, or invade the vascular network and cause sepsis; conical deep-tissue destruction is highest at the bone-muscle interface.
- Current state: `verified: false` — pending qualified-human decision

**Row 76.2 — Wong D, Holtom P, Spellberg B. Osteomyelitis Complicating Sacral Pressure Ulcers: Whether or Not to Treat With Antibiotic Therapy. Clin Infect Dis. 2019;68(2):338-342. PMID 29986022. doi:10.1093/cid/ciy559.**

- URL: https://pubmed.ncbi.nlm.nih.gov/29986022/
- Source checked on: 2026-09-23
- Locator: PMID 29986022; abstract (biopsy denominator, MRI limitation, debridement contingency)
- Note under review: Systematic review of stage IV sacral pressure-ulcer osteomyelitis: many patients with chronically exposed bone do not have evidence of osteomyelitis when biopsied, and MRI may not accurately distinguish osteomyelitis from bone remodeling - biopsy-confirmed disease is the standard, with treatment benefit contingent on surgical debridement and wound coverage.
- Current state: `verified: false` — pending qualified-human decision

**Row 76.3 — Visconti AJ, Sola OI, Raghavan PV. Pressure Injuries: Prevention, Evaluation, and Management. Am Fam Physician. 2023;108(2):166-174. PMID 37590857.**

- URL: https://pubmed.ncbi.nlm.nih.gov/37590857/
- Source checked on: 2026-09-23
- Locator: PMID 37590857; treatment section (osteomyelitis surveillance)
- Note under review: Primary-care management review: all pressure injuries should be monitored for local infection, biofilms, and osteomyelitis; debridement of devitalized tissue and staging per NPIAP guide surveillance for deep extension.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `dermatitis` → `insomnia` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The sleep-disorder review documents sleep disturbance in 33%-90% of adults with atopic dermatitis, driven by nocturnal pruritus and disease pathophysiology (Bawany 2021); the US population survey (n=2,893) found 40.7% of AD adults reporting 1+ disturbed nights weekly, rising with disease severity (Silverberg 2022); the ISI-scored pilot cohort quantified a flare-dependent increase from a mean 8.7 between flares to 16 during flares (Mann 2020).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the itch-arousal pathway is standard but the evidence base is cross-sectional or small-cohort; bidirectionality is documented (sleep loss itself amplifies itch and scratch cycles); flares confound chronic-disease attribution; and the same sources state pruritus is not the only insomnia driver, so subset attribution within dermatitis requires individual documentation.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 77.1 — Bawany F, Northcott CA, Beck LA, Pigeon WR. Sleep Disturbances and Atopic Dermatitis: Relationships, Methods for Assessment, and Therapies. J Allergy Clin Immunol Pract. 2021 Apr;9(4):1488-1500. PMID 33321263.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33321263/
- Source checked on: 2026-09-23
- Locator: PMID 33321263; adult sleep-disturbance prevalence band and mechanisms
- Note under review: Review: sleep disturbances affect 33%-90% of adults with atopic dermatitis; nocturnal pruritus and the complex AD pathophysiology underlie sleep disruption; most evidence uses subjective measures.
- Current state: `verified: false` — pending qualified-human decision

**Row 77.2 — Silverberg JI, Chiesa-Fuxench Z, Margolis D, et al. Epidemiology and Burden of Sleep Disturbances in Atopic Dermatitis in US Adults. Dermatitis. 2022 Nov-Dec;33(6S):S104-S113. PMID 33675326.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33675326/
- Source checked on: 2026-09-23
- Locator: PMID 33675326; sleep-disturbance prevalence and HADS mediation analysis
- Note under review: US population-based cross-sectional survey (n=2,893): 40.7% of adults meeting UK criteria for AD reported 1+ nights of sleep disturbance in the past week; more severe sleep disturbance was associated with higher HADS anxiety/depression scores, and sleep-disturbance severity mediated the AD-to-anxiety/depression associations.
- Current state: `verified: false` — pending qualified-human decision

**Row 77.3 — Mann C, Dreher M, Weess HG, Staubach P. Sleep Disturbance in Patients with Urticaria and Atopic Dermatitis: An Underestimated Burden. Acta Derm Venereol. 2020;100(6):adv00073. PMID 32016441.**

- URL: https://pubmed.ncbi.nlm.nih.gov/32016441/
- Source checked on: 2026-09-23
- Locator: PMID 32016441; flare-dependent insomnia severity in AD
- Note under review: Pilot cohort (n=61, ISI-scored): mean Insomnia Severity Index rose from 8.7 between flares to 16 during AD flares; authors note pruritus may not be the only driver of insomnia in AD.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `dermatitis` → `cellulitis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The pathophysiology review establishes impaired skin barrier as the portal for cellulitis and names chronic barrier diseases as predisposing contexts (Cranendonk 2017); the primary-care review links untreated pruritus-scratch cycles to bacterial skin complications and directs itch treatment at preventing them (Moses 2003). The same review that supports the pathway also documents that eczema is frequently mistaken for cellulitis, so a claimed sequence may in fact be a diagnostic substitution.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: barrier-failure entry is qualitatively standard biology, but no incidence denominator quantifies cellulitis occurrence in dermatitis populations; fissuring/erosion severity varies by subtype; venous insufficiency, diabetes, obesity, and lymphatic damage are independent and often dominant risk factors; and the misdiagnosis guard means some apparent sequences are reclassifications rather than outcomes.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 78.1 — Cranendonk DR, Lavrijsen APM, Prins JM, Wiersinga WJ. Cellulitis: current insights into pathophysiology and clinical management. Neth J Med. 2017 Nov;75(9):366-378. PMID 29219814.**

- URL: https://pubmed.ncbi.nlm.nih.gov/29219814/
- Source checked on: 2026-09-23
- Locator: PMID 29219814; barrier-impairment pathophysiology and eczema-mimics finding
- Note under review: Pathophysiology review: cellulitis occurs when the physical skin barrier, immune system, and/or circulatory system are impaired; the same review documents that venous insufficiency, eczema, deep vein thrombosis, and gout are frequently mistaken for cellulitis - a misdiagnosis guard for any dermatitis-to-cellulitis claim.
- Current state: `verified: false` — pending qualified-human decision

**Row 78.2 — Moses S. Pruritus. Am Fam Physician. 2003 Sep 15;68(6):1135-42. PMID 14524401.**

- URL: https://pubmed.ncbi.nlm.nih.gov/14524401/
- Source checked on: 2026-09-23
- Locator: PMID 14524401; pruritus treatment preventing scratch-induced impetigo
- Note under review: Primary-care review: effective treatment of pruritus prevents scratch-induced complications such as lichen simplex chronicus and impetigo, linking chronic itch-scratch cycles to bacterial skin infection.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `dermatitis` → `impetigo` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The primary-care impetigo review documents that impetigo commonly develops secondarily in broken skin including eczematous (impetiginized) dermatitis (Hartman-Adams 2014); the pruritus review directs treatment at preventing scratch-induced impetigo (Moses 2003); the cellulitis review's barrier-impairment framework covers the same entry mechanism (Cranendonk 2017).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: impetiginization of eczematous skin is a recognized clinical entity, but occurrence is concentrated in specific contexts (children, colonization carriers, warm seasons) that are not characterized for the general dermatitis population; Staphylococcus aureus colonization rather than dermatitis severity may be the operative variable; and no cohort quantifies incident impetigo attributable to dermatitis.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 79.1 — Hartman-Adams H, Banvard C, Juckett G. Impetigo: diagnosis and treatment. Am Fam Physician. 2014 Aug 15;90(4):229-35. PMID 25250996.**

- URL: https://pubmed.ncbi.nlm.nih.gov/25250996/
- Source checked on: 2026-09-23
- Locator: PMID 25250996; impetiginized eczema as a recognized presentation
- Note under review: Primary-care review: impetigo is the most common bacterial skin infection and commonly develops secondarily in areas of broken skin, including eczematous (impetiginized) dermatitis.
- Current state: `verified: false` — pending qualified-human decision

**Row 79.2 — Moses S. Pruritus. Am Fam Physician. 2003 Sep 15;68(6):1135-42. PMID 14524401.**

- URL: https://pubmed.ncbi.nlm.nih.gov/14524401/
- Source checked on: 2026-09-23
- Locator: PMID 14524401; pruritus treatment preventing scratch-induced impetigo
- Note under review: Primary-care review: effective treatment of pruritus prevents scratch-induced complications such as lichen simplex chronicus and impetigo, linking chronic itch-scratch cycles to bacterial skin infection.
- Current state: `verified: false` — pending qualified-human decision

**Row 79.3 — Cranendonk DR, Lavrijsen APM, Prins JM, Wiersinga WJ. Cellulitis: current insights into pathophysiology and clinical management. Neth J Med. 2017 Nov;75(9):366-378. PMID 29219814.**

- URL: https://pubmed.ncbi.nlm.nih.gov/29219814/
- Source checked on: 2026-09-23
- Locator: PMID 29219814; barrier-impairment pathophysiology and eczema-mimics finding
- Note under review: Pathophysiology review: cellulitis occurs when the physical skin barrier, immune system, and/or circulatory system are impaired; the same review documents that venous insufficiency, eczema, deep vein thrombosis, and gout are frequently mistaken for cellulitis - a misdiagnosis guard for any dermatitis-to-cellulitis claim.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `dermatitis` → `depressive-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The burden systematic review names depression among the most frequently reported humanistic burden parameters in adult AD across 233 studies (Fasseeh 2022); the US population survey found sleep-disturbance severity mediated the association between AD severity and HADS-depression scores (Silverberg 2022); the sleep review independently ties disturbed sleep to psychological morbidity in AD adults (Bawany 2021).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the visible-chronic-disease and sleep-mediated pathways are consistent with the burden literature, but every anchor is cross-sectional; reverse direction is documented in dermatology-psychology literature (mood states amplify itch perception and scratching); and the mediation does not order variables causally. The generic dermatitis identity also includes less visible subtypes with unknown psychological burden.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 80.1 — Fasseeh AN, Elezbawy B, Korra N, et al. Burden of Atopic Dermatitis in Adults and Adolescents: a Systematic Literature Review. Dermatol Ther (Heidelb). 2022 Dec;12(12):2653-2668. PMID 36197589.**

- URL: https://pubmed.ncbi.nlm.nih.gov/36197589/
- Source checked on: 2026-09-23
- Locator: PMID 36197589; depression/anxiety as top-ranked humanistic burden parameters
- Note under review: Systematic review (233 studies): itch, depression, sleep disturbance, and anxiety were the most frequently reported clinical and humanistic burden parameters in adult AD; magnitude scales with severity.
- Current state: `verified: false` — pending qualified-human decision

**Row 80.2 — Silverberg JI, Chiesa-Fuxench Z, Margolis D, et al. Epidemiology and Burden of Sleep Disturbances in Atopic Dermatitis in US Adults. Dermatitis. 2022 Nov-Dec;33(6S):S104-S113. PMID 33675326.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33675326/
- Source checked on: 2026-09-23
- Locator: PMID 33675326; sleep-disturbance prevalence and HADS mediation analysis
- Note under review: US population-based cross-sectional survey (n=2,893): 40.7% of adults meeting UK criteria for AD reported 1+ nights of sleep disturbance in the past week; more severe sleep disturbance was associated with higher HADS anxiety/depression scores, and sleep-disturbance severity mediated the AD-to-anxiety/depression associations.
- Current state: `verified: false` — pending qualified-human decision

**Row 80.3 — Bawany F, Northcott CA, Beck LA, Pigeon WR. Sleep Disturbances and Atopic Dermatitis: Relationships, Methods for Assessment, and Therapies. J Allergy Clin Immunol Pract. 2021 Apr;9(4):1488-1500. PMID 33321263.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33321263/
- Source checked on: 2026-09-23
- Locator: PMID 33321263; adult sleep-disturbance prevalence band and mechanisms
- Note under review: Review: sleep disturbances affect 33%-90% of adults with atopic dermatitis; nocturnal pruritus and the complex AD pathophysiology underlie sleep disruption; most evidence uses subjective measures.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `dermatitis` → `anxiety-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The burden systematic review names anxiety among the most frequently reported humanistic burden parameters in adult AD (Fasseeh 2022); the US population survey found more frequent/severe sleep disturbance associated with higher HADS-anxiety scores and mediated the AD-to-diagnosed-anxiety association (Silverberg 2022).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: cross-sectional anchors only; reverse direction (anxiety amplifies itch and scratching) is documented; the mediation does not establish order; and the flare-dependent character of the burden means stable-disease periods are uncharacterized.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 81.1 — Silverberg JI, Chiesa-Fuxench Z, Margolis D, et al. Epidemiology and Burden of Sleep Disturbances in Atopic Dermatitis in US Adults. Dermatitis. 2022 Nov-Dec;33(6S):S104-S113. PMID 33675326.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33675326/
- Source checked on: 2026-09-23
- Locator: PMID 33675326; sleep-disturbance prevalence and HADS mediation analysis
- Note under review: US population-based cross-sectional survey (n=2,893): 40.7% of adults meeting UK criteria for AD reported 1+ nights of sleep disturbance in the past week; more severe sleep disturbance was associated with higher HADS anxiety/depression scores, and sleep-disturbance severity mediated the AD-to-anxiety/depression associations.
- Current state: `verified: false` — pending qualified-human decision

**Row 81.2 — Fasseeh AN, Elezbawy B, Korra N, et al. Burden of Atopic Dermatitis in Adults and Adolescents: a Systematic Literature Review. Dermatol Ther (Heidelb). 2022 Dec;12(12):2653-2668. PMID 36197589.**

- URL: https://pubmed.ncbi.nlm.nih.gov/36197589/
- Source checked on: 2026-09-23
- Locator: PMID 36197589; depression/anxiety as top-ranked humanistic burden parameters
- Note under review: Systematic review (233 studies): itch, depression, sleep disturbance, and anxiety were the most frequently reported clinical and humanistic burden parameters in adult AD; magnitude scales with severity.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `delayed-ejaculation` → `depressive-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The claims-data-mining cohort (n=11,602) found anxiety, antidepressant use, and psychoses positively associated with DE versus other male sexual disorders (Mulloy 2023); the nationwide survey (n=5,331) found low partnership satisfaction (OR 2.27) and ED (OR 2.04) associated with DE, with psychotropic use the strongest associate (OR 2.41) (Shirai 2025); the clinical review frames DE as a disorder causing significant sexual dissatisfaction and personal distress (Jenkins 2015).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the associations are cross-sectional or data-mining products with unknown directionality; the reverse direction is pharmacologically dominant (depression itself, and SSRIs/SNRIs/antipsychotics used to treat it, are established causes of delayed ejaculation); partnership dissatisfaction is bidirectional; and no cohort measures incident depressive disorder after DE onset. Attribution requires excluding medication-induced DE before any distress pathway is credited.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 82.1 — Mulloy E, Zhang A, Balladelli F, Del Giudice F, Glover F, Eisenberg ML. Diagnoses and medications associated with delayed ejaculation. Sex Med. 2023;11(4):qfad040. PMID 37547871.**

- URL: https://pubmed.ncbi.nlm.nih.gov/37547871/
- Source checked on: 2026-09-23
- Locator: PMID 37547871; anxiety and antidepressant associations with DE
- Note under review: Insurance-claims data-mining cohort (n=11,602 men with DE matched to ED/PD controls): anxiety, antidepressant use, psychoses, male infertility, and testicular dysfunction showed positive associations with DE; directionality is unknown by design.
- Current state: `verified: false` — pending qualified-human decision

**Row 82.2 — Shirai M, Tsujimura A, Fukuhara S, et al. Prevalence and associated factors of delayed ejaculation: insights from a nationwide internet-based, cross-sectional survey on male sexual dysfunction in Japan. Sex Med. 2025;13(4):qfaf072. PMID 40937118.**

- URL: https://pubmed.ncbi.nlm.nih.gov/40937118/
- Source checked on: 2026-09-23
- Locator: PMID 40937118; multivariate ORs including psychotropic confound
- Note under review: Nationwide cross-sectional survey (n=5,331 sexually active men): DE prevalence 5.16%; erectile dysfunction (OR 2.04), psychotropic drug use (OR 2.41), neurological diseases (OR 2.02), and low partnership satisfaction (OR 2.27) associated with DE; psychotropics are a major confound because they treat mood disorders and also delay ejaculation.
- Current state: `verified: false` — pending qualified-human decision

**Row 82.3 — Jenkins LC, Mulhall JP. Delayed orgasm and anorgasmia. Fertil Steril. 2015 Nov;104(5):1082-8. PMID 26439762.**

- URL: https://pubmed.ncbi.nlm.nih.gov/26439762/
- Source checked on: 2026-09-23
- Locator: PMID 26439762; distress framing and multifactorial etiologies
- Note under review: Review: delayed orgasm/anorgasmia causes significant sexual dissatisfaction and personal distress; etiologies include medications, endocrinopathies, sensation loss, and psychological factors - framing the distress pathway without asserting causation to mood disorders.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `dental-abrasion-erosion-abfraction` → `dentin-hypersensitivity` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The cross-sectional cohort (n=157) found NCCL associated with dentin hypersensitivity at both single-tooth and multi-tooth thresholds, with DH prevalence 84.7% and NCCL prevalence 49.7% in young adults (Zimmer 2025); the periodontal classification review records root-surface exposure as frequently associated with DH and NCCLs (Cortellini 2018); the SEM study names NCCLs a predominant factor leading to dentin exposure and hypersensitivity while stressing multifactorial etiology (Sakkaria 2023).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the hard-tissue-loss-to-exposed-tubule pathway is the standard hydrodynamic substrate, but DH expression varies with tubule patency, dentin sclerosis, and individual behaviors; the same cohort shows independent DH drivers (whitening toothpaste, immediate post-meal brushing, anxiety) that produce symptoms without the lesion identity; and no longitudinal cohort measures incident DH after NCCL onset.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 83.1 — Zimmer R, Barbosa GF, Portella FF, Soares PV, Reston EG. Association between non-carious cervical lesions, dentin hypersensitivity and anxiety in young adults: A cross-sectional study. J Dent. 2025;153:105563. PMID 39793751.**

- URL: https://pubmed.ncbi.nlm.nih.gov/39793751/
- Source checked on: 2026-09-23
- Locator: PMID 39793751; NCCL-DH co-occurrence and independent habit factors
- Note under review: Cross-sectional cohort (n=157, ages 18-45): DH prevalence 84.7%, NCCL prevalence 49.7%; NCCL was associated with DH at both the one-tooth and more-than-four-teeth thresholds; whitening toothpaste and post-meal brushing also independently associated with DH.
- Current state: `verified: false` — pending qualified-human decision

**Row 83.2 — Cortellini P, Bissada NF. Mucogingival conditions in the natural dentition: Narrative review, case definitions, and diagnostic considerations. J Periodontol. 2018;89 Suppl 1:S204-S213. PMID 29926948.**

- URL: https://pubmed.ncbi.nlm.nih.gov/29926948/
- Source checked on: 2026-09-23
- Locator: PMID 29926948; recession-NCCL-DH triad in the mucogingival classification
- Note under review: Classification review: root-surface exposure from gingival recession is frequently associated with dentinal hypersensitivity and with carious and non-carious cervical lesions; the modern classification records DH presence alongside recession severity and NCCLs.
- Current state: `verified: false` — pending qualified-human decision

**Row 83.3 — Sakkaria A, Ramadoss R, Krishnasamy N, Sundar S, Panneerselvam S, Ramani P. Assessment of Nanoscale Configuration of Dentin in Non-carious Cervical Lesions. Cureus. 2023;15(10):e48003. PMID 38034251.**

- URL: https://pubmed.ncbi.nlm.nih.gov/38034251/
- Source checked on: 2026-09-23
- Locator: PMID 38034251; multifactorial etiology and dentin-exposure pathway
- Note under review: SEM/EDS study: NCCLs are multifactorial (abrasive toothbrushing, occlusal tension, acidic erosion); the authors state NCCLs can be attributed as a predominant factor leading to gingival recession, dentin exposure, and hypersensitivity, while emphasizing the multifactorial etiology.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `dermatomyositis` → `interstitial-lung-disease` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The IIM cohort (n=91) found interstitial lung disease in 43.8% of clinically amyopathic DM versus 15.9% of classic DM, and ILD was the strongest mortality predictor overall (HR 3.57) (Fornaro 2024); the 69-study IIM meta-analysis documents ILD as an established clinical factor with inverse paraneoplastic weighting (RR 0.49 for cancer) (Oldroyd 2021); the 546-patient DM cancer-prediction model explicitly scores ILD as an inverse cancer-likelihood factor (Ye 2026).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: ILD in dermatomyositis is subtype-stratified (amyopathic DM, anti-MDA5, anti-synthetase phenotypes) with prevalence spanning roughly 16%-44% across subtypes; the autoimmune-lung pathway is the accepted biology but no cohort quantifies incident ILD attributable to DM within the heterogeneous population; and malignancy workup is standard in DM, so competing paraneoplastic or drug-induced lung injury must be excluded before any individual attribution.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 84.1 — Fornaro M, Girolamo F, Giannini M, et al. Clinical, histologic and prognostic features of clinically amyopathic dermatomyositis. Clin Exp Rheumatol. 2024;42(2):288-294. PMID 38488091.**

- URL: https://pubmed.ncbi.nlm.nih.gov/38488091/
- Source checked on: 2026-09-23
- Locator: PMID 38488091; ILD prevalence by DM subtype and mortality prediction
- Note under review: Retrospective cohort (n=91 IIM): interstitial lung disease in 43.8% of clinically amyopathic DM vs 15.9% of classic DM; ILD was the strongest mortality predictor in the overall cohort (HR 3.57, CI 1.11-11.5), alongside cancer.
- Current state: `verified: false` — pending qualified-human decision

**Row 84.2 — Oldroyd AGS, Allard AB, Callen JP, et al. A systematic review and meta-analysis to inform cancer screening guidelines in idiopathic inflammatory myopathies. Rheumatology (Oxford). 2021;60(6):2615-2628. PMID 33599244.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33599244/
- Source checked on: 2026-09-23
- Locator: PMID 33599244; dysphagia and ILD as IIM clinical factors with paraneoplastic weighting
- Note under review: Systematic review and meta-analysis (69 studies): in IIM, dysphagia was associated with significantly increased cancer risk (RR 2.09); interstitial lung disease was associated with reduced cancer risk (RR 0.49) - documenting both as established IIM clinical factors with opposing paraneoplastic significance.
- Current state: `verified: false` — pending qualified-human decision

**Row 84.3 — Ye J, Wu W, Wu H, et al. A Novel Tool for Predicting Malignant Disease in Adult Patients With Dermatomyositis. JAMA Dermatol. 2026;162(2):176-180. PMID 41335433.**

- URL: https://pubmed.ncbi.nlm.nih.gov/41335433/
- Source checked on: 2026-09-23
- Locator: PMID 41335433; ILD's inverse weighting in the DM cancer-prediction model
- Note under review: Multicenter retrospective cohort (n=546): the TIP-CA prediction model includes interstitial lung disease (present scored -1) and anti-TIF1-gamma antibody as cancer-associated-likelihood factors in adult DM, reflecting the established cross-phenotype structure of the disease.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `dermatomyositis` → `dysphagia` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The IIM systematic review and meta-analysis (69 studies) documents dysphagia as an established clinical factor of the disease, associated with increased cancer risk (RR 2.09) in the paraneoplastic direction (Oldroyd 2021); the therapeutic-rationale review lists dysphagia among the core clinical features of DM (Paik 2025); the dedicated prognosis report confirms pharyngeal/upper-esophageal involvement as a clinically tracked manifestation (Ogawa-Momohara 2019).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: inflammatory involvement of striated pharyngeal and upper-esophageal muscle is the accepted biology, but no cohort quantifies incident dysphagia in the general DM population; dysphagia marks the severe myositis phenotype and simultaneously flags malignancy-associated myositis; glucocorticoid myopathy and cricopharyngeal dysfunction are competing mechanisms producing the same symptom.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 85.1 — Oldroyd AGS, Allard AB, Callen JP, et al. A systematic review and meta-analysis to inform cancer screening guidelines in idiopathic inflammatory myopathies. Rheumatology (Oxford). 2021;60(6):2615-2628. PMID 33599244.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33599244/
- Source checked on: 2026-09-23
- Locator: PMID 33599244; dysphagia and ILD as IIM clinical factors with paraneoplastic weighting
- Note under review: Systematic review and meta-analysis (69 studies): in IIM, dysphagia was associated with significantly increased cancer risk (RR 2.09); interstitial lung disease was associated with reduced cancer risk (RR 0.49) - documenting both as established IIM clinical factors with opposing paraneoplastic significance.
- Current state: `verified: false` — pending qualified-human decision

**Row 85.2 — Paik JJ, Vencovsky J, Charles-Schoeman C, et al. Brepocitinib, a potent and selective TYK2/JAK1 inhibitor: scientific and clinical rationale for dermatomyositis. Clin Exp Rheumatol. 2025;43(2):354-363. PMID 39008325.**

- URL: https://pubmed.ncbi.nlm.nih.gov/39008325/
- Source checked on: 2026-09-23
- Locator: PMID 39008325; dysphagia listed among core DM clinical features
- Note under review: Therapeutic rationale review: dermatomyositis is a systemic autoimmune disease characterised by skin and muscle disease that may include dysphagia among its associated clinical features.
- Current state: `verified: false` — pending qualified-human decision

**Row 85.3 — Ogawa-Momohara M, Muro Y, Kono M, Akiyama M. Prognosis of dysphagia in dermatomyositis. Clin Exp Rheumatol. 2019;37(1):165. PMID 30557132.**

- URL: https://pubmed.ncbi.nlm.nih.gov/30557132/
- Source checked on: 2026-09-23
- Locator: PMID 30557132; dysphagia prognosis in DM
- Note under review: Dedicated prognosis report on dysphagia in dermatomyositis, confirming pharyngeal/upper-esophageal involvement as a recognized and clinically tracked manifestation of the disease.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `deviated-nasal-septum` → `sinusitis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The cross-sectional CT-referral cohort (n=676) found patients with deviated nasal septum approximately three times more likely to have sinusitis (OR 2.74, CI 1.86-4.04) (Alsaggaf 2022); the 28-study global meta-analysis lists septal deviation among comorbid conditions with greater chronic-rhinosinusitis prevalence (Min 2025); the prevention review names septal deviation among sinonasal risk factors for recurrent sinusitis (Duse 2007).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the ostiomeatal-obstruction pathway is standard anatomy-to-infection biology, but the quantified anchor is a CT-referral population with ascertainment bias (both CT referral and sinus findings concentrate in symptomatic patients); deviation is one of several comorbidities in the meta-analysis rather than an isolated driver; and recurrent-sinusitis etiology is multifactorial (infection, allergy, smoke, immune status) in the same sources.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 86.1 — Alsaggaf ZH, Almadfaa AO, Marouf AA, Alfawaz KS, Niyazi RA, Ibrahim NK, Ajlan AM. Sinusitis and its association with deviated nasal septum at a tertiary hospital: A retrospective study. J Taibah Univ Med Sci. 2022;17(6):1065-1069. PMID 36212586.**

- URL: https://pubmed.ncbi.nlm.nih.gov/36212586/
- Source checked on: 2026-09-23
- Locator: PMID 36212586; DNS-sinusitis association in a CT-referral cohort
- Note under review: Cross-sectional CT-referral cohort (n=676): sinusitis present in 47.5%; patients with deviated nasal septum were approximately three times more likely to have sinusitis (OR 2.74, CI 1.86-4.04); 75.1% of the sample had DNS - a referred-population ascertainment guard.
- Current state: `verified: false` — pending qualified-human decision

**Row 86.2 — Min HK, Lee S, Kim S, et al. Global Incidence and Prevalence of Chronic Rhinosinusitis: A Systematic Review. Clin Exp Allergy. 2025;55(1):52-66. PMID 39506931.**

- URL: https://pubmed.ncbi.nlm.nih.gov/39506931/
- Source checked on: 2026-09-23
- Locator: PMID 39506931; septal deviation among CRS comorbidities
- Note under review: Systematic review and meta-analysis (28 studies, 237 million participants): pooled chronic-rhinosinusitis prevalence 8.71%; nasal septal deviation was among the comorbid conditions with greater CRS prevalence.
- Current state: `verified: false` — pending qualified-human decision

**Row 86.3 — Duse M, Caminiti S, Zicari AM. Rhinosinusitis: prevention strategies. Pediatr Allergy Immunol. 2007;18 Suppl 18:71-4. PMID 17767614.**

- URL: https://pubmed.ncbi.nlm.nih.gov/17767614/
- Source checked on: 2026-09-23
- Locator: PMID 17767614; septal deviation as a recurrent-sinusitis risk factor
- Note under review: Prevention review: sinonasal abnormalities including septal deviation are risk factors for recurrent sinusitis alongside infection, adenoid bacterial load, and smoke exposure; prevention requires treating the associated conditions.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `deviated-nasal-septum` → `sleep-apnea` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The polysomnography-confirmed cohort (n=60) found isolated septal deviation significantly associated with the occurrence and severity of obstructive sleep apnea, with combined nasal pathologies carrying proportionately more OSA (Shankameswaran 2024); the narrative review lists OSA among the clinical presentations of clinically significant deviation (Alghamdi 2022); the prospective sleep-surgery cohort documents craniofacial development as a shared upstream driver linking maxillary deficiency to both deviation and OSA anatomy (Hutz 2024).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: nasal-obstruction contribution to OSA is mechanistically plausible (increased upper-airway resistance, mouth breathing, suction-collapse) but nasal obstruction is a minor contributor in most OSA phenotypes; the PSG cohort is small (n=60); the shared craniofacial substrate (Hutz 2024) means deviation and OSA can co-develop without one causing the other; and septoplasty trials show incomplete OSA response, confirming deviation is not a sufficient cause.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 87.1 — Shankameswaran B, Viveknarayan G, Gowrishankar M, Suresh V. Prevalence of Obstructive Sleep Apnoea in patients with primary nasal and nasopharyngeal pathologies. Indian J Otolaryngol Head Neck Surg. 2024;76(5):3914-3921. PMID 39376455.**

- URL: https://pubmed.ncbi.nlm.nih.gov/39376455/
- Source checked on: 2026-09-23
- Locator: PMID 39376455; PSG-confirmed OSA occurrence and severity in septal deviation
- Note under review: Polysomnography-confirmed cohort (n=60): isolated septal deviation, nasal polyps, and adenoid hypertrophy each showed statistically significant association with the occurrence and severity of obstructive sleep apnea; combined pathologies affected OSA proportionately more than isolated ones.
- Current state: `verified: false` — pending qualified-human decision

**Row 87.2 — Alghamdi FS, Albogami D, Alsurayhi AS, et al. Nasal Septal Deviation: A Comprehensive Narrative Review. Cureus. 2022;14(11):e31317. PMID 36514566.**

- URL: https://pubmed.ncbi.nlm.nih.gov/36514566/
- Source checked on: 2026-09-23
- Locator: PMID 36514566; normal-variant spectrum and OSA/rhinosinusitis presentation
- Note under review: Narrative review: asymptomatic minor deviation is a normal developmental variant in the majority of the population; clinically significant deviation can obstruct nasal airflow and is associated with rhinosinusitis and obstructive sleep apnea among its presentations - the minor-variant guard for any deviated-septum claim.
- Current state: `verified: false` — pending qualified-human decision

**Row 87.3 — Hutz MJ, Thuler E, Cheong C, et al. The Association Between Transverse Maxillary Deficiency and Septal Deviation in Adults with Obstructive Sleep Apnea. Laryngoscope. 2024;134(5):2464-2470. PMID 37905744.**

- URL: https://pubmed.ncbi.nlm.nih.gov/37905744/
- Source checked on: 2026-09-23
- Locator: PMID 37905744; craniofacial shared-driver confound for the DNS-OSA association
- Note under review: Prospective CT cohort of sleep-surgery patients (n=93): transverse maxillary deficiency is moderately associated with greater septal deviation, supporting craniofacial development as a shared upstream driver of both the deviation and the sleep-apnea anatomy - the shared-substrate (reverse/confound) guard.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `diabetes-insipidus` → `hydronephrosis` — DIRECT_CAUSATION

**Proposition (direct_causation):** Documented clinically significant diabetes insipidus with sustained polyuria (inadequately controlled or untreated) -> chronic high-volume, low-osmolality urine output -> bladder and ureteral distension beyond baseline capacity with elevated post-void residuals -> retrograde pressure transmission -> upper urinary tract dilatation (hydronephrosis/hydroureter).

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 88.1 — Knoers N, Lemmink H. Hereditary Nephrogenic Diabetes Insipidus. GeneReviews. University of Washington, Seattle; 2000 Feb 12 [updated 2020 Feb 27]. PMID 20301356.**

- URL: https://pubmed.ncbi.nlm.nih.gov/20301356/
- Source checked on: 2026-09-23
- Locator: PMID 20301356; urinary-tract dilatation from polyuria with surveillance guidance
- Note under review: GeneReviews: inability to concentrate urine produces polyuria; short stature and secondary dilatation of the ureters and bladder from the high urine volume are common in untreated individuals; annual kidney ultrasound surveillance for hydronephrosis and megacystis is recommended; reducing urine production and scheduled voiding may prevent or reduce serious renal, ureteral, or bladder dilatation.
- Current state: `verified: false` — pending qualified-human decision

**Row 88.2 — Wang X, Ying X, Zhang F, Li X, Chen G, Zhou Z, Liao L. Upper urinary dilatation and treatment of 26 patients with diabetes insipidus: A single-center retrospective study. Front Endocrinol (Lausanne). 2022;13:941453. PMID 35937824.**

- URL: https://pubmed.ncbi.nlm.nih.gov/35937824/
- Source checked on: 2026-09-23
- Locator: PMID 35937824; upper urinary tract dilatation phenotype and management in DI
- Note under review: Retrospective cohort (n=26 DI patients with upper urinary tract dilatation): video-urodynamics showed mean bladder capacity 575 mL with compliance 51.5 cmH2O and post-void residual >100 mL in 42.3%; neurogenic bladder was present in 23.1%; bladder distension, trabeculation, and decreased/absent sensations were common features; treatment improved dilatation grades and renal function.
- Current state: `verified: false` — pending qualified-human decision

**Row 88.3 — Duicu C, Pitea AM, Sasaran OM, Cozea I, Man L, Banescu C. Nephrogenic diabetes insipidus in children (Review). Exp Ther Med. 2021;22(1):746. PMID 34055061.**

- URL: https://pubmed.ncbi.nlm.nih.gov/34055061/
- Source checked on: 2026-09-23
- Locator: PMID 34055061; untreated NDI urological complication spectrum
- Note under review: Pediatric NDI review: without treatment most patients present with urological complications including megacystis, trabeculated bladder, hydroureter, and hydronephrosis; treatment combines sufficient water intake, low-sodium diet, and thiazide diuretics to reduce urine output.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `diaphragm-paralysis` → `sleep-apnea` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The instrumented PSG cohort found a REM respiratory disturbance index of 26.0 events/h in hemidiaphragm paralysis or severe weakness versus 0.7 in matched controls, with diaphragm EMG drive doubled and rising further in REM (Steier 2008); the Mayo referral cohort found significant sleep-disordered breathing (mean AHI 26.6) in all 66 patients with isolated diaphragmatic dysfunction, with CPAP controlling SDB in only 37.9% (Khan 2014); the perioperative review documents phrenic-nerve-output inhibition causing diaphragmatic dysfunction with post-surgical sleep-disordered breathing (Rock 2003).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the ventilatory-pump pathway is quantitatively anchored but both cohorts are sleep-laboratory-referred populations; the SDB phenotype is REM-related hypoventilation rather than the obstructive phenotype that dominates the target identity; no incident cohort tracks progression from stable dysfunction to diagnosed sleep-apnea; and obesity-related obstructive disease operates independently in the same patients.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 89.1 — Steier J, Jolley CJ, Seymour J, Kaul S, Luo YM, Rafferty GF, Hart N, Polkey MI, Moxham J. Sleep-disordered breathing in unilateral diaphragm paralysis or severe weakness. Eur Respir J. 2008;32(6):1479-87. PMID 18684853.**

- URL: https://pubmed.ncbi.nlm.nih.gov/18684853/
- Source checked on: 2026-09-23
- Locator: PMID 18684853; REM-dominant SDB quantification in hemidiaphragm paralysis
- Note under review: Instrumented PSG cohort (n=11 hemidiaphragm paralysis/severe weakness vs 11 matched controls): respiratory disturbance index 8.1 events/h in NREM and 26.0 events/h in REM sleep versus 0.4 and 0.7 in controls; diaphragm EMG drive doubled and increased further in REM; unilateral diaphragm dysfunction puts patients at risk of REM sleep-disordered breathing.
- Current state: `verified: false` — pending qualified-human decision

**Row 89.2 — Khan A, Morgenthaler TI, Ramar K. Sleep disordered breathing in isolated unilateral and bilateral diaphragmatic dysfunction. J Clin Sleep Med. 2014;10(5):509-15. PMID 24910552.**

- URL: https://pubmed.ncbi.nlm.nih.gov/24910552/
- Source checked on: 2026-09-23
- Locator: PMID 24910552; AHI in isolated diaphragmatic dysfunction and CPAP failure
- Note under review: Retrospective Mayo cohort (n=66 referred for PSG): all patients with isolated diaphragmatic dysfunction had significant sleep-disordered breathing (mean AHI 26.6); CPAP controlled SDB in only 37.9%, with bilateral dysfunction 6.8 times more likely to fail CPAP - referred-population ascertainment and PAP-modality guards recorded.
- Current state: `verified: false` — pending qualified-human decision

**Row 89.3 — Rock P, Rich PB. Postoperative pulmonary complications. Curr Opin Anaesthesiol. 2003;16(2):123-31. PMID 17021450.**

- URL: https://pubmed.ncbi.nlm.nih.gov/17021450/
- Source checked on: 2026-09-23
- Locator: PMID 17021450; phrenic-inhibition diaphragmatic dysfunction and post-surgical SDB context
- Note under review: Perioperative review: inhibition of phrenic nerve output produces postoperative diaphragmatic dysfunction, and sleep-disordered breathing occurs after surgery even in patients without obstructive sleep apnea - supporting the ventilatory-pump pathway and the post-surgical context of acquired diaphragm dysfunction.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `diffuse-axonal-injury` → `cognitive-disorder` — DIRECT_CAUSATION

**Proposition (direct_causation):** Documented diffuse axonal injury (grade I-III or MRI/DTI-confirmed axonal shearing) -> widespread disruption of cerebral connectivity across corpus callosum, parasagittal white matter, and brainstem -> neuropsychologically confirmed cognitive deficits (processing speed, memory, attention, executive function) persisting beyond the spontaneous-recovery window.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 90.1 — Azouvi P, Arnould A, Dromer E, Vallat-Azouvi C. Neuropsychology of traumatic brain injury: An expert overview. Rev Neurol (Paris). 2017;173(7-8):461-472. PMID 28847474.**

- URL: https://pubmed.ncbi.nlm.nih.gov/28847474/
- Source checked on: 2026-09-23
- Locator: PMID 28847474; cognitive deficits attributed to diffuse axonal injury
- Note under review: Expert overview: patients who survive moderate-to-severe TBI frequently suffer a wide range of cognitive deficits and behavioral changes due to diffuse axonal injury - slowed information processing, impaired long-term memory, attention, working memory, executive function, social cognition, and self-awareness; mental fatigue frequently exacerbates the deficits.
- Current state: `verified: false` — pending qualified-human decision

**Row 90.2 — Su E, Bell M. Diffuse Axonal Injury. In: Translational Research in Traumatic Brain Injury. CRC Press/Taylor and Francis; 2016. PMID 26583181.**

- URL: https://pubmed.ncbi.nlm.nih.gov/26583181/
- Source checked on: 2026-09-23
- Locator: PMID 26583181; connectivity-disruption mechanism and 40-50% admission share
- Note under review: DAI review chapter: widespread axonal damage produces deficits in cerebral connectivity that may or may not recover; DAI is a component of injury in 40%-50% of TBI hospital admissions, commonly affecting brainstem, parasagittal white matter, and corpus callosum, and is increasingly recognized as an important cause of long-term disability.
- Current state: `verified: false` — pending qualified-human decision

**Row 90.3 — Pavlovic D, Pekic S, Stojanovic M, Popovic V. Traumatic brain injury: neuropathological, neurocognitive and neurobehavioral sequelae. Pituitary. 2019;22(3):270-282. PMID 30929221.**

- URL: https://pubmed.ncbi.nlm.nih.gov/30929221/
- Source checked on: 2026-09-23
- Locator: PMID 30929221; advanced-imaging characterization and hypopituitarism competing cause
- Note under review: Sequelae review: DAI is visible only with advanced neuroimaging (DTI for white-matter pathology, SWI for microbleeds); chronic TBI patients have lower neuropsychological scores and higher mental-distress symptoms; TBI-related hypopituitarism overlaps with and can mimic cognitive disability - recorded as a competing cause requiring endocrine evaluation.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `diffuse-esophageal-spasm` → `gerd` — ASSOCIATION_ONLY

**Proposition (associationBasis):** Retrospective manometry cohort of 69 distal-esophageal-spasm (DES) patients: 32 (46.3%) had objective GERD defined by Los Angeles Grade B/C/D esophagitis, Barrett's metaplasia, or abnormal pH testing (Seltzer 2024); the DES pathophysiology review notes the interaction between DES and GERD and recommends 24-hour pH monitoring during evaluation (Roman & Kahrilas 2012); non-cardiac-chest-pain reviews attribute 15-18% of NCCP to hypercontractile motility disorders including DES alongside GERD's 50-60% share (Frieling 2018).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the same cohort found no distinguishing clinical or physiologic phenotype between DES patients with and without GERD, with the authors explicitly challenging the historical emphasis of GERD in DES pathogenesis and leaving the impact of GERD management on DES natural history uncertain (Seltzer 2024); the direction can run either way (reflux-induced spasm versus spasm-impaired acid clearance promoting reflux), and shared dysmotility susceptibility remains a competing explanation.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 91.1 — Seltzer ES, Sehmbhi M, Sandhu R, Cavaliere K, Luo Y, Smith MS, Jodorkovsky D. Distal esophageal spasm and gastroesophageal reflux disease: re-examining the association. Dis Esophagus. 2024;37(11):doae077. PMID 39341683.**

- URL: https://pubmed.ncbi.nlm.nih.gov/39341683/
- Source checked on: 2026-09-23
- Locator: PMID 39341683; DES-GERD co-occurrence without distinct phenotype
- Note under review: Retrospective HRM cohort (n=69): 46.3% of DES patients had objective GERD, but R-DES and NR-DES shared similar symptom profiles and HRM metrics apart from basal LES tone/IRP; authors conclude the data challenge the historical emphasis of GERD in DES pathogenesis.
- Current state: `verified: false` — pending qualified-human decision

**Row 91.2 — Roman S, Kahrilas PJ. Distal esophageal spasm. Dysphagia. 2012;27(1):115-23. PMID 22215281.**

- URL: https://pubmed.ncbi.nlm.nih.gov/22215281/
- Source checked on: 2026-09-23
- Locator: PMID 22215281; DES-GERD interaction and pH-monitoring recommendation
- Note under review: Pathophysiology review: DES implies impairment of esophageal inhibitory neural function; premature contractions with normal EGJ relaxation define DES; because of the interaction between DES and GERD, 24-hour pH monitoring should be considered during evaluation.
- Current state: `verified: false` — pending qualified-human decision

**Row 91.3 — Frieling T. Non-cardiac chest pain. Visc Med. 2018;34(2):92-96. PMID 29888236.**

- URL: https://pubmed.ncbi.nlm.nih.gov/29888236/
- Source checked on: 2026-09-23
- Locator: PMID 29888236; DES and GERD shares of non-cardiac chest pain
- Note under review: NCCP review: GERD causes 50-60% of non-cardiac chest pain and hypercontractile motility disorders including diffuse esophageal spasm 15-18%; the two populations overlap in the same symptomatic patients.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `diverticulosis` → `diverticulitis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The JAMA 2025 diverticulitis review states approximately 1-4% of patients with diverticulosis will develop acute diverticulitis in their lifetime, with incidence approximately 180 per 100,000 people annually (Brown 2025); the surgical update estimates lifetime risk of 10-25% with more recent studies at approximately 5% progression (Hawkins 2020); the pathophysiology review reports around 5% of patients with diverticula experiencing an acute episode while most remain asymptomatic (Piscopo & Ellul 2020).

**Causation boundary (causationStatus):** The inflammatory transition is the defining complication of the same anatomic disease process rather than an independent secondary condition; because only a minority of diverticulosis carriers (estimates spanning 1-4% to 5-25% depending on cohort and case definition) ever develop clinically evident diverticulitis, the mapping cannot assert individual-level causation - most diverticula never become inflamed. Graded ASSOCIATION_ONLY to preserve the distinction between the anatomic finding and the inflammatory complication, following the repository's Barrett's-to-esophageal-cancer precedent for defining-progressions.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 92.1 — Brown RF, Lopez K, Smith CB, Charles A. Diverticulitis: A Review. JAMA. 2025 Jul 24. doi:10.1001/jama.2025.10234. PMID 40705318.**

- URL: https://pubmed.ncbi.nlm.nih.gov/40705318/
- Source checked on: 2026-09-23
- Locator: PMID 40705318; diverticulosis-to-diverticulitis lifetime progression 1-4%
- Note under review: JAMA review: approximately 1-4% of patients with diverticulosis develop acute diverticulitis in their lifetime; US incidence approximately 180 per 100,000 annually with ~200,000 hospital admissions; CT sensitivity 98-99% and specificity 99-100%.
- Current state: `verified: false` — pending qualified-human decision

**Row 92.2 — Hawkins AT, Wise PE, Chan T, et al. Diverticulitis: An Update From the Age Old Paradigm. Curr Probl Surg. 2020;57(10):100862. PMID 33077029.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33077029/
- Source checked on: 2026-09-23
- Locator: PMID 33077029; progression estimates and unknown transition mechanism
- Note under review: Surgical update: over 50% of people over 60 and over 60% over 80 have colonic diverticula; lifetime risk of developing diverticulitis estimated at 10-25% although more recent studies estimate a 5% rate of progression; the exact mechanism leading from diverticulosis to diverticulitis is not definitively known.
- Current state: `verified: false` — pending qualified-human decision

**Row 92.3 — Piscopo N, Ellul P. Diverticular Disease: A Review on Pathophysiology and Recent Evidence. Ulster Med J. 2020;89(2):83-88. PMID 33093692.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33093692/
- Source checked on: 2026-09-23
- Locator: PMID 33093692; fecolith/ischemia transition mechanisms
- Note under review: Pathophysiology review: around 5% of patients with diverticula experience an episode of acute diverticulitis; fecolith entrapment produces mucosal damage, bacterial proliferation and toxin accumulation leading to perforation; an ischemic mechanism is proposed for younger patients with sparse diverticula.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `diverticulitis` → `irritable-bowel-syndrome` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The IBS-diverticular-disease re-examination review states there is now epidemiological and pathophysiological evidence supporting de novo IBS development after an episode of acute diverticulitis, analogous to post-infection IBS after enteric illness (Alamo & Quigley 2019); the SUDD practical-guidance review characterizes the persistent post-episode symptom burden - chronic left-lower-quadrant pain with bowel-movement changes and low-grade inflammation impairing quality of life (Calini 2023); the management review notes potential similarities and overlap between diverticulitis and irritable-bowel-syndrome symptom complexes (Hanna & Kaiser 2021).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: post-diverticulitis IBS has epidemiological and pathophysiological support but no quantified incidence denominator in a general-population cohort; symptomatic uncomplicated diverticular disease (SUDD) and IBS remain diagnostically overlapping constructs sharing low-grade inflammation and visceral-hypersensitivity physiology, so persistent post-episode symptoms may represent SUDD rather than de novo IBS; Rome IV criteria require symptom documentation independent of the diverticular episode.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 93.1 — Alamo RZ, Quigley EMM. Irritable bowel syndrome and colonic diverticular disease: overlapping symptoms and overlapping therapeutic approaches. Curr Opin Gastroenterol. 2019;35(1):27-33. PMID 30407258.**

- URL: https://pubmed.ncbi.nlm.nih.gov/30407258/
- Source checked on: 2026-09-23
- Locator: PMID 30407258; post-diverticulitis de novo IBS evidence
- Note under review: Re-examination review: epidemiological and pathophysiological evidence now supports de novo IBS development after an episode of acute diverticulitis, analogous to post-infection IBS; SUDD and IBS relationships remain debated with SUDD possibly distinguished by more frequent and severe pain.
- Current state: `verified: false` — pending qualified-human decision

**Row 93.2 — Calini G, Abd El Aziz MA, Paolini L, et al. Symptomatic Uncomplicated Diverticular Disease (SUDD): Practical Guidance and Challenges for Clinical Management. Clin Exp Gastroenterol. 2023;16:29-43. PMID 37013200.**

- URL: https://pubmed.ncbi.nlm.nih.gov/37013200/
- Source checked on: 2026-09-23
- Locator: PMID 37013200; SUDD symptom burden and shared physiology
- Note under review: SUDD guidance: chronic condition impairing quality of life with persistent left-lower-quadrant pain, bowel-movement changes and low-grade inflammation (elevated calprotectin) without systemic inflammation; pathogenesis involves microbiota alterations, neuro-immune enteric interactions and muscular dysfunction.
- Current state: `verified: false` — pending qualified-human decision

**Row 93.3 — Hanna MH, Kaiser AM. Update on the management of sigmoid diverticulitis. World J Gastroenterol. 2021;27(9):760-781. PMID 33727769.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33727769/
- Source checked on: 2026-09-23
- Locator: PMID 33727769; diverticulitis-IBS symptom overlap
- Note under review: Management review: potential similarities and overlap between diverticulitis, inflammatory bowel disease and irritable bowel syndrome exist; persistent or recurrent symptoms after episodes are recognized and influence surgical decision-making.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `dizziness` → `anxiety-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** Tertiary neuro-otology cohort of 1,552 consecutive vertigo patients: chronic subjective dizziness diagnosed in 164 patients (10.6%), with psychiatric disorder - mainly anxiety - found in 79.3% of cases and anxiety described as a strong predisposing factor (Odman & Maire 2008); Barany-criteria PPPD cohort (n=75): psychiatric comorbidity present in 88%, most commonly combined anxiety and depression (Kothari 2026); neuro-otology review: psychiatric comorbidity rates near 50% in structural vestibular syndromes with the highest rates in vestibular migraine and Meniere's disease, and anxiety-related postural-strategy change as a proposed mechanism (Dieterich & Staab 2017).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the comorbidity is quantified in referred tertiary populations with ascertainment bias; anxiety is documented as a predisposing factor for chronic dizziness, demonstrating bidirectionality (anxiety can precede and follow vestibular symptoms); the PPPD construct itself involves anxiety as the bridge between acute vestibular events and chronic dizziness; shared vestibular-limbic pathways are hypothesized, not validated as one-direction causation.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 94.1 — Odman M, Maire R. Chronic subjective dizziness. Acta Otolaryngol. 2008;128(10):1085-8. PMID 18607990.**

- URL: https://pubmed.ncbi.nlm.nih.gov/18607990/
- Source checked on: 2026-09-23
- Locator: PMID 18607990; anxiety in 79.3% of chronic subjective dizziness
- Note under review: Retrospective cohort (n=1,552 vertigo referrals): CSD in 164 patients (10.6%); psychiatric disorder, mainly anxiety, found in 79.3% of CSD cases; anxiety a strong predisposing factor; balance and emotion share common neurologic pathways allowing reciprocal provocation.
- Current state: `verified: false` — pending qualified-human decision

**Row 94.2 — Dieterich M, Staab JP. Functional dizziness: from phobic postural vertigo and chronic subjective dizziness to persistent postural-perceptual dizziness. Curr Opin Neurol. 2017;30(1):107-113. PMID 28002123.**

- URL: https://pubmed.ncbi.nlm.nih.gov/28002123/
- Source checked on: 2026-09-23
- Locator: PMID 28002123; anxiety-related postural mechanism and comorbidity rates
- Note under review: Review: functional dizziness is the primary cause in ~10% of neuro-otology presentations; psychiatric comorbidity near 50% in structural vestibular syndromes, highest with vestibular migraine and Meniere's; precipitating events trigger anxiety-related postural-strategy changes with increased motion vigilance and muscle co-contraction.
- Current state: `verified: false` — pending qualified-human decision

**Row 94.3 — Kothari S, Bhansali D, Phalgune DS, Bhandari N, Vats AK, Kaski D. Persistent postural-perceptual dizziness: subjective-objective dissociation and response to neurologist-led multimodal therapy. J Neurol. 2026;273(7):386. PMID 42268441.**

- URL: https://pubmed.ncbi.nlm.nih.gov/42268441/
- Source checked on: 2026-09-23
- Locator: PMID 42268441; 88% psychiatric comorbidity in PPPD
- Note under review: Prospective Barany-criteria PPPD cohort (n=75): psychiatric comorbidity in 88%, most commonly combined anxiety and depression; GAD-7 median 8.0 improving to 0.0 after multimodal therapy including CBT and low-dose antidepressants.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `cystitis` → `overactive-bladder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The pathophysiology review summarizes clinical studies finding OAB patients significantly more likely than controls to have pathogenic bacteriuria and bladder inflammation, and supports UTI as an underappreciated contributor to OAB pathophysiology in some patients (Mansfield 2022); the Taiwanese urology review found recurrent-UTI women with highly prevalent voiding dysfunction and detrusor overactivity, proposing chronic suburothelial inflammation as the shared mechanism (Ke 2020).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the same literature defines OAB as an idiopathic syndrome diagnosed in the ABSENCE of urinary tract infection; the review itself documents bidirectionality (OAB and its treatment associate with subsequent UTI), chronic low-grade colonization confounds episode-level attribution, and no cohort quantifies incident OAB after resolved cystitis.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 95.1 — Mansfield KJ, Chen Z, Moore KH, Grundy L. Urinary Tract Infection in Overactive Bladder: An Update on Pathophysiological Mechanisms. Front Physiol. 2022 Jul 4;13:886782. PMID 35860658.**

- URL: https://pubmed.ncbi.nlm.nih.gov/35860658/
- Source checked on: 2026-09-23
- Locator: PMID 35860658; UTI-OAB association and bidirectionality passages
- Note under review: Review: OAB patients are significantly more likely than controls to have pathogenic bacteriuria and increased bladder inflammation; UTI may be an underappreciated contributor to OAB pathophysiology in some patients; laboratory work shows how infection and inflammation can induce urgency and frequency.
- Current state: `verified: false` — pending qualified-human decision

**Row 95.2 — Ke QS, Lee CL, Kuo HC. Recurrent urinary tract infection in women and overactive bladder - Is there a relationship? Tzu Chi Med J. 2021 Jan-Mar;33(1):13-21. PMID 33505873.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33505873/
- Source checked on: 2026-09-23
- Locator: PMID 33505873; recurrent-UTI detrusor overactivity and shared-inflammation mechanism
- Note under review: Review: women with recurrent UTI show highly prevalent voiding dysfunction and detrusor overactivity; chronic suburothelial inflammation is proposed to drive both sensory activation (OAB symptoms) and failure to clear intracellular bacterial communities (recurrent UTI) - a shared-mechanism confound.
- Current state: `verified: false` — pending qualified-human decision

**Row 95.3 — Liao KM, Lio KL, Chou YJ, Kuo CC, Chen CY. The Association Between Urinary Tract Infection and Overactive Bladder Treatment. Front Pharmacol. 2022 Jan 25;12:803970. PMID 35145406.**

- URL: https://pubmed.ncbi.nlm.nih.gov/35145406/
- Source checked on: 2026-09-23
- Locator: PMID 35145406; null medication-adherence result
- Note under review: Nationwide NHIRD cohort (n=21,869): 12-month UTI risk was not influenced by OAB medication class or adherence; cited as the treatment-direction guard (the reverse direction does not support a cystitis-to-OAB pathway).
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `dementia` → `anxiety-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The Alzheimer's NPS meta-analysis (48 studies) found anxiety the fourth most prevalent neuropsychiatric symptom in AD at 39% (95% CI 32-46%) (Zhao 2016); the mild-AD cross-sectional study found anxiety in 65% of mild-AD patients, independently associated with worse basic and instrumental daily functioning (Spalletta 2010).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: anxiety here is mostly measured as a neuropsychiatric SYMPTOM of the dementing process rather than as an independent disorder diagnosis; emotional or behavioral symptoms are partly defining features of dementia (identity-restatement guard); caregiver-population prevalence studies do not transfer to the patient; and no directional cohort separates dementia-driven anxiety from awareness-of-deficit reactive anxiety.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 96.1 — Zhao QF, Tan L, Wang HF, Jiang T, Tan MS, Tan L, Xu W, Li JQ, Wang J, Lai TJ, Yu JT. The prevalence of neuropsychiatric symptoms in Alzheimer's disease: Systematic review and meta-analysis. J Affect Disord. 2016 Jan 15;190:264-271. PMID 26540080.**

- URL: https://pubmed.ncbi.nlm.nih.gov/26540080/
- Source checked on: 2026-09-23
- Locator: PMID 26540080; anxiety 39% pooled prevalence
- Note under review: Meta-analysis of 48 studies: anxiety is the fourth most prevalent neuropsychiatric symptom in Alzheimer's disease at 39% (95% CI 32-46%); sleep disorder 39%, depression 42%.
- Current state: `verified: false` — pending qualified-human decision

**Row 96.2 — Spalletta G, Girardi P, Caltagirone C, Orfei MD. Neuropsychiatric symptoms and IADL in mild Alzheimer's disease: anxiety as a clinical marker. J Alzheimers Dis. 2010;21(1):45-54. PMID 20308732.**

- URL: https://pubmed.ncbi.nlm.nih.gov/20308732/
- Source checked on: 2026-09-23
- Locator: PMID 20308732; 65% anxiety in mild AD
- Note under review: Cross-sectional study: anxiety was present in 65% of mild-AD patients and independently associated with worse basic and instrumental daily functioning.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `dementia` → `urinary-incontinence` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The interRAI national cohort (n=7775 community-dwelling people with dementia) found 1-year UI prevalence of 50.1% and an adjusted 5-year incident-UI hazard ratio of 1.4 versus non-dementia controls (Burholt 2024); the global meta-analysis pooled UI prevalence in dementia at 39.7% (95% CI 23.9-58.1%), higher in clinic/hospital than community settings (Moradi Sarcheshmeh 2026).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the CNS small vessel disease review documents that the same small-vessel pathology independently causes both dementia and urinary incontinence (shared-cause confound); the meta-analysis's 4%-88% prevalence span reflects setting and assessment-method heterogeneity; no directional cohort separates neurogenic detrusor overactivity from mobility, communication, or toileting-access components of incontinence in dementia.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 97.1 — Burholt V, Cheung G, Awatere SA, Daltrey JF. Incidence, Prevalence, and Risk for Urinary Incontinence for People with Dementia in the Community in Aotearoa New Zealand: An interRAI Study. J Am Med Dir Assoc. 2024 Nov;25(11):105285. PMID 39326857.**

- URL: https://pubmed.ncbi.nlm.nih.gov/39326857/
- Source checked on: 2026-09-23
- Locator: PMID 39326857; prevalence, incidence, and adjusted hazard ratio
- Note under review: National retrospective cohort (n=7775): 1-year UI prevalence 50.1% among community-dwelling people with dementia; 5-year incident UI 30.2 per 100 person-years versus 24.5 in non-dementia controls; adjusted HR 1.4 for dementia.
- Current state: `verified: false` — pending qualified-human decision

**Row 97.2 — Moradi Sarcheshmeh MS, Shahedi A, Zabihirad J, Taghipour M, Kargar Jahromi H, Delam H. Global Prevalence of Urinary Incontinence in Individuals With Dementia: A Systematic Review and Meta-Analysis. Neurourol Urodyn. 2026. PMID 42485548.**

- URL: https://pubmed.ncbi.nlm.nih.gov/42485548/
- Source checked on: 2026-09-23
- Locator: PMID 42485548; pooled prevalence and setting heterogeneity
- Note under review: Meta-analysis (10 studies, n=286,544): pooled UI prevalence in dementia 39.7% (95% CI 23.9-58.1%), I2 > 95%; higher in clinic/hospital (47.5%) than community (28.7%) settings - the ascertainment guard.
- Current state: `verified: false` — pending qualified-human decision

**Row 97.3 — Cannistraro RJ, Badi M, Eidelman BH, Dickson DW, Middlebrooks EH, Meschia JF. CNS small vessel disease: A clinical review. Neurology. 2019 Jun 11;92(24):1146-1156. PMID 31142635.**

- URL: https://pubmed.ncbi.nlm.nih.gov/31142635/
- Source checked on: 2026-09-23
- Locator: PMID 31142635; CSVD-causes-both passage
- Note under review: Clinical review: CSVD lesions can cause dementia, mood disorders, and urinary incontinence as direct manifestations - cited as the documented shared-cause confound (the same pathology drives both conditions).
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `dry-eye-syndrome` → `insomnia` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The Lifelines population cohort (n=71,761) found dry eye associated with poor sleep quality after correction for age, sex, BMI, education, income, and 51 comorbidities including autoimmune and psychiatric disease (OR 1.20, 95% CI 1.11-1.28), with 44.9% poor sleep among those with frequent or constant symptoms (Magno 2021); the Miami VA eye-clinic cohort found ocular symptoms tied most strongly to the PSQI sleep-disturbance subscore (OSDI r=0.49, p<0.0005) (Ayoubi 2024).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the Hangzhou community study documents the reverse direction (worse sleep predicting worse dry-eye severity), shared systemic and psychiatric comorbidity partially confounds even the fully adjusted estimate, the veteran-clinic cohort is cross-sectional without severity-exclusion denominators, and insomnia diagnosis at the individual level requires excluding the common primary sleep disorders.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 98.1 — Magno MS, Utheim TP, Snieder H, Hammond CJ, Vehof J. The relationship between dry eye and sleep quality. Ocul Surf. 2021 Apr;20:13-19. PMID 33421635.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33421635/
- Source checked on: 2026-09-23
- Locator: PMID 33421635; fully adjusted population association
- Note under review: Lifelines cohort (n=71,761): dry eye associated with poor sleep quality after correcting for 51 comorbidities (OR 1.20, 95% CI 1.11-1.28); 44.9% poor sleep among those with frequent/constant symptoms.
- Current state: `verified: false` — pending qualified-human decision

**Row 98.2 — Ayoubi M, Cabrera K, Mangwani S, Locatelli EVT, Galor A. Associations between dry eye disease and sleep quality: a cross-sectional analysis. BMJ Open Ophthalmol. 2024 Jan 4;9(1):e001584. PMID 38177080.**

- URL: https://pubmed.ncbi.nlm.nih.gov/38177080/
- Source checked on: 2026-09-23
- Locator: PMID 38177080; veteran-population symptom-sleep association
- Note under review: Miami VA eye-clinic cohort (n=141 veterans): ocular symptoms more related to sleep metrics than signs; strongest association between OSDI and the PSQI sleep-disturbance subscore (r=0.49, p<0.0005).
- Current state: `verified: false` — pending qualified-human decision

**Row 98.3 — Yu X, Guo H, Liu X, Wang G, Min Y, Chen SS, Han SS, Chang RT, Zhao X, Hsing A, Zhu S, Yao K. Dry eye and sleep quality: a large community-based study in Hangzhou. Sleep. 2019 Oct 21;42(11):zsz160. PMID 31310315.**

- URL: https://pubmed.ncbi.nlm.nih.gov/31310315/
- Source checked on: 2026-09-23
- Locator: PMID 31310315; reverse-direction dose-response
- Note under review: Community study (n=3,070): poor sleep quality associated with increased dry-eye severity in dose-response - cited as the documented reverse-direction guard.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `dry-eye-syndrome` → `depressive-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The multimodal meta-analysis (26 case-control studies) found dry eye associated with increased depression prevalence (OR 1.83) and, in 48 Mendelian-randomization experiments across two biobanks, supported bidirectional DED-to-DEP and DEP-to-DED causation (Chang 2025, Taipei Veterans General Hospital); the 22-study meta-analysis (n=2,980,026) found depression OR 2.92 (95% CI 2.13-4.01) with severity greatest in primary Sjogren's patients (Wan 2016).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the strongest source itself demonstrates bidirectional causation (depression-to-DED OR 2.34), so one-direction attribution is precluded by the evidence's own design; the Chang MR causation claim is instrument-dependent and has not settled into consensus; Sjogren's strata carry the severity but represent a distinct autoimmune identity; antidepressant treatment itself aggravates dry eye, inverting chronology in treated patients.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 99.1 — Chang KJ, Wu HY, Chiang PH, Hsu YT, Weng PY, Yu TH, Li CY, Chen YH, Dai HJ, Tsai HY, Chang YJ, Wu YR, Yang YP, Li CT, Hsu CC, Chen SJ, Chen YC, Cheng CY, Hsieh AR, Chiou SH. Decoding and reconstructing disease relations between dry eye and depression: a multimodal investigation comprising meta-analysis, genetic pathways and Mendelian randomization. J Adv Res. 2025 Mar;69:197-213. PMID 38548265.**

- URL: https://pubmed.ncbi.nlm.nih.gov/38548265/
- Source checked on: 2026-09-23
- Locator: PMID 38548265; OR 1.83 and bidirectional MR findings
- Note under review: Meta-analysis (26 studies) plus 48 MR experiments: DED associated with increased depression prevalence (OR 1.83); bidirectional DED-to-DEP and DEP-to-DED causation supported in TWB and UKB biobanks; shared immune-activation genetic architecture (rG=0.19). The bidirectionality is the guard.
- Current state: `verified: false` — pending qualified-human decision

**Row 99.2 — Wan KH, Chen LJ, Young AL. Depression and anxiety in dry eye disease: a systematic review and meta-analysis. Eye (Lond). 2016 Dec;30(12):1558-1567. PMID 27518547.**

- URL: https://pubmed.ncbi.nlm.nih.gov/27518547/
- Source checked on: 2026-09-23
- Locator: PMID 27518547; depression/anxiety pooled ORs and Sjogren's subgroup
- Note under review: Meta-analysis (22 studies, n=2,980,026): depression OR 2.92 (95% CI 2.13-4.01) and anxiety OR 2.80 in dry eye disease; severity greatest in primary Sjogren's patients - the autoimmune-subtype guard.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `dumping-syndrome` → `malnutrition-residuals` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The international consensus defines dietary adjustment as the agreed first treatment step, making symptom-driven caloric management inherent to the syndrome (Scarpellini 2020); the management review documents continuous enteral feeding as necessary for treatment-refractory cases (van Beek 2017; Tack 2025), and the bariatric systematic review found late dumping promotes higher caloric intake while early dumping drives food avoidance (D'hoedt 2023).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the direction of the nutritional effect is heterogeneous by subtype (early-dumping food avoidance versus late-dumping increased intake per D'hoedt 2023), the syndrome itself is a postoperative complication rather than an independent disease process, and weight loss attributable to the underlying surgery, malignancy, or the intended bariatric effect must be separated from dumping-specific nutritional harm; the D'hoedt review found no significant dumping-to-degree-of-weight-loss relationship.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 100.1 — Scarpellini E, Arts J, Karamanolis G, et al. International consensus on the diagnosis and management of dumping syndrome. Nat Rev Endocrinol. 2020 Aug;16(8):448-466. PMID 32457534.**

- URL: https://pubmed.ncbi.nlm.nih.gov/32457534/
- Source checked on: 2026-09-23
- Locator: PMID 32457534; dietary-adjustment-first-line consensus statement
- Note under review: Delphi international consensus (18 experts, 62 statements): dietary adjustment is the agreed first treatment step; decreased gastric volume capacity and rapid nutrient passage to the small bowel are pathophysiologically relevant.
- Current state: `verified: false` — pending qualified-human decision

**Row 100.2 — van Beek AP, Emous M, Laville M, Tack J. Dumping syndrome after esophageal, gastric or bariatric surgery: pathophysiology, diagnosis, and management. Obes Rev. 2017 Jan;18(1):68-85. PMID 27749997.**

- URL: https://pubmed.ncbi.nlm.nih.gov/27749997/
- Source checked on: 2026-09-23
- Locator: PMID 27749997; refractory-case enteral-feeding passage
- Note under review: Systematic review: surgical re-intervention or continuous enteral feeding may be necessary for treatment-refractory dumping syndrome - the refractory-nutrition-support anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 100.3 — D'hoedt A, Vanuytsel T. Dumping syndrome after bariatric surgery: prevalence, pathophysiology and role in weight reduction - a systematic review. Acta Gastroenterol Belg. 2023 Jul-Sep;86(3):417-427. PMID 37814558.**

- URL: https://pubmed.ncbi.nlm.nih.gov/37814558/
- Source checked on: 2026-09-23
- Locator: PMID 37814558; subtype-direction heterogeneity passage
- Note under review: Systematic review: early dumping can become a tool to maintain strict dietary patterns, but late dumping is detrimental and promotes overall higher caloric intake; no significant dumping-to-weight-loss relationship shown - the directionality guard.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `dupuytren-s-contracture` → `trigger-finger` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The single-surgeon retrospective cohort (n=238) identified 43 patients carrying both diagnoses in the same hand; trigger finger, sex, and age were significantly associated with Dupuytren's contracture in the multivariate model, and the authors conclude patients with stenosing tenosynovitis may be at increased risk of developing Dupuytren's contracture or vice versa (Yang 2019); the diabetic comparative study co-observed the cluster with limited joint motion and flexor tenosynovitis (Chammas 1995).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the same cohort documents bidirectionality (each condition associated with the other), the study design is a referral-population retrospective chart review without incidence denominators, and the fibrotic-tendon phenotype shared with diabetes raises a documented shared-substrate question (Chammas 1995 co-observed the cluster in diabetics, though Yang 2019 found diabetes not significant in the multivariate model).

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 101.1 — Yang K, Gehring M, Bou Zein Eddine S, Hettinger P. Association between Stenosing Tenosynovitis and Dupuytren's Contracture in the Hand. Plast Reconstr Surg Glob Open. 2019 Jan 11;7(1):e2088. PMID 30859045.**

- URL: https://pubmed.ncbi.nlm.nih.gov/30859045/
- Source checked on: 2026-09-23
- Locator: PMID 30859045; same-hand co-occurrence and multivariate result
- Note under review: Retrospective cohort (n=238): 43 patients carried both diagnoses in the same hand; trigger finger significantly associated with Dupuytren's in the multivariate model; bidirectionality explicitly concluded; diabetes not significant.
- Current state: `verified: false` — pending qualified-human decision

**Row 101.2 — Chammas M, Bousquet P, Renard E, Poirier JL, Jaffiol C, Allieu Y. Dupuytren's disease, carpal tunnel syndrome, trigger finger, and diabetes mellitus. J Hand Surg Am. 1995 Jan;20(1):109-14. PMID 7722249.**

- URL: https://pubmed.ncbi.nlm.nih.gov/7722249/
- Source checked on: 2026-09-23
- Locator: PMID 7722249; diabetic hand-fibrosis cluster
- Note under review: Comparative prospective study (120 diabetics vs 120 controls): significantly higher incidence of Dupuytren's, limited joint motion, carpal tunnel syndrome, and flexor tenosynovitis in diabetics - cited as the shared-substrate confound.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `dwarfism` → `sleep-apnea` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The national reference-center PSG review found 24 of 43 consecutive children (59%) with achondroplasia had obstructive sleep apnea (Tenconi 2017); the multisite CLARITY infant database documented age-evolving obstructive indices and improvement after adenoidectomy or cervicomedullary decompression (Legare 2025); GeneReviews lists obstructive apnea among the medical complications common to achondroplasia requiring routine surveillance (Bober 2025).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the quantified prevalence is pediatric achondroplasia-specific and does not transfer to the generic adult dwarfism identity; the obstructive component is mixed with central apnea and foramen-magnum mechanisms that require individual neurosurgical assessment; obesity and adenotonsillar hypertrophy are competing drivers within the same population.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 102.1 — Tenconi R, Khirani S, Amaddeo A, et al. Sleep-disordered breathing and its management in children with achondroplasia. Am J Med Genet A. 2017 Apr;173(4):868-878. PMID 28239978.**

- URL: https://pubmed.ncbi.nlm.nih.gov/28239978/
- Source checked on: 2026-09-23
- Locator: PMID 28239978; 59% PSG-confirmed OSA prevalence
- Note under review: Retrospective PSG review (n=43 consecutive children, national reference center): 59% had obstructive sleep apnea; improvement after adeno-tonsillectomy.
- Current state: `verified: false` — pending qualified-human decision

**Row 102.2 — Legare JM, Ingram DG, Pauli RM, et al. Evolution of sleep disordered breathing in infants with achondroplasia. Sleep Breath. 2025 Jan 23;29(1):88. PMID 39847128.**

- URL: https://pubmed.ncbi.nlm.nih.gov/39847128/
- Source checked on: 2026-09-23
- Locator: PMID 39847128; age evolution and surgical-response differences
- Note under review: Multisite CLARITY database (86 infants, 172 PSGs): obstructive indices evolve with age; adenoidectomy improved OSA and cervicomedullary decompression improved central apnea - the mixed-physiology guard.
- Current state: `verified: false` — pending qualified-human decision

**Row 102.3 — Bober MB, Bellus GA, Cheung MS, Jain M, Nikkel SM, Tiller GE. Hypochondroplasia. GeneReviews. 2025 Sep 25. PMID 20301650.**

- URL: https://pubmed.ncbi.nlm.nih.gov/20301650/
- Source checked on: 2026-09-23
- Locator: PMID 20301650; surveillance guidance
- Note under review: GeneReviews: obstructive apnea and spinal stenosis are medical complications common to achondroplasia requiring routine sleep-apnea and cord-compression surveillance.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `dwarfism` → `spinal-stenosis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** GeneReviews lists spinal stenosis and foramen magnum stenosis as medical complications common to achondroplasia, managed by orthopedists and neurosurgeons with strategies employed in achondroplasia, and requires spinal-cord-compression surveillance at routine visits (Bober 2025); the CLARITY cohort documents cervicomedullary decompression improving central apnea, confirming symptomatic foramen-magnum stenosis in this population (Legare 2025).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: canal narrowing is a defining anatomic feature of achondroplasia (identity-overlap guard), so the edge largely restates the dysplasia's own anatomy; symptomatic stenosis versus asymptomatic anatomic narrowing is an individual neurosurgical determination; the generic dwarfism identity spans dysplasias with differing stenosis risk (hypochondroplasia less frequently affected per GeneReviews); degenerative acquired stenosis must be excluded in adults.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 103.1 — Bober MB, Bellus GA, Cheung MS, Jain M, Nikkel SM, Tiller GE. Hypochondroplasia. GeneReviews. 2025 Sep 25. PMID 20301650.**

- URL: https://pubmed.ncbi.nlm.nih.gov/20301650/
- Source checked on: 2026-09-23
- Locator: PMID 20301650; stenosis-surveillance guidance
- Note under review: GeneReviews: foramen magnum stenosis, spinal stenosis, and obstructive apnea are complications common to achondroplasia (less frequent in hypochondroplasia), managed with achondroplasia strategies; spinal cord compression surveillance required.
- Current state: `verified: false` — pending qualified-human decision

**Row 103.2 — Legare JM, Ingram DG, Pauli RM, et al. Evolution of sleep disordered breathing in infants with achondroplasia. Sleep Breath. 2025 Jan 23;29(1):88. PMID 39847128.**

- URL: https://pubmed.ncbi.nlm.nih.gov/39847128/
- Source checked on: 2026-09-23
- Locator: PMID 39847128; decompression response
- Note under review: CLARITY multisite cohort: cervicomedullary decompression improved central apnea, confirming symptomatic foramen-magnum stenosis in this population.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `dysplastic-nevus-syndrome` → `skin-cancer` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The pooled 46-study meta-analysis found a substantially increased melanoma relative risk with increasing nevus burden (atypical nevi 5 versus 0: RR 6.36, 95% CI 3.80-10.33; 101-120 common nevi versus <15: RR 6.89, 95% CI 4.63-10.25; Gandini 2005), and the Brisbane Naevus Morphology Study quantified the joint effect of high nevus count with MC1R red-hair genotype on melanoma odds (MC1R R/R with >=20 naevi: OR 25.1, 95% CI 8.4-82.7 versus wild-type with 0-4 naevi; absolute risk to age 75 of 23.3% in the highest-risk group; Duffy 2019).

**Causation boundary (causationStatus):** The meta-analytic and cohort risk estimates are population-level associations from a risk-marker phenotype, not established causation for an individual lesion: nevus count is a composite marker of melanocytic propensity and sun-exposure history, and the individual pathway from a given dysplastic nevus to a diagnosed melanoma (versus de novo melanoma or an intervening unrelated lesion) cannot be established from these designs; the identity's clinical meaning as a surveillance designation is retained.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 104.1 — Gandini S, Sera F, Cattaruzza MS, et al. Meta-analysis of risk factors for cutaneous melanoma: I. Common and atypical naevi. Eur J Cancer. 2005 Jan;41(1):28-44. PMID 15617989.**

- URL: https://pubmed.ncbi.nlm.nih.gov/15617989/
- Source checked on: 2026-09-23
- Locator: PMID 15617989; pooled atypical-nevi and common-naevi dose-response relative risks
- Note under review: Pooled random-effects meta-analysis of 46 observational studies: atypical nevi 5 versus 0 carried melanoma RR 6.36 (95% CI 3.80-10.33) and 101-120 common naevi versus <15 carried RR 6.89 (95% CI 4.63-10.25); the dose-response anchor for the nevus-count-to-melanoma-risk association.
- Current state: `verified: false` — pending qualified-human decision

**Row 104.2 — Duffy DL, Lee KJ, Jagirdar K, et al. High naevus count and MC1R red hair alleles contribute synergistically to increased melanoma risk. Br J Dermatol. 2019 Nov;181(5):1009-1016. PMID 30820946.**

- URL: https://pubmed.ncbi.nlm.nih.gov/30820946/
- Source checked on: 2026-09-23
- Locator: PMID 30820946; MC1R-by-naevus-count synergistic odds ratios
- Note under review: Brisbane Naevus Morphology Study (n=1,267): MC1R R/R genotype with >=20 naevi had melanoma OR 25.1 (95% CI 8.4-82.7) and the highest-risk group reached 23.3% absolute melanoma risk to age 75 - the genotype-by-phenotype risk-modification and UV-context guard.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `early-onset-peripheral-neuropathy` → `pes-cavus` — ASSOCIATION_ONLY

**Proposition (associationBasis):** In the Inherited Neuropathies Consortium cohort, foot deformities were reported in 71% of Charcot-Marie-Tooth disease patients and 30% underwent orthopedic surgery (Laura 2018), and the CMT4C case series documents pes cavus appearing among the earliest manifestations of early-onset hereditary neuropathy (Okhovat 2026); early-onset hereditary motor-sensory neuropathy is the classic clinical association of the pes-cavus phenotype.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the 71% prevalence is CMT-population cohort data and the identity spans acquired and hereditary early-onset etiologies, pes cavus can be congenital or independently acquired (trauma, compartment syndrome, spasticity), and an individual's deformity may precede, accompany, or be unrelated to the neuropathy; chronologic primacy cannot be established from population data.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 105.1 — Laura M, Singh D, Ramdharry G, et al. Prevalence and orthopedic management of foot and ankle deformities in Charcot-Marie-Tooth disease. Muscle Nerve. 2018 Feb;57(2):255-259. PMID 28632967.**

- URL: https://pubmed.ncbi.nlm.nih.gov/28632967/
- Source checked on: 2026-09-23
- Locator: PMID 28632967; 71% foot-deformity prevalence in the INC cohort
- Note under review: Inherited Neuropathies Consortium cohort: foot deformities were reported in 71% of CMT patients and 30% underwent orthopedic surgery - the population anchor for the neuropathy-to-foot-deformity association.
- Current state: `verified: false` — pending qualified-human decision

**Row 105.2 — Okhovat AA, Shahriyari H, Ghasemi A, et al. Charcot-Marie-Tooth type 4C misdiagnosed as CIDP: electrodiagnostic pitfalls and genetic confirmation. Neurogenetics. 2026 Jun 30;27(1):48. PMID 42377577.**

- URL: https://pubmed.ncbi.nlm.nih.gov/42377577/
- Source checked on: 2026-09-23
- Locator: PMID 42377577; early-onset pes-cavus phenotype in the CMT4C series
- Note under review: Genetically confirmed CMT4C series: all five patients exhibited early-onset symptoms including progressive muscle weakness, pes cavus, and spinal deformities - the early-onset phenotype anchor, used with the caution that it is a case-series class and a single CMT subtype.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `elbow-disarticulation` → `phantom-limb-pain` — ASSOCIATION_ONLY

**Proposition (associationBasis):** In a national survey of 776 veterans with major upper-limb amputation, 73% reported phantom limb pain with mean intensity 4.2/10, and 42% reported daily-to-always PLP frequency, with higher-level amputations showing higher odds of any PLP (transhumeral OR 1.76, shoulder OR 3.78 versus transradial; Balakhanlou 2021); the nationwide 3,374-amputee survey independently characterizes PLP prevalence and phenomenology across amputation levels (Diers 2022).

**Causation boundary (causationStatus):** Neither causation nor aggravation under 38 CFR 3.310 is established by this association evidence: population prevalence does not establish an individual nexus without documentation of the amputation, the phantom pain syndrome, compatible chronology, and competing-cause review; the survey's level odds cover transradial, transhumeral, and shoulder strata rather than elbow disarticulation specifically, and residual-limb pain, neuroma, and prosthetic factors can coexist with or mimic phantom pain.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 106.1 — Balakhanlou E, Webster J, Borgia M, Resnik L. Frequency and Severity of Phantom Limb Pain in Veterans with Major Upper Limb Amputation: Results of a National Survey. PM R. 2021 Aug;13(8):827-835. PMID 32896094.**

- URL: https://pubmed.ncbi.nlm.nih.gov/32896094/
- Source checked on: 2026-09-23
- Locator: PMID 32896094; 73% PLP prevalence and level odds in the veterans upper-limb survey
- Note under review: National survey of 776 veterans with major upper-limb amputation: 73% reported phantom limb pain (mean intensity 4.2/10), 42% daily-to-always frequency, with level odds of transhumeral OR 1.76 and shoulder OR 3.78 versus transradial - the upper-limb population anchor and the proximal-level gradient.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `empty-nose-syndrome` → `depressive-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** In a prospective case-control study of 40 ENS patients and 40 age- and sex-matched controls, ENS patients had significantly elevated Beck Depression Inventory-II and Beck Anxiety Inventory scores versus controls, improved after nasal reconstruction yet remained significantly worse than controls, and 22.5% carried residual postoperative psychological symptoms with preoperative BDI-II > 28.5 predicting residual burden (Huang 2023); suicidal thoughts were identified in 23 of 62 ENS patients preoperatively and tracked with SNOT-25, ENS6Q, BDI-II, and BAI severity (Huang 2022); the 2025 systematic review pooled 957 ENS patients across 35 articles and concluded the evidence base remains sparse (Hussain 2025).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the case-control design cannot exclude reverse direction (chronic breathlessness dissatisfaction and disability amplify both depression and symptom reporting), the cohort is a single tertiary referral center with surgically selected patients, and the systematic review's evidence-paucity conclusion caps the inference; depression comorbidity in a chronic-symptom population is shared-driver confounded and case-specific review is required.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 107.1 — Huang CC, Wu PW, Huang CC, et al. Identifying Residual Psychological Symptoms after Nasal Reconstruction Surgery in Patients with Empty Nose Syndrome. J Clin Med. 2023 Mar 31;12(7):2635. PMID 37048718.**

- URL: https://pubmed.ncbi.nlm.nih.gov/37048718/
- Source checked on: 2026-09-23
- Locator: PMID 37048718; BDI-II/BAI case-control comparisons and 22.5% residual-symptom finding
- Note under review: Prospective case-control study (40 ENS patients, 40 age- and sex-matched controls): BDI-II and BAI significantly elevated versus controls, improved after reconstruction but remained significantly greater than controls, 22.5% with residual postoperative psychological symptoms, preoperative BDI-II > 28.5 predictive - the mood-burden anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 107.2 — Huang CC, Wu PW, Lee CC, et al. Suicidal thoughts in patients with empty nose syndrome. Laryngoscope Investig Otolaryngol. 2022 Jan 19;7(1):22-28. PMID 35155779.**

- URL: https://pubmed.ncbi.nlm.nih.gov/35155779/
- Source checked on: 2026-09-23
- Locator: PMID 35155779; 23/62 preoperative suicidal-thoughts finding
- Note under review: Prospective case series (n=62): suicidal thoughts in 23 patients preoperatively, tracking with SNOT-25, ENS6Q, BDI-II, and BAI severity - the severity-tracking and clinical-burden anchor, used with the case-series-class guard.
- Current state: `verified: false` — pending qualified-human decision

**Row 107.3 — Hussain S, Hayat J, Almhanedi H, et al. A Systematic Review and Meta-Analysis of Management Options for Empty Nose Syndrome: A Proposed Management Algorithm. Otolaryngol Head Neck Surg. 2025 Jan;172(1):1-12. PMID 39126290.**

- URL: https://pubmed.ncbi.nlm.nih.gov/39126290/
- Source checked on: 2026-09-23
- Locator: PMID 39126290; evidence-paucity conclusion over 957 pooled patients
- Note under review: Systematic review of 35 articles comprising 957 individual ENS patients: concludes there is a paucity of evidence on the management of ENS - the evidence-scope guard capping the inferential weight of the case-series literature.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `encephalitis` → `seizure-disorder` — DIRECT_CAUSATION

**Proposition (direct_causation):** Documented encephalitis with cortical or limbic parenchymal involvement (MRI-demonstrated temporal-lobe or cortical signal change, or etiology with established tropism such as herpes simplex encephalitis) -> focal cortical scar, gliosis, and excitatory-network remodeling in the injured parenchyma -> spontaneous recurrent seizures (post-encephalitic epilepsy) persisting beyond the acute illness.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 108.1 — Wang Y, Ma Y, Wang Y, et al. Age-stratified clinical characteristics and long-term neurological outcomes of pediatric herpes simplex virus encephalitis: a longitudinal cohort study. Front Neurol. 2026;17:1882046. PMID 42564238.**

- URL: https://pubmed.ncbi.nlm.nih.gov/42564238/
- Source checked on: 2026-09-23
- Locator: PMID 42564238; 53.6% post-encephalitic epilepsy finding
- Note under review: Longitudinal cohort of 56 confirmed pediatric HSE patients (median follow-up 62.5 months): post-encephalitic epilepsy in 53.6% with 63.3% drug-refractory, plus acquired anti-NMDAR encephalitis in 17.9% - the lesion-to-epilepsy quantification anchor for a necrotizing, limbic-tropic etiology.
- Current state: `verified: false` — pending qualified-human decision

**Row 108.2 — Fillatre P, Mailles A, Stahl JP, et al. Functional outcome after infectious encephalitis: a longitudinal multicentre cohort study. Clin Microbiol Infect. 2025 Mar;31(3):459-465. PMID 39522606.**

- URL: https://pubmed.ncbi.nlm.nih.gov/39522606/
- Source checked on: 2026-09-23
- Locator: PMID 39522606; longitudinal functional outcome of the ENCEIF cohort
- Note under review: ENCEIF prospective multicenter cohort (322 survivors, 896 modified-Rankin evaluations): substantial residual neurological disability after infectious encephalitis - the outcome-burden anchor supporting the direct-injury proposition for the infectious subgroup.
- Current state: `verified: false` — pending qualified-human decision

**Row 108.3 — Hawkes MA, Carabenciov ID, Wijdicks EFM, Rabinstein AA. Outcomes in Patients With Severe West Nile Neuroinvasive Disease. Crit Care Med. 2018 Sep;46(9):e955-e958. PMID 29985213.**

- URL: https://pubmed.ncbi.nlm.nih.gov/29985213/
- Source checked on: 2026-09-23
- Locator: PMID 29985213; long-term outcomes after severe neuroinvasive disease
- Note under review: Long-term follow-up of severe West Nile neuroinvasive disease: persistent functional disability and cognitive impairment in many survivors - the etiologic-heterogeneity guard anchor (severe necrotizing presentations carry the injury pathway; mild systemic presentations do not).
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `encephalitis` → `cognitive-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The ENCEIF longitudinal multicenter cohort followed 322 infectious-encephalitis survivors with 896 modified-Rankin evaluations and documents substantial residual disability with incomplete functional recovery (Fillatre 2025), and the anti-LGI1 autoimmune-encephalitis cohort found persistent neurofunctional deficits after a median 33-month follow-up in most of 86 patients (Chen 2021); cognition is the domain most consistently affected in both literatures.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the cohort designs document outcome association without individual lesion-to-deficit linkage, the encephalitis identity spans infectious, autoimmune, and toxic etiologies with different injury mechanisms, and premorbid cognition, medication effects, and systemic-illness sequelae must be separated in any individual case.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 109.1 — Fillatre P, Mailles A, Stahl JP, et al. Functional outcome after infectious encephalitis: a longitudinal multicentre cohort study. Clin Microbiol Infect. 2025 Mar;31(3):459-465. PMID 39522606.**

- URL: https://pubmed.ncbi.nlm.nih.gov/39522606/
- Source checked on: 2026-09-23
- Locator: PMID 39522606; longitudinal functional outcome of the ENCEIF cohort
- Note under review: ENCEIF prospective multicenter cohort (322 survivors, 896 mRS evaluations): incomplete functional recovery after infectious encephalitis - the residual-disability anchor for the cognitive-outcome association.
- Current state: `verified: false` — pending qualified-human decision

**Row 109.2 — Chen W, Wang M, Gao L, et al. Neurofunctional outcomes in patients with anti-leucine-rich glioma inactivated 1 protein encephalitis. Acta Neurol Scand. 2021 Dec;144(6):632-639. PMID 34314015.**

- URL: https://pubmed.ncbi.nlm.nih.gov/34314015/
- Source checked on: 2026-09-23
- Locator: PMID 34314015; neurofunctional outcome of the anti-LGI1 cohort
- Note under review: Cohort follow-up (86 anti-LGI1 patients, median 33 months): persistent neurofunctional deficits despite functional survival - the autoimmune-etiologic anchor with memory-domain emphasis.
- Current state: `verified: false` — pending qualified-human decision

**Row 109.3 — Hawkes MA, Carabenciov ID, Wijdicks EFM, Rabinstein AA. Outcomes in Patients With Severe West Nile Neuroinvasive Disease. Crit Care Med. 2018 Sep;46(9):e955-e958. PMID 29985213.**

- URL: https://pubmed.ncbi.nlm.nih.gov/29985213/
- Source checked on: 2026-09-23
- Locator: PMID 29985213; cognitive outcomes after severe neuroinvasive disease
- Note under review: Long-term severe West Nile neuroinvasive disease follow-up: cognitive impairment and functional disability persist in many survivors - the severe-presentation anchor supporting the parenchymal-injury pathway while illustrating etiologic heterogeneity.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `enophthalmos` → `diplopia` — ASSOCIATION_ONLY

**Proposition (associationBasis):** In a 109-patient orbital-floor-fracture series, 56.3% of patients with enophthalmos exhibited diplopia compared with 8.6% without (Yasar 2026), and in a 254-patient orbital-fracture repair cohort postoperative diplopia was reported in up to 52% with preoperative enophthalmos and fracture morphology among the predictors (Hassan 2024); enophthalmos and diplopia co-occur after orbital injury far above chance.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: both findings are consequences of the same orbital trauma (shared-driver confound - globe malposition and extraocular-muscle or nerve injury arise together from the fracture, and the literature does not establish that the positional change itself produces the misalignment); etiologic heterogeneity (post-traumatic, post-surgical, congenital, and atrophic enophthalmos) further limits generalization, and diplopia must be separately diagnosed by examination rather than symptom report.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 110.1 — Yasar EK, Gurbuz CM, Uzun C, et al. Risk factors for residual diplopia in orbital trauma: a retrospective analysis of 109 orbital floor fracture patients. Arch Craniofac Surg. 2026 Jun;27(3):129-134. PMID 42036113.**

- URL: https://pubmed.ncbi.nlm.nih.gov/42036113/
- Source checked on: 2026-09-23
- Locator: PMID 42036113; 56.3% versus 8.6% diplopia-by-enophthalmos finding
- Note under review: Retrospective 109-patient orbital-floor-fracture series: diplopia in 56.3% of patients with enophthalmos versus 8.6% without - the co-occurrence quantification anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 110.2 — Hassan B, Yoon J, Er S, et al. Predictors of Postoperative Diplopia following Orbital Fracture Repair in Adults. Plast Reconstr Surg. 2024 Nov 1;154(5):1048-1056. PMID 37815322.**

- URL: https://pubmed.ncbi.nlm.nih.gov/37815322/
- Source checked on: 2026-09-23
- Locator: PMID 37815322; postoperative diplopia predictors in orbital fracture repair
- Note under review: Retrospective 254-patient orbital-fracture-repair cohort: postoperative diplopia reported in up to 52% of orbital bone reconstruction cases, with preoperative findings among the predictors - the repair-context and predictor anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `eosinophilic-bronchitis` → `asthma` — ASSOCIATION_ONLY

**Proposition (associationBasis):** Non-asthmatic eosinophilic bronchitis and eosinophilic asthma share the same sputum-eosinophilic airway inflammation and corticosteroid responsiveness while differing in airflow obstruction and bronchial hyperresponsiveness (Lai 2017/2018 review); NAEB patients show elevated airway eosinophil progenitors comparable to eosinophilic asthma (Zhan 2022), and transcriptomic work links FCN1+ macrophage activation to airway remodeling across eosinophilic airway disease (Wu 2024).

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the long-term follow-up literature treats NAEB as a distinct entity rather than an early stage of asthma, CT imaging shows maintained airway patency without wall thickening in NAEB (Siddiqui 2009), and no prospective progression-rate evidence demonstrates that EB causes later asthma; the shared inflammation could as easily reflect a common eosinophilic diathesis.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 111.1 — Lai K, Chen R, Peng W, Zhan W. Non-asthmatic eosinophilic bronchitis and its relationship with asthma. Pulm Pharmacol Ther. 2017 Dec;47:66-71. PMID 28687463.**

- URL: https://pubmed.ncbi.nlm.nih.gov/28687463/
- Source checked on: 2026-09-23
- Locator: PMID 28687463; distinct-entity long-term follow-up discussion
- Note under review: Review of the NAEB-asthma relationship: NAEB shares eosinophilic airway inflammation and corticosteroid responsiveness with asthma but lacks airflow obstruction and bronchial hyperresponsiveness; long-term follow-up supports NAEB as a distinct entity rather than an early stage of asthma, with high relapse after treatment - the shared-biology anchor and the distinct-entity guard.
- Current state: `verified: false` — pending qualified-human decision

**Row 111.2 — Zhan C, Xu R, Li B, et al. Eosinophil Progenitors in Patients With Non-Asthmatic Eosinophilic Bronchitis, Eosinophilic Asthma, and Healthy Controls. Front Immunol. 2022;13:737968. PMID 35432356.**

- URL: https://pubmed.ncbi.nlm.nih.gov/35432356/
- Source checked on: 2026-09-23
- Locator: PMID 35432356; NAEB versus eosinophilic-asthma progenitor comparison
- Note under review: Case-control flow-cytometry study (NAEB n=15, eosinophilic asthma n=15, controls n=14): NAEB airway eosinophil-progenitor levels comparable to eosinophilic asthma - the shared-biology mechanistic anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 111.3 — Siddiqui S, Gupta S, Cruse G, et al. Airway wall geometry in asthma and nonasthmatic eosinophilic bronchitis. Allergy. 2009 Jun;64(6):951-958. PMID 19210350.**

- URL: https://pubmed.ncbi.nlm.nih.gov/19210350/
- Source checked on: 2026-09-23
- Locator: PMID 19210350; NAEB airway-geometry comparison against asthma
- Note under review: CT airway-geometry study (10 NAEB, 26 asthma, 11 controls): NAEB shows maintained airway patency without wall thickening in contrast to asthma - the remodeling-absence counter-evidence capping the progression pathway.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `eosinophilic-gastroenteritis` → `malnutrition-residuals` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The mucosal-dominant Klein phenotype of eosinophilic gastroenteritis presents with malabsorption, protein-losing enteropathy, and weight loss (Goel 2026 StatPearls review), and the Chehade 2006 pediatric series documents hypoalbuminemia and edema from intestinal protein loss in allergic EGE with PLE responding to antigen-avoidance therapy; malabsorptive weight loss is a recognized mucosal-EGE presentation across the case literature.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the evidence is case-series class without denominators, Klein-layer heterogeneity means the muscularis and serosal phenotypes lack the mucosal absorption pathway entirely, and weight loss in an EGE patient must be separated from dietary elimination, corticosteroid effects, and the allergic diathesis's other drivers; the mapping asserts the association recorded in the literature, not an individual outcome.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 112.1 — Goel M, Nathani RR, Sodhani S. Eosinophilic Gastroenteritis. StatPearls [Internet]. Treasure Island (FL): StatPearls Publishing; updated 2026 Apr 15. PMID 31613509.**

- URL: https://pubmed.ncbi.nlm.nih.gov/31613509/
- Source checked on: 2026-09-23
- Locator: PMID 31613509; Klein-classification phenotype-presentation mapping
- Note under review: Current-evidence review: EGE defined by eosinophilic inflammation beyond the esophagus with Klein mucosal/muscularis/serosal classification, symptom presentation dependent on layer and depth involved - the phenotype-stratification and mucosal-presentation anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 112.2 — Chehade M, Magid MS, Mofidi S, et al. Allergic eosinophilic gastroenteritis with protein-losing enteropathy: intestinal pathology, clinical course, and long-term follow-up. J Pediatr Gastroenterol Nutr. 2006 May;42(5):516-521. PMID 16707973.**

- URL: https://pubmed.ncbi.nlm.nih.gov/16707973/
- Source checked on: 2026-09-23
- Locator: PMID 16707973; EGE-PLE pathology and course
- Note under review: Pediatric series of allergic EGE with protein-losing enteropathy: hypoalbuminemia and edema from intestinal protein loss with response to antigen-avoidance - the mucosal protein-loss anchor, used with the case-series-class guard.
- Current state: `verified: false` — pending qualified-human decision

**Row 112.3 — Hui CK, Hui N. A Prospective Study on the Prevalence, Extent of Disease and Outcome of Eosinophilic Gastroenteritis in Patients Presenting with Lower Abdominal Symptoms. Gut Liver. 2018 May 15;12(3):288-296. PMID 29212311.**

- URL: https://pubmed.ncbi.nlm.nih.gov/29212311/
- Source checked on: 2026-09-23
- Locator: PMID 29212311; 64/2,469 prevalence and outcome findings
- Note under review: Prospective 2,469-patient colonoscopy cohort with 64 EGE cases: disease extent, peripheral eosinophilia, and outcome by severity - the population-context anchor for disease burden.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `eosinophilic-gastroenteritis` → `anemia` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The 2,469-patient prospective cohort documented EGE in 64 patients presenting with lower abdominal symptoms and characterized disease extent and severity outcomes (Hui 2018), and the review literature records occult gastrointestinal blood loss with iron-deficiency anemia among the recognized mucosal-EGE presentations (Goel 2026); eosinophil-mediated mucosal injury is the proposed bleeding substrate.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the prevalence cohort does not report anemia incidence by Klein layer, the anemia association is review-level for a disease whose English-language evidence is case-series class, and iron deficiency in an EGE patient must be separated from elimination-diet iron intake, corticosteroid-related gastropathy, and menstrual or other independent losses.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 113.1 — Hui CK, Hui N. A Prospective Study on the Prevalence, Extent of Disease and Outcome of Eosinophilic Gastroenteritis in Patients Presenting with Lower Abdominal Symptoms. Gut Liver. 2018 May 15;12(3):288-296. PMID 29212311.**

- URL: https://pubmed.ncbi.nlm.nih.gov/29212311/
- Source checked on: 2026-09-23
- Locator: PMID 29212311; 64/2,469 prevalence and outcome findings
- Note under review: Prospective 2,469-patient colonoscopy cohort with 64 EGE cases: prevalence, extent of disease, and severity outcomes - the population-context anchor in a rare-disease literature dominated by case reports.
- Current state: `verified: false` — pending qualified-human decision

**Row 113.2 — Goel M, Nathani RR, Sodhani S. Eosinophilic Gastroenteritis. StatPearls [Internet]. Treasure Island (FL): StatPearls Publishing; updated 2026 Apr 15. PMID 31613509.**

- URL: https://pubmed.ncbi.nlm.nih.gov/31613509/
- Source checked on: 2026-09-23
- Locator: PMID 31613509; mucosal-phenotype anemia presentation
- Note under review: Current-evidence review: mucosal-dominant EGE presents with bleeding, anemia, malabsorption, and protein loss depending on layer involvement - the phenotype-presentation anchor for the anemia association.
- Current state: `verified: false` — pending qualified-human decision

**Row 113.3 — Chehade M, Magid MS, Mofidi S, et al. Allergic eosinophilic gastroenteritis with protein-losing enteropathy: intestinal pathology, clinical course, and long-term follow-up. J Pediatr Gastroenterol Nutr. 2006 May;42(5):516-521. PMID 16707973.**

- URL: https://pubmed.ncbi.nlm.nih.gov/16707973/
- Source checked on: 2026-09-23
- Locator: PMID 16707973; mucosal injury pathology
- Note under review: Pediatric EGE-PLE series documenting mucosal eosinophilic injury to epithelium and vasculature - the mucosal-injury substrate anchor, used with the case-series-class guard.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `eosinophilic-myocarditis` → `congestive-heart-failure` — DIRECT_CAUSATION

**Proposition (direct_causation):** Endomyocardial-biopsy-proven eosinophilic myocarditis -> eosinophil-mediated myocyte necrosis with eosinophilic microabscesses and endomyocardial fibrosis -> reduced systolic function and clinical heart failure (median LVEF 32% at presentation in the international natural-history cohort).

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 114.1 — Ammirati E, Palazzini M, Lehtonen J, et al. Natural History of Patients With Histologically Proven Acute Eosinophilic Myocarditis. Circulation. 2026 Mar 3;153(9):634-652. PMID 41645905.**

- URL: https://pubmed.ncbi.nlm.nih.gov/41645905/
- Source checked on: 2026-09-23
- Locator: PMID 41645905; LVEF 32% and outcome findings in the natural-history cohort
- Note under review: International 53-center retrospective cohort of 156 biopsy-proven acute eosinophilic myocarditis patients: median LVEF 32% at presentation, high in-hospital and midterm mortality or heart transplantation, peripheral eosinophilia absent in 42.6% - the natural-history quantification anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 114.2 — Ammirati E, Selimi A, Palazzini M, et al. Acute and Chronic Myocarditis in Men and Women. Curr Heart Fail Rep. 2026 Jun 24;23(1):28. PMID 42340531.**

- URL: https://pubmed.ncbi.nlm.nih.gov/42340531/
- Source checked on: 2026-09-23
- Locator: PMID 42340531; eosinophilic-myocarditis sex and etiology findings
- Note under review: Review: eosinophilic myocarditis in men predominate (67-82%) with distinct etiologic spectra across acute myocarditis subtypes - the etiologic-heterogeneity and demographic anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 114.3 — Aljudaibi A, Dutta K, Allam S, et al. Case Report: When inotropy backfires - dobutamine-associated eosinophilic myocarditis. Front Cardiovasc Med. 2026;13:1781601. PMID 42147059.**

- URL: https://pubmed.ncbi.nlm.nih.gov/42147059/
- Source checked on: 2026-09-23
- Locator: PMID 42147059; dobutamine-associated eosinophilic myocarditis course
- Note under review: Case report of hypersensitivity eosinophilic myocarditis presenting as refractory cardiogenic shock requiring LVAD, resolving after drug withdrawal and corticosteroids - the drug-hypersensitivity mechanism and reversibility guard anchor, used with the case-report-class guard.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `epicondylitis` → `ulnar-neuropathy` — ASSOCIATION_ONLY

**Proposition (associationBasis):** Ulnar neuropathy at the cubital tunnel co-occurs with medial epicondylitis at substantially elevated rates across the elbow literature (coexistence documented as a classic clinical association), Kim 2021's shear-wave elastography work demonstrates stiffer nerve mechanics in cubital-tunnel neuropathy consistent with mechanical irritation at the tunnel bordered by the medial epicondyle, and the Zanesco 2025 (847-patient) and Khouja 2024 (431-case) elbow-disease series document medial epicondylitis and ulnar-nerve syndrome as the dominant medial-elbow diagnoses in the same populations.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the shared-mechanical-environment confound (repetitive flexion, valgus loading, and elbow-use occupation drive both conditions and can co-produce them without either causing the other), swelling or inflammatory infiltrate from epicondylitis compressing the adjacent nerve is anatomically plausible but not individually demonstrable, and the generic target identity spans cubital-tunnel and more proximal or distal ulnar lesions that lack the anatomic relationship.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 115.1 — Kim S, Lee GY. Evaluation of the ulnar nerve with shear-wave elastography: a potential tool for diagnosis of cubital tunnel syndrome. Ultrasonography. 2021 Jul;40(3):349-356. PMID 33115185.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33115185/
- Source checked on: 2026-09-23
- Locator: PMID 33115185; cubital-tunnel neuropathy elastography findings
- Note under review: Comparative elastography study of ulnar neuropathy at the cubital tunnel versus medial epicondylitis and controls: stiffer nerve mechanics in cubital-tunnel neuropathy - the mechanical-abnormality anchor at the tunnel adjacent to the medial epicondyle.
- Current state: `verified: false` — pending qualified-human decision

**Row 115.2 — Zanesco L, Uthant R, Arai C, et al. Elbow Disorders in an Outpatient Clinic: An Epidemiological Study. Cureus. 2025 May;17(5):e85029. PMID 40585593.**

- URL: https://pubmed.ncbi.nlm.nih.gov/40585593/
- Source checked on: 2026-09-23
- Locator: PMID 40585593; elbow-disease prevalence distribution
- Note under review: Cross-sectional 847-patient elbow-clinic series: lateral epicondylitis 53.2%, medial epicondylitis 16.2%, cubital tunnel syndrome among the most frequent diagnoses - the population co-occurrence anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 115.3 — Khouja N, Hsinet J, Abdennadher K, et al. Elbow musculoskeletal disorders recognized as occupational diseases in Tunisia. Tunis Med. 2024 Apr;102(4):229-234. PMID 38746963.**

- URL: https://pubmed.ncbi.nlm.nih.gov/38746963/
- Source checked on: 2026-09-23
- Locator: PMID 38746963; elbow occupational-disease distribution and shared exposures
- Note under review: 431-case occupational-disease series: medial epicondylitis (14.2%) and ulnar nerve syndrome (10.7%) co-listed among recognized elbow disorders with shared repetitive-movement exposure (92.8%) - the shared-exposure confound anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `epidermolysis-bullosa-acquired` → `esophageal-stricture` — ASSOCIATION_ONLY

**Proposition (associationBasis):** Esophageal involvement with stricture formation is documented in epidermolysis bullosa acquisita: Figueredo 2021 reports an EBA patient with esophageal stricture requiring serial endoscopic intervention, Moura 2011 reports EBA complicated by esophageal stenosis managed endoscopically, and the Lambert 2026 review of subepidermal autoimmune blistering disease links antibody class and target antigen to mucosal scarring phenotypes; blister-scar cycles in the esophageal mucosa are the accepted mechanism in the case-class literature.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the evidence is case-report class without denominators (EBA esophageal involvement is rare), strictures in esophageal disease require exclusion of caustic injury, medication esophagitis, reflux disease, radiation, and malignancy, and mucosal involvement in EBA is uncommon relative to skin-predominant presentations; the mapping asserts the documented association, not a population rate.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 116.1 — Figueredo C, Boroda K, Hertan H. Epidermolysis bullosa acquisita: an uncommon cause of esophageal stricture. Oxf Med Case Reports. 2021 Apr;2021(4):omab010. PMID 33948183.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33948183/
- Source checked on: 2026-09-23
- Locator: PMID 33948183; EBA esophageal stricture presentation
- Note under review: Case report of EBA causing esophageal stricture requiring endoscopic management - the direct EBA-to-stricture case anchor, used with the case-report-class guard.
- Current state: `verified: false` — pending qualified-human decision

**Row 116.2 — Moura EG, Couto-Junior DS, Alvarado-Escobar H, et al. Epidermolysis bullosa acquisita complicated by esophageal stenosis: endoscopic management. Rev Gastroenterol Mex. 2011 Jul-Sep;76(3):279-285. PMID 22041322.**

- URL: https://pubmed.ncbi.nlm.nih.gov/22041322/
- Source checked on: 2026-09-23
- Locator: PMID 22041322; endoscopic management of EBA esophageal stenosis
- Note under review: Case report with endoscopic documentation of EBA-complicated esophageal stenosis - the second case anchor supporting the recurring blister-scar mechanism, used with the case-report-class guard.
- Current state: `verified: false` — pending qualified-human decision

**Row 116.3 — Lambert RA, Noot CH, Frost Z, et al. The role of antibody class and target on subepidermal blistering disease phenotype. Ital J Dermatol Venerol. 2026 Jun;161(3):222-235. PMID 41838476.**

- URL: https://pubmed.ncbi.nlm.nih.gov/41838476/
- Source checked on: 2026-09-23
- Locator: PMID 41838476; antibody-target phenotype mapping in subepidermal blistering disease
- Note under review: Review of subepidermal autoimmune blistering diseases linking antibody class and target antigen (including type VII collagen in EBA) to clinical phenotype and mucosal scarring severity - the mechanistic anchor for the blister-scar stenosis pathway.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `epididymitis-orchitis` → `testicular-atrophy` — ASSOCIATION_ONLY

**Proposition (associationBasis):** Testicular atrophy after orchitis is ultrasonographically documented: Choi 2020's series of eight post-mumps-orchitis patients found atrophic testes 23-55% smaller in volume (mean 44.7% loss) at 25-230 days after the orchitis episode, Yapanoglu 2010's long-term follow-up documents significantly lower sperm density and counts with elevated FSH and LH in the orchitis-atrophy groups, and the imaging literature reviews testicular atrophy as a recognized sequela of severe epididymo-orchitis generally.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the quantified volume-loss evidence is mumps-orchitis scoped while the primary identity is generic (bacterial epididymitis, viral orchitis, and non-infectious inflammations differ in severity and tissue pressure), atrophy must be distinguished from pre-existing volume asymmetry and prior torsion or trauma, and endocrine compensation by the contralateral testis means sonographic atrophy does not equal functional failure in the individual.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 117.1 — Choi HI, Yang DM, Kim HC, et al. Testicular atrophy after mumps orchitis: ultrasonographic findings. Ultrasonography. 2020 Jul;39(3):266-271. PMID 32299198.**

- URL: https://pubmed.ncbi.nlm.nih.gov/32299198/
- Source checked on: 2026-09-23
- Locator: PMID 32299198; post-orchitis volume-loss findings
- Note under review: Ultrasonographic series of eight post-mumps-orchitis patients: atrophic testes 23-55% (mean 44.7%) smaller at 25-230 days after the episode - the volume-loss quantification anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 117.2 — Yapanoglu T, Kocaturk H, Aksoy Y, et al. Long-term efficacy and safety of interferon-alpha-2B in patients with mumps orchitis. Int Urol Nephrol. 2010 Dec;42(4):867-871. PMID 20431945.**

- URL: https://pubmed.ncbi.nlm.nih.gov/20431945/
- Source checked on: 2026-09-23
- Locator: PMID 20431945; post-orchitis testicular function follow-up
- Note under review: Follow-up study with semen analysis and FSH/LH comparison across orchitis-atrophy and hypotrophy groups: significantly impaired sperm parameters and elevated gonadotropins in the atrophy groups - the functional-consequence anchor, used with the mumps-scope guard.
- Current state: `verified: false` — pending qualified-human decision

**Row 117.3 — Ramachandran A, Das CJ, Razik A, et al. Male genital tract tuberculosis: a comprehensive review of imaging findings. Abdom Radiol (NY). 2021 Apr;46(4):1677-1686. PMID 33044653.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33044653/
- Source checked on: 2026-09-23
- Locator: PMID 33044653; post-infectious testicular atrophy and fibrosis imaging findings
- Note under review: Imaging review documenting testicular atrophy, fibrosis, and calcification as healing sequelae of severe granulomatous epididymo-orchitis - the non-viral (bacterial/granulomatous) pathway anchor, used with the review-class guard.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `episcleritis` → `insomnia` — ASSOCIATION_ONLY

**Proposition (associationBasis):** In the Friberg 2014 burden survey of 100 painful idiopathic small-fiber neuropathy patients, sleep disturbance/insomnia was the most common comorbidity at 37.0% and the sleep index (45.1/100) and pain interference (5.0/10) worsened significantly with pain severity (all p < 0.002); erythromelalgia belongs to this small-fiber pain-disorder class, and the Caldito 2024 review documents recurrent bouts of burning pain and sleep disruption as characteristic of the condition.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the quantified comorbidity prevalence is SFN-population scoped rather than erythromelalgia-specific, reverse direction is live (poor sleep lowers pain thresholds and amplifies burning episodes), and insomnia must meet documented diagnostic criteria rather than self-report.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 118.1 — Schaefer C, Mann R, Sadosky A, et al. Health status, function, productivity, and costs among individuals with idiopathic painful peripheral small-fiber neuropathy. J Med Econ. 2014 Jun;17(6):394-407. PMID 24673364.**

- URL: https://pubmed.ncbi.nlm.nih.gov/24673364/
- Source checked on: 2026-09-23
- Locator: PMID 24673364; 37% insomnia comorbidity in painful SFN
- Note under review: Burden survey of 100 painful idiopathic SFN patients: sleep disturbance/insomnia the most common comorbidity (37.0%), sleep index 45.1/100 worsening with pain severity (p < 0.002) - the comorbidity quantification anchor, applied with the population-scope guard.
- Current state: `verified: false` — pending qualified-human decision

**Row 118.2 — Mantyh WG, Dyck PJB, Dyck PJ, et al. Epidermal Nerve Fiber Quantification in Patients With Erythromelalgia. JAMA Dermatol. 2017 Feb 1;153(2):162-167. PMID 27926760.**

- URL: https://pubmed.ncbi.nlm.nih.gov/27926760/
- Source checked on: 2026-09-23
- Locator: PMID 27926760; epidermal nerve fiber findings in erythromelalgia
- Note under review: Mayo Clinic 52-patient cohort: small-fiber structural pathology (reduced epidermal nerve fiber density or swellings) in a substantial share of erythromelalgia patients - the class-membership anchor placing erythromelalgia within the small-fiber pain-disorder group.
- Current state: `verified: false` — pending qualified-human decision

**Row 118.3 — Caldito EG, Caldito NG, Kaul S, et al. Erythromelalgia. Part II: Differential diagnoses and management. J Am Acad Dermatol. 2024 Mar;90(3):465-474. PMID 37364616.**

- URL: https://pubmed.ncbi.nlm.nih.gov/37364616/
- Source checked on: 2026-09-23
- Locator: PMID 37364616; sleep disruption in erythromelalgia management review
- Note under review: Review: recurrent burning pain episodes with sleep disruption documented as characteristic of the condition and management frequently directed at nighttime relief - the erythromelalgia-specific narrative anchor, used with the no-prevalence-data guard.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `episcleritis` → `unexplained-chronic-pain` — ASSOCIATION_ONLY

**Proposition (associationBasis):** Erythromelalgia is characterized in the JAAD two-part review as a rare, underrecognized, difficult-to-treat pain disorder with disabling extremity erythema and burning (Caldito 2024 Part I), and the Mantyh 2017 Mayo Clinic cohort documents small-fiber structural pathology in a large share of consecutive patients, aligning the condition with the chronic-neuropathic-pain spectrum the unexplained-chronic-pain identity captures.

**Causation boundary (causationStatus):** The mapping does not assert causation: the chronic pain is the disease's own defining presentation rather than a downstream outcome, so the edge is an association-of-co-occurrence for case-matching purposes only; individual claims require documented erythromelalgia plus separately documented chronic pain attribution and exclusion of other pain generators.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 119.1 — Caldito EG, Kaul S, Caldito NG, et al. Erythromelalgia. Part I: Pathogenesis, clinical features, evaluation, and complications. J Am Acad Dermatol. 2024 Mar;90(3):453-462. PMID 37364617.**

- URL: https://pubmed.ncbi.nlm.nih.gov/37364617/
- Source checked on: 2026-09-23
- Locator: PMID 37364617; disabling pain burden in erythromelalgia review
- Note under review: Review: erythromelalgia is a rare, underrecognized, difficult-to-treat pain disorder with disabling extremity erythema and pain, genetic or secondary or idiopathic - the disabling-chronic-pain character anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 119.2 — Mantyh WG, Dyck PJB, Dyck PJ, et al. Epidermal Nerve Fiber Quantification in Patients With Erythromelalgia. JAMA Dermatol. 2017 Feb 1;153(2):162-167. PMID 27926760.**

- URL: https://pubmed.ncbi.nlm.nih.gov/27926760/
- Source checked on: 2026-09-23
- Locator: PMID 27926760; nerve fiber pathology in erythromelalgia
- Note under review: Mayo Clinic 52-patient cohort documenting small-fiber structural pathology in erythromelalgia - the structural-basis anchor for the chronic neuropathic-pain alignment.
- Current state: `verified: false` — pending qualified-human decision

**Row 119.3 — Caldito EG, Caldito NG, Kaul S, et al. Erythromelalgia. Part II: Differential diagnoses and management. J Am Acad Dermatol. 2024 Mar;90(3):465-474. PMID 37364616.**

- URL: https://pubmed.ncbi.nlm.nih.gov/37364616/
- Source checked on: 2026-09-23
- Locator: PMID 37364616; treatment-refractory pain in erythromelalgia
- Note under review: Management review: treatment difficulty and incomplete relief document the persistent, treatment-refractory character of the pain - the chronicity anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `erythromelalgia` → `insomnia` — ASSOCIATION_ONLY

**Proposition (associationBasis):** In the Friberg 2014 burden survey of 100 painful idiopathic small-fiber neuropathy patients, sleep disturbance/insomnia was the most common comorbidity at 37.0% and the sleep index (45.1/100) and pain interference (5.0/10) worsened significantly with pain severity (all p < 0.002); erythromelalgia belongs to this small-fiber pain-disorder class, and the Caldito 2024 management review documents recurrent burning-pain episodes and sleep disruption as characteristic of the condition.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the quantified comorbidity prevalence is SFN-population scoped rather than erythromelalgia-specific, reverse direction is live (poor sleep lowers pain thresholds and amplifies burning episodes), and insomnia must meet documented diagnostic criteria rather than self-report.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 120.1 — Schaefer C, Mann R, Sadosky A, et al. Health status, function, productivity, and costs among individuals with idiopathic painful peripheral small-fiber neuropathy. J Med Econ. 2014 Jun;17(6):394-407. PMID 24673364.**

- URL: https://pubmed.ncbi.nlm.nih.gov/24673364/
- Source checked on: 2026-09-23
- Locator: PMID 24673364; 37% insomnia comorbidity in painful SFN
- Note under review: Burden survey of 100 painful idiopathic SFN patients: sleep disturbance/insomnia the most common comorbidity (37.0%), sleep index 45.1/100 worsening with pain severity (p < 0.002) - the comorbidity quantification anchor, applied with the population-scope guard.
- Current state: `verified: false` — pending qualified-human decision

**Row 120.2 — Mantyh WG, Dyck PJB, Dyck PJ, et al. Epidermal Nerve Fiber Quantification in Patients With Erythromelalgia. JAMA Dermatol. 2017 Feb 1;153(2):162-167. PMID 27926760.**

- URL: https://pubmed.ncbi.nlm.nih.gov/27926760/
- Source checked on: 2026-09-23
- Locator: PMID 27926760; epidermal nerve fiber findings in erythromelalgia
- Note under review: Mayo Clinic 52-patient cohort: small-fiber structural pathology (reduced epidermal nerve fiber density or swellings) in a substantial share of erythromelalgia patients - the class-membership anchor placing erythromelalgia within the small-fiber pain-disorder group.
- Current state: `verified: false` — pending qualified-human decision

**Row 120.3 — Caldito EG, Caldito NG, Kaul S, et al. Erythromelalgia. Part II: Differential diagnoses and management. J Am Acad Dermatol. 2024 Mar;90(3):465-474. PMID 37364616.**

- URL: https://pubmed.ncbi.nlm.nih.gov/37364616/
- Source checked on: 2026-09-23
- Locator: PMID 37364616; sleep disruption in erythromelalgia management review
- Note under review: Review: recurrent burning-pain episodes with sleep disruption documented as characteristic of the condition and management frequently directed at nighttime relief - the erythromelalgia-specific narrative anchor, used with the no-prevalence-data guard.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `erythromelalgia` → `unexplained-chronic-pain` — ASSOCIATION_ONLY

**Proposition (associationBasis):** Erythromelalgia is characterized in the JAAD two-part review as a rare, underrecognized, difficult-to-treat pain disorder with disabling extremity erythema and burning (Caldito 2024 Part I), and the Mantyh 2017 Mayo Clinic cohort documents small-fiber structural pathology in a large share of consecutive patients, aligning the condition with the chronic-neuropathic-pain spectrum the unexplained-chronic-pain identity captures.

**Causation boundary (causationStatus):** The mapping does not assert causation: the chronic pain is the disease's own defining presentation rather than a downstream outcome, so the edge is an association-of-co-occurrence for case-matching purposes only; individual claims require documented erythromelalgia plus separately documented chronic pain attribution and exclusion of other pain generators.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 121.1 — Caldito EG, Kaul S, Caldito NG, et al. Erythromelalgia. Part I: Pathogenesis, clinical features, evaluation, and complications. J Am Acad Dermatol. 2024 Mar;90(3):453-462. PMID 37364617.**

- URL: https://pubmed.ncbi.nlm.nih.gov/37364617/
- Source checked on: 2026-09-23
- Locator: PMID 37364617; disabling pain burden in erythromelalgia review
- Note under review: Review: erythromelalgia is a rare, underrecognized, difficult-to-treat pain disorder with disabling extremity erythema and pain, genetic or secondary or idiopathic - the disabling-chronic-pain character anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 121.2 — Mantyh WG, Dyck PJB, Dyck PJ, et al. Epidermal Nerve Fiber Quantification in Patients With Erythromelalgia. JAMA Dermatol. 2017 Feb 1;153(2):162-167. PMID 27926760.**

- URL: https://pubmed.ncbi.nlm.nih.gov/27926760/
- Source checked on: 2026-09-23
- Locator: PMID 27926760; nerve fiber pathology in erythromelalgia
- Note under review: Mayo Clinic 52-patient cohort documenting small-fiber structural pathology in erythromelalgia - the structural-basis anchor for the chronic neuropathic-pain alignment.
- Current state: `verified: false` — pending qualified-human decision

**Row 121.3 — Caldito EG, Caldito NG, Kaul S, et al. Erythromelalgia. Part II: Differential diagnoses and management. J Am Acad Dermatol. 2024 Mar;90(3):465-474. PMID 37364616.**

- URL: https://pubmed.ncbi.nlm.nih.gov/37364616/
- Source checked on: 2026-09-23
- Locator: PMID 37364616; treatment-refractory pain in erythromelalgia
- Note under review: Management review: treatment difficulty and incomplete relief document the persistent, treatment-refractory character of the pain - the chronicity anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `erythroplasia-of-queyrat` → `squamous-cell-carcinoma` — ASSOCIATION_ONLY

**Proposition (associationBasis):** In the largest PeIN series (345 patients, Kravvas 2022), 8.7% had concomitant invasive penile squamous cell carcinoma at presentation and 2.6% progressed to invasive SCC during follow-up, and the Proietti 2021 series reiterates that erythroplasia of Queyrat is squamous cell carcinoma in situ of the glans with invasive potential; population series place progression risk broadly in the low single digits to one-third range depending on duration and treatment.

**Causation boundary (causationStatus):** The mapping does not assert a normal-tissue carcinogenesis pathway: EQ is SCC in situ, so the relationship is the in-situ-to-invasive identity transition of the same neoplasm; individual claims require biopsy-proven in-situ disease at baseline, histologic confirmation of invasion, and exclusion of de novo invasive carcinoma; the coexistence figures are PeIN-population scoped and cannot establish individual progression timing.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 122.1 — Kravvas G, Ge L, Ng J, et al. The management of penile intraepithelial neoplasia (PeIN): clinical and histological characteristics, treatments and outcomes of 345 patients. J Dermatolog Treat. 2022 Mar;33(2):1047-1062. PMID 32705920.**

- URL: https://pubmed.ncbi.nlm.nih.gov/32705920/
- Source checked on: 2026-09-23
- Locator: PMID 32705920; 8.7% concomitant and 2.6% progression findings
- Note under review: Largest PeIN series (345 patients): concomitant invasive penile SCC at presentation 8.7%, progression to invasive SCC 2.6%, HPV present in 58% and lichen-sclerosus features in 12-41% - the coexistence and progression anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 122.2 — Proietti I, Michelini S, Skroza N, et al. Ingenol mebutate therapy in erythroplasia of Queyrat: a new approach. Ital J Dermatol Venerol. 2021 Jun;156(3):388-391. PMID 31804047.**

- URL: https://pubmed.ncbi.nlm.nih.gov/31804047/
- Source checked on: 2026-09-23
- Locator: PMID 31804047; EQ as SCC in situ
- Note under review: EQ treatment series opening with the identity statement that erythroplasia of Queyrat is a rare squamous cell carcinoma in situ of the glans - the in-situ identity anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `erythropoietic-protoporphyria` → `cholelithiasis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** Gallstone development at an early age is a recognized EPP complication (Minder 1993 review of the disease course), porphyrin-rich pigment stones are documented in EPP patients including the Lock 1996 case with more than 20 years of symptomatic gallstones, and the mechanism literature attributes stones to excess protoporphyrin excreted in bile precipitating as pigment calculi; the overview literature records cholelithiasis as a characteristic childhood-or-early-adulthood feature of the disease.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: EPP-population gallstone prevalence is not precisely stratified in the registry literature, pigment stones share risk factors with other cholestatic and hemolytic states, and ultrasound documentation of stones with composition assessment is required rather than symptom attribution.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 123.1 — Minder EI, Schneider-Yin X. Often unrecognized: erythropoietic protoporphyria. Schweiz Med Wochenschr. 1993 Feb 13;123(6):229-233. PMID 8434252.**

- URL: https://pubmed.ncbi.nlm.nih.gov/8434252/
- Source checked on: 2026-09-23
- Locator: PMID 8434252; early-age gallstone complication statement
- Note under review: Disease-course review: development of gallstones at an early age is one possible complication of EPP, and terminal liver failure from intrahepatic protoporphyrin deposition is rare but fatal - the early-gallstone and liver-complication anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 123.2 — Lock G, Holstege A, Mueller AR, et al. Liver failure in erythropoietic protoporphyria associated with choledocholithiasis and severe post-transplantation polyneuropathy. Liver. 1996 Jun;16(3):211-217. PMID 8873010.**

- URL: https://pubmed.ncbi.nlm.nih.gov/8873010/
- Source checked on: 2026-09-23
- Locator: PMID 8873010; symptomatic gallstones and porphyrin physiology in EPP
- Note under review: Case documenting more than 20 years of symptomatic gallstones in an EPP patient with porphyrin-rich stone physiology and the interaction of choledocholithiasis with protoporphyric cholestasis - the pigment-stone case anchor, used with the case-report-class guard.
- Current state: `verified: false` — pending qualified-human decision

**Row 123.3 — Levy C, Naik H, Overbey J, et al. Liver involvement in a large cohort of patients with erythropoietic protoporphyria and X-linked protoporphyria. Hepatol Commun. 2025 Mar 1;9(3):e0657. PMID 39969427.**

- URL: https://pubmed.ncbi.nlm.nih.gov/39969427/
- Source checked on: 2026-09-23
- Locator: PMID 39969427; 56.2% liver-chemistry abnormality and hepatopathy findings
- Note under review: National longitudinal registry (322 patients): 56.2% with any liver-chemistry abnormality, 3.4% with advanced protoporphyric hepatopathy, 62.5% of deaths attributable to liver disease - the population liver-burden anchor (used on both EPP edges with the EPP/XLP pooling guard).
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `erythropoietic-protoporphyria` → `chronic-liver-disease` — ASSOCIATION_ONLY

**Proposition (associationBasis):** In the Levy 2025 national longitudinal registry of 322 EPP/XLP patients, 56.2% had liver-chemistry abnormalities (associated with higher erythrocyte protoporphyrin levels), 3.4% had advanced protoporphyric hepatopathy with most requiring transplantation, and 62.5% of cohort deaths were attributable to liver disease; the Meerman 2000 overview documents intrahepatic protoporphyrin deposition with canalicular obstruction and progressive fibrosis as the hepatotoxic mechanism.

**Causation boundary (causationStatus):** Neither causation nor aggravation is established at the mapping level: the registry pools EPP with X-linked protoporphyria, most chemistry abnormalities remain mild without progressive disease, and advanced hepatopathy is uncommon; individual claims require documented hepatic involvement with protoporphyrin physiology confirmed and other liver diseases excluded.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 124.1 — Levy C, Naik H, Overbey J, et al. Liver involvement in a large cohort of patients with erythropoietic protoporphyria and X-linked protoporphyria. Hepatol Commun. 2025 Mar 1;9(3):e0657. PMID 39969427.**

- URL: https://pubmed.ncbi.nlm.nih.gov/39969427/
- Source checked on: 2026-09-23
- Locator: PMID 39969427; hepatopathy prevalence and mortality findings
- Note under review: National longitudinal registry (322 patients): 56.2% liver-chemistry abnormalities tied to protoporphyrin levels, 3.4% advanced hepatopathy mostly transplant-requiring, 62.5% of deaths liver-attributable - the population anchor for the hepatic association.
- Current state: `verified: false` — pending qualified-human decision

**Row 124.2 — Meerman L. Erythropoietic protoporphyria. An overview with emphasis on the liver. Scand J Gastroenterol Suppl. 2000;(232):79-85. PMID 11232498.**

- URL: https://pubmed.ncbi.nlm.nih.gov/11232498/
- Source checked on: 2026-09-23
- Locator: PMID 11232498; protoporphyrin hepatotoxicity overview
- Note under review: Hepatic overview: protoporphyrin insolubility produces canalicular deposition, cholestasis, and progressive fibrosis in the severe minority - the mechanism anchor for the hepatic pathway.
- Current state: `verified: false` — pending qualified-human decision

**Row 124.3 — Minder EI, Schneider-Yin X. Often unrecognized: erythropoietic protoporphyria. Schweiz Med Wochenschr. 1993 Feb 13;123(6):229-233. PMID 8434252.**

- URL: https://pubmed.ncbi.nlm.nih.gov/8434252/
- Source checked on: 2026-09-23
- Locator: PMID 8434252; liver-failure rarity and severity statement
- Note under review: Disease-course review: terminal liver failure from intrahepatic protoporphyrin deposition is a rare but fatal complication treatable only by transplantation - the severity-distribution anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `esophageal-stricture` → `dysphagia` — DIRECT_CAUSATION

**Proposition (direct_causation):** Endoscopically documented esophageal stricture (fixed luminal narrowing from peptic, eosinophilic, caustic, radiation, or anastomotic injury) -> mechanical impedance of bolus transit through the narrowed lumen -> solid-food dysphagia and, in tighter strictures, dysphagia to liquids with food impaction requiring dilation.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 125.1 — Pregun I, Hritz I, Tulassay Z, Herszenyi L. Peptic esophageal stricture: medical treatment. Dig Dis. 2009;27(1):31-37. PMID 19439958.**

- URL: https://pubmed.ncbi.nlm.nih.gov/19439958/
- Source checked on: 2026-09-23
- Locator: PMID 19439958; stricture outcome and dilation findings
- Note under review: Review of peptic stricture management: dilation and surgery are the therapeutic mainstays for the mechanical narrowing, and healing coexistent esophagitis with PPI reduces repeated dilations - the stricture-as-obstruction anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 125.2 — Cohen DL, Bermont A, Richter V, Shirin H. Real world management of esophageal ulcers: analysis of their presentation, complications and outcomes. Acta Gastroenterol Belg. 2021 Jul-Sep;84(3):417-422. PMID 34599565.**

- URL: https://pubmed.ncbi.nlm.nih.gov/34599565/
- Source checked on: 2026-09-23
- Locator: PMID 34599565; esophageal-ulcer complication outcomes
- Note under review: 11-year 100-patient esophageal-ulcer series: most ulcers due to gastroesophageal reflux with stricture the principal chronic sequela - the ulcer-to-stricture-to-dysphagia outcome anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 125.3 — Pearson EG, Downey EC, Barnhart DC, et al. Reflux esophageal stricture - a review of 30 years' experience in children. J Pediatr Surg. 2010 Dec;45(12):2356-2360. PMID 21129544.**

- URL: https://pubmed.ncbi.nlm.nih.gov/21129544/
- Source checked on: 2026-09-23
- Locator: PMID 21129544; 30-year stricture management experience
- Note under review: 30-year 114-child series: reflux strictures requiring 486 dilations with refractory disease needing surgery - the severity-burden anchor for stricture dysphagia.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `esophagitis` → `esophageal-stricture` — DIRECT_CAUSATION

**Proposition (direct_causation):** Documented esophagitis (reflux, infectious, pill-induced, or eosinophilic) with mucosal injury -> ulceration and inflammation extending to the submucosa -> fibrotic repair with collagen deposition and circumferential scar contracture -> fixed esophageal stricture.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 126.1 — Pregun I, Hritz I, Tulassay Z, Herszenyi L. Peptic esophageal stricture: medical treatment. Dig Dis. 2009;27(1):31-37. PMID 19439958.**

- URL: https://pubmed.ncbi.nlm.nih.gov/19439958/
- Source checked on: 2026-09-23
- Locator: PMID 19439958; esophagitis healing reducing stricture dilations
- Note under review: Review: healing the coexistent esophagitis is essential to peptic-stricture outcome and effective acid suppression reduces the need for repeated dilations - the inflammation-dependency anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 126.2 — Cohen DL, Bermont A, Richter V, Shirin H. Real world management of esophageal ulcers: analysis of their presentation, complications and outcomes. Acta Gastroenterol Belg. 2021 Jul-Sep;84(3):417-422. PMID 34599565.**

- URL: https://pubmed.ncbi.nlm.nih.gov/34599565/
- Source checked on: 2026-09-23
- Locator: PMID 34599565; ulcer complication outcomes
- Note under review: 11-year 100-patient series: most esophageal ulcers are reflux-related with stricture the principal chronic sequela - the ulcer-to-stricture outcome anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 126.3 — Pearson EG, Downey EC, Barnhart DC, et al. Reflux esophageal stricture - a review of 30 years' experience in children. J Pediatr Surg. 2010 Dec;45(12):2356-2360. PMID 21129544.**

- URL: https://pubmed.ncbi.nlm.nih.gov/21129544/
- Source checked on: 2026-09-23
- Locator: PMID 21129544; 30-year stricture experience
- Note under review: 30-year 114-child series of reflux esophagitis strictures requiring 486 dilations with refractory disease needing surgery - the untreated-inflammation progression anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `excoriation-disorder` → `scars` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The Bowes 2004 report documents compulsive skin picking (acne excoriée) producing linear and stellate facial ulcers with hypertrophic and erythematous scarring, the Ekore 2021 study documents excoriation disorder in adolescents and young adults presenting with acne-induced postinflammatory hyperpigmentation and scars, and the Grant 2012 review documents repetitive picking causing tissue damage as the core clinical presentation; the literature connects the behavior to cutaneous outcomes but does not quantify an individual scarring nexus.

**Causation boundary (causationStatus):** The mapping does not assert that every scar in a person with excoriation disorder was caused by picking: acne and other primary dermatologic disease independently scar, and postinflammatory pigment change can mimic scar; individual claims require documented picking behavior preceding documented scars, compatible anatomic distribution over accessible skin, and exclusion of primary scarring disease.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 127.1 — Grant JE, Odlaug BL, Chamberlain SR, Keuthen NJ, Lochner C, Stein DJ. Skin picking disorder. Am J Psychiatry. 2012 Nov;169(11):1143-1149. PMID 23128921.**

- URL: https://pubmed.ncbi.nlm.nih.gov/23128921/
- Source checked on: 2026-09-23
- Locator: PMID 23128921; picking causing tissue damage
- Note under review: DSM-5-era review: repetitive picking causes tissue damage with clinical evaluation and management recommendations - the disorder-identity and tissue-damage anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 127.2 — Bowes LE, Alster TS. Treatment of facial scarring and ulceration resulting from acne excoriée with 585-nm pulsed dye laser irradiation and cognitive psychotherapy. Dermatol Surg. 2004 Jun;30(6):934-938. PMID 15171775.**

- URL: https://pubmed.ncbi.nlm.nih.gov/15171775/
- Source checked on: 2026-09-23
- Locator: PMID 15171775; self-inflicted ulcers and scars from compulsive picking
- Note under review: Case reports of compulsive picking producing linear and stellate facial ulcers with hypertrophic and erythematous scars - the picking-to-scar outcome anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 127.3 — Ekore RI, Ekore JO. Excoriation (skin-picking) disorder among adolescents and young adults with acne-induced postinflammatory hyperpigmentation and scars. Int J Dermatol. 2021 Dec;60(12):1488-1493. PMID 33860536.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33860536/
- Source checked on: 2026-09-23
- Locator: PMID 33860536; SPD with hyperpigmentation and scars
- Note under review: Cross-sectional study documenting excoriation disorder among adolescents and young adults presenting with acne-induced postinflammatory hyperpigmentation and scars - the SPD-scar-coexistence anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `exophthalmos` → `keratitis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The Rodriguez-Garcia 2025 review groups proptosis with eyelid malformations and malfunction as the principal causes of exposure keratopathy, documenting progression from superficial punctate keratitis of the lower third of the cornea through persistent epithelial defects and stromal melting when untreated, and the Gheorghe 2007 review lists exophthalmos/proptosis among the most frequent causes of lagophthalmos; exposure of the unprotected cornea is the documented mechanism, but severity is graded and many proptotic patients never develop keratitis with adequate lubrication and lid protection.

**Causation boundary (causationStatus):** The mapping does not assert that keratitis in a person with exophthalmos was caused by the proptosis: thyroid eye disease, the leading exophthalmos cause, independently produces dry-eye and restrictive orbitopathy, and infectious, autoimmune, neurotrophic, and traumatic keratitis occurs independently; individual claims require documented proptosis with objective lagophthalmos, exposure-pattern corneal findings (typically inferior or interpalpebral), chronology, and exclusion of competing etiologies.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 128.1 — Rodriguez-Garcia A, Ruiz-Lozano RE, Barcelo-Canton RH, Marines-Sanchez HM, Homar Paez-Garza J. The etiologic and pathogenic spectrum of exposure keratopathy: Diagnostic and therapeutic implications. Surv Ophthalmol. 2025 Sep-Oct;70(5):882-899. PMID 40064304.**

- URL: https://pubmed.ncbi.nlm.nih.gov/40064304/
- Source checked on: 2026-09-23
- Locator: PMID 40064304; proptosis among EK causes and progression spectrum
- Note under review: Comprehensive review: exposure keratopathy results from eyelid insufficiency or blinking dysfunction with ocular globe protrusion named among the causes, progressing from superficial punctate keratitis to epithelial defects, stromal melting, and vision loss when untreated - the proptosis-to-EK mechanism anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 128.2 — Gheorghe O. [Lagophthalmic keratopathy]. Oftalmologia. 2007;51(2):3-12. PMID 17937027.**

- URL: https://pubmed.ncbi.nlm.nih.gov/17937027/
- Source checked on: 2026-09-23
- Locator: PMID 17937027; exophthalmos/proptosis as frequent lagophthalmos cause
- Note under review: Review: exposure keratopathy follows any process limiting eyelid closure, with peripheral facial nerve palsy and exophthalmos/proptosis the most frequent causes of lagophthalmos - the exophthalmos-specific lagophthalmos anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `exploding-head-syndrome` → `insomnia` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The Kirwan 2021 study of 135 young adults found lifetime EHS in 20.0% and that participants with EHS reported poorer sleep quality on the PSQI and more anxiety symptoms in univariate analysis, with parasomnia co-occurrence (OR 1.62, 95% CI 1.02-2.57) and action-related sleep disorders (OR 1.87) associated with lifetime EHS in logistic regression; the Sharpless 2014 review documents EHS as loud-noise perceptions at sleep-wake transitions associated with fear and distress; the literature documents co-occurrence but no directional or individual nexus.

**Causation boundary (causationStatus):** The mapping does not assert that EHS causes an individual's insomnia: the association is cross-sectional and univariate (age, gender, and depression symptoms were not related to EHS in the same analysis), the causal direction is unresolved because sleep fragmentation and arousal instability are hypothesized to precipitate parasomnias as well as result from them, and primary insomnia has many independent drivers; individual claims require documented EHS episodes with polysomnographic exclusion of mimics, documented insomnia phenotype, chronology, and exclusion of other sleep pathology.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 129.1 — Kirwan E, Fortune DG. Exploding head syndrome, chronotype, parasomnias and mental health in young adults. J Sleep Res. 2021 Apr;30(2):e13044. PMID 32282101.**

- URL: https://pubmed.ncbi.nlm.nih.gov/32282101/
- Source checked on: 2026-09-23
- Locator: PMID 32282101; EHS with poorer sleep quality and parasomnia co-occurrence
- Note under review: 135-participant young-adult study: lifetime EHS 20.0%, participants with EHS reported poorer PSQI sleep quality and more anxiety symptoms, parasomnia co-occurrence OR 1.62 - the co-occurrence anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 129.2 — Sharpless BA. Exploding head syndrome. Sleep Med Rev. 2014 Dec;18(6):489-493. PMID 24703829.**

- URL: https://pubmed.ncbi.nlm.nih.gov/24703829/
- Source checked on: 2026-09-23
- Locator: PMID 24703829; EHS review and etiological theories
- Note under review: Comprehensive review: EHS characterized by abrupt loud noises at sleep-wake transitions with fear and distress, five etiological theories none of which is dominant - the disorder-identity and mechanism-uncertainty anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 129.3 — Mars JA, Khan I, Slowik JM. Exploding Head Syndrome. StatPearls [Internet]. Treasure Island (FL): StatPearls Publishing; updated 2025 Feb 3. PMID 32809652.**

- URL: https://pubmed.ncbi.nlm.nih.gov/32809652/
- Source checked on: 2026-09-23
- Locator: PMID 32809652; EHS as benign parasomnia with abrupt awakening
- Note under review: StatPearls review: benign parasomnia with sudden loud-noise perception and abrupt awakening during wake-sleep transitions - the diagnostic-identity and transition-timing anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `factitious-disorder` → `scars` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The Rodríguez Pichardo 2013 review of 201 patients with dermatitis artefacta (the cutaneous presentation of factitious disorder) documents chronic self-inflicted lesions including ulcers at accessible sites, the Alcolado 1993 case documents four decades of persistent self-excoriation of a scar site with malignant transformation and death from metastatic squamous carcinoma, and the Choudhary 2009 case documents keloids and foreign-body granuloma produced by deliberate self-inflicted injury; the literature connects conscious self-injury to wound outcomes but does not quantify an individual scarring nexus.

**Causation boundary (causationStatus):** The mapping does not assert that every scar in a person with factitious disorder was self-inflicted: organic dermatologic disease, surgical scars, and self-harm from other psychiatric conditions independently scar; individual claims require documented self-inflicted lesions preceding documented scars, anatomic distribution over accessible skin that does not match organic disease patterns, and exclusion of organic scarring disease.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 130.1 — Rodríguez Pichardo A, García Bravo B. Dermatitis artefacta: a review. Actas Dermosifiliogr. 2013 Dec;104(10):854-866. PMID 23266056.**

- URL: https://pubmed.ncbi.nlm.nih.gov/23266056/
- Source checked on: 2026-09-23
- Locator: PMID 23266056; 201-patient DA series
- Note under review: 201-patient series: chronic self-inflicted lesions including ulcers at accessible sites - the DA-population outcome anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 130.2 — Alcolado JC, Ray K, Baxter M, Edwards CW, Dodson PM. Malignant change in dermatitis artefacta. Postgrad Med J. 1993 Aug;69(814):648-650. PMID 8234114.**

- URL: https://pubmed.ncbi.nlm.nih.gov/8234114/
- Source checked on: 2026-09-23
- Locator: PMID 8234114; Marjolin transformation case
- Note under review: Case report: four decades of persistent self-excoriation with Marjolin-type malignant transformation - the chronic-self-injury severity anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 130.3 — Choudhary SV, Khairkar P, Singh A, Gupta S. Dermatitis artefacta: keloids and foreign body granuloma due to overvalued ideation of acupuncture. Indian J Dermatol Venereol Leprol. 2009 Nov-Dec;75(6):606-608. PMID 19915244.**

- URL: https://pubmed.ncbi.nlm.nih.gov/19915244/
- Source checked on: 2026-09-23
- Locator: PMID 19915244; keloids and foreign-body granuloma case
- Note under review: Case report: keloids and foreign-body granuloma from deliberate self-inflicted injury - the self-injury-to-keloid outcome anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `farmer-s-lung` → `pulmonary-fibrosis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The Braun 1979 cohort followed 141 farmer's lung patients for a mean of 14.8 years and documented radiographic interstitial changes in 39% of surviving subjects with abnormal vital capacity in a further subset, the Lalancette 1993 long-term outcome study of 33 FL patients with HRCT characterized persistent fibrotic change years after the acute episode, and the Soumagne 2017 paper records fibrosis as the most frequent finding in chronic FL while noting three cohort studies documenting emphysema as an alternative chronic outcome; the literature connects recurrent and chronic FL to fibrotic change in documented subsets without establishing an individual fibrosis nexus.

**Causation boundary (causationStatus):** The mapping does not assert that a given farmer's lung patient's fibrosis was caused by the disease: acute FL frequently resolves without residual fibrosis, emphysema is a documented alternative chronic outcome of the same exposure, fibrosis may reflect continued antigen exposure or recurrent acute episodes rather than a single disease course, and interstitial fibrosis has many independent etiologies; individual claims require documented FL episodes (exposure history, precipitins, PFTs) preceding imaging-proven fibrosis, a plausible interval and exposure course, and exclusion of idiopathic, connective-tissue-disease, asbestos, and drug-related causes.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 131.1 — Lalancette M, Carrier G, Laviolette M, et al. Farmer's lung. Long-term outcome and lack of predictive value of bronchoalveolar lavage fibrosing factors. Am Rev Respir Dis. 1993 Jul;148(1):216-221. PMID 8317802.**

- URL: https://pubmed.ncbi.nlm.nih.gov/8317802/
- Source checked on: 2026-09-23
- Locator: PMID 8317802; farmer's lung long-term outcome with HRCT
- Note under review: 33-patient FL long-term outcome study with HRCT and BAL fibrosing markers at 6-year follow-up - the identity-specific chronic-outcome anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 131.2 — Braun SR, doPico GA, Tsiatis A, et al. Farmer's lung disease: long-term clinical and physiologic outcome. Am Rev Respir Dis. 1979 Feb;119(2):185-191. PMID 434591.**

- URL: https://pubmed.ncbi.nlm.nih.gov/434591/
- Source checked on: 2026-09-23
- Locator: PMID 434591; 141-patient long-term outcome with interstitial-change share
- Note under review: 141-patient FL cohort with mean 14.8 years of follow-up: radiographic interstitial changes in 39% of survivors with abnormal lung volumes in a subset - the progression-burden anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 131.3 — Soumagne T, Chardon ML, Dournes G, et al. Emphysema in active farmer's lung disease. PLoS One. 2017;12(6):e0178263. PMID 28614400.**

- URL: https://pubmed.ncbi.nlm.nih.gov/28614400/
- Source checked on: 2026-09-23
- Locator: PMID 28614400; fibrosis as most frequent chronic-FL finding with emphysema alternative
- Note under review: Records fibrosis as the most frequent finding in chronic FL and documents emphysema as the alternative chronic outcome across three cohort studies - the alternative-outcome guard.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `fasciitis` → `amputation-or-loss-of-use` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The White 2026 review documents that necrotizing fasciitis affects the limbs in 40% of cases with 22% 30-day mortality, the Itsiopoulos 2020 case report with literature review documents amputation as an established limb-outcome decision point in NF progression, and the Momtaz 2024 cohort documents amputation and mortality as the composite unfavorable NF outcome with amputation rates varying by socioeconomic status and care access; the literature documents limb loss as an NF outcome without establishing an individual causal nexus.

**Causation boundary (causationStatus):** The mapping does not assert that a given NF patient's amputation was caused by the disease: amputation is a surgical decision mediated by diagnosis delay, comorbidity (diabetes, peripheral arterial disease), debridement adequacy, and access to care, not every limb NF progresses to limb loss, and vascular and traumatic amputations occur independently in the same risk populations; individual claims require operative or histologic confirmation of necrotizing fasciitis, anatomic documentation of limb involvement, chronology of progression to non-salvageability or source-control amputation, and exclusion of independent vascular, diabetic, and traumatic amputation etiologies.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 132.1 — White TO, Ablett AD, Neo C, et al. Necrotizing fasciitis. Bone Joint J. 2026 Sep 1;108-B(9):1078-1086. PMID 42674562.**

- URL: https://pubmed.ncbi.nlm.nih.gov/42674562/
- Source checked on: 2026-09-23
- Locator: PMID 42674562; NF review with limb-involvement share and mortality
- Note under review: Contemporary review: incidence 0.63 per 100,000 per year, limbs affected in 40% of cases, 22% 30-day mortality - the limb-scope and burden anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 132.2 — Itsiopoulos I, Vasiliadis AV, Tsitouras D, et al. Amputation in Necrotizing Fasciitis - Dilemma or Reality: A Case Report and Literature Review. J Orthop Case Rep. 2020 Jul;10(4):54-58. PMID 33623768.**

- URL: https://pubmed.ncbi.nlm.nih.gov/33623768/
- Source checked on: 2026-09-23
- Locator: PMID 33623768; amputation in NF case plus literature review
- Note under review: Dedicated case report with literature review of the amputation decision in NF progression - the limb-loss-outcome anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 132.3 — Momtaz D, Heath D, Ghali A, et al. Socioeconomic status affects amputation and mortality rates in necrotizing fasciitis patients. Int Orthop. 2024 Oct;48(10):2505-2512. PMID 39136700.**

- URL: https://pubmed.ncbi.nlm.nih.gov/39136700/
- Source checked on: 2026-09-23
- Locator: PMID 39136700; amputation and mortality rates with SES variation
- Note under review: Retrospective NF cohort with amputation and mortality as composite unfavorable outcome, rates varying by socioeconomic status - the care-pathway-dependence guard.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `fecal-impaction` → `fecal-incontinence` — DIRECT_CAUSATION

**Proposition (direct_causation):** Documented retained fecal mass in the rectum or sigmoid -> progressive colonic distension with impairment of rectal reservoir sensation -> mass effect exceeding internal sphincter closure pressure -> liquid stool percolating around the obstruction -> passive overflow leakage (fecal incontinence) that resolves when the mass is removed.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 133.1 — Wald A. Management and prevention of fecal impaction. Curr Gastroenterol Rep. 2008 Oct;10(5):499-501. PMID 18799126.**

- URL: https://pubmed.ncbi.nlm.nih.gov/18799126/
- Source checked on: 2026-09-23
- Locator: PMID 18799126; fecal incontinence as manifestation of impaction
- Note under review: Management review listing fecal incontinence among the clinical manifestations of fecal impaction alongside distention, obstruction, and stercoral complications - the impaction-manifestation anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 133.2 — Wald A. Fecal incontinence. Curr Treat Options Gastroenterol. 2005 Aug;8(4):319-324. PMID 16009033.**

- URL: https://pubmed.ncbi.nlm.nih.gov/16009033/
- Source checked on: 2026-09-23
- Locator: PMID 16009033; impaction with overflow incontinence treatable
- Note under review: Fecal-incontinence review documenting fecal impaction with overflow incontinence as identifiable by history and examination and appropriately treatable - the disimpaction-response dependency anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 133.3 — Fox RA. Atypical presentation of geriatric infections. Geriatrics. 1988 May;43(5):58-64. PMID 3360329.**

- URL: https://pubmed.ncbi.nlm.nih.gov/3360329/
- Source checked on: 2026-09-23
- Locator: PMID 3360329; fecal impaction with incontinence presentation
- Note under review: Geriatric presentation series documenting fecal impaction with incontinence as a recognized clinical presentation in elderly patients - the presentation-confirmation anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `female-infertility` → `depressive-disorder` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The Crawford 2017 prospective cohort of 416 infertile women records depression and anxiety screening positivity in approximately 40% of infertile women - twice that of fertile women - and documents that infertile women screening positive for depression are less likely to initiate fertility treatment, and the Kucur Suna 2016 cross-sectional study of 142 infertile women documents depression prevalence on the Beck Depression Inventory across infertility etiologies with sexual-function impairment; the literature documents co-occurrence and burden without establishing an individual directional nexus.

**Causation boundary (causationStatus):** The mapping does not assert that infertility caused an individual's depression: the quantification comes from screening instruments rather than structured diagnostic interviews, the Yang 2024 analysis documents the reverse arrow (depression associated with subsequent infertility risk), depression may predate the infertility diagnosis, shared drivers (age, chronic gynecologic disease, treatment failure, sexual dysfunction, and social strain) can produce both, and the two conditions can each amplify the other; individual claims require documented infertility with etiology and treatment course, independently diagnosed depression with chronology relative to the infertility course, and exclusion of pre-existing or independently arising depression.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 134.1 — Crawford NM, Hoff HS, Mersereau JE. Infertile women who screen positive for depression are less likely to initiate fertility treatments. Hum Reprod. 2017 Mar 1;32(3):582-587. PMID 28073974.**

- URL: https://pubmed.ncbi.nlm.nih.gov/28073974/
- Source checked on: 2026-09-23
- Locator: PMID 28073974; 40% depression/anxiety prevalence in infertile women
- Note under review: Prospective cohort of 416 infertile women: depression and anxiety in approximately 40% of infertile women (twice fertile controls) with depressed screeners less likely to initiate treatment - the burden-quantification anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 134.2 — Kucur Suna K, Ilay G, Aysenur A, et al. Effects of infertility etiology and depression on female sexual function. J Sex Marital Ther. 2016 Jan 2;42(1):27-35. PMID 25629442.**

- URL: https://pubmed.ncbi.nlm.nih.gov/25629442/
- Source checked on: 2026-09-23
- Locator: PMID 25629442; BDI depression prevalence in 142 infertile women
- Note under review: Cross-sectional study of 142 infertile women assessing Beck Depression Inventory prevalence across infertility etiologies with sexual-function impairment - the etiology-stratified depression anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 134.3 — Yang Q, Tao J, Xin X, et al. Association between depression and infertility risk among American women aged 18-45 years: the mediating effect of the NHHR. Lipids Health Dis. 2024 Jun 10;23(1):178. PMID 38858764.**

- URL: https://pubmed.ncbi.nlm.nih.gov/38858764/
- Source checked on: 2026-09-23
- Locator: PMID 38858764; depression-to-infertility association (reverse arrow)
- Note under review: Population analysis documenting the opposite arrow - depression associated with infertility risk - cited as live reverse-direction counter-evidence for the guard rather than as support.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `femoral-neuropathy` → `unexplained-chronic-pain` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The Santilli 2024 Mayo Clinic review of 159 isolated femoral neuropathy patients documents pain as a presenting feature in 53% with weakness in 96% and only 48% achieving nearly complete recovery over a mean 14.8-month recovery course, the Martinoli 2013 review documents that neuropathies about the hip may be a cause of chronic pain and disability, and the Malik 2023 case documents severe neuropathic pain with femoral nerve palsy; the literature documents the pain feature of the identity without establishing that femoral neuropathy produces a primary chronic-pain syndrome in an individual.

**Causation boundary (causationStatus):** The mapping does not assert that femoral neuropathy causes the target's unexplained-pain state: pain is a presenting feature rather than a demonstrated downstream outcome, the documented nerve lesion is itself a pain generator that the target's own criteria treat as a competing generator to characterize carefully, and lumbar radiculopathy, vascular claudication, hip osteoarthritis, complex regional pain syndrome, and centralized pain all mimic or accompany femoral-distribution pain; individual claims require electrodiagnostically documented femoral mononeuropathy, documented pain distribution and chronology, and exclusion of the competing generators per the target's criteria.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 135.1 — Santilli AR, Martinez-Thompson JM, Speelziek SJA, et al. Femoral neuropathy: A clinical and electrodiagnostic review. Muscle Nerve. 2024 Jan;69(1):64-71. PMID 37941415.**

- URL: https://pubmed.ncbi.nlm.nih.gov/37941415/
- Source checked on: 2026-09-23
- Locator: PMID 37941415; pain 53% at presentation with incomplete recovery share
- Note under review: Mayo Clinic review of 159 isolated femoral neuropathy patients: pain presenting in 53%, weakness 96%, only 48% nearly complete or complete recovery with mean 14.8 months to recovery - the identity-and-pain anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 135.2 — Malik KN, Chan J, Vu B. A Case Report of Neuropathic Pain and Unilateral Lower Extremity Weakness Following a Cardiac Arrest. Cureus. 2023 Dec 9;15(12):e50240. PMID 38192939.**

- URL: https://pubmed.ncbi.nlm.nih.gov/38192939/
- Source checked on: 2026-09-23
- Locator: PMID 38192939; femoral palsy with severe neuropathic pain
- Note under review: Case report documenting femoral nerve palsy after cardiac intervention presenting with severe neuropathic pain and weakness - the severe-pain-case anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 135.3 — Martinoli C, Miguel-Perez M, Padua L, et al. Imaging of neuropathies about the hip. Eur J Radiol. 2013 Jan;82(1):17-26. PMID 21549536.**

- URL: https://pubmed.ncbi.nlm.nih.gov/21549536/
- Source checked on: 2026-09-23
- Locator: PMID 21549536; hip-region neuropathies as chronic pain cause
- Note under review: Review documenting that neuropathies about the hip, including femoral distribution, may be a cause of chronic pain and disability - the chronic-pain-outcome anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `fitz-hugh-curtis-syndrome` → `female-infertility` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The Kobayashi 2006 pathological study of laparoscopy-diagnosed FHCS (108 cases of 3,568 laparoscopies, 104 chronic cases stratified by hydrosalpinx) documents fallopian-tube damage accompanying chronic Fitz-Hugh-Curtis syndrome, the Sharma 2002 prospective study documents incidental FHCS at laparoscopy among women including an infertility-workup group, and the Onoh 2016 case documents FHCS identified during a four-year infertility evaluation with bilateral tubal blockage and Chlamydia trachomatis; the literature documents co-occurrence of FHCS and tubal-factor infertility without establishing that the perihepatic inflammation itself causes an individual's infertility.

**Causation boundary (causationStatus):** The mapping does not assert that FHCS causes an individual's infertility: the perihepatitis and the tubal damage are parallel products of the same ascending chlamydial or gonococcal infection (shared-cause confound), infertility attribution requires documented tubal factor rather than perihepatic adhesions, male-factor and ovulatory etiologies are common independent contributors, and case-level workup findings cannot establish direction; individual claims require documented FHCS, a completed infertility evaluation with etiology, microbiologic confirmation of the pathogen, and exclusion of independent infertility causes.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 136.1 — Kobayashi Y, Takeuchi H, Kitade M, et al. Pathological study of Fitz-Hugh-Curtis syndrome evaluated from fallopian tube damage. J Obstet Gynaecol Res. 2006 Jun;32(3):280-285. PMID 16764617.**

- URL: https://pubmed.ncbi.nlm.nih.gov/16764617/
- Source checked on: 2026-09-23
- Locator: PMID 16764617; chronic FHCS with hydrosalpinx stratification
- Note under review: Review of 3,568 laparoscopies with 108 FHCS cases and 104 chronic FHCS cases stratified by hydrosalpinx - the FHCS tubal-damage anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 136.2 — Sharma JB, Malhotra M, Arora R. Incidentally Fitz-Hugh-Curtis syndrome at laparoscopy for benign gynecologic conditions. Int J Gynaecol Obstet. 2002 Dec;79(3):237-240. PMID 12445989.**

- URL: https://pubmed.ncbi.nlm.nih.gov/12445989/
- Source checked on: 2026-09-23
- Locator: PMID 12445989; incidental FHCS across infertility laparoscopies
- Note under review: Prospective 320-woman laparoscopy study including a 60-patient infertility-workup group with incidental FHCS detection - the infertility-workup co-occurrence anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 136.3 — Onoh RC, Mgbafuru CC, Onubuogu SE, et al. Fitz-Hugh-Curtis syndrome: An incidental diagnostic finding in an infertility workup. Niger J Clin Pract. 2016 Nov-Dec;19(6):834-836. PMID 27811461.**

- URL: https://pubmed.ncbi.nlm.nih.gov/27811461/
- Source checked on: 2026-09-23
- Locator: PMID 27811461; FHCS with bilateral tubal blockage in infertility workup
- Note under review: Case of FHCS identified during a four-year infertility workup with bilateral tubal blockage and Chlamydia trachomatis findings - the workup-case anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

### `flatfoot` → `osteoarthritis` — ASSOCIATION_ONLY

**Proposition (associationBasis):** The Liang 2025 epidemiological analysis examines knee osteoarthritis and flatfoot at population level and documents an association between the foot deformity and knee OA, the Zhang 2022 study of 95 knee-OA patients reports a strong correlation between flatfoot severity and knee-OA symptom burden, and the Patil 2024 study documents pes planus associated with medial-compartment knee osteoarthritis through altered knee function; the literature documents cross-sectional association and severity correlation without establishing that flatfoot caused an individual's osteoarthritis.

**Causation boundary (causationStatus):** The mapping does not assert that flatfoot caused an individual's osteoarthritis: the studies are cross-sectional or hospital-based without temporal ordering, age and body-mass index are shared drivers of both arch collapse and knee OA, the reverse arrow is live (knee OA pain alters gait and loading, secondarily collapsing the arch), local-joint injury histories independently produce knee OA, and pediatric flatfoot is physiologic and usually resolves; individual claims require documented arch collapse preceding knee-OA diagnosis with confounders addressed and alternative joint causes excluded.

**Reviewer questions specific to this edge:**

- Does each source's reported design and population match the proposition's strength claim (association/co-occurrence, not causation)?

- Does the note overstate what the source reports?

- Is the citation metadata exact against the PubMed record?

**Row 137.1 — Liang YF, Li XS, Zha FD, et al. Association between knee osteoarthritis and foot deformities: epidemiological analysis of hallux valgus and flatfoot. Ann Med. 2025 Dec;57(1):2536213. PMID 40693861.**

- URL: https://pubmed.ncbi.nlm.nih.gov/40693861/
- Source checked on: 2026-09-23
- Locator: PMID 40693861; knee OA with flatfoot epidemiological association
- Note under review: Population-level epidemiological analysis of knee osteoarthritis association with flatfoot (and hallux valgus) - the epidemiological anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 137.2 — Zhang M, Nie MD, Qi XZ, et al. A Strong Correlation Between the Severity of Flatfoot and Symptoms of Knee Osteoarthritis in 95 Patients. Front Surg. 2022;9:936720. PMID 35846950.**

- URL: https://pubmed.ncbi.nlm.nih.gov/35846950/
- Source checked on: 2026-09-23
- Locator: PMID 35846950; flatfoot severity with knee OA symptom correlation
- Note under review: 95-patient study reporting strong correlation between flatfoot severity and knee-OA symptoms - the severity-correlation anchor.
- Current state: `verified: false` — pending qualified-human decision

**Row 137.3 — Patil V, Shah M, Krishnani K, et al. The Impact of Pes Planus on Knee Function and Its Association with Medial Compartment Knee Osteoarthritis. J Orthop Case Rep. 2024 Oct;14(10):275-281. PMID 39381308.**

- URL: https://pubmed.ncbi.nlm.nih.gov/39381308/
- Source checked on: 2026-09-23
- Locator: PMID 39381308; pes planus with medial compartment knee OA
- Note under review: Study documenting pes planus impact on knee function through altered lower-limb biomechanics with medial-compartment knee-OA association - the biomechanical-axis anchor.
- Current state: `verified: false` — pending qualified-human decision

**Decision record (complete per row):** reviewer/role — date — source section reviewed — decision — limitations.

## Implementation mechanics after decisions

- Mapping edits and registry edits must land in lockstep (the registry audit's canonical-JSON hashes and live-use sets will fail otherwise).
- `scripts/audit-master-registry.js` and `scripts/audit-citation-verification.js` carry the honest debt baseline; each approval batch updates it with a dated comment.
- Completed decision records follow the repo precedent: the numbered `docs/citation-verification-batch-01.md` through `docs/citation-verification-batch-13.md` decision files and the disposition-record pattern of `docs/adrenal-histoplasmosis-citation-verification-2026-disposition.md`.
