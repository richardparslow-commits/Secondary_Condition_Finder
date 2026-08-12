# Subject Matter Expert (SME) Authoring Guide

## Welcome to the Secondary Condition Finder Knowledge Base
This repository maps primary service-connected conditions to potential secondary conditions under **38 CFR 3.310**.

Your job is to take `draft: true` JSON files and populate them with accurate clinical rationales and traceable legal/clinical sources. Published content must remain a research aid: do not write as though a pathway proves individual causation, aggravation, nexus, eligibility, or likely approval.

### The JSON Structure
Every draft file lives in `data/knowledge-base/`. To publish a file, you must provide:

1. **Suggestions Array:** Add 1 or more secondary conditions.
   - `conditionId`: Must exactly match a condition id in the catalog under `data/conditions/`.
   - `rank`: Starts at 1 and controls the engine's deterministic ordering heuristic within a primary mapping. It is **not** an approval probability or likelihood statement.
   - `prevalence`: `"commonly-explored"`, `"sometimes-explored"`, or `"occasionally-explored"`.
   - `rationale`: Plain-text explanation of the authored primary-to-secondary research relationship. Distinguish population-level association from individual causation when applicable.
   - `evidenceGaps`: Array of strings describing evidence that may still be needed for review.
   - `pathwayIntelligence` (optional): Step 5 explanation metadata for this exact primary-to-secondary mapping. It is displayed only when an SME explicitly authors it and never changes recommendation ranking.
     - `pathways`: 1–4 unique labels from the schema, such as `direct-secondary`, `aggravation`, `medication-related`, `biomechanical`, or `intermediate-chain`.
     - `causalChain` (optional): A concise chain to evaluate, such as `primary condition → supported intermediate mechanism → secondary condition`. Write it as a theory to investigate, not a finding.
     - `developmentQuestions`: Up to 6 questions for a clinician or representative to evaluate. Ask for independent assessment; do not direct a provider to reach a favorable conclusion.
     - `issuesToResolve`: Up to 5 unresolved factual/medical issues, such as diagnosis, timing, alternative causes, separate disability, or support for each link in an intermediate chain.
2. **Source References:** Between **1 and 3 maximum** sources per suggestion.
   - `citation`: Traceable citation text, e.g. `38 CFR 3.310(a)` or a PubMed-indexed article.
   - `note`: Explain what the source actually supports and what it does not support.
   - `verificationScope`: `legal-framework`, `clinical-evidence`, or `procedural-guidance`. Step 5 exposes this scope as a source-role label so users do not mistake a legal framework source for clinical nexus evidence.
   - Follow the repository citation-verification policy for `sourceUrl`, `sourceCheckedOn`, `sourceLocator`, and `verified`.

### Pathway Intelligence Guardrails
- Author pathway intelligence only when the existing mapping rationale/evidence supports the theory. Do not infer it from a Veteran's medication list, treatment entries, uploaded evidence, or other intake context.
- Do not create a new medical-causation proposition solely because a general claim-development worksheet lists a pathway category.
- Keep pathway metadata specific to the primary-to-secondary pair. If two primaries contribute to the same secondary, each primary may have different authored pathway intelligence.
- Do not describe aggravation using a stronger legal requirement than the current governing authority supports. Verify current law before authoring legal propositions.
- Keep detailed evidence-gap review in `evidenceGaps` / Step 6 rather than copying entire questionnaires into Step 5.

### How to Promote a File
Once you have filled out the JSON and emptied the `todo: []` array:
1. Save the file.
2. Run the validation script: `node scripts/promote-kb-batch.js <condition-id>`
3. Run the repository tests/audits required by CI.
4. Commit and push your changes for review.
