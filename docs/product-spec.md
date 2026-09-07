# Secondary Condition Finder Product Specification

Status: implemented product baseline
Scope: current user-facing product behavior. Phase milestones and external acceptance gates are tracked separately in `docs/phase-plan.md` and their governing issues.

## Problem

A veteran may already have one or more service-connected conditions plus other diagnosed conditions that are not service connected, but may have no practical way to research whether an established service-connected condition could have caused, contributed to, aggravated, or otherwise medically related to one of those existing non-service-connected diagnoses. That knowledge sits with experienced representatives and clinicians and is unevenly distributed.

## Users

- Veterans researching their own claims
- Accredited representatives and VSO staff
- Claim-preparation support staff

## Product paths

Two research paths are chosen at `/` because they need different evidence.

**Secondary track.** The current six-step workflow starts from diagnoses the user reports, separates them into already service-connected and not-service-connected sets, and then evaluates the diagnosed non-service-connected conditions against the already service-connected conditions. Step 5 is organized by each non-service-connected diagnosis. Under that diagnosis it lists only already service-connected conditions with an authored published relationship worth evaluating, together with rationale, evidence gaps, source references, and optional authored pathway intelligence. The workflow does not use a service-connected condition to generate a separate forward-looking list of diagnoses the user did not report. It can also accept optional bounded medication/treatment context and browser-local evidence for research review without using those inputs as proof of causation or nexus.

**Presumptive track.** Given where and when someone served, returns the exposure presumptions that may apply and the conditions each covers. See `docs/presumptive-track.md`.

## What the product explicitly does not do

- Diagnose, infer, or generate a medical condition the user did not report
- Estimate approval likelihood, ratings, or compensation
- Treat the absence of a published Step 5 relationship as a medical opinion that no relationship is possible
- Treat medication/treatment matches or local evidence excerpts as proof of causation, aggravation, nexus, competency, credibility, or VA acceptance
- Treat authored Step 5 pathway labels, causal chains, development questions, or issues to resolve as proof of an individual medical or legal conclusion
- File claims or generate completed VA claim forms
- Persist raw uploaded medical records in application-server storage

## Functional requirements

### FR-1 Secondary intake and workflow state

- Secondary intake is a six-step workflow:
  1) diagnosed conditions,
  2) service-connected status,
  3) current ratings,
  4) optional supporting-document and medication/treatment context,
  5) diagnosis-centered connection review,
  6) evidence review for those same diagnosed non-service-connected conditions.
- Diagnosed selections come only from catalog condition ids.
- Service-connected step only shows diagnosed selections and requires an explicit Yes/No answer for each diagnosis. Diagnoses marked Yes form the already-service-connected comparison set; diagnoses marked No form the non-service-connected target set for Step 5.
- Ratings step only shows service-connected selections and accepts 0–100 or decline.
- Step 4 supports browser-local analysis of PDF, DOCX, supported text files, and pasted text. Raw document bytes/text are not submitted to the application server. Extracted excerpts and provenance may be retained only in the current tab's `sessionStorage` for Step 6 review.
- Optional medication/treatment entries are bounded and are stored only in the encrypted, authenticated, short-lived secondary-workflow cookie. They are not serialized into workflow URLs and do not change recommendation ranking.
- Steps 2 through 6 are guarded against invalid or incomplete prior-step state.
- Server workflow selections are carried in an HttpOnly, SameSite=Strict, AES-256-GCM-protected cookie with a 30-minute maximum age. Back navigation reads that workflow state so users can revise earlier choices without putting sensitive workflow context into the URL.
- Finish Review and Start a new review explicitly clear the encrypted workflow cookie plus the secondary workflow's browser-local evidence/checklist stores.

### FR-2 Diagnosis-centered Step 5 connection review

Every diagnosed condition that the user marked not service connected is a top-level Step 5 result, including a diagnosis for which the current published knowledge base has no supported relationship from any selected service-connected condition.

For a non-service-connected diagnosis with one or more supported relationships, the result may show:

