# MONDO ontology expansion: DEV import receipt (2026-11-10)

Pinned source: MONDO `v2026-10-06`, exact official/staged digest `a165dc2fc61761f5e5413b6395dd4afb14c89d78783af213a9b8f1d0a3f2a8c7`.

- Named Tiger Cloud DEV service `m8vrpmo6ec` (READY) and schema `scf_medical_ontology_dev` were verified **read-only by exact-row parity**: 36,055 MONDO concepts, 94,313 synonyms, 46,732 parent edges, 148,013 crossrefs, 819 app condition audits, 565 lexical app candidates and 875 app pathways.
- Active (non-obsolete) ontology concepts: **32,134**; conservative possible unlinked concepts: **31,554**. These counts refer to ontology concepts, not unique clinically approved diagnosed-condition additions.
- First **1,000** extra MONDO concept identifiers were selected for human terminology review across ten keyword-triage buckets (100 per bucket). Labels and identifiers are public ontology data; bucket classification is only keyword heuristics.
- New SQL reviewer queue schema `scf_ontology_candidate_queue_dev`, immutable run `d0a9a9f13e4e8fb63c4fc2969b6ddab4c6c4519a7ef8ac0102552bf16a04dbfd`, transactional DEV import and read-only exact-row parity passed **1,000/1,000**.
- Node regression tests: **6 passed**; Python snapshot-provenance tests passed. Python exporter and source manifest hash revalidation passed.
- Provenance hardening: the exporter recomputes the composite snapshot from the pinned source SHA-256 and all seven table hashes; the importer accepts only the approved snapshot and release, exact public row schema, and blank reviewer/decision fields. The DB client is closed if post-connect identity verification fails.
- Qualified medical concept reviews: **0**; app catalog remains **819**; app condition additions: **0**; published pathways: **0** from this work.
- Human review: check disease versus phenotype, aliases, ICD/xref identity, synonym collisions, obsolete/duplicate concepts and classification granularity before promoting any concept into the application.
- Security: public-only data, verified explicit DEV endpoint and TLS, immutable queue runs, PUBLIC grants revoked. Existing Tiger importer currently uses a DEV-only SQL administrative role; least-privilege ingestion should be configured before broader deployment.

Reproduce: `node scripts/ontology-tiger-dev.mjs verify`, `python3 scripts/automation/export-ontology-expansion-dev.py --check`, `node scripts/automation/import-ontology-review-queue-dev.mjs verify`, `node --test tests/dev-ontology-review-queue.test.mjs`. Regenerate the pinned staging data first if `/tmp/scf-mondo-20261006/staged` is no longer available. Never infer a clinical nexus from ontology membership.
