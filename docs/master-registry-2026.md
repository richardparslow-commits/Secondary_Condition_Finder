# Master Relationship & Evidence Registry 2026

## Status

This repository contains an authoritative current-state registry for the clinical relationship graph and its evidence-source identities.

The registry was originally installed from the fully closed ME-2 baseline and is now updated atomically with Mapping Expansion Batch ME-3 from parent baseline `61f9bc5e28b5907a854eb1f38ba7a787dee4375a`.

## Authoritative files

- `data/evidence/master-relationships.json`
- `data/evidence/master-sources.json`

The condition knowledge-base JSON remains the application-facing representation. The master registry is the parity contract: a relationship/source change must be represented in both layers or `scripts/audit-master-registry.js` fails.

## Relationship state after ME-3 implementation / before citation verification

- 188 relationships.
- 114 explicit structured publication guards.
- 74 legacy rationale boundaries.
- No legacy guard is fabricated: legacy rows preserve the exact current rationale with `structuredGuardText: null`.

## Source states

The master source registry deliberately separates evidence identity from citation-verification state:

- `active`: live source whose KB reference is `verified:true`.
- `pending-verification`: live clinical source whose KB reference is `verified:false` and requires separate qualified-human citation verification.
- `superseded-unverified`: historical source identity replaced before verification.
- `bibliographic-correction-only`: correction/erratum lineage, not simultaneous live evidence.
- `retired-only`: previously verified source retained only in the retirement ledger.

After ME-3 implementation and before citation verification:

- 196 live relationship-source uses.
- 168 active source entities.
- 5 pending-verification source entities.
- 167 active clinical sources.
- 5 pending clinical sources.
- 1 active legal-authority entity (`38 CFR 3.310`).
- 7 superseded-unverified source entities.
- 1 correction-only entity.
- 1 retired-only source entity.
- 182 total source entities including lineage/history.
- 6 retired-verified relationship-source uses preserved.

## Fail-closed verification parity

`verified:true` in the KB must map to master status `active`.

`verified:false` in the KB must map to master status `pending-verification`.

A separate qualified-human citation-verification batch must promote both layers atomically:

`verified:false -> true` and `pending-verification -> active`.

PubMed identity matching alone never authorizes verification promotion.

## Integrity boundary

ME-3 does not add taxonomy identities, change publication status, add `pathwayIntelligence`, or claim an individual VA medical nexus. Population-level associations remain bounded by their explicit publication guards.
