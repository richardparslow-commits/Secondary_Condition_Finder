# Secondary Condition Finder Product Specification

Status: implemented product baseline
Scope: current user-facing product behavior. Phase milestones and external acceptance gates are tracked separately in `docs/phase-plan.md` and their governing issues.

## Problem

A veteran service connected for one condition often has no practical way to
learn which related conditions are commonly considered alongside it, or what
evidence a secondary claim would need. That knowledge sits with experienced
representatives and is unevenly distributed.

## Users

- Veterans researching their own claims
- Accredited representatives and VSO staff
- Claim-preparation support staff

## Product paths

Two research paths are chosen at `/` because they need different evidence.

**Secondary track.** Given one or more diagnosed and service-connected primary
conditions, returns ranked **possible secondary conditions to explore**, each
with reasoning, evidence gaps, and citations to verify. The workflow can also
accept optional bounded medication/treatment context and browser-local evidence
for research review without using those inputs as proof of causation or nexus.

**Presumptive track.** Given where and when someone served, returns the
exposure presumptions that may apply and the conditions each covers. See
`docs/presumptive-track.md`.

## What the product explicitly does not do

- Diagnose, or suggest that any condition is present
- Estimate approval likelihood, ratings, or compensation
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
  5) grouped suggestions,
  6) evidence review.
- Diagnosed selections come only from catalog condition ids.
- Service-connected step only shows diagnosed selections.
- Ratings step only shows service-connected selections and accepts 0–100 or decline.
- Step 4 supports browser-local analysis of PDF, DOCX, supported text files, and pasted text. Raw document bytes/text are not submitted to the application server. Extracted excerpts and provenance may be retained only in the current tab's `sessionStorage` for Step 6 review.
- Optional medication/treatment entries are bounded and are stored only in the encrypted, authenticated, short-lived secondary-workflow cookie. They are not serialized into workflow URLs and do not change recommendation ranking.
- Steps 2 through 6 are guarded against invalid or incomplete prior-step state.
- Server workflow selections are carried in an HttpOnly, SameSite=Strict, AES-256-GCM-protected cookie with a 30-minute maximum age. Back navigation reads that workflow state so users can revise earlier choices without putting sensitive workflow context into the URL.
- Finish Review and Start a new review explicitly clear the encrypted workflow cookie plus the secondary workflow's browser-local evidence/checklist stores.

### FR-2 Recommendations

Each suggestion shows:

- Condition name
- A qualitative prevalence band: commonly, sometimes, or occasionally explored. Never a number, never a percentage.
- Rationale, attributed to each contributing primary condition
- Evidence gaps: what a claim on this theory typically still needs
- Source references, each flagged verified or unverified and labeled by source role: Legal framework, Clinical evidence, or Procedural guidance
- Suggestions grouped by selected service-connected primary condition in the workflow UI
- For recognized conditions with no authored mappings, the UI must say they are recognized-but-unmapped and that absence implies nothing about claim viability.

Where a subject-matter author has explicitly supplied it for a specific primary-to-secondary mapping, Step 5 may additionally show:

- one or more bounded **Pathway to evaluate** labels;
- an authored causal-chain summary;
- bounded questions to develop with a clinician or representative; and
- bounded issues to resolve before relying on the theory.

Pathway intelligence is optional and primary-specific. The application does not infer these fields from medication/treatment entries, uploaded evidence excerpts, or other Veteran-entered context. An un-authored mapping must remain un-labeled. The displayed pathway metadata is explanatory research content only and does not establish causation, aggravation, nexus, eligibility, or likelihood of approval.

Ordering: rank 1 contributes 1.0, rank 2 contributes 0.5, rank n contributes 1/n. Contributions from multiple primaries add, so a suggestion supported by two conditions outranks a single-source suggestion at the same rank. Ties break alphabetically. The score is an ordering heuristic and is never displayed. Optional medication/treatment literal matches and authored pathway intelligence are research/display cues only and do not alter this ordering, filtering, or prevalence.

### FR-3 Multiple primaries

- Suggestions shared across primaries merge on `conditionId`, combining evidence gaps and citations while retaining each contributing primary's own rationale and optional authored pathway intelligence.
- A condition the user already listed as primary is never suggested as a secondary of another primary.
- Duplicate or differently-cased entries for the same condition collapse.

