# CRG draft-identity mapping packet validation — wave 5 (2026-10-05)

Fifth mapping packet produced on 2026-10-05, persisted as a docs artifact and machine-validated
against its own schema, live NCBI records, and the live PubMed pages. No registry, knowledge-base,
graph, or authored-corpus files were modified; the packet is not an authored CRG row.

## Artifacts

- [crg-draft-identity-mapping-packet-wave5-2026-10-05.json](crg-draft-identity-mapping-packet-wave5-2026-10-05.json) —
  five mappings targeting draft identities and under-documented routes:
  1. Barrett's esophagus ← gastroesophageal reflux disease (7206 → 7207, Causation)
  2. Peripheral neuropathy (chronic alcohol-related) ← alcohol use disorder (§ 4.130 evaluation →
     8520/§ 4.124a, Causation)
  3. Diabetic nephropathy ← type 2 diabetes (7913 → 7541 with § 4.115a renal-dysfunction criteria,
     Causation)
  4. Hypertensive retinopathy ← hypertension (7101 → § 4.79 / DC 6006, Causation)
  5. Gout ← hypertension on chronic thiazide or loop diuretic therapy (7101 → § 4.20 analogy to
     § 4.71a entries, Medication Side Effect)
- Waves 1–4 remain at their packet and validation-record files in this directory.

## Why these five

Statuses were read from the live backlog tracker and incoming-edge counts from the authored corpus:

| Secondary identity | Tracked status | Incoming edges before this packet |
| --- | --- | --- |
| barretts-esophagus | PUBLISHED | 1 (hiatal-hernia) — no GERD route despite GERD being the cardinal clinical criterion |
| peripheral-neuropathy | DRAFT | 11 (cancers, HIV, malabsorption, malnutrition, and similar) — no alcohol route |
| diabetic-nephropathy | DRAFT | 0 — first incoming route |
| hypertensive-retinopathy | DRAFT | 0 — first incoming route |
| gout | PUBLISHED | 0 — first incoming route |

Prior waves and the authored corpus already cover the brief's example routes (PTSD → sleep apnea,
DDD → radiculopathy, depression/PTSD → erectile dysfunction, tinnitus → migraine, NSAID → GERD) and
the waves 1–4 targets; none is repeated. Diabetes → retinopathy, diabetes → CKD, and
periodontitis ↔ diabetes were deliberately not used because routes already exist or the reciprocal
pair would collide with an authored row.

## Legal verification (live eCFR, 2026-10-01 edition)

- **§ 3.310(a)** — secondary service connection including treatment complications — is the hook for
  all five mappings; **§ 3.310(b)** baseline/aggravation limits are recorded on every mapping.
