# Mapping Expansion ME-41 — Mental Disorders Safe-Draft Disposition Ledger

**NO RELATIONSHIP MUTATION — DOCUMENTED SAFE-DRAFT DISPOSITIONS ONLY**

Issue: #360 Mapping Expansion Wave: Mental Disorders (ME-15+)
Required baseline: `796ff968bfbe38fe148dc23abd32734df5d8447a`
Commit subject: `map: close issue #360 residual scope with ME-41 safe-draft dispositions (0 relationships)`
Evidence research performed: **2026-09-12 via NCBI E-utilities** (`esearch` / `esummary` / `efetch`, `db=pubmed`)

## Purpose

ME-15 through ME-18 mapped 14 of the 20 draft Mental Disorders primaries named in issue #360. Six
primaries were placed on **HOLD** during ME-16 planning:

> `adjustment-disorder` → `depressive-disorder`, `delusional-disorder` → `depressive-disorder`,
> `dissociative` / `functional-neurological-symptom-disorder` → `depressive-disorder`,
> `schizoaffective-disorder`: diagnostic-overlap and phenotype-identity guards insufficiently
> supported at planning (HOLD). — `docs/mapping-expansion-me16-plan.md`, ME-17+ bench

Issue #360 prescribes the terminal disposition for exactly these residuals:

> ME-18 / safe-draft dispositions: … and **any residual primary without a safe bounded proposition
> remain safe drafts with documented rationale** (chronic-fatigue-syndrome precedent).

ME-41 discharges that clause. It re-tests each held primary against live PubMed evidence and records
the outcome as a **safe-draft disposition with documented rationale**, in the
`chronic-fatigue-syndrome` (ME-18) `todo` shape: a dated rescreen entry naming the real PMIDs
examined and why each fails, followed by an explicit release condition.

**ME-41 creates no relationship, no rank, no guard, no source, and no publication-state change.**
Because nothing is mapped, **no mapping approval and no qualified-human citation verification is
asserted or required** by this batch; those gates apply only to relationship-bearing batches.

## Method

Each held primary was searched in PubMed on 2026-09-12 with condition-specific queries, then
candidate records were retrieved as full `esummary` metadata and `efetch` XML abstract text so that
every claim below is grounded in retrieved content rather than title inference.

| Primary | Queries run | Outcome |
|---|---|---|
| `adjustment-disorder` | title/abstract review+comorbidity query; `adjustment disorders[MeSH] AND depressive disorder[MeSH] AND comorbidity[MeSH]`; targeted co-occurrence/follow-up query | 2 candidates examined, both unsupportive |
| `delusional-disorder` | title/abstract depression+comorbidity query; MeSH comorbidity query; targeted comorbidity query | **0 hits** on the targeted query; no comorbidity source |
| `depersonalization-derealization-disorder` | review/epidemiology comorbidity query; `depersonalization disorder[MeSH]` | 2 candidates examined; direction inverted |
| `dissociative-disorder` | epidemiology/review comorbidity query; `dissociative disorders[MeSH] AND comorbidity[MeSH]` | **0 hits** on the MeSH query; classification papers only |
| `functional-neurological-symptom-disorder` | FND/conversion title query; `conversion disorder[MeSH]` comorbidity query; targeted FND+depression prevalence query | **0 hits** on the targeted query |
| `schizoaffective-disorder` | review-type title query; `schizoaffective disorder[MeSH] AND depressive disorder[MeSH]` | 1 authoritative review examined; phenotype-identity barrier |

## 1. `adjustment-disorder` — DISPOSITION: `FINAL-CLOSE-DIRECTION` reaffirmed (safe draft)

**Examined sources**

- Casey P. Adjustment disorder: epidemiology, diagnosis and treatment. *CNS Drugs*. 2009;23(11):927-38.
  **PMID 19845414.** doi:10.2165/11311000-000000000-00000. (Journal Article, Review)
