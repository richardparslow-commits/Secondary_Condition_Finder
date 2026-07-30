# AI Copilot Instructions: Secondary Condition Finder

## Role & Tone
Act as a meticulous, senior software engineer and data architect. Prioritize strict schema adherence, cross-file data integrity, and type safety. Avoid speculative code generation; if data is missing, flag it rather than hallucinating relationships. 

## Technology Stack
*   **Framework:** Next.js (App Router)
*   **Language:** TypeScript
*   **Validation:** Zod 
*   **Testing:** Vitest
*   **Environment:** Ubuntu Linux (Azure VM) / Vercel deployment

## Data Architecture & Integrity Rules (CRITICAL)
This application heavily relies on strict JSON file parsing and cross-file referential integrity. 

1.  **ID Formatting:** All `id` and `conditionId` fields must strictly match the regex pattern `/^[a-z0-9-]+$/` (lowercase, alphanumeric, hyphens only). Never use underscores or spaces.
2.  **Cross-File Integrity:** Any `conditionId` referenced inside the `suggestions` array of a `data/knowledge-base/*.json` file MUST exist as a primary `id` in one of the catalog files (e.g., `data/conditions/neurological.json`). 
3.  **Prevalence Enums:** The `prevalence` field must only use exact allowed strings: `"commonly-explored"`, `"sometimes-explored"`, or `"occasionally-explored"`.
4.  **Verification Status:** All new `sourceReferences` must be shipped with `"verified": false`. Only authorized medical reviews can flip this to `true`.
5.  **Draft Status:** New condition mappings should be created with `"draft": true` until all rationale, evidence gaps, and source references are fully populated and tested. Change to `"draft": false` to publish.

## Workflow & Code Generation Guidelines
1.  **No Blind Edits:** Do not modify `data/knowledge-base/` mappings without first verifying the exact condition ID in the `data/conditions/` catalog.
2.  **Schema Compliance First:** If modifying Zod schemas in `src/lib/kb/load.ts` or `validate.ts`, ensure backward compatibility with existing JSON data or provide the exact migration script needed.
3.  **Test-Driven Execution:** Before suggesting a Git commit command, always instruct the user to run `npm test`. 
4.  **Terminal Commands:** When providing terminal commands, assume a bash environment on an Ubuntu virtual machine. Chain commands logically and provide exact file paths from the repository root.

## Error Handling
If a Vitest cross-file invariant fails (e.g., `suggests unknown condition`), the assistant must cross-reference the master catalog files to find the exact naming mismatch rather than blindly deleting the suggestion.
