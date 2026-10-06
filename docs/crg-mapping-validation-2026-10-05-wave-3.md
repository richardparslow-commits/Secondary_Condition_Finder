# CRG draft-identity mapping packet validation — wave 3 (2026-10-05)

Third mapping packet produced on 2026-10-05, persisted as a docs artifact and machine-validated
against its own schema, live NCBI records, and the live PubMed pages. No registry, knowledge-base,
graph, or authored-corpus files were modified; the packet is not an authored CRG row.

## Artifacts

- [crg-draft-identity-mapping-packet-wave3-2026-10-05.json](crg-draft-identity-mapping-packet-wave3-2026-10-05.json) —
  five mappings targeting draft identities and under-documented incoming routes:
  1. Hepatic steatosis (NAFLD/MASLD) ← type 2 diabetes (7913 → § 4.20 analogy within § 4.114;
     DC 7345/7312 criteria where met, Causation)
  2. Osteopenia (glucocorticoid-induced bone loss) ← rheumatoid arthritis on chronic systemic
     corticosteroids (5002 → § 4.20 analogy to DC 5013, Medication Side Effect)
  3. Carpal tunnel syndrome ← hypothyroidism (7903 → 8515, Causation; modest adjusted association
     presented honestly)
  4. Hypogonadism (opioid-induced androgen deficiency) ← degenerative disc disease on long-term
     opioid therapy (5242 → § 4.20 analogy, closest entry DC 7523, Medication Side Effect)
  5. Insomnia disorder (chronic, post-traumatic) ← TBI (8045 → § 4.130 General Rating Formula,
     Causation; not a § 3.310(d)(1) presumption, individual opinion required)
- Wave 1 remains at
  [crg-draft-identity-mapping-packet-2026-10-05.json](crg-draft-identity-mapping-packet-2026-10-05.json)
  with its record at [crg-mapping-validation-2026-10-05.md](crg-mapping-validation-2026-10-05.md);
  wave 2 at [crg-draft-identity-mapping-packet-wave2-2026-10-05.json](crg-draft-identity-mapping-packet-wave2-2026-10-05.json)
  with its record at [crg-mapping-validation-2026-10-05-wave-2.md](crg-mapping-validation-2026-10-05-wave-2.md).

## Why these five

Statuses were read from the live backlog tracker and incoming-edge counts from the authored corpus
(root `id` as primary, suggestion `conditionId` as target):

| Secondary identity | Tracked status | Incoming edges before this packet |
| --- | --- | --- |
| hepatic-steatosis | DRAFT (batch 44; 2 outgoing rows: cirrhosis, liver cancer) | 0 — this packet opens the first incoming route |
| osteopenia | DRAFT (batch 67 deferral concerns outgoing outcomes; incoming routes open) | 1 (hypopituitarism, ASSOCIATION_ONLY) |
| carpal-tunnel-syndrome | DRAFT (batch 26 safe-draft; no edge authored) | 2 (de-quervain-s-tenosynovitis, ganglion-cysts — both local anatomic) |
| hypogonadism | PUBLISHED (2 outgoing rows) | 4 (hyperpituitarism, loss-of-testicle, spermatocele, testicular-cancer — all testicular/pituitary; no medication-induced route) |
| insomnia | PUBLISHED (2 outgoing rows) | 11 (all ASSOCIATION_ONLY; none from TBI) |

Brief examples already covered in the authored corpus and therefore not repeated: PTSD → sleep-apnea
and insomnia ← PTSD (exists), DDD → radiculopathy (exists), depressive-disorder → and
PTSD → erectile dysfunction (exist). Wave 2 filled tinnitus → migraine and NSAID → GERD.
Tardive dyskinesia was excluded on active-governance grounds (batch-90 held schizophrenia edge).

## Legal verification (live eCFR, 2026-10-01 edition)

- **§ 3.310(a)** — secondary service connection, including a disability proximately due to or the
  result of treatment of a service-connected condition — is the hook for the corticosteroid and
  opioid treatment-complication mappings and for the metabolic and endocrine causation mappings.
- **§ 3.310(b)** — aggravation with the baseline-evidence rule — recorded on every mapping as the
  limiting rule where the secondary condition or a reduced baseline is documented before exposure.
- **§ 3.310(d)(1)** — TBI presumptions: none covers insomnia; the individual medical opinion is
  required and § 3.310(d)(2) general principles apply. The sleep mapping therefore rests on clinical
  evidence, not on a presumption.
- Diagnostic codes used were verified against the live schedule in waves 1–2 and re-checked in the
  packet text:
  - DC 7913 (diabetes mellitus) — § 4.119; DC 7345 (chronic liver disease without cirrhosis) and
    DC 7312 (cirrhosis of the liver) — § 4.114; § 4.20 for analogous rating of steatosis
  - DC 5002 (multi-joint arthritis, active process) — § 4.71a; DC 5013 (osteoporosis, residuals of)
    with the note to DCs 5013–5024 — § 4.71a
  - DC 7903 (hypothyroidism) — § 4.119; DC 8515 (median nerve) — § 4.124a
  - DC 5242 (degenerative arthritis, DDD other than intervertebral disc syndrome) — § 4.71a;
    DC 7523 (testis, atrophy complete) — § 4.115b
  - DC 8045 (residuals of traumatic brain injury) — § 4.124a; § 4.130 (General Rating Formula for
    Mental Disorders) and § 4.14 (avoidance of duplicate evaluation) for insomnia

## Validation performed (2026-10-05)