- Mitchell AJ, Chan M, Bhatti H, Halton M, Grassi L, Johansen C, Meader N. Prevalence of depression,
  anxiety, and adjustment disorder in oncological, haematological, and palliative-care settings: a
  meta-analysis of 94 interview-based studies. *Lancet Oncol*. 2011;12(2):160-74. **PMID 21251875.**
  doi:10.1016/S1470-2045(11)70002-X. (Meta-Analysis)

**Why no safe bounded proposition exists.** Casey 2009 treats the relationship to major depression as a
*differential-diagnosis boundary*, not a comorbidity finding. Its abstract states that "the distinction
from major depression also poses a classificatory conundrum since both are conceptually different",
because "adjustment disorder is a diagnosis based on the longitudinal course of symptoms in the context
of a stressor, while a diagnosis of major depression is a cross-sectional one based on symptom numbers."
A source that separates two identities cannot also support an association edge between them.
Mitchell 2011 reports depression and adjustment-disorder prevalences *separately* within oncological,
haematological, and palliative-care populations (adjustment disorder 15.4% and 19.4%; depression 16.5%
and 16.3%) and never establishes co-occurrence *between* the two identities; it additionally carries a
cancer-population mismatch against a general adjustment-disorder primary — the same class of defect that
withdrew the earlier GERD edge (PMID 35362447, anxiety/depression-oriented rather than
condition-specific). The targeted co-occurrence query returned only off-target records (MDD diagnostic
criteria, bipolar misdiagnosis, insomnia prognosis, religiosity, scientometrics).

**Disposition.** The `FINAL-CLOSE-DIRECTION` resolution recorded at ME-30 and documented in
`docs/condition-expansion-roadmap.md` remains in force. The ME-30 withdrawal rationale is preserved
verbatim in the KB `todo`; the ME-41 rescreen is appended rather than replacing it.

## 2. `delusional-disorder` — DISPOSITION: `safe-draft` (no condition-specific source)

**Search outcome.** The targeted query pairing delusional disorder (or paranoid psychosis) with
depression and comorbidity returned **zero records**. Title-level searching surfaced only case reports,
antipsychotic-treatment reviews, and non-psychiatric delusional presentations, including:

- Jensen KV, Abba-Aji A. Isotretinoin-Induced Delusional Disorder, Somatic Subtype. *Case Rep Dermatol
  Med*. 2020. **PMID 32774942.** doi:10.1155/2020/8853167. (single case report)
- González-Rodríguez A, Guàrdia A, Palao DJ, et al. Moderators and mediators of antipsychotic response in
  delusional disorder. *World J Psychiatry*. 2020;10(4):34-. **PMID 32399397.** doi:10.5498/wjp.v10.i4.34.
  (treatment response, not comorbidity)
- González-Rodríguez A, Monreal JA, Natividad M, et al. Seventy Years of Treating Delusional Disorder with
  Antipsychotics: A Historical Perspective. *Biomedicines*. 2022;10(12):3281. **PMID 36552037.**
  doi:10.3390/biomedicines10123281. (historical treatment review)

The `delusional disorder[MeSH] AND (comorbidity[MeSH] OR depressive disorder[MeSH])` query returned only
off-target records (a general MDD review, paranoid schizophrenia, gender-sensitive mental health care,
neurosyphilis, psychocutaneous pharmacotherapy).

**Why no safe bounded proposition exists.** No retrieved source quantifies co-occurrence of
delusional disorder with a separately established depressive disorder. A single case report or an
antipsychotic-treatment review cannot bound a population-level or clinical-sample association. The
delusional-disorder diagnostic boundary against concurrent mood episodes was not independently
verified against a retrieved criteria source during this rescreen, so it is recorded here only as a
guard-design caution for any future proposal, not as a cited fact.

**Release condition.** A delusional-disorder-specific epidemiological or clinical-sample source that
quantifies co-occurrence with a separately established depressive disorder and supports the exact
downstream diagnosis and direction.

