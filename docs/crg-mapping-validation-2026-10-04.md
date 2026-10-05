# CRG secondary-mapping packet validation — 2026-10-04

Three mapping packets produced in this session were persisted as docs artifacts and machine-validated
against their own schema and against live NCBI records. No registry or knowledge-base files were
modified; nothing was staged or committed (freeze until 2026-10-11 respected).

## Artifacts

- [crg-gap-mapping-packet-2026-10-04.json](crg-gap-mapping-packet-2026-10-04.json) — registry-gap set:
  migraine←tinnitus (6260→8100, Aggravation); GERD←NSAIDs (5003→7206, Medication Side Effect);
  tinnitus←TBI (8045→6260, Causation); fibromyalgia←PTSD (9411→5025, Causation);
  OSA←TBI (8045→6847, Causation).
- [crg-exemplar-mapping-packet-2026-10-04.json](crg-exemplar-mapping-packet-2026-10-04.json) — exemplar set:
  OSA←PTSD (9411→6847); GERD←NSAIDs; migraine←tinnitus; lumbar radiculopathy←DDD (5242/5243→8520);
  ED←SSRI (9411→7522, Medication Side Effect).
- [crg-packet-e-mapping-2026-10-04.json](crg-packet-e-mapping-2026-10-04.json) — third packet
  (validated 2026-10-04 against the persisted artifact): ED←T2DM (7913→7522, Causation); diabetic
  gastroparesis←T2DM (7913→§ 4.114 analogy, Causation); insomnia←alcohol use disorder
  (§ 3.301 intermediate-step chain, § 4.130, Causation); peptic ulcer disease←OA on chronic NSAID
  therapy (5003→7304, Medication Side Effect); stroke residuals←OSA (6847→8007-8009, Causation).

GERD←NSAIDs and migraine←tinnitus appear in both packets by design (delivered in both rounds);
deduplication is expected at authoring time.

## Validation performed (2026-10-04)

1. **JSON parse** — both files parse; 5 mappings each.
2. **Schema** — every mapping carries exactly the required keys (`secondaryCondition`,
   `secondaryDiagnosticCode`, `primaryCondition`, `primaryDiagnosticCode`, `nexusTheory`,
   `etiologicalMechanism`, `medicalEvidence`, `cfrCitations`); every `medicalEvidence` item carries
   exactly `title`, `authors`, `summary`, `url`; `nexusTheory` is within
   {Causation, Aggravation, Medication Side Effect}; required strings and arrays are non-empty.
3. **URL format** — every `url` matches `^https://pubmed.ncbi.nlm.nih.gov/<PMID>/$`.
4. **PMID coverage** — 29 distinct cited PMIDs; every one is present in the live-verified set of
   31 PMIDs retrieved through NCBI E-utilities during this session. The two verified-but-uncited
   PMIDs (34247952, 34402323) are registry precedents referenced in audit prose only.
5. **Live identity cross-check** — esummary for all 29 cited PMIDs; 39 stored evidence rows compared
   by normalized title and first author against the NCBI records: 0 mismatches.
6. **Packet E (third packet, same pipeline, run against the persisted artifact)** — 5 mappings /
   15 evidence rows / 15 distinct PMIDs (3 rows each); exact key sets, `nexusTheory` enum and URL
   pattern pass with 0 errors; live esummary cross-check of all 15 cited PMIDs compared 15 stored
   evidence rows by normalized title and first author: 0 mismatches. Packet E shares no PMIDs with
   A/B (A 18, B 21, A∩B 10, E 15; 44 distinct across all three packets).

## Results

- Structural / schema / enum / URL errors: **0** (A/B: 39 evidence rows; E: 15)
- Live NCBI cross-check mismatches: **0** (54 evidence rows across 44 distinct PMIDs)

## Notes and limitations

- These packets are docs artifacts, not authored CRG rows. Slotting into the repository's
  `suggestionSchema` (max 3 sourceReferences, min 1 evidenceGap, nexusClaim/causalMechanism/
  evidentiaryProfile arms, registry lockstep, `verified: false` pending the qualified-human SOP)
  remains future work.
- Population-level evidence supports association and mechanism; it does not establish an individual
  nexus or the "at least as likely as not" opinion, which is case-specific.
- Packets C, D, F and G from this session were delivered in chat with live-verified citations but are
  not persisted as docs artifacts; the persisted, validated set is A, B and E.
- Files are new/untracked and intentionally uncommitted during the freeze window.
