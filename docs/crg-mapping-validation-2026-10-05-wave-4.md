# CRG draft-identity mapping packet validation — wave 4 (2026-10-05)

Fourth mapping packet produced on 2026-10-05, persisted as a docs artifact and machine-validated
against its own schema, live NCBI records, and the live PubMed pages. No registry, knowledge-base,
graph, or authored-corpus files were modified; the packet is not an authored CRG row.

## Artifacts

- [crg-draft-identity-mapping-packet-wave4-2026-10-05.json](crg-draft-identity-mapping-packet-wave4-2026-10-05.json) —
  five mappings targeting draft identities and under-documented routes:
  1. Osteonecrosis (glucocorticoid-associated) ← asthma on systemic corticosteroids
     (6602 → § 4.20 analogy to the § 4.71a joint codes, Medication Side Effect)
  2. Diabetic gastroparesis ← type 2 diabetes (7913 → 7356, Causation)
  3. Obstructive sleep apnea ← hypothyroidism (7903 → 6847, Causation)
  4. Peptic ulcer disease (NSAID-associated) ← osteoarthritis on chronic NSAIDs
     (5003 → 7304, Medication Side Effect)
  5. Glaucoma (corticosteroid-induced ocular hypertension) ← rheumatoid arthritis on chronic
     corticosteroids (5002 → 6013, Medication Side Effect)
- Waves 1–3 remain at
  [crg-draft-identity-mapping-packet-2026-10-05.json](crg-draft-identity-mapping-packet-2026-10-05.json),
  [crg-draft-identity-mapping-packet-wave2-2026-10-05.json](crg-draft-identity-mapping-packet-wave2-2026-10-05.json),
  and [crg-draft-identity-mapping-packet-wave3-2026-10-05.json](crg-draft-identity-mapping-packet-wave3-2026-10-05.json)
  with their validation records.

## Why these five

Statuses were read from the live backlog tracker and incoming-edge counts from the authored corpus:

| Secondary identity | Tracked status | Incoming edges before this packet |
| --- | --- | --- |
| avascular-necrosis | DRAFT | 0 — this packet opens the first incoming route |
| diabetic-gastroparesis | DRAFT (own outgoing row to gastroparesis) | 0 — first incoming route |
| sleep-apnea | PUBLISHED (3 outgoing rows) | 21, none endocrine — no hypothyroidism route |
| peptic-ulcer-disease | DRAFT | 2 (gastrinoma, gastritis) — no NSAID route |
| glaucoma | DRAFT (batch-38 bounded association edge) | 3 (hyperopia, myopia, uveitis) — no corticosteroid route |

Prior waves and the authored corpus already cover PTSD → sleep apnea, DDD → radiculopathy,
depression/PTSD → erectile dysfunction, tinnitus → migraine, NSAID → GERD, TBI → insomnia
routes, and the wave-1–3 targets; none is repeated. Candidate identities without a corpus file
(spinal-cord-injury for decubitus ulcers, frozen shoulder) and direction-ambiguous candidates
(periodontitis ↔ diabetes, where a periodontitis → diabetes-mellitus row already exists) were
deliberately not used.

## Legal verification (live eCFR, 2026-10-01 edition)

- **§ 3.310(a)** — secondary service connection, including a disability proximately due to or the
  result of treatment of a service-connected condition — is the hook for the three
  treatment-complication mappings (corticosteroids ×2, NSAIDs ×1) and for the two metabolic and
  endocrine causation mappings.
- **§ 3.310(b)** — aggravation with the baseline-evidence rule — recorded on every mapping as the
  limiting rule where the secondary condition or a reduced baseline is documented before exposure.
- Diagnostic codes verified against the live schedule (this wave fetched § 4.97, § 4.79, and
  § 4.114 directly; prior waves fetched § 4.119 and § 4.71a):
  - DC 6602 (asthma, bronchial) — § 4.97; the schedule's severity criteria expressly contemplate
    daily systemic corticosteroids (100%) and intermittent courses of at least three per year
    (60%), which supports the treatment-chain framing for the asthma primary
  - DC 6847 (sleep apnea syndromes, obstructive, central, mixed) — § 4.97, rated 0–100% with the
    50% level for CPAP
  - DC 7356 (gastrointestinal dysmotility syndrome) — § 4.114; the criteria address poor gastric
    emptying and intestinal motility disorder symptoms, which is the schedule entry for diabetic
    gastroparesis (no analogy required)
  - DC 7304 (peptic ulcer disease) — § 4.114, including its 0%-level endoscopic/imaging
    documentation requirement
  - DC 6013 (open-angle glaucoma) and DC 6012 (angle-closure glaucoma) — § 4.79, each with a
    minimum 10% evaluation if continuous medication is required
  - DC 5002 / DC 5003 (§ 4.71a) and DC 7913 / DC 7903 (§ 4.119) — verified in prior waves

## Validation performed (2026-10-05)

1. **JSON parse** — the packet parses; 5 mappings.
2. **Schema** — exact required key sets on every mapping and every `medicalEvidence` item; the
   `nexusTheory` enum is exercised across Causation (2) and Medication Side Effect (3); non-empty
   required fields.
