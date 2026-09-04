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
- Both directions exist and both are currently authored as `ASSOCIATION_ONLY`.
- `anemia -> chronic-kidney-disease`: phenotype-specific temporal risk wording, sickle-cell-specific source guard, no pathway intelligence. Nexus claim explicitly states neither causation nor aggravation under 38 CFR § 3.310 is established; the guard limits the claim to association.
- `chronic-kidney-disease -> anemia`: disease-complication wording, KDIGO-based source guard requiring documented CKD and independently documented anemia. Nexus claim explicitly states neither causation nor aggravation is established; the guard limits the claim to association.
- Neither direction is currently asserting individual causation or aggravation. No nexus reclassification is being made here.
- Illustrative refined wording / tightening option, if a later review decides the direction-specific wording should be sharper: the anemia direction already restricts to sickle-cell-specific anemia; if the CKD direction is ever reviewed again, it could be tightened to also require that the anemia be documented as a separately evaluated finding rather than inferred from CKD stage alone (the current guard already says this, so this is consistency language, not a new restriction).
- Recommended action: confirm the current association-only posture is the intended permanent framing, or document a reason to keep one direction association-only and upgrade the other direction later under a defensible pathway. No code change is required to clear this warning today.

## 3. cardiac-arrhythmia <-> cardiomyopathy (bidirectional edge pair)

Rule: `GRAPH-BIDIRECTIONAL`

Review stance:
- Both directions exist. Each direction has a distinct guard and evidence base, so the bidirectional warning is structural, not an automatic inconsistency.
- `cardiac-arrhythmia -> cardiomyopathy`: phenotype-specific arrhythmia-induced cardiomyopathy wording, sustained/ sufficiently burdensome culprit arrhythmia guard, reversibility-after-rhythm-control strengthening note. Nexus claim is `ASSOCIATION_ONLY` with explicit statement that neither causation nor aggravation is established and the guard limits the claim to association.
- `cardiomyopathy -> cardiac-arrhythmia`: ME-1 bounded clinical proposition wording, requiring documented cardiomyopathy and separately documented clinically significant ventricular arrhythmia in a compatible structural-cardiomyopathy context. Nexus claim is `ASSOCIATION_ONLY` with explicit statement that neither causation nor aggravation is established.
- No nexus reclassification is being made here. The issue the bidirectional warning raises is whether both directions are independently honest about what they assert; the current wording is already explicit that neither direction asserts individual causation or aggravation.
- Illustrative refined wording / tightening option, if a later review wants tighter negation language: either direction could add the standard "it is not asserted that the primary caused or aggravated the secondary in any individual" sentence, which the current text does not include verbatim. That would be a consistency/documentation pass, not a change in the asserted nexus.
- Recommended action: review each direction independently before any publish step; confirm the arrhythmia-induced-cardiomyopathy direction stays phenotype-specific and the cardiomyopathy-to-arrhythmia direction stays anchored to clinically significant ventricular arrhythmia. No code change is required to clear this warning today.

## 4. depressive-disorder <-> sleep-apnea (bidirectional edge pair)

Rule: `GRAPH-BIDIRECTIONAL`

Review stance:
- Both directions exist with different nexus postures, which makes per-direction review necessary.
- `depressive-disorder -> sleep-apnea`: association-only direction, intermediate-step theory wording around antidepressant-associated weight gain and obesity-OSA risk, no pathway intelligence. Nexus claim is `ASSOCIATION_ONLY` with explicit statement that neither causation nor aggravation is established and the guard limits the claim to association.
- `sleep-apnea -> depressive-disorder`: aggravation direction, with PROBABLE consensus, at-least-as-likely-as-not alignment, and explicit baseline/aggravating-factor framing. Nexus claim is `AGGRAVATION`.
- No nexus reclassification is being made here. The review question is whether the two directions remain independently defensible and whether the aggravation direction is overclaiming given the cross-sectional/heterogeneous evidence.
- Illustrative refined wording / tightening option, if a later review wants the aggravation direction to be more explicit about individual-nexus limits: it could add an explicit sentence that the PROBABLE consensus and at-least-as-likely-as-not alignment are about the association/depression-risk relationship and do not, by themselves, establish that OSA aggravated this individual's depressive disorder. The current text already says the association should not be converted into an automatic individual causal or aggravation nexus, so this would be emphasis language, not a change in the asserted nexus.
- Recommended action: review each direction independently before any publish step; confirm the depression-to-OSA direction stays association-only and the OSA-to-depression direction stays anchored to the cross-sectional/heterogeneous evidence and explicit non-aggravation caveat. No code change is required to clear this warning today.

## 5. depressive-disorder <-> erectile-dysfunction (bidirectional edge pair)

Rule: `GRAPH-BIDIRECTIONAL`

Review stance:
- Both directions exist, and the two directions are not mirror images of the same claim.
- `depressive-disorder -> erectile-dysfunction`: DIRECT_CAUSATION direction with IATROGENIC_TREATMENT_EFFECT consensus, at-least-as-likely-as-not alignment, PHARMACOLOGICAL_IATROGENIC mechanism, and explicit psychotropic-medication intermediate-chain wording (agent-specific, dose/duration/timing, competing vascular/endocrine/neurologic/psychiatric/medication/lifestyle alternatives).
- `erectile-dysfunction -> depressive-disorder`: association-only direction, wording about erectile dysfunction contributing to reduced quality of life and depressive symptom risk; neither causation nor aggravation is asserted under 38 CFR § 3.310.
- This pair is flagged partly because it overlaps with the PTSD -> erectile-dysfunction edge, which is authored as a case-specific SSRI-in-the-service-connected-PTSD context medication-related aggravation theory and was qualified earlier in this review queue.
- No nexus reclassification is being made here. The review question is primarily directionality discipline: the depression-to-ED direction is a treatment-effect theory with conservative individual-nexus limits, and the ED-to-depression direction is association-only.
- Illustrative refined wording / tightening option, if a later review wants the direct-causation direction to be even more explicit: it could restate that the DIRECT_CAUSATION nexus classification is about the proposed medication-mediated secondary theory and the conservative individual-nexus guard, not a population-level statement that depressive disorder causes erectile dysfunction; the current rationale and evidence gaps already do most of that work.
- Recommended action: review each direction independently before any publish step that touches either one, and confirm the PTSD -> erectile-dysfunction medication-specific aggravation theory is evaluated in that context rather than assumed to be interchangeable with the depressive-disorder -> erectile-dysfunction treatment-effect theory.
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
