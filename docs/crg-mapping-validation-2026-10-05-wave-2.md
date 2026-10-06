# CRG draft-identity mapping packet validation — wave 2 (2026-10-05)

Second mapping packet produced on 2026-10-05, persisted as a docs artifact and machine-validated
against its own schema, live NCBI records, and the live PubMed pages. No registry, knowledge-base,
or authored-corpus files were modified; the packet is not an authored CRG row.

## Artifacts

- [crg-draft-identity-mapping-packet-wave2-2026-10-05.json](crg-draft-identity-mapping-packet-wave2-2026-10-05.json) —
  five mappings targeting draft identities and genuinely unauthored corpus routes:
  1. Migraine ← tinnitus (6260 → 8100, Aggravation) — fills the corpus gap for the brief's example route
  2. NSAID-associated GERD ← osteoarthritis on chronic NSAID therapy (5003 → 7206, Medication Side Effect)
     — fills the corpus gap for the brief's example route (no osteoarthritis → gerd row exists)
  3. Seizure disorder (post-traumatic epilepsy) ← TBI (8045 → 8910-8914, Causation; § 3.310(d)(1)(ii) presumption)
  4. Dementia / neurocognitive disorder ← TBI (8045 → 9304/9312, Causation; § 3.310(d)(1)(iii) presumption)
  5. Anorgasmia ← SSRI-treated major depressive disorder (9434 → § 4.20 analogy within § 4.115b,
     Medication Side Effect)
- Wave 1 remains at
  [crg-draft-identity-mapping-packet-2026-10-05.json](crg-draft-identity-mapping-packet-2026-10-05.json)
  with its record at [crg-mapping-validation-2026-10-05.md](crg-mapping-validation-2026-10-05.md).

## Why these five

Statuses and incoming-edge checks were read from the live backlog tracker and authored corpus:

| Secondary identity | Tracked status | Notes before this packet |
| --- | --- | --- |
| migraine-headaches | PUBLISHED | No tinnitus → migraine row exists; tinnitus is DRAFT with 2 outgoing rows |
| gerd | PUBLISHED | No NSAID/osteoarthritis → gerd row exists (incoming: RA, T2DM, PTSD, hiatal hernia, spasm) |
| seizure-disorder | DRAFT | 0 authored suggestions; no TBI-identity → seizure row (cerebral-contusion → seizure exists) |
| dementia | DRAFT | No TBI → dementia row (only hypoglycemia → dementia exists) |
| anorgasmia | DRAFT | 0 incoming rows; 1 outgoing row (depressive-disorder) |

Brief examples already covered in the authored corpus and therefore not repeated: PTSD → sleep-apnea
(incoming row exists), degenerative-disc-disease → radiculopathy (exists), depressive-disorder → and
PTSD → erectile dysfunction (exist).

## Legal verification (live eCFR, 2026-10-01 edition)

- **§ 3.310(d)(1)(ii)**: unprovoked seizures following moderate or severe TBI are *held* to be the
  proximate result of the service-connected TBI absent clear evidence to the contrary.
- **§ 3.310(d)(1)(iii)**: presenile dementia of the Alzheimer type, frontotemporal dementia, and
  dementia with Lewy bodies are held to be the proximate result if manifest within 15 years following
  moderate or severe TBI — the presumption is diagnosis- and timing-specific; vascular dementia is
  not on the list and proceeds under § 3.310(d)(2).
- **§ 3.310(d)(3)** severity table and **§ 3.310(d)(2)** fallback recorded for both TBI mappings.
- **§ 3.310(a)** (including treatment complications) and **§ 3.310(b)** (aggravation with the
  baseline-evidence rule) recorded verbatim for the medication-effect and aggravation mappings.
