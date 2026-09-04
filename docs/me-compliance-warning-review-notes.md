# ME / CRG Warning Review Notes

Measured from the current branch head using `npm run audit:me-compliance`.

Status: informational warnings only; 0 CRG violations.

## 1. PTSD → erectile-dysfunction (PHARMACOLOGICAL_IATROGENIC mechanism, PROBABLE consensus)

File: `ptsd.json::suggestions[2] (erectile-dysfunction)`
Rule: `GRAPH-PHARM-CONSENSUS`

Current state:
- mechanismCategory: `PHARMACOLOGICAL_IATROGENIC`
- etiologicalConsensus: `PROBABLE`

Review stance:
- The audit script flags PHARMACOLOGICAL_IATROGENIC mechanism with PROBABLE consensus as worth qualified-human review, because medication/treatment-related mechanisms are usually expressed under the IATROGENIC_TREATMENT_EFFECT tier when the evidence is explicitly about a treatment effect.
- This is not an automatic violation. The review question is whether the edge should be reclassified to IATROGENIC_TREATMENT_EFFECT, or whether PROBABLE is the correct consensus tier and the mechanism label is intentionally conservative.
- Recommended action: qualified-human review before publish. Decide whether the edge asserts a treatment effect or a broader pharmacological association, and align consensus tier and mechanism category accordingly.

## 2. anemia <-> chronic-kidney-disease (bidirectional edge pair)

Rule: `GRAPH-BIDIRECTIONAL`

Review stance:
- Both directions exist. Each direction must independently justify its nexus classification, guard, and evidence base.
- Bidirectional clinical overlap is expected here, but the lexicon expects directionality discipline: one direction may be association-only, another may be a different pathway, or both may be association-only with separate guards.
- Recommended action: review each direction independently and confirm that neither direction asserts individual causation or aggravation beyond what its guard supports.

## 3. cardiac-arrhythmia <-> cardiomyopathy (bidirectional edge pair)

Rule: `GRAPH-BIDIRECTIONAL`

Review stance:
- Same bidirectional review requirement as above.
- Cardiac arrhythmia and cardiomyopathy have clinically plausible bidirectional relationships, which is exactly why the directionality guard matters.
- Recommended action: review each direction independently before any publish step; confirm the published direction is not conflating a shared downstream phenotype with causation in both directions.

## 4. depressive-disorder <-> sleep-apnea (bidirectional edge pair)

Rule: `GRAPH-BIDIRECTIONAL`

Review stance:
- Same bidirectional review requirement as above.
- Depression and sleep apnea frequently co-occur for multiple overlapping reasons; bidirectional authoring needs separate guards for each direction.
- Recommended action: review each direction independently and confirm the guards restrict each to the proposition its evidence actually supports.

## 5. depressive-disorder <-> erectile-dysfunction (bidirectional edge pair)

Rule: `GRAPH-BIDIRECTIONAL`

Review stance:
- Same bidirectional review requirement as above.
- Depression and erectile dysfunction have overlapping behavioral, vascular, endocrine, and treatment-related contributions, which makes directionality discipline important.
- Recommended action: review each direction independently; pay particular attention to treatment effects and competing explanations in whichever direction is being considered for publication.

## 6. PTSD → erectile-dysfunction (qualified as a medication-related aggravation theory)

File: `ptsd.json::suggestions[2] (erectile-dysfunction)`
Rule: previously `GRAPH-PHARM-CONSENSUS`; warning removed by rewriting the edge's nexus posture.

Authoring decision:
- The edge is qualified as a case-specific medication-related aggravation theory, not a general PTSD-to-erectile-dysfunction causation conclusion.
- The edge is authored as AGGRAVATION and PHARMACOLOGICAL_IATROGENIC.
- Etiological consensus was moved to IATROGENIC_TREATMENT_EFFECT so the mechanism label and consensus tier are explicitly coherent for a treatment-effect theory.
- The live clinical source reference (pmid-19473282) is unchanged.

Reconciliation status:
- The authoritative registry text for `rel-ptsd-to-erectile-dysfunction` has been updated to match the approved KB rationale.
- The authoritative registry recognizes the KB edge through an authorized verification-only normalized suggestion-object hash, and the master source `pmid-19473282` also carries the authorized normalized reference hash.
- This edge is no longer provisional.

Review stance:
- This qualification removes the `GRAPH-PHARM-CONSENSUS` warning by aligning mechanism and consensus.
- The edge remains flagged by `GRAPH-BIDIRECTIONAL` because `depressive-disorder <-> erectile-dysfunction` is a bidirectional pair.
- The bidirectional review requirement still applies before any publish step that touches either direction.

Artifacts:
- KB edge: `data/knowledge-base/ptsd.json`
- Registry state: `data/evidence/master-relationships.json`
- Source state: `data/evidence/master-sources.json`
- Warning record: `docs/me-compliance-warning-review-notes.md`

## Summary

No code changes are required to clear the current gates. These items are the review queue for any future publish-oriented batch that touches:

- the four bidirectional pairs, and
- any other edge that reaches a publish-oriented review with a similar consensus/mechanism alignment question.

The PTSD → erectile-dysfunction edge no longer generates the `GRAPH-PHARM-CONSENSUS` warning because its consensus tier was moved to `IATROGENIC_TREATMENT_EFFECT` to match the PHARMACOLOGICAL_IATROGENIC mechanism.