- Diagnostic codes fetched live this wave:
  - **DC 7101** (§ 4.104, cardiovascular): "Hypertensive vascular disease (hypertension and
    isolated systolic hypertension)" with the 100/60/40/20/10 levels and the minimum 10-percent
    evaluation for continuous medication — used for the primary in mappings 4 and 5
  - **DC 7541** (§ 4.115b): "Renal involvement in diabetes mellitus type I or II — rate as renal
    dysfunction" — the dedicated code for diabetic nephropathy; § 4.115a supplies the renal
    dysfunction criteria (GFR- and albumin-creatinine-ratio-based 100/80/60/30/0 levels), and
    § 4.115 records the nephritis principles including the cardiovascular-renal rating rule
  - **§ 4.130** (mental disorders): the complete code list 9201–9440 contains no substance-specific
    entry; the alcohol-use-disorder primary is therefore framed as evaluated under the General
    Rating Formula for Mental Disorders, with § 4.14 barring duplicate evaluation — verified
    against the full live section text
  - Reused from wave 4 verification: DC 7206 (GERD) and DC 7207 (Barrett's esophagus) — § 4.114
  - Reused from prior-wave verification: DC 8520 (§ 4.124a), DC 5002/DC 5003 (§ 4.71a)

## Validation performed (2026-10-05)

1. **JSON parse** — the packet parses; 5 mappings.
2. **Schema** — exact required key sets on every mapping and every `medicalEvidence` item;
   `nexusTheory` within the enum (4 Causation, 1 Medication Side Effect); non-empty required fields;
   primary and secondary diagnostic-code fields each carry a four-digit code or a documented
   "No dedicated DC" framing.
3. **URL format** — every `url` matches `^https://pubmed\.ncbi\.nlm\.nih\.gov/\d+/$`; 15 evidence
   rows, 15 distinct PMIDs.
4. **Live identity cross-check (E-utilities)** — PMIDs were located by live esearch during drafting
   and every quantitative claim was extracted from retrieved abstract text. The first esummary run
   found one title-fidelity difference: PubMed's record for PMID 9742976 (UKPDS 33) carries the
   corporate group name as part of the title string ("... (UKPDS 33). UK Prospective Diabetes Study
   (UKPDS) Group."); the stored title was corrected and the rerun returned **0 mismatches** across
   all 15 rows, with the corporate-author record (no listed personal authors) handled explicitly.
5. **Functional URL check (real browser)** — all 15 canonical PubMed URLs fetched from a real
   Chromium tab on the pubmed.ncbi.nlm.nih.gov origin: 15/15 HTTP 200 with page titles matching the
   stored titles.
6. **Self-audit** — per mapping: § 3.310 legal hook, the literal "at least as likely as not"
   standard, § 3.310 subparagraph, competing-cause discussion, diagnostic-code framing, Part 4
   citation, evidence-row bounds, URL format — all checks PASS on all 5 mappings after the one
   title correction.

## Results

- Structural / schema / enum / URL errors: **0** (5 mappings, 15 evidence rows)
- Live NCBI identity mismatches after the title correction: **0** (15/15)
- Functional URL failures in browser: **0** (15/15)
- Self-audit: **PASS ×5**

## Schema projection (next step, not yet authored)

| Mapping | conditionId (secondary) | nexusClassification | mechanismCategory | etiologicalConsensus | vaNexusProbabilityAlignment |
| --- | --- | --- | --- | --- | --- |
| Barrett's ← GERD | barretts-esophagus | DIRECT_CAUSATION | MECHANICAL_OR_COMPRESSIVE (closest available label for chronic reflux mucosal injury) | WELL_ESTABLISHED | AT_LEAST_AS_LIKELY_AS_NOT |
| Peripheral neuropathy ← AUD | peripheral-neuropathy | DIRECT_CAUSATION | METABOLIC_OR_NUTRITIONAL | PROBABLE | AT_LEAST_AS_LIKELY_AS_NOT |
| Diabetic nephropathy ← T2DM | diabetic-nephropathy | DIRECT_CAUSATION | MICROVASCULAR_METABOLIC | WELL_ESTABLISHED | AT_LEAST_AS_LIKELY_AS_NOT |
| Hypertensive retinopathy ← hypertension | hypertensive-retinopathy | DIRECT_CAUSATION | MICROVASCULAR_METABOLIC | WELL_ESTABLISHED | AT_LEAST_AS_LIKELY_AS_NOT |
| Gout ← diuretics (hypertension) | gout | DIRECT_CAUSATION | PHARMACOLOGICAL_IATROGENIC | IATROGENIC_TREATMENT_EFFECT | AT_LEAST_AS_LIKELY_AS_NOT |

Note: no `MEDICATION_SIDE_EFFECT` value exists in the repo's `nexusClassification` enum; the
medication/treatment effect theory is represented as `DIRECT_CAUSATION` +
`PHARMACOLOGICAL_IATROGENIC` + `IATROGENIC_TREATMENT_EFFECT`, consistent with waves 1–4.

## Notes and limitations

- **Governance flag — alcohol-use-disorder**: the authored `alcohol-use-disorder` identity carries
  an active window-discipline note (its only registered window is alcohol-use-disorder →
  chronic-liver-disease, authored ASSOCIATION_ONLY on exposure-based evidence; a second window
  requires a redundancy adjudication, `npm run audit:crg`, before authoring). The wave-5 neuropathy
  route is a docs-packet proposal only and must pass that adjudication before it can be authored.
  The packet's mechanism discloses the diagnosis-versus-exposure mapping and the requirement for a
  quantified drinking history rather than relying on the label alone.
- **Barrett's esophagus**: prevalence in persons without GERD is substantial (2.2% with GERD-based
  ascertainment; 4.9% in high-quality population-based studies without GERD), so the individual
  opinion must establish the veteran's actual reflux burden and the biopsy-documented metaplasia
  rather than relying on population odds alone.
- **Alcohol-related neuropathy**: the 46.3% pooled prevalence is exposure-defined (chronic alcohol
  abusers); the individual claim requires electrodiagnostic confirmation of an axonal,
  length-dependent pattern and exclusion of diabetes (the dominant competing cause),
  hypothyroidism, and nutritional/deficiency states.
- **Diabetic nephropathy**: pooled CKD prevalence in T2DM is 27% with wide between-study
  heterogeneity; the UKPDS trial establishes the causal-modifier direction (glycemic control
  reduces microvascular risk) rather than an individual nexus; the rating runs through the
  § 4.115a renal-dysfunction criteria under DC 7541.
- **Hypertensive retinopathy**: prevalence varies with population and grading (12.6% among elderly
  hypertensives in the cited study; up to ~10% mild signs in general non-diabetic adults); diabetes
  is the key competing cause and must be documented and weighed.
- **Diuretic-associated gout**: the ARIC analysis shows the association is mediated by serum urate
  (null after urate adjustment) — strong mechanistic support but decisive documentation is serial
  urate before/during therapy plus the attack chronology; the Bruderer study carries a published
  erratum; alcohol is a parallel pathway to gout that must be excluded or weighed.
- All citations remain pending qualified-human verification under
  `docs/citation-verification-sop.md`; mapping approval is not citation verification.