## 3. `depersonalization-derealization-disorder` — DISPOSITION: `safe-draft` (direction inverted)

**Examined sources**

- Reutens S, Nielsen O, Sachdev P. Depersonalization disorder. *Curr Opin Psychiatry*.
  2010;23(3):278-83. **PMID 20308898.** doi:10.1097/YCO.0b013e3283387ab4. (Review)
- Yang J, Millman LSM, David AS, Hunter ECM. The Prevalence of Depersonalization-Derealization
  Disorder: A Systematic Review. *J Trauma Dissociation*. 2023;24(1):8-41. **PMID 35699456.**
  doi:10.1080/15299732.2022.2079796. (Systematic Review)

**Why no safe bounded proposition exists.** Reutens 2010 addresses nosology, phenomenology,
neurophysiological "dampening down", and treatment; its abstract contains no comorbidity or
depression finding. Yang 2023 is the strongest retrieved record and does report real co-occurrence —
"prevalence rates varied: 1.8-5.9% (substance abuse), 3.3-20.2% (anxiety), 3.7-20.4% (other
dissociative disorders), 16.3% (schizophrenia), 17% (borderline personality disorder), ~50%
(depression)" — but those figures are the prevalence *of depersonalization-derealization disorder
within* each disorder group. That conditions on the mood disorder, i.e. it estimates
P(DDD | depression), not P(depression | DDD). Registering `depersonalization-derealization-disorder ->
depressive-disorder` on this source would invert the registry direction and misstate the finding.

**Note for future batches.** Yang 2023 would be directionally correct for a
`depressive-disorder -> depersonalization-derealization-disorder` edge. That is outside issue #360's
primary scope and is not proposed here; it requires its own bounded batch and guard review.

**Release condition.** A source supporting depersonalization-derealization-disorder *as the primary*
with a separately established depressive disorder as the outcome, with individual chronology
distinguishing detachment and unreality symptoms from depressive symptoms, and preserving trauma and
interpersonal-abuse exposure, substance use including cannabis, sleep disturbance, medications,
anxiety disorders, other dissociative disorders, and other psychiatric illness as competing
explanations.

## 4. `dissociative-disorder` — DISPOSITION: `safe-draft` (classification literature only)

**Examined sources**

- Spiegel D, Loewenstein RJ, Lewis-Fernández R, Sar V, Simeon D, Vermetten E, Cardeña E, Dell PF.
  Dissociative disorders in DSM-5. *Depress Anxiety*. 2011;28(9):824-52. **PMID 21910187.**
  doi:10.1002/da.20874. (Review)
- Spiegel D, Lewis-Fernández R, Lanius R, Vermetten E, Simeon D, Friedman M. Dissociative disorders in
  DSM-5. *Annu Rev Clin Psychol*. 2013;9:299-326. **PMID 23394228.**
  doi:10.1146/annurev-clinpsy-050212-185531. (Review)

**Why no safe bounded proposition exists.** Both are DSM-5 *criteria-recommendation* papers. The 2011
abstract recommends criteria revisions (DPD to include derealization, fugue to become a dissociative
amnesia subtype, DID criteria to emphasize disruptive dissociation and possession, dissociative trance
into Unspecified Dissociative Disorder) and closes on trauma history and neural mechanisms — it
contains **no** depression or comorbidity statement. The 2013 abstract's only comorbidity statement is
"Conversion disorder (functional neurological symptom disorder) will likely remain with the somatic
symptom disorders, despite considerable dissociative comorbidity", which concerns conversion ↔
dissociation, not a mood outcome. The `dissociative disorders[MeSH] AND comorbidity[MeSH]` query
returned zero records.

**Release condition.** A dissociative-disorder-specific epidemiological or clinical-sample source that
quantifies co-occurrence with a separately established depressive disorder, keeping dissociative
amnesia and dissociative identity disorder evidence distinct where mechanisms differ, and not inferring
a depressive disorder from amnesia, identity disruption, possession phenomenology, or trauma history
alone.

