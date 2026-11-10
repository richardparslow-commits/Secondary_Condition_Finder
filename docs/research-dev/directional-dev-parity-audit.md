# Directional relationship evidence: DEV import receipt (2026-11-10)

Source: immutable 2026-11-09 public PubMed metadata snapshot; digest `37ef11e59267ea3c6cbe5ed1220a93879e707f376f3440188e4149648545bb0f`.

- Designated Tiger Cloud service: `m8vrpmo6ec` / `secondary-condition-finder-test`, environment `DEV`, status `READY`. No Production services or schemas touched.
- Read-only source validation: `python3 scripts/automation/export-directional-review-batch-dev.py --check` passed.
- SQL schema: `scf_directional_review_48_dev`, immutable queue run `6365440d94f88a01b360a04f92ab9f1a94323a5cacfd5dbdf6b8605c72a008e2`.
- Transactional insert and independent read-only exact-row parity: **48/48** review rows passed.
- Metadata coverage: **90 unique cited PMIDs** with registry metadata, **21/48** text-search candidate-hit pathways. These only check registry metadata and discovery—not clinical evidence strength.
- Node regression tests: **2 passed**. Python exporter verification and JS validation passed.
- All records remain `NOT_REVIEWED`; qualified medical approvals: **0**; Production changes: **0**.
- Auditor instructions: confirm article titles/PMIDs, actual full-text relevance, source versus target direction, plausible mechanisms, alternative explanations, contradictory studies and any individual-nexus wording. The existing app's 21 published directional pathways were not edited or silently approved.
- Security: importer validates named DEV service identity, endpoint and TLS, uses explicit `apply --dev-write` and immutable run keys, revokes PUBLIC on new schema. The existing Tiger ingestion helper uses a restricted-to-DEV service *administrative* SQL role; a least-privilege ingestion role remains advisable before scaling.

Reproduce: `python3 scripts/automation/export-directional-review-batch-dev.py --check`, `node scripts/automation/import-directional-review-queue-dev.mjs verify`, and `node --test tests/dev-directional-review-48.test.mjs`. Do not rerun SQL writes after a network ambiguity without checking live run parity first.
