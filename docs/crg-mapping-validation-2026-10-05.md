# CRG draft-identity mapping packet validation — 2026-10-05

One mapping packet was produced in this session and persisted as a docs artifact, then
machine-validated against its own schema, against live NCBI records, and against the live
PubMed pages. No registry, knowledge-base, or authored-corpus files were modified; the
packet is not an authored CRG row (see "Schema projection" and "Limitations").

## Artifacts

- [crg-draft-identity-mapping-packet-2026-10-05.json](crg-draft-identity-mapping-packet-2026-10-05.json) —
  five mappings targeting draft/under-documented catalog identities:
  1. Post-traumatic headache (persistent) ← TBI (8045 → § 4.20 analogy / DC 8100, Causation)
  2. Diabetic distal symmetric polyneuropathy ← type 2 diabetes (7913 → DC 8510-8530, Causation)
  3. Posterior subcapsular cataract ← chronic systemic corticosteroids for RA (5002 → 6027,
     Medication Side Effect)
  4. Peripheral vestibular dysfunction / traumatic BPPV ← TBI (8045 → 6204, Causation)
  5. Hypopituitarism ← TBI (8045 → § 4.20 analogy within § 4.119, Causation; § 3.310(d)(1)(v)
     presumption pathway)

## Why these five

Each secondary identity is a `DRAFT` catalog identity with empty or under-documented authored
suggestions at the time of writing (chronic-kidney-disease-style published identities were
avoided):

| Identity | Tracked status | Authored suggestions before this packet |
| --- | --- | --- |
| post-traumatic-headache | DRAFT | 0 (empty) |
| peripheral-neuropathy | DRAFT | 0 (empty) |
| cataracts | DRAFT | 1 (visual-impairment, ASSOCIATION_ONLY) |
| vestibular-disorder | DRAFT | 0 (empty) |
| hypopituitarism | DRAFT | 2 (osteopenia, anemia) |

Deduplication note: the example routes named in earlier requests (OSA←PTSD, GERD←NSAIDs,
migraine←tinnitus, radiculopathy←DDD, ED←SSRI) are already covered by the gap and exemplar
packets; this packet deliberately extends into five different, still-empty draft identities
rather than repeating them.

## Legal verification (live eCFR, 2026-10-01 edition)

- **§ 3.310(a)** (secondary service connection) and **§ 3.310(b)** (aggravation, with the
  baseline-evidence rule) were read from eCFR and are cited verbatim in the packet.
- **§ 3.310(d)(1)(v)**: "Diseases of hormone deficiency that result from hypothalamo-pituitary
  changes if manifest within 12 months of moderate or severe TBI" are *held* to be the proximate
  result of service-connected TBI absent clear evidence to the contrary; § 3.310(d)(2) routes
  claims outside the severity/time criteria to generally applicable principles. Mapping 5 states
  both pathways.