3. **URL format** — every `url` matches `^https://pubmed\.ncbi\.nlm\.nih\.gov/\d+/$`; 15 evidence
   rows, 15 distinct PMIDs (3 per mapping).
4. **Live identity cross-check (E-utilities)** — esummary for all 15 cited PMIDs returned 0 title
   or first-author mismatches. PMIDs were located by live esearch during drafting (no PMID was
   guessed), and every quantitative claim was extracted from the retrieved abstract text.
5. **Functional URL check (real browser)** — all 15 canonical PubMed URLs fetched from a real
   Chromium tab on the pubmed.ncbi.nlm.nih.gov origin: 15/15 HTTP 200 with page titles matching
   the stored titles.
6. **Self-audit** — per mapping: § 3.310 legal hook, the literal "at least as likely as not"
   standard, § 3.310 subparagraph, competing-cause discussion, primary and secondary Part 4 DC
   (or documented § 4.20 analogy), Part 4 citation, evidence-row bounds, URL format — all checks
   PASS on all 5 mappings. No defects required repair this wave.

## Results

- Structural / schema / enum / URL errors: **0** (5 mappings, 15 evidence rows)
- Live NCBI identity mismatches: **0** (15/15)
- Functional URL failures in browser: **0** (15/15)
- Self-audit: **PASS ×5**

## Schema projection (next step, not yet authored)

| Mapping | conditionId (secondary) | nexusClassification | mechanismCategory | etiologicalConsensus | vaNexusProbabilityAlignment |
| --- | --- | --- | --- | --- | --- |
| Osteonecrosis ← corticosteroids (asthma) | avascular-necrosis | DIRECT_CAUSATION | PHARMACOLOGICAL_IATROGENIC | IATROGENIC_TREATMENT_EFFECT | AT_LEAST_AS_LIKELY_AS_NOT |
| Diabetic gastroparesis ← type 2 diabetes | diabetic-gastroparesis | DIRECT_CAUSATION | MICROVASCULAR_METABOLIC | WELL_ESTABLISHED | AT_LEAST_AS_LIKELY_AS_NOT |
| OSA ← hypothyroidism | sleep-apnea | DIRECT_CAUSATION | MECHANICAL_OR_COMPRESSIVE | PROBABLE | AT_LEAST_AS_LIKELY_AS_NOT |
| PUD ← NSAIDs (osteoarthritis) | peptic-ulcer-disease | DIRECT_CAUSATION | PHARMACOLOGICAL_IATROGENIC | IATROGENIC_TREATMENT_EFFECT | AT_LEAST_AS_LIKELY_AS_NOT |
| Glaucoma ← corticosteroids (RA) | glaucoma | DIRECT_CAUSATION | PHARMACOLOGICAL_IATROGENIC | IATROGENIC_TREATMENT_EFFECT | AT_LEAST_AS_LIKELY_AS_NOT |

Note: no `MEDICATION_SIDE_EFFECT` value exists in the repo's `nexusClassification` enum; the
medication/treatment effect theory is represented as `DIRECT_CAUSATION` +
`PHARMACOLOGICAL_IATROGENIC` + `IATROGENIC_TREATMENT_EFFECT`, consistent with waves 1–3.

## Notes and limitations

- Population-level evidence supports association and mechanism; it does not establish an individual
  nexus or the "at least as likely as not" opinion, which is case-specific.
- The glucocorticoid–osteonecrosis dose-response identifies short-term high-dose and pulse exposure
  (initial dose > 60 mg/day, OR 4.19) rather than cumulative dose as the core risk — the individual
  opinion must document the actual regimen, including steroid bursts.
- The gastroparesis prevalence synthesis carries high heterogeneity and a published erratum; the
  JAMA review's cause distribution (type 2 diabetes 51.7% of gastroparesis cases) is the stronger
  anchor.
- Hypothyroidism → OSA is supported at very high prevalence but modest adjusted association
  (OR 1.88) with obesity as the dominant confounder; the treatment-effect signal (85.3% untreated
  vs 66.1% treated) is the closest thing to direction evidence and must be documented per case.
- NSAID → PUD must separate NSAID effect from H. pylori infection (synergistic, risk multiplied)
  and from alcohol/smoking; DC 7206 GERD and DC 7304 PUD ratings may not double-count the same
  signs under § 4.14.
- Corticosteroid-induced glaucoma depends on demonstrating a pressure rise in relation to steroid
  exposure; pre-exposure intraocular pressure documentation is decisive for the § 3.310(b)
  baseline analysis, and serial optic-nerve and visual-field examinations establish the
  glaucomatous endpoint.
- Two corticosteroid-treatment mappings in one wave (osteonecrosis, glaucoma) reflect that
  medication-effect claims cluster around this drug class; the primaries differ (asthma, RA), and
  both remain distinct from the wave-1 cataract and wave-3 osteopenia routes.
- All citations remain pending qualified-human verification under
  `docs/citation-verification-sop.md`; mapping approval is not citation verification.