### FR-4 Catalog and mapping outcomes

The current six-step secondary workflow accepts diagnosed conditions from the catalog only. Recommendation processing distinguishes:

- **Mapped**: the selected service-connected condition has authored research.
- **Unmapped**: the condition is in the catalog but no published secondary mapping is available; the UI states that absence implies nothing about claim viability.

Legacy free-text/unrecognized-primary behavior remains isolated to legacy code paths and is not reintroduced into the current catalog-only workflow.

### FR-5 Disclaimers and legal copy

- Scope/disclaimer copy appears throughout intake and results/review surfaces.
- The UI states that suggestions are not approval probabilities and citations are research starting points to verify.
- Unverified citations carry an inline badge where applicable.
- Source-role labels distinguish legal framework, clinical evidence, and procedural guidance so a legal authority is not presented as medical nexus evidence.
- Secondary legal citation text rendered in routes must come from the canonical legal reference modules rather than route-level hardcoded copies.

### FR-6 Demo scenarios

- At least three repeatable, explicitly synthetic scenarios live in `data/demo-scenarios.json`, including a single-primary case and a multiple-primary overlap case.
- Scenario data is represented in current secondary-workflow terms: diagnosed ids, service-connected ids, ratings/decline, document-sharing choice, and optional bounded medication/treatment context.
- `/scenarios` does not construct a legacy `/results?...` URL. Launching a demo submits only a bounded scenario id to a server action.
- The server resolves the version-controlled scenario, validates it through the current workflow parser/catalog, writes the same encrypted short-lived secondary-workflow session used by normal intake, and redirects to current Step 5 Suggestions.
- Launching a demo clears prior secondary-workflow browser-local evidence and checklist state so a synthetic demonstration cannot inherit excerpts or selections from an earlier review in the same tab.
- A test asserts that every scenario runs through the current workflow contract and returns deterministic evidence-backed recommendations.

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

- Step 6 shows authored evidence gaps as a user-controlled browser-local review checklist.
- A checkmark means only that the user found material they want to review; the app does not automatically mark a gap satisfied from extracted text.
- Browser-local evidence review may show extracted excerpts with provenance from Step 4. This is organizational/research support, not an adjudicative or medical sufficiency determination.
- Step 5 pathway intelligence frames authored theories and development questions; it does not replace or duplicate the Step 6 evidence-gap review.
- Step 6 provides a browser-generated consultation summary text export using authored recommendation content, contributing primaries, evidence gaps, and citations. Raw local-evidence excerpts and optional medication/treatment match context are excluded from that export by default.

## Data model

Three layers are deliberately separate. See `docs/condition-catalog.md`.

- `data/conditions/` is the catalog: condition identity and rating schedule citations, currently **300 conditions across 33 catalog files**. The versioned target catalog v2 is complete; its controlled Waves 1-7 record is in `docs/condition-expansion-roadmap.md`. Post-v2 maintenance may physically normalize or scope stable identities without changing the 300-condition universe. By Batch 8, fibromyalgia, hip strain, and ankle strain live in musculoskeletal maintenance; diabetic retinopathy is in the ophthalmologic file; insomnia plus substance-use disorder are in `mental-disorders.json`; `carried-over.json` contains only the intentionally quarantined `contralateral-knee-condition` laterality placeholder; Cushing's syndrome and Type 1 diabetes are physically maintained in `endocrine.json` with DC 7907 and DC 7913 frameworks; and the stable `hyperpituitarism` identity is display-scoped to the prolactin-secreting pituitary-dysfunction language of DC 7916 rather than treated as a generic umbrella for every pituitary hormone-excess disorder.
- `data/knowledge-base/` holds exactly one secondary-mapping file per catalog condition, referencing catalog ids. After Clinical Evidence Promotion Batches 1 through 8, **96 of the 107 identities added by Waves 1-7 remain safe drafts**. Eleven expansion mappings have individually reviewed published relationships: `cardiomyopathy`, `urethral-stricture`, `hypertensive-heart-disease`, `chronic-pyelonephritis`, `chronic-liver-disease`, `acl-injury`, `pcl-injury`, `barretts-esophagus`, `achalasia`, `hyperaldosteronism`, and `acromegaly`. Safety review has returned `ankle-strain`, `knee-injury`, `osteoarthritis`, `ageusia`, `agranulocytosis`, `al-amyloidosis`, `addisons-disease`, and `anorexia-nervosa` to draft after unsupported published relationship content was withdrawn. Existing published mappings for `amputation-or-loss-of-use`, `anosmia`, `alopecia-areata`, and `hypertension` have had legal/rating-only relationship support replaced with condition-specific clinical evidence. Batch 8 also publishes `cushings-syndrome` → `hypertension` after endocrine-specific clinical review. Individual published suggestions may optionally contain bounded `pathwayIntelligence` authored for that exact primary-to-secondary mapping.
- `data/presumptives/` holds exposure categories.