## 5. `functional-neurological-symptom-disorder` — DISPOSITION: `safe-draft` (wrong comparator)

**Examined source**

- Tsui P, Deptula A, Yuan DY. Conversion Disorder, Functional Neurological Symptom Disorder, and
  Chronic Pain: Comorbidity, Assessment, and Treatment. *Curr Pain Headache Rep*. 2017;21(6):29.
  **PMID 28434123.** doi:10.1007/s11916-017-0627-7. (Review)

**Search outcome.** The targeted query pairing functional neurological disorder or conversion disorder
with depression **and** comorbidity/prevalence/epidemiology returned **zero records**. The
`conversion disorder[MeSH] AND (comorbidity[MeSH] OR depressive disorder[MeSH])` query returned
dissociation-classification and non-epileptic-seizure records rather than an FND-depression
comorbidity estimate.

**Why no safe bounded proposition exists.** Despite "Comorbidity" in its title, Tsui 2017 examines
"the overlap of conversion disorder with **chronic pain** conditions" and shared treatment components
("Components of treatment for conversion disorder overlap with treatments for chronic pain"). Its
abstract contains no depression or depressive-disorder finding, so it cannot bound a
`-> depressive-disorder` proposition. Title-level relevance is not evidence of the comparator.

**Release condition.** A functional-neurological-symptom-disorder-specific source that quantifies
co-occurrence with a separately established depressive disorder and supports the exact downstream
diagnosis and direction, without treating the mental-disorders rating classification as proof of
neurological or psychiatric causation, and keeping structural neurological disease, chronic pain
conditions, mobility and fall sequelae, medications, and other psychiatric illness as competing
explanations.

## 6. `schizoaffective-disorder` — DISPOSITION: `safe-draft` (phenotype-identity barrier)

**Examined source**

- Miller JN, Black DW. Schizoaffective disorder: A review. *Ann Clin Psychiatry*. 2019;31(1):47-53.
  **PMID 30699217.** (Historical Article, Review; no DOI in the PubMed record)

**Why no safe bounded proposition exists.** This is the definitive phenotype-identity case the ME-16
HOLD anticipated. The retrieved abstract states that the "hallmark is the presence of symptoms of a
major mood episode (either a depressive or manic episode) concurrent with symptoms characteristic of
schizophrenia". A major depressive episode is therefore **partly constitutive** of the depressive
subtype of the primary identity, so a `schizoaffective-disorder -> depressive-disorder` edge would
restate a diagnostic criterion as an empirical secondary-condition relationship — a tautology presented
as a medical-nexus-relevant association. The same review records that "some experts view SAD as an
independent disorder, while others see SAD as either a form of schizophrenia or a mood disorder", and
that "There has been inadequate research regarding its epidemiology, course, etiologic factors, and
treatment." An unresolved nosological boundary cannot be guarded conservatively enough to make the
edge safe.

**This primary was previously undocumented.** Before ME-41, `schizoaffective-disorder` appeared in
issue #360's scope and in the ME-16 HOLD list only; it carried no `expansion-dispositions.json` entry,
no `condition-expansion-roadmap.md` record, and a single generic KB `todo`. ME-41 supplies the missing
documented rationale.

**Release condition.** Do not author a `depressive-disorder` or `bipolar-disorder` edge from
`schizoaffective-disorder` while a major mood episode remains a diagnostic criterion of the primary
identity. Any future proposal must separate an independently established *additional* mood disorder
from the constitutive mood episode and must first resolve the primary's nosological boundary. Treatment
response to antidepressants or mood stabilizers is not evidence of a distinct secondary condition.


## Issue #360 scope closure — all 20 draft Mental Disorders primaries

