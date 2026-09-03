# Mapping Expansion Batch ME-28 — Approved Implementation Ledger

## Scope

ME-28 adds five conservative, draft-only, association-only mappings over existing Wave-8 identities. Each row has one condition-specific clinical reference, an explicit publication guard, bounded evidence gaps, and no pathway intelligence. No primary publication state changed.

| Primary | Target | PMID | Boundary |
|---|---|---:|---|
| `scleroderma` | `interstitial-lung-disease` | 32113575 | Require independent systemic-sclerosis and ILD diagnoses, compatible pulmonary phenotype/chronology, objective testing, and specialist review; preserve competing ILD causes. |
| `hypertrophic-obstructive-cardiomyopathy` | `congestive-heart-failure` | 29655822 | Require independent hypertrophic-cardiomyopathy and heart-failure diagnoses, objective cardiac findings, compatible chronology, and cardiology review; preserve competing cardiac causes. |
| `superior-semicircular-canal-dehiscence` | `conductive-hearing-loss` | 15021770 | Require compatible temporal-bone imaging and formal audiometry documenting the conductive phenotype; preserve alternative otologic causes. |
| `dysphagia` | `malnutrition-residuals` | 35985419 | Require independent dysphagia and nutritional-impairment documentation, objective intake/weight findings, compatible chronology, and specialist review. |
| `mixed-connective-tissue-disease` | `pulmonary-hypertension` | 37497727 | Require independent MCTD and pulmonary-hypertension diagnoses, subtype evaluation, objective testing, compatible chronology, and specialist review. |

## Evidence and publication state

- All five primary knowledge-base records remain `draft: true`.
- All five suggestions are `ASSOCIATION_ONLY`; no individual causation or aggravation is asserted.
- All five clinical references remain `verified: false` and `pending-verification`.
- Qualified-human citation review is required before citation promotion or publication-state change.
- The registry snapshots use exact suggestion-object and raw-reference hashes generated with repository canonicalization.

## Aggregate ratchet

- Relationships: `308 → 313`
- Live source reference uses: `316 → 321`
- Verified live uses: `256` unchanged
- Pending live uses: `60 → 65`
- Clinical uses: `311 → 316`
- Explicit publication guards: `234 → 239`
- Source entities including lineage: `302 → 307`

## Safety boundary

These records are evidence-navigation aids only. They do not diagnose a condition, establish a VA medical nexus, determine service connection, or replace qualified clinical and accredited-representative review. Pending citation state is intentionally fail-closed.