The catalog is the single source of display names, so a label cannot drift between mapping files. Referential integrity is enforced by tests and by load-time validation before recommendation logic runs.

When the rating schedule does not provide a single diagnosis-specific diagnostic code, the catalog may record the applicable joint, nerve, spine, neoplasm, laryngeal, ocular, digestive, genitourinary, mental-disorder, hematologic, skin, infectious, oncological, dental/oral, or residual rating framework with an explicit review note. Product expansion-wave grouping does not override the actual Part 4 rating authority; a cross-system condition must cite the schedule where VA actually evaluates it. When a broader regulatory umbrella overlaps a narrower existing catalog diagnosis, the two identities must remain distinguishable and must not claim each other's names or aliases. When a roadmap identity intentionally groups related diagnoses, the user-facing grouping does not authorize clinical authors to treat the grouped diagnoses as one etiology or one secondary pathway. Shared diagnostic codes also do not collapse distinct disease identities or establish common medical causation. Current-code scope must be preserved: obsolete codes cannot be revived as present authority, and a code limited to a disease site, severity, treatment state, residual, or named endocrine phenotype cannot be generalized to every presentation of the broader diagnosis. Rating context is condition identity/rating information only and must not be presented as clinical nexus evidence.

Clinical source provenance is separate from citation verification status. An automated or agent-authored change may record a canonical source URL, `sourceCheckedOn`, `sourceLocator`, and `verificationScope`, but must keep `verified: false` until qualified-human verification is completed under `docs/citation-verification-sop.md`.

After Batch 8, the automated citation-debt ceilings tighten to **135 total references, 14 verified, 121 unverified, and 119 published-unverified review findings**, while the clinical-evidence-with-canonical-URL floor rises to **44**. Tightening that floor does not constitute qualified-human source verification.

JSON in git rather than an opaque production database keeps mapping, pathway intelligence, and citation changes reviewable as pull request diffs.

## Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | A user can complete current secondary intake and receive ranked exploration suggestions | Met |
| 2 | Every published suggestion includes explanation text and source references under repository policy | Met, enforced by tests/audits |
| 3 | Raw local evidence remains browser-local and is not required for server recommendation execution | Met, enforced by privacy tests |
| 4 | Disclaimers and non-adjudicative boundaries are visible in workflow/results views | Met, enforced by copy/contracts |
| 5 | At least three synthetic demo scenarios launch through the current encrypted workflow rather than legacy query-state URLs | Met, enforced by `tests/demo-scenarios.test.ts` |
| 6 | Step 5 can expose bounded, authored-only pathway intelligence and source roles without changing recommendation order, scores, prevalence, or intake matching | Met, enforced by `tests/step5-pathway-intelligence.test.ts` and CI |
| 7 | Target catalog v2 contains exactly 300 one-to-one catalog/KB identities; post-v2 evidence promotion may change individual mapping publication state only after relationship-specific clinical review and must not alter the 300/300 contract | Met in repository contract; production closure requires exact-head CI and runtime readiness |

## External/manual truth gates

This specification does not mark external or human-only gates complete. Their governing issues remain authoritative, including credentialed VA sandbox smoke evidence (#189), manual Section 508 review (#195), and production runtime `WORKFLOW_SESSION_SECRET` verification (#213). Automated repository tests or a successful deployment alone are not substitutes for those gate-specific exit criteria.