| Primary | Batch | Disposition | Rank-1 relationship |
|---|---|---|---|
| `anxiety-disorder` | ME-15 | mapped | `-> depressive-disorder` |
| `panic-disorder` | ME-15 | mapped | `-> agoraphobia` |
| `ocd` | ME-15 | mapped | `-> depressive-disorder` (rank 2; rank 1 remains `-> migraine-headaches`) |
| `binge-eating-disorder` | ME-15 | mapped | `-> depressive-disorder` |
| `bipolar-disorder` | ME-15 | mapped | `-> anxiety-disorder` |
| `bulimia-nervosa` | ME-16 | mapped | `-> depressive-disorder` |
| `specific-phobia` | ME-16 | mapped | `-> depressive-disorder` |
| `hoarding-disorder` | ME-16 | mapped | `-> depressive-disorder` |
| `body-dysmorphic-disorder` | ME-16 | mapped | `-> depressive-disorder` |
| `agoraphobia` | ME-16 | mapped | `-> depressive-disorder` |
| `persistent-depressive-disorder` | ME-17 | mapped | `-> depressive-disorder` |
| `somatic-symptom-disorder` | ME-17 | mapped | `-> depressive-disorder` |
| `illness-anxiety-disorder` | ME-18 | mapped | `-> depressive-disorder` |
| `cyclothymic-disorder` | ME-18 | mapped | `-> bipolar-disorder` |
| `adjustment-disorder` | ME-41 | **safe draft** — `FINAL-CLOSE-DIRECTION` reaffirmed | none |
| `delusional-disorder` | ME-41 | **safe draft** — no condition-specific source | none |
| `depersonalization-derealization-disorder` | ME-41 | **safe draft** — direction inverted | none |
| `dissociative-disorder` | ME-41 | **safe draft** — classification literature only | none |
| `functional-neurological-symptom-disorder` | ME-41 | **safe draft** — wrong comparator | none |
| `schizoaffective-disorder` | ME-41 | **safe draft** — phenotype-identity barrier | none |

**20 / 20 accounted for: 14 mapped, 6 safe drafts with documented rationale.** Every primary in
issue #360's scope is now either citation-backed in the master registry or carries an
evidence-grounded safe-draft disposition naming the records that were examined and rejected.
`safe-draft` is a reviewed product state, not a defect, per the `expansion-dispositions.json`
disposition definitions.

## No-change attestation

ME-41 is a documentation-and-rationale batch. Verified against baseline `796ff968`:

- **Relationships:** 363 → **363** (unchanged). No new `relationshipId`, rank, direction, guard, or
  `clinicalProposition`.
- **Master sources:** 355 total entities → **355**. No new `sourceId`; no `verified` flag changed; no
  `pending-verification` entity created.
- **Registry state:** `currentState` remains **`ME-39-CITATION-VERIFIED`**; `counts` remain
  `{relationships: 363, explicitPublicationGuards: 289, legacyRationaleBoundaries: 74}`.
- **Publication states:** all six primaries remain `draft: true` with `suggestions: []`. No promotion,
  no demotion.
- **`pathwayIntelligence`:** none added (issue #360 prohibits it).
- **KB integrity:** `node scripts/validate-knowledge-base.js` → 813 catalog conditions, 813 mapped,
  0 unmapped, 0 errors, 0 warnings.
- **Historical ledger untouched:** `data/expansion-dispositions.json` is the immutable Wave 1-7
  snapshot (107 identities, pinned by `tests/expansion-dispositions.test.ts`). ME-41 does **not** add
  entries there; the authoritative current record is the master registries plus this ledger and the KB
  `todo` rationale.

## Governance

- This batch asserts **no** mapping approval and **no** qualified-human citation verification, because
  it creates no relationship and no citation. Those gates remain separately required for any future
  batch that does.
- Evidence research is reproducible from the recorded queries and PMIDs via NCBI E-utilities.
  Bibliographic metadata (authors, journal, year, volume, issue, pages, DOI, publication type) was
  retrieved from `esummary`; content claims were read from `efetch` abstract text.
- One branch/PR for this batch; protected workflow; verify gate before merge.
- No Vercel deploy.

