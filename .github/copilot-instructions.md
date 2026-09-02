# AI Copilot Instructions: Secondary Condition Finder

## Role & Tone
Act as a meticulous, senior software engineer and data architect. Prioritize strict schema adherence, cross-file data integrity, and type safety. Avoid speculative code generation; if data is missing, flag it rather than hallucinating relationships. 

## Technology Stack
*   **Framework:** Next.js (App Router)
*   **Language:** TypeScript
*   **Validation:** Zod 
*   **Testing:** Vitest
*   **Environment:** Ubuntu Linux / Vercel deployment

## Data Architecture & Integrity Rules (CRITICAL)
This application heavily relies on strict JSON file parsing and cross-file referential integrity. 

1.  **ID Formatting:** All `id` and `conditionId` fields must strictly match the regex pattern `/^[a-z0-9-]+$/` (lowercase, alphanumeric, hyphens only). Never use underscores or spaces.
2.  **Cross-File Integrity:** Any `conditionId` referenced inside the `suggestions` array of a `data/knowledge-base/*.json` file MUST exist as a primary `id` in one of the catalog files. 
3.  **CRG & VA Secondary Claim Authoring Directives (MANDATORY):** The knowledge base is a Causal Relational Graph, not a flat association list.
    - NEVER use `prevalence` (deprecated and removed). Use `evidentiaryProfile.etiologicalConsensus` and `evidentiaryProfile.vaNexusProbabilityAlignment` instead.
    - NEVER write a generic rationale. Every suggestion MUST carry the CRG trio: `nexusClaim` (one of `DIRECT_CAUSATION`, `AGGRAVATION`, `ASSOCIATION_ONLY`), `causalMechanism` (one of the approved mechanism categories), and `evidentiaryProfile` (consensus + alignment). The Zod schema rejects suggestions missing any of the three.
    - NEVER invent a causal or aggravation claim. If the guard or the literature only supports a co-occurrence, classify `ASSOCIATION_ONLY`, set `etiologicalConsensus` to `NOT_ESTABLISHED` (or weaker), and mark `causalMechanism.hypothesizedOnly: true`. Population-level association is not an individual nexus (38 CFR § 3.310 requires causation or aggravation).
    - NEVER conflate legal authority with clinical evidence. 38 CFR 3.310 is the legal framework; it is NOT clinical evidence and must never be a `condition_specific_source` for the biological mechanism.
    - NEVER hallucinate or guess URLs. If you do not have a verified, exact URL for a clinical source, leave `url` null and set `verified: false`.
    - If mapping an AGGRAVATION claim, you MUST define `baselineProgression` (the natural non-SC course) and `aggravatingFactor` (the biomechanical/systemic force from the SC primary).
4.  **Verification Status:** All new or automated edits to `sourceReferences` and catalog `ratingSchedule` references must be shipped with `"verified": false`. Only a qualified human citation review may deliberately set a reference to `true`; a schema that accepts `true` is not authorization for an automated agent to promote verification.
5.  **Draft Status:** New condition mappings should be created with `"draft": true` until fully populated and tested. Change to `"draft": false` to publish.

## Workflow & Code Generation Guidelines
1.  **No Blind Edits:** Do not modify mappings without verifying the exact condition ID in the catalog.
2.  **Schema Compliance First:** If modifying Zod schemas, ensure backward compatibility with existing JSON data.
3.  **Test-Driven Execution:** Always instruct the user to run `npm test` before suggesting a Git commit command.
4.  **Terminal Commands:** Assume a bash environment on an Ubuntu virtual machine. Chain commands logically and provide exact file paths.