- Diagnostic codes verified against the live rating schedule:
  - DC 8045 (residuals of traumatic brain injury) — § 4.124a
  - DC 8100 (migraine) — § 4.124a; no tension-type DC exists (81xx contains only 8100 plus
    movement disorders), so post-traumatic headache is rated by analogy under § 4.20
  - DC 7913 (diabetes mellitus) — § 4.119
  - DC 8510-8530 (peripheral nerves; sciatic 8520, common peroneal 8521, posterior tibial 8525,
    femoral 8526) — § 4.124a
  - DC 5002 (multi-joint arthritis, active process) — § 4.71a
  - DC 6027 (cataract) and DC 6029 (aphakia) — § 4.79
  - DC 6204 (peripheral vestibular disorders; objective findings required) and 6205 (Meniere's) —
    § 4.87
  - § 4.119 contains **no hypopituitarism code** (7916 is hyperpituitarism), so mapping 5 records
    that the rating follows the affected axis by analogy under § 4.20.

## Validation performed (2026-10-05)

1. **JSON parse** — the packet parses; 5 mappings.
2. **Schema** — every mapping carries exactly the required keys (`secondaryCondition`,
   `secondaryDiagnosticCode`, `primaryCondition`, `primaryDiagnosticCode`, `nexusTheory`,
   `etiologicalMechanism`, `medicalEvidence`, `cfrCitations`); every `medicalEvidence` item
   carries exactly `title`, `authors`, `summary`, `url`; `nexusTheory` is within
   {Causation, Aggravation, Medication Side Effect}; required strings and arrays are non-empty.
3. **URL format** — every `url` matches `^https://pubmed\.ncbi\.nlm\.nih\.gov/\d+/$`; 15 evidence
   rows, 15 distinct PMIDs (3 per mapping).
4. **Live identity cross-check (E-utilities)** — esummary for all 15 cited PMIDs: 15/15 stored
   titles and first authors match the NCBI records; 0 mismatches. Full abstracts were retrieved
   for all 15 sources and every quantitative claim in the packet was taken from the retrieved
   abstract text.
5. **Functional URL check (real browser)** — each canonical PubMed URL was fetched from a real
   Chromium tab on the pubmed.ncbi.nlm.nih.gov origin: 15/15 returned HTTP 200 and the page's
   article title matched the stored title (an automated-client request to the same URLs receives
   NCBI's 203 interstitial, which is why the browser check is the recorded functional proof).
6. **Nexus reasoning** — each entry states the 38 CFR § 3.310 theory (direct causation,
   treatment/medication effect, or the § 3.310(d)(1)(v) presumption), the clinical mechanism, the
   quantitative evidence, and the documentation and differential-diagnosis elements needed for an
   "at least as likely as not" opinion, including the § 3.310(b) aggravation/baseline analysis
   where a pre-existing condition could be present.

## Results

- Structural / schema / enum / URL errors: **0** (5 mappings, 15 evidence rows)
- Live NCBI identity mismatches: **0** (15/15)
- Functional URL failures in browser: **0** (15/15)

## Schema projection (next step, not yet authored)

Authored rows require the strict `suggestionSchema` plus the hashed registry lockstep
(`data/evidence/master-relationships.json` and `master-sources.json`), so this packet
intentionally stops at the docs layer. Each mapping projects as follows:

| Mapping | conditionId (secondary) | nexusClassification | mechanismCategory | etiologicalConsensus | vaNexusProbabilityAlignment |
| --- | --- | --- | --- | --- | --- |
| PTH ← TBI | post-traumatic-headache | DIRECT_CAUSATION | MULTIFACTORIAL | PROBABLE | AT_LEAST_AS_LIKELY_AS_NOT |
| DSPN ← T2DM | peripheral-neuropathy | DIRECT_CAUSATION | MICROVASCULAR_METABOLIC | WELL_ESTABLISHED | AT_LEAST_AS_LIKELY_AS_NOT |
| Cataract ← steroids | cataracts | DIRECT_CAUSATION | PHARMACOLOGICAL_IATROGENIC | IATROGENIC_TREATMENT_EFFECT | AT_LEAST_AS_LIKELY_AS_NOT |
| Vestibular ← TBI | vestibular-disorder | DIRECT_CAUSATION | MECHANICAL_OR_COMPRESSIVE | PROBABLE | AT_LEAST_AS_LIKELY_AS_NOT |
| Hypopituitarism ← TBI | hypopituitarism | DIRECT_CAUSATION | NEUROENDOCRINE_CASCADE | WELL_ESTABLISHED | LEGALLY_PRESUMED (within § 3.310(d)(1)(v)) |

Note on vocabulary: the packet's "Medication Side Effect" theory is represented in the repo
schema as `DIRECT_CAUSATION` + `mechanismCategory: PHARMACOLOGICAL_IATROGENIC` +
`etiologicalConsensus: IATROGENIC_TREATMENT_EFFECT`; the schema's `vaNexusProbabilityAlignment`
enum includes `LEGALLY_PRESUMED`, which mapping 5 uses for the TBI hormone-deficiency route.

## Notes and limitations

- Population-level evidence supports association and mechanism; it does not establish an
  individual nexus or the "at least as likely as not" opinion, which is case-specific.
- Prevalence estimates for post-traumatic headache are sensitive to which diagnostic criteria
  each study applied (the 2025 meta-analysis states its pooled figure covers headache reported
  after TBI, not necessarily full clinical criteria).
- The corticosteroid-cataract sources quantify dose/duration risk imperfectly; the classic
  review cautions against a simple threshold.
- Vestibular and pituitary findings must be objectively documented (Dix-Hallpike/roll testing and
  vestibular testing; axis-specific hormone assays and stimulation testing), and BPPV is common
  in the general population, so temporal proximity to the trauma is essential.
- All citations remain pending qualified-human verification under `docs/citation-verification-sop.md`;
  mapping approval is not citation verification.
