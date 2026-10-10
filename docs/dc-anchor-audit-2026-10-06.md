# DIRECT_CAUSATION anchor audit — 2026-10-06

Every edge in the knowledge base that carries `nexusClaim.nexusClassification:
"DIRECT_CAUSATION"`, audited for **what class of study actually anchors it**, and
the subset that rests on nothing but a prevalence or association finding, with an
adjudicated verdict per edge.

- Machine-readable companion: `docs/dc-anchor-audit-2026-10-06.json`.
- Reproduce: `npm run audit:dc-anchors` (add `-- --write` to refresh the JSON, `--
  --debug` to print the lexicon pattern that matched each reference).
- Corpus: **47 DIRECT_CAUSATION edges across 44 primary hosts** — 19 on published
  hosts, 28 on draft hosts. Independently confirmed: `npm run audit:me-compliance`
  reports `nexusDistribution.DIRECT_CAUSATION: 47`. The adjacency store holds one
  additional DIRECT_CAUSATION edge (`degenerative-disc-disease → radiculopathy`),
  which mirrors its authored suggestion and is therefore covered by this audit,
  not audited twice.

## Method

`DIRECT_CAUSATION` asserts a legal nexus theory. The evidence model gives an edge
its weight through the mechanism (`src/lib/kb/schema.ts`: "The pathophysiological
mechanism gives the edge its biological 'weight'"), and the mapping files carry no
study-design field — so the class of each anchor is read, mechanically and
reproducibly, from the record's own `citation` and `note` text using the lexicon
printed in the JSON companion. Every edge then falls into one of four states:

| State | Definition | Count |
|---|---|---:|
| **A. Association/prevalence-only** | No reference carries a causal-capable class, and at least one states a frequency, co-occurrence or risk/odds association | **11** |
| **B. Descriptive-only** | No causal-capable class and no prevalence claim either — the anchors are reviews, guidelines or chapters | **4** |
| **C. Mechanism asserted by a secondary source** | A mechanism is named, but only inside a review, guideline, consensus or case report: no primary analytic study anywhere on the edge | **18** |
| **D. Primary-anchored** | At least one anchor is a prospective/longitudinal/incidence design, a randomised trial, or a Mendelian-randomisation design | **14** |

"Prevalence or association study" is read as: the source establishes *that the two
conditions travel together* — a prevalence, a cross-sectional comparison, a
population risk factor, an odds ratio, a "more common in" statement — and nothing
about the step between them.

Because the classification is lexical, the candidate list was then **adjudicated
row by row against each record's own mechanism vector and note text**, and the
adjudication removed two rows the classifier flagged. Both directions of the
review are recorded below.

## 1. The answer — 11 edges whose only anchor is a prevalence or association study

Verdict key:

- **DOWNGRADE** — the record itself supports association only; the arm is wrong
  today and should become `ASSOCIATION_ONLY`.
- **FIX THE ANCHOR** — the causal step is mechanically definitional and a proper
  source exists to cite; the arm may stand once the anchor is replaced, and must
  fall to `ASSOCIATION_ONLY` if no such source can be sourced.
- **WITHDRAWN ON REVIEW** — flagged mechanically, cleared on reading.

### Downgrade now (3)

| Edge | Host | Anchor actually cited | Why it fails the DIRECT_CAUSATION arm |
|---|---|---|---|
| `sleep-apnea → anxiety-disorder` | published | One verified systematic review/meta-analysis: anxiety symptoms are common in OSA, and the relationship is "probably bidirectional" — the note itself says "supports association, not automatic individual causation", and the mechanism vector says the evidence "does not prove that OSA causes an anxiety disorder... should therefore remain association-focused" | The record is authored `DIRECT_CAUSATION` while its own evidence text declares the arm it should be in. Direction is unresolved in the anchor. |
| `hypertension → chronic-kidney-disease` | published | One verified guideline: high blood pressure is "a modifiable risk factor for development of chronic kidney disease" | A risk-factor statement is co-occurrence, not the renal-injury step. The mechanism vector is conditional ("hypertensive renal target-organ injury **when present**"), so nothing on the edge measures the step. |
| `cushings-syndrome → hypertension` | published | One verified European Society of Hypertension consensus: "hypertension is common in Cushing's syndrome and may persist after normalization of hormone excess" | A prevalence statement is carrying the repository's strongest tier (`WELL_ESTABLISHED`). Frequency of co-occurrence cannot hold that tier. |

### Fix the anchor, keep the arm (6)

In each of these the anchor is prevalence/association-class, but the edge's own
mechanism vector describes a direct mechanical, anatomical or pharmacological
step that is definitional for the pair — so downgrading the arm would understate
the medicine. The anchor must be replaced with a source that measures the step.

| Edge | Host | Anchor actually cited | The step the anchor never measures |
|---|---|---|---|
| `dandy-walker-syndrome → hydrocephalus` | draft | Literature review (prevalence "1 in 25,000-35,000 live births", "often presents with hydrocephalus"), a relationship review, and a 70-patient surgical series (hydrocephalus in 100% as the presenting feature) | CSF-flow obstruction from the posterior-fossa cyst and vermian malformation — the malformation's own anatomy, which is why co-presentation is universal rather than statistical |
| `goodpasture-syndrome → chronic-kidney-disease` | draft | Case series (92.6% required renal replacement), cohort of 72 (dialysis at diagnosis predicts outcome), multicentre series of 66 (rituximab response) | Humoral anti-GBM destruction of the glomerular basement membrane and crescentic conversion; the record cites biopsy crescents in 80%, but no anchor isolates the causal step |
| `impetigo → nephritis` | draft | Reference chapter ("impetigo... can result in post-streptococcal acute glomerulonephritis") plus a comparative epidemiology study (66% of an earlier cohort had antecedent pyoderma) | Nephritogenic group A streptococcal antigen–antibody immune-complex deposition in the glomerulus |
| `cauda-equina-syndrome → erectile-dysfunction` | published | Systematic review of 20 studies in surgically treated lumbar disc herniation/CES populations: "persistent sexual dysfunction was common after CES" | Sacral parasympathetic and pudendal nerve-root injury from compression — the anatomical reason the reported outcome occurs |
| `anal-fistula → fecal-incontinence` | published | One verified systematic review pooling 66 studies: postoperative continence impairment in 12.7% of sphincter-cutting cases, with "study quality generally low" | Division of the sphincter complex, which the record's own vector names as the mechanism (`→ documented sphincter-cutting treatment → sphincter impairment`) but no anchor measures |
| `testicular-cancer → hypogonadism` | published | Systematic review/meta-analysis of 12 publications: testosterone-deficiency risk by treatment (chemotherapy OR 1.8, non-conventional therapy OR 3.1, infradiaphragmatic radiotherapy OR 1.6) | Cytotoxic and radiation gonadal injury — the risk gradient is treatment-specific, but the anchor reports observational risk ratios only, with no dose–response or dechallenge evidence |

### Withdrawn on review (2)

The mechanical classifier flagged these. Reading them removed the flag; they are
listed so the correction is on the record.

| Edge | Why it is not prevalence/association-only |
|---|---|
| `hypertension → congestive-heart-failure` | The single anchor reports **antecedent** hypertension, a **dose-dependent** BP–heart-failure relationship, and **reduced heart-failure risk with long-term blood-pressure treatment** — exposure before outcome, a gradient, and an intervention effect. That is more than co-occurrence, even though the note's wording also carries "association". |
| `hepatic-steatosis → cirrhosis-of-the-liver` | Two systematic reviews/meta-analyses pooling 32 histologic studies: **advancing fibrosis stage → increasing risk of cirrhosis and decompensation**. That is progression evidence (a dose–response across stage), not a prevalence of two conditions occurring together. |

## 2. Not prevalence-class, but equally unanchored — 4 descriptive-only edges

These carry no prevalence claim and no causal-capable class either: every anchor
is a review, guideline or chapter, and no source measures the causal step.
Downgrading is not the right remedy — the clinical steps are direct — but the
anchors cannot hold a `DIRECT_CAUSATION` arm on their own.

| Edge | Host | Anchor | Step not measured |
|---|---|---|---|
| `esophagitis → esophageal-stricture` | draft | Two series (11-year, 100 patients; 30-year, 114 children) and a management review | Untreated inflammation → fibrotic narrowing |
| `hyperparathyroidism → kidney-stones` | published | One international guideline ("uses nephrolithiasis/nephrocalcinosis as clinically important renal involvement") | Hypercalciuria → calcium-salt crystallisation |
| `hypertensive-heart-disease → congestive-heart-failure` | published | One condition-specific review ("a major cause of heart failure") | Pressure-overload hypertrophy → systolic/diastolic dysfunction |
| `hypogonadism → osteoporosis` | published | One practice guideline (testosterone-deficiency-associated bone loss, DXA recommendation) | Androgen withdrawal → osteoclast/osteoblast imbalance |

## 3. Second-order finding — 18 edges whose causal step is asserted, not measured

These are not "prevalence or association studies" cases, so they are outside the
question asked, but they share the failure mode: the mechanism appears only in
the prose of a review, guideline, consensus or case report, and no primary
analytic study appears anywhere on the edge. 4 are on published hosts, 14 on
draft hosts.

| Edge | Host | Edge | Host |
|---|---|---|---|
| `brain-cancer → seizure-disorder` | draft | `giant-cell-myocarditis → congestive-heart-failure` | draft |
| `chronic-liver-disease → cirrhosis-of-the-liver` | published | `glucagonoma → diabetes-mellitus` | draft |
| `cystitis-or-neurogenic-bladder → hydronephrosis` | draft | `heart-valve-disorders → congestive-heart-failure` | draft |
| `degenerative-disc-disease → radiculopathy` | draft | `hyperinsulinism → hypoglycemia` | draft |
| `diabetes-insipidus → hydronephrosis` | draft | `insulinoma → hyperinsulinism` | draft |
| `diffuse-axonal-injury → cognitive-disorder` | draft | `pituitary-neoplasm → visual-impairment` | published |
| `eosinophilic-myocarditis → congestive-heart-failure` | draft | `pulmonary-hypertension → congestive-heart-failure` | published |
| `esophageal-stricture → dysphagia` | draft | `urethral-stricture → hydronephrosis` | published |
| `fecal-impaction → fecal-incontinence` | draft | `gastritis → peptic-ulcer-disease` | draft |

For several of these the step is definitional (hyperinsulinism *is* inappropriate
insulin secretion; an insulinoma *is* a hypersecreting beta-cell tumour), so the
remedy is a proper anchor rather than a downgrade. Two carry a stronger signal
that should be weighed separately: `gastritis → peptic-ulcer-disease` cites
eradication-response evidence (a dechallenge-type signal), and
`degenerative-disc-disease → radiculopathy` carries the repository's own
`WELL_ESTABLISHED` tier while its mechanism anchor is still registered
`verified:false` — the verified reference on that edge is the batch-approval note,
not the pathophysiology source.

## 3b. The 14 primary-anchored edges — no action on this criterion

Recorded for completeness, so the audit covers all 47 edges rather than only the
flagged ones. Class shown is the strongest anchor class on each edge.

| Edge | Host | Primary anchor class |
|---|---|---|
| `cerebral-contusion → seizure-disorder` | draft | prospective cohorts |
| `chronic-pyelonephritis → chronic-kidney-disease` | published | long-term follow-up cohort |
| `chronic-sinusitis → sleep-apnea` | published | Mendelian randomisation |
| `coronary-bypass-residuals → cardiac-arrhythmia` | draft | cohort incidence + outcomes |
| `coronary-bypass-residuals → cognitive-disorder` | draft | longitudinal cohort + reviews |
| `depressive-disorder → erectile-dysfunction` | published | systematic review of randomised trials |
| `encephalitis → seizure-disorder` | draft | longitudinal + prospective multicentre cohorts |
| `gastrinoma → peptic-ulcer-disease` | draft | 20-year prospective trial |
| `granulomatosis-with-polyangiitis → chronic-kidney-disease` | draft | registry analysis + cohorts |
| `guyon-s-canal-syndrome → muscle-atrophy` | draft | 11-patient series with follow-up |
| `implantable-cardiac-pacemaker → heart-valve-disorders` | published | systematic review/meta-analysis |
| `intracranial-injury-without-skull-fracture → epilepsy` | draft | registry cohort with follow-up |
| `intracranial-injury-without-skull-fracture → hypopituitarism` | draft | cohort + autopsy mechanism review |
| `ovarian-cancer → peripheral-neuropathy` | published | randomised phase 3 trial |

## 4. What a downgrade mechanically requires

The schema and `scripts/audit-me-compliance.js` constrain the target state, so a
downgrade is not a one-word edit:

- `ASSOCIATION_ONLY` requires `causalMechanism.hypothesizedOnly: true` and
  `nexusClaim` materialised as `status: "NOT_ESTABLISHED"`; proposing
  `hypothesizedOnly: false` or an established status is a hard parse error.
- `hypothesizedOnly: false` cannot pair with `NOT_ESTABLISHED` consensus, and
  `NOT_ESTABLISHED` consensus must pair with `NOT_ASSERTED` alignment, so the
  evidentiary profile has to move together with the arm.
- `mechanismCategory: "NOT_ESTABLISHED"` cannot pair with any other consensus
  tier, so the mechanism category must be reconciled too.
- Three of the rows above (`sleep-apnea`, `hypertension → CKD`,
  `cushings-syndrome`) sit on **published** hosts, so the downgrade also moves the
  published/draft split and the consensus distribution the compliance auditor
  reports — those ratchets move as part of the same change, not after it.

## Limitations

- The class of each anchor is read from citation and note text, because the
  mapping schema has no study-design field. The full lexicon, including every
  regular expression, is printed in the JSON companion so the classification can
  be challenged line by line; `-- --debug` prints which pattern matched which
  reference.
- The lexicon errs toward over-inclusion: two of the eleven flagged rows were
  withdrawn on review (§1, "Withdrawn on review"). A pattern match is a
  candidate, never a verdict.
- Two primary-anchored rows rest on case-series-level primary evidence rather
  than analytic designs (`chronic-pyelonephritis → chronic-kidney-disease` on a
  long-term follow-up cohort; `guyon-s-canal-syndrome → muscle-atrophy` on an
  11-patient retrospective series with follow-up). They are not prevalence-only
  and are outside this audit's flag, but they are the weakest rows in the
  primary-anchored tier.
- The audit reads the authored artifact. The adjacency store is checked for
  DIRECT_CAUSATION edges and holds one, which mirrors its suggestion.
- Desktop-sync fork copies are skipped; a byte-identical duplicate would
  double-count every edge, and `tests/checkout-fork-hygiene.test.ts` exists
  precisely to keep them out of the tree.
- This audit classifies and recommends. It changes no mapping, and no edge's
  classification or citation was edited here.