- Condition name and body system for the diagnosed non-service-connected target
- Each already service-connected contributing condition that has an authored published relationship to that target
- Rationale attributed to each contributing service-connected condition
- Evidence gaps: what research on that relationship typically still needs
- Source references, each flagged verified or unverified and labeled by source role: Legal framework, Clinical evidence, or Procedural guidance
- Optional literal medication/treatment context matches, clearly labeled as research cues rather than proof
- Conservative VA reference terminology for the non-service-connected diagnosis when available

For a diagnosed non-service-connected condition with no current published relationship, Step 5 keeps the diagnosis visible and states that no supported mapping was found for the selected combination. That message must also state that the absence of a mapping is not a medical conclusion that no relationship is possible.

Where a subject-matter author has explicitly supplied it for a specific service-connected-to-non-service-connected mapping, Step 5 may additionally show:

- one or more bounded **Pathway to evaluate** labels;
- an authored causal-chain summary;
- bounded questions to develop with a clinician or representative; and
- bounded issues to resolve before relying on the theory.

Pathway intelligence is optional and primary-specific. The application does not infer these fields from medication/treatment entries, uploaded evidence excerpts, or other Veteran-entered context. An un-authored mapping must remain un-labeled. The displayed pathway metadata is explanatory research content only and does not establish causation, aggravation, nexus, eligibility, or likelihood of approval.

Step 5 must not render a second service-connected-primary-centered section that lists all authored downstream diagnoses. It must not surface a recommendation for a diagnosis the user did not select in Step 1.

The recommendation engine may retain internal rank/score behavior for merging authored mappings, but Step 5's user-facing organization is by diagnosed non-service-connected condition, not by service-connected primary. Optional medication/treatment literal matches and authored pathway intelligence are research/display cues only and do not alter recommendation ordering, filtering, or prevalence.

### FR-3 Multiple service-connected contributors

- If multiple selected service-connected conditions have authored relationships to the same diagnosed non-service-connected condition, the target appears once and retains each contributing service-connected condition's own rationale and optional authored pathway intelligence.
- A condition already marked service connected is never a Step 5 target.
- A diagnosis not selected by the user is never added to Step 5 merely because it is an authored downstream condition in the knowledge base.
- Duplicate or differently-cased entries for the same condition collapse through catalog identity.

### FR-4 Catalog and mapping outcomes

The current six-step secondary workflow accepts diagnosed conditions from the catalog only. Step 5 distinguishes:

- **Supported connection found**: at least one selected service-connected condition has an authored published mapping to the diagnosed non-service-connected condition.
- **No published connection found**: the diagnosed non-service-connected condition remains visible, but no selected service-connected condition has a current published mapping to it. The UI states that this is a knowledge-base result, not a negative medical opinion or conclusion about claim viability.

Legacy free-text/unrecognized-primary behavior remains isolated to legacy code paths and is not reintroduced into the current catalog-only workflow.

### FR-5 Disclaimers and legal copy

- Scope/disclaimer copy appears throughout intake and results/review surfaces.
- The UI states that relationship results are research leads, not approval probabilities, and citations are research starting points to verify.
- Unverified citations carry an inline badge where applicable.
- Source-role labels distinguish legal framework, clinical evidence, and procedural guidance so a legal authority is not presented as medical nexus evidence.
- Secondary legal citation text rendered in routes must come from the canonical legal reference modules rather than route-level hardcoded copies.

### FR-6 Demo scenarios

- At least three repeatable, explicitly synthetic scenarios live in `data/demo-scenarios.json`, including a single-primary case and a multiple-primary overlap case.
- Scenario data is represented in current secondary-workflow terms: diagnosed ids, service-connected ids, ratings/decline, document-sharing choice, and optional bounded medication/treatment context.
- `/scenarios` does not construct a legacy `/results?...` URL. Launching a demo submits only a bounded scenario id to a server action.
- The server resolves the version-controlled scenario, validates it through the current workflow parser/catalog, writes the same encrypted short-lived secondary-workflow session used by normal intake, and redirects to current Step 5 connection review.
- Launching a demo clears prior secondary-workflow browser-local evidence and checklist state so a synthetic demonstration cannot inherit excerpts or selections from an earlier review in the same tab.
- A test asserts that every scenario runs through the current workflow contract and returns deterministic evidence-backed relationship results.