- Diagnostic codes verified against the live schedule:
  - DC 6260 (tinnitus, recurrent; 10%) and DC 8100 (migraine) — § 4.87 and § 4.124a
  - DC 5003 (degenerative arthritis) — § 4.71a; DC 7206 (GERD, with its stricture/dysphagia criteria) — § 4.114
  - DC 8910-8914 (epilepsy: grand mal, petit mal, Jacksonian/focal, diencephalic, psychomotor) — § 4.124a
  - DC 8045 (residuals of TBI) — § 4.124a; DC 9304 (neurocognitive disorder due to TBI), 9312 (due to
    Alzheimer's disease), 9305 (vascular) — § 4.130
  - DC 9434 (major depressive disorder) and DC 9411 (PTSD) — § 4.130; no dedicated code for orgasmic
    disorder — § 4.115b framework with § 4.20 analogy (DC 7522 is the male analog)

## Validation performed (2026-10-05)

1. **JSON parse** — the packet parses; 5 mappings.
2. **Schema** — exact required key sets on every mapping and every `medicalEvidence` item (title,
   authors, summary, url); `nexusTheory` within {Causation, Aggravation, Medication Side Effect}
   (this wave exercises all three); non-empty required fields.
3. **URL format** — every `url` matches `^https://pubmed\.ncbi\.nlm\.nih\.gov/\d+/$`; 15 evidence
   rows, 15 distinct PMIDs (3 per mapping).
4. **Live identity cross-check (E-utilities)** — esummary for all 15 cited PMIDs: first pass found one
   title-fidelity difference (PubMed's record for PMID 11229449 carries the working-group subtitle);
   the stored title was corrected and the rerun returned 0 mismatches across all 15 rows. Full
   abstracts were retrieved for all 15 sources and every quantitative claim in the packet comes from
   the retrieved abstract text.
5. **Functional URL check (real browser)** — all 15 canonical PubMed URLs fetched from a real Chromium
   tab on the pubmed.ncbi.nlm.nih.gov origin: 15/15 HTTP 200 with page titles matching the stored titles.
6. **Direction and presumption guards** — the tinnitus-to-migraine mapping is framed as § 3.310(b)
   aggravation because the located population evidence is cross-sectional/directionally weighted
   toward migraine as exposure; the dementia mapping distinguishes the diagnosis-specific
   § 3.310(d)(1)(iii) presumption (Alzheimer-type, FTD, Lewy body within 15 years) from other
   dementias decided under § 3.310(d)(2).

## Results

- Structural / schema / enum / URL errors: **0** (5 mappings, 15 evidence rows)
- Live NCBI identity mismatches after the title correction: **0** (15/15)
- Functional URL failures in browser: **0** (15/15)

## Schema projection (next step, not yet authored)

| Mapping | conditionId (secondary) | nexusClassification | mechanismCategory | etiologicalConsensus | vaNexusProbabilityAlignment |
| --- | --- | --- | --- | --- | --- |
| Migraine ← tinnitus | migraine-headaches | AGGRAVATION (baselineProgression + aggravatingFactor) | NEUROLOGICAL_DEGENERATION (central sensitization) | PROBABLE | AT_LEAST_AS_LIKELY_AS_NOT |
| GERD ← NSAIDs | gerd | DIRECT_CAUSATION | PHARMACOLOGICAL_IATROGENIC | IATROGENIC_TREATMENT_EFFECT | AT_LEAST_AS_LIKELY_AS_NOT |
| Seizure ← TBI | seizure-disorder | DIRECT_CAUSATION | NEUROLOGICAL_DEGENERATION | WELL_ESTABLISHED | LEGALLY_PRESUMED (moderate/severe TBI) |
| Dementia ← TBI | dementia | DIRECT_CAUSATION | NEUROLOGICAL_DEGENERATION | WELL_ESTABLISHED (all-cause) | LEGALLY_PRESUMED (listed phenotypes within 15 years) |
| Anorgasmia ← SSRI | anorgasmia | DIRECT_CAUSATION | PHARMACOLOGICAL_IATROGENIC | IATROGENIC_TREATMENT_EFFECT | AT_LEAST_AS_LIKELY_AS_NOT |

Note: no `MEDICATION_SIDE_EFFECT` value exists in the repo's `nexusClassification` enum; the
medication/treatment effect theory is represented as `DIRECT_CAUSATION` +
`PHARMACOLOGICAL_IATROGENIC` + `IATROGENIC_TREATMENT_EFFECT`, consistent with the wave-1 projection.

## Notes and limitations

- Population-level evidence supports association and mechanism; it does not establish an individual
  nexus or the "at least as likely as not" opinion, which is case-specific.
- The tinnitus-to-migraine route is an aggravation theory: the medical literature is directionally
  weighted toward migraine as the exposure, so the individual opinion must establish the pre-tinnitus
  migraine baseline and the subsequent worsening.
- Post-traumatic seizure meta-analytic risk-factor estimates are limited by high heterogeneity even
  though individual high-quality studies identify severity, subdural hematoma, contusions, and age.
- The dementia presumption is diagnosis- and timing-specific; the strongest cohort and veteran data
  address all-cause and vascular dementia, which informs the medical opinion but does not itself
  trigger § 3.310(d)(1)(iii).
- The SSRI mapping must separate medication effect from the sexual effects of depression itself and
  from competing causes; pre-treatment baseline documentation is decisive.
- All citations remain pending qualified-human verification under
  `docs/citation-verification-sop.md`; mapping approval is not citation verification.
