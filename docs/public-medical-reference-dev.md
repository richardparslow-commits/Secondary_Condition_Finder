# Public medical-reference research pilot — Tiger Cloud DEV

Status: **isolated DEV ingestion and verification pilot**. This is not a
production feature, automated medical opinion, medical coding recommendation,
clinical evidence approval, a veteran data store, or authorization to publish
any new secondary-condition relationship.

## Goals and source boundaries

Use official public APIs to build a versioned reference metadata set that can
support *research and review* of existing claims research, never infer a
secondary diagnosis or individual medical nexus from drugs or literature.

- **NCBI PubMed E-utilities**:
  `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi`.
  Collect IDs already present as active PMIDs in
  `data/evidence/master-sources.json`. Store PMID, publication date, title,
  DOI, publication-type labels and source URL. Do not store abstracts or
  auto-approve source citations. Publication-status signals are *review cues*;
  `scripts/preflight-source-status.js` remains the publication-status guard.
- **NLM RxNorm / RxNav**:
  `https://rxnav.nlm.nih.gov/REST/rxcui.json` and per-RxCUI properties.
  Exact-then-normalized active concept search (`search=2&allsrc=0`), never
  approximate lookup as clinical proof. Retain RxCUI/name/term-type and flag
  ambiguous results for human review. No drug-induced condition inference.
- **openFDA drug labels**: `https://api.fda.gov/drug/label.json`.
  Query the harmonized generic-name **exact** field and retain at most one
  sample labeling record per fixed public generic name. Store SPL label
  identifier, effective date, brand/generic metadata and booleans for presence
  of boxed warnings and adverse-reaction sections. **Do not** ingest full
  label text or FAERS signal reports or treat section presence as causation.
  An HTTP 404 becomes an explicit `unresolved` row; never silently invent a
  match or claim the result is exhaustive.

The repository fixture
`scripts/fixtures/medical-reference-dev-seeds.json` contains four active
public PMIDs and four generic drug names. The CLI cannot accept arbitrary
diagnoses, names, patient files, personal medication histories, or free text.
There is no server or client application path for uploading user data to these
APIs. All records have `reviewRequired: true` and are persisted with
`UNREVIEWED_RESEARCH_ONLY` status. Clinical source verification remains a
separate qualified-human decision.

## Official usage and provenance

- NCBI E-utilities default limit: **3 requests/second** without an API key;
  10/second with key by default. This pilot batches four PMIDs in one request.
  See https://eutilities.github.io/site/API_Key/usageandkey/
- RxNav documentation recommends throttling and caching; this pilot makes
  bounded serial requests with 450 ms spacing. See
  https://www.lhncbc.nlm.nih.gov/RxNav/APIs/
- openFDA API limits and authentication are described at
  https://open.fda.gov/apis/authentication/ . The pilot works without an
  API key at the unkeyed rate limits, but official limits and availability
  may change. Do not batch thousands of requests without rate planning.
- Optional `NCBI_API_KEY` and `OPENFDA_API_KEY` environment variables are
  used in-memory only, never written to the repository or result file.
- NLM acknowledgment: This product uses publicly available data from the U.S.
  National Library of Medicine (NLM), National Institutes of Health,
  Department of Health and Human Services; NLM is not responsible for the
  product and does not endorse or recommend this or any other product.

The URLs, source metadata digests, and observed-at timestamps are preserved
for provenance. Title/label metadata comes from providers and is not
independently clinically verified. Neither FDA labels nor observational
associations establish individual causation or VA nexus/eligibility.

## Tiger Cloud containment

Only existing service `m8vrpmo6ec`,
`secondary-condition-finder-test`, may be used. The shared Tiger lab helper
verifies READY + DEV classification, exact name and endpoint. The new module
independently pins the DEV hostname/port/database and refuses other services.
The global Tiger CLI `read_only: prod` safeguard remains enabled.

No new billable services are provisioned. No Production database, Vercel
environment variable, runtime routing, or user medical data is modified.

New schema on the designated DEV database:
`scf_medical_reference_dev`.

- `runs`: versioned SHA-256 identity, seed ID, source Git commit, observed-at
  time, record count, and fixed `UNREVIEWED_RESEARCH_ONLY` state.
- `reference_records`: provider, public source key, canonical URL, compact
  metadata, source date, status, record SHA-256, and a foreign key to the run.
  Unique per run/provider/source ID. No abstracts, label sections or client data.

The importer uses TLS certificate checking, parameterized SQL, a transaction
advisory lock, timeouts and no automatic SQL replay. It is idempotent for the
same immutable snapshot and rolls back on mismatches. `verify` uses
`BEGIN READ ONLY` and compares **every** persisted source key/status/URL
and content hash against the file; missing or extra records fail. Provider
fetches also have an allowlisted host, fixed GET method, no redirects,
bounded response sizes, conservative pacing and timeouts.

## Operations (Mac with Tiger CLI OAuth session)

From a clean checkout and with dependencies installed:

```sh
npm ci
node --test tests/medical-reference-dev.test.mjs
node scripts/medical-reference-dev.mjs collect --live
node scripts/medical-reference-dev.mjs apply --dev-write
node scripts/medical-reference-dev.mjs verify
```

The collector writes *public sanitized metadata only* to
`/tmp/scf-public-medical-reference-dev-pilot.json` with 0600 permissions.
Keep this file out of Git; it contains no API keys but is a snapshot artifact.
Inspect and archive it with a checksum if needed. For a new collection,
run `collect --live` again and inspect unresolved/changed records **before**
`apply`; a modified source response yields a different immutable run ID.
No time-based or background scheduled execution is installed.

`apply` is an explicit DEV-only write command; `verify` does no writes.
They require the exact fixture and the current snapshot. Do not run the
import against any PRODUCTION-tagged Tiger service, and do not grant this
research schema to public application endpoints.

## Initial pilot — November 8, 2026, America/Chicago

- Source base: GitHub main commit `382c354`.
- Provider requests: successful live PubMed, RxNorm, and openFDA responses.
- Snapshot digest:
  `2802f5901b3de490f7805a4421b70cca3533f6ea269eef2c3f8cbc5ea527c877`.
- 12 total public records: 4 PubMed metadata, 4 RxNorm concepts, 3
  sample FDA drug labels, 1 unresolved FDA exact generic-name lookup
  (atorvastatin). This is a research coverage gap, not a drug conclusion.
- Independent read-only SQL: 1 run, 12 records, all pending review.
- Re-import and re-verify passed: 1 run, no duplicate reference rows.

## Next phase after reviewing this PR

1. Expand to an operator-approved, bounded batch of **existing active** PubMed
   citations. Add source-status review joins without changing `verified` flags.
2. Add a separately reviewed FDA search fallback for generic names that do
   not have an exact harmonized value; flag broad search results as *candidate*
   labels, never automatic evidence.
3. Add explicit freshness and change summaries (new, revised, disappeared
   metadata) and performance benchmarks using the two existing Tiger DEV
   services. Monitor credit expiry and current service costs.
4. Only after PR #661's separate DEV Preview connection is verified should
   an authenticated, read-only operator report be considered for Vercel Preview.
   That report must not expose unreviewed research as published evidence.

No Production migration, live medical decision engine changes or PHI ingestion
are authorized by this pilot.