### FR-7 Presumptive matching

- Users select service locations and optionally a service date range.
- Matching is exact on location and inclusive on date boundaries.
- Omitted dates produce a match on location alone, flagged explicitly in the UI.
- Unmatched locations are reported back with a note that a claim is still possible with supporting evidence.
- Categories out of scope are named on the results screen so the list does not read as exhaustive.
- Every category carries source URLs and a `sourceCheckedOn` date.

### FR-8 Draft conditions

- A condition may exist as `draft: true` with an empty `suggestions` array and a non-empty `todo` checklist.
- Drafts are validated and version controlled but never resolvable through published lookup and never listed as published recommendations.
- Schema rejects a published entry with no suggestions, and rejects a published entry with an unresolved todo.
- Post-v2 publication is relationship-specific: completion of a catalog wave does not authorize bulk publication. Each primary mapping must independently satisfy condition-specific clinical-evidence, rationale, provenance, and evidence-gap requirements before its `draft` flag is removed.

### FR-9 Event logging

Recommendation-event logging is constrained to approved non-free-text fields. Raw local evidence, optional medication/treatment entries, workflow checklist selections, claim identifiers, and other user medical free text must not be added to recommendation logs or telemetry.

### FR-10 Evidence review and consultation summary

- Step 6 is limited to the same diagnosed non-service-connected conditions evaluated in Step 5 and must not reintroduce unrelated forward-looking secondary suggestions.
- Step 6 keeps diagnosed non-service-connected conditions with no current published connection visible and explains that no mapped relationship evidence checklist is available for that diagnosis.
- For a supported Step 5 connection, Step 6 shows authored evidence gaps as a user-controlled browser-local review checklist and identifies the contributing already-service-connected conditions.
- A checkmark means only that the user found material they want to review; the app does not automatically mark a gap satisfied from extracted text.
- Browser-local evidence review may show extracted excerpts with provenance from Step 4. This is organizational/research support, not an adjudicative or medical sufficiency determination.
- Step 5 pathway intelligence frames authored theories and development questions; it does not replace or duplicate the Step 6 evidence-gap review.
- Step 6 provides a browser-generated consultation summary text export using only the supported relationship recommendations reviewed in Step 5, including contributing primaries, evidence gaps, and citations. Raw local-evidence excerpts and optional medication/treatment match context are excluded from that export by default.

## Data model

Three layers are deliberately separate. See `docs/condition-catalog.md`.

- `data/conditions/` is the catalog: condition identity and rating schedule citations, currently **813 conditions across 33 catalog files**. The 2026-09 master-list expansion is complete; its controlled expansion record is in `docs/condition-expansion-roadmap.md`. Post-expansion maintenance may physically normalize or scope stable identities without changing the 813-condition universe. By Batch 11, fibromyalgia, hip strain, and ankle strain live in musculoskeletal maintenance; diabetic retinopathy is in the ophthalmologic file; insomnia plus substance-use disorder are in `mental-disorders.json`; `carried-over.json` contains only the intentionally quarantined `contralateral-knee-condition` laterality placeholder; and Cushing's syndrome, Type 1 diabetes, Hyperthyroidism, Hyperparathyroidism, and Hypoparathyroidism are physically maintained in `endocrine.json` with DC 7907, DC 7913, DC 7900, DC 7904, and DC 7905 frameworks. The stable `hyperpituitarism` identity is display-scoped to the prolactin-secreting pituitary-dysfunction language of DC 7916 rather than treated as a generic umbrella for every pituitary hormone-excess disorder.
- `data/knowledge-base/` holds exactly one secondary-mapping file per catalog condition, referencing catalog ids. The current repository contains **813 mappings**, with **139 published / 674 draft** and **353 authored relationships**. All 361 live source references are verified after the all-94 citation-verification approval and the ME-36 PTSD expansion (six published association-only relationships with qualified-human-verified sources); citation verification changes source state only and does not publish draft mappings. Historical promotion details remain in the numbered batch records, while current status is maintained in `docs/clinical-program-status.md` and `data/evidence/master-sources.json`. Individual published suggestions may optionally contain bounded `pathwayIntelligence` authored for that exact primary-to-secondary mapping.
- `data/presumptives/` holds exposure categories.

