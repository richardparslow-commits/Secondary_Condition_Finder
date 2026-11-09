# Tiger Cloud DEV catalog parity — Vercel Preview

The application still uses its versioned catalog and knowledge-base data.
This connection is an **operator-only validation probe**, not a migration, a
change in medical evidence semantics, or a new production data source.

## Isolation and environments

- Authoritative reference: checked-in `data/conditions/*.json` and
  `data/knowledge-base/*.json` (or validated embedded equivalents).
- DEV fixture source: `llw8r9xm7v`,
  `secondary-condition-finder-fixture-source`.
- DEV validation destination: `m8vrpmo6ec`,
  `secondary-condition-finder-test`. The protected Vercel Preview endpoint
  **only** accepts this destination's direct PostgreSQL port 30902.
- PROD-tagged Tiger service `yc5kzxwazj` (`db-41579`) is **not used**.
  The local Mac Codex `tiger_db41579` MCP configuration is separate from the
  Vercel runtime and is not a production application connection.

In Vercel `secondary-condition-finder`, both secrets must be Preview-only:
`TIGER_DATABASE_URL` is the PostgreSQL URL for the DEV destination with
`preview_catalog_reader` (least-privilege SELECT, TLS required);
`TIGER_CATALOG_PROBE_TOKEN` is a separate 32+-character operator bearer token.
Never use `tsdbadmin`; never commit secrets or prefix them `NEXT_PUBLIC_`.
The route rejects every request when `VERCEL_ENV != preview` and every request
without a valid independent bearer token. Keep Vercel Deployment Protection.

## Controlled catalog load and exact verification

Use the repo's guarded lab script; it validates name, ID, READY state and DEV
environment before connecting, and it does not retry SQL after uncertain
disconnects:

```sh
node scripts/test-tiger-catalog.mjs seed llw8r9xm7v
node scripts/test-tiger-catalog.mjs verify llw8r9xm7v
node scripts/test-tiger-catalog.mjs verify m8vrpmo6ec
node scripts/test-tiger-catalog.mjs verify m8vrpmo6ec --pooled
```

Seeding is idempotent and creates immutable snapshot-keyed rows; a new
reference edition gets a different SHA-256 snapshot identity. The destination
is populated through the existing isolated replication mechanism; no writing
to the PROD service is required.

## Vercel Preview operator probe

`POST /api/internal/tiger-catalog-compare`

Pass `Authorization: Bearer <TIGER_CATALOG_PROBE_TOKEN>` using a secure client
that does not print the token, headers or connection URL. The response contains
only status and aggregate counts. No GET, browser client access, query-token
parameters, or credential logging.

The probe calculates the **same ordered SHA-256 snapshot** as the lab seeder
from checked-in reference values, then runs queries inside `BEGIN READ ONLY`:

- Conditions: every exact `id`, `name`, and `published` flag.
- Search terms and aliases: every normalized `term` and exact `condition_id`
  ownership, not just a count or a few sample queries.
- Pathways: every `source_id`, `target_id`, and exact `rank`, plus orphan
  edge detection.
- No rows are mutated; the transaction is rolled back. Query and connection
  timeouts are bounded and TLS certificates are verified.

Responses: HTTP 200 `parity_verified` means **all three datasets** match
exactly with zero orphaned edges; HTTP 409 `missing_tables`,
`snapshot_missing` or `parity_mismatch` distinguish structural,
snapshot-edition and content discrepancies; HTTP 503 masks database and
configuration errors; HTTP 404 means not Preview or not authorized.

This is catalog/alias/pathway parity, **not** clinical validity, citation
verification, a production launch approval, or a claim to have fixed unrelated
Vercel defects. Those require separate targeted tests and review.

## Initial Phase-2 baseline — 2026-11-08 America/Chicago

Reference main commit `382c354`, snapshot
`b24de5cf62e227e20e7da79b0c9acd3855413e30309638a55c474b1093bc2d21`.

Both DEV source and destination: 819 conditions, 2,165 normalized terms,
875 directed ranked pathway edges, 140 published mappings, zero orphaned
edges, 2,168 exact lookup probes; all passed. The idempotent source seed and
a separate pooled-destination parity verification also passed.

Credit usage: both DEV services already exist; avoid provisioning more until
Tiger Cloud billing/remaining-credit usage is explicitly checked. Do not
consume trial credits merely to force a zero balance. See
`docs/tiger-cloud-catalog-tests.md` for performance, recovery and pooler
campaigns, which run only on designated DEV services.
