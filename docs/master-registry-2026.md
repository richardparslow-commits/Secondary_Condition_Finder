# Master Relationship & Evidence Registry 2026

## Status

This repository contains an authoritative current-state registry for the clinical relationship graph and its evidence-source identities.

The registry was installed from the fully closed baseline `ffadbe9460bd0dbda327781e20ec6f51e4cd854f` after a read-only discovery and qualified-human-approved discrepancy-resolution pass.

## Authoritative files

- `data/evidence/master-relationships.json`
- `data/evidence/master-sources.json`

The knowledge-base condition JSON remains the application-facing representation. The master registry is a parity contract and normalized evidence architecture: future relationship changes must update both the KB and registry, or `scripts/audit-master-registry.js` / `tests/master-registry-2026.test.ts` will fail.

## Current relationship state

- 183 relationships.
- 109 explicit structured publication guards.
- 74 legacy rationale boundaries.
- No legacy guard is invented: those 74 rows preserve the exact current rationale and keep `structuredGuardText: null` until a separate qualified-human guard-hardening review.

## Current source state

- 191 live relationship-source uses.
- 168 active normalized source entities.
- 167 active clinical sources.
- 1 active legal-authority entity (`38 CFR 3.310`).
- 7 superseded-unverified PMID entities retained only as provenance.
- 1 PubMed correction/erratum entity retained only as bibliographic lineage.
- 1 retired-only source entity.
- 6 retired-verified relationship-source uses preserved.

Source entity, source use, and provenance record are deliberately separate concepts.

## Integrity boundary

Registry installation does not change or re-approve any medical relationship. It does not change direction, rationale, rank, prevalence, evidence gaps, citation text, source URL, verification status, taxonomy, publication status, or pathway intelligence in the existing KB.

`verified:true` remains a citation/source-proposition review state. It does not establish an individual VA medical nexus and must not convert population-level association into individual causation.
