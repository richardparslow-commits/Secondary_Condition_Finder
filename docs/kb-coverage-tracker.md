# Knowledge Base Coverage & Clinical Evidence Tracker

This is the authoritative current-state tracker for post-v2 clinical evidence work. Detailed batch histories remain in `docs/clinical-evidence-promotion-batch-*.md` and the original 107-identity expansion scope remains defined by `docs/condition-expansion-roadmap.md`.

## Current production-validated baseline

- Exact production baseline before these completion controls: **Clinical Evidence Promotion Batch 22**, squash SHA `51b36b39e96b3ea5c6d5bd3cf8efdcc92eb56a39`.
- Catalog / knowledge-base integrity: **300 / 300**.
- Wave 1–7 expansion identities: **107**.
- Roadmap-wave identities currently published with evidence-led mappings: **18**.
- Roadmap-wave identities currently draft: **89**.
- Of those 89 drafts, `data/expansion-dispositions.json` currently identifies **2 screened promotion candidates** and **87 intentional safe drafts**.
- `diabetes-mellitus-type-1` is **not** one of the 107 Wave 1–7 expansion identities. Earlier batch documentation that counted its Batch-9 CKD promotion in the Wave 1–7 promotion total was bookkeeping drift; the roadmap-backed current count is 18 published / 89 draft.

## Current citation position after Batch 22

The provenance-aware citation ratchet is:

- live references: **70**;
- live verified: **8**;
- retired verified: **6**;
- verified provenance: **14**;
- live unverified: **62**;
- published-unverified review findings: **60**;
- live clinical-evidence references with canonical URLs: **63**;
- retired clinical-evidence references with canonical URLs: **4**;
- clinical-URL provenance: **67**.

A source-check record does not constitute qualified-human verification. `verified: true` remains a human decision under `docs/citation-verification-sop.md`. Run `npm run citations:queue` to generate the live human-review queue.

## Current Wave 1–7 dispositions

The machine-readable source of truth is `data/expansion-dispositions.json` and its regression contract `tests/expansion-dispositions.test.ts`.

### Published evidence-led Wave identities (18)

- Wave 1: `parkinsons-disease`, `multiple-sclerosis`, `seizure-disorder`.
- Wave 2: `psoriatic-arthritis`, `acl-injury`, `pcl-injury`, `cauda-equina-syndrome`.
- Wave 3: `thyroiditis`, `acromegaly`, `hyperaldosteronism`, `hypertensive-heart-disease`, `cardiomyopathy`, `pulmonary-hypertension`.
- Wave 4: none yet.
- Wave 5: `achalasia`, `barretts-esophagus`, `chronic-liver-disease`, `chronic-pyelonephritis`, `urethral-stricture`.
- Waves 6–7: none yet.

### Screened promotion candidates (2)

These remain draft until they receive their own bounded evidence batch and exact-head validation:

- `gout`;
- `myasthenia-gravis`.

`trigeminal-neuralgia` remains an intentional safe draft because the initially noted screening PMID did not match the condition/evidence proposition and no replacement source has yet passed the repository's promotion threshold.

### Intentional safe drafts (87)

All other Wave 1–7 identities remain `draft: true`. That is an acceptable reviewed product state. The objective is **not** to publish all 107 identities regardless of evidence; publication requires a defensible condition-specific relationship.

## Safety-remediation progress

Clinical Evidence Promotion Batches 1–22 have repeatedly used one of four outcomes:

1. promote a strong draft relationship with condition-specific evidence;
2. clinically repair a published relationship whose prior evidence was too weak or too generic;
3. withdraw an unsafe published edge or whole mapping back to draft; or
4. perform bounded identity/modeling cleanup without changing the 300/300 universe.

Major later safety withdrawals include legal/rating-only respiratory mappings, generic mental-health three-edge mappings, broad neurological residual mappings, the unsupported ED/CHF/stomach-cancer/abdominal-hernia GERD treatment chains, and the six-edge broad skull-fracture mapping. Detailed rationale is preserved in the individual batch documents and historical pathway-supersession ledger.

## Completion definition

The clinical evidence program is considered controlled when:

- every Wave 1–7 identity has an explicit disposition in `data/expansion-dispositions.json`;
- every live published relationship satisfies the repository's clinical-evidence/provenance rules;
- unsafe legacy relationships are withdrawn rather than retained for count preservation;
- remaining draft identities are explicitly classified as safe drafts or bounded promotion candidates;
- modeling debt is explicitly dispositioned without silently changing stable IDs or the 300-condition universe;
- every live unverified published source is available to a qualified human through `npm run citations:queue`;
- external/manual gates remain clearly separated from repository automation.

## Exact-head workflow

Every future evidence promotion or repair must continue to use: bounded branch from production-validated `main` → exact-head PR CI → immutable-head review → squash merge with expected-head protection → independent `main` CI → exact Vercel deployment/canonical-alias/log proof → Production Runtime Readiness.
