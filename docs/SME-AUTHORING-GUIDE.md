# Subject Matter Expert (SME) Authoring Guide

## Welcome to the Secondary Condition Finder Knowledge Base
This repository maps primary service-connected conditions to potential secondary conditions under **38 CFR 3.310**. 

Your job is to take `draft: true` JSON files and populate them with accurate clinical rationales and legal citations.

### The JSON Structure
Every draft file lives in `data/knowledge-base/`. To publish a file, you must provide:

1. **Suggestions Array:** Add 1 or more secondary conditions.
   - `conditionId`: Must exactly match a file in `data/conditions/`.
   - `rank`: Starts at 1. Lower number = higher likelihood.
   - `prevalence`: "commonly-explored", "sometimes-explored", or "occasionally-explored".
   - `rationale`: Plain-text medical explanation (e.g., "Altered gait from knee strain shifts biomechanical load to the contralateral hip...").
   - `evidenceGaps`: Array of strings detailing what a veteran needs (e.g., "Current hip diagnosis", "IMO linking gait alteration").
2. **Source References:** Between **1 and 3 maximum** sources per suggestion.
   - `citation`: E.g., "38 CFR 3.310(a)".
   - `note`: Plain text explanation of the rule.
   - `verified`: **MUST REMAIN FALSE**. (This flags it for final legal review).

### How to Promote a File
Once you have filled out the JSON and emptied the `todo: []` array:
1. Save the file.
2. Run the validation script: `node scripts/promote-kb-batch.js <condition-id>`
3. Commit and push your changes.