The catalog is the single source of display names, so a label cannot drift between mapping files. Referential integrity is enforced by tests and by load-time validation before recommendation logic runs.

When the rating schedule does not provide a single diagnosis-specific diagnostic code, the catalog may record the applicable joint, nerve, spine, neoplasm, laryngeal, ocular, digestive, genitourinary, mental-disorder, hematologic, skin, infectious, oncological, dental/oral, or residual rating framework with an explicit review note. Product expansion-wave grouping does not override the actual Part 4 rating authority; a cross-system condition must cite the schedule where VA actually evaluates it. When a broader regulatory umbrella overlaps a narrower existing catalog diagnosis, the two identities must remain distinguishable and must not claim each other's names or aliases. When a roadmap identity intentionally groups related diagnoses, the user-facing grouping does not authorize clinical authors to treat the grouped diagnoses as one etiology or one secondary pathway. Shared diagnostic codes also do not collapse distinct disease identities or establish common medical causation. Current-code scope must be preserved: obsolete codes cannot be revived as present authority, and a code limited to a disease site, severity, treatment state, residual, or named endocrine phenotype cannot be generalized to every presentation of the broader diagnosis. Rating context is condition identity/rating information only and must not be presented as clinical nexus evidence.

Clinical source provenance is separate from citation verification status. An automated or agent-authored change may record a canonical source URL, `sourceCheckedOn`, `sourceLocator`, and `verificationScope`, but must keep `verified: false` until qualified-human verification is completed under `docs/citation-verification-sop.md`.

After Batch 11, the automated citation-debt ceilings tighten to **130 total references, 14 verified, 116 unverified, and 114 published-unverified review findings**, while the clinical-evidence-with-canonical-URL floor rises to **49**. Tightening that floor does not constitute qualified-human source verification.

JSON in git rather than an opaque production database keeps mapping, pathway intelligence, and citation changes reviewable as pull request diffs.

## Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | A user can complete current secondary intake and see every diagnosed non-service-connected condition, with any supported already-service-connected contributors listed underneath | Met |
| 2 | A diagnosis the user did not report is never introduced in Step 5 merely because it is a possible authored downstream condition of a selected service-connected primary | Met, enforced by `tests/non-service-connected-focus.test.ts` and browser CI |
| 3 | A diagnosed non-service-connected condition with no supported mapping remains visible and is not presented as a negative medical conclusion | Met, enforced by diagnosis-centered workflow tests |
| 4 | Every published relationship result includes explanation text and source references under repository policy | Met, enforced by tests/audits |
| 5 | Raw local evidence remains browser-local and is not required for server recommendation execution | Met, enforced by privacy tests |
| 6 | Disclaimers and non-adjudicative boundaries are visible in workflow/results views | Met, enforced by copy/contracts |
| 7 | At least three synthetic demo scenarios launch through the current encrypted workflow rather than legacy query-state URLs | Met, enforced by `tests/demo-scenarios.test.ts` |
| 8 | Step 5 can expose bounded, authored-only pathway intelligence and source roles without changing recommendation order, scores, prevalence, or intake matching | Met, enforced by `tests/step5-pathway-intelligence.test.ts` and CI |
| 9 | Step 6 remains constrained to the same non-service-connected diagnosis set and does not reintroduce unrelated forward-looking suggestions | Met, enforced by `tests/non-service-connected-focus.test.ts` and browser CI |
| 10 | The current catalog contains exactly 813 one-to-one catalog/KB identities; post-expansion evidence promotion may change individual mapping publication state only after relationship-specific clinical review and must not alter the 813/813 contract | Met in repository contract; production closure requires exact-head CI and runtime readiness |

## External/manual truth gates

This specification does not mark external or human-only gates complete. Their governing issues remain authoritative, including credentialed VA sandbox smoke evidence (#189), manual Section 508 review (#195), and production runtime `WORKFLOW_SESSION_SECRET` verification (#213). Automated repository tests or a successful deployment alone are not substitutes for those gate-specific exit criteria.