1. **JSON parse** — the packet parses; 5 mappings.
2. **Schema** — exact required key sets on every mapping and every `medicalEvidence` item (title,
   authors, summary, url); `nexusTheory` within {Causation, Aggravation, Medication Side Effect}
   (this wave: 3 Causation, 2 Medication Side Effect); non-empty required fields.
3. **URL format** — every `url` matches `^https://pubmed\.ncbi\.nlm\.nih\.gov/\d+/$`; 15 evidence
   rows, 15 distinct PMIDs (3 per mapping).
4. **Live identity cross-check (E-utilities)** — esummary for all 15 cited PMIDs returned 0 title or
   first-author mismatches. Full abstracts had been retrieved during drafting and every quantitative
   claim in the packet comes from the retrieved abstract text.
5. **Functional URL check (real browser)** — all 15 canonical PubMed URLs fetched from a real
   Chromium tab on the pubmed.ncbi.nlm.nih.gov origin: 15/15 HTTP 200 with page titles matching the
   stored titles.
6. **Self-audit and fixes applied during validation** —
   - Mapping 1's mechanism lacked the literal "at least as likely as not" standard; a sentence was
     added tying the evidence (majority prevalence plus shared physiology plus progression gradient)
     to the standard before the documentation checklist.
   - Mapping 5's secondary-code description said "analogous to" where the packet's other rows and
     the audit use "by analogy under § 4.20"; reworded for consistency (the insomnia evaluation is
     described as by analogy to the § 4.130 mental-disorder formula, with § 4.14 barring duplicate
     evaluation).
   - Post-edit rerun of the structural check: 0 errors; self-audit (legal hook, standard phrase,
     § 3.310 subparagraph, competing-cause discussion, Part 4 DCs, Part 4 citation, evidence-row
     bounds, URL format): all checks PASS on all 5 mappings.

## Results

- Structural / schema / enum / URL errors after fixes: **0** (5 mappings, 15 evidence rows)
- Live NCBI identity mismatches: **0** (15/15)
- Functional URL failures in browser: **0** (15/15)
- Self-audit: **PASS** on all 5 mappings

## Schema projection (next step, not yet authored)

| Mapping | conditionId (secondary) | nexusClassification | mechanismCategory | etiologicalConsensus | vaNexusProbabilityAlignment |
| --- | --- | --- | --- | --- | --- |
| Hepatic steatosis ← type 2 diabetes | hepatic-steatosis | DIRECT_CAUSATION | MICROVASCULAR_METABOLIC | WELL_ESTABLISHED | AT_LEAST_AS_LIKELY_AS_NOT |
| Osteopenia ← corticosteroids (RA) | osteopenia | DIRECT_CAUSATION | PHARMACOLOGICAL_IATROGENIC | IATROGENIC_TREATMENT_EFFECT | AT_LEAST_AS_LIKELY_AS_NOT |
| Carpal tunnel syndrome ← hypothyroidism | carpal-tunnel-syndrome | DIRECT_CAUSATION | MECHANICAL_OR_COMPRESSIVE | PROBABLE | AT_LEAST_AS_LIKELY_AS_NOT |
| Hypogonadism ← opioids (DDD) | hypogonadism | DIRECT_CAUSATION | PHARMACOLOGICAL_IATROGENIC | IATROGENIC_TREATMENT_EFFECT | AT_LEAST_AS_LIKELY_AS_NOT |
| Insomnia ← TBI | insomnia | DIRECT_CAUSATION | NEUROLOGICAL_DEGENERATION | PROBABLE | AT_LEAST_AS_LIKELY_AS_NOT |

Note: no `MEDICATION_SIDE_EFFECT` value exists in the repo's `nexusClassification` enum; the
medication/treatment effect theory is represented as `DIRECT_CAUSATION` +
`PHARMACOLOGICAL_IATROGENIC` + `IATROGENIC_TREATMENT_EFFECT`, consistent with waves 1–2.

## Notes and limitations

- Population-level evidence supports association and mechanism; it does not establish an individual
  nexus or the "at least as likely as not" opinion, which is case-specific.
- The hypothyroidism → carpal tunnel route rests on a genuinely modest adjusted association
  (1.44, 95% CI 1.27–1.63) with publication bias and a small Mendelian-randomization effect
  (OR 1.04); the packet states this honestly and shifts the individual-opinion burden onto
  electrodiagnostic severity, thyroid status, chronology, and exclusion of competing causes.
- Osteopenia carries an open batch-67 deferral concerning its outgoing outcomes (continuum with
  osteoporosis); this packet adds only an incoming treatment-effect route, matching the existing
  hypopituitarism incoming row. Where the documented endpoint is osteoporosis rather than
  osteopenia, the claim should target the osteoporosis identity.
- The hypothalamic-pituitary-gonadal suppression from opioids is dose-, duration-, and agent-
  dependent and is potentially reversible; the individual opinion must address baseline
  documentation and dose reduction/discontinuation response.
- Post-TBI insomnia evidence is heterogeneous (I² high; prevalence 27.0% with wide CI) and subject
  to confounding by pain, PTSD, and medication; § 3.310(d)(1) provides no presumption and § 4.14
  bars duplicate evaluation where insomnia is a symptom of an already service-connected disorder.
- NAFLD-in-diabetes prevalence is large and consistent, but competing etiologies (alcohol, viral,
  drug-induced, other metabolic contributors) must be excluded in the individual case; the packet
  lists them.
- All citations remain pending qualified-human verification under
  `docs/citation-verification-sop.md`; mapping approval is not citation verification.
