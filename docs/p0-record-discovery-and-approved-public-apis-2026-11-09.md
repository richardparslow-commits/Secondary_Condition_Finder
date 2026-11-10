# P0 record-derived discovery and approved public research API pilot

Date: November 9, 2026 (America/Chicago). Scope: research-only development; no Production deployment, no clinical verification or VA claims submission.

## P0 veteran workflow

Step 4 now scans browser-local PDF, DOCX, text and OCR segments against the existing condition catalog. New candidate mentions include a bounded source quote, document source, page/line locator, author-credential classification and mention status: diagnosis-statement, suspected, historical, ruled-out, family-history, symptom-only, or ambiguous.

Only an affirmative clinician-authored mention without a contradicting negative or family-history finding is offered for explicit Veteran opt-in as a research topic. The Veteran also chooses a self-reported claim status: not-yet-claimed, pending, denied or unknown. Neither term matching nor self-report independently establishes medical diagnosis or VA award status. The directional secondary engine runs only for topics explicitly confirmed, not for automatic suggestions of future illness.

The accepted catalog IDs, claim statuses and opaque local source IDs are kept in the existing bounded session storage; raw quotes, source names and medical record contents remain browser-only and are excluded from the workflow context. Removing retained source evidence retracts corresponding record-derived topics. Clearing evidence removes all record-derived selections while keeping manually entered service-connected conditions.

Limitations: terminology matching is conservative, may miss unusual aliases or negation, and is not clinical NLP. User-selected author credentials are not verified. A source phrase found in a note is not a verified diagnosis. Contradictory, suspected and family-history findings are not eligible for automatic mapping. The app does not auto-create nexus opinions, certify evidence or publish research findings. Section 508 human review and VA production scope authorization remain separate.

## Research API import: completed DEV pilot

The existing NCBI E-utilities/PubMed, RxNorm and openFDA DEV pipeline is reused without duplicate imports. Two new provider adapters were implemented in scripts/automation/public-research-extensions-dev.mjs:

- ClinicalTrials.gov v2 official studies endpoint. Preserves NCT study ID, source date, status and limited public metadata.
- NIH RePORTER v2 official project search endpoint. Preserves application ID, core project number, year and limited public metadata.

The fixed public research pilot topics are specified in scripts/fixtures/public-research-extensions-dev-seeds.json. Arbitrary Veteran input and private medical records are NOT accepted by the importer. No full abstract, patient narrative or protected record was stored. Source URLs, retrieval time, repository commit and hashes are recorded.

DEV-only service identity: secondary-condition-finder-test; Tiger service ID m8vrpmo6ec; TLS direct port 30902. The separate database schema is scf_public_research_extensions_dev. All rows are labeled UNVERIFIED_RESEARCH_METADATA, and all runs RESEARCH_ONLY_NO_CLINICAL_APPROVAL. SQL is a single transaction with an independent read-only parity verification. No production database was modified.

Verified pilot: 9 ClinicalTrials.gov records plus 9 NIH RePORTER projects = 18. Snapshot SHA-256: 4c243af63c2cc20d113a2f39090f1d455b9fdbf5fe1ced084a1be39170adf405. The verifier returned DEV_METADATA_PARITY_PASS on the committed implementation. An earlier pre-commit pilot run with digest 94f35d17992ae10307f5db1be6bb2c37c3eb9ae7c99804cd4605e233232da947 also remains as an immutable historical DEV snapshot and must not be counted as 18 additional unique sources. Clinical approvals: zero. Public mapping changes: zero.

### Rerun procedure

From a clean local checkout of this development branch, with Node 22 and authorized Tiger CLI:

    npm ci
    npm run research:extensions:collect:dev
    npm run research:extensions:apply:dev
    npm run research:extensions:verify:dev
    npm run test:medical-reference-dev

Collection produces /tmp/scf-public-research-extensions-dev.json (mode 0600). Apply requires explicit --dev-write and validates the pinned DEV service, host, port, role and TLS before SQL. Do not retry uncertain SQL writes without a read-only verification. NIH RePORTER recommends at most one request per second, so the pilot is serial and capped at three results per source/topic.

The 18 imported records are a bounded, exploratory sample; not complete research coverage and not evidence of clinical causality.

## Other approved API integrations and unresolved gates

- NCBI E-utilities/PubMed: existing DEV pipeline; respects rate limits, registration and content reuse restrictions.
- ClinicalTrials.gov, NIH RePORTER: new live DEV import verified.
- MONDO, HPO, Monarch, Open Targets, PubTator3, NLM Clinical Tables: existing separate ontology research pipeline.
- VA Forms and Benefits Reference: existing sandbox/public-reference integration; Production still requires VA-issued access.
- VA Facilities: approved as a future resource-finder adapter; no active integration or VA API key configured by this pilot.
- VA Patient Health and Benefits Claims: not enabled; require approved scopes, Veteran OAuth consent and privacy/accessibility review.
- Benefits Intake: deferred until an authorized submission workflow is built.
- VA GitHub project directory and third-party VA API directories: reference sources, not live medical or benefits APIs.

No automatic clinical mapping approval, individual nexus determination, VA benefits filing, or Production publication is permitted by this research import.
