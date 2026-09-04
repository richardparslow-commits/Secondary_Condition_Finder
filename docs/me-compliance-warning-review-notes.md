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

## Summary

No code changes are required to clear the current gates. These five items are the review queue for any future publish-oriented batch that touches:

- the PTSD → erectile-dysfunction edge, and/or
- any of the four bidirectional pairs.
